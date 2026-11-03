"""zdzirki.com — strona + Hall of Fame / Hall of Shame.

Serwuje statyczną stronę z katalogu public/ oraz API do wgrywania klipów.
Klipy są wgrywane w kawałkach (Cloudflare Free odrzuca pojedyncze żądanie > 100 MB),
a potem kompresowane przez ffmpeg do max 1080p / 60 fps (H.264 + AAC).
"""

import asyncio
import json
import os
import re
import secrets
import shutil
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# ---------------------------------------------------------------- konfiguracja

DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
PUBLIC_DIR = Path(os.environ.get("PUBLIC_DIR", Path(__file__).resolve().parent.parent / "web" / "dist"))
UPLOAD_PASSWORD = os.environ.get("UPLOAD_PASSWORD", "")
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "100"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
MAX_DURATION_S = float(os.environ.get("MAX_DURATION_S", "60"))
DURATION_TOLERANCE_S = 0.5  # kontenery potrafią zaokrąglać długość w górę
CHUNK_BYTES = int(os.environ.get("CHUNK_MB", "16")) * 1024 * 1024
VIDEO_CRF = os.environ.get("VIDEO_CRF", "30")
VIDEO_PRESET = os.environ.get("VIDEO_PRESET", "slow")
MAX_SESSIONS = 5

INCOMING = DATA_DIR / "incoming"  # trwające uploady (czyszczone przy starcie)
QUEUE = DATA_DIR / "queue"  # kompletne surowe pliki czekające na kompresję
MEDIA = DATA_DIR / "media"  # gotowe mp4 + plakaty
DB_PATH = DATA_DIR / "clips.json"

CATEGORIES = {"fame", "shame"}
ID_RE = re.compile(r"^[0-9a-f]{32}$")
ROBOTS = b"noindex, nofollow, noarchive, noimageindex"

for _d in (INCOMING, QUEUE, MEDIA):
    _d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- stan

db_lock = asyncio.Lock()
sessions: dict[str, dict] = {}
jobs: asyncio.Queue[str] = asyncio.Queue()


def load_db() -> list[dict]:
    try:
        return json.loads(DB_PATH.read_text("utf-8"))
    except FileNotFoundError:
        return []


def save_db(clips: list[dict]) -> None:
    tmp = DB_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(clips, ensure_ascii=False, indent=1), "utf-8")
    os.replace(tmp, DB_PATH)


async def update_clip(clip_id: str, **fields) -> bool:
    """Aktualizuje klip; zwraca False, jeśli klip w międzyczasie usunięto."""
    async with db_lock:
        clips = load_db()
        for clip in clips:
            if clip["id"] == clip_id:
                clip.update(fields)
                save_db(clips)
                return True
    return False


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------- ffmpeg

async def run(*args: str, timeout: float) -> tuple[int, str, str]:
    proc = await asyncio.create_subprocess_exec(
        *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    try:
        out, err = await asyncio.wait_for(proc.communicate(), timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return -1, "", "timeout"
    return proc.returncode, out.decode(errors="replace"), err.decode(errors="replace")


async def probe(path: Path) -> dict | None:
    code, out, _ = await run(
        "ffprobe", "-v", "error", "-print_format", "json",
        "-show_format", "-show_streams", str(path), timeout=60,
    )
    if code != 0:
        return None
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return None


def media_duration(info: dict) -> float | None:
    candidates = [info.get("format", {}).get("duration")]
    candidates += [s.get("duration") for s in info.get("streams", [])]
    for value in candidates:
        try:
            seconds = float(value)
        except (TypeError, ValueError):
            continue
        if seconds > 0:
            return seconds
    return None


class ClipRejected(Exception):
    """Błąd do pokazania użytkownikowi (po polsku)."""


def find_clip(clip_id: str) -> dict | None:
    return next((c for c in load_db() if c["id"] == clip_id), None)


async def process(clip_id: str) -> None:
    raw = QUEUE / clip_id
    out = MEDIA / f"{clip_id}.mp4"
    part = MEDIA / f"{clip_id}.part.mp4"
    poster = MEDIA / f"{clip_id}.jpg"
    try:
        info = await probe(raw)
        streams = info.get("streams", []) if info else []
        if not any(s.get("codec_type") == "video" for s in streams):
            raise ClipRejected("To nie wygląda na plik wideo.")
        async with db_lock:
            clip = find_clip(clip_id) or {}
        limit = MAX_DURATION_S + DURATION_TOLERANCE_S
        start = float(clip.get("trim_start") or 0)
        end = clip.get("trim_end")
        duration = media_duration(info)
        if duration:
            if start >= duration:
                raise ClipRejected("Początek fragmentu jest za końcem klipu.")
            end = min(float(end), duration) if end else duration
        length = (end - start) if end else limit  # brak metadanych → twardy limit
        if length > limit:
            raise ClipRejected(
                f"Fragment ma {length:.1f} s — max to {MAX_DURATION_S:.0f} s. Przytnij go w edytorze."
            )
        has_audio = any(s.get("codec_type") == "audio" for s in streams)

        args = [
            "nice", "-n", "10", "ffmpeg", "-hide_banner", "-nostdin", "-y",
            # -ss przed -i + transkodowanie = cięcie z dokładnością do klatki
            "-ss", f"{start:.3f}", "-i", str(raw), "-t", f"{min(length, limit):.3f}",
            "-map", "0:v:0",
        ]
        if has_audio:
            args += ["-map", "0:a:0"]
        args += [
            # max 1080p (bez powiększania), max 60 fps
            "-vf", "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease"
                   ":force_divisible_by=2",
            "-fpsmax", "60",
            "-c:v", "libx264", "-preset", VIDEO_PRESET, "-crf", VIDEO_CRF,
            "-profile:v", "high", "-pix_fmt", "yuv420p",
        ]
        if has_audio:
            args += ["-c:a", "aac", "-b:a", "96k", "-ac", "2"]
        args += ["-map_metadata", "-1", "-movflags", "+faststart", "-f", "mp4", str(part)]

        code, _, err = await run(*args, timeout=1800)
        if code != 0:
            print(f"[ffmpeg] {clip_id} code={code}\n{err[-2000:]}", flush=True)
            raise ClipRejected("Kompresja się wywaliła — plik może być uszkodzony.")
        os.replace(part, out)

        final = await probe(out) or {}
        final_duration = media_duration(final) or length
        vstream = next((s for s in final.get("streams", []) if s.get("codec_type") == "video"), {})

        await run(
            "ffmpeg", "-hide_banner", "-nostdin", "-y",
            "-ss", f"{min(1.0, final_duration / 2):.2f}", "-i", str(out),
            "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "5", str(poster),
            timeout=120,
        )

        found = await update_clip(
            clip_id,
            status="ready",
            video=f"/media/{clip_id}.mp4",
            poster=f"/media/{clip_id}.jpg" if poster.exists() else None,
            size=out.stat().st_size,
            duration=round(final_duration, 1),
            width=vstream.get("width"),
            height=vstream.get("height"),
        )
        if not found:  # usunięty w trakcie kompresji
            out.unlink(missing_ok=True)
            poster.unlink(missing_ok=True)
    except ClipRejected as exc:
        await update_clip(clip_id, status="error", error=str(exc))
    except Exception as exc:  # noqa: BLE001 — klip nie może zawiesić workera
        print(f"[worker] {clip_id}: {exc!r}", flush=True)
        await update_clip(clip_id, status="error", error="Nieoczekiwany błąd serwera.")
    finally:
        raw.unlink(missing_ok=True)
        part.unlink(missing_ok=True)


async def worker() -> None:
    """Jedna kompresja naraz, żeby nie zarżnąć serwera."""
    while True:
        clip_id = await jobs.get()
        try:
            await process(clip_id)
        finally:
            jobs.task_done()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    for leftover in INCOMING.iterdir():  # sesje uploadu nie przeżywają restartu
        leftover.unlink(missing_ok=True)
    async with db_lock:
        clips = load_db()
        for clip in clips:
            if clip.get("status") == "processing":
                if (QUEUE / clip["id"]).exists():
                    jobs.put_nowait(clip["id"])
                else:
                    clip.update(status="error", error="Przerwane przez restart serwera.")
        save_db(clips)
    task = asyncio.create_task(worker())
    yield
    task.cancel()


# ---------------------------------------------------------------- aplikacja

app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


class RobotsHeader:
    """Nagłówek X-Robots-Tag na każdej odpowiedzi (strona ma nie być indeksowana)."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.inner(scope, receive, send)

        async def send_with_header(message):
            if message["type"] == "http.response.start":
                message["headers"] = [*message.get("headers", []), (b"x-robots-tag", ROBOTS)]
            await send(message)

        await self.inner(scope, receive, send_with_header)


app.add_middleware(RobotsHeader)


async def require_password(request: Request) -> None:
    if not UPLOAD_PASSWORD:
        raise HTTPException(503, "Wgrywanie wyłączone — ustaw UPLOAD_PASSWORD na serwerze.")
    given = unquote(request.headers.get("x-upload-password", ""))
    if not secrets.compare_digest(given.encode(), UPLOAD_PASSWORD.encode()):
        await asyncio.sleep(1)  # spowalnia zgadywanie
        raise HTTPException(401, "Złe hasło.")


def get_session(upload_id: str) -> dict:
    if not ID_RE.match(upload_id) or upload_id not in sessions:
        raise HTTPException(404, "Nie ma takiego uploadu (może serwer się zrestartował?).")
    return sessions[upload_id]


class UploadInit(BaseModel):
    category: str
    title: str = Field(min_length=1, max_length=120)
    author: str = Field(default="", max_length=40)
    size: int = Field(gt=0)
    trim_start: float = Field(default=0, ge=0)
    trim_end: float | None = Field(default=None, gt=0)


@app.get("/api/config")
async def config():
    return JSONResponse(
        {
            "max_upload_mb": MAX_UPLOAD_MB,
            "max_duration_s": MAX_DURATION_S,
            "upload_enabled": bool(UPLOAD_PASSWORD),
        },
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/clips")
async def list_clips():
    async with db_lock:
        clips = load_db()
    clips.sort(key=lambda c: c["created"], reverse=True)
    return JSONResponse(clips, headers={"Cache-Control": "no-store"})


@app.post("/api/uploads")
async def start_upload(body: UploadInit, request: Request):
    await require_password(request)
    if body.category not in CATEGORIES:
        raise HTTPException(400, "Nieznana kategoria.")
    title = body.title.strip()
    if not title:
        raise HTTPException(400, "Podaj tytuł.")
    if body.trim_end is not None:
        if body.trim_end - body.trim_start < 0.3:
            raise HTTPException(400, "Fragment jest za krótki.")
        if body.trim_end - body.trim_start > MAX_DURATION_S + DURATION_TOLERANCE_S:
            raise HTTPException(400, f"Fragment może mieć max {MAX_DURATION_S:.0f} s.")
    if body.size > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"Plik za duży — limit to {MAX_UPLOAD_MB} MB.")
    if len(sessions) >= MAX_SESSIONS:
        raise HTTPException(429, "Za dużo wgrywań naraz, spróbuj za chwilę.")
    if shutil.disk_usage(DATA_DIR).free < body.size * 3 + 200 * 1024 * 1024:
        raise HTTPException(507, "Na serwerze kończy się miejsce.")

    upload_id = uuid.uuid4().hex
    (INCOMING / upload_id).touch()
    sessions[upload_id] = {
        "category": body.category,
        "title": title,
        "author": body.author.strip(),
        "size": body.size,
        "trim_start": body.trim_start,
        "trim_end": body.trim_end,
        "lock": asyncio.Lock(),
    }
    return {"upload_id": upload_id, "chunk_size": CHUNK_BYTES}


@app.get("/api/uploads/{upload_id}")
async def upload_status(upload_id: str, request: Request):
    await require_password(request)
    session = get_session(upload_id)
    return {"received": (INCOMING / upload_id).stat().st_size, "size": session["size"]}


@app.put("/api/uploads/{upload_id}/chunk")
async def upload_chunk(upload_id: str, offset: int, request: Request):
    await require_password(request)
    session = get_session(upload_id)
    if session["lock"].locked():
        raise HTTPException(409, "Ten kawałek już się wgrywa.")
    async with session["lock"]:
        path = INCOMING / upload_id
        received = path.stat().st_size
        if offset != received:
            raise HTTPException(409, {"message": "Zły offset.", "received": received})
        written = 0
        with path.open("ab") as fh:
            async for piece in request.stream():
                written += len(piece)
                if received + written > session["size"] or written > CHUNK_BYTES:
                    raise HTTPException(413, "Za dużo danych w kawałku.")
                fh.write(piece)
        return {"received": received + written}


@app.post("/api/uploads/{upload_id}/finish")
async def finish_upload(upload_id: str, request: Request):
    await require_password(request)
    session = get_session(upload_id)
    received = (INCOMING / upload_id).stat().st_size
    if received != session["size"]:
        raise HTTPException(400, f"Brakuje danych ({received} z {session['size']} B).")
    sessions.pop(upload_id)
    os.replace(INCOMING / upload_id, QUEUE / upload_id)
    clip = {
        "id": upload_id,
        "category": session["category"],
        "title": session["title"],
        "author": session["author"],
        "created": now_iso(),
        "status": "processing",
        "original_size": received,
        "trim_start": session["trim_start"],
        "trim_end": session["trim_end"],
    }
    async with db_lock:
        clips = load_db()
        clips.append(clip)
        save_db(clips)
    await jobs.put(upload_id)
    return clip


@app.delete("/api/clips/{clip_id}")
async def delete_clip(clip_id: str, request: Request):
    await require_password(request)
    if not ID_RE.match(clip_id):
        raise HTTPException(404, "Nie ma takiego klipu.")
    async with db_lock:
        clips = load_db()
        remaining = [c for c in clips if c["id"] != clip_id]
        if len(remaining) == len(clips):
            raise HTTPException(404, "Nie ma takiego klipu.")
        save_db(remaining)
    for path in (MEDIA / f"{clip_id}.mp4", MEDIA / f"{clip_id}.jpg"):
        path.unlink(missing_ok=True)
    return {"ok": True}


# Montowania na końcu — trasy API muszą mieć pierwszeństwo przed "/".
app.mount("/media", StaticFiles(directory=MEDIA), name="media")
app.mount("/", StaticFiles(directory=PUBLIC_DIR, html=True), name="site")

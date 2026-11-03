# zdzirki.com

Retro strona ekipy (lata 2000) + **Hall of Fame / Hall of Shame** z wgrywaniem klipów z LoL-a.

- **Frontend:** React + Vite (`web/`), design 1:1 ze starej wersji HTML.
- **Backend:** FastAPI (`app/main.py`) — serwuje zbudowaną stronę, przyjmuje klipy i kompresuje je ffmpeg-iem.
- **Wszystko w jednym kontenerze** na porcie `10007` (tylko `127.0.0.1`), SSL robi tunel Cloudflare (`cloudflared` na hoście).

```
przeglądarka --HTTPS--> Cloudflare --tunel--> cloudflared (host) --HTTP--> 127.0.0.1:10007 --> kontener zdzirki
```

## Klipy

- Wgrywanie i usuwanie wymaga **hasła ekipy** (`UPLOAD_PASSWORD` w `.env`). Bez hasła upload jest wyłączony.
- Limit **100 MB** na plik (sprawdzany w przeglądarce i na serwerze).
- Max **60 s** — dłuższy klip przycina się w edytorze na stronie (suwaki start/koniec, podgląd fragmentu).
  Przeglądarka wysyła cały plik + zakres, serwer tnie i kompresuje w jednym przebiegu.
- Kompresja: H.264 do **max 1080p / 60 fps** (bez powiększania), CRF 30, preset `slow`, AAC 96 kb/s,
  `faststart`. Surowy plik jest kasowany po kompresji. Jedna kompresja naraz (`nice`), żeby nie zarżnąć serwera.
- Plik idzie w kawałkach po 16 MB (darmowy Cloudflare odrzuca pojedyncze żądanie > 100 MB),
  po zerwaniu sieci upload wznawia się od miejsca, w którym przerwał.
- Klipy i ich lista leżą w wolumenie Dockera `zdzirki-data` — przeżywają rebuild i restart.

Opcjonalne zmienne środowiskowe (w `docker-compose.yml` → `environment`):
`MAX_UPLOAD_MB` (100), `MAX_DURATION_S` (60), `VIDEO_CRF` (30 — wyżej = mniejszy plik, gorsza jakość),
`VIDEO_PRESET` (slow), `CHUNK_MB` (16).

## Wdrożenie (Debian z działającym cloudflared)

```
git pull
cp .env.example .env      # tylko za pierwszym razem
nano .env                 # UPLOAD_PASSWORD=wasze-haslo
docker compose up -d --build
```

Tunel Cloudflare zostaje bez zmian: origin `http://localhost:10007`.

## Lokalnie

```
cd web && npm install && npm run dev        # frontend na :5173 (proxy /api i /media -> :8000)
pip install -r requirements.txt
DATA_DIR=./data UPLOAD_PASSWORD=test uvicorn app.main:app --port 8000   # z katalogu głównego, wymaga ffmpeg
```

Strona ma `noindex` (meta + nagłówek `X-Robots-Tag`) — nie ma być w wyszukiwarkach.

# --- 1) frontend: React + Vite -> statyczne pliki ---
FROM node:24-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY web/ ./
RUN npm run build

# --- 2) serwer: FastAPI + ffmpeg (kompresja klipów) ---
FROM python:3.12-slim-bookworm
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
COPY --from=web /web/dist ./public/

# dane (klipy + baza) w wolumenie /data, proces bez roota
RUN useradd --system --uid 10001 zdzirki && mkdir -p /data && chown zdzirki /data
ENV DATA_DIR=/data PUBLIC_DIR=/app/public PYTHONUNBUFFERED=1
USER zdzirki
VOLUME /data
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

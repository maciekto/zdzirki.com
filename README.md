# zdzirki.com

Statyczna strona (retro lata 2000) serwowana przez nginx w Dockerze.
SSL/HTTPS zapewnia tunel Cloudflare (`cloudflared`) działający na hoście.

## Architektura

```
przeglądarka --HTTPS/443--> Cloudflare --tunel--> cloudflared (host) --HTTP--> 127.0.0.1:10007 --> nginx
```

- Origin (nginx) działa po **HTTP** na porcie `10007` — certyfikat i 443 obsługuje Cloudflare.
- Port jest bindowany do `127.0.0.1`, więc z internetu/LAN-u jest niedostępny;
  ruch wchodzi wyłącznie przez Cloudflare. Chcesz dostęp z LAN? zmień w
  `docker-compose.yml` na `"10007:80"`.

## Wdrożenie (Debian z już postawionym cloudflared)

1. `git clone` repo na serwer i wejdź do katalogu.
2. Start:
   ```
   docker compose up -d --build
   ```
3. W konfiguracji tunelu Cloudflare skieruj publiczny hostname (np. `zdzirki.com`)
   na origin **HTTP** → `http://localhost:10007`.

Aktualizacja po zmianach: `git pull && docker compose up -d --build`.

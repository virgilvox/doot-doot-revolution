# doot yt-service

A tiny yt-dlp backend so the **web** app can import YouTube audio. A browser cannot
rip YouTube itself (CORS wall plus signature/n-parameter deciphering that needs a
runtime), so the web app hands YouTube links to this service. The desktop app does
not need it (it rips locally with yt-dlp in the Electron main process).

## Contract

```
GET <endpoint>?url=<youtube-url>
-> 200: audio bytes
     Content-Type:   audio/webm | audio/mp4 | audio/mpeg
     X-Video-Title:  <URL-encoded title>   (exposed via CORS)
-> 400 bad url · 413 too long · 502 rip failed
```

The web app expects exactly this; set `VITE_YT_ENDPOINT` to the deployed URL.

## Env

- `PORT` — listen port (App Platform sets this automatically).
- `ALLOW_ORIGIN` — CORS origin to allow. **Set this to your site** (e.g.
  `https://dance.doot.games`) so the service is not an open ripper for anyone. Default `*`.
- `MAX_SECONDS` — reject videos longer than this (default 720 = 12 min).

## Deploy on DigitalOcean App Platform

Add a **service** component to your app pointing at `server/youtube` and using its
`Dockerfile` (the Dockerfile matters: yt-dlp's zip-app needs `python3`, which the
plain Node buildpack does not include). Then set the web component's build-time env
`VITE_YT_ENDPOINT` to the service's URL and redeploy the site.

```sh
# local smoke test
cd server/youtube && npm install && npm start
curl -s 'http://localhost:8080/?url=https://www.youtube.com/watch?v=VIDEO' -o out.webm -D -
```

## Caveats

- **Datacenter IPs get blocked.** YouTube rate-limits and 403s cloud IPs, so a hosted
  ripper fails intermittently (worse under load). The desktop app, on a home IP, is
  the reliable path. Cookies or a residential proxy help but are out of scope here.
- **Terms and copyright.** Downloading YouTube audio is against YouTube's terms and
  pulls copyrighted material; run this only for content you are entitled to use, and
  keep `ALLOW_ORIGIN` locked to your own site.
- **Extractor drift.** Bump `youtube-dl-exec` (and thus yt-dlp) when YouTube changes.

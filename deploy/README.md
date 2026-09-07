# deploy/ – running the dashboard as a service on this machine

The dashboard reads local files (`data/`, `content/`) and the engines need ffmpeg, so the whole thing
runs where the reels are rendered. A Windows scheduled task keeps the production server up:

```
npm run build                                                   # once, and after every code change
powershell -ExecutionPolicy Bypass -File deploy\install-service.ps1
```

It starts at log-on, restarts if it dies, and logs to `deploy/dashboard.log`. Remove with `-Remove`.

**Do not expose port 3000 to the internet.** The calendar has no login and can post to a real
Instagram account with one click. If you need it from your phone, put it behind a login first
(Cloudflare Access, Tailscale, or basic auth on a reverse proxy).

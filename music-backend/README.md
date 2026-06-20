# Music Backend

Express API for the Veles browser extension. It authenticates extension users, searches shared music providers, keeps short-lived download jobs, converts covers to WebP quality 95, and saves completed tracks into the Navidrome library.

The service listens on HTTP inside Docker on port `80`. In the production setup, the existing Caddy container is the only public listener on ports `80` and `443`; it must proxy `music-backend.dvaranir.com` over a shared Docker network. Cloudflare proxies the public hostname and terminates public HTTPS.

The backend has no host port mapping, so it cannot bypass Caddy or Cloudflare. The Compose configuration expects Caddy's Docker network to be named `dnd_default`, the network created by the `dnd` Compose project. Confirm its actual name with:

```bash
docker inspect lastlight-quartz --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}'
```

If needed, set `CADDY_DOCKER_NETWORK=<network-name>` in the root `.env`. Add this site to Caddy's configuration:

```caddyfile
http://music-backend.dvaranir.com {
    reverse_proxy music-backend:80
}
```

Reload Caddy after changing its configuration. Both containers must remain attached to the same external network; Docker then resolves the backend by its service name, `music-backend`.

Persistent data is SQLite at `/app/data/music-backend.sqlite`; finished tracks are written to `/app/music`.

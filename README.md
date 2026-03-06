# caddy-rproxy

Caddy reverse proxy docker-compose setup.

## Dynamic Home Allowlist

Use this when Caddy sits behind a Fritzbox and should trust the currently assigned public home IPv4 plus delegated IPv6 prefix instead of `private_ranges`.

- `dynamic/home-allowlist.caddy` is bind-mounted to `/etc/caddy/dynamic/home-allowlist.caddy`.
- The file is intended to be updated by automation such as `Fritzbox -> n8n`.
- Keep the file content as a single valid `remote_ip ...` directive, for example:

```caddyfile
remote_ip 198.51.100.24/32 2001:db8:1234:5600::/56
```

- After updating the file, reload Caddy with:

```sh
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Because the allowlist lives in the bind-mounted `dynamic/` directory, the latest values survive a Caddy container restart as long as the file is kept up to date.

In the `Caddyfile`, import the matcher snippet with `import dynamic_home_allowlist` and then use `@from_dynamic_home` where a site needs the dynamic home-IP allowlist.

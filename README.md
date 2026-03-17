# caddy-rproxy

Caddy reverse proxy docker-compose setup.

## Authelia route

The reverse proxy exposes Authelia at `auth.{$CADDY_SUBDOMAIN}` and forwards traffic to
`http://authelia:9091` on the shared Docker network `network_backend_net`.

Related stack: https://github.com/sidey79/authelia-docker

## Environment

Set `TELEGRAM_WEBHOOK_SECRET` to the same value used by the Scanservjs Telegram bot webhook. Caddy checks this value against the `X-Telegram-Bot-Api-Secret-Token` header and only bypasses mTLS for:

- `POST /webhook/scanservjs/telegram/reissue`
- `POST /webhook-test/scanservjs/telegram/reissue`

All other `workflow.*` paths remain protected by the existing mTLS policy.

`docker compose up` starts a one-shot `fetch-workflow-assets` service before Caddy. It downloads `github-pr-dashboard.css` from `sidey79/n8n_wf_build` into `site/workflow/assets/`.

Set `GITHUB_TOKEN` to a fine-grained GitHub token with read access to repository contents. Optionally set `GITHUB_ASSET_REF` to fetch from a branch or tag other than `main`.

## Portainer Asset Sync

Portainer may create bind-mounted directories and files under `site/` as `root:root`. For that reason, `fetch-workflow-assets` runs as `root` by design so it can overwrite `site/workflow/assets/github-pr-dashboard.css` during stack startup.

The long-running `caddy` service still runs as `5100:5100` and only serves the downloaded files read-only from the same bind mount.

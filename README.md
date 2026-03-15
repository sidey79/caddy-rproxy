# caddy-rproxy

Caddy reverse proxy docker-compose setup.

## Environment

Set `TELEGRAM_WEBHOOK_SECRET` to the same value used by the Scanservjs Telegram bot webhook. Caddy checks this value against the `X-Telegram-Bot-Api-Secret-Token` header and only bypasses mTLS for:

- `POST /webhook/scanservjs/telegram/reissue`
- `POST /webhook-test/scanservjs/telegram/reissue`

All other `workflow.*` paths remain protected by the existing mTLS policy.

`docker compose up` starts a one-shot `fetch-workflow-assets` service before Caddy. It downloads `github-pr-dashboard.css` from `sidey79/n8n_wf_build` into `site/workflow/assets/`.

Set `GITHUB_TOKEN` to a fine-grained GitHub token with read access to repository contents. Optionally set `GITHUB_ASSET_REF` to fetch from a branch or tag other than `main`.

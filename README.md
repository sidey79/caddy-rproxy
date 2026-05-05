# caddy-rproxy

Caddy reverse proxy docker-compose setup.

## Authelia route

The reverse proxy exposes Authelia at `auth.{$CADDY_SUBDOMAIN}` and forwards traffic to
`http://authelia:9091` on the shared Docker network `network_backend_net`.

Related stack: https://github.com/sidey79/authelia-docker

## Paperless Authentication

`dms.{$CADDY_SUBDOMAIN}` is protected by Authelia `forward_auth` and no longer uses
client-certificate access control. Caddy forwards the authenticated Authelia identity
headers upstream so Paperless can authenticate users via `HTTP_REMOTE_USER`.

## FHEM Authentication

`fhem.{$CADDY_SUBDOMAIN}` accepts either a valid client certificate or a successful
Authelia `forward_auth` check. In both cases Caddy injects the upstream
`Authorization` header for FHEM from `FHEM_BASIC_AUTH_HEADER`. The value must be the
full header value, for example `Basic base64(username:password)`.

If `FHEM_BASIC_AUTH_HEADER` is unset, the FHEM route still proxies traffic but does
not add an upstream `Authorization` header.

When a valid client certificate is present, Caddy also forwards these headers to FHEM:

- `X-Client-Cert-Serial`
- `X-Client-Cert-Subject`
- `X-Client-Cert-Fingerprint`

The route uses `mTLS_optional`. The workflow host does not expose the n8n editor or any generic
backend path. It only serves the local workflow asset store from `/assets/*`, exposes `GET/HEAD
/api/me` behind Authelia without requiring a client certificate, protects the browser UI for
`/webhook/github-pr-dashboard` with Authelia, and forwards the `POST` webhook request to n8n. If a
client certificate is provided, selected certificate metadata is forwarded to Authelia via headers:

- `X-Client-Cert-Serial`
- `X-Client-Cert-Subject`
- `X-Client-Cert-Fingerprint`

## Landing Page

`landing.{$CADDY_SUBDOMAIN}` is protected by Authelia and serves static files from
`site/landingpage`.

The same host exposes `GET /api/me` and rewrites that request to the internal n8n webhook path
`/webhook/landing/api/me` before proxying it upstream. This keeps the browser UI and the identity
API on the same origin without requiring a client certificate. The workflow host also accepts
`GET/HEAD /api/me` as a narrow alias to the same internal n8n webhook.

## Environment

Set `TELEGRAM_WEBHOOK_SECRET` to the same value used by the Scanservjs Telegram bot webhook. Caddy checks this value against the `X-Telegram-Bot-Api-Secret-Token` header and only bypasses mTLS for:

- `POST /webhook/scanservjs/telegram/reissue`
- `POST /webhook-test/scanservjs/telegram/reissue`

All other `workflow.*` paths remain protected by the existing mTLS policy.

The workflow host also exposes dedicated aliases for the Alexa/Gemini workflow:

- `/webhook/antannah/alexa-gemini` -> `/webhook/alexa-gemini`
- `/webhook-test/antannah/alexa-gemini` -> `/webhook-test/alexa-gemini`

These aliases keep the public URL separate from other webhooks while leaving the n8n registration path unchanged. They use the same mTLS/Authelia handling as the other n8n webhook paths.

`docker compose up` starts a one-shot `fetch-workflow-assets` service before Caddy. It downloads `github-pr-dashboard.css` from `sidey79/n8n_wf_build` into `site/workflow/assets/`.

Set `GITHUB_TOKEN` to a fine-grained GitHub token with read access to repository contents. Optionally set `GITHUB_ASSET_REF` to fetch from a branch or tag other than `main`.

## Portainer Asset Sync

Portainer may create bind-mounted directories and files under `site/` as `root:root`. For that reason, `fetch-workflow-assets` runs as `root` by design so it can overwrite `site/workflow/assets/github-pr-dashboard.css` during stack startup.

The long-running `caddy` service still runs as `5100:5100` and only serves the downloaded files read-only from the same bind mount.

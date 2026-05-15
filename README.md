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

The route uses `mTLS_optional`. Without a client certificate, the workflow host only serves the
local workflow asset store from `/assets/*`, exposes `GET/HEAD /api/me` behind Authelia without
requiring a client certificate, protects the browser UI for `/webhook/github-pr-dashboard` with
Authelia, and forwards the `POST` webhook request to n8n. With a client certificate, all remaining
`workflow.*` paths are forwarded to n8n after the explicit path exceptions have been evaluated. If a
client certificate is provided, selected certificate metadata is forwarded upstream via headers:

- `X-Client-Cert-Serial`
- `X-Client-Cert-Subject`
- `X-Client-Cert-Fingerprint`

The workflow host also forwards `GET/HEAD/OPTIONS /rest/oauth2-credential*` directly to n8n. This
keeps n8n OAuth2 callback URLs such as `https://workflow.sidey.blausee.eu/rest/oauth2-credential`
reachable by external OAuth providers without exposing the generic n8n editor or REST API to clients
without a certificate.

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

All other `workflow.*` paths require a client certificate and are then forwarded to n8n.

The workflow host also exposes dedicated aliases for the Alexa/Gemini workflow:

- `/webhook/antannah/alexa-gemini`
- `/webhook-test/antannah/alexa-gemini`
- `/webhook/sven/alexa-gemini`
- `/webhook-test/sven/alexa-gemini`

`POST` requests to these paths bypass mTLS and Authelia; other methods and webhook paths keep the normal mTLS/Authelia handling.

`docker compose up` starts a one-shot `fetch-workflow-assets` service before Caddy. It downloads `github-pr-dashboard.css` from `sidey79/n8n_wf_build` into `site/workflow/assets/`.

Set `GITHUB_TOKEN` to a fine-grained GitHub token with read access to repository contents. Optionally set `GITHUB_ASSET_REF` to fetch from a branch or tag other than `main`.

## Portainer Asset Sync

Portainer may create bind-mounted directories and files under `site/` as `root:root`. For that reason, `fetch-workflow-assets` runs as `root` by design so it can overwrite `site/workflow/assets/github-pr-dashboard.css` during stack startup.

The long-running `caddy` service still runs as `5100:5100` and only serves the downloaded files read-only from the same bind mount.

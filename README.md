# caddy-rproxy

Caddy reverse proxy docker-compose setup.

## Environment

Set `TELEGRAM_WEBHOOK_SECRET` to the same value used by the Scanservjs Telegram bot webhook. Caddy checks this value against the `X-Telegram-Bot-Api-Secret-Token` header and only bypasses mTLS for:

- `POST /webhook/scanservjs/telegram/reissue`
- `POST /webhook-test/scanservjs/telegram/reissue`

All other `workflow.*` paths remain protected by the existing mTLS policy.

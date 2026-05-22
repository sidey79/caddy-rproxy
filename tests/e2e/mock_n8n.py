#!/usr/bin/env python3
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def _send_json(self, code, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Upstream", "n8n-mock")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self._handle()

    def do_HEAD(self):
        self._handle(head=True)

    def do_POST(self):
        self._handle()

    def _handle(self, head=False):
        path = self.path
        if path == "/webhook/backup/status-public":
            payload = {"status": "ok", "backupName": "paperless", "checkedAt": "2026-05-23T00:00:00Z"}
            if head:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("X-Upstream", "n8n-mock")
                self.end_headers()
            else:
                self._send_json(200, payload)
            return

        if path == "/webhook/backup/names":
            payload = {"count": 1, "backupNames": ["paperless"], "backups": [{"backupName": "paperless", "status": "ok"}]}
            if head:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("X-Upstream", "n8n-mock")
                self.end_headers()
            else:
                self._send_json(200, payload)
            return

        if path == "/webhook/landing/api/me":
            payload = {"user": "test-user", "groups": ["admins"], "role": "admin"}
            if head:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("X-Upstream", "n8n-mock")
                self.end_headers()
            else:
                self._send_json(200, payload)
            return

        # Generic webhook sink for protected workflow endpoints.
        if path.startswith("/webhook/") or path.startswith("/webhook-test/") or path.startswith("/rest/oauth2-credential"):
            payload = {"ok": True, "path": path, "method": self.command}
            if head:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("X-Upstream", "n8n-mock")
                self.end_headers()
            else:
                self._send_json(200, payload)
            return

        self._send_json(404, {"error": "not found", "path": path})

    def log_message(self, fmt, *args):
        return

if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 5678), Handler).serve_forever()

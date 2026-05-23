#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._handle()

    def do_POST(self):
        self._handle()

    def _handle(self):
        if self.path != "/api/authz/forward-auth":
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"not found")
            return

        allowed = self.headers.get("X-Test-Auth", "") == "allow"
        if not allowed:
            self.send_response(401)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"unauthorized")
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Remote-User", "test-user")
        self.send_header("Remote-Groups", "admins")
        self.send_header("Remote-Email", "test@example.com")
        self.send_header("Remote-Name", "Test User")
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, fmt, *args):
        return

if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 9091), Handler).serve_forever()

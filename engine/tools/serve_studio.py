"""Serve Bee Garden and relay game drafts to an already-installed local Ollama model."""
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import BoundedSemaphore
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

PORT = 11435
ROOT = Path(__file__).resolve().parents[1]
LOCAL = {f"http://localhost:{PORT}", f"http://127.0.0.1:{PORT}"}
ORIGINS = LOCAL | {"https://hahyuck.github.io"}
BUSY = BoundedSemaphore(1)


class Studio(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def allowed(self):
        host = self.headers.get("Host", "")
        origin = self.headers.get("Origin")
        return f"http://{host}" in LOCAL and (origin is None or origin in ORIGINS)

    def end_headers(self):
        origin = self.headers.get("Origin")
        if origin in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204 if self.path == "/studio/generate" and self.allowed() else 403)
        self.end_headers()

    def do_POST(self):
        if self.path != "/studio/generate" or not self.allowed():
            return self.send_error(403)
        if self.headers.get_content_type() != "application/json":
            return self.send_error(415)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 16000:
                return self.send_error(413)
            data = json.loads(self.rfile.read(length))
            if not isinstance(data["model"], str) or not 0 < len(data["model"]) <= 100:
                return self.send_error(400)
            req = Request("http://127.0.0.1:11434/api/chat", method="POST",
                          headers={"Content-Type": "application/json"},
                          data=json.dumps({"model": data["model"], "stream": False, "think": False,
                              "format": data["schema"], "options": {"temperature": .35, "num_predict": 320},
                              "messages": [{"role": "system", "content": data["system"]},
                                           {"role": "user", "content": data["message"]}]}).encode())
        except (KeyError, TypeError, ValueError):
            return self.send_error(400)
        if not BUSY.acquire(blocking=False):
            return self.send_error(429)
        try:
            with urlopen(req, timeout=90) as response:
                draft = json.loads(json.load(response)["message"]["content"])
            body = json.dumps(draft, ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (HTTPError, URLError, TimeoutError, KeyError, ValueError):
            self.send_error(502, "Local model unavailable or invalid reply")
        finally:
            BUSY.release()


if __name__ == "__main__":
    print(f"Bee Garden AI studio: http://127.0.0.1:{PORT}/?menu=make", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Studio).serve_forever()

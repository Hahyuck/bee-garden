"""Preview the game studio locally. AI requests open the selected provider in its own app."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    print("Bee Garden studio: http://127.0.0.1:11435/?menu=make", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 11435), handler).serve_forever()

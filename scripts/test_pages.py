#!/usr/bin/env python3
"""Check the Pages output is minimal, complete and safe to publish."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import re

SITE = Path(__file__).resolve().parent.parent / "site"
NAMES = {item.name for item in SITE.iterdir()}
EXPECTED = {"index.html", "preview-v2.html", ".nojekyll", "fox-test-v09-data.json"}
assert EXPECTED <= NAMES, f"Missing required preview files: {EXPECTED - NAMES}"
assert all(
    name in EXPECTED or Path(name).suffix in {".js", ".css", ".svg", ".webmanifest"}
    for name in NAMES
), "Pages output includes a nonallowlisted resource"
assert all("selftest" not in name.lower() and "backup" not in name.lower() for name in NAMES)
assert not any(name.endswith((".sh", ".py", ".md", ".zip")) for name in NAMES)

index = (SITE / "index.html").read_text(encoding="utf-8")
preview = (SITE / "preview-v2.html").read_text(encoding="utf-8")
assert index == preview, "Preview alias must use the cache-safe production entry point"
assert "Fox Optimiser" in index
assert "serviceWorker.getRegistrations()" not in index
assert "caches.keys()" not in index

class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.referenced = []
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        value = d.get("src") if tag == "script" else (
            d.get("href") if tag == "link" and d.get("rel") in ("stylesheet", "icon", "manifest") else None
        )
        if value:
            self.referenced.append(value)

parsed = References()
parsed.feed(index)
assert len(parsed.referenced) >= 25, "Unexpectedly few script/style references"
for ref in parsed.referenced:
    path = urlsplit(ref).path
    assert path in NAMES, f"Broken Pages asset reference: {ref}"
    assert re.search(r"[?]build=[0-9a-fA-F]{7,12}|[?]build=local", ref), f"Unversioned asset: {ref}"

assert (SITE / "manifest.webmanifest").exists()
assert (SITE / "icon.svg").exists()
assert (SITE / "app.js").exists()
assert not (SITE / "sw.js").exists(), "Old service-worker cache must not be published"
print(f"PAGES PREVIEW PASS: {len(NAMES)} safe published files, all {len(parsed.referenced)} asset references resolve.")

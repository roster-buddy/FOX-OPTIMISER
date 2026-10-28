#!/usr/bin/env python3
"""Prepare an allowlisted, read-only static preview for GitHub Pages.

Only assets referenced by the production index.html are copied. This prevents
accidental Pages publication of repository scripts, backups and development files.
"""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import os
import re
import shutil

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "site"
INDEX = ROOT / "index.html"
VALID_EXTENSIONS = {".js", ".css", ".svg", ".webmanifest"}
EXTRA_STATIC_ASSETS = {"fox-test-v09-data.json"}  # Deliberately labelled sample data.


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths: set[str] = set()

    def handle_starttag(self, tag: str, attributes: list[tuple[str, str | None]]):
        values = dict(attributes)
        if tag == "script":
            self._check(values.get("src"))
        elif tag == "link" and values.get("rel") in ("stylesheet", "icon", "manifest"):
            self._check(values.get("href"))

    def _check(self, value: str | None):
        if not value:
            return
        parsed = urlsplit(value)
        if parsed.scheme or parsed.netloc or parsed.fragment:
            raise ValueError("Unexpected external or fragmented static asset: " + value)
        path = parsed.path
        if not path or path != Path(path).name or "\\" in path or not re.fullmatch(r"[A-Za-z0-9_.-]+", path):
            raise ValueError("Unsafe or nested static asset: " + value)
        if Path(path).suffix not in VALID_EXTENSIONS:
            raise ValueError("Unexpected static asset type: " + value)
        if parsed.query and not re.fullmatch(r"(?:v|build)=[A-Za-z0-9_.-]+", parsed.query):
            raise ValueError("Unrecognised asset query parameters: " + value)
        self.paths.add(path)


def make_site():
    original = INDEX.read_text(encoding="utf-8")
    parser = References()
    parser.feed(original)
    if not parser.paths or "app.js" not in parser.paths:
        raise ValueError("Missing expected Fox Optimiser script references")

    if DEST.is_symlink():
        raise ValueError("Refusing to overwrite a symlink destination")
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir()
    version = os.environ.get("GITHUB_SHA", "local")
    if not re.fullmatch(r"[0-9a-fA-F]{7,64}|local", version):
        raise ValueError("Invalid deployment revision")
    version = version[:12]

    # Bump every asset URL on each deployment, including unchanged files.
    # This avoids stale JS/CSS on Safari after a deployment is published.
    def version_url(match: re.Match[str]) -> str:
        value = match.group("value")
        parsed = urlsplit(value)
        if parsed.path not in parser.paths:
            return match.group(0)
        return match.group("prefix") + parsed.path + "?build=" + version + match.group("quote")

    output = re.sub(
        r'(?P<prefix>(?:src|href)=(?P<quote>["\']))(?P<value>[^"\']+)(?P=quote)',
        version_url,
        original,
    )
    # The Codespaces-only preview-v2.html clears origin-wide caches and service
    # worker registrations; never publish that behaviour to GitHub Pages.
    # Keep the URL available by serving the same safe production HTML instead.
    for name in ("index.html", "preview-v2.html"):
        (DEST / name).write_text(output, encoding="utf-8")

    for name in sorted(parser.paths | EXTRA_STATIC_ASSETS):
        asset = ROOT / name
        if asset.is_symlink() or not asset.is_file():
            raise FileNotFoundError("Required preview asset is missing or unsafe: " + name)
        shutil.copyfile(asset, DEST / name)

    (DEST / ".nojekyll").touch()
    print(f"Prepared {len(parser.paths)} referenced assets and {len(EXTRA_STATIC_ASSETS)} sample-data file(s).")
    print("Deployment revision:", version)
    print("No backup, source build script, workflow, private credential or documentation was copied.")


if __name__ == "__main__":
    make_site()

from __future__ import annotations

import gzip
import urllib.request

CATALOG_PATHS = {
    "CMC1-2": ["I/126"],
    "CMC3": ["I/133"],
    "CMC4": ["I/147"],
    "CMC5": ["I/170A", "I/170"],
    "CMC6": ["I/189"],
    "CMC7": ["I/205"],
    "CMC8": ["I/213"],
}
HOSTS = [
    "https://vizier.cfa.harvard.edu/ftp/cats",
    "https://cdsarc.cds.unistra.fr/ftp/cats",
]
FILES = ["table2.gz", "table2.dat.gz", "table2", "table2.dat"]
UA = "planetary-models-educational-site/1.0"


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as response:
        return response.read()


def fetch_one(paths: list[str]):
    errors = []
    for path in paths:
        for host in HOSTS:
            for filename in FILES:
                url = f"{host}/{path}/{filename}"
                try:
                    payload = get(url)
                    if filename.endswith(".gz"):
                        payload = gzip.decompress(payload)
                    text = payload.decode("ascii", errors="replace")
                    if len(text.splitlines()) < 2:
                        raise RuntimeError("too short")
                    return path, filename, url, text
                except Exception as exc:
                    errors.append(f"{url}: {exc}")
    return None, None, None, "\n".join(errors)


def fetch_readme(path: str) -> str:
    for host in HOSTS:
        for name in ("ReadMe", "readme"):
            url = f"{host}/{path}/{name}"
            try:
                return get(url).decode("ascii", errors="replace")
            except Exception:
                pass
    return ""


def main():
    for label, paths in CATALOG_PATHS.items():
        print("\n" + "=" * 100)
        print(label, paths)
        path, filename, url, text = fetch_one(paths)
        if not path:
            print("NO TABLE2 FOUND")
            print(text[-1500:])
            continue
        lines = text.splitlines()
        print(f"FOUND {url}; lines={len(lines)}; maxlen={max(map(len, lines))}")
        readme = fetch_readme(path)
        if readme:
            idx = readme.lower().find("table2")
            if idx >= 0:
                print("README TABLE2 EXCERPT:")
                print(readme[max(0, idx - 300):idx + 3000])

        keys = ["mars", "99040", "9000040"]
        hits = []
        for i, line in enumerate(lines):
            low = line.lower()
            if any(key in low for key in keys):
                hits.append((i + 1, line))
        print(f"MARS/CODE HITS={len(hits)}")
        for item in hits[:30]:
            print("HIT", item[0], repr(item[1]))

        print("FIRST LINES:")
        for i, line in enumerate(lines[:8], 1):
            print(i, repr(line))


if __name__ == "__main__":
    main()

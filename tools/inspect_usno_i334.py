from __future__ import annotations

import re
import urllib.request

BASES = [
    "https://vizier.cfa.harvard.edu/ftp/cats/I/334",
    "https://cdsarc.cds.unistra.fr/ftp/cats/I/334",
]
UA = "planetary-models-educational-site/1.0"


def get(path: str) -> bytes:
    errors = []
    for base in BASES:
        url = f"{base}/{path}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as response:
                return response.read()
        except Exception as exc:
            errors.append(f"{url}: {exc}")
    raise RuntimeError("; ".join(errors))


def main():
    readme = get("ReadMe").decode("ascii", errors="replace")
    print("README length", len(readme))
    for pattern in ("File Summary", "planet", "W2J00"):
        print("\n### excerpts for", pattern)
        low = readme.casefold()
        start = 0
        count = 0
        while True:
            idx = low.find(pattern.casefold(), start)
            if idx < 0 or count >= 8:
                break
            print(readme[max(0, idx - 500):idx + 2500])
            start = idx + len(pattern)
            count += 1

    # Extract probable data filenames from ReadMe file summary.
    names = []
    for line in readme.splitlines():
        m = re.match(r"^\s*([A-Za-z0-9_.-]+)\s+\d+\s+\d+\s+", line)
        if m:
            names.append(m.group(1))
    print("\nFILENAMES", names)

    for name in names:
        lname = name.casefold()
        if any(tok in lname for tok in ("plan", "w2", "solar", "ssobj")):
            try:
                payload = get(name)
                text = payload.decode("ascii", errors="replace")
                print(f"\n=== {name}: {len(text.splitlines())} lines ===")
                hits = [line for line in text.splitlines() if "mars" in line.casefold()]
                print("MARS text hits", len(hits))
                for line in hits[:10]:
                    print(repr(line))
                for line in text.splitlines()[:5]:
                    print("SAMPLE", repr(line))
            except Exception as exc:
                print("failed", name, exc)


if __name__ == "__main__":
    main()

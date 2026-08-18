from __future__ import annotations

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


def excerpt(text: str, needle: str, before: int = 200, after: int = 5000) -> None:
    idx = text.casefold().find(needle.casefold())
    print(f"\n### {needle} index={idx}")
    if idx >= 0:
        print(text[max(0, idx-before):idx+after])


def main():
    readme = get("ReadMe").decode("ascii", errors="replace")
    excerpt(readme, "Byte-by-byte Description of file: w2j00sol.dat", 100, 7000)
    excerpt(readme, "Byte-by-byte Description of file: w1j00sol.dat", 100, 5000)

    text = get("w2j00sol.dat").decode("ascii", errors="replace")
    mars = [line for line in text.splitlines() if line.startswith("Mars")]
    print(f"\nW2J00 total={len(text.splitlines())}, Mars={len(mars)}")
    lengths = sorted(set(map(len, mars)))
    print("Mars record lengths", lengths)
    for line in mars[:20]:
        print(repr(line))


if __name__ == "__main__":
    main()

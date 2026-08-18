from __future__ import annotations

import csv
import io
import urllib.parse
import urllib.request

CATALOGS = [
    "I/126",   # CMC1-2
    "I/133",   # CMC3
    "I/147",   # CMC4
    "I/170A",  # CMC5
    "I/189",   # CMC6
    "I/205",   # CMC7
    "I/213",   # CMC8
]
ASU_BASES = [
    "https://vizier.cfa.harvard.edu/viz-bin/asu-tsv",
    "https://vizier.cds.unistra.fr/viz-bin/asu-tsv",
    "https://vizier.u-strasbg.fr/viz-bin/asu-tsv",
]
UA = "planetary-models-educational-site/1.0"


def fetch_table(source: str) -> str:
    params = {"-source": source, "-out.all": "1", "-out.max": "50000"}
    errors = []
    for base in ASU_BASES:
        try:
            url = base + "?" + urllib.parse.urlencode(params)
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as response:
                text = response.read().decode("utf-8", errors="replace")
            if len(text) < 100:
                raise RuntimeError(f"short response {len(text)} bytes")
            return text
        except Exception as exc:
            errors.append(f"{base}: {exc}")
    raise RuntimeError("; ".join(errors))


def parse_tsv(text: str):
    lines = [line for line in text.splitlines() if line and not line.startswith("#")]
    if not lines:
        return [], []
    reader = csv.DictReader(io.StringIO("\n".join(lines)), delimiter="\t")
    rows = []
    for row in reader:
        clean = {str(k): (v or "").strip() for k, v in row.items() if k is not None}
        vals = [v for v in clean.values() if v]
        if not vals:
            continue
        if all(set(v) <= {"-", " ", "."} for v in vals):
            continue
        rows.append(clean)
    return reader.fieldnames or [], rows


def row_text(row: dict[str, str]) -> str:
    return " | ".join(f"{k}={v}" for k, v in row.items() if v)


def main():
    for cat in CATALOGS:
        print("\n" + "=" * 90)
        print(cat)
        candidates = [f"{cat}/table2", f"{cat}/planet", f"{cat}/planets"]
        text = None
        source = None
        for candidate in candidates:
            try:
                attempt = fetch_table(candidate)
                fields, rows = parse_tsv(attempt)
                if rows:
                    text = attempt
                    source = candidate
                    print(f"source={candidate}, bytes={len(attempt)}, rows={len(rows)}")
                    print("fields:", fields)
                    break
            except Exception as exc:
                print(f"{candidate} failed: {exc}")
        if text is None:
            print("NO TABLE FOUND")
            continue

        fields, rows = parse_tsv(text)
        mars = []
        mars_like = []
        for row in rows:
            lower_values = " ".join(row.values()).casefold()
            if re_is_exact_mars(row):
                mars.append(row)
            if "mars" in lower_values or "99040" in lower_values or "9000040" in lower_values:
                mars_like.append(row)

        print(f"exact/name Mars rows: {len(mars)}")
        print(f"Mars/code-like rows: {len(mars_like)}")
        for row in mars_like[:12]:
            print("MARS-LIKE:", row_text(row))

        # Print first rows and a compact sample of object-name-ish columns so we can inspect coding.
        for row in rows[:5]:
            print("SAMPLE:", row_text(row))
        name_fields = [f for f in fields if any(tok in f.casefold() for tok in ("name", "obj", "planet", "mp", "seq", "id"))]
        if name_fields:
            print("name-like fields:", name_fields)
            for field in name_fields:
                unique = []
                seen = set()
                for row in rows:
                    val = row.get(field, "")
                    if val and val not in seen:
                        seen.add(val)
                        unique.append(val)
                    if len(unique) >= 80:
                        break
                print(field, unique)


def re_is_exact_mars(row: dict[str, str]) -> bool:
    for key, value in row.items():
        k = key.casefold()
        v = value.strip().casefold()
        if v == "mars" and any(tok in k for tok in ("name", "obj", "planet", "target", "body")):
            return True
    return False


if __name__ == "__main__":
    main()

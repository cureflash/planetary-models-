from __future__ import annotations

import math
import re
import urllib.request
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

SOURCES = {
    "Bordeaux 1985-96": "https://ssd.jpl.nasa.gov/dat/planets/trnstsbordx.txt",
    "RGO La Palma 1984-98": "https://ssd.jpl.nasa.gov/dat/planets/trnstslplma.txt",
    "USNO 6in 1986-93": "https://ssd.jpl.nasa.gov/dat/planets/trnstswash6c.txt",
}
UA = "planetary-models-educational-site/1.0"

# JPL transit files have a leading P plus a three-digit code. USNO uses P004
# for Mars, while other observatories encode observation subtype in these digits.
# The diagnostic below prints all prefixes before the final extractor is fixed.
GENERIC_PAT = re.compile(r"^(P\d{3})(\d{7})(\d{6})\s+.*?\s+([0-9]{8,10})\s+([+-]?[0-9]{7,9})")


@dataclass(frozen=True)
class Row:
    jd: float
    ra_deg: float
    dec_deg: float
    source: str
    prefix: str


def get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as response:
        return response.read().decode("ascii", errors="replace")


def parse_ra(token: str) -> float:
    token = token.strip().zfill(10)
    h = int(token[0:2]); m = int(token[2:4]); sec = int(token[4:]) / 10000.0
    if not (0 <= h <= 23 and 0 <= m <= 59 and 0 <= sec < 60): raise ValueError(token)
    return 15.0 * (h + m / 60.0 + sec / 3600.0)


def parse_dec(token: str) -> float:
    raw = token.strip(); sign = -1.0 if raw.startswith("-") else 1.0
    digits = raw.lstrip("+-").zfill(9)
    d = int(digits[0:2]); m = int(digits[2:4]); sec = int(digits[4:]) / 1000.0
    if not (0 <= d <= 90 and 0 <= m <= 59 and 0 <= sec < 60): raise ValueError(token)
    return sign * (d + m / 60.0 + sec / 3600.0)


def jd_date(jd: float) -> str:
    dt = datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=(jd - 2440587.5) * 86400.0)
    return dt.strftime("%Y-%m-%d")


def parse_generic(text: str, source: str) -> list[Row]:
    rows = []
    for line in text.splitlines():
        m = GENERIC_PAT.match(line)
        if not m: continue
        try:
            jd = float(m.group(2) + "." + m.group(3))
            ra = parse_ra(m.group(4)); dec = parse_dec(m.group(5))
        except Exception:
            continue
        rows.append(Row(jd, ra, dec, source, m.group(1)))
    return rows


def summary(label: str, rows: list[Row]) -> None:
    rows = sorted(rows, key=lambda r: r.jd)
    if not rows:
        print(label, "NO ROWS"); return
    gaps = [b.jd - a.jd for a, b in zip(rows, rows[1:])]
    max_gap = max(gaps) if gaps else 0.0; i = gaps.index(max_gap) if gaps else 0
    print(f"{label}: n={len(rows)}, {jd_date(rows[0].jd)} .. {jd_date(rows[-1].jd)}, baseline={(rows[-1].jd-rows[0].jd):.1f} d")
    if gaps:
        print(f"  max gap={max_gap:.1f} d: {jd_date(rows[i].jd)} -> {jd_date(rows[i+1].jd)}")


def main() -> None:
    for label, url in SOURCES.items():
        try: text = get(url)
        except Exception as exc:
            print(f"FAILED {label}: {exc}"); continue
        rows = parse_generic(text, label)
        prefixes = Counter(r.prefix for r in rows)
        print("\n" + "="*90)
        print(label, "parsed generic", len(rows), "prefixes", prefixes)
        by_prefix: dict[str, list[Row]] = {}
        for r in rows: by_prefix.setdefault(r.prefix, []).append(r)
        for prefix, items in sorted(by_prefix.items()):
            summary(prefix, items)
            sample = next((line for line in text.splitlines() if line.startswith(prefix)), "")
            print(" sample", repr(sample))

        # Print all P4xx prefixes, because major-planet code 4 denotes Mars in JPL conventions.
        print("P4xx candidates:")
        for prefix, items in sorted(by_prefix.items()):
            if prefix.startswith("P4") or prefix == "P004":
                print(prefix, len(items), jd_date(min(x.jd for x in items)), jd_date(max(x.jd for x in items)))


if __name__ == "__main__":
    main()

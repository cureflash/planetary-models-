from __future__ import annotations

import math
import re
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

SOURCES = {
    "Bordeaux 1985-96": "https://ssd.jpl.nasa.gov/dat/planets/trnstsbordx.txt",
    "RGO La Palma 1984-98": "https://ssd.jpl.nasa.gov/dat/planets/trnstslplma.txt",
    "USNO 6in 1986-93": "https://ssd.jpl.nasa.gov/dat/planets/trnstswash6c.txt",
}
UA = "planetary-models-educational-site/1.0"

# JPL transit records used on the planetary observational-data page.
# Example: P0042446437036090 ... 1447110980 -150425930 ...
# P004 = Mars. The epoch is JD as 7 integer + 6 fractional digits.
PAT = re.compile(r"^P004(\d{7})(\d{6})\s+(\d+)\s+([0-9]{10})\s+([+-][0-9]{9})")


@dataclass(frozen=True)
class Row:
    jd: float
    ra_deg: float
    dec_deg: float
    source: str


def get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as response:
        return response.read().decode("ascii", errors="replace")


def parse_ra(token: str) -> float:
    h = int(token[0:2])
    m = int(token[2:4])
    sec = int(token[4:]) / 10000.0
    return 15.0 * (h + m / 60.0 + sec / 3600.0)


def parse_dec(token: str) -> float:
    sign = -1.0 if token[0] == "-" else 1.0
    d = int(token[1:3])
    m = int(token[3:5])
    sec = int(token[5:]) / 1000.0
    return sign * (d + m / 60.0 + sec / 3600.0)


def jd_date(jd: float) -> str:
    dt = datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=(jd - 2440587.5) * 86400.0)
    return dt.strftime("%Y-%m-%d")


def parse(text: str, source: str) -> tuple[list[Row], int]:
    p004 = 0
    rows: list[Row] = []
    for line in text.splitlines():
        if line.startswith("P004"):
            p004 += 1
        m = PAT.match(line)
        if not m:
            continue
        jd = float(m.group(1) + "." + m.group(2))
        try:
            ra = parse_ra(m.group(4))
            dec = parse_dec(m.group(5))
        except Exception:
            continue
        if not (0 <= ra < 360 and -90 <= dec <= 90):
            continue
        rows.append(Row(jd, ra, dec, source))
    return rows, p004


def summary(label: str, rows: list[Row]) -> None:
    rows = sorted(rows, key=lambda r: r.jd)
    if not rows:
        print(label, "NO ROWS")
        return
    gaps = [b.jd - a.jd for a, b in zip(rows, rows[1:])]
    max_gap = max(gaps) if gaps else 0.0
    i = gaps.index(max_gap) if gaps else 0
    print(f"{label}: n={len(rows)}, {jd_date(rows[0].jd)} .. {jd_date(rows[-1].jd)}, baseline={(rows[-1].jd-rows[0].jd):.1f} d")
    if gaps:
        print(f"  max gap={max_gap:.1f} d: {jd_date(rows[i].jd)} -> {jd_date(rows[i+1].jd)}")
        for threshold in (7, 14, 30, 60, 90, 180, 365):
            print(f"  gaps > {threshold:3d} d: {sum(g > threshold for g in gaps)}")


def main() -> None:
    all_rows: list[Row] = []
    for label, url in SOURCES.items():
        try:
            text = get(url)
        except Exception as exc:
            print(f"FAILED {label}: {url}: {exc}")
            continue
        rows, p004 = parse(text, label)
        print(f"\n{label}: file lines={len(text.splitlines())}, P004 raw={p004}, parsed={len(rows)}")
        if p004 and not rows:
            for line in [x for x in text.splitlines() if x.startswith('P004')][:5]:
                print("UNPARSED SAMPLE", repr(line))
        summary(label, rows)
        all_rows.extend(rows)

    # Exact duplicate JD/position records from overlapping source reductions do not add information.
    unique = {(round(r.jd, 6), round(r.ra_deg, 8), round(r.dec_deg, 8), r.source): r for r in all_rows}
    merged = sorted(unique.values(), key=lambda r: r.jd)
    print("\nMERGED")
    summary("JPL meridian Mars merged", merged)

    # Time-bin count helps judge how continuous the real observations are without interpolation.
    if merged:
        start = merged[0].jd
        end = merged[-1].jd
        for width in (30, 60, 90):
            bins = math.ceil((end - start) / width)
            occupied = {int((r.jd - start) // width) for r in merged}
            print(f"  {width}-day bins occupied: {len(occupied)}/{bins} ({len(occupied)/bins:.1%})")


if __name__ == "__main__":
    main()

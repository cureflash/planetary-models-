from __future__ import annotations

import csv
import math
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "mars_observations_carlsberg_1984_1998.csv"

# VizieR catalogue I/256, table planet:
# Carlsberg Meridian Catalogues 1-11, observations from La Palma, 1984-1998.
ENDPOINTS = [
    "https://vizier.cds.unistra.fr/viz-bin/asu-tsv",
    "https://vizier.cfa.harvard.edu/viz-bin/asu-tsv",
    "https://vizier.idia.ac.za/viz-bin/asu-tsv",
]

PARAMS = {
    "-source": "I/256/planet",
    "-out": "Name TT flag RA DE",
    "-out.max": "unlimited",
}


def fetch_table() -> str:
    query = urllib.parse.urlencode(PARAMS)
    last_error: Exception | None = None
    for endpoint in ENDPOINTS:
        url = f"{endpoint}?{query}"
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "planetary-models-educational-site/1.0 (GitHub Actions; VizieR I/256)"
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                text = response.read().decode("utf-8", errors="replace")
            if "I/256/planet" not in text and "Name" not in text:
                raise RuntimeError("VizieR response does not look like the requested table")
            print(f"downloaded I/256/planet from {endpoint}")
            return text
        except Exception as exc:  # try the next mirror
            last_error = exc
            print(f"failed {endpoint}: {exc}")
    raise RuntimeError(f"all VizieR mirrors failed: {last_error}")


def parse_asu_tsv(text: str) -> list[dict[str, str]]:
    lines = text.splitlines()
    header_index: int | None = None
    header: list[str] | None = None

    for i, line in enumerate(lines):
        if not line or line.startswith("#"):
            continue
        cells = [c.strip() for c in line.split("\t")]
        if {"Name", "TT", "RA", "DE"}.issubset(set(cells)):
            header_index = i
            header = cells
            break

    if header_index is None or header is None:
        raise RuntimeError("could not locate VizieR TSV header")

    rows: list[dict[str, str]] = []
    for line in lines[header_index + 1 :]:
        if not line or line.startswith("#"):
            continue
        cells = [c.strip() for c in line.split("\t")]
        if len(cells) != len(header):
            continue
        # VizieR inserts a units row and a dashed separator after the header.
        if cells[0].startswith("-") or cells[0] in {"---", ""}:
            continue
        row = dict(zip(header, cells))
        try:
            float(row["TT"])
        except (ValueError, TypeError):
            continue
        rows.append(row)
    return rows


def parse_hms(value: str) -> float:
    parts = value.replace(":", " ").split()
    if len(parts) >= 3:
        h, m, s = map(float, parts[:3])
        return (h + m / 60.0 + s / 3600.0) * 15.0
    x = float(value)
    # VizieR normally returns sexagesimal RA here. If a mirror returns decimal,
    # treat values <=24 as hours and larger values as degrees.
    return x * 15.0 if abs(x) <= 24.0 else x


def parse_dms(value: str) -> float:
    parts = value.replace(":", " ").split()
    if len(parts) >= 3:
        sign = -1.0 if parts[0].startswith("-") else 1.0
        d = abs(float(parts[0]))
        m = float(parts[1])
        s = float(parts[2])
        return sign * (d + m / 60.0 + s / 3600.0)
    return float(value)


def mean_obliquity_deg(jd: float) -> float:
    # IAU-style polynomial adequate for the 1984-1998 interval.
    t = (jd - 2451545.0) / 36525.0
    seconds = 84381.448 - 46.8150 * t - 0.00059 * t * t + 0.001813 * t * t * t
    return seconds / 3600.0


def equatorial_to_ecliptic_lon_deg(ra_deg: float, dec_deg: float, jd: float) -> float:
    ra = math.radians(ra_deg)
    dec = math.radians(dec_deg)
    eps = math.radians(mean_obliquity_deg(jd))

    x = math.cos(dec) * math.cos(ra)
    y_eq = math.cos(dec) * math.sin(ra)
    z_eq = math.sin(dec)

    # Inverse rotation from equatorial-of-date to ecliptic-of-date.
    y = y_eq * math.cos(eps) + z_eq * math.sin(eps)
    lon = math.degrees(math.atan2(y, x)) % 360.0
    return lon


def jd_to_iso(jd: float) -> tuple[str, str]:
    # TT is used as a timestamp here. The UTC-TT offset is only about a minute
    # in this era and is irrelevant to the displayed date / planetary track.
    dt = datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(
        seconds=(jd - 2440587.5) * 86400.0
    )
    return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%dT%H:%M:%S")


def main() -> None:
    raw = fetch_table()
    rows = parse_asu_tsv(raw)
    mars_rows = [r for r in rows if r.get("Name", "").strip().lower() == "mars"]
    if not mars_rows:
        names = sorted({r.get("Name", "") for r in rows})[:50]
        raise RuntimeError(f"no Mars rows found; sample names={names}")

    output: list[dict[str, str | float]] = []
    for row in mars_rows:
        tt = float(row["TT"])
        ra_deg = parse_hms(row["RA"])
        dec_deg = parse_dms(row["DE"])
        lon_deg = equatorial_to_ecliptic_lon_deg(ra_deg, dec_deg, tt)
        date, timestamp = jd_to_iso(tt)
        output.append(
            {
                "date": date,
                "timestamp_tt": timestamp,
                "tt_jd": f"{tt:.8f}",
                "ra_deg": f"{ra_deg:.10f}",
                "dec_deg": f"{dec_deg:.10f}",
                "ecliptic_lon_deg": f"{lon_deg:.10f}",
                "quality_flag": row.get("flag", "").strip(),
                "source_catalog": "VizieR I/256/planet (CMC1-11)",
            }
        )

    output.sort(key=lambda r: float(r["tt_jd"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(output[0].keys()))
        writer.writeheader()
        writer.writerows(output)

    good = sum(1 for r in output if not r["quality_flag"])
    print(f"wrote {len(output)} Mars observations ({good} unflagged) to {OUT}")
    print(f"range: {output[0]['timestamp_tt']} .. {output[-1]['timestamp_tt']}")


if __name__ == "__main__":
    main()

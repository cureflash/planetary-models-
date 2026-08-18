from __future__ import annotations

import csv
import math
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "mars_observations_carlsberg.csv"
MIN_BASELINE_DAYS = 730.0

# I/256 is the compound Carlsberg Meridian Catalogues 1-11 table.  Its
# solar-system table contains the individual observations made on La Palma
# between May 1984 and May 1998.  Query Mars server-side instead of downloading
# the whole mixed planet/minor-planet table and guessing an historical object
# code used by older volumes.
VIZIER_ENDPOINTS = [
    "https://vizier.cds.unistra.fr/viz-bin/asu-tsv",
    "https://vizier.cfa.harvard.edu/viz-bin/asu-tsv",
    "https://vizier.idia.ac.za/viz-bin/asu-tsv",
]


def download_query(name_constraint: str) -> str:
    params = {
        "-source": "I/256/planet",
        "-out": "CMC MP Name TT flag RA DE",
        "-out.max": "unlimited",
        "Name": name_constraint,
    }
    query = urllib.parse.urlencode(params)
    last_error: Exception | None = None
    for endpoint in VIZIER_ENDPOINTS:
        url = f"{endpoint}?{query}"
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "planetary-models-educational-site/1.0"},
            )
            with urllib.request.urlopen(request, timeout=90) as response:
                text = response.read().decode("utf-8", errors="replace")
            if "I/256/planet" not in text and "Name" not in text:
                raise RuntimeError("response does not look like I/256/planet")
            print(f"downloaded I/256/planet Name={name_constraint!r} from {endpoint}")
            return text
        except Exception as exc:
            print(f"failed {endpoint}: {exc}")
            last_error = exc
    raise RuntimeError(f"all VizieR mirrors failed: {last_error}")


def parse_asu_tsv(text: str) -> list[dict[str, str]]:
    lines = text.splitlines()
    header_index: int | None = None
    header: list[str] | None = None
    for i, line in enumerate(lines):
        if not line or line.startswith("#"):
            continue
        cells = [cell.strip() for cell in line.split("\t")]
        if {"Name", "TT", "RA", "DE"}.issubset(set(cells)):
            header_index = i
            header = cells
            print("VizieR columns:", header)
            break
    if header_index is None or header is None:
        sample = [line for line in lines if line and not line.startswith("#")][:20]
        raise RuntimeError("could not locate VizieR header; sample=" + repr(sample))

    rows: list[dict[str, str]] = []
    for line in lines[header_index + 1 :]:
        if not line or line.startswith("#"):
            continue
        cells = [cell.strip() for cell in line.split("\t")]
        if len(cells) != len(header):
            continue
        if all((not cell) or set(cell) <= {"-"} for cell in cells):
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
        return 15.0 * (h + m / 60.0 + s / 3600.0)
    x = float(value)
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
    t = (jd - 2451545.0) / 36525.0
    seconds = 84381.448 - 46.8150 * t - 0.00059 * t * t + 0.001813 * t * t * t
    return seconds / 3600.0


def equatorial_to_ecliptic_lon_deg(ra_deg: float, dec_deg: float, jd: float) -> float:
    # Coordinate rotation only.  It introduces no heliocentric orbit model.
    ra = math.radians(ra_deg)
    dec = math.radians(dec_deg)
    eps = math.radians(mean_obliquity_deg(jd))
    x = math.cos(dec) * math.cos(ra)
    y_eq = math.cos(dec) * math.sin(ra)
    z_eq = math.sin(dec)
    y_ecl = y_eq * math.cos(eps) + z_eq * math.sin(eps)
    return math.degrees(math.atan2(y_ecl, x)) % 360.0


def jd_to_iso(jd: float) -> tuple[str, str]:
    dt = datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(
        seconds=(jd - 2440587.5) * 86400.0
    )
    return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%dT%H:%M:%S")


def is_mars_name(value: str) -> bool:
    normalized = " ".join(value.strip().casefold().split())
    return normalized == "mars" or normalized.startswith("mars ")


def fetch_mars_rows() -> list[dict[str, str]]:
    # Exact name is expected.  A wildcard retry makes this robust to a catalogue
    # suffix such as "Mars ..." without admitting similarly named minor planets.
    for constraint in ("Mars", "Mars*"):
        rows = parse_asu_tsv(download_query(constraint))
        mars = [row for row in rows if is_mars_name(row.get("Name", ""))]
        if mars:
            print("Mars names:", sorted({row.get("Name", "") for row in mars}))
            return mars
        print(f"Name={constraint!r}: {len(rows)} returned rows, none identified as Mars")
    raise RuntimeError("VizieR I/256/planet returned no Mars observations")


def main() -> None:
    mars_rows = fetch_mars_rows()
    output: list[dict[str, str]] = []

    for row in mars_rows:
        jd = float(row["TT"])
        ra_deg = parse_hms(row["RA"])
        dec_deg = parse_dms(row["DE"])
        lon_deg = equatorial_to_ecliptic_lon_deg(ra_deg, dec_deg, jd)
        date, timestamp = jd_to_iso(jd)
        output.append(
            {
                "date": date,
                "timestamp_tt": timestamp,
                "tt_jd": f"{jd:.8f}",
                "ra_deg": f"{ra_deg:.10f}",
                "dec_deg": f"{dec_deg:.10f}",
                "ecliptic_lon_deg": f"{lon_deg:.10f}",
                "quality_flag": row.get("flag", "").strip(),
                "cmc_number": row.get("CMC", "").strip(),
                "source_catalog": "VizieR I/256/planet (Carlsberg Meridian Catalogues 1-11)",
            }
        )

    # Remove exact duplicate epochs if the compound catalogue contains them.
    by_jd = {row["tt_jd"]: row for row in output}
    output = sorted(by_jd.values(), key=lambda row: float(row["tt_jd"]))
    if len(output) < 20:
        raise RuntimeError(f"too few Mars observations: {len(output)}")

    baseline = float(output[-1]["tt_jd"]) - float(output[0]["tt_jd"])
    if baseline < MIN_BASELINE_DAYS:
        raise RuntimeError(
            f"Carlsberg Mars baseline is only {baseline:.1f} days; at least {MIN_BASELINE_DAYS:.0f} required"
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(output[0].keys()))
        writer.writeheader()
        writer.writerows(output)

    good = sum(1 for row in output if row["quality_flag"] != "*")
    print(f"wrote {len(output)} Mars observations ({good} unflagged) to {OUT}")
    print(f"range: {output[0]['timestamp_tt']} .. {output[-1]['timestamp_tt']} ({baseline:.1f} days)")


if __name__ == "__main__":
    main()

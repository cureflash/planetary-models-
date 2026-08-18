from __future__ import annotations

import csv
import gzip
import math
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "mars_observations_carlsberg_cmc4_1984_1988.csv"
MARS_CMC_CODE = 99040

# CMC4 supersedes CMC1-3 and contains observations made May 1984-Feb 1988.
# CDS ReadMe I/147 identifies table2.dat as the planet-observation table;
# code 99040 is Mars. Positions are apparent geocentric RA/Dec, equinox of date.
URLS = [
    "https://vizier.cfa.harvard.edu/ftp/cats/I/147/table2.dat.gz",
    "https://cdsarc.cds.unistra.fr/ftp/cats/I/147/table2.dat.gz",
]


def download_table() -> str:
    last_error: Exception | None = None
    for url in URLS:
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "planetary-models-educational-site/1.0"},
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = response.read()
            text = gzip.decompress(payload).decode("ascii", errors="replace")
            if len(text.splitlines()) < 1000:
                raise RuntimeError("downloaded file is unexpectedly short")
            print(f"downloaded CMC4 table2.dat.gz from {url}")
            return text
        except Exception as exc:
            print(f"failed {url}: {exc}")
            last_error = exc
    raise RuntimeError(f"all CMC4 download URLs failed: {last_error}")


def parse_int(field: str) -> int:
    return int(field.strip())


def parse_float(field: str) -> float:
    return float(field.strip())


def parse_cmc4_line(line: str) -> dict[str, float | int | str] | None:
    # Fixed-width layout from CDS ReadMe I/147 table2.dat.
    if len(line) < 52:
        return None
    try:
        planet = parse_int(line[0:6])
        jd = 2440000.0 + parse_float(line[6:21])
        flag = line[21:22].strip()
        rah = parse_int(line[25:27])
        ram = parse_int(line[28:30])
        ras = parse_float(line[31:37])
        de_sign = -1.0 if line[40:41] == "-" else 1.0
        ded = parse_int(line[41:43])
        dem = parse_int(line[44:46])
        des = parse_float(line[47:52])
    except ValueError:
        return None

    ra_deg = 15.0 * (rah + ram / 60.0 + ras / 3600.0)
    dec_deg = de_sign * (ded + dem / 60.0 + des / 3600.0)
    return {
        "planet": planet,
        "jd": jd,
        "flag": flag,
        "ra_deg": ra_deg,
        "dec_deg": dec_deg,
    }


def mean_obliquity_deg(jd: float) -> float:
    t = (jd - 2451545.0) / 36525.0
    seconds = 84381.448 - 46.8150 * t - 0.00059 * t * t + 0.001813 * t * t * t
    return seconds / 3600.0


def equatorial_to_ecliptic_lon_deg(ra_deg: float, dec_deg: float, jd: float) -> float:
    # Coordinate conversion only; no heliocentric orbit model is used.
    ra = math.radians(ra_deg)
    dec = math.radians(dec_deg)
    eps = math.radians(mean_obliquity_deg(jd))
    x = math.cos(dec) * math.cos(ra)
    y_eq = math.cos(dec) * math.sin(ra)
    z_eq = math.sin(dec)
    y_ecl = y_eq * math.cos(eps) + z_eq * math.sin(eps)
    return math.degrees(math.atan2(y_ecl, x)) % 360.0


def jd_to_iso(jd: float) -> tuple[str, str]:
    # CMC gives TDT. Keeping the TDT timestamp is sufficient for this comparison.
    dt = datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(
        seconds=(jd - 2440587.5) * 86400.0
    )
    return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%dT%H:%M:%S")


def main() -> None:
    raw = download_table()
    parsed = [p for line in raw.splitlines() if (p := parse_cmc4_line(line)) is not None]
    mars = [p for p in parsed if p["planet"] == MARS_CMC_CODE]
    if not mars:
        codes = sorted({int(p["planet"]) for p in parsed})
        raise RuntimeError(f"no Mars rows found; available codes include {codes[-20:]}")

    output: list[dict[str, str]] = []
    for row in mars:
        jd = float(row["jd"])
        ra_deg = float(row["ra_deg"])
        dec_deg = float(row["dec_deg"])
        lon_deg = equatorial_to_ecliptic_lon_deg(ra_deg, dec_deg, jd)
        date, timestamp = jd_to_iso(jd)
        output.append(
            {
                "date": date,
                "timestamp_tdt": timestamp,
                "tdt_jd": f"{jd:.6f}",
                "ra_deg": f"{ra_deg:.10f}",
                "dec_deg": f"{dec_deg:.10f}",
                "ecliptic_lon_deg": f"{lon_deg:.10f}",
                "quality_flag": str(row["flag"]),
                "cmc_object_code": str(MARS_CMC_CODE),
                "source_catalog": "Carlsberg Meridian Catalog Vol.4 (CDS I/147 table2.dat)",
            }
        )

    output.sort(key=lambda r: float(r["tdt_jd"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(output[0].keys()))
        writer.writeheader()
        writer.writerows(output)

    good = sum(1 for r in output if r["quality_flag"] != "*")
    print(f"wrote {len(output)} CMC4 Mars observations ({good} unflagged) to {OUT}")
    print(f"range: {output[0]['timestamp_tdt']} .. {output[-1]['timestamp_tdt']}")


if __name__ == "__main__":
    main()

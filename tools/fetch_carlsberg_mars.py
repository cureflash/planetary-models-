from __future__ import annotations

import csv
import gzip
import math
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "mars_observations_carlsberg.csv"
MARS_CMC_CODE = 99040

# Individual Carlsberg Meridian Catalog volumes retain their planet-observation
# tables even where the later I/256 compound VizieR table does not expose Mars.
# CMC4 supersedes CMC1-3, so start there and then append later independent volumes.
CATALOGS = [
    {
        "volume": "CMC4",
        "catalog": "I/147",
        "urls": [
            "https://vizier.cfa.harvard.edu/ftp/cats/I/147/table2.dat.gz",
            "https://cdsarc.cds.unistra.fr/ftp/cats/I/147/table2.dat.gz",
        ],
    },
    {
        "volume": "CMC5",
        "catalog": "I/170A",
        "urls": [
            "https://vizier.cfa.harvard.edu/ftp/cats/i/170A/table2.gz",
            "https://vizier.cfa.harvard.edu/ftp/cats/I/170A/table2.gz",
        ],
    },
    {
        "volume": "CMC6",
        "catalog": "I/189",
        "urls": [
            "https://vizier.cfa.harvard.edu/ftp/cats/I/189/table2.gz",
        ],
    },
    {
        "volume": "CMC7",
        "catalog": "I/205",
        "urls": [
            "https://vizier.cfa.harvard.edu/ftp/cats/I/205/table2.gz",
        ],
    },
    {
        "volume": "CMC8",
        "catalog": "I/213",
        "urls": [
            "https://vizier.cfa.harvard.edu/ftp/cats/I/213/table2.gz",
        ],
    },
]


def download_gzip(catalog: dict[str, object]) -> str | None:
    last_error: Exception | None = None
    for url in catalog["urls"]:
        try:
            request = urllib.request.Request(
                str(url),
                headers={"User-Agent": "planetary-models-educational-site/1.0"},
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = response.read()
            text = gzip.decompress(payload).decode("ascii", errors="replace")
            if len(text.splitlines()) < 10:
                raise RuntimeError("downloaded file is unexpectedly short")
            print(f"downloaded {catalog['volume']} from {url} ({len(text.splitlines())} rows)")
            return text
        except Exception as exc:
            print(f"failed {catalog['volume']} {url}: {exc}")
            last_error = exc
    print(f"skipping {catalog['volume']}: all URLs failed ({last_error})")
    return None


def parse_int(field: str) -> int:
    return int(field.strip())


def parse_float(field: str) -> float:
    return float(field.strip())


def parse_planet_line(line: str) -> dict[str, float | int | str] | None:
    # CMC4-8 planet tables use the same classic fixed-width layout documented
    # for CMC4: object code, TDT-2440000, quality flag, apparent geocentric RA/Dec.
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

    if not (0 <= rah <= 23 and 0 <= ram <= 59 and 0 <= ded <= 90 and 0 <= dem <= 59):
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
    # This is only a coordinate rotation; it does not assume a heliocentric orbit.
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


def main() -> None:
    output: list[dict[str, str]] = []

    for catalog in CATALOGS:
        raw = download_gzip(catalog)
        if raw is None:
            continue
        parsed = [p for line in raw.splitlines() if (p := parse_planet_line(line)) is not None]
        mars = [p for p in parsed if p["planet"] == MARS_CMC_CODE]
        codes = sorted({int(p["planet"]) for p in parsed})
        if not mars:
            print(f"{catalog['volume']}: 0 Mars rows; parsed {len(parsed)} rows; last codes={codes[-12:]}")
            continue

        mars.sort(key=lambda r: float(r["jd"]))
        first_date = jd_to_iso(float(mars[0]["jd"]))[0]
        last_date = jd_to_iso(float(mars[-1]["jd"]))[0]
        print(f"{catalog['volume']}: {len(mars)} Mars rows, {first_date} .. {last_date}")

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
                    "source_volume": str(catalog["volume"]),
                    "source_catalog": str(catalog["catalog"]),
                }
            )

    if not output:
        raise RuntimeError("no Carlsberg Mars observations were found")

    # Deduplicate exact repeated timestamps in cumulative/overlapping releases,
    # preferring the later volume in CATALOGS (dict assignment replaces earlier rows).
    by_jd: dict[str, dict[str, str]] = {}
    for row in output:
        by_jd[row["tdt_jd"]] = row
    output = sorted(by_jd.values(), key=lambda r: float(r["tdt_jd"]))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(output[0].keys()))
        writer.writeheader()
        writer.writerows(output)

    good = sum(1 for r in output if r["quality_flag"] != "*")
    volumes = sorted({r["source_volume"] for r in output})
    print(f"wrote {len(output)} Carlsberg Mars observations ({good} unflagged) from {volumes} to {OUT}")
    print(f"combined range: {output[0]['timestamp_tdt']} .. {output[-1]['timestamp_tdt']}")


if __name__ == "__main__":
    main()

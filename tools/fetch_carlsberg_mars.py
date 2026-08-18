from __future__ import annotations

import csv
import gzip
import math
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "mars_observations_carlsberg.csv"
MIN_BASELINE_DAYS = 730.0
MARS_COMPOSITE_CMC_CODE = "9000040"
RAW_URLS = [
    "https://vizier.cfa.harvard.edu/ftp/cats/I/256/planet.dat.gz",
    "https://cdsarc.cds.unistra.fr/ftp/cats/I/256/planet.dat.gz",
]


def fetch_url(url: str, timeout: int = 90) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "planetary-models-educational-site/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def download_planet_table() -> str:
    last_error: Exception | None = None
    for url in RAW_URLS:
        try:
            text = gzip.decompress(fetch_url(url)).decode("ascii", errors="replace")
            rows = text.splitlines()
            if len(rows) < 25000:
                raise RuntimeError(f"unexpectedly short planet.dat: {len(rows)} rows")
            print(f"downloaded I/256 planet.dat from {url}: {len(rows)} rows")
            return text
        except Exception as exc:
            print(f"failed {url}: {exc}")
            last_error = exc
    raise RuntimeError(f"all I/256 planet.dat mirrors failed: {last_error}")


def parse_planet_line(line: str) -> dict[str, str | float] | None:
    if len(line) < 76:
        return None
    try:
        cmc = line[1:8].strip()
        mp = line[12:16].strip()
        name = line[18:30].strip()
        tt = float(line[32:46])
        flag = line[46:47].strip()
        rah = int(line[50:52]); ram = int(line[53:55]); ras = float(line[56:62])
        sign = -1.0 if line[64:65] == "-" else 1.0
        ded = int(line[65:67]); dem = int(line[68:70]); des = float(line[71:76])
    except ValueError:
        return None
    if not (0 <= rah <= 23 and 0 <= ram <= 59 and 0 <= ras < 60):
        return None
    if not (0 <= ded <= 90 and 0 <= dem <= 59 and 0 <= des < 60):
        return None
    return {
        "cmc": cmc, "mp": mp, "name": name, "tt": tt, "flag": flag,
        "ra_deg": 15.0 * (rah + ram / 60.0 + ras / 3600.0),
        "dec_deg": sign * (ded + dem / 60.0 + des / 3600.0),
    }


def mean_obliquity_deg(jd: float) -> float:
    t = (jd - 2451545.0) / 36525.0
    return (84381.448 - 46.8150 * t - 0.00059 * t * t + 0.001813 * t * t * t) / 3600.0


def equatorial_to_ecliptic_lon_deg(ra_deg: float, dec_deg: float, jd: float) -> float:
    ra = math.radians(ra_deg); dec = math.radians(dec_deg); eps = math.radians(mean_obliquity_deg(jd))
    x = math.cos(dec) * math.cos(ra)
    y_eq = math.cos(dec) * math.sin(ra); z_eq = math.sin(dec)
    y_ecl = y_eq * math.cos(eps) + z_eq * math.sin(eps)
    return math.degrees(math.atan2(y_ecl, x)) % 360.0


def jd_to_iso(jd: float) -> tuple[str, str]:
    dt = datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=(jd - 2440587.5) * 86400.0)
    return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%dT%H:%M:%S")


def is_mars(row: dict[str, str | float]) -> bool:
    return str(row["name"]).strip().casefold() == "mars" or str(row["cmc"]).strip() == MARS_COMPOSITE_CMC_CODE


def main() -> None:
    parsed = [p for line in download_planet_table().splitlines() if (p := parse_planet_line(line)) is not None]
    bright = [p for p in parsed if str(p["cmc"]).startswith("90000")]
    print("bright-object identifiers:", sorted({(str(p["cmc"]), str(p["mp"]), str(p["name"])) for p in bright}))
    mars = [p for p in parsed if is_mars(p)]
    if not mars:
        raise RuntimeError("no Mars observations found; see bright-object identifiers above")

    mars.sort(key=lambda row: float(row["tt"]))
    print(f"raw Mars rows: {len(mars)}")
    print("Mars identifiers:", sorted({(str(row["cmc"]), str(row["mp"]), str(row["name"])) for row in mars}))

    output: list[dict[str, str]] = []
    for row in mars:
        jd = float(row["tt"]); ra_deg = float(row["ra_deg"]); dec_deg = float(row["dec_deg"])
        date, timestamp = jd_to_iso(jd)
        output.append({
            "date": date, "timestamp_tdt": timestamp, "tdt_jd": f"{jd:.6f}",
            "ra_deg": f"{ra_deg:.10f}", "dec_deg": f"{dec_deg:.10f}",
            "ecliptic_lon_deg": f"{equatorial_to_ecliptic_lon_deg(ra_deg, dec_deg, jd):.10f}",
            "quality_flag": str(row["flag"]), "cmc_object_code": str(row["cmc"]),
            "source_volume": "CMC1-11", "source_catalog": "I/256 planet.dat",
        })

    output = sorted({row["tdt_jd"]: row for row in output}.values(), key=lambda row: float(row["tdt_jd"]))
    baseline = float(output[-1]["tdt_jd"]) - float(output[0]["tdt_jd"])
    if baseline < MIN_BASELINE_DAYS:
        raise RuntimeError(f"Carlsberg Mars baseline is only {baseline:.1f} days; at least {MIN_BASELINE_DAYS:.0f} required")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(output[0].keys())); writer.writeheader(); writer.writerows(output)
    good = sum(1 for row in output if row["quality_flag"] != "*")
    print(f"wrote {len(output)} Mars observations ({good} unflagged) to {OUT}")
    print(f"range: {output[0]['timestamp_tdt']} .. {output[-1]['timestamp_tdt']} ({baseline:.1f} days / {baseline / 365.25:.2f} years)")


if __name__ == "__main__":
    main()

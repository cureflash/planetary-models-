from __future__ import annotations

import csv
import gzip
import math
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "mars_observations_carlsberg.csv"  # temporary compatibility path
MIN_BASELINE_DAYS = 730.0
RAW_URLS = [
    "https://vizier.cfa.harvard.edu/ftp/cats/I/188/planets.gz",
    "https://cdsarc.cds.unistra.fr/ftp/cats/I/188/planets.gz",
    "https://vizier.cfa.harvard.edu/ftp/cats/I/188/planets",
]


def fetch_url(url: str, timeout: int = 90) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "planetary-models-educational-site/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def download_planets() -> str:
    last_error: Exception | None = None
    for url in RAW_URLS:
        try:
            payload = fetch_url(url)
            if url.endswith(".gz"):
                payload = gzip.decompress(payload)
            text = payload.decode("ascii", errors="replace")
            rows = text.splitlines()
            if len(rows) < 600:
                raise RuntimeError(f"unexpectedly short planets table: {len(rows)} rows")
            print(f"downloaded Tokyo PMC88 planets from {url}: {len(rows)} rows")
            return text
        except Exception as exc:
            print(f"failed {url}: {exc}")
            last_error = exc
    raise RuntimeError(f"all Tokyo PMC88 mirrors failed: {last_error}")


def parse_planet_line(line: str) -> dict[str, str | float] | None:
    # CDS I/188 / planets, 1-based byte positions from the catalogue ReadMe.
    if len(line) < 90:
        return None
    try:
        name = line[0:12].strip()
        seq = line[12:16].strip()
        jd = float(line[18:32])
        rah = int(line[48:50])
        ram = int(line[51:53])
        ras = float(line[54:60])
        sign = -1.0 if line[78:79] == "-" else 1.0
        ded = int(line[79:81])
        dem = int(line[82:84])
        des = float(line[85:90])
    except ValueError:
        return None
    if not (0 <= rah <= 23 and 0 <= ram <= 59 and 0 <= ras < 60):
        return None
    if not (0 <= ded <= 90 and 0 <= dem <= 59 and 0 <= des < 60):
        return None
    return {
        "name": name,
        "seq": seq,
        "jd": jd,
        "ra_deg": 15.0 * (rah + ram / 60.0 + ras / 3600.0),
        "dec_deg": sign * (ded + dem / 60.0 + des / 3600.0),
    }


def mean_obliquity_deg(jd: float) -> float:
    t = (jd - 2451545.0) / 36525.0
    return (84381.448 - 46.8150 * t - 0.00059 * t * t + 0.001813 * t * t * t) / 3600.0


def equatorial_to_ecliptic_lon_deg(ra_deg: float, dec_deg: float, jd: float) -> float:
    ra = math.radians(ra_deg)
    dec = math.radians(dec_deg)
    eps = math.radians(mean_obliquity_deg(jd))
    x = math.cos(dec) * math.cos(ra)
    y_eq = math.cos(dec) * math.sin(ra)
    z_eq = math.sin(dec)
    y_ecl = y_eq * math.cos(eps) + z_eq * math.sin(eps)
    return math.degrees(math.atan2(y_ecl, x)) % 360.0


def jd_to_iso(jd: float) -> tuple[str, str]:
    dt = datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=(jd - 2440587.5) * 86400.0)
    return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%dT%H:%M:%S")


def main() -> None:
    parsed = [p for line in download_planets().splitlines() if (p := parse_planet_line(line)) is not None]
    names = sorted({str(row["name"]) for row in parsed})
    print("planet names:", names)
    mars = [row for row in parsed if str(row["name"]).strip().casefold() == "mars"]
    if not mars:
        raise RuntimeError("Tokyo PMC88 contains no Mars rows")

    mars.sort(key=lambda row: float(row["jd"]))
    output: list[dict[str, str]] = []
    for row in mars:
        jd = float(row["jd"])
        ra_deg = float(row["ra_deg"])
        dec_deg = float(row["dec_deg"])
        date, timestamp = jd_to_iso(jd)
        output.append({
            "date": date,
            "timestamp_tdt": timestamp,
            "tdt_jd": f"{jd:.6f}",
            "ra_deg": f"{ra_deg:.10f}",
            "dec_deg": f"{dec_deg:.10f}",
            "ecliptic_lon_deg": f"{equatorial_to_ecliptic_lon_deg(ra_deg, dec_deg, jd):.10f}",
            "quality_flag": "",
            "cmc_object_code": str(row["seq"]),
            "source_volume": "Tokyo PMC88 Part III",
            "source_catalog": "CDS I/188 planets",
        })

    output = sorted({row["tdt_jd"]: row for row in output}.values(), key=lambda row: float(row["tdt_jd"]))
    baseline = float(output[-1]["tdt_jd"]) - float(output[0]["tdt_jd"])
    print(f"Mars rows: {len(output)}")
    print(f"range: {output[0]['timestamp_tdt']} .. {output[-1]['timestamp_tdt']} ({baseline:.1f} days / {baseline / 365.25:.2f} years)")
    if baseline < MIN_BASELINE_DAYS:
        raise RuntimeError(f"Tokyo PMC88 Mars baseline is only {baseline:.1f} days; at least {MIN_BASELINE_DAYS:.0f} required")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(output[0].keys()))
        writer.writeheader()
        writer.writerows(output)
    print(f"wrote {len(output)} Tokyo PMC88 Mars observations to {OUT}")


if __name__ == "__main__":
    main()

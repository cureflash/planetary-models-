from __future__ import annotations

import csv
import math
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "mars_observations_usno_w2j00.csv"
COMPAT_OUT = ROOT / "data" / "mars_observations_carlsberg.csv"
MIN_BASELINE_DAYS = 730.0

RAW_URLS = [
    "https://vizier.cfa.harvard.edu/ftp/cats/I/334/w2j00sol.dat",
    "https://cdsarc.cds.unistra.fr/ftp/cats/I/334/w2j00sol.dat",
]
USER_AGENT = "planetary-models-educational-site/1.0"


def fetch_text() -> str:
    errors: list[str] = []
    for url in RAW_URLS:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=120) as response:
                text = response.read().decode("ascii", errors="replace")
            if len(text.splitlines()) < 10000:
                raise RuntimeError(f"unexpectedly short W2J00 table: {len(text.splitlines())} rows")
            print(f"downloaded W2J00 solar-system table from {url}: {len(text.splitlines())} rows")
            return text
        except Exception as exc:
            print(f"failed {url}: {exc}")
            errors.append(f"{url}: {exc}")
    raise RuntimeError("all W2J00 mirrors failed:\n" + "\n".join(errors))


def parse_ra_deg(raw: str) -> float | None:
    # RAa is a 12-character apparent-place field. Some observations contain
    # only hour/minute; keep only complete 2-D directions for this site.
    parts = raw.strip().split()
    if len(parts) != 3:
        return None
    try:
        h, m, s = int(parts[0]), int(parts[1]), float(parts[2])
    except ValueError:
        return None
    if not (0 <= h <= 23 and 0 <= m <= 59 and 0 <= s < 60):
        return None
    return 15.0 * (h + m / 60.0 + s / 3600.0)


def parse_dec_deg(raw: str) -> float | None:
    parts = raw.strip().split()
    if len(parts) != 3:
        return None
    try:
        d_token = parts[0]
        sign = -1.0 if d_token.startswith("-") else 1.0
        d = abs(int(d_token))
        m = int(parts[1])
        s = float(parts[2])
    except ValueError:
        return None
    if not (0 <= d <= 90 and 0 <= m <= 59 and 0 <= s < 60):
        return None
    return sign * (d + m / 60.0 + s / 3600.0)


def mean_obliquity_deg(jd: float) -> float:
    t = (jd - 2451545.0) / 36525.0
    seconds = 84381.448 - 46.8150 * t - 0.00059 * t * t + 0.001813 * t * t * t
    return seconds / 3600.0


def equatorial_to_ecliptic_lon_deg(ra_deg: float, dec_deg: float, jd: float) -> float:
    # Coordinate rotation only. W2J00 RA/Dec are apparent geocentric places
    # referred to the true equator/equinox of the observation date.
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


def angular_diff_deg(a: float, b: float) -> float:
    return (a - b + 180.0) % 360.0 - 180.0


def parse_mars(text: str) -> tuple[list[dict[str, str]], int]:
    all_mars = 0
    output: list[dict[str, str]] = []
    for line in text.splitlines():
        if len(line) < 63:
            continue
        obj = line[0:10].strip()
        if obj.casefold() != "mars":
            continue
        all_mars += 1

        # Byte layout from VizieR I/334 ReadMe (1-indexed):
        # Obj 1-10, RAa 12-23, DEa 25-36, Epoch 38-50,
        # Obs 52-54, Clamp 56, RALimb 58, DELimb 60, Tel 62-63.
        ra_deg = parse_ra_deg(line[11:23])
        dec_deg = parse_dec_deg(line[24:36])
        if ra_deg is None or dec_deg is None:
            continue
        try:
            jd = float(line[37:50])
        except ValueError:
            continue

        date, timestamp = jd_to_iso(jd)
        output.append({
            "date": date,
            "timestamp_ut1": timestamp,
            "jd_ut1": f"{jd:.5f}",
            "ra_deg": f"{ra_deg:.10f}",
            "dec_deg": f"{dec_deg:.10f}",
            "ecliptic_lon_deg": f"{equatorial_to_ecliptic_lon_deg(ra_deg, dec_deg, jd):.10f}",
            "observer": line[51:54].strip(),
            "clamp": line[55:56].strip(),
            "ra_limb": line[57:58].strip(),
            "dec_limb": line[59:60].strip(),
            "telescope": line[61:63].strip(),
            "source_catalog": "USNO W2J00 Transit Circle Catalog (VizieR I/334 w2j00sol.dat)",
        })

    # A complete RA+Dec pair at the same epoch defines one measured direction.
    # Remove exact duplicate epochs while preserving the first measurement.
    output = sorted(
        {row["jd_ut1"]: row for row in output}.values(),
        key=lambda row: float(row["jd_ut1"]),
    )
    return output, all_mars


def summarize(rows: list[dict[str, str]], all_mars: int) -> None:
    if len(rows) < 20:
        raise RuntimeError(f"too few complete W2J00 Mars directions: {len(rows)}")
    jds = [float(row["jd_ut1"]) for row in rows]
    gaps = [b - a for a, b in zip(jds, jds[1:])]
    baseline = jds[-1] - jds[0]
    max_gap = max(gaps) if gaps else 0.0
    gap_index = gaps.index(max_gap) if gaps else 0

    retrograde_runs = 0
    in_retrograde = False
    for a, b in zip(rows, rows[1:]):
        dt = float(b["jd_ut1"]) - float(a["jd_ut1"])
        dlon = angular_diff_deg(float(b["ecliptic_lon_deg"]), float(a["ecliptic_lon_deg"]))
        # Diagnostic only: count runs with clearly negative apparent longitude rate.
        retro = dt > 0 and dlon / dt < -0.01
        if retro and not in_retrograde:
            retrograde_runs += 1
            in_retrograde = True
        elif not retro:
            in_retrograde = False

    print(f"W2J00 Mars records (all coordinate combinations): {all_mars}")
    print(f"complete RA+Dec directions used: {len(rows)}")
    print(f"range: {rows[0]['timestamp_ut1']} .. {rows[-1]['timestamp_ut1']}")
    print(f"baseline: {baseline:.1f} days / {baseline / 365.25:.2f} years")
    print(f"max observation gap: {max_gap:.1f} days")
    if gaps:
        print(f"max gap endpoints: {rows[gap_index]['date']} -> {rows[gap_index + 1]['date']}")
    print(f"detected retrograde runs (diagnostic): {retrograde_runs}")

    if baseline < MIN_BASELINE_DAYS:
        raise RuntimeError(f"W2J00 Mars baseline {baseline:.1f} d is below {MIN_BASELINE_DAYS:.0f} d")


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def write_compat(rows: list[dict[str, str]]) -> None:
    # Old cached builds may still request the obsolete Carlsberg filename.
    # Keep the URL alive, but make the content and source unmistakably W2J00.
    compat: list[dict[str, str]] = []
    for i, row in enumerate(rows, 1):
        compat.append({
            "date": row["date"],
            "timestamp_tdt": row["timestamp_ut1"],
            "tdt_jd": row["jd_ut1"],
            "ra_deg": row["ra_deg"],
            "dec_deg": row["dec_deg"],
            "ecliptic_lon_deg": row["ecliptic_lon_deg"],
            "quality_flag": "",
            "cmc_object_code": str(i),
            "source_volume": "USNO W2J00 compatibility alias",
            "source_catalog": row["source_catalog"],
        })
    COMPAT_OUT.parent.mkdir(parents=True, exist_ok=True)
    with COMPAT_OUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(compat[0].keys()))
        writer.writeheader()
        writer.writerows(compat)


def main() -> None:
    rows, all_mars = parse_mars(fetch_text())
    summarize(rows, all_mars)
    write_csv(OUT, rows)
    write_compat(rows)
    print(f"wrote {len(rows)} W2J00 Mars directions to {OUT}")
    print(f"wrote stale-client compatibility alias to {COMPAT_OUT}")


if __name__ == "__main__":
    main()

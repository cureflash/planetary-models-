from __future__ import annotations

import csv
import io
import math
import re
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "mars_observations_carlsberg.csv"
MIN_BASELINE_DAYS = 730.0

ASU_BASES = [
    "https://vizier.cfa.harvard.edu/viz-bin/asu-tsv",
    "https://vizier.cds.unistra.fr/viz-bin/asu-tsv",
    "https://vizier.u-strasbg.fr/viz-bin/asu-tsv",
    "https://vizier.iucaa.in/viz-bin/asu-tsv",
]
USER_AGENT = "planetary-models-educational-site/1.0"


def fetch_planet_table() -> str:
    params = {
        "-source": "I/256/planet",
        "-out": "Name,TT,flag,RA,DE",
        "-out.max": "50000",
    }
    errors: list[str] = []
    for base in ASU_BASES:
        url = base + "?" + urllib.parse.urlencode(params)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=120) as response:
                text = response.read().decode("utf-8", errors="replace")
            if "Name" not in text or "TT" not in text:
                raise RuntimeError("response does not look like I/256/planet TSV")
            print(f"downloaded I/256/planet from {base}: {len(text)} bytes")
            return text
        except Exception as exc:
            print(f"failed {base}: {exc}")
            errors.append(f"{base}: {exc}")
    raise RuntimeError("all VizieR ASU mirrors failed:\n" + "\n".join(errors))


def parse_asu_tsv(text: str) -> list[dict[str, str]]:
    lines = [line for line in text.splitlines() if line and not line.startswith("#")]
    # VizieR inserts a dashed separator after the header; DictReader can see it as a row.
    reader = csv.DictReader(io.StringIO("\n".join(lines)), delimiter="\t")
    rows: list[dict[str, str]] = []
    for row in reader:
        name = (row.get("Name") or "").strip()
        if not name or set(name) <= {"-", " "}:
            continue
        rows.append({k: (v or "").strip() for k, v in row.items() if k is not None})
    if not rows:
        print("first non-comment lines:")
        for line in lines[:12]:
            print(repr(line))
        raise RuntimeError("VizieR I/256/planet parsed to zero rows")
    return rows


def parse_ra_deg(value: str) -> float:
    parts = [p for p in re.split(r"[:\s]+", value.strip()) if p]
    if len(parts) == 1:
        # VizieR may emit decimal degrees for a sexagesimal coordinate when requested via ASU.
        number = float(parts[0])
        return number if number > 24 else number * 15.0
    if len(parts) < 3:
        raise ValueError(f"bad RA: {value!r}")
    h, m, s = map(float, parts[:3])
    return 15.0 * (h + m / 60.0 + s / 3600.0)


def parse_dec_deg(value: str) -> float:
    raw = value.strip()
    parts = [p for p in re.split(r"[:\s]+", raw.lstrip("+-")) if p]
    sign = -1.0 if raw.startswith("-") else 1.0
    if len(parts) == 1:
        return float(raw)
    if len(parts) < 3:
        raise ValueError(f"bad Dec: {value!r}")
    d, m, s = map(float, parts[:3])
    return sign * (d + m / 60.0 + s / 3600.0)


def mean_obliquity_deg(jd: float) -> float:
    t = (jd - 2451545.0) / 36525.0
    seconds = 84381.448 - 46.8150 * t - 0.00059 * t * t + 0.001813 * t * t * t
    return seconds / 3600.0


def equatorial_to_ecliptic_lon_deg(ra_deg: float, dec_deg: float, jd: float) -> float:
    # Coordinate rotation only. I/256 RA/DE are apparent geocentric coordinates
    # for the equinox of date; no heliocentric Mars orbit is used here.
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


def angular_diff_deg(a: float, b: float) -> float:
    return (a - b + 180.0) % 360.0 - 180.0


def summarize(rows: list[dict[str, str]]) -> None:
    jds = [float(row["jd_tt"]) for row in rows]
    gaps = [b - a for a, b in zip(jds, jds[1:])]
    max_gap = max(gaps) if gaps else 0.0
    gap_index = gaps.index(max_gap) if gaps else 0

    retro_flags: list[bool] = []
    for a, b in zip(rows, rows[1:]):
        dt = float(b["jd_tt"]) - float(a["jd_tt"])
        dl = angular_diff_deg(float(b["ecliptic_lon_deg"]), float(a["ecliptic_lon_deg"]))
        retro_flags.append(dt > 0 and dl / dt < -0.01)
    episodes = 0
    in_episode = False
    for flag in retro_flags:
        if flag and not in_episode:
            episodes += 1
            in_episode = True
        elif not flag:
            in_episode = False

    baseline = jds[-1] - jds[0]
    print(f"Carlsberg Mars rows: {len(rows)}")
    print(f"range: {rows[0]['timestamp_tt']} .. {rows[-1]['timestamp_tt']}")
    print(f"baseline: {baseline:.1f} days / {baseline / 365.25:.2f} years")
    print(f"max observation gap: {max_gap:.1f} days")
    if gaps:
        print(f"max gap endpoints: {rows[gap_index]['date']} -> {rows[gap_index + 1]['date']}")
    print(f"detected retrograde runs (diagnostic): {episodes}")

    if baseline < MIN_BASELINE_DAYS:
        raise RuntimeError(f"Carlsberg Mars baseline {baseline:.1f} d is below {MIN_BASELINE_DAYS:.0f} d")


def main() -> None:
    raw_rows = parse_asu_tsv(fetch_planet_table())
    mars_raw = [row for row in raw_rows if (row.get("Name") or "").strip().casefold() == "mars"]
    if not mars_raw:
        names = sorted({(row.get("Name") or "").strip() for row in raw_rows})
        print("sample names:", names[:80])
        raise RuntimeError("I/256/planet contains no rows with Name=Mars")

    total_mars = len(mars_raw)
    good = [row for row in mars_raw if (row.get("flag") or "").strip() != "*"]
    print(f"Mars rows before quality filter: {total_mars}; after flag filter: {len(good)}")

    output: list[dict[str, str]] = []
    bad_rows: list[tuple[dict[str, str], str]] = []
    for row in good:
        try:
            jd = float(row["TT"])
            ra_deg = parse_ra_deg(row["RA"])
            dec_deg = parse_dec_deg(row["DE"])
            date, timestamp = jd_to_iso(jd)
            output.append({
                "date": date,
                "timestamp_tt": timestamp,
                "jd_tt": f"{jd:.6f}",
                # Backward-compatible aliases for stale clients from the earlier Carlsberg build.
                "timestamp_tdt": timestamp,
                "tdt_jd": f"{jd:.6f}",
                "ra_deg": f"{ra_deg:.10f}",
                "dec_deg": f"{dec_deg:.10f}",
                "ecliptic_lon_deg": f"{equatorial_to_ecliptic_lon_deg(ra_deg, dec_deg, jd):.10f}",
                "quality_flag": (row.get("flag") or "").strip(),
                "object_name": (row.get("Name") or "").strip(),
                "source_catalog": "Carlsberg Meridian Catalogs CMC1-11 (VizieR I/256/planet)",
            })
        except Exception as exc:
            bad_rows.append((row, str(exc)))

    if bad_rows:
        print(f"unparsed Mars rows: {len(bad_rows)}")
        for row, err in bad_rows[:10]:
            print(err, row)
    if not output:
        raise RuntimeError("all Carlsberg Mars rows failed coordinate parsing")

    output = sorted(
        {row["jd_tt"]: row for row in output}.values(),
        key=lambda row: float(row["jd_tt"]),
    )
    summarize(output)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(output[0].keys()))
        writer.writeheader()
        writer.writerows(output)
    print(f"wrote {len(output)} Carlsberg Mars observations to {OUT}")


if __name__ == "__main__":
    main()

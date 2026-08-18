from __future__ import annotations

import csv
import json
from pathlib import Path

import numpy as np
from scipy.optimize import differential_evolution, least_squares

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "mars_observations_carlsberg.csv"
OUT = ROOT / "data" / "ptolemy_mars_fitted_parameters.json"
JS_OUT = ROOT / "models" / "ptolemy" / "fitted-parameters.js"

# Mean periods are fixed constants for this educational comparison. The fitted
# quantities are phase, epicycle size, eccentric offset and apsidal angle.
MARS_PERIOD = 686.97959
EARTH_PERIOD = 365.256363004
WM = 2 * np.pi / MARS_PERIOD
WE = 2 * np.pi / EARTH_PERIOD

rows = list(csv.DictReader(DATA.open(encoding="utf-8")))
if len(rows) < 20:
    raise RuntimeError(f"too few Carlsberg Mars observations: {len(rows)}")

jd = np.array([float(r["jd_tt"]) for r in rows])
obs = np.deg2rad(np.array([float(r["ecliptic_lon_deg"]) for r in rows]))
t = jd - jd[0]
gaps = np.diff(jd)


def wrap(x):
    return np.arctan2(np.sin(x), np.cos(x))


def lon(z):
    return np.arctan2(z.imag, z.real)


def pred1(tt, p):
    return wrap(WM * tt + p[0])


def pred2(tt, p):
    phase_m, r, phase_e = p
    d = np.exp(1j * (WM * tt + phase_m))
    return lon(d + r * np.exp(1j * (WE * tt + phase_e)))


def pred3(tt, p):
    ecc, apsis, phase_m, r, phase_e = p
    c = ecc * np.exp(1j * apsis)
    d = c + np.exp(1j * (WM * tt + phase_m))
    return lon(d + r * np.exp(1j * (WE * tt + phase_e)))


def equant_center(tt, ecc, apsis, phase_m):
    c = ecc * np.exp(1j * apsis)
    q = 2 * c
    alpha = WM * tt + phase_m
    u = np.exp(1j * alpha)
    cu = c.real * u.real + c.imag * u.imag
    cc = c.real * c.real + c.imag * c.imag
    disc = np.maximum(cu * cu + 1 - cc, 0)
    s = -cu + np.sqrt(disc)
    return q + s * u


def pred4(tt, p):
    ecc, apsis, phase_m, r, phase_e = p
    d = equant_center(tt, ecc, apsis, phase_m)
    return lon(d + r * np.exp(1j * (WE * tt + phase_e)))


models = [
    ("simple_circle", pred1, [(0, 2 * np.pi)]),
    ("epicycle_only", pred2, [(0, 2 * np.pi), (0.25, 1.0), (0, 2 * np.pi)]),
    (
        "epicycle_eccentric",
        pred3,
        [(0, 0.4), (0, 2 * np.pi), (0, 2 * np.pi), (0.25, 1.0), (0, 2 * np.pi)],
    ),
    (
        "equant",
        pred4,
        [(0, 0.4), (0, 2 * np.pi), (0, 2 * np.pi), (0.25, 1.0), (0, 2 * np.pi)],
    ),
]

result = {
    "source": {
        "catalog": "Carlsberg Meridian Catalogs Number 1-11",
        "catalog_id": "VizieR I/256",
        "table": "I/256/planet",
        "target": "Mars",
        "observations_total": len(rows),
        "observations_used": len(rows),
        "coordinate": "observed apparent geocentric RA/Dec of date, converted to ecliptic longitude for model comparison",
        "time_scale": "TT",
    },
    "constants": {
        "mars_period_days": MARS_PERIOD,
        "earth_period_days": EARTH_PERIOD,
        "epoch_jd": float(jd[0]),
        "epoch_date": rows[0]["date"],
        "last_date": rows[-1]["date"],
        "baseline_days": float(jd[-1] - jd[0]),
        "max_observation_gap_days": float(np.max(gaps)) if len(gaps) else 0.0,
    },
    "models": {},
}

for name, fn, bounds in models:
    def residual(p, tt=t, oo=obs):
        return wrap(fn(tt, p) - oo)

    def objective(p):
        r = residual(p)
        return float(np.mean(r * r))

    de = differential_evolution(
        objective,
        bounds,
        tol=1e-9,
        popsize=18,
        maxiter=900,
        seed=42,
        polish=True,
        workers=1,
    )
    ls = least_squares(
        lambda p: residual(p),
        de.x,
        bounds=(np.array([b[0] for b in bounds]), np.array([b[1] for b in bounds])),
        max_nfev=8000,
    )
    p = ls.x
    allerr = np.rad2deg(wrap(fn(t, p) - obs))
    stats = {
        "mae_deg": float(np.mean(np.abs(allerr))),
        "rms_deg": float(np.sqrt(np.mean(allerr**2))),
        "max_abs_deg": float(np.max(np.abs(allerr))),
    }
    result["models"][name] = {
        "parameters": [float(x) for x in p],
        "stats": stats,
    }
    print(name, p, stats)

OUT.write_text(json.dumps(result, indent=2), encoding="utf-8")
js = "// Auto-generated from Carlsberg I/256 Mars observations by tools/fit_ptolemy_models.py.\n"
js += "export const PTOLEMY_FIT = " + json.dumps(result, ensure_ascii=False, indent=2) + ";\n"
JS_OUT.write_text(js, encoding="utf-8")

print("wrote", OUT)
print("wrote", JS_OUT)

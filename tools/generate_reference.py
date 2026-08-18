from __future__ import annotations
import csv, math
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'mars_reference_2020_2030.csv'

# JPL Solar System Dynamics: Approximate Positions of the Planets
# Valid 1800 AD - 2050 AD, mean ecliptic/equinox of J2000.
ELEMENTS = {
    'emb': {
        'a': (1.00000261, 0.00000562),
        'e': (0.01671123, -0.00004392),
        'I': (-0.00001531, -0.01294668),
        'L': (100.46457166, 35999.37244981),
        'p': (102.93768193, 0.32327364),
        'O': (0.0, 0.0),
    },
    'mars': {
        'a': (1.52371034, 0.00001847),
        'e': (0.09339410, 0.00007882),
        'I': (1.84969142, -0.00813131),
        'L': (-4.55343205, 19140.30268499),
        'p': (-23.94362959, 0.44441088),
        'O': (49.55953891, -0.29257343),
    },
}

def jd_from_date(d: date) -> float:
    y, m = d.year, d.month
    day = d.day
    if m <= 2:
        y -= 1
        m += 12
    A = y // 100
    B = 2 - A + A // 4
    return math.floor(365.25 * (y + 4716)) + math.floor(30.6001 * (m + 1)) + day + B - 1524.5

def wrap180(x: float) -> float:
    return (x + 180.0) % 360.0 - 180.0

def solve_kepler_deg(M_deg: float, e: float) -> float:
    M = wrap180(M_deg)
    estar = (180.0 / math.pi) * e
    E = M + estar * math.sin(math.radians(M))
    for _ in range(20):
        dM = M - (E - estar * math.sin(math.radians(E)))
        dE = dM / (1.0 - e * math.cos(math.radians(E)))
        E += dE
        if abs(dE) <= 1e-10:
            break
    return E

def heliocentric_xyz(body: str, jd: float):
    T = (jd - 2451545.0) / 36525.0
    E = ELEMENTS[body]
    a = E['a'][0] + E['a'][1] * T
    e = E['e'][0] + E['e'][1] * T
    I = E['I'][0] + E['I'][1] * T
    L = E['L'][0] + E['L'][1] * T
    p = E['p'][0] + E['p'][1] * T
    O = E['O'][0] + E['O'][1] * T
    w = p - O
    M = L - p
    Ea = solve_kepler_deg(M, e)
    Er = math.radians(Ea)
    x1 = a * (math.cos(Er) - e)
    y1 = a * math.sqrt(1 - e * e) * math.sin(Er)
    wr, Or, Ir = map(math.radians, (w, O, I))
    cw, sw = math.cos(wr), math.sin(wr)
    cO, sO = math.cos(Or), math.sin(Or)
    cI, sI = math.cos(Ir), math.sin(Ir)
    x = (cw*cO - sw*sO*cI)*x1 + (-sw*cO - cw*sO*cI)*y1
    y = (cw*sO + sw*cO*cI)*x1 + (-sw*sO + cw*cO*cI)*y1
    z = (sw*sI)*x1 + (cw*sI)*y1
    return x, y, z

def main():
    start = date(2020, 1, 1)
    stop = date(2030, 1, 1)
    rows = []
    d = start
    while d <= stop:
        jd = jd_from_date(d)
        ex, ey, ez = heliocentric_xyz('emb', jd)
        mx, my, mz = heliocentric_xyz('mars', jd)
        gx, gy, gz = mx - ex, my - ey, mz - ez
        lon = math.degrees(math.atan2(gy, gx)) % 360.0
        dist = math.sqrt(gx*gx + gy*gy + gz*gz)
        rows.append([
            d.isoformat(), f'{jd:.1f}',
            ex, ey, ez,
            mx, my, mz,
            gx, gy, gz,
            lon, dist,
        ])
        d += timedelta(days=1)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow([
            'date', 'jd',
            'earth_x_au', 'earth_y_au', 'earth_z_au',
            'mars_x_au', 'mars_y_au', 'mars_z_au',
            'geo_x_au', 'geo_y_au', 'geo_z_au',
            'geo_lon_deg', 'geo_distance_au',
        ])
        for r in rows:
            w.writerow([r[0], r[1]] + [f'{v:.10f}' for v in r[2:]])
    print(f'wrote {len(rows)} rows to {OUT}')

if __name__ == '__main__':
    main()

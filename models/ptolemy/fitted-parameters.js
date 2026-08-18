// Auto-generated from Carlsberg CMC4 Mars observations by tools/fit_ptolemy_models.py.
export const PTOLEMY_FIT = {
  "source": {
    "catalog": "CDS I/147 table2.dat",
    "name": "Carlsberg Meridian Catalog Vol. 4 (CMC4)",
    "target": "Mars (CMC code 99040)",
    "observations_total": 135,
    "observations_used": 135,
    "filter": "exclude meFlag='*' (high internal mean error)",
    "coordinate": "apparent geocentric RA/Dec of date, converted to ecliptic longitude for model comparison"
  },
  "constants": {
    "mars_period_days": 686.97959,
    "earth_period_days": 365.256363004,
    "epoch_jd": 2446539.756753,
    "epoch_date": "1986-04-19",
    "last_date": "1986-11-29"
  },
  "models": {
    "simple_circle": {
      "parameters": [
        4.1967738555458265
      ],
      "stats": {
        "mae_deg": 23.05305638121163,
        "rms_deg": 25.415421812555255,
        "max_abs_deg": 39.94540101147789
      }
    },
    "epicycle_only": {
      "parameters": [
        4.315799380460533,
        0.6180622795324798,
        0.5530285089458553
      ],
      "stats": {
        "mae_deg": 1.5603886364516386,
        "rms_deg": 1.778306051777527,
        "max_abs_deg": 4.256242597497707
      }
    },
    "epicycle_eccentric": {
      "parameters": [
        0.1358158950106864,
        2.747796749075977,
        4.4140741809787025,
        0.613072067990994,
        0.5323890687588814
      ],
      "stats": {
        "mae_deg": 0.002972428775775499,
        "rms_deg": 0.003642236646341806,
        "max_abs_deg": 0.010367540537114311
      }
    },
    "equant": {
      "parameters": [
        0.09417166840884185,
        2.75299906800686,
        4.4138647581135695,
        0.6513399609662783,
        0.4806609651018004
      ],
      "stats": {
        "mae_deg": 0.003202282002863174,
        "rms_deg": 0.004087173645605957,
        "max_abs_deg": 0.013288508481980882
      }
    }
  }
};

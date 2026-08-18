// Auto-generated from USNO W2J00 Mars observations by tools/fit_ptolemy_models.py.
export const PTOLEMY_FIT = {
  "source": {
    "catalog": "USNO W2J00 Transit Circle Catalog",
    "catalog_id": "VizieR I/334",
    "table": "w2j00sol.dat",
    "target": "Mars",
    "observations_total": 623,
    "observations_used": 623,
    "coordinate": "observed apparent geocentric RA/Dec of date, converted to ecliptic longitude for model comparison",
    "time_scale": "UT1"
  },
  "constants": {
    "mars_period_days": 686.97959,
    "earth_period_days": 365.256363004,
    "epoch_jd": 2446452.02019,
    "epoch_date": "1986-01-21",
    "last_date": "1995-06-13",
    "baseline_days": 3429.720650000032,
    "max_observation_gap_days": 582.4801100003533
  },
  "models": {
    "simple_circle": {
      "parameters": [
        3.582727554265782
      ],
      "stats": {
        "mae_deg": 28.981733383313003,
        "rms_deg": 31.885846472435112,
        "max_abs_deg": 53.84818542699854
      }
    },
    "epicycle_only": {
      "parameters": [
        3.6595394592259227,
        0.6314475843838301,
        5.214005991521774
      ],
      "stats": {
        "mae_deg": 9.403654749939443,
        "rms_deg": 11.955171537102673,
        "max_abs_deg": 32.40719155004787
      }
    },
    "epicycle_eccentric": {
      "parameters": [
        0.1732961410585377,
        2.6588965305136862,
        3.596898787511377,
        0.6341636437652844,
        5.228611524305719
      ],
      "stats": {
        "mae_deg": 3.0813709283078925,
        "rms_deg": 3.484309922899709,
        "max_abs_deg": 5.8713269206068635
      }
    },
    "equant": {
      "parameters": [
        0.10024351948308095,
        2.6420320629841405,
        3.601539060216845,
        0.6576746462800555,
        5.246567181490606
      ],
      "stats": {
        "mae_deg": 0.3398685906886315,
        "rms_deg": 0.41406216948609176,
        "max_abs_deg": 1.0307066776190499
      }
    }
  }
};

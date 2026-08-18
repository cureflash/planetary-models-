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
        3.5827275542602104
      ],
      "stats": {
        "mae_deg": 28.981733383281746,
        "rms_deg": 31.885846472435112,
        "max_abs_deg": 53.848185427317915
      }
    },
    "epicycle_only": {
      "parameters": [
        3.659539459053256,
        0.6314475843164793,
        5.214005991188239
      ],
      "stats": {
        "mae_deg": 9.403654750594029,
        "rms_deg": 11.955171537102617,
        "max_abs_deg": 32.407191552346774
      }
    },
    "epicycle_eccentric": {
      "parameters": [
        0.17329614106330962,
        2.6588965309013757,
        3.596898787564287,
        0.6341636437739864,
        5.228611524356865
      ],
      "stats": {
        "mae_deg": 3.08137092861493,
        "rms_deg": 3.484309922899733,
        "max_abs_deg": 5.871326911856496
      }
    },
    "equant": {
      "parameters": [
        0.1002435194832427,
        2.6420320629710563,
        3.601539060215575,
        0.6576746462793757,
        5.246567181490119
      ],
      "stats": {
        "mae_deg": 0.33986859069769015,
        "rms_deg": 0.414062169486086,
        "max_abs_deg": 1.0307066773089053
      }
    }
  }
};

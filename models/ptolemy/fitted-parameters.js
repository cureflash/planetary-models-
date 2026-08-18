// Auto-generated from Tokyo PMC88 Mars observations by tools/fit_ptolemy_models.py.
export const PTOLEMY_FIT = {
  "source": {
    "catalog": "Tokyo Photoelectric Meridian Circle Catalog 1988",
    "catalog_id": "CDS I/188",
    "table": "planets",
    "target": "Mars",
    "observations_total": 79,
    "observations_used": 79,
    "coordinate": "observed geocentric apparent RA/Dec of date, converted to ecliptic longitude for model comparison",
    "time_scale": "UT1"
  },
  "constants": {
    "mars_period_days": 686.97959,
    "earth_period_days": 365.256363004,
    "epoch_jd": 2446455.41512,
    "epoch_date": "1986-01-24",
    "last_date": "1988-12-30",
    "baseline_days": 1070.4713360001333
  },
  "models": {
    "simple_circle": {
      "parameters": [
        3.322732188255475
      ],
      "stats": {
        "mae_deg": 20.298491437154187,
        "rms_deg": 24.63836796883467,
        "max_abs_deg": 47.48880657005855
      }
    },
    "epicycle_only": {
      "parameters": [
        3.6012595479930574,
        0.5432377697149513,
        5.4470000349298795
      ],
      "stats": {
        "mae_deg": 7.148219842822179,
        "rms_deg": 9.068501530587106,
        "max_abs_deg": 32.08900860444501
      }
    },
    "epicycle_eccentric": {
      "parameters": [
        0.16997662504129107,
        2.609421030685607,
        3.637200464923926,
        0.6193606905204713,
        5.317893015135923
      ],
      "stats": {
        "mae_deg": 1.131051090864424,
        "rms_deg": 1.3090474950434312,
        "max_abs_deg": 3.551266339441024
      }
    },
    "equant": {
      "parameters": [
        0.10021235610071409,
        2.6531820400148063,
        3.633123137510816,
        0.6594437523769817,
        5.300288055464956
      ],
      "stats": {
        "mae_deg": 0.2943515206808929,
        "rms_deg": 0.3480025854873021,
        "max_abs_deg": 1.1113570385831744
      }
    }
  }
};

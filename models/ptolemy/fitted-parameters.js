// Auto-generated from Carlsberg Mars observations by tools/fit_ptolemy_models.py.
export const PTOLEMY_FIT = {
  "source": {
    "catalog": "Carlsberg Meridian Catalog individual planet-observation tables",
    "volumes": [
      "Tokyo PMC88 Part III"
    ],
    "target": "Mars (CMC code 99040)",
    "observations_total": 79,
    "observations_used": 79,
    "filter": "exclude quality_flag='*' (high internal mean error)",
    "coordinate": "apparent geocentric RA/Dec of date, converted to ecliptic longitude for model comparison"
  },
  "constants": {
    "mars_period_days": 686.97959,
    "earth_period_days": 365.256363004,
    "epoch_jd": 2446455.41512,
    "epoch_date": "1986-01-24",
    "last_date": "1988-12-30"
  },
  "models": {
    "simple_circle": {
      "parameters": [
        3.3227321880741174
      ],
      "stats": {
        "mae_deg": 20.29849143281362,
        "rms_deg": 24.638367968834665,
        "max_abs_deg": 47.48880658044955
      }
    },
    "epicycle_only": {
      "parameters": [
        3.601259547927539,
        0.5432377696179731,
        5.447000034835805
      ],
      "stats": {
        "mae_deg": 7.14821984270691,
        "rms_deg": 9.068501530587149,
        "max_abs_deg": 32.089008606035456
      }
    },
    "epicycle_eccentric": {
      "parameters": [
        0.1699766250364917,
        2.6094210293325277,
        3.63720046466645,
        0.6193606905152955,
        5.317893015010413
      ],
      "stats": {
        "mae_deg": 1.131051090361836,
        "rms_deg": 1.3090474950434337,
        "max_abs_deg": 3.551266340993593
      }
    },
    "equant": {
      "parameters": [
        0.10021235610634796,
        2.6531820425437456,
        3.633123137818971,
        0.6594437523238343,
        5.30028805536442
      ],
      "stats": {
        "mae_deg": 0.2943515217521447,
        "rms_deg": 0.3480025854872859,
        "max_abs_deg": 1.1113570365345917
      }
    }
  }
};

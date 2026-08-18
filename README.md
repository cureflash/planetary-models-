# Planetary Models

A static educational website for comparing historical planetary models against a shared Mars reference dataset.

## Repository layout

```text
planetary-models/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  └─ app.js
├─ data/
│  ├─ mars_reference_2020_2030.csv
│  └─ fitted_model_parameters.json
├─ models/
│  ├─ ptolemy/
│  │  ├─ 01-simple-circle.js
│  │  ├─ 02-eccentric.js
│  │  ├─ 03-epicycle.js
│  │  └─ 04-equant.js
│  ├─ tycho/
│  ├─ copernicus/
│  └─ kepler/
└─ tools/
   ├─ generate_reference.py
   └─ fit_models.py
```

The four Ptolemaic stages are independent JavaScript programs. `js/app.js` does not turn individual Ptolemaic features on and off; it loads a different model program when the left/right control is used.

## Implemented now

Ptolemy / Mars:

1. Earth-centered uniform circle
2. Eccentric deferent
3. Eccentric deferent + epicycle
4. Eccentric deferent + epicycle + equant

Tycho, Copernicus, and Kepler have dedicated directories reserved so they can be added without mixing their calculations with the Ptolemaic programs.

## Mars reference data

`data/mars_reference_2020_2030.csv` contains daily positions from 2020-01-01 through 2030-01-01. It is generated from JPL Solar System Dynamics' approximate planetary-position formulae for 1800-2050.

Source: https://ssd.jpl.nasa.gov/planets/approx_pos.html

JPL recommends Horizons for high-precision ephemerides. The static dataset here is intended to keep the educational site reproducible and usable on GitHub Pages without an external API.

## Run locally

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## Rebuild the data

```bash
python tools/generate_reference.py
python tools/fit_models.py
```

`fit_models.py` requires NumPy and SciPy. The website itself has no Python runtime dependency.

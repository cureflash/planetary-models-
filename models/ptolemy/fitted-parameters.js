import { W2J00_FIT } from './fitted-parameters-w2j00.js';
import { JPL_FIT } from './fitted-parameters-jpl.js';

function selectedFit() {
  const mode = typeof window !== 'undefined' ? window.__PTOLEMY_FIT_MODE__ : 'w2j00';
  return mode === 'jpl' ? JPL_FIT : W2J00_FIT;
}

export const PTOLEMY_FIT = new Proxy({}, {
  get(_target, property) {
    return selectedFit()[property];
  },
});

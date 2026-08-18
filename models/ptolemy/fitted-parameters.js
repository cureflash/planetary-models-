import { W2J00_FIT } from './fitted-parameters-w2j00.js';
import { JPL_FIT } from './fitted-parameters-jpl.js';

const dataset = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('dataset')
  : 'w2j00';

export const PTOLEMY_FIT = dataset === 'jpl' ? JPL_FIT : W2J00_FIT;

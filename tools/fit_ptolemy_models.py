from __future__ import annotations
import csv, json
from pathlib import Path
import numpy as np
from scipy.optimize import differential_evolution, least_squares

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'/'mars_reference_2020_2030.csv'
OUT=ROOT/'data'/'ptolemy_mars_fitted_parameters.json'
MARS_PERIOD=686.97959
EARTH_PERIOD=365.256363004
WM=2*np.pi/MARS_PERIOD
WE=2*np.pi/EARTH_PERIOD

rows=list(csv.DictReader(DATA.open(encoding='utf-8')))
jd=np.array([float(r['jd']) for r in rows])
obs=np.deg2rad(np.array([float(r['geo_lon_deg']) for r in rows]))
t=jd-jd[0]
idx=np.arange(0,len(t),3)
tf=t[idx]; of=obs[idx]

def wrap(x): return np.arctan2(np.sin(x),np.cos(x))
def lon(z): return np.arctan2(z.imag,z.real)

def pred1(tt,p):
    return wrap(WM*tt+p[0])

def pred2(tt,p):
    phase_m,r,phase_e=p
    d=np.exp(1j*(WM*tt+phase_m))
    return lon(d+r*np.exp(1j*(WE*tt+phase_e)))

def pred3(tt,p):
    ecc,apsis,phase_m,r,phase_e=p
    c=ecc*np.exp(1j*apsis)
    d=c+np.exp(1j*(WM*tt+phase_m))
    return lon(d+r*np.exp(1j*(WE*tt+phase_e)))

def equant_center(tt,ecc,apsis,phase_m):
    c=ecc*np.exp(1j*apsis)
    q=2*c
    alpha=WM*tt+phase_m
    u=np.exp(1j*alpha)
    cu=(c.real*u.real+c.imag*u.imag)
    cc=(c.real*c.real+c.imag*c.imag)
    disc=np.maximum(cu*cu + 1-cc, 0)
    s=-cu+np.sqrt(disc)
    return q+s*u

def pred4(tt,p):
    ecc,apsis,phase_m,r,phase_e=p
    d=equant_center(tt,ecc,apsis,phase_m)
    return lon(d+r*np.exp(1j*(WE*tt+phase_e)))

models=[
 ('simple_circle',pred1,[(0,2*np.pi)]),
 ('epicycle_only',pred2,[(0,2*np.pi),(0.35,0.9),(0,2*np.pi)]),
 ('epicycle_eccentric',pred3,[(0,0.35),(0,2*np.pi),(0,2*np.pi),(0.35,0.9),(0,2*np.pi)]),
 ('equant',pred4,[(0,0.35),(0,2*np.pi),(0,2*np.pi),(0.35,0.9),(0,2*np.pi)]),
]
result={
 'constants': {'mars_period_days':MARS_PERIOD,'earth_period_days':EARTH_PERIOD,'epoch_jd':float(jd[0]),'epoch_date':rows[0]['date']},
 'models':{}
}
for name,fn,bounds in models:
    def residual(p,tt=tf,oo=of): return wrap(fn(tt,p)-oo)
    def objective(p):
        r=residual(p)
        return float(np.mean(r*r))
    de=differential_evolution(objective,bounds,tol=1e-9,popsize=15,maxiter=700,seed=42,polish=True,workers=1)
    ls=least_squares(lambda p: residual(p),de.x,bounds=(np.array([b[0] for b in bounds]),np.array([b[1] for b in bounds])),max_nfev=5000)
    p=ls.x
    allerr=np.rad2deg(wrap(fn(t,p)-obs))
    stats={
      'mae_deg':float(np.mean(np.abs(allerr))),
      'rms_deg':float(np.sqrt(np.mean(allerr**2))),
      'max_abs_deg':float(np.max(np.abs(allerr))),
    }
    result['models'][name]={'parameters':[float(x) for x in p], 'stats':stats}
    print(name,p,stats)
OUT.write_text(json.dumps(result,indent=2),encoding='utf-8')
print('wrote',OUT)

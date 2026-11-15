// JPL approximate elements, Table 1 (1800–2050). Earth uses EM barycenter.
// https://ssd.jpl.nasa.gov/planets/approx_pos.html
const elements = {
  "mercury": [
    [
      0.38709927,
      0.20563593,
      7.00497902,
      252.2503235,
      77.45779628,
      48.33076593
    ],
    [
      3.7e-07,
      1.906e-05,
      -0.00594749,
      149472.67411175,
      0.16047689,
      -0.12534081
    ]
  ],
  "venus": [
    [
      0.72333566,
      0.00677672,
      3.39467605,
      181.9790995,
      131.60246718,
      76.67984255
    ],
    [
      3.9e-06,
      -4.107e-05,
      -0.0007889,
      58517.81538729,
      0.00268329,
      -0.27769418
    ]
  ],
  "earth": [
    [
      1.00000261,
      0.01671123,
      -1.531e-05,
      100.46457166,
      102.93768193,
      0.0
    ],
    [
      5.62e-06,
      -4.392e-05,
      -0.01294668,
      35999.37244981,
      0.32327364,
      0.0
    ]
  ],
  "mars": [
    [
      1.52371034,
      0.0933941,
      1.84969142,
      -4.55343205,
      -23.94362959,
      49.55953891
    ],
    [
      1.847e-05,
      7.882e-05,
      -0.00813131,
      19140.30268499,
      0.44441088,
      -0.29257343
    ]
  ],
  "jupiter": [
    [
      5.202887,
      0.04838624,
      1.30439695,
      34.39644051,
      14.72847983,
      100.47390909
    ],
    [
      -0.00011607,
      -0.00013253,
      -0.00183714,
      3034.74612775,
      0.21252668,
      0.20469106
    ]
  ],
  "saturn": [
    [
      9.53667594,
      0.05386179,
      2.48599187,
      49.95424423,
      92.59887831,
      113.66242448
    ],
    [
      -0.0012506,
      -0.00050991,
      0.00193609,
      1222.49362201,
      -0.41897216,
      -0.28867794
    ]
  ],
  "uranus": [
    [
      19.18916464,
      0.04725744,
      0.77263783,
      313.23810451,
      170.9542763,
      74.01692503
    ],
    [
      -0.00196176,
      -4.397e-05,
      -0.00242939,
      428.48202785,
      0.40805281,
      0.04240589
    ]
  ],
  "neptune": [
    [
      30.06992276,
      0.00859048,
      1.77004347,
      -55.12002969,
      44.96476227,
      131.78422574
    ],
    [
      0.00026291,
      5.105e-05,
      0.00035372,
      218.45945325,
      -0.32241464,
      -0.00508664
    ]
  ]
};
const radians = Math.PI / 180;
export function orbitPosition(id, days, target, eccentricAnomaly) {
  const entry = elements[id];
  if (!entry || days < -73048 || days > 18263) return false;
  const [a, e, inclination, longitude, perihelion, node] = entry[0].map(
    (value, index) => value + entry[1][index] * days / 36525
  );
  const mean = ((longitude - perihelion) % 360) * radians;
  let anomaly = eccentricAnomaly ?? mean;
  if (eccentricAnomaly === undefined) {
    for (let i = 0; i < 10; i++) {
      const delta = (anomaly - e * Math.sin(anomaly) - mean) / (1 - e * Math.cos(anomaly));
      anomaly -= delta;
      if (Math.abs(delta) < 1e-12) break;
    }
  }
  const x = a * (Math.cos(anomaly) - e);
  const y = a * Math.sqrt(1 - e * e) * Math.sin(anomaly);
  const w = (perihelion - node) * radians;
  const n = node * radians;
  const inc = inclination * radians;
  const u = Math.cos(w) * x - Math.sin(w) * y;
  const v = Math.sin(w) * x + Math.cos(w) * y;
  target.set(Math.cos(n) * u - Math.sin(n) * Math.cos(inc) * v,
    Math.sin(inc) * v, -(Math.sin(n) * u + Math.cos(n) * Math.cos(inc) * v));
  return true;
}

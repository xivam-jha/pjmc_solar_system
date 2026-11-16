export const FLIGHT_SKINS = [
  { id: 'rescue', mission: 'challenge_01', name: 'Rescue Pearl', base: '#f5ede4', accent: '#ed876c', engine: '#ffb49c' },
  { id: 'engineer', mission: 'challenge_02', name: 'Engineer Blue', base: '#a7cee6', accent: '#e4eaf0', engine: '#86ecff' },
  { id: 'courier', mission: 'challenge_03', name: 'Courier Gold', base: '#edce86', accent: '#f8ebcc', engine: '#ffe5a6' },
  { id: 'seeker', mission: 'challenge_04', name: 'Signal Violet', base: '#c4b2eb', accent: '#efc5ff', engine: '#cebaff' },
  { id: 'surveyor', mission: 'challenge_05', name: 'Surveyor Copper', base: '#dbb292', accent: '#83e4d5', engine: '#9ffff0' },
  { id: 'relay', mission: 'challenge_06', name: 'Relay Emerald', base: '#9ed9c6', accent: '#f3d59d', engine: '#9dffe1' },
];

export function flightMedal({ damage = 0, mistakes = 0, retries = 0 } = {}) {
  if (retries > 0) return 'Bronze';
  if (damage === 0 && mistakes === 0) return 'Gold';
  return damage <= 40 && mistakes <= 2 ? 'Silver' : 'Bronze';
}

export function cleanFlightRecord(value) {
  if (!value || typeof value !== 'object') return null;
  const seconds = Number(value.seconds);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 86400) return null;
  const bounded = key => Math.max(0, Math.min(10000, Number.isFinite(Number(value[key])) ? Number(value[key]) : 0));
  const result = { seconds: Math.max(.1, Math.round(seconds * 10) / 10), damage: bounded('damage'), mistakes: bounded('mistakes'), retries: bounded('retries') };
  return { ...result, medal: flightMedal(result) };
}

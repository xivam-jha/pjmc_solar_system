import * as THREE from 'three';

export function bodyBounds(registry) {
  return [...registry.values()].filter(entry => entry.surfaceMesh).map(entry => ({
    center: entry.surfaceMesh.getWorldPosition(new THREE.Vector3()),
    radius: entry.body?.radiusWorld || entry.surfaceMesh.getWorldScale(new THREE.Vector3()).x,
  }));
}
export function clearOfBodies(point, registry, margin = 3) {
  return bodyBounds(registry).every(body => point.distanceTo(body.center) > body.radius + margin);
}
export function safeAboveSystem(registry) {
  const bounds = bodyBounds(registry);
  const extent = Math.max(30, ...bounds.map(b => Math.hypot(b.center.x, b.center.z) + b.radius));
  const top = Math.max(0, ...bounds.map(b => b.center.y + b.radius));
  // Above the orbital plane, with the whole system below the flight camera.
  return new THREE.Vector3(Math.min(extent * .25, 45), top + Math.min(Math.max(extent * .5, 35), 100), Math.min(extent * .3, 55));
}
export function recoverOutsideBodies(point, registry) {
  const safe = point.clone();
  const bounds = bodyBounds(registry);
  for (let pass = 0; pass < 8; pass++) {
    for (const body of bounds) {
      const away = safe.clone().sub(body.center);
      if (away.length() < body.radius + 3) {
        if (away.lengthSq() < .001) away.set(0, 1, 0);
        safe.copy(body.center).addScaledVector(away.normalize(), body.radius + 3.1);
      }
    }
    if (clearOfBodies(safe, registry, 3)) return safe;
  }
  return safeAboveSystem(registry);
}

import * as THREE from 'three';

/**
 * A single, 360-degree inscription surrounding the solar system.
 * The letters stand upright around the ecliptic, so they remain readable
 * instead of lying flat on the ground. The group is scaled by the same
 * visualization/true-scale radius as the planetary system.
 */
export class BackgroundTextRing {
  constructor(text = 'PJMC Sukhpur') {
    this.group = new THREE.Group();
    this.text = text;

    // Normalized dimensions. main.js scales the whole group with the system.
    const ringRadius = 1.26;
    const glyphHeight = 0.32;
    const fontSize = 176;
    const characters = Array.from(text);
    const total = characters.length;

    characters.forEach((character, index) => {
      // Keep spaces in the angular count so the phrase is written exactly
      // once across the complete circle rather than repeated around it.
      if (character.trim() === '') return;

      const { texture, aspect } = this.createGlyphTexture(character, fontSize);
      const width = glyphHeight * aspect;
      const theta = Math.PI / 2 - (index / total) * Math.PI * 2;
      const radial = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
      // The phrase advances in the decreasing-angle direction.
      const tangent = new THREE.Vector3(Math.sin(theta), 0, -Math.cos(theta));
      const center = radial.clone().multiplyScalar(ringRadius);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.98,
        side: THREE.FrontSide,
        depthWrite: false,
        toneMapped: false,
      });

      const outside = this.createGlyphPlane(center, tangent, width, glyphHeight, false);
      const outsideMesh = new THREE.Mesh(outside, material);
      outsideMesh.renderOrder = 2;
      this.group.add(outsideMesh);

      // Add an inward-facing counterpart with mirrored UVs. This keeps the
      // inscription legible when the camera is rotated to the other side.
      const inside = this.createGlyphPlane(center, tangent, width, glyphHeight, true);
      const insideMesh = new THREE.Mesh(inside, material);
      insideMesh.renderOrder = 2;
      this.group.add(insideMesh);
    });
  }

  createGlyphTexture(character, fontSize) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable for the background text ring.');

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.shadowColor = '#38bdf8';
    context.shadowBlur = 28;
    context.strokeStyle = 'rgba(110, 220, 255, 0.92)';
    context.lineWidth = 5;
    context.strokeText(character, canvas.width / 2, canvas.height / 2 + 2);

    const gradient = context.createLinearGradient(0, 48, 0, 208);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.48, '#b7f3ff');
    gradient.addColorStop(1, '#53b7ff');
    context.shadowBlur = 18;
    context.fillStyle = gradient;
    context.fillText(character, canvas.width / 2, canvas.height / 2 + 2);

    const metrics = context.measureText(character);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return {
      texture,
      aspect: THREE.MathUtils.clamp(metrics.width / fontSize, 0.28, 1.15),
    };
  }

  createGlyphPlane(center, tangent, width, height, inward) {
    const up = new THREE.Vector3(0, 1, 0);
    const halfTangent = tangent.clone().multiplyScalar(width / 2);
    const halfUp = up.clone().multiplyScalar(height / 2);
    const bottomLeft = center.clone().sub(halfTangent).sub(halfUp);
    const bottomRight = center.clone().add(halfTangent).sub(halfUp);
    const topRight = center.clone().add(halfTangent).add(halfUp);
    const topLeft = center.clone().sub(halfTangent).add(halfUp);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      ...bottomLeft.toArray(),
      ...bottomRight.toArray(),
      ...topRight.toArray(),
      ...topLeft.toArray(),
    ], 3));

    // Reverse U for the inward face so the letters are not mirrored from
    // inside the circle. V remains bottom-to-top for both faces.
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(
      inward
        ? [1, 0, 0, 0, 0, 1, 1, 1]
        : [0, 0, 1, 0, 1, 1, 0, 1],
      2,
    ));
    geometry.setIndex(inward ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    return geometry;
  }
}

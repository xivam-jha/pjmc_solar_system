import * as THREE from 'three';

const ORIGIN = new THREE.Vector3();
const SAMPLE_NAMES = ['C · Carbon-rich', 'S · Stony', 'M · Metallic'];

/** Six small objective systems, all using the existing flight controls.
 * Positions are local to the safe overhead launch point, above planetary traffic.
 * Time advances only when ExplorerGame is flying. No per-object lights or downloads.
 */
export class ChallengeManager {
  constructor(scene, random = Math.random) {
    this.scene = scene;
    this.random = random;
    this.group = new THREE.Group();
    this.group.name = 'PJMC_Challenge_Arena';
    scene.add(this.group);
    this.resources = new Set();
    this.clear();
  }

  own(resource) { this.resources.add(resource); return resource; }

  clear() {
    this.group.clear();
    for (const resource of this.resources) resource.dispose();
    this.resources.clear();
    this.group.visible = false;
    this.mission = null;
    this.phase = 'idle';
    this.targets = [];
    this.hazards = [];
    this.links = [];
    this.previousPosition = null;
    this.beaconPrevious = null;
  }

  material(color, glow = 0) {
    return this.own(new THREE.MeshStandardMaterial({
      color, roughness: .62, metalness: .22, emissive: color, emissiveIntensity: glow,
    }));
  }

  mesh(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh);
    return mesh;
  }

  start(mission, startPosition) {
    this.clear();
    this.mission = mission;
    this.phase = 'active';
    this.group.visible = true;
    this.origin = startPosition.clone();
    this.stage = 0;
    this.elapsedSeconds = 0;
    this.timeLeft = mission.kind === 'rescue' ? 180 : null;
    this.health = 100;
    this.cargo = 100;
    this.hold = 0;
    this.invulnerable = 0;
    this.impactTime = 0;
    this.hintRemaining = 0;
    this.hintCooldown = 0;
    this.signal = 0;
    this.signalTrend = 'आगे बढ़कर signal खोजें';
    this.previousSignalDistance = null;
    this.signalSampleAt = 0;
    this.inRange = false;
    this.stable = false;
    this.stressed = false;
    this.failureReason = '';
    this.relayMessage = '';
    this.previousPosition = startPosition.clone();

    this.box = this.own(new THREE.BoxGeometry(1, 1, 1));
    this.sphere = this.own(new THREE.SphereGeometry(1, 16, 10));
    this.cylinder = this.own(new THREE.CylinderGeometry(1, 1, 1, 16));
    this.ring = this.own(new THREE.TorusGeometry(1.8, .045, 6, 36));
    this.rock = this.own(new THREE.IcosahedronGeometry(1, 2));
    const vertices = this.rock.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
      const r = .9 + .13 * Math.sin(x * 9 + z * 5) * Math.cos(y * 8 - z * 3);
      vertices.setXYZ(i, x * r, y * r, z * r);
    }
    this.rock.computeVertexNormals();
    this.pearl = this.material(0xe1e8eb, .28);
    this.gold = this.material(0xe5bf72, .4);
    this.blue = this.material(0x315579, .28);
    this.dark = this.material(0x5e5148, .18);
    this.cyan = this.own(new THREE.MeshBasicMaterial({ color: 0x87e7dd }));
    this.markerMaterial = this.own(new THREE.MeshBasicMaterial({ color: 0xe7ce91 }));
    this.buildObjectives();
    this.buildHazards();
    this.refreshTargets();
    return this.getLaunchTarget();
  }

  addTarget(kind, offset, label, duration = 1.5) {
    const root = new THREE.Group();
    root.position.copy(this.origin).add(new THREE.Vector3(...offset));
    root.name = `PJMC_${kind}_${this.targets.length + 1}`;
    const model = new THREE.Group(); root.add(model);
    const marker = this.mesh(root, this.ring, this.markerMaterial);
    const target = { kind, label, duration, root, model, marker, position: root.position, done: false };
    this.targets.push(target); this.group.add(root);
    if (kind === 'capsule') {
      this.mesh(model, this.cylinder, this.pearl, [0, 0, 0], [.45, 1.4, .45]);
      this.mesh(model, this.sphere, this.blue, [0, .58, 0], [.46, .36, .46]);
      this.mesh(model, this.box, this.gold, [0, -.3, -.46], [.6, .17, .05]);
      this.mesh(model, this.box, this.cyan, [0, .18, -.46], [.27, .34, .03]);
    } else if (kind === 'part') {
      this.mesh(model, this.box, this.gold, [0, 0, 0], [.8, .7, .6]);
      for (const x of [-.26, .26]) this.mesh(model, this.box, this.pearl, [x, 0, -.32], [.08, .8, .07]);
    } else if (kind === 'sample') {
      const colors = [0x625d55, 0xb78a63, 0x93abb8];
      const rockMat = this.material(colors[this.targets.length - 1], .24);
      this.mesh(model, this.rock, rockMat, [0, 0, 0], [1.15, .95, 1.05]);
      this.addLabel(root, ['C', 'S', 'M'][this.targets.length - 1]);
    } else if (kind === 'satellite' || kind === 'relay' || kind === 'probe') {
      this.mesh(model, this.box, this.pearl, [0, 0, 0], [.85, .85, .9]);
      for (const x of [-1.5, 1.5]) {
        this.mesh(model, this.box, this.blue, [x, 0, 0], [1.7, .12, 1.3]);
        for (const z of [-.5, 0, .5]) this.mesh(model, this.box, this.gold, [x, .07, z], [1.7, .015, .025]);
      }
      const dish = this.own(new THREE.SphereGeometry(.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2));
      this.mesh(model, dish, this.gold, [0, .45, 0]).rotation.x = -Math.PI / 2;
      target.antenna = new THREE.Group(); model.add(target.antenna);
      this.mesh(target.antenna, this.box, this.cyan, [0, .65, -.6], [.07, 1.3, .06]);
      if (kind === 'relay') {
        target.angle = 0;
        target.goalAngle = (1 + Math.floor(this.random() * 7)) * 45;
        this.addLabel(root, `R${this.targets.length}`);
      }
    } else if (kind === 'station') {
      this.mesh(model, this.cylinder, this.pearl, [0, 0, 0], [1.2, 2.7, 1.2]).rotation.z = Math.PI / 2;
      for (const x of [-3, 3]) this.mesh(model, this.box, this.blue, [x, 0, 0], [2.5, .13, 3]);
      this.mesh(model, this.ring, this.cyan, [0, 0, -1.5], [.6, .6, .6]);
      this.addLabel(root, this.mission.kind === 'cargo' ? 'LUNAR TRANSFER' : 'RESCUE');
      marker.scale.setScalar(1.6);
    } else if (kind === 'beacon') {
      marker.scale.setScalar(1.8);
      this.mesh(model, this.ring, this.cyan, [0, 0, 0], [1.6, 1.6, 1.6]);
    }
    return target;
  }

  addLabel(root, label) {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#f4e1b3'; ctx.font = 'bold 27px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, 128, 42);
    const texture = this.own(new THREE.CanvasTexture(canvas)); texture.colorSpace = THREE.SRGBColorSpace;
    const material = this.own(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
    const sprite = new THREE.Sprite(material); sprite.position.y = 2.6; sprite.scale.set(3.5, .875, 1); root.add(sprite);
  }

  buildObjectives() {
    switch (this.mission.kind) {
      case 'rescue':
        [[0, 0, 13], [7, 1, 26], [-5, 0, 39]].forEach((p, i) => this.addTarget('capsule', p, `Rescue capsule ${i + 1}/3`));
        this.addTarget('station', [0, 1, 53], 'Return to rescue station', 2.5);
        break;
      case 'repair':
        [[0, 0, 12], [-6, 2, 24], [6, 0, 35]].forEach((p, i) => this.addTarget('part', p, `Collect spare part ${i + 1}/3`, 1));
        this.addTarget('satellite', [0, 1, 49], 'Repair the satellite', 6);
        break;
      case 'cargo':
        this.addTarget('beacon', [-5, 0, 18], 'Cargo route · beacon 1/2', 0);
        this.addTarget('beacon', [7, 1, 36], 'Cargo route · beacon 2/2', 0);
        this.addTarget('station', [0, 0, 54], 'Deliver science cargo', 3);
        break;
      case 'signal': {
        this.addTarget('probe', [(this.random() - .5) * 36, (this.random() - .5) * 10, 22 + this.random() * 18], 'Recover probe data', 3);
        const boundary = this.mesh(this.group, this.ring, this.blue);
        boundary.position.copy(this.origin).add(new THREE.Vector3(0, 0, 30));
        boundary.rotation.x = Math.PI / 2; boundary.scale.setScalar(12);
        break;
      }
      case 'sample':
        [[0, 0, 14], [-9, 1, 29], [9, -1, 42]].forEach((p, i) => this.addTarget('sample', p, `Scan ${SAMPLE_NAMES[i]}`, 3));
        break;
      case 'relay': {
        [[0, 0, 16], [10, 2, 32], [-6, 0, 48]].forEach((p, i) => this.addTarget('relay', p, `Align relay ${i + 1}/3`, 0));
        const earth = this.mesh(this.group, this.sphere, this.blue, [0, 0, 0], [1.6, 1.6, 1.6]);
        earth.position.copy(this.origin).add(new THREE.Vector3(0, 0, 62));
        this.addLabel(earth, 'EARTH LINK');
        this.targets.forEach((target, i) => {
          const destination = this.targets[i + 1]?.position || earth.position;
          const geometry = this.own(new THREE.BufferGeometry().setFromPoints([target.position, destination]));
          const material = this.own(new THREE.LineDashedMaterial({ color: 0x6c808e, dashSize: .7, gapSize: .6, transparent: true, opacity: .6 }));
          const line = new THREE.Line(geometry, material); line.computeLineDistances(); this.group.add(line);
          this.links.push(line);
        });
        break;
      }
      default: throw new Error(`Unknown challenge kind: ${this.mission.kind}`);
    }
  }

  buildHazards() {
    if (!['rescue', 'repair', 'cargo', 'sample'].includes(this.mission.kind)) return;
    const count = this.mission.kind === 'sample' ? 9 : 5;
    for (let i = 0; i < count; i++) {
      const base = this.origin.clone().add(new THREE.Vector3((i % 3 - 1) * 6, (i % 2 ? 1 : -1) * 1.5, 7 + i * 4.5));
      // Keep docking areas clear; difficulty comes from the routes between them.
      for (const target of this.targets) if (base.distanceTo(target.position) < 6) base.y += 6;
      const radius = .5 + (i % 3) * .2;
      const mesh = this.mesh(this.group, this.rock, this.dark, base.toArray(), [radius, radius * .8, radius]);
      mesh.name = 'Moving debris';
      this.hazards.push({ mesh, base, radius, previous: base.clone(), offset: i * 1.7 });
    }
  }

  get currentTarget() { return this.targets[this.stage]; }
  get active() { return this.phase === 'active'; }

  getLaunchTarget() {
    return this.mission.kind === 'signal' ? this.origin.clone().add(new THREE.Vector3(0, 0, 30)) : this.targets[0].position.clone();
  }

  getNavigationTarget(out, forSpeedAssist = false) {
    if (!this.active || !this.currentTarget) return false;
    if (this.mission.kind === 'signal' && !forSpeedAssist && this.hintRemaining <= 0 && this.signal < 82) return false;
    out.copy(this.currentTarget.position); return true;
  }

  hint() {
    if (!this.active || this.mission.kind !== 'signal' || this.hintCooldown > 0) return false;
    this.hintRemaining = 8; this.hintCooldown = 14; return true;
  }

  rotateRelay(direction) {
    if (!this.active || this.mission.kind !== 'relay' || !this.inRange || !this.stable) return false;
    if (direction !== 1 && direction !== -1) return false;
    const target = this.currentTarget;
    target.angle = (target.angle + direction * 45 + 360) % 360;
    target.antenna.rotation.z = -THREE.MathUtils.degToRad(target.angle);
    this.relayMessage = ''; return true;
  }

  linkRelay() {
    if (!this.active || this.mission.kind !== 'relay' || !this.inRange || !this.stable) return false;
    if (this.currentTarget.angle !== this.currentTarget.goalAngle) {
      this.relayMessage = 'Gold target से दिशा मिलाएँ, फिर Link दबाएँ।'; return false;
    }
    const line = this.links[this.stage];
    line.material.color.setHex(0xb7ffe7); line.material.gapSize = 0; line.material.opacity = 1;
    this.finishObjective(); return true;
  }

  refreshTargets() {
    this.targets.forEach((target, i) => {
      target.marker.visible = i === this.stage;
      if (target.done && ['capsule', 'part', 'beacon'].includes(target.kind)) target.root.visible = false;
    });
  }

  finishObjective() {
    if (!this.active || !this.currentTarget) return;
    this.currentTarget.done = true;
    this.stage++;
    this.hold = 0;
    this.inRange = false;
    this.stable = false;
    this.relayMessage = '';
    this.refreshTargets();
    if (this.stage === this.targets.length) this.phase = 'complete';
    this.onObjective?.(this.stage, this.targets.length);
  }

  fail(reason) { this.phase = 'failed'; this.failureReason = reason; this.hold = 0; }

  hit(damage = 20) {
    if (!this.active || this.invulnerable > 0) return false;
    this.invulnerable = 1.8; this.impactTime = .35; this.hold = 0;
    if (this.mission.kind === 'cargo') {
      this.cargo = Math.max(0, this.cargo - damage);
      if (this.cargo <= 0) this.fail('Cargo टूट गया। मोड़ पर speed कम रखें और मलबे से दूरी बनाएँ।');
    } else {
      this.health = Math.max(0, this.health - damage);
      if (this.health <= 0) this.fail('Hull health खत्म हुई। अगली उड़ान में मलबे के चारों ओर से जाएँ।');
    }
    this.onDamage?.(); return true;
  }

  resetMotion(position) { this.previousPosition = position.clone(); this.beaconPrevious = position.clone(); }

  update(dt, { position, speed = 0, turnRate = 0 }) {
    if (!this.active) return;
    dt = Math.min(.1, Math.max(0, dt));
    if (!dt) return;
    this.elapsedSeconds += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.impactTime = Math.max(0, this.impactTime - dt);
    this.hintRemaining = Math.max(0, this.hintRemaining - dt);
    this.hintCooldown = Math.max(0, this.hintCooldown - dt);
    if (this.timeLeft !== null) {
      this.timeLeft = Math.max(0, 180 - this.elapsedSeconds);
      if (!this.timeLeft) { this.fail('Rescue time खत्म हुआ। Capsules के पास BRAKE लगाएँ, फिर station लौटें।'); return; }
    }

    for (const hazard of this.hazards) {
      hazard.previous.copy(hazard.mesh.position);
      hazard.mesh.position.copy(hazard.base);
      hazard.mesh.position.x += Math.sin(this.elapsedSeconds * .7 + hazard.offset) * 2;
      hazard.mesh.position.y += Math.sin(this.elapsedSeconds * .5 + hazard.offset) * .7;
      hazard.mesh.rotation.x += dt * .3; hazard.mesh.rotation.y += dt * .4;
      const from = hazard.previous.clone().sub(this.previousPosition || position);
      const to = hazard.mesh.position.clone().sub(position);
      const closest = new THREE.Line3(from, to).closestPointToPoint(ORIGIN, true, new THREE.Vector3());
      if (closest.length() < hazard.radius + .6) this.hit(20);
    }
    this.previousPosition = position.clone();
    if (!this.active) return;

    this.stressed = this.mission.kind === 'cargo' && speed > 5 && Math.abs(turnRate) > .95;
    if (this.stressed) {
      this.cargo = Math.max(0, this.cargo - dt * 8 * Math.min(2, Math.abs(turnRate)));
      if (!this.cargo) { this.fail('तेज़ मोड़ों से cargo टूट गया। मोड़ने से पहले BRAKE लगाएँ।'); return; }
    }

    const target = this.currentTarget;
    const distance = position.distanceTo(target.position);
    this.distance = distance;
    this.inRange = distance < (target.kind === 'beacon' ? 3.8 : 3.4);
    this.stable = speed <= 1.8 && Math.abs(turnRate) < .45;
    target.marker.rotation.z += dt * .15;
    if (target.kind === 'sample') target.model.rotation.y += dt * .12;

    if (this.mission.kind === 'signal') {
      this.signal = Math.round(THREE.MathUtils.clamp(1 - distance / 65, 0, 1) * 100);
      target.root.visible = distance < 10 || this.hintRemaining > 0;
      if (this.elapsedSeconds >= this.signalSampleAt) {
        if (this.previousSignalDistance !== null) {
          const delta = this.previousSignalDistance - distance;
          this.signalTrend = delta > .25 ? 'Signal बढ़ रहा है ↗' : delta < -.25 ? 'Signal घट रहा है ↘' : 'दिशा बदलकर signal जाँचें';
        }
        this.previousSignalDistance = distance; this.signalSampleAt = this.elapsedSeconds + .6;
      }
    }
    if (target.kind === 'relay') return; // Explicit contextual dial controls; no automatic completion.
    if (target.kind === 'beacon') {
      const start = this.beaconPrevious || position;
      const closest = new THREE.Line3(start, position).closestPointToPoint(target.position, true, new THREE.Vector3());
      this.beaconPrevious = position.clone();
      if (closest.distanceTo(target.position) < 3.8) this.finishObjective();
      return;
    }
    this.beaconPrevious = position.clone();
    if (this.inRange && this.stable && this.impactTime === 0) this.hold += dt;
    else this.hold = Math.max(0, this.hold - dt * 2);
    if (this.hold >= target.duration - 1e-6) this.finishObjective();
  }

  view() {
    const target = this.currentTarget;
    let instruction = this.inRange ? (this.stable ? 'Hold steady · काम अपने आप हो रहा है' : 'BRAKE लगाएँ और joystick छोड़ें') : 'Marker की ओर उड़ें · पास पहुँचकर BRAKE लगाएँ';
    if (this.mission?.kind === 'signal' && !this.inRange) instruction = this.signalTrend;
    if (this.stressed) instruction = 'Cargo stress! मोड़ने से पहले speed कम करें';
    if (target?.kind === 'beacon') instruction = 'Route beacon के बीच से जाएँ · cargo सुरक्षित रखें';
    if (target?.kind === 'relay' && this.inRange && this.stable) instruction = this.relayMessage || 'Cyan needle को gold target से मिलाएँ';
    const kind = this.mission?.kind;
    return {
      visible: this.phase === 'active', title: target?.label || 'Challenge complete',
      step: `${Math.min(this.stage + 1, this.targets.length)}/${this.targets.length}`,
      instruction, timeLeft: this.timeLeft, progress: target?.duration ? Math.min(100, this.hold / target.duration * 100) : 0,
      meterLabel: kind === 'signal' ? 'SIGNAL' : kind === 'cargo' ? 'CARGO' : 'HULL',
      meter: Math.ceil(kind === 'signal' ? this.signal : kind === 'cargo' ? this.cargo : this.health),
      showMeter: kind !== 'relay', hint: kind === 'signal', hintCooldown: Math.ceil(this.hintCooldown),
      relay: kind === 'relay' && this.inRange && this.stable,
      angle: target?.angle || 0, goalAngle: target?.goalAngle || 0,
    };
  }

  dispose() { this.clear(); this.scene.remove(this.group); }
}

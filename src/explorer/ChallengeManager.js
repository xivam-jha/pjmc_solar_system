import * as THREE from 'three';

const ORIGIN = new THREE.Vector3();
const SAMPLES = [
  { type: 'C', fact: 'काली, carbon-rich चट्टान · clay और silicate minerals।' },
  { type: 'S', fact: 'Stony sample · silicate के साथ nickel-iron।' },
  { type: 'M', fact: 'धातु का संकेत · nickel और iron।' },
];
export function reflectedBeam(incoming, angle) {
  const radians = THREE.MathUtils.degToRad(angle);
  const normal = new THREE.Vector3(Math.cos(radians), 0, -Math.sin(radians));
  return incoming.clone().reflect(normal).normalize();
}

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
    this.checkpoint = null;
    this.frame = null;
    this.carryGroup = null;
    this.selectedRescue = null;
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
    this.rescueLimit = 180;
    this.timeLeft = mission.kind === 'rescue' ? this.rescueLimit : null;
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
    this.retries = 0; this.damageTaken = 0; this.mistakes = 0;
    this.sampleMessage = ''; this.warning = ''; this.warningTime = 0;
    this.bestSignal = 0; this.stalledTime = 0; this.autoHintCooldown = 0; this.beepClock = 0;

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
    this.carryGroup = new THREE.Group(); this.group.add(this.carryGroup);
    this.carryPods = [];
    if (mission.kind === 'rescue') {
      for (let i = 0; i < 3; i++) {
        const pod = this.targets[i].model.clone(true); pod.scale.setScalar(.35);
        pod.position.set(i === 0 ? -.6 : i === 1 ? .6 : 0, -.38, i === 2 ? .4 : -.2);
        pod.visible = false; this.carryGroup.add(pod); this.carryPods.push(pod);
      }
    }
    this.scanMaterial = this.own(new THREE.MeshBasicMaterial({ color: 0x8ee1d1, transparent: true, opacity: .4, depthWrite: false }));
    this.scanPulse = this.mesh(this.group, this.ring, this.scanMaterial); this.scanPulse.visible = false;
    this.frame = { position: startPosition.clone(), quaternion: new THREE.Quaternion() };
    this.refreshTargets();
    this.saveCheckpoint();
    return this.getLaunchTarget();
  }

  addTarget(kind, offset, label, duration = 1.5) {
    const root = new THREE.Group();
    root.position.copy(this.origin).add(new THREE.Vector3(...offset));
    root.name = `PJMC_${kind}_${this.targets.length + 1}`;
    const model = new THREE.Group(); root.add(model);
    const marker = this.mesh(root, this.ring, this.markerMaterial);
    const target = { kind, label, duration, root, model, marker, position: root.position, done: false };
    target.dock = ['station', 'satellite', 'relay', 'sample', 'probe'].includes(kind);
    target.solidRadius = kind === 'station' ? 4.5 : kind === 'sample' ? 1.3 : target.dock ? 2.55 : 0;
    target.dockOffset = kind === 'station' ? 6.8 : kind === 'sample' ? 3.3 : 4.5;
    target.interactionPosition = root.position.clone();
    if (target.dock) {
      target.interactionPosition.z -= target.dockOffset;
      marker.position.z = -target.dockOffset;
      marker.scale.setScalar(.8);
    }
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
      target.sample = SAMPLES[this.targets.length - 1];
      target.scanned = false;
      this.addLabel(root, `SAMPLE ${this.targets.length}`);
    } else if (kind === 'satellite' || kind === 'relay' || kind === 'probe') {
      this.mesh(model, this.box, this.pearl, [0, 0, 0], [.85, .85, .9]);
      target.panelJoints = [];
      for (const side of [-1, 1]) {
        const joint = new THREE.Group(); joint.position.x = side * .6; model.add(joint);
        this.mesh(joint, this.box, this.blue, [side * .9, 0, 0], [1.7, .12, 1.3]);
        for (const z of [-.5, 0, .5]) this.mesh(joint, this.box, this.gold, [side * .9, .07, z], [1.7, .015, .025]);
        joint.userData.brokenAngle = side * .65;
        if (kind === 'satellite') joint.rotation.z = joint.userData.brokenAngle;
        target.panelJoints.push(joint);
      }
      const dish = this.own(new THREE.SphereGeometry(.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2));
      this.mesh(model, dish, this.gold, [0, .45, 0]).rotation.x = -Math.PI / 2;
      target.antenna = new THREE.Group(); model.add(target.antenna);
      this.mesh(target.antenna, this.box, this.cyan, [0, .65, -.6], [.07, 1.3, .06]);
      if (kind === 'relay') {
        target.angle = 0;
        target.mirror = this.mesh(target.antenna, this.box, this.pearl, [0, 1.5, 0], [1.6, 1.2, .06]);
        target.mirror.rotation.y = Math.PI / 2;
        this.addLabel(root, `R${this.targets.length}`);
      }
      if (kind === 'satellite') {
        target.parts = [0, 1, 2].map(i => {
          const part = this.mesh(model, this.box, this.gold, [(i - 1) * .3, -.65, -.35], [.23, .3, .18]);
          part.visible = false; return part;
        });
        target.weld = this.mesh(model, this.sphere, this.cyan, [0, -.55, -.55], [.09, .09, .09]);
        target.weld.visible = false;
      }
    } else if (kind === 'station') {
      this.mesh(model, this.cylinder, this.pearl, [0, 0, 0], [1.2, 2.7, 1.2]).rotation.z = Math.PI / 2;
      for (const x of [-3, 3]) this.mesh(model, this.box, this.blue, [x, 0, 0], [2.5, .13, 3]);
      this.mesh(model, this.ring, this.cyan, [0, 0, -1.5], [.6, .6, .6]);
      this.addLabel(root, this.mission.kind === 'cargo' ? 'LUNAR TRANSFER' : 'RESCUE');
      marker.scale.setScalar(.8);
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
      case 'training':
        this.addTarget('beacon', [0, 0, 12], '01 · Joystick से दिशा बदलें', .3);
        this.addTarget('beacon', [0, 0, 20], '02 · SPEED + दबाकर उड़ें', .8);
        this.addTarget('beacon', [0, 0, 25], '03 · BRAKE से रुकें', .6);
        this.addTarget('capsule', [0, 0, 34], '04 · Capsule के पास रुकें', 1.5);
        this.targets.slice(0, 3).forEach(t => { t.root.visible = false; });
        break;
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
        [[0, 0, 14], [-9, 1, 29], [9, -1, 42]].forEach((p, i) => this.addTarget('sample', p, `Identify sample ${i + 1}/3`, 2.5));
        break;
      case 'relay': {
        const side = this.random() < .5 ? -1 : 1;
        [[0, 0, 16], [side * 16, 0, 16], [side * 16, 0, 32]].forEach((p, i) => this.addTarget('relay', p, `Connect relay ${i + 1}/3`, 0));
        const earth = this.mesh(this.group, this.sphere, this.blue, [0, 0, 0], [1.6, 1.6, 1.6]);
        earth.position.copy(this.origin).add(new THREE.Vector3(0, 1.5, 32));
        this.receiverPosition = earth.position.clone();
        this.addLabel(earth, 'EARTH LINK');
        const inputGeometry = this.own(new THREE.BufferGeometry().setFromPoints([this.origin.clone().add(new THREE.Vector3(0, 1.5, 0)), this.targets[0].position.clone().add(new THREE.Vector3(0, 1.5, 0))]));
        this.group.add(new THREE.Line(inputGeometry, this.own(new THREE.LineBasicMaterial({ color: 0xc4efed }))));
        this.targets.forEach((target, i) => {
          target.beamStart = target.position.clone().add(new THREE.Vector3(0, 1.5, 0));
          target.destination = this.targets[i + 1]?.position.clone().add(new THREE.Vector3(0, 1.5, 0)) || earth.position.clone();
          const previous = i ? this.targets[i - 1].position.clone().add(new THREE.Vector3(0, 1.5, 0)) : this.origin.clone().add(new THREE.Vector3(0, 1.5, 0));
          target.incoming = target.beamStart.clone().sub(previous).normalize();
          const geometry = this.own(new THREE.BufferGeometry().setFromPoints([target.beamStart, target.destination]));
          const material = this.own(new THREE.LineBasicMaterial({ color: 0xeac58a, transparent: true, opacity: .9 }));
          const line = new THREE.Line(geometry, material); this.group.add(line);
          this.links.push(line);
        });
        this.refreshBeams();
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
      for (const target of this.targets) if (base.distanceTo(target.position) < 6 || base.distanceTo(target.interactionPosition) < 6) base.y += 6;
      const radius = .5 + (i % 3) * .2;
      const mesh = this.mesh(this.group, this.rock, this.dark, base.toArray(), [radius, radius * .8, radius]);
      mesh.name = 'Moving debris';
      this.hazards.push({ mesh, base, radius, previous: base.clone(), offset: i * 1.7 });
    }
  }

  get currentTarget() {
    if (this.mission?.kind === 'rescue') {
      const remaining = this.targets.filter(t => t.kind === 'capsule' && !t.done);
      if (remaining.length) return remaining.includes(this.selectedRescue) ? this.selectedRescue : remaining[0];
      return this.targets.find(t => t.kind === 'station' && !t.done);
    }
    return this.targets[this.stage];
  }
  get active() { return this.phase === 'active'; }

  getLaunchTarget() {
    if (['signal', 'training'].includes(this.mission.kind)) return this.origin.clone().add(new THREE.Vector3(0, 0, 30));
    return this.currentTarget.interactionPosition.clone();
  }

  getNavigationTarget(out, forSpeedAssist = false) {
    if (!this.active || !this.currentTarget) return false;
    if (this.mission.kind === 'training' && this.stage < 3) return false;
    if (this.mission.kind === 'signal' && !forSpeedAssist && this.hintRemaining <= 0 && this.signal < 82) return false;
    out.copy(this.currentTarget.interactionPosition); return true;
  }

  hint() {
    if (!this.active || this.mission.kind !== 'signal' || this.hintCooldown > 0) return false;
    this.hintRemaining = 8; this.hintCooldown = 14; return true;
  }

  refreshBeams() {
    if (this.mission?.kind !== 'relay') return;
    this.targets.forEach((target, index) => {
      const outgoing = reflectedBeam(target.incoming, target.angle);
      const wanted = target.destination.clone().sub(target.beamStart);
      target.beamAligned = outgoing.dot(wanted.clone().normalize()) > .999;
      const end = target.beamStart.clone().addScaledVector(outgoing, wanted.length());
      const line = this.links[index];
      line.geometry.attributes.position.setXYZ(0, ...target.beamStart.toArray());
      line.geometry.attributes.position.setXYZ(1, ...end.toArray());
      line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere();
      line.visible = target.done || index === this.stage;
      line.material.color.setHex(target.beamAligned ? 0x9bf2c9 : 0xf0b984);
      target.mirror.rotation.y = THREE.MathUtils.degToRad(target.angle) + Math.PI / 2;
    });
  }

  rotateRelay(direction) {
    if (!this.active || this.mission.kind !== 'relay' || !this.inRange || !this.stable) return false;
    if (direction !== 1 && direction !== -1) return false;
    this.currentTarget.angle = (this.currentTarget.angle + direction * 45 + 360) % 360;
    this.relayMessage = ''; this.refreshBeams(); return true;
  }

  linkRelay() {
    if (!this.active || this.mission.kind !== 'relay' || !this.inRange || !this.stable) return false;
    this.refreshBeams();
    if (!this.currentTarget.beamAligned) {
      this.mistakes++; this.relayMessage = 'Beam अगला relay नहीं छू रही। Mirror घुमाकर रास्ता मिलाएँ।'; return false;
    }
    this.finishObjective(); return true;
  }

  classifySample(type) {
    const target = this.currentTarget;
    if (!this.active || target?.kind !== 'sample' || !target.scanned || !this.inRange || !this.stable || !['C', 'S', 'M'].includes(type)) return false;
    if (type !== target.sample.type) {
      this.mistakes++; this.sampleMessage = 'Scan की जानकारी पढ़ें और फिर पहचानें।'; return false;
    }
    this.sampleMessage = ''; this.finishObjective(); return true;
  }

  refreshTargets() {
    const current = this.currentTarget;
    this.targets.forEach((target, i) => {
      target.marker.visible = target === current || (this.mission.kind === 'rescue' && target.kind === 'capsule' && !target.done);
      target.marker.material = target === current ? this.markerMaterial : this.blue;
      if (['capsule', 'part', 'beacon'].includes(target.kind)) target.root.visible = !target.done;
      if (this.mission.kind === 'training' && i < 3) target.root.visible = false;
    });
    this.refreshBeams();
  }

  refreshRepair() {
    const satellite = this.targets.find(t => t.kind === 'satellite');
    if (!satellite) return;
    const parts = this.targets.filter(t => t.kind === 'part' && t.done).length;
    const amount = satellite.done ? 1 : this.currentTarget === satellite ? Math.min(1, this.hold / satellite.duration) : 0;
    satellite.parts.forEach((part, index) => { part.visible = index < parts; });
    satellite.panelJoints.forEach(joint => { joint.rotation.z = joint.userData.brokenAngle * (1 - amount); });
    satellite.weld.visible = amount > 0 && amount < 1 && this.active;
    satellite.weld.scale.setScalar(.08 + Math.abs(Math.sin(this.elapsedSeconds * 22)) * .06);
  }

  updatePayload() {
    if (!this.carryGroup || !this.frame) return;
    this.carryGroup.position.copy(this.frame.position); this.carryGroup.quaternion.copy(this.frame.quaternion);
    const rescued = this.targets.filter(t => t.kind === 'capsule' && t.done).length;
    this.carryPods.forEach((pod, index) => { pod.visible = index < rescued && this.phase !== 'complete'; });
  }

  saveCheckpoint() {
    this.checkpoint = {
      stage: this.stage, elapsedSeconds: this.elapsedSeconds, cargo: this.cargo,
      position: (this.frame?.position || this.origin).clone(),
      quaternion: this.frame?.quaternion.clone() || new THREE.Quaternion(),
      targets: this.targets.map(t => ({ done: t.done, scanned: t.scanned, angle: t.angle, position: t.position.clone(), interaction: t.interactionPosition.clone() })),
    };
  }

  restoreCheckpoint() {
    if (!this.checkpoint || this.phase !== 'failed') return null;
    const saved = this.checkpoint;
    this.retries++; this.phase = 'active'; this.stage = saved.stage; this.elapsedSeconds = saved.elapsedSeconds;
    this.rescueLimit = Math.max(180, this.elapsedSeconds + 60);
    this.timeLeft = this.mission.kind === 'rescue' ? this.rescueLimit - this.elapsedSeconds : null;
    this.health = 100; this.cargo = Math.max(60, saved.cargo); this.hold = 0; this.invulnerable = 3;
    this.impactTime = 0; this.inRange = false; this.stable = false; this.stressed = false;
    this.failureReason = ''; this.warning = ''; this.warningTime = 0; this.sampleMessage = ''; this.relayMessage = '';
    this.selectedRescue = null; this.hintRemaining = 0; this.hintCooldown = 0;
    this.targets.forEach((target, i) => {
      const state = saved.targets[i];
      target.done = state.done; target.scanned = state.scanned; target.angle = state.angle;
      target.position.copy(state.position); target.interactionPosition.copy(state.interaction);
    });
    this.frame = { position: saved.position.clone(), quaternion: saved.quaternion.clone() };
    this.resetMotion(saved.position); this.refreshTargets(); this.refreshRepair(); this.updatePayload();
    return { position: saved.position.clone(), quaternion: saved.quaternion.clone() };
  }

  finishObjective() {
    const target = this.currentTarget;
    if (!this.active || !target) return;
    target.done = true; this.stage = this.targets.filter(t => t.done).length;
    this.hold = 0; this.inRange = false; this.stable = false; this.relayMessage = ''; this.sampleMessage = '';
    if (this.stage === this.targets.length) this.phase = 'complete';
    if (this.mission.kind === 'training' && this.stage < this.targets.length && this.frame) {
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.frame.quaternion);
      const next = this.currentTarget;
      next.position.copy(this.frame.position).addScaledVector(forward, 10);
      next.interactionPosition.copy(next.position);
    }
    this.refreshTargets(); this.refreshRepair(); this.updatePayload(); this.saveCheckpoint();
    this.onObjective?.(this.stage, this.targets.length);
  }

  fail(reason) { this.phase = 'failed'; this.failureReason = reason; this.hold = 0; }

  hit(damage = 20) {
    if (!this.active || this.invulnerable > 0 || this.mission.kind === 'training') return false;
    this.invulnerable = 1.8; this.impactTime = .35; this.hold = 0; this.damageTaken += damage;
    if (this.mission.kind === 'cargo') {
      this.cargo = Math.max(0, this.cargo - damage);
      if (this.cargo <= 0) this.fail('Cargo टूट गया। मोड़ से पहले BRAKE लगाएँ। Checkpoint से फिर उड़ें।');
    } else {
      this.health = Math.max(0, this.health - damage);
      if (this.health <= 0) this.fail('Hull health खत्म हुई। पूरे किए objectives सुरक्षित हैं।');
    }
    this.onDamage?.(); return true;
  }

  // A soft swept barrier keeps the jet outside solid mission structures.
  // Interactions happen in a separate docking ring in front of the object.
  resolveStructureCollision(position, previous = this.previousPosition, speed = 0) {
    if (!this.active || !previous) return false;
    for (const target of this.targets) {
      if (!target.solidRadius || !target.root.visible) continue;
      const radius = target.solidRadius + .95;
      const closest = new THREE.Line3(previous, position).closestPointToPoint(target.position, true, new THREE.Vector3());
      if (closest.distanceTo(target.position) >= radius) continue;
      const away = previous.clone().sub(target.position);
      if (away.lengthSq() < .001) away.set(0, 0, -1);
      position.copy(target.position).addScaledVector(away.normalize(), radius + .08);
      if (speed > 7) this.hit(12);
      this.warning = 'Docking ring के सामने रुकें · structure के अंदर न जाएँ'; this.warningTime = 3;
      this.resetMotion(position); return true;
    }
    return false;
  }

  resetMotion(position) { this.previousPosition = position.clone(); this.beaconPrevious = position.clone(); }

  update(dt, { position, speed = 0, turnRate = 0, quaternion = new THREE.Quaternion(), input = {} }) {
    if (!this.active) return;
    dt = Math.min(.1, Math.max(0, dt)); if (!dt) return;
    this.frame = { position: position.clone(), quaternion: quaternion.clone() };
    this.elapsedSeconds += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt); this.impactTime = Math.max(0, this.impactTime - dt);
    this.hintRemaining = Math.max(0, this.hintRemaining - dt); this.hintCooldown = Math.max(0, this.hintCooldown - dt);
    this.warningTime = Math.max(0, this.warningTime - dt); this.autoHintCooldown = Math.max(0, this.autoHintCooldown - dt);
    if (this.timeLeft !== null) {
      this.timeLeft = Math.max(0, this.rescueLimit - this.elapsedSeconds);
      if (!this.timeLeft) { this.fail('Rescue time खत्म हुआ। Checkpoint से बचाव जारी रखें।'); return; }
    }
    for (const hazard of this.hazards) {
      hazard.previous.copy(hazard.mesh.position); hazard.mesh.position.copy(hazard.base);
      hazard.mesh.position.x += Math.sin(this.elapsedSeconds * .7 + hazard.offset) * 2;
      hazard.mesh.position.y += Math.sin(this.elapsedSeconds * .5 + hazard.offset) * .7;
      hazard.mesh.rotation.x += dt * .3; hazard.mesh.rotation.y += dt * .4;
      const from = hazard.previous.clone().sub(this.previousPosition || position);
      const to = hazard.mesh.position.clone().sub(position);
      const closest = new THREE.Line3(from, to).closestPointToPoint(ORIGIN, true, new THREE.Vector3());
      if (closest.length() < hazard.radius + .6) this.hit(20);
    }
    const motionStart = (this.previousPosition || position).clone();
    this.previousPosition = position.clone();
    if (!this.active) return;
    this.stressed = this.mission.kind === 'cargo' && speed > 5 && Math.abs(turnRate) > .95;
    if (this.stressed) {
      const loss = dt * 8 * Math.min(2, Math.abs(turnRate)); this.damageTaken += loss;
      this.cargo = Math.max(0, this.cargo - loss);
      if (!this.cargo) { this.fail('तेज़ मोड़ों से cargo टूट गया। मोड़ने से पहले BRAKE लगाएँ।'); return; }
    }
    if (this.mission.kind === 'rescue') {
      const choices = this.targets.filter(t => t.kind === 'capsule' && !t.done);
      if (choices.length) {
        const nearest = choices.reduce((a, b) => position.distanceToSquared(a.position) <= position.distanceToSquared(b.position) ? a : b);
        if (nearest !== this.currentTarget && (this.hold === 0 || position.distanceTo(this.currentTarget.position) > 3.4)) {
          this.selectedRescue = nearest; this.hold = 0; this.refreshTargets();
        }
      }
    }
    const target = this.currentTarget;
    const distance = position.distanceTo(target.interactionPosition);
    this.distance = distance;
    this.inRange = distance < (target.kind === 'beacon' ? 3.8 : target.dock ? 1.35 : 3.4);
    this.stable = speed <= 1.8 && Math.abs(turnRate) < .45;
    target.marker.rotation.z += dt * .15;
    if (target.kind === 'sample') target.model.rotation.y += dt * .12;
    this.updatePayload();

    if (this.mission.kind === 'training' && this.stage < 3) {
      const performed = this.stage === 0 ? Math.hypot(input.yaw || 0, input.pitch || 0) > .15 : this.stage === 1 ? speed >= 3 : Boolean(input.brake) && speed < .4;
      if (performed) this.hold += dt;
      if (this.hold >= target.duration - 1e-6) this.finishObjective();
      return;
    }
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
      if (this.signal > this.bestSignal + 2) { this.bestSignal = this.signal; this.stalledTime = 0; }
      else this.stalledTime += dt;
      if (this.stalledTime > 18 && this.autoHintCooldown === 0 && !this.inRange) {
        this.hintRemaining = 8; this.autoHintCooldown = 35; this.stalledTime = 0;
        this.warning = 'मदद: 8 सेकंड के लिए probe की दिशा दिखाई गई है'; this.warningTime = 4;
      }
      this.beepClock -= dt;
      if (this.beepClock <= 0) { this.onSignalPulse?.(480 + this.signal * 7); this.beepClock = 2 - this.signal / 100 * 1.6; }
      this.scanPulse.visible = true;
      this.scanPulse.position.copy(position); this.scanPulse.quaternion.copy(quaternion);
      const phase = (this.elapsedSeconds % 2) / 2;
      this.scanPulse.scale.setScalar(.5 + phase * 3); this.scanMaterial.opacity = (1 - phase) * .28;
    }
    if (target.kind === 'relay') return;
    if (target.kind === 'beacon') {
      const closest = new THREE.Line3(this.beaconPrevious || motionStart, position).closestPointToPoint(target.position, true, new THREE.Vector3());
      this.beaconPrevious = position.clone();
      if (closest.distanceTo(target.position) < 3.8) this.finishObjective();
      return;
    }
    this.beaconPrevious = position.clone();
    if (!target.scanned) {
      if (this.inRange && this.stable && this.impactTime === 0) this.hold += dt;
      else this.hold = Math.max(0, this.hold - dt * 2);
    }
    this.refreshRepair();
    if (this.hold >= target.duration - 1e-6) {
      if (target.kind === 'sample') target.scanned = true;
      else this.finishObjective();
    }
  }

  performance() {
    return { seconds: Math.max(.1, this.elapsedSeconds), damage: Math.round(this.damageTaken * 10) / 10, mistakes: this.mistakes, retries: this.retries };
  }

  view() {
    const target = this.currentTarget, kind = this.mission?.kind;
    let instruction = this.inRange ? (this.stable ? 'Hold steady · काम अपने आप हो रहा है' : 'BRAKE लगाएँ और joystick छोड़ें') : 'Marker की ओर उड़ें · पास पहुँचकर BRAKE लगाएँ';
    if (kind === 'signal' && !this.inRange) instruction = this.signalTrend;
    if (target?.kind === 'beacon') instruction = 'Route beacon के बीच से जाएँ · cargo सुरक्षित रखें';
    if (target?.dock && !this.inRange && kind !== 'signal') instruction = 'Object के सामने चमकते docking ring में रुकें';
    if (target?.kind === 'relay' && this.inRange && this.stable) instruction = this.relayMessage || (target.beamAligned ? 'Beam जुड़ गई! Link दबाएँ' : 'Mirror घुमाकर beam अगले relay तक पहुँचाएँ');
    if (target?.kind === 'sample' && target.scanned) instruction = this.sampleMessage || 'Scan तैयार है · नीचे सही rock type चुनें';
    if (kind === 'training' && this.stage < 3) instruction = ['Joystick को थोड़ा दाएँ, बाएँ, ऊपर या नीचे चलाएँ', 'SPEED + दबाकर speed कम से कम 3 करें', 'BRAKE दबाकर पूरी तरह रुकें'][this.stage];
    // Warnings take priority over route and objective hints.
    if (this.warningTime > 0) instruction = this.warning;
    if (this.stressed) instruction = '⚠ Cargo stress! BRAKE लगाएँ, फिर मोड़ें';
    return {
      visible: this.active, title: target?.label || 'Challenge complete', step: `${Math.min(this.stage + 1, this.targets.length)}/${this.targets.length}`,
      instruction, warning: this.stressed || this.warningTime > 0, timeLeft: this.timeLeft,
      progress: target?.scanned ? 100 : target?.duration ? Math.min(100, this.hold / target.duration * 100) : 0,
      meterLabel: kind === 'signal' ? 'SIGNAL' : kind === 'cargo' ? 'CARGO' : 'HULL',
      meter: Math.ceil(kind === 'signal' ? this.signal : kind === 'cargo' ? this.cargo : this.health),
      showMeter: kind !== 'training', hint: kind === 'signal', hintCooldown: Math.ceil(this.hintCooldown),
      relay: kind === 'relay' && this.inRange && this.stable, angle: target?.angle || 0, beamAligned: target?.beamAligned || false,
      sample: Boolean(target?.scanned && this.inRange && this.stable), sampleFact: target?.sample?.fact || '',
      training: kind === 'training', docking: Boolean(target?.dock), dockReady: this.inRange && this.stable,
      beamPlan: kind === 'relay' ? {
        nodes: [...this.targets.map(t => t.beamStart), this.receiverPosition].map(p => ({ x: 50 + (p.x - this.origin.x) * 2, y: 85 - (p.z - this.origin.z) * 2 })),
        lines: this.links.map((line, i) => {
          const p = line.geometry.attributes.position;
          return { visible: line.visible, aligned: this.targets[i].beamAligned, x1: 50 + (p.getX(0) - this.origin.x) * 2, y1: 85 - (p.getZ(0) - this.origin.z) * 2, x2: 50 + (p.getX(1) - this.origin.x) * 2, y2: 85 - (p.getZ(1) - this.origin.z) * 2 };
        }),
      } : null,
      rescued: kind === 'rescue' ? this.targets.filter(t => t.kind === 'capsule' && t.done).length : null,
    };
  }

  dispose() { this.clear(); this.scene.remove(this.group); }
}

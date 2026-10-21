/**
 * Optional webcam hand controls for PJMC SPACE EXPLORER.
 *
 * The vision bundle and its model are loaded only after the user explicitly
 * enables Gesture Control. Camera frames stay in the browser; no frames are
 * uploaded by this controller. If the CDN/model is unavailable, classic touch
 * and keyboard flight controls continue to work.
 */
const VISION_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const HAND_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const averagePoint = (landmarks, indexes) => {
  let x = 0;
  let y = 0;
  for (const index of indexes) {
    x += landmarks[index].x;
    y += landmarks[index].y;
  }
  return { x: x / indexes.length, y: y / indexes.length };
};

function handMetrics(landmarks) {
  const center = averagePoint(landmarks, [0, 5, 9, 13, 17]);
  const span = Math.hypot(landmarks[5].x - landmarks[17].x, landmarks[5].y - landmarks[17].y);
  // The preview is mirrored so that movement matches the user's point of view.
  return { x: 1 - center.x, y: center.y, span };
}

export class HandGestureController {
  constructor({ onFrame = () => {}, onStatus = () => {} } = {}) {
    this.onFrame = onFrame;
    this.onStatus = onStatus;
    this.stream = null;
    this.landmarker = null;
    this.running = false;
    this.animationId = 0;
    this.lastDetection = 0;
    this.calibrationFrames = 0;
    this.spanBaseline = null;
    this.handGapBaseline = null;
    this.previousHandGap = null;
    this.lastControlSignature = '';

    this.video = document.createElement('video');
    this.video.className = 'flight-gesture-video';
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.setAttribute('aria-label', 'Local hand-control camera preview');
  }

  async start() {
    if (this.running) return this.video;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera access requires HTTPS and a browser with camera support.');
    }

    this.onStatus('REQUESTING CAMERA PERMISSION…');
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    try {
      this.onStatus('LOADING HAND-TRACKING MODEL…');
      const vision = await import(/* @vite-ignore */ VISION_MODULE_URL);
      const files = await vision.FilesetResolver.forVisionTasks(WASM_BASE_URL);
      const commonOptions = {
        baseOptions: { modelAssetPath: HAND_MODEL_URL },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      };
      try {
        this.landmarker = await vision.HandLandmarker.createFromOptions(files, {
          ...commonOptions,
          baseOptions: { ...commonOptions.baseOptions, delegate: 'GPU' },
        });
      } catch {
        this.landmarker = await vision.HandLandmarker.createFromOptions(files, commonOptions);
      }
    } catch (error) {
      await this.stop();
      throw new Error(`Hand-tracking model could not load. Check internet access and try again. ${error?.message || ''}`.trim());
    }

    this.running = true;
    this.lastDetection = 0;
    this.calibrationFrames = 0;
    this.spanBaseline = null;
    this.handGapBaseline = null;
    this.previousHandGap = null;
    this.onStatus('CALIBRATING · HOLD YOUR HAND IN VIEW…');
    this.animationId = requestAnimationFrame(this._tick);
    return this.video;
  }

  _tick = (timestamp) => {
    if (!this.running) return;
    this.animationId = requestAnimationFrame(this._tick);
    if (!this.landmarker || this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (timestamp - this.lastDetection < 48) return; // cap inference to ~20 FPS
    this.lastDetection = timestamp;

    let result;
    try {
      result = this.landmarker.detectForVideo(this.video, timestamp);
    } catch {
      return;
    }
    const hands = (result.landmarks || []).map(handMetrics);
    this._processHands(hands);
  };

  _processHands(hands) {
    const controls = new Set();
    let zoomDelta = 0;
    const calibrated = this.calibrationFrames >= 24;

    if (hands.length) {
      const span = hands.reduce((sum, hand) => sum + hand.span, 0) / hands.length;
      let gap = null;
      if (hands.length >= 2) gap = Math.hypot(hands[0].x - hands[1].x, hands[0].y - hands[1].y);

      if (!calibrated) {
        this.calibrationFrames += 1;
        this.spanBaseline = this.spanBaseline === null ? span : this.spanBaseline * 0.88 + span * 0.12;
        if (gap !== null) this.handGapBaseline = this.handGapBaseline === null ? gap : this.handGapBaseline * 0.8 + gap * 0.2;
        this.previousHandGap = gap;
        if (this.calibrationFrames >= 24) this.onStatus(hands.length >= 2 ? 'READY · TWO HANDS TO ZOOM, ONE TO STEER' : 'READY · PUSH HAND TO THRUST, MOVE LEFT/RIGHT TO TURN');
      } else if (hands.length >= 2) {
        // Move both hands apart to zoom in; bring them together to zoom out.
        if (this.previousHandGap !== null && gap !== null) {
          const movement = gap - this.previousHandGap;
          if (Math.abs(movement) > 0.0025) zoomDelta = movement;
        }
        this.previousHandGap = gap;
      } else {
        this.previousHandGap = null;
        const hand = hands[0];
        if (hand.x < 0.34) controls.add('yawLeft');
        else if (hand.x > 0.66) controls.add('yawRight');

        if (hand.y < 0.31) controls.add('up');
        else if (hand.y > 0.69) controls.add('down');

        if (this.spanBaseline > 0 && hand.span > this.spanBaseline * 1.19) controls.add('forward');
        else if (this.spanBaseline > 0 && hand.span < this.spanBaseline * 0.79) controls.add('back');
      }
    } else {
      this.previousHandGap = null;
    }

    // Send the current held controls every inference frame. This also recovers
    // correctly if autopilot/exit logic cleared the game's input state.
    this.lastControlSignature = [...controls].sort().join('|');
    this.onFrame({ controls: [...controls], zoomDelta, handCount: hands.length, calibrated: calibrated || this.calibrationFrames >= 24 });
    if (hands.length === 0) this.onStatus('NO HAND DETECTED · SHOW ONE OR TWO HANDS');
    else if (this.calibrationFrames < 24) this.onStatus(`CALIBRATING · ${Math.round(this.calibrationFrames / 24 * 100)}%`);
    else if (hands.length >= 2) this.onStatus('TWO HANDS · SPREAD TO ZOOM IN / PINCH TO ZOOM OUT');
    else this.onStatus('HAND CONTROL ACTIVE · PUSH/PULL TO THRUST');
  }

  async stop() {
    this.running = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = 0;
    try { this.landmarker?.close(); } catch {}
    this.landmarker = null;
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
    }
    this.stream = null;
    this.video.srcObject = null;
    this.onFrame({ controls: [], zoomDelta: 0, handCount: 0, calibrated: false });
  }
}

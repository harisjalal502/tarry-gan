const MEDIAPIPE_VERSION = "0.10.20";
const MEDIAPIPE_MODULE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`;
const MEDIAPIPE_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const FACE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const GST_WEBRTC_SCRIPT_URL = "./vendor/gstwebrtc-api-2.0.0.min.js";
const REACHY_SIGNALING_PORT = 8443;
const REACHY_SIGNALING_HOSTS = ["127.0.0.1", "localhost"];

const state = {
  session: null,
  timers: [],
  transcriptCount: 0,
  contextCount: 0,
  memoryCount: 0,
  liveVision: {
    stream: null,
    detector: null,
    rafId: null,
    running: false,
    lastVideoTime: -1,
    detectorName: "not loaded",
    sourceName: "replay",
    reachySession: null,
    reachyApi: null,
    lastFaceCount: null,
    lastObservationAt: 0,
  },
};

const els = {
  reachyButton: document.querySelector("#reachyButton"),
  liveButton: document.querySelector("#liveButton"),
  stopLiveButton: document.querySelector("#stopLiveButton"),
  replayButton: document.querySelector("#replayButton"),
  resetButton: document.querySelector("#resetButton"),
  cameraStage: document.querySelector("#cameraStage"),
  cameraVideo: document.querySelector("#cameraVideo"),
  faceOverlay: document.querySelector("#faceOverlay"),
  cameraStatus: document.querySelector("#cameraStatus"),
  visionReadout: document.querySelector("#visionReadout"),
  transcriptStatus: document.querySelector("#transcriptStatus"),
  contextStatus: document.querySelector("#contextStatus"),
  memoryStatus: document.querySelector("#memoryStatus"),
  transcript: document.querySelector("#transcript"),
  contextCards: document.querySelector("#contextCards"),
  memoryLedger: document.querySelector("#memoryLedger"),
  answer: document.querySelector("#answer"),
  faceA: document.querySelector("#faceA"),
  faceB: document.querySelector("#faceB"),
  gaze: document.querySelector("#gaze"),
  reaction: document.querySelector("#reaction"),
};

async function loadSession() {
  const response = await fetch("./data/demo-session.json");
  if (!response.ok) {
    throw new Error(`Could not load demo session: ${response.status}`);
  }
  state.session = await response.json();
}

function clearTimers() {
  for (const timer of state.timers) {
    clearTimeout(timer);
  }
  state.timers = [];
}

function reset() {
  clearTimers();
  stopLiveVision({ resetStatus: false });
  state.transcriptCount = 0;
  state.contextCount = 0;
  state.memoryCount = 0;
  state.liveVision.lastFaceCount = null;
  state.liveVision.lastObservationAt = 0;
  els.transcript.innerHTML = "";
  els.contextCards.innerHTML = "";
  els.memoryLedger.innerHTML = "";
  els.cameraStatus.textContent = "Replay idle";
  els.transcriptStatus.textContent = "0 lines";
  els.contextStatus.textContent = "0 extracted";
  els.memoryStatus.textContent = "adapter pending";
  els.answer.textContent = "Replay the demo to generate a memory-backed answer.";
  els.reaction.textContent = "Reaction: observing";
  els.visionReadout.textContent = "Vision source: replay";
  setFocus("center");
}

function replay() {
  if (!state.session) return;
  reset();
  els.cameraStatus.textContent = "Replay running";
  els.memoryStatus.textContent = "writing JSON events";

  for (const event of state.session.events) {
    const timer = setTimeout(() => applyEvent(event), event.atMs);
    state.timers.push(timer);
  }
}

async function startLiveVision() {
  clearTimers();
  stopLiveVision({ resetStatus: false });
  els.cameraStatus.textContent = "Requesting camera";
  els.visionReadout.textContent = "Vision source: browser camera | waiting for permission";
  els.reaction.textContent = "Reaction: scanning";
  els.faceOverlay.innerHTML = "";
  setLiveControls(true);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user",
      },
      audio: false,
    });

    await attachVisionStream({
      stream,
      sourceName: "browser camera",
      waitingText: "Vision source: browser camera | waiting for detector",
    });

    els.cameraStatus.textContent = "Loading face detector";
    els.visionReadout.textContent = "Downloading MediaPipe face detector";
    await startDetectorLoop("browser camera");
  } catch (error) {
    stopLiveVision({ resetStatus: false });
    els.cameraStatus.textContent = "Live vision error";
    els.visionReadout.textContent = `Vision error: ${error.message}`;
    setLiveControls(false);
  }
}

async function startReachyVision() {
  clearTimers();
  stopLiveVision({ resetStatus: false });
  els.cameraStatus.textContent = "Connecting to Reachy";
  els.visionReadout.textContent = `Vision source: Reachy camera | trying ws://127.0.0.1:${REACHY_SIGNALING_PORT}`;
  els.reaction.textContent = "Reaction: reaching for robot camera";
  els.faceOverlay.innerHTML = "";
  setLiveControls(true);

  try {
    const { stream, api, session, host } = await connectReachyCameraStream();
    state.liveVision.reachyApi = api;
    state.liveVision.reachySession = session;

    await attachVisionStream({
      stream,
      sourceName: `Reachy camera via ${host}`,
      waitingText: `Vision source: Reachy camera | connected to ${host}:${REACHY_SIGNALING_PORT}`,
    });

    els.cameraStatus.textContent = "Loading face detector";
    els.visionReadout.textContent = "Reachy camera connected | downloading MediaPipe face detector";
    await startDetectorLoop(`Reachy camera via ${host}`);
  } catch (error) {
    stopLiveVision({ resetStatus: false });
    els.cameraStatus.textContent = "Reachy camera error";
    els.visionReadout.textContent = `Reachy camera error: ${error.message}`;
    els.reaction.textContent = "Reaction: robot camera unavailable";
    setLiveControls(false);
  }
}

async function attachVisionStream({ stream, sourceName, waitingText }) {
  state.liveVision.stream = stream;
  state.liveVision.sourceName = sourceName;
  els.cameraVideo.srcObject = stream;
  els.cameraStage.classList.add("live");
  els.visionReadout.textContent = waitingText;
  await waitForVideoReady(els.cameraVideo);
}

async function startDetectorLoop(sourceName) {
  state.liveVision.detector = await createFaceDetector();
  state.liveVision.detectorName = state.liveVision.detector.name;
  state.liveVision.sourceName = sourceName;
  state.liveVision.running = true;
  state.liveVision.lastVideoTime = -1;
  runDetectionLoop();
}

function stopLiveVision({ resetStatus = true } = {}) {
  state.liveVision.running = false;

  if (state.liveVision.rafId !== null) {
    cancelAnimationFrame(state.liveVision.rafId);
    state.liveVision.rafId = null;
  }

  if (state.liveVision.detector?.close) {
    state.liveVision.detector.close();
  }
  state.liveVision.detector = null;
  state.liveVision.detectorName = "not loaded";

  if (state.liveVision.reachySession?.close) {
    try {
      state.liveVision.reachySession.close();
    } catch {
      // Ignore cleanup failures from the upstream WebRTC client.
    }
  }
  state.liveVision.reachySession = null;
  state.liveVision.reachyApi = null;

  if (state.liveVision.stream) {
    for (const track of state.liveVision.stream.getTracks()) {
      track.stop();
    }
  }
  state.liveVision.stream = null;

  els.cameraVideo.pause();
  els.cameraVideo.srcObject = null;
  els.faceOverlay.innerHTML = "";
  els.cameraStage.classList.remove("live");
  state.liveVision.sourceName = "replay";
  state.liveVision.lastFaceCount = null;
  state.liveVision.lastObservationAt = 0;
  setLiveControls(false);

  if (resetStatus) {
    els.cameraStatus.textContent = "Replay idle";
    els.visionReadout.textContent = "Vision source: replay";
    els.reaction.textContent = "Reaction: observing";
    setFocus("center");
  }
}

function setLiveControls(running) {
  els.reachyButton.disabled = running;
  els.liveButton.disabled = running;
  els.stopLiveButton.disabled = !running;
}

function waitForVideoReady(video) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Camera stream did not become ready in time."));
    }, 8000);

    function done() {
      clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", done);
      video.play().then(resolve).catch(reject);
    }

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0) {
      done();
      return;
    }

    video.addEventListener("loadedmetadata", done, { once: true });
  });
}

async function createFaceDetector() {
  const { FaceDetector, FilesetResolver } = await import(MEDIAPIPE_MODULE_URL);
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

  const options = {
    baseOptions: {
      modelAssetPath: FACE_MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    minDetectionConfidence: 0.45,
  };

  try {
    const detector = await FaceDetector.createFromOptions(vision, options);
    return createMediaPipeDetectorAdapter(detector, "MediaPipe GPU");
  } catch {
    const detector = await FaceDetector.createFromOptions(vision, {
      ...options,
      baseOptions: {
        modelAssetPath: FACE_MODEL_URL,
        delegate: "CPU",
      },
    });
    return createMediaPipeDetectorAdapter(detector, "MediaPipe CPU");
  }
}

function loadScriptOnce(src, globalName) {
  if (window[globalName]) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-loader="${globalName}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.loader = globalName;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), { once: true });
    document.head.append(script);
  });
}

async function connectReachyCameraStream() {
  await loadScriptOnce(GST_WEBRTC_SCRIPT_URL, "GstWebRTCAPI");

  let lastError = null;
  for (const host of REACHY_SIGNALING_HOSTS) {
    try {
      els.visionReadout.textContent = `Vision source: Reachy camera | trying ws://${host}:${REACHY_SIGNALING_PORT}`;
      return await connectReachyHost(host);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError?.message ?? "Reachy camera stream was not available.");
}

function connectReachyHost(host) {
  return new Promise((resolve, reject) => {
    const GstWebRTCAPI = window.GstWebRTCAPI;
    if (!GstWebRTCAPI) {
      reject(new Error("GStreamer WebRTC client did not load."));
      return;
    }

    let settled = false;
    let session = null;
    let api = null;

    function cleanup() {
      if (session?.close) {
        try {
          session.close();
        } catch {
          // Upstream cleanup is best-effort.
        }
      }
    }

    function fail(error) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      cleanup();
      reject(error);
    }

    function succeed(stream) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve({ stream, api, session, host });
    }

    const timeout = window.setTimeout(() => {
      fail(new Error(`No camera producer from ${host}:${REACHY_SIGNALING_PORT}. Is Reachy connected in the Reachy Mini Control app?`));
    }, 8000);

    api = new GstWebRTCAPI({
      signalingServerUrl: `ws://${host}:${REACHY_SIGNALING_PORT}`,
      reconnectionTimeout: 0,
      meta: { name: "terrygam-dashboard" },
      webrtcConfig: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    api.registerConnectionListener({
      connected: () => {
        els.visionReadout.textContent = `Connected to Reachy signaling on ${host}:${REACHY_SIGNALING_PORT}; waiting for camera stream`;
      },
      disconnected: () => {
        fail(new Error(`Disconnected from Reachy signaling on ${host}:${REACHY_SIGNALING_PORT}.`));
      },
    });

    api.registerProducersListener({
      producerAdded: (producer) => {
        if (session) return;
        session = api.createConsumerSession(producer.id);
        if (!session) {
          fail(new Error("Could not create Reachy camera consumer session."));
          return;
        }

        session.addEventListener("error", (event) => {
          fail(new Error(event.message || "Reachy camera stream error."));
        });

        session.addEventListener("streamsChanged", () => {
          const streams = session.streams;
          if (!streams || streams.length === 0) return;
          succeed(streams[0]);
        });

        session.connect();
      },
    });
  });
}

function createMediaPipeDetectorAdapter(detector, name) {
  return {
    name,
    detect(video) {
      const result = detector.detectForVideo(video, performance.now());
      return result.detections ?? [];
    },
    close() {
      detector.close?.();
    },
  };
}

function runDetectionLoop() {
  if (!state.liveVision.running || !state.liveVision.detector) return;

  const video = els.cameraVideo;
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== state.liveVision.lastVideoTime) {
    state.liveVision.lastVideoTime = video.currentTime;
    const detections = state.liveVision.detector.detect(video);
    renderDetections(detections);
  }

  state.liveVision.rafId = requestAnimationFrame(runDetectionLoop);
}

function renderDetections(detections) {
  const faces = detections
    .map((detection) => detectionToDisplayBox(detection))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  els.faceOverlay.replaceChildren(...faces.map((face, index) => createFaceBox(face, index)));

  const faceLabel = faces.length === 1 ? "1 face" : `${faces.length} faces`;
  els.cameraStatus.textContent = `Live vision: ${faceLabel}`;
  els.visionReadout.textContent = `Vision source: ${state.liveVision.sourceName} | detector: ${state.liveVision.detectorName} | ${faceLabel}`;
  els.reaction.textContent = faces.length > 0 ? "Reaction: person detected" : "Reaction: scanning";
  setFocus(faces.length > 0 ? "current_speaker" : "center");
  maybeRecordLiveVisionObservation(faces);
}

function maybeRecordLiveVisionObservation(faces) {
  const now = Date.now();
  const faceCount = faces.length;
  const countChanged = faceCount !== state.liveVision.lastFaceCount;
  const debounceElapsed = now - state.liveVision.lastObservationAt > 5000;

  if (!countChanged && !debounceElapsed) return;

  state.liveVision.lastFaceCount = faceCount;
  state.liveVision.lastObservationAt = now;

  if (faceCount === 0) return;

  const source = state.liveVision.sourceName.toLowerCase().includes("reachy")
    ? "robot_camera"
    : "browser_camera";
  const text = `${faceCount === 1 ? "One person" : `${faceCount} people`} detected in the live camera frame.`;

  addContextCard({
    kind: "Vision",
    text: `${text} Source: ${state.liveVision.sourceName}.`,
  });

  addMemoryWrite({
    payload: {
      type: "vision_observation",
      source,
      session_id: "live-room-observation",
      text,
      detector: state.liveVision.detectorName,
      tags: ["vision", "face-detection", "physical-context"],
    },
  });
}

function detectionToDisplayBox(detection) {
  const box = detection.boundingBox;
  if (!box) return null;

  const raw = {
    x: box.originX ?? box.x ?? box.left ?? 0,
    y: box.originY ?? box.y ?? box.top ?? 0,
    width: box.width ?? 0,
    height: box.height ?? 0,
  };

  const videoWidth = els.cameraVideo.videoWidth;
  const videoHeight = els.cameraVideo.videoHeight;
  if (videoWidth <= 0 || videoHeight <= 0 || raw.width <= 0 || raw.height <= 0) {
    return null;
  }

  const stageRect = els.cameraStage.getBoundingClientRect();
  const scale = Math.min(stageRect.width / videoWidth, stageRect.height / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const offsetX = (stageRect.width - renderedWidth) / 2;
  const offsetY = (stageRect.height - renderedHeight) / 2;
  const score = detection.categories?.[0]?.score ?? 0;

  return {
    x: offsetX + raw.x * scale,
    y: offsetY + raw.y * scale,
    width: raw.width * scale,
    height: raw.height * scale,
    score,
  };
}

function createFaceBox(face, index) {
  const box = document.createElement("div");
  box.className = `face-box${index === 0 ? " current" : ""}`;
  box.style.left = `${face.x}px`;
  box.style.top = `${face.y}px`;
  box.style.width = `${face.width}px`;
  box.style.height = `${face.height}px`;

  const label = document.createElement("div");
  label.className = "face-label";
  label.textContent = `${index === 0 ? "Attention target" : "Person detected"} ${Math.round(face.score * 100)}%`;
  box.append(label);

  return box;
}

function applyEvent(event) {
  if (event.type === "gaze") {
    setFocus(event.target);
    return;
  }

  if (event.type === "transcript") {
    addTranscript(event);
    return;
  }

  if (event.type === "context") {
    addContextCard(event);
    return;
  }

  if (event.type === "reaction") {
    els.reaction.textContent = `Reaction: ${event.text}`;
    return;
  }

  if (event.type === "memory_write") {
    addMemoryWrite(event);
    return;
  }

  if (event.type === "retrieval_answer") {
    els.answer.textContent = event.text;
    els.memoryStatus.textContent = "retrieval complete";
    els.cameraStatus.textContent = "Replay complete";
  }
}

function setFocus(target) {
  els.faceA.classList.toggle("active", target === "person_left");
  els.faceB.classList.toggle("active", target === "person_right" || target === "current_speaker");
  els.faceA.classList.toggle("whiteboard-focus", target === "whiteboard");
  els.faceB.classList.toggle("whiteboard-focus", target === "whiteboard");
  els.gaze.textContent = `Reachy gaze: ${target.replaceAll("_", " ")}`;
}

function addTranscript(event) {
  state.transcriptCount += 1;
  els.transcriptStatus.textContent = `${state.transcriptCount} lines`;

  const line = document.createElement("div");
  line.className = "transcript-line";
  line.innerHTML = `
    <span class="speaker">${escapeHtml(event.speaker)}</span>
    <span>${escapeHtml(event.text)}</span>
  `;
  els.transcript.append(line);
  line.scrollIntoView({ block: "end", behavior: "smooth" });
}

function addContextCard(event) {
  state.contextCount += 1;
  els.contextStatus.textContent = `${state.contextCount} extracted`;

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <b>${escapeHtml(event.kind)}</b>
    <div>${escapeHtml(event.text)}</div>
  `;
  els.contextCards.append(card);
}

function addMemoryWrite(event) {
  state.memoryCount += 1;
  els.memoryStatus.textContent = `${state.memoryCount} writes`;

  const entry = document.createElement("div");
  entry.className = "ledger-entry";
  entry.textContent = JSON.stringify(event.payload, null, 2);
  els.memoryLedger.append(entry);
  entry.scrollIntoView({ block: "end", behavior: "smooth" });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.reachyButton.addEventListener("click", startReachyVision);
els.liveButton.addEventListener("click", startLiveVision);
els.stopLiveButton.addEventListener("click", () => stopLiveVision());
els.replayButton.addEventListener("click", replay);
els.resetButton.addEventListener("click", reset);
setLiveControls(false);

loadSession().catch((error) => {
  els.cameraStatus.textContent = "Replay data error";
  els.answer.textContent = error.message;
});

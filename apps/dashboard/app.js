const MEDIAPIPE_VERSION = "0.10.20";
const MEDIAPIPE_MODULE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`;
const MEDIAPIPE_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const FACE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const GST_WEBRTC_SCRIPT_URL = "./vendor/gstwebrtc-api-2.0.0.min.js";
const REACHY_SIGNALING_PORT = 8443;
const REACHY_SIGNALING_HOSTS = ["127.0.0.1", "localhost"];
const AGENT_API_URL = "http://127.0.0.1:8787/agent/turn";
const AGENT_AUDIO_API_URL = "http://127.0.0.1:8787/agent/audio-turn";
const AGENT_MEMORY_QUERY_API_URL = "http://127.0.0.1:8787/agent/query-memory";
const REALTIME_CLIENT_SECRET_API_URL = "http://127.0.0.1:8787/realtime/client-secret";
const REALTIME_TOOL_CALL_API_URL = "http://127.0.0.1:8787/realtime/tool-call";
const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const AUDIO_SEGMENT_MS = 8000;
const VISION_OBSERVATION_INTERVAL_MS = 30000;
const SHOW_AGENT_TOOL_INTENTS = false;
const RECORD_FACE_DETECTION_CONTEXT = false;

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
  agent: {
    mediaRecorder: null,
    audioStream: null,
    segmentTimer: null,
    listening: false,
    speakerIndex: 1,
    segmentIndex: 0,
    sessionId: `live-room-${new Date().toISOString().slice(0, 10)}`,
    lastEventIds: new Set(),
  },
  realtime: {
    peerConnection: null,
    dataChannel: null,
    audioStream: null,
    connected: false,
    sessionId: `live-room-realtime-${new Date().toISOString().slice(0, 10)}`,
    processedToolCallIds: new Set(),
  },
};

const els = {
  reachyButton: document.querySelector("#reachyButton"),
  liveButton: document.querySelector("#liveButton"),
  stopLiveButton: document.querySelector("#stopLiveButton"),
  micButton: document.querySelector("#micButton"),
  stopMicButton: document.querySelector("#stopMicButton"),
  realtimeButton: document.querySelector("#realtimeButton"),
  stopRealtimeButton: document.querySelector("#stopRealtimeButton"),
  replayButton: document.querySelector("#replayButton"),
  resetButton: document.querySelector("#resetButton"),
  agentInputForm: document.querySelector("#agentInputForm"),
  agentTextInput: document.querySelector("#agentTextInput"),
  agentStatus: document.querySelector("#agentStatus"),
  realtimeStatus: document.querySelector("#realtimeStatus"),
  retrievalForm: document.querySelector("#retrievalForm"),
  memoryQueryInput: document.querySelector("#memoryQueryInput"),
  retrievalStatus: document.querySelector("#retrievalStatus"),
  retrievalMatches: document.querySelector("#retrievalMatches"),
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
  stopMicAgent({ updateStatus: false });
  stopRealtimeAgent({ updateStatus: false });
  state.transcriptCount = 0;
  state.contextCount = 0;
  state.memoryCount = 0;
  state.agent.lastEventIds = new Set();
  state.liveVision.lastFaceCount = null;
  state.liveVision.lastObservationAt = 0;
  els.transcript.innerHTML = "";
  els.contextCards.innerHTML = "";
  els.memoryLedger.innerHTML = "";
  els.cameraStatus.textContent = "Replay idle";
  els.transcriptStatus.textContent = "0 lines";
  els.contextStatus.textContent = "0 extracted";
  els.memoryStatus.textContent = "idle";
  els.agentStatus.textContent = "Agent service idle";
  els.realtimeStatus.textContent = "Realtime-2 tools idle";
  els.retrievalStatus.textContent = "ready";
  els.answer.textContent = "Replay the demo to generate a memory-backed answer.";
  els.retrievalMatches.innerHTML = "";
  els.reaction.textContent = "Reaction: observing";
  els.visionReadout.textContent = "Vision source: replay";
  setFocus("center");
}

async function startRealtimeAgent() {
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
    els.realtimeStatus.textContent = "Realtime unavailable in this browser.";
    return;
  }

  stopRealtimeAgent({ updateStatus: false });
  setRealtimeControls(true);
  els.realtimeStatus.textContent = "Creating GPT-Realtime-2 tool session...";

  try {
    const tokenResponse = await fetch(REALTIME_CLIENT_SECRET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: state.realtime.sessionId }),
    });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenPayload.error || `Realtime token returned ${tokenResponse.status}`);
    }

    const clientSecret = getRealtimeClientSecretValue(tokenPayload);
    if (!clientSecret) {
      throw new Error("Realtime client secret response did not include a token value.");
    }

    const pc = new RTCPeerConnection();
    const dc = pc.createDataChannel("oai-events");
    state.realtime.peerConnection = pc;
    state.realtime.dataChannel = dc;

    state.realtime.audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    for (const track of state.realtime.audioStream.getAudioTracks()) {
      pc.addTrack(track, state.realtime.audioStream);
    }

    dc.addEventListener("open", () => {
      state.realtime.connected = true;
      els.realtimeStatus.textContent = "Realtime-2 connected: listening, transcribing, and routing tools.";
    });
    dc.addEventListener("message", (event) => {
      try {
        void handleRealtimeEvent(JSON.parse(event.data)).catch((error) => {
          els.realtimeStatus.textContent = `Realtime-2 event error: ${error.message}`;
        });
      } catch (error) {
        els.realtimeStatus.textContent = `Realtime-2 parse error: ${error.message}`;
      }
    });
    dc.addEventListener("close", () => {
      state.realtime.connected = false;
      els.realtimeStatus.textContent = "Realtime-2 data channel closed.";
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const sdpResponse = await fetch(OPENAI_REALTIME_CALLS_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${clientSecret}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    });
    if (!sdpResponse.ok) {
      throw new Error(`OpenAI Realtime SDP failed: ${sdpResponse.status} ${await sdpResponse.text()}`);
    }

    await pc.setRemoteDescription({
      type: "answer",
      sdp: await sdpResponse.text(),
    });
    els.realtimeStatus.textContent = "Realtime-2 connecting...";
  } catch (error) {
    stopRealtimeAgent({ updateStatus: false });
    els.realtimeStatus.textContent = `Realtime-2 error: ${error.message}`;
  }
}

function stopRealtimeAgent({ updateStatus = true } = {}) {
  state.realtime.connected = false;
  state.realtime.processedToolCallIds = new Set();

  if (state.realtime.dataChannel) {
    try {
      state.realtime.dataChannel.close();
    } catch {
      // Ignore channel cleanup errors.
    }
  }
  state.realtime.dataChannel = null;

  if (state.realtime.peerConnection) {
    try {
      state.realtime.peerConnection.close();
    } catch {
      // Ignore peer cleanup errors.
    }
  }
  state.realtime.peerConnection = null;

  if (state.realtime.audioStream) {
    for (const track of state.realtime.audioStream.getTracks()) {
      track.stop();
    }
  }
  state.realtime.audioStream = null;
  setRealtimeControls(false);

  if (updateStatus) {
    els.realtimeStatus.textContent = "Realtime-2 stopped.";
  }
}

function setRealtimeControls(running) {
  els.realtimeButton.disabled = running;
  els.stopRealtimeButton.disabled = !running;
}

function getRealtimeClientSecretValue(payload) {
  if (typeof payload.value === "string") return payload.value;
  if (typeof payload.client_secret === "string") return payload.client_secret;
  if (typeof payload.client_secret?.value === "string") return payload.client_secret.value;
  return "";
}

async function handleRealtimeEvent(event) {
  if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
    addTranscript({
      speaker: "realtime",
      text: event.transcript,
    });
    els.realtimeStatus.textContent = "Realtime-2 transcript received.";
    return;
  }

  const functionCall = extractRealtimeFunctionCall(event);
  if (functionCall) {
    await runRealtimeToolCall(functionCall);
  }
}

function extractRealtimeFunctionCall(event) {
  if (event.type === "response.function_call_arguments.done") {
    return {
      call_id: event.call_id,
      name: event.name,
      arguments: event.arguments,
    };
  }

  if (event.type === "response.output_item.done" && event.item?.type === "function_call") {
    return {
      call_id: event.item.call_id,
      name: event.item.name,
      arguments: event.item.arguments,
    };
  }

  return null;
}

async function runRealtimeToolCall(functionCall) {
  if (functionCall.call_id && state.realtime.processedToolCallIds.has(functionCall.call_id)) {
    return;
  }
  if (functionCall.call_id) {
    state.realtime.processedToolCallIds.add(functionCall.call_id);
  }

  els.realtimeStatus.textContent = `Realtime-2 tool: ${functionCall.name}`;
  const response = await fetch(REALTIME_TOOL_CALL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(functionCall),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Realtime tool returned ${response.status}`);
  }

  addMemoryWrite({
    payload: {
      type: "realtime_tool_call",
      name: payload.name,
      output: payload.output,
    },
  });
  sendRealtimeToolOutput(payload.call_id, payload.output);
}

function sendRealtimeToolOutput(callId, output) {
  const channel = state.realtime.dataChannel;
  if (!channel || channel.readyState !== "open" || !callId) return;

  channel.send(JSON.stringify({
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: callId,
      output: JSON.stringify(output),
    },
  }));
  channel.send(JSON.stringify({ type: "response.create" }));
}

async function startMicAgent() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    els.agentStatus.textContent = "Audio recording unavailable here; type a line and click Send to Agent.";
    return;
  }

  stopMicAgent({ updateStatus: false });
  try {
    state.agent.audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    state.agent.listening = true;
    state.agent.segmentIndex = 0;
    setMicControls(true);
    els.agentStatus.textContent = "Recording audio chunks for OpenAI diarized transcription.";
    startNextAudioSegment();
  } catch (error) {
    els.agentStatus.textContent = `Mic permission/error: ${error.message}. Type a line as fallback.`;
    stopMicAgent({ updateStatus: false });
  }
}

function stopMicAgent({ updateStatus = true } = {}) {
  state.agent.listening = false;
  clearTimeout(state.agent.segmentTimer);
  state.agent.segmentTimer = null;

  if (state.agent.mediaRecorder && state.agent.mediaRecorder.state !== "inactive") {
    try {
      state.agent.mediaRecorder.stop();
    } catch {
      // MediaRecorder can throw if it is already stopped.
    }
  }
  state.agent.mediaRecorder = null;

  if (state.agent.audioStream) {
    for (const track of state.agent.audioStream.getTracks()) {
      track.stop();
    }
  }
  state.agent.audioStream = null;
  setMicControls(false);
  if (updateStatus) {
    els.agentStatus.textContent = "Mic stopped.";
  }
}

function setMicControls(listening) {
  els.micButton.disabled = listening;
  els.stopMicButton.disabled = !listening;
}

function startNextAudioSegment() {
  if (!state.agent.listening || !state.agent.audioStream) return;

  const mimeType = preferredAudioMimeType();
  const recorder = mimeType
    ? new MediaRecorder(state.agent.audioStream, { mimeType })
    : new MediaRecorder(state.agent.audioStream);
  const chunks = [];
  state.agent.mediaRecorder = recorder;
  state.agent.segmentIndex += 1;

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  recorder.addEventListener("stop", () => {
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    if (blob.size > 0) {
      void sendAudioToAgent(blob, state.agent.segmentIndex);
    }
    if (state.agent.listening) {
      startNextAudioSegment();
    }
  });

  recorder.start();
  els.agentStatus.textContent = `Recording diarized chunk ${state.agent.segmentIndex}...`;
  state.agent.segmentTimer = setTimeout(() => {
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  }, AUDIO_SEGMENT_MS);
}

function preferredAudioMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

async function sendAudioToAgent(blob, segmentIndex) {
  const form = new FormData();
  const extension = blob.type.includes("mp4") ? "mp4" : "webm";
  form.append("session_id", state.agent.sessionId);
  form.append("source", "browser_microphone");
  form.append("mode", "sdk");
  form.append("file", blob, `tarry-${state.agent.sessionId}-${segmentIndex}.${extension}`);

  els.agentStatus.textContent = `Transcribing chunk ${segmentIndex} with OpenAI diarization...`;

  try {
    const response = await fetch(AGENT_AUDIO_API_URL, {
      method: "POST",
      body: form,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `Agent service returned ${response.status}`);
    }
    applyAgentRun(payload);
    els.agentStatus.textContent = `Diarized ${payload.received_turns.length} turns with ${payload.transcription.model}; agent ${payload.mode}.`;
  } catch (error) {
    els.agentStatus.textContent = `Audio agent error: ${error.message}`;
  }
}

async function sendTextToAgent(text, options = {}) {
  const cleanText = text.trim();
  if (!cleanText) return;

  const speaker = options.speaker ?? nextSpeakerLabel();
  els.agentStatus.textContent = "Sending turn to OpenAI Agents SDK...";

  try {
    const response = await fetch(AGENT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: state.agent.sessionId,
        speaker,
        text: cleanText,
        source: options.source ?? "manual",
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `Agent service returned ${response.status}`);
    }

    applyAgentRun(payload);
    els.agentStatus.textContent = `Agent ${payload.mode}: ${payload.events.length} events, ${payload.tool_intents.length} tool intents.`;
  } catch (error) {
    els.agentStatus.textContent = `Agent error: ${error.message}. Is npm run agent:serve running?`;
  }
}

async function queryMemory() {
  const query = els.memoryQueryInput.value.trim();
  if (!query) return;

  els.retrievalStatus.textContent = "searching";
  els.answer.textContent = "Searching GBrain-backed room memory...";
  els.retrievalMatches.innerHTML = "";

  try {
    const response = await fetch(AGENT_MEMORY_QUERY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        source: "tarry-office",
        limit: 5,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `Memory query returned ${response.status}`);
    }

    els.answer.textContent = payload.answer;
    els.retrievalStatus.textContent = payload.mode === "gbrain" ? "GBrain" : payload.mode;
    els.memoryStatus.textContent = "retrieval complete";
    renderRetrievalMatches(payload.matches ?? []);
  } catch (error) {
    els.retrievalStatus.textContent = "error";
    els.answer.textContent = `Memory query error: ${error.message}. Is npm run agent:serve running?`;
  }
}

function nextSpeakerLabel() {
  const speaker = `speaker_${state.agent.speakerIndex}`;
  state.agent.speakerIndex = state.agent.speakerIndex === 1 ? 2 : 1;
  return speaker;
}

function applyAgentRun(run) {
  for (const event of run.events ?? []) {
    if (state.agent.lastEventIds.has(event.id)) continue;
    state.agent.lastEventIds.add(event.id);

    if (event.type === "transcript") {
      addTranscript(event);
    } else if (["decision", "risk", "question", "follow_up", "context"].includes(event.type)) {
      addContextCard({
        kind: labelForEventType(event.type),
        text: event.text,
      });
    }
  }

  if (SHOW_AGENT_TOOL_INTENTS) {
    for (const intent of run.tool_intents ?? []) {
      addMemoryWrite({
        payload: {
          type: "agent_tool_intent",
          tool: intent.name,
          reason: intent.reason,
          arguments: intent.arguments,
          session_id: run.session_id,
        },
      });
    }
  }

  if (run.memory_write) {
    addMemoryWrite({
      payload: {
        type: "gbrain_memory_write",
        ...run.memory_write,
      },
    });
  }

  for (const action of run.robot_actions ?? []) {
    addMemoryWrite({
      payload: {
        type: "robot_action",
        ok: action.ok,
        mode: action.mode,
        action: action.action,
        message: action.message,
        arguments: action.arguments,
      },
    });
  }

  if (run.summary) {
    els.answer.textContent = run.summary;
  }
}

function labelForEventType(type) {
  return {
    decision: "Decision",
    risk: "Risk",
    question: "Question",
    follow_up: "Follow-up",
    context: "Insight",
  }[type] ?? "Context";
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
    let producerSeen = false;
    let connectionReady = false;

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

    function connectProducer(producer) {
      if (session || settled || !producer?.id) return;
      producerSeen = true;
      els.visionReadout.textContent = `Reachy producer ${producer.meta?.name ?? producer.id} found; negotiating camera stream`;
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
    }

    function connectFirstAvailableProducer() {
      if (!connectionReady || session || settled || !api?.getAvailableProducers) return;
      const producers = api.getAvailableProducers();
      if (producers.length > 0) {
        connectProducer(producers[0]);
      }
    }

    const timeout = window.setTimeout(() => {
      const detail = producerSeen
        ? `Reachy advertised a camera producer on ${host}:${REACHY_SIGNALING_PORT}, but the WebRTC media stream did not arrive.`
        : `No camera producer from ${host}:${REACHY_SIGNALING_PORT}. Is Reachy connected in the Reachy Mini Control app?`;
      fail(new Error(detail));
    }, 8000);

    api = new GstWebRTCAPI({
      signalingServerUrl: `ws://${host}:${REACHY_SIGNALING_PORT}`,
      reconnectionTimeout: 0,
      meta: { name: "tarry-dashboard" },
      webrtcConfig: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    api.registerConnectionListener({
      connected: () => {
        connectionReady = true;
        els.visionReadout.textContent = `Connected to Reachy signaling on ${host}:${REACHY_SIGNALING_PORT}; waiting for camera stream`;
        window.setTimeout(connectFirstAvailableProducer, 0);
        window.setTimeout(connectFirstAvailableProducer, 500);
      },
      disconnected: () => {
        fail(new Error(`Disconnected from Reachy signaling on ${host}:${REACHY_SIGNALING_PORT}.`));
      },
    });

    api.registerProducersListener({
      producerAdded: (producer) => {
        connectProducer(producer);
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
  const debounceElapsed = now - state.liveVision.lastObservationAt > VISION_OBSERVATION_INTERVAL_MS;

  if (!countChanged && !debounceElapsed) return;

  state.liveVision.lastFaceCount = faceCount;
  state.liveVision.lastObservationAt = now;

  if (faceCount === 0 || !RECORD_FACE_DETECTION_CONTEXT) return;

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
    els.retrievalStatus.textContent = "replay";
    els.retrievalMatches.innerHTML = "";
    els.memoryStatus.textContent = "retrieval complete";
    els.cameraStatus.textContent = "Replay complete";
  }
}

function renderRetrievalMatches(matches) {
  if (matches.length === 0) {
    els.retrievalMatches.innerHTML = '<div class="retrieval-empty">No matching memory pages returned.</div>';
    return;
  }

  els.retrievalMatches.replaceChildren(...matches.map((match) => {
    const entry = document.createElement("div");
    entry.className = "retrieval-match";
    const score = typeof match.score === "number" ? ` · score ${match.score.toFixed(2)}` : "";
    entry.innerHTML = `
      <b>${escapeHtml(match.slug)}${escapeHtml(score)}</b>
      <span>${escapeHtml(match.snippet)}</span>
    `;
    return entry;
  }));
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
  const speaker = typeof event.speaker === "object"
    ? event.speaker.name || event.speaker.label
    : event.speaker;

  const line = document.createElement("div");
  line.className = "transcript-line";
  line.innerHTML = `
    <span class="speaker">${escapeHtml(speaker ?? "speaker")}</span>
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
  els.memoryStatus.textContent = `${state.memoryCount} events`;

  const entry = document.createElement("div");
  entry.className = "ledger-entry";
  entry.textContent = formatLedgerPayload(event.payload);
  els.memoryLedger.append(entry);
  entry.scrollIntoView({ block: "end", behavior: "smooth" });
}

function formatLedgerPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return String(payload ?? "");
  }

  if (payload.type === "gbrain_memory_write") {
    const target = payload.gbrain_put ? "GBrain" : "local fallback";
    return `Captured context -> ${target}: ${payload.slug} (${payload.local_event_count} events)`;
  }

  if (payload.type === "robot_action") {
    return `Robot ${payload.action} -> ${payload.ok ? "ok" : "failed"} (${payload.mode}): ${payload.message}`;
  }

  if (payload.type === "realtime_tool_call") {
    const outputType = payload.output?.type ?? "tool";
    const result = payload.output?.result;
    if (outputType === "robot_action_blocked") {
      return `Realtime-2 ${payload.name} blocked: ${result?.message ?? "safe demo mode"}`;
    }
    const mode = result?.mode ? `, ${result.mode}` : "";
    return `Realtime-2 ${payload.name} -> ${outputType}${mode}`;
  }

  if (payload.type === "vision_observation") {
    return `Vision: ${payload.text} (${payload.source}, ${payload.detector})`;
  }

  return JSON.stringify(payload, null, 2);
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
els.micButton.addEventListener("click", startMicAgent);
els.stopMicButton.addEventListener("click", () => stopMicAgent());
els.realtimeButton.addEventListener("click", startRealtimeAgent);
els.stopRealtimeButton.addEventListener("click", () => stopRealtimeAgent());
els.agentInputForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = els.agentTextInput.value;
  els.agentTextInput.value = "";
  void sendTextToAgent(text, { source: "manual" });
});
els.retrievalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void queryMemory();
});
els.replayButton.addEventListener("click", replay);
els.resetButton.addEventListener("click", reset);
setLiveControls(false);
setMicControls(false);
setRealtimeControls(false);

loadSession().catch((error) => {
  els.cameraStatus.textContent = "Replay data error";
  els.answer.textContent = error.message;
});

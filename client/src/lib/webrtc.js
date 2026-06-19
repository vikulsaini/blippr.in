import { api } from './api.js';

const baseIceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' }
];

let cachedIceServers;

export function getCallMediaConstraints(type, { lowData = false, facingMode = 'user' } = {}) {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: 48000
    },
    video: type === 'video'
      ? lowData
        ? { facingMode, width: { ideal: 360, max: 480 }, height: { ideal: 240, max: 360 }, frameRate: { ideal: 15, max: 20 } }
        : { facingMode, width: { ideal: 640, max: 960 }, height: { ideal: 360, max: 540 }, frameRate: { ideal: 24, max: 30 } }
      : false
  };
}

export async function getCallMediaStream(type, options = {}) {
  const constraints = getCallMediaConstraints(type, options);
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    if (error.name !== 'OverconstrainedError' && error.name !== 'ConstraintNotSatisfiedError') throw error;
    return navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
  }
}

export async function applyVideoSenderQuality(peer, enabled) {
  const videoSender = peer?.getSenders().find((sender) => sender.track?.kind === 'video');
  if (!videoSender) return;
  const params = videoSender.getParameters();
  
  if (params.encodings && params.encodings.length >= 3) {
    // Disable high-resolution layers to save bandwidth and prioritize audio
    params.encodings[0].active = true;
    params.encodings[1].active = !enabled;
    params.encodings[2].active = !enabled;
  } else {
    params.encodings = params.encodings?.length ? params.encodings : [{}];
    params.encodings[0].maxBitrate = enabled ? 100000 : 900000;
    params.encodings[0].maxFramerate = enabled ? 12 : 30;
  }

  await videoSender.setParameters(params).catch(() => {});
  
  if (!params.encodings || params.encodings.length < 3) {
    await videoSender.track?.applyConstraints?.(
      getCallMediaConstraints('video', { lowData: enabled }).video
    ).catch(() => {});
  }
}

function getEnvTurnServers() {
  const urls = (import.meta.env.VITE_TURN_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  if (!urls.length) return [];
  return [
    {
      urls,
      username: import.meta.env.VITE_TURN_USERNAME || undefined,
      credential: import.meta.env.VITE_TURN_PASSWORD || import.meta.env.VITE_TURN_CREDENTIAL || undefined
    }
  ];
}

export async function getRtcIceServers() {
  if (cachedIceServers) return cachedIceServers;
  const envTurnServers = getEnvTurnServers();
  try {
    const { turn } = await api('/api/config/rtc');
    const serverTurnServers = turn?.urls?.length
      ? [{ urls: turn.urls, username: turn.username || undefined, credential: turn.credential || undefined }]
      : [];
    cachedIceServers = [...baseIceServers, ...serverTurnServers, ...envTurnServers];
  } catch {
    cachedIceServers = [...baseIceServers, ...envTurnServers];
  }
  return cachedIceServers;
}

export function createPeer({ onTrack, onIceCandidate, onConnectionStateChange, iceServers = baseIceServers }) {
  const peer = new RTCPeerConnection({
    iceServers,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 10
  });

  peer.ontrack = (event) => onTrack?.(event.streams[0]);
  peer.onicecandidate = (event) => {
    if (event.candidate) onIceCandidate?.(event.candidate);
  };
  peer.onconnectionstatechange = () => onConnectionStateChange?.(peer.connectionState);
  peer.oniceconnectionstatechange = () => {
    if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') onConnectionStateChange?.('connected');
    if (peer.iceConnectionState === 'failed') onConnectionStateChange?.('failed');
    if (peer.iceConnectionState === 'disconnected') onConnectionStateChange?.('disconnected');
    if (peer.iceConnectionState === 'checking') onConnectionStateChange?.('checking');
  };

  return peer;
}

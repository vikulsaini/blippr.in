import { api } from './api.js';

const baseIceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' }
];

let cachedIceServers;

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

export function createPeer({ onTrack, onIceCandidate, onConnectionStateChange }) {
  const peer = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ],
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
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
  };

  return peer;
}

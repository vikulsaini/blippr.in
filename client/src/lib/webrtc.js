export function createPeer({ onTrack, onIceCandidate }) {
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  peer.ontrack = (event) => onTrack?.(event.streams[0]);
  peer.onicecandidate = (event) => {
    if (event.candidate) onIceCandidate?.(event.candidate);
  };

  return peer;
}

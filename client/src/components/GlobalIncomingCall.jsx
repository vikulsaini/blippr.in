import { useEffect, useRef, useState } from 'react';
import CallOverlay from './CallOverlay.jsx';
import { showNativeNotification } from '../lib/native.js';
import { getRealtimeSocket } from '../lib/realtime.js';
import { startCallSound, stopCallSound, vibrate as vibrateDevice } from '../lib/sounds.js';
import { createPeer, getCallMediaStream, getRtcIceServers } from '../lib/webrtc.js';

export default function GlobalIncomingCall() {
  const [call, setCall] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const callRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const vibrationTimerRef = useRef(null);
  const remoteIceQueueRef = useRef([]);

  function updateCall(next) {
    callRef.current = typeof next === 'function' ? next(callRef.current) : next;
    setCall(callRef.current);
  }

  function startRingtone(peerId) {
    stopRingtone();
    startCallSound({ outgoing: false, peerId });
    const pattern = [700, 220, 700, 220, 1000];
    vibrateDevice(pattern);
    vibrationTimerRef.current = window.setInterval(() => vibrateDevice(pattern), 2600);
  }

  function stopRingtone() {
    if (vibrationTimerRef.current) window.clearInterval(vibrationTimerRef.current);
    vibrationTimerRef.current = null;
    stopCallSound();
  }

  useEffect(() => {
    const socket = getRealtimeSocket();

    const handleIncomingCall = ({ callId, from, fromUser, offer, callType }) => {
      if (callRef.current) {
        socket.emit('call:reject', { to: from, callId });
        return;
      }
      startRingtone(from);
      showNativeNotification({
        title: `${fromUser?.name || 'Blippr friend'} is calling`,
        body: `${callType === 'video' ? 'Video' : 'Audio'} call on Blippr`,
        extra: { type: 'call', userId: from }
      }).catch(() => {});
      setMinimized(false);
      updateCall({
        status: 'incoming',
        direction: 'incoming',
        type: callType,
        callId,
        peerUser: fromUser || { _id: from, name: 'Blippr friend' },
        offer,
        muted: false,
        cameraOff: false,
        speakerOn: callType === 'video'
      });
    };

    const handleIceCandidate = async ({ candidate, callId }) => {
      if (callId && callRef.current?.callId && callRef.current.callId !== callId) return;
      if (!peerRef.current || !candidate) return;
      await addRemoteIceCandidate(candidate);
    };

    const handleCallClosed = ({ callId }) => {
      if (!callId || callRef.current?.callId === callId) cleanupCall();
    };

    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:reject', handleCallClosed);
    socket.on('call:end', handleCallClosed);
    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:reject', handleCallClosed);
      socket.off('call:end', handleCallClosed);
      cleanupCall();
    };
  }, []);

  async function addRemoteIceCandidate(candidate) {
    const peer = peerRef.current;
    if (!peer) return;
    if (!peer.remoteDescription) {
      remoteIceQueueRef.current.push(candidate);
      return;
    }
    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Ignore stale candidates after a call closes.
    }
  }

  async function flushRemoteIceQueue() {
    const queued = remoteIceQueueRef.current;
    remoteIceQueueRef.current = [];
    for (const candidate of queued) await addRemoteIceCandidate(candidate);
  }

  async function getLocalStream(type) {
    const stream = await getCallMediaStream(type);
    localStreamRef.current = stream;
    return stream;
  }

  async function createCallPeer(peerUser) {
    const iceServers = await getRtcIceServers();
    const peer = createPeer({
      iceServers,
      onTrack: (remoteStream) => updateCall((current) => ({ ...current, remoteStream })),
      onIceCandidate: (candidate) => getRealtimeSocket().emit('call:ice-candidate', { to: peerUser._id, candidate, callId: callRef.current?.callId }),
      onConnectionStateChange: (state) => {
        if (state === 'connected') updateCall((current) => ({ ...current, status: 'connected' }));
        if (state === 'failed') cleanupCall();
      }
    });
    peerRef.current = peer;
    return peer;
  }

  async function acceptCall() {
    const currentCall = callRef.current;
    if (!currentCall) return;
    try {
      stopRingtone();
      const localStream = await getLocalStream(currentCall.type);
      const peer = await createCallPeer(currentCall.peerUser);
      localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
      await peer.setRemoteDescription(new RTCSessionDescription(currentCall.offer));
      await flushRemoteIceQueue();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      getRealtimeSocket().emit('call:answer', { to: currentCall.peerUser._id, answer, callId: currentCall.callId });
      updateCall((callState) => ({ ...callState, status: 'connected', localStream, speakerOn: currentCall.type === 'video' || callState?.speakerOn }));
    } catch {
      rejectCall();
    }
  }

  function rejectCall() {
    const currentCall = callRef.current;
    if (currentCall?.peerUser?._id) getRealtimeSocket().emit('call:reject', { to: currentCall.peerUser._id, callId: currentCall.callId });
    cleanupCall();
  }

  function endCall() {
    const currentCall = callRef.current;
    if (currentCall?.peerUser?._id) getRealtimeSocket().emit('call:end', { to: currentCall.peerUser._id, callId: currentCall.callId });
    cleanupCall();
  }

  function cleanupCall() {
    stopRingtone();
    peerRef.current?.close();
    peerRef.current = null;
    remoteIceQueueRef.current = [];
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    updateCall(null);
    setMinimized(false);
  }

  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    updateCall((current) => ({ ...current, muted: !current?.muted }));
  }

  function toggleCamera() {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    updateCall((current) => ({ ...current, cameraOff: !current?.cameraOff }));
  }

  return (
    <CallOverlay
      call={call}
      minimized={minimized}
      onMinimize={() => setMinimized(true)}
      onExpand={() => setMinimized(false)}
      onAccept={acceptCall}
      onReject={rejectCall}
      onEnd={endCall}
      onToggleMute={toggleMute}
      onToggleCamera={toggleCamera}
      onSwitchCamera={() => {}}
      onToggleSpeaker={() => updateCall((current) => ({ ...current, speakerOn: !current?.speakerOn }))}
    />
  );
}

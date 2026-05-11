import { useEffect, useRef, useState } from 'react';
import { getOtherMember } from '../lib/chat.js';
import { getRealtimeSocket } from '../lib/realtime.js';
import { showNativeNotification } from '../lib/native.js';
import { startCallSound, stopCallSound, vibrate as vibrateDevice } from '../lib/sounds.js';
import { applyVideoSenderQuality, createPeer, getCallMediaStream, getRtcIceServers } from '../lib/webrtc.js';

const AUDIO_ROUTE_KEY = 'varta_call_audio_route';
const LOW_DATA_KEY = 'varta_call_low_data';
const RECONNECT_TIMEOUT_MS = 20000;

function readBoolPreference(key, fallback = false) {
  return localStorage.getItem(key) ? localStorage.getItem(key) === 'true' : fallback;
}

function readAudioRoutePreference(type) {
  if (type === 'video') return 'speaker';
  return localStorage.getItem(AUDIO_ROUTE_KEY) || 'earpiece';
}

export function useCallSession({ activeChat, chats, currentUserId, mergeCall, setChats }) {
  const [call, setCall] = useState(null);
  const [callMinimized, setCallMinimized] = useState(false);
  const [lowDataMode, setLowDataMode] = useState(() => readBoolPreference(LOW_DATA_KEY));
  const callRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const vibrationTimerRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const qualityTimerRef = useRef(null);
  const remoteIceQueueRef = useRef([]);
  const localIceQueueRef = useRef([]);

  function updateCall(next) {
    callRef.current = typeof next === 'function' ? next(callRef.current) : next;
    setCall(callRef.current);
  }

  function clearCallTimeout() {
    if (callTimeoutRef.current) window.clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = null;
  }

  function clearReconnectTimeout() {
    if (reconnectTimeoutRef.current) window.clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = null;
  }

  function clearQualityTimer() {
    if (qualityTimerRef.current) window.clearInterval(qualityTimerRef.current);
    qualityTimerRef.current = null;
  }

  function scheduleCallTimeout(peerUser, callId) {
    clearCallTimeout();
    callTimeoutRef.current = window.setTimeout(() => {
      const currentCall = callRef.current;
      if (!currentCall || currentCall.status === 'connected') return;
      getRealtimeSocket().emit('call:end', { to: peerUser._id, callId: callId || currentCall.callId });
      cleanupCall();
    }, 45000);
  }

  function startRingtone({ tone = 'incoming', shouldVibrate = false, peerId } = {}) {
    stopRingtone();
    startCallSound({ outgoing: tone === 'outgoing', peerId });
    if (shouldVibrate) {
      const pattern = [700, 220, 700, 220, 1000];
      vibrateDevice(pattern);
      vibrationTimerRef.current = window.setInterval(() => vibrateDevice(pattern), 2600);
    }
  }

  function stopRingtone() {
    if (vibrationTimerRef.current) window.clearInterval(vibrationTimerRef.current);
    vibrationTimerRef.current = null;
    stopCallSound();
  }

  function showIncomingCallNotification(fromUser, callType) {
    showNativeNotification({
      title: `${fromUser?.name || 'Varta friend'} is calling`,
      body: `${callType === 'video' ? 'Video' : 'Audio'} call on Varta`,
      extra: { type: 'call', userId: fromUser?._id }
    }).catch(() => {});
    if (!('Notification' in window) || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
    new Notification(`${fromUser?.name || 'Varta friend'} is calling`, {
      body: `${callType === 'video' ? 'Video' : 'Audio'} call on Varta`,
      icon: fromUser?.avatar || '/favicon.svg',
      tag: `varta-call-${fromUser?._id || 'incoming'}`
    });
  }

  function findUserById(userId, fallback) {
    return chats.flatMap((chat) => chat.members || []).find((member) => member._id === userId) || fallback || { _id: userId, name: 'Varta friend' };
  }

  useEffect(() => {
    const socket = getRealtimeSocket();

    const handleIncomingCall = ({ callId, from, fromUser, offer, callType }) => {
      if (callRef.current) {
        socket.emit('call:reject', { to: from, callId });
        return;
      }
      startRingtone({ tone: 'incoming', shouldVibrate: true, peerId: from });
      setCallMinimized(false);
      showIncomingCallNotification(fromUser, callType);
      const peerUser = findUserById(from, fromUser);
      updateCall({
        status: 'incoming',
        direction: 'incoming',
        type: callType,
        callId,
        peerUser,
        offer,
        muted: false,
        cameraOff: false,
        speakerOn: readAudioRoutePreference(callType) === 'speaker',
        audioRoute: readAudioRoutePreference(callType),
        lowDataMode,
        quality: 'checking'
      });
      scheduleCallTimeout(peerUser, callId);
    };

    const handleAnswer = async ({ answer, callId }) => {
      if (callRef.current?.callId !== callId || !peerRef.current) return;
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      await flushRemoteIceQueue();
      stopRingtone();
      clearCallTimeout();
      updateCall((current) => ({ ...current, status: 'connected', quality: current?.quality || 'good' }));
      startQualityMonitor();
    };

    const handleIceCandidate = async ({ candidate, callId }) => {
      if (!callRef.current) return;
      if (callId && callRef.current?.callId && callRef.current.callId !== callId) return;
      await addRemoteIceCandidate(candidate);
    };

    const handleCallClosed = ({ callId }) => {
      if (!callId || callRef.current?.callId === callId) cleanupCall();
    };
    const handleCallUpdated = ({ call: updatedCall }) => {
      const chatId = updatedCall?.chat?._id || updatedCall?.chat;
      if (!activeChat || chatId === activeChat._id) mergeCall(updatedCall);
    };
    const handleAccepted = ({ chat }) => {
      const memberIds = new Set((chat?.members || []).map((member) => member._id || member));
      setChats((current) => {
        const exists = current.some((item) => item._id === chat._id);
        return exists ? current.map((item) => (item._id === chat._id ? chat : item)) : [chat, ...current];
      });
      if (callRef.current?.peerUser && memberIds.has(callRef.current.peerUser._id)) return;
    };

    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:answer', handleAnswer);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:reject', handleCallClosed);
    socket.on('call:end', handleCallClosed);
    socket.on('call:updated', handleCallUpdated);
    socket.on('friend:request:accepted', handleAccepted);

    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:answer', handleAnswer);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:reject', handleCallClosed);
      socket.off('call:end', handleCallClosed);
      socket.off('call:updated', handleCallUpdated);
      socket.off('friend:request:accepted', handleAccepted);
    };
  }, [activeChat, chats, mergeCall, setChats]);

  useEffect(() => () => stopRingtone(), []);

  async function getLocalStream(type) {
    const lowData = readBoolPreference(LOW_DATA_KEY, lowDataMode);
    const stream = await getCallMediaStream(type, { lowData });
    localStreamRef.current = stream;
    return stream;
  }

  async function addRemoteIceCandidate(candidate) {
    if (!candidate) return;
    const peer = peerRef.current;
    if (!peer) {
      remoteIceQueueRef.current.push(candidate);
      return;
    }
    if (!peer.remoteDescription) {
      remoteIceQueueRef.current.push(candidate);
      return;
    }
    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Ignore stale candidates after a call is closed.
    }
  }

  async function flushRemoteIceQueue() {
    const queued = remoteIceQueueRef.current;
    remoteIceQueueRef.current = [];
    for (const candidate of queued) await addRemoteIceCandidate(candidate);
  }

  function emitIceCandidate(peerUser, candidate, callId = callRef.current?.callId) {
    if (!callId) {
      localIceQueueRef.current.push(candidate);
      return;
    }
    getRealtimeSocket().emit('call:ice-candidate', { to: peerUser._id, candidate, callId });
  }

  function flushLocalIceQueue(peerUser, callId) {
    const queued = localIceQueueRef.current;
    localIceQueueRef.current = [];
    queued.forEach((candidate) => emitIceCandidate(peerUser, candidate, callId));
  }

  async function applyLowDataToSenders(enabled) {
    await applyVideoSenderQuality(peerRef.current, enabled);
  }

  function startQualityMonitor() {
    clearQualityTimer();
    let previous = null;
    qualityTimerRef.current = window.setInterval(async () => {
      const peer = peerRef.current;
      if (!peer || !callRef.current) return;
      const stats = await peer.getStats().catch(() => null);
      if (!stats) return;
      let packetsLost = 0;
      let packetsReceived = 0;
      let jitter = 0;
      let rtt = 0;
      let rttSamples = 0;

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && !report.isRemote) {
          packetsLost += report.packetsLost || 0;
          packetsReceived += report.packetsReceived || 0;
          jitter = Math.max(jitter, report.jitter || 0);
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime) {
          rtt += report.currentRoundTripTime;
          rttSamples += 1;
        }
      });

      const deltaLost = previous ? Math.max(0, packetsLost - previous.packetsLost) : 0;
      const deltaReceived = previous ? Math.max(0, packetsReceived - previous.packetsReceived) : packetsReceived;
      previous = { packetsLost, packetsReceived };
      const lossRate = deltaReceived + deltaLost ? deltaLost / (deltaReceived + deltaLost) : 0;
      const avgRtt = rttSamples ? rtt / rttSamples : 0;
      const quality = callRef.current.status === 'reconnecting' || callRef.current.networkState === 'disconnected'
        ? 'reconnecting'
        : lossRate > 0.08 || avgRtt > 0.55 || jitter > 0.08
          ? 'poor'
          : 'good';
      updateCall((current) => ({ ...current, quality, rtt: avgRtt, lossRate }));
    }, 2500);
  }

  async function createCallPeer(peerUser) {
    const iceServers = await getRtcIceServers();
    const peer = createPeer({
      iceServers,
      onTrack: (remoteStream) => updateCall((current) => ({ ...current, remoteStream })),
      onIceCandidate: (candidate) => emitIceCandidate(peerUser, candidate),
      onConnectionStateChange: (state) => {
        if (state === 'connected') {
          clearReconnectTimeout();
          startQualityMonitor();
          updateCall((current) => ({ ...current, status: 'connected', networkState: 'connected', quality: current?.quality === 'poor' ? 'poor' : 'good' }));
        }
        if (state === 'checking') updateCall((current) => ({ ...current, networkState: 'checking' }));
        if (state === 'disconnected' || state === 'failed') {
          updateCall((current) => ({
            ...current,
            status: current?.status === 'connected' ? 'reconnecting' : current?.status,
            networkState: state,
            quality: 'reconnecting'
          }));
          peer.restartIce?.();
          if (!reconnectTimeoutRef.current) {
            reconnectTimeoutRef.current = window.setTimeout(() => {
              const currentCall = callRef.current;
              if (currentCall?.peerUser?._id) {
                getRealtimeSocket().emit('call:end', { to: currentCall.peerUser._id, callId: currentCall.callId });
              }
              cleanupCall();
            }, RECONNECT_TIMEOUT_MS);
          }
        }
      }
    });
    peerRef.current = peer;
    return peer;
  }

  async function startCall(type) {
    const peerUser = getOtherMember(activeChat, currentUserId);
    if (!peerUser || !navigator.mediaDevices?.getUserMedia) return;

    try {
      startRingtone({ tone: 'outgoing', peerId: peerUser._id });
      const localStream = await getLocalStream(type);
      const peer = await createCallPeer(peerUser);
      localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
      if (readBoolPreference(LOW_DATA_KEY, lowDataMode)) await applyLowDataToSenders(true);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      const audioRoute = readAudioRoutePreference(type);
      updateCall({ status: 'calling', direction: 'outgoing', type, peerUser, localStream, muted: false, cameraOff: false, speakerOn: audioRoute === 'speaker', audioRoute, lowDataMode: readBoolPreference(LOW_DATA_KEY, lowDataMode), quality: 'checking' });
      setCallMinimized(false);
      getRealtimeSocket().emit('call:offer', { to: peerUser._id, offer, callType: type }, (ack) => {
        if (ack?.ok) {
          updateCall((current) => ({ ...current, callId: ack.callId }));
          flushLocalIceQueue(peerUser, ack.callId);
          scheduleCallTimeout(peerUser, ack.callId);
        } else cleanupCall();
      });
    } catch (err) {
      stopRingtone();
      updateCall({ status: 'error', type, peerUser, error: err.message });
      setTimeout(cleanupCall, 1600);
    }
  }

  async function acceptCall() {
    if (!callRef.current) return;
    const currentCall = callRef.current;
    try {
      stopRingtone();
      const localStream = await getLocalStream(currentCall.type);
      const peer = await createCallPeer(currentCall.peerUser);
      localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
      if (readBoolPreference(LOW_DATA_KEY, lowDataMode)) await applyLowDataToSenders(true);
      await peer.setRemoteDescription(new RTCSessionDescription(currentCall.offer));
      await flushRemoteIceQueue();
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      getRealtimeSocket().emit('call:answer', { to: currentCall.peerUser._id, answer, callId: currentCall.callId }, (ack) => {
        if (!ack?.ok) {
          rejectCall();
          return;
        }
        clearCallTimeout();
        startQualityMonitor();
        const audioRoute = readAudioRoutePreference(currentCall.type);
        updateCall((callState) => ({ ...callState, status: 'connected', localStream, speakerOn: audioRoute === 'speaker', audioRoute, lowDataMode: readBoolPreference(LOW_DATA_KEY, lowDataMode), quality: 'good' }));
      });
    } catch {
      rejectCall();
    }
  }

  function rejectCall() {
    const currentCall = callRef.current;
    if (currentCall?.peerUser?._id) {
      getRealtimeSocket().emit('call:reject', { to: currentCall.peerUser._id, callId: currentCall.callId });
    }
    cleanupCall();
  }

  function endCall() {
    const currentCall = callRef.current;
    if (currentCall?.peerUser?._id) {
      getRealtimeSocket().emit('call:end', { to: currentCall.peerUser._id, callId: currentCall.callId });
    }
    cleanupCall();
  }

  function cleanupCall() {
    clearCallTimeout();
    clearReconnectTimeout();
    clearQualityTimer();
    stopRingtone();
    peerRef.current?.close();
    peerRef.current = null;
    remoteIceQueueRef.current = [];
    localIceQueueRef.current = [];
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    updateCall(null);
    setCallMinimized(false);
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    updateCall((current) => ({ ...current, muted: !current?.muted }));
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    stream?.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    updateCall((current) => ({ ...current, cameraOff: !current?.cameraOff }));
  }

  function toggleSpeaker() {
    updateCall((current) => {
      const speakerOn = !current?.speakerOn;
      const audioRoute = speakerOn ? 'speaker' : 'earpiece';
      if (current?.type !== 'video') localStorage.setItem(AUDIO_ROUTE_KEY, audioRoute);
      return { ...current, speakerOn, audioRoute };
    });
  }

  async function toggleLowDataMode() {
    const enabled = !readBoolPreference(LOW_DATA_KEY, lowDataMode);
    localStorage.setItem(LOW_DATA_KEY, String(enabled));
    setLowDataMode(enabled);
    await applyLowDataToSenders(enabled);
    updateCall((current) => ({ ...current, lowDataMode: enabled }));
  }

  async function switchCamera() {
    const currentCall = callRef.current;
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!currentCall || currentCall.type !== 'video' || !videoTrack) return;

    const currentFacing = videoTrack.getSettings().facingMode === 'environment' ? 'user' : 'environment';
    const newStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: currentFacing } });
    const newTrack = newStream.getVideoTracks()[0];
    const sender = peerRef.current?.getSenders().find((item) => item.track?.kind === 'video');
    await sender?.replaceTrack(newTrack);
    videoTrack.stop();
    localStreamRef.current.removeTrack(videoTrack);
    localStreamRef.current.addTrack(newTrack);
    updateCall((callState) => ({ ...callState, localStream: localStreamRef.current, cameraOff: false }));
  }

  return {
    call,
    callMinimized,
    setCallMinimized,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    toggleLowDataMode,
    switchCamera
  };
}

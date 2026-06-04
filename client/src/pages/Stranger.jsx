import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, FlipHorizontal2, Loader2, Maximize2, MessageCircle, Mic, MicOff, Minimize2, Send, ShieldCheck, Shuffle, UserPlus, Video, VideoOff } from 'lucide-react';
import UserProfileModal from '../components/UserProfileModal.jsx';
import { api } from '../lib/api.js';
import { getRealtimeSocket } from '../lib/realtime.js';
import { createPeer, getCallMediaStream, getRtcIceServers } from '../lib/webrtc.js';

const waitingLines = [
  'Looking for someone active...',
  'Pairing you with a random online user...',
  'Keeping friends and blocked users out of this queue...'
];
const FRIEND_UNLOCK_MS = 3 * 60 * 1000;
const SAFETY_ACK_KEY = 'varta_random_safety_ack';

export default function Stranger() {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('Ready for a random conversation');
  const [finding, setFinding] = useState(false);
  const [friendSent, setFriendSent] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callState, setCallState] = useState('idle');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [focused, setFocused] = useState(false);
  const [viewMode, setViewMode] = useState('chat');
  const [now, setNow] = useState(() => Date.now());
  const [safetyOpen, setSafetyOpen] = useState(false);
  const pendingFindRef = useRef(false);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteIceQueueRef = useRef([]);
  const sessionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const messagesEndRef = useRef(null);

  const peer = session?.peer;
  const waitingText = useMemo(() => waitingLines[Math.floor(Math.random() * waitingLines.length)], [finding]);
  const randomActionLabel = !session && !finding ? 'Start' : finding ? 'Searching' : 'Skip';
  const showVideo = viewMode === 'video';
  const showChat = viewMode === 'chat';
  const sessionStartedAt = session?.startedAt || session?.chat?.createdAt;
  const elapsedMs = sessionStartedAt ? Math.max(0, now - new Date(sessionStartedAt).getTime()) : 0;
  const friendUnlockMs = Math.max(0, FRIEND_UNLOCK_MS - elapsedMs);
  const friendUnlocked = !!peer && friendUnlockMs === 0;
  const friendGateLabel = friendSent ? 'Sent' : friendUnlocked ? 'Add friend' : `Wait ${formatCountdown(friendUnlockMs)}`;

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const socket = getRealtimeSocket();

    function handleMatched({ chat, peer: matchedPeer, initiator }) {
      startSession(chat, matchedPeer, initiator);
    }

    function handleMessage({ message }) {
      if (message.chat !== sessionRef.current?.chat?._id && message.chat?._id !== sessionRef.current?.chat?._id) return;
      setMessages((current) => (current.some((item) => item._id === message._id) ? current : [...current, message]));
    }

    function handleLeft({ chatId }) {
      if (chatId !== sessionRef.current?.chat?._id) return;
      setStatus('The stranger skipped. Tap Next to meet someone new.');
      cleanupCall(false);
      setSession(null);
    }

    function handleSignal(event) {
      handleStrangerSignal(event).catch((error) => setStatus(error.message));
    }

    socket.on('stranger:matched', handleMatched);
    socket.on('message:new', handleMessage);
    socket.on('stranger:left', handleLeft);
    socket.on('stranger:signal', handleSignal);

    return () => {
      socket.off('stranger:matched', handleMatched);
      socket.off('message:new', handleMessage);
      socket.off('stranger:left', handleLeft);
      socket.off('stranger:signal', handleSignal);
      leaveSession();
    };
  }, []);

  function startSession(chat, matchedPeer, initiator) {
    getRealtimeSocket().emit('chat:join', { chatId: chat._id });
    setSession({ chat, peer: matchedPeer, initiator, startedAt: chat.createdAt || new Date().toISOString() });
    setMessages([]);
    setFriendSent(false);
    setFinding(false);
    setStatus(`Connected with ${matchedPeer?.name || 'stranger'}`);
  }

  function requestFindStranger(next = false) {
    if (!window.localStorage.getItem(SAFETY_ACK_KEY)) {
      pendingFindRef.current = next;
      setSafetyOpen(true);
      return;
    }
    findStranger(next);
  }

  async function findStranger(next = false) {
    if (finding && !next) return;
    setFinding(true);
    setStatus(waitingText);
    cleanupCall(false);
    const currentChatId = sessionRef.current?.chat?._id;
    if (next) {
      getRealtimeSocket().emit('stranger:next', { chatId: currentChatId }, handleFindAck);
      setSession(null);
      setMessages([]);
      return;
    }
    getRealtimeSocket().emit('stranger:find', { interests: [] }, handleFindAck);
  }

  function handleRandomAction() {
    if (!session && !finding) {
      requestFindStranger(false);
      return;
    }
    requestFindStranger(true);
  }

  function handleFindAck(result = {}) {
    if (!result.ok) {
      setFinding(false);
      setStatus(result.message || 'Could not start random chat');
      return;
    }
    if (result.matched) {
      startSession(result.chat, result.peer, result.initiator);
      return;
    }
    setFinding(true);
    setStatus('Waiting for another online user. Keep this screen open.');
  }

  function leaveSession() {
    const chatId = sessionRef.current?.chat?._id;
    if (chatId) getRealtimeSocket().emit('stranger:leave', { chatId });
    cleanupCall();
    setSession(null);
    setMessages([]);
    setFinding(false);
  }

  function switchMode(nextMode) {
    if (nextMode === viewMode) return;
    leaveSession();
    setViewMode(nextMode);
    setStatus(nextMode === 'video' ? 'Ready for random video' : 'Ready for random chat');
    window.setTimeout(() => requestFindStranger(false), 0);
  }

  function acknowledgeSafety() {
    window.localStorage.setItem(SAFETY_ACK_KEY, '1');
    setSafetyOpen(false);
    findStranger(pendingFindRef.current);
    pendingFindRef.current = false;
  }

  async function sendMessage(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value || !session?.chat?._id) return;
    const tempId = `temp-${Date.now()}`;
    setText('');
    setMessages((current) => [
      ...current,
      {
        _id: tempId,
        chat: session.chat._id,
        sender: 'local',
        text: value,
        pending: true,
        createdAt: new Date().toISOString()
      }
    ]);
    getRealtimeSocket().emit('message:send', { chatId: session.chat._id, text: value }, (result) => {
      if (!result?.ok) {
        setMessages((current) => current.filter((item) => item._id !== tempId));
        setStatus(result?.message || 'Message failed');
        return;
      }
      setMessages((current) => {
        const withoutTemp = current.filter((item) => item._id !== tempId);
        return withoutTemp.some((item) => item._id === result.message._id) ? withoutTemp : [...withoutTemp, result.message];
      });
    });
  }

  async function sendFriendRequest() {
    if (!peer?._id || friendSent) return;
    if (!friendUnlocked) {
      setStatus(`Talk for ${formatCountdown(friendUnlockMs)} more before sending a request.`);
      return;
    }
    try {
      await api('/api/friends/requests', {
        method: 'POST',
        body: JSON.stringify({ userId: peer._id, sourceChatId: session?.chat?._id })
      });
      setFriendSent(true);
      setStatus('Friend request sent. Chat appears only after they accept.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function reportPeer() {
    if (!peer?._id) return;
    try {
      await api('/api/safety/report', {
        method: 'POST',
        body: JSON.stringify({ userId: peer._id, reason: 'inappropriate', notes: 'Reported from random chat.' })
      });
      setStatus('Reported and skipped.');
      requestFindStranger(true);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function createStrangerPeer() {
    const iceServers = await getRtcIceServers();
    const nextPeer = createPeer({
      iceServers,
      onTrack: (stream) => setRemoteStream(stream),
      onIceCandidate: (candidate) => sendSignal('ice', candidate),
      onConnectionStateChange: (state) => {
        if (state === 'connected') setCallState('connected');
        if (state === 'failed' || state === 'disconnected') setCallState('reconnecting');
      }
    });
    peerRef.current = nextPeer;
    return nextPeer;
  }

  async function ensureLocalStream() {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await getCallMediaStream('video', { lowData: true });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }

  async function startVideoChat() {
    if (!session?.chat?._id || !peer?._id) return;
    if (callState !== 'idle') return;
    try {
      setViewMode('video');
      setCallState('connecting');
      setStatus(`Connecting video with ${peer.name || 'stranger'}...`);
      await createAndSendOffer();
    } catch (error) {
      cleanupCall();
      setStatus(error.message || 'Camera or microphone permission failed');
    }
  }

  async function createAndSendOffer() {
    const stream = await ensureLocalStream();
    const nextPeer = peerRef.current || (await createStrangerPeer());
    if (!nextPeer.getSenders().length) stream.getTracks().forEach((track) => nextPeer.addTrack(track, stream));
    const offer = await nextPeer.createOffer();
    await nextPeer.setLocalDescription(offer);
    sendSignal('offer', offer);
  }

  async function handleStrangerSignal({ chatId, from, type, payload }) {
    if (chatId !== sessionRef.current?.chat?._id || from !== sessionRef.current?.peer?._id) return;
    if (type === 'ice') {
      await addRemoteIceCandidate(payload);
      return;
    }

    if (type === 'end') {
      cleanupCall(false);
      setStatus('Video chat ended');
      return;
    }

    const stream = await ensureLocalStream();
    const nextPeer = peerRef.current || (await createStrangerPeer());
    if (!nextPeer.getSenders().length) stream.getTracks().forEach((track) => nextPeer.addTrack(track, stream));

    if (type === 'offer') {
      setViewMode('video');
      setCallState('connecting');
      setStatus('Connecting video chat...');
      if (nextPeer.signalingState === 'have-local-offer') {
        await nextPeer.setLocalDescription({ type: 'rollback' }).catch(() => {});
      }
      await nextPeer.setRemoteDescription(new RTCSessionDescription(payload));
      await flushRemoteIceQueue();
      const answer = await nextPeer.createAnswer();
      await nextPeer.setLocalDescription(answer);
      sendSignal('answer', answer);
    }

    if (type === 'answer') {
      await nextPeer.setRemoteDescription(new RTCSessionDescription(payload));
      await flushRemoteIceQueue();
      setStatus('Video chat connected');
    }
  }

  function sendSignal(type, payload) {
    if (!sessionRef.current?.chat?._id || !sessionRef.current?.peer?._id) return;
    getRealtimeSocket().emit('stranger:signal', {
      chatId: sessionRef.current.chat._id,
      to: sessionRef.current.peer._id,
      type,
      payload
    }, (result) => {
      if (result && !result.ok) setStatus(result.message || 'Video signal failed');
    });
  }

  async function addRemoteIceCandidate(candidate) {
    const nextPeer = peerRef.current;
    if (!nextPeer || !candidate) return;
    if (!nextPeer.remoteDescription) {
      remoteIceQueueRef.current.push(candidate);
      return;
    }
    await nextPeer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
  }

  async function flushRemoteIceQueue() {
    const queued = remoteIceQueueRef.current;
    remoteIceQueueRef.current = [];
    for (const candidate of queued) await addRemoteIceCandidate(candidate);
  }

  function cleanupCall(announce = true) {
    if (announce) sendSignal('end', {});
    peerRef.current?.close();
    peerRef.current = null;
    remoteIceQueueRef.current = [];
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setMuted(false);
    setCameraOff(false);
    setFocused(false);
  }

  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setMuted((value) => !value);
  }

  function toggleCamera() {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setCameraOff((value) => !value);
  }

  async function switchCamera() {
    if (!localStreamRef.current || callState === 'idle') return;
    const nextFacingMode = facingMode === 'user' ? 'environment' : 'user';
    try {
      const nextStream = await getCallMediaStream('video', { lowData: true, facingMode: nextFacingMode });
      const nextVideoTrack = nextStream.getVideoTracks()[0];
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      const audioTracks = localStreamRef.current.getAudioTracks();
      const composedStream = new MediaStream([...audioTracks, nextVideoTrack]);
      const sender = peerRef.current?.getSenders().find((item) => item.track?.kind === 'video');
      await sender?.replaceTrack(nextVideoTrack);
      oldVideoTrack?.stop();
      localStreamRef.current = composedStream;
      setLocalStream(composedStream);
      setFacingMode(nextFacingMode);
      setCameraOff(false);
    } catch (error) {
      setStatus(error.message || 'Could not switch camera');
    }
  }

  useEffect(() => {
    if (!session?.chat?._id || viewMode !== 'video' || callState !== 'idle') return;
    if (session.initiator && session.initiator !== session.peer?._id) {
      startVideoChat();
    }
  }, [session, viewMode, callState]);

  const shellClass = focused
    ? 'fixed inset-0 z-[90] grid h-[100dvh] w-screen grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden bg-ink p-2 sm:p-3'
    : 'mx-auto grid h-full min-h-0 w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden pb-[calc(env(safe-area-inset-bottom)+4.75rem)] md:pb-0 lg:gap-4';

  return (
    <div className={shellClass}>
      <div title={status} className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[22px] border border-white/8 bg-ink/88 p-2 backdrop-blur">
        <div className="justify-self-start">
          <ModeTabs value={viewMode} onChange={switchMode} />
        </div>
        <p className="truncate text-center text-xs font-semibold text-white/48">{peer ? peer.name : status}</p>
        <button onClick={handleRandomAction} className="btn-primary flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
          {finding ? <Loader2 className="animate-spin" size={17} /> : <Shuffle size={17} />}
          {randomActionLabel}
        </button>
      </div>

      {showVideo && (
        <section className={`${focused ? 'flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-white/10 bg-black/35 shadow-[0_24px_80px_rgba(0,0,0,0.55)]' : 'depth-panel flex min-h-0 flex-col overflow-hidden rounded-[22px] lg:rounded-[28px]'}`}>
          <div className="flex items-center justify-between gap-3 border-b border-white/8 p-3 lg:p-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose">Random live</p>
              <h2 className="truncate text-xl font-semibold">{peer ? peer.name : finding ? 'Searching...' : 'Meet someone new'}</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold text-white/55">{callState}</span>
          </div>

          <div className="relative flex-1 p-2 lg:p-3">
            <MainVideoStage
              peer={peer}
              finding={finding}
              stream={remoteStream}
              videoRef={remoteVideoRef}
              focused={focused}
              expanded
              onToggleFocus={() => setFocused((value) => !value)}
              onStart={() => requestFindStranger(false)}
              emptyText={finding ? 'Waiting for a person...' : session ? 'Remote video appears after video is accepted' : 'Find a stranger to begin'}
            />
            <LocalPreview stream={localStream} videoRef={localVideoRef} cameraOff={cameraOff} />
          </div>

          <div className="grid grid-cols-3 gap-1.5 border-t border-white/8 p-2 sm:grid-cols-6 lg:gap-2 lg:p-3">
            <ControlButton onClick={startVideoChat} disabled={!session || callState !== 'idle'} icon={Video} label={callState === 'idle' ? 'Start' : callState} primary />
            <ControlButton onClick={toggleMute} disabled={!localStream} icon={muted ? MicOff : Mic} label={muted ? 'Muted' : 'Mic'} />
            <ControlButton onClick={toggleCamera} disabled={!localStream} icon={cameraOff ? VideoOff : Video} label={cameraOff ? 'Hidden' : 'Camera'} />
            <ControlButton onClick={switchCamera} disabled={!localStream || callState === 'idle'} icon={FlipHorizontal2} label="Flip" />
            <ControlButton onClick={sendFriendRequest} disabled={!peer || friendSent || !friendUnlocked} icon={friendSent ? Check : UserPlus} label={friendGateLabel} primary />
            <ControlButton onClick={handleRandomAction} disabled={finding} icon={Shuffle} label="Skip" />
          </div>
        </section>
      )}

      {showChat && (
        <aside className={`${focused ? 'depth-panel flex min-h-0 flex-col overflow-hidden rounded-[22px]' : !showVideo ? 'depth-panel flex min-h-0 flex-col overflow-hidden rounded-[22px]' : 'depth-panel flex min-h-0 flex-col overflow-hidden rounded-[22px] lg:rounded-[28px]'}`}>
          <div className="space-y-3 border-b border-white/8 p-3 lg:p-4">
            {peer ? (
              <div className="flex items-center gap-3">
                <button onClick={() => setProfileUser(peer)} className="relative">
                  <img src={peer.avatar} alt="" className="h-12 w-12 rounded-2xl object-cover" />
                  <span className="live-dot absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-mint text-mint" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{peer.name}</p>
                  <p className="truncate text-xs text-white/48">{peer.gender} - {peer.age}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/8 text-rose"><MessageCircle size={21} /></span>
                <div>
                  <p className="font-semibold">Random chat</p>
                </div>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {!session && (
              <EmptyRandom finding={finding} onStart={() => requestFindStranger(false)} />
            )}
            {messages.map((message) => {
              const mine = (message.sender?._id || message.sender) !== peer?._id;
              return (
                <div key={message._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-mint text-ink' : 'bg-white/8 text-white'} ${message.pending ? 'opacity-70' : ''}`}>
                  {message.text}
                </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-white/8 p-2 lg:p-3">
            <button
              type="button"
              onClick={handleRandomAction}
              className="btn-secondary flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold"
            >
              {finding ? <Loader2 className="animate-spin" size={17} /> : <Shuffle size={17} />}
              {randomActionLabel}
            </button>
            <button
              type="button"
              onClick={sendFriendRequest}
              disabled={!peer || friendSent || !friendUnlocked}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold disabled:opacity-45 ${friendSent ? 'bg-mint text-ink' : 'btn-primary'}`}
              title={friendUnlocked ? 'Send friend request' : 'Talk for at least 3 minutes before sending a request'}
            >
              {friendSent ? <Check size={17} /> : <UserPlus size={17} />}
              {friendGateLabel}
            </button>
          </div>

          {peer && (
            <button type="button" onClick={reportPeer} className="mx-2 mb-2 rounded-2xl border border-rose/15 bg-rose/10 py-2 text-xs font-semibold text-rose">
              Report unsafe behavior
            </button>
          )}

          <form onSubmit={sendMessage} className="flex shrink-0 gap-2 border-t border-white/8 p-2 lg:p-3">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={!session}
              className="min-w-0 flex-1 rounded-2xl border border-white/8 bg-white/6 px-4 py-3 text-sm outline-none disabled:opacity-45"
              placeholder={session ? 'Say something...' : 'Start a random chat first'}
            />
            <button disabled={!session || !text.trim()} className="btn-primary grid h-12 w-12 place-items-center rounded-2xl disabled:opacity-40" aria-label="Send">
              <Send size={18} />
            </button>
          </form>
        </aside>
      )}

      <UserProfileModal user={profileUser} onClose={() => setProfileUser(null)} />
      <SafetyModal open={safetyOpen} onClose={() => setSafetyOpen(false)} onAgree={acknowledgeSafety} />
    </div>
  );
}

function MainVideoStage({ peer, finding, stream, videoRef, focused, expanded, onToggleFocus, emptyText, onStart }) {
  const stageHeight = focused || expanded ? 'h-full min-h-0' : 'h-full min-h-0';

  return (
    <div className={`relative overflow-hidden rounded-[20px] border border-white/8 bg-black/45 lg:rounded-[24px] ${stageHeight}`}>
      {stream ? (
        <video ref={videoRef} autoPlay playsInline className={`h-full w-full object-cover ${stageHeight}`} />
      ) : (
        <div className={`grid h-full place-items-center p-4 text-center lg:p-6 ${stageHeight}`}>
          <div>
            {peer?.avatar ? (
              <img src={peer.avatar} alt="" className="mx-auto h-20 w-20 rounded-[28px] border border-white/10 object-cover shadow-glow" />
            ) : (
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/8 text-white/50">
                {finding ? <Loader2 className="animate-spin" size={25} /> : <Video size={25} />}
              </span>
            )}
            <p className="mt-4 text-base font-semibold">{peer?.name || 'Random live'}</p>
            <p className="mt-3 text-sm text-white/48">{emptyText}</p>
            {!peer && !finding && onStart && (
              <button onClick={onStart} className="btn-primary mt-5 rounded-full px-5 py-3 text-sm font-semibold">
                Start VC
              </button>
            )}
          </div>
        </div>
      )}
      <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-2 lg:inset-x-3 lg:top-3 lg:gap-3">
        <span className="rounded-full border border-white/10 bg-ink/70 px-3 py-1 text-xs font-semibold backdrop-blur">{peer?.name || 'Stranger'}</span>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-white/10 bg-ink/70 px-3 py-1 text-xs font-semibold text-white/65 backdrop-blur sm:inline-flex">Remote</span>
          <button
            type="button"
            onClick={onToggleFocus}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-ink/75 text-white/78 backdrop-blur transition hover:bg-white/12"
            aria-label={focused ? 'Exit full screen random chat' : 'Open full screen random chat'}
          >
            {focused ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeTabs({ value, onChange }) {
  const modes = [
    { value: 'chat', label: 'Chat' },
    { value: 'video', label: 'VC' }
  ];

  return (
    <div className="flex shrink-0 rounded-full border border-white/10 bg-white/6 p-1">
      {modes.map((mode) => (
        <button
          key={mode.value}
          type="button"
          onClick={() => onChange(mode.value)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${value === mode.value ? 'bg-white text-ink shadow-[0_10px_24px_rgba(255,255,255,0.12)]' : 'text-white/58 hover:text-white'}`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

function formatCountdown(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function LocalPreview({ stream, videoRef, cameraOff }) {
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream, videoRef, cameraOff]);

  return (
    <div className="absolute bottom-4 right-4 h-24 w-20 overflow-hidden rounded-[18px] border border-white/12 bg-ink shadow-[0_18px_42px_rgba(0,0,0,0.45)] sm:h-32 sm:w-24 lg:bottom-6 lg:right-6 lg:h-36 lg:w-28 lg:rounded-[20px]">
      {stream && !cameraOff ? (
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-white/7 text-white/45">
          <VideoOff size={22} />
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">You</span>
    </div>
  );
}

function ControlButton({ icon: Icon, label, onClick, disabled, primary, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-11 items-center justify-center gap-1 rounded-2xl px-1.5 py-2 text-[10px] font-semibold capitalize disabled:opacity-35 sm:gap-2 sm:px-3 sm:py-3 sm:text-xs ${primary ? 'btn-primary' : danger ? 'bg-rose/12 text-rose hover:bg-rose/18' : 'btn-secondary'}`}
    >
      <Icon size={17} />
      {label}
    </button>
  );
}

function EmptyRandom({ finding, onStart }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid h-full min-h-0 place-items-center text-center">
      <div>
        <span className="tone-ring mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose/10 text-rose">
          {finding ? <Loader2 className="animate-spin" size={24} /> : <Shuffle size={24} />}
        </span>
        <p className="mt-4 font-semibold">{finding ? 'Waiting for someone' : 'Start random chat'}</p>
        {!finding && (
          <button onClick={onStart} className="btn-primary mt-5 rounded-full px-5 py-3 text-sm font-semibold">
            Start random
          </button>
        )}
      </div>
    </motion.div>
  );
}

function SafetyModal({ open, onClose, onAgree }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4 backdrop-blur">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="depth-panel w-full max-w-sm rounded-[24px] p-4">
        <span className="tone-ring grid h-12 w-12 place-items-center rounded-2xl bg-mint/10 text-mint">
          <ShieldCheck size={23} />
        </span>
        <h3 className="mt-4 text-lg font-semibold">Before you start</h3>
        <div className="mt-3 space-y-2 text-sm leading-6 text-white/58">
          <p>Keep random chat respectful. Adult, abusive, hateful, exploitative, or unsafe content is not allowed.</p>
          <p>Messages can be blocked by safety filters. Reports may restrict or ban accounts.</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="btn-secondary rounded-2xl py-3 text-sm font-semibold">Cancel</button>
          <button type="button" onClick={onAgree} className="btn-primary rounded-2xl py-3 text-sm font-semibold">I agree</button>
        </div>
      </motion.div>
    </div>
  );
}

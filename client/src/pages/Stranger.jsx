import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
const SAFETY_ACK_KEY = 'blippr_random_safety_ack';

export default function Stranger() {
  const { me } = useOutletContext() || {};
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
  const [videoChromeVisible, setVideoChromeVisible] = useState(true);
  const [queueText, setQueueText] = useState('Connecting to closest node...');
  const [activeUsers, setActiveUsers] = useState(0);
  const pendingFindRef = useRef(false);
  const videoChromeTimerRef = useRef(null);
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
  const isGuest = me?.isGuest;
  const friendUnlocked = !isGuest && !!peer && friendUnlockMs === 0;
  const friendGateLabel = isGuest ? 'Upgrade' : (friendSent ? 'Sent' : friendUnlocked ? 'Add Friend' : `Wait ${formatCountdown(friendUnlockMs)}`);

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
    if (!finding) return;
    const queueTexts = [
      'Connecting to closest node...',
      'Applying matching filters...',
      'Pairing you with an active match...'
    ];
    let idx = 0;
    setQueueText(queueTexts[0]);
    const timer = setInterval(() => {
      idx = (idx + 1) % queueTexts.length;
      setQueueText(queueTexts[idx]);
    }, 2500);
    return () => clearInterval(timer);
  }, [finding]);

  useEffect(() => {
    if (!showVideo) return undefined;
    revealVideoChrome();
    return () => window.clearTimeout(videoChromeTimerRef.current);
  }, [showVideo, focused, session?.chat?._id]);

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

  useEffect(() => {
    const socket = getRealtimeSocket();
    function fetchStats() {
      socket.emit('stranger:stats', (result) => {
        if (result?.ok) setActiveUsers(result.activeUsers);
      });
    }
    fetchStats();
    const timer = setInterval(fetchStats, 30000);
    return () => clearInterval(timer);
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

  function cancelMatching() {
    getRealtimeSocket().emit('stranger:leave');
    setFinding(false);
    setStatus(viewMode === 'video' ? 'Ready for random video' : 'Ready for random chat');
  }

  function handleRandomAction() {
    if (finding) {
      cancelMatching();
      return;
    }
    if (!session) {
      requestFindStranger(false);
      return;
    }
    requestFindStranger(true);
  }

  function revealVideoChrome() {
    setVideoChromeVisible(true);
    window.clearTimeout(videoChromeTimerRef.current);
    videoChromeTimerRef.current = window.setTimeout(() => {
      if (sessionRef.current || localStreamRef.current) setVideoChromeVisible(false);
    }, 2600);
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

  async function toggleFriendRequest() {
    if (me?.isGuest) {
      window.dispatchEvent(new CustomEvent('blippr:guest-expired'));
      return;
    }
    if (!peer?._id) return;
    if (friendSent) {
      try {
        await api(`/api/friends/requests/sent/${peer._id}`, {
          method: 'DELETE'
        });
        setFriendSent(false);
        setStatus('Friend request cancelled.');
      } catch (error) {
        setStatus(error.message);
      }
      return;
    }
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
    ? 'fixed inset-0 z-[90] h-[100dvh] w-screen overflow-hidden bg-bg p-1 sm:p-1.5'
    : 'mx-auto h-full min-h-0 w-full max-w-[1280px] overflow-hidden pb-[env(safe-area-inset-bottom)] px-2';

  return (
    <div className={shellClass}>
      <ElectricCanvas />
      {showVideo && (
        <section
          onPointerMove={revealVideoChrome}
          onPointerDown={revealVideoChrome}
          onTouchStart={revealVideoChrome}
          className={`${focused ? 'flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] bg-bg shadow-card sm:rounded-[16px]' : 'flex h-full min-h-0 flex-col overflow-hidden rounded-[16px] p-0.5 sm:p-1 lg:rounded-[22px] lg:p-1.5 bg-surface shadow-card'}`}
        >
          <div className="relative min-h-0 flex-1">
            <MainVideoStage
              peer={peer}
              finding={finding}
              stream={remoteStream}
              videoRef={remoteVideoRef}
              focused={focused}
              expanded
              chromeVisible={videoChromeVisible}
              onToggleFocus={() => setFocused((value) => !value)}
              onStart={() => requestFindStranger(false)}
              onCancel={cancelMatching}
              emptyText={finding ? queueText : session ? 'Remote video appears after video is accepted' : 'Find a stranger to begin'}
              tipText={finding ? 'Tip: Stay for 3+ minutes to unlock friend request.' : ''}
              status={callState}
              modeTabs={<ModeTabs value={viewMode} onChange={switchMode} compact />}
              actions={
                <>
                  <CircleControl onClick={startVideoChat} disabled={!session || callState !== 'idle'} icon={Video} label={callState === 'idle' ? 'Start' : callState} primary />
                  <CircleControl onClick={toggleMute} disabled={!localStream} icon={muted ? MicOff : Mic} label={muted ? 'Muted' : 'Mic'} />
                  <CircleControl onClick={toggleCamera} disabled={!localStream} icon={cameraOff ? VideoOff : Video} label={cameraOff ? 'Hidden' : 'Camera'} />
                  <CircleControl onClick={switchCamera} disabled={!localStream || callState === 'idle'} icon={FlipHorizontal2} label="Flip" />
                  <CircleControl onClick={toggleFriendRequest} disabled={!peer || (!friendSent && !friendUnlocked && !isGuest)} icon={friendSent ? Check : UserPlus} label={friendGateLabel} primary />
                  <CircleControl onClick={handleRandomAction} disabled={finding} icon={Shuffle} label="Skip" />
                </>
              }
            />
            <LocalPreview stream={localStream} videoRef={localVideoRef} cameraOff={cameraOff} chromeVisible={videoChromeVisible} />
          </div>
        </section>
      )}

      {showChat && (
        <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[16px] lg:rounded-[22px] bg-surface shadow-card">
          <div className="space-y-2 p-2 lg:p-3">
            <div className="flex items-center justify-between gap-3">
              {peer ? (
                <div className="flex min-w-0 items-center gap-3">
                  <button onClick={() => setProfileUser(peer)} className="relative shrink-0">
                    <img src={peer.avatar} alt="" className="h-10 w-10 rounded-[15px] object-cover sm:h-11 sm:w-11 sm:rounded-2xl" />
                    <span className="absolute bottom-0 right-0 status-dot online" />
                  </button>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-text-primary">{peer.name}</p>
                    <p className="truncate text-xs text-text-muted">{peer.gender} · {peer.age}</p>
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="tone-ring grid h-10 w-10 shrink-0 place-items-center rounded-[15px] bg-accent-light text-accent sm:h-11 sm:w-11 sm:rounded-2xl"><MessageCircle size={19} /></span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-text-primary">Random chat</p>
                    <p className="truncate text-xs text-text-muted">{status}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                {session && <ConnectionQualityIndicator state={callState} />}
                <ModeTabs value={viewMode} onChange={switchMode} compact />
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5 sm:p-3 bg-bg">
            {!session && (
              <EmptyRandom finding={finding} queueText={queueText} onStart={() => requestFindStranger(false)} activeUsers={activeUsers} />
            )}
            <AnimatePresence initial={false}>
              {messages.map((message) => {
                const mine = (message.sender?._id || message.sender) !== peer?._id;
                return (
                  <motion.div
                    key={message._id}
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'rounded-br-none bg-gradient-to-br from-accent to-[#0EA5E9] text-white shadow-card' : 'rounded-bl-none border border-border-default bg-surface text-text-primary shadow-card'} ${message.pending ? 'opacity-70' : ''}`}>
                      <p className={mine ? 'text-white' : 'text-text-primary font-medium'}>
                        {message.text}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {session ? (
            <div className="grid grid-cols-2 gap-1.5 p-2 lg:gap-2 lg:p-3 bg-surface">
              <button
                type="button"
                onClick={handleRandomAction}
                className="btn-secondary flex min-h-10 items-center justify-center gap-1.5 rounded-[15px] px-2.5 py-2 text-xs font-semibold sm:min-h-11 sm:rounded-2xl sm:text-sm"
              >
                {finding ? <Loader2 className="animate-spin" size={17} /> : <Shuffle size={17} />}
                {randomActionLabel}
              </button>
              <button
                type="button"
                onClick={toggleFriendRequest}
                disabled={!peer || (!friendSent && !friendUnlocked && !isGuest)}
                className={`flex min-h-10 items-center justify-center gap-1.5 rounded-[15px] px-2.5 py-2 text-xs font-semibold disabled:opacity-45 sm:min-h-11 sm:rounded-2xl sm:text-sm btn-primary`}
                title={isGuest ? 'Upgrade to send friend requests' : friendSent ? 'Cancel friend request' : (friendUnlocked ? 'Send friend request' : 'Talk for at least 3 minutes before sending a request')}
              >
                {friendSent ? <Check size={17} /> : <UserPlus size={17} />}
                {friendGateLabel}
              </button>
            </div>
          ) : (
            <div className="p-2 lg:p-3 bg-surface">
              <button
                type="button"
                onClick={handleRandomAction}
                className="btn-primary flex w-full min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-accent-sm"
              >
                {finding ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Cancel / Stop matching
                  </>
                ) : (
                  <>
                    <Shuffle size={18} />
                    Start matching
                  </>
                )}
              </button>
            </div>
          )}

          {peer && (
            <button type="button" onClick={reportPeer} className="mx-2 mb-2 rounded-2xl bg-danger/10 py-2 text-xs font-semibold text-danger">
              Report unsafe behavior
            </button>
          )}

          {session && (
            <form onSubmit={sendMessage} className="flex shrink-0 gap-1.5 p-2 lg:gap-2 lg:p-3 bg-surface">
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                className="min-w-0 flex-1 rounded-[15px] bg-bg px-3 py-2.5 text-sm outline-none sm:rounded-2xl sm:px-4 sm:py-3 text-text-primary placeholder:text-text-faint font-medium"
                placeholder="Say something..."
              />
              <button disabled={!text.trim()} className="btn-primary grid h-11 w-11 place-items-center rounded-[15px] disabled:opacity-40 sm:h-12 sm:w-12 sm:rounded-2xl" aria-label="Send">
                <Send size={18} />
              </button>
            </form>
          )}
        </aside>
      )}

      <UserProfileModal user={profileUser} onClose={() => setProfileUser(null)} />
      <SafetyModal open={safetyOpen} onClose={() => setSafetyOpen(false)} onAgree={acknowledgeSafety} />
    </div>
  );
}

function MainVideoStage({ peer, finding, stream, videoRef, focused, expanded, chromeVisible, onToggleFocus, emptyText, tipText, onStart, onCancel, status, modeTabs, actions }) {
  const stageHeight = focused || expanded ? 'h-full min-h-0' : 'h-full min-h-0';

  return (
    <div className={`relative overflow-hidden rounded-[14px] bg-black/80 sm:rounded-[16px] lg:rounded-[20px] ${stageHeight}`}>
      {stream ? (
        <video ref={videoRef} autoPlay playsInline className={`h-full w-full object-contain ${stageHeight}`} />
      ) : (
        <div className={`grid h-full place-items-center p-4 text-center lg:p-6 ${stageHeight}`}>
          <div>
            {peer?.avatar ? (
              <img src={peer.avatar} alt="" className="mx-auto h-20 w-20 rounded-[28px] object-cover shadow-glow" />
            ) : (
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/8 text-white/50">
                {finding ? (
                  <svg viewBox="0 0 120 28" className="h-8 w-24 text-mint" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M10 14 Q 30 4, 50 14 T 90 14 T 110 14"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                    >
                      <animate
                        attributeName="d"
                        dur="2.5s"
                        repeatCount="indefinite"
                        values="
                          M10 14 Q 30 4, 50 14 T 90 14 T 110 14;
                          M10 14 Q 30 24, 50 14 T 90 14 T 110 14;
                          M10 14 Q 30 4, 50 14 T 90 14 T 110 14
                        "
                      />
                    </path>
                  </svg>
                ) : (
                  <Video size={25} />
                )}
              </span>
            )}
            <p className="mt-3 text-base font-semibold">{peer?.name || 'Random live'}</p>
            <p className="mt-2 text-sm text-white/48">{emptyText}</p>
            {tipText && <p className="mt-1 text-xs font-medium text-mint/80">{tipText}</p>}
            {!peer && !finding && onStart && (
              <button onClick={onStart} className="btn-primary mt-5 rounded-full px-5 py-3 text-sm font-semibold">
                Start VC
              </button>
            )}
            {!peer && finding && onCancel && (
              <button onClick={onCancel} className="btn-primary mt-5 rounded-full px-5 py-3 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white">
                Cancel Matching
              </button>
            )}
          </div>
        </div>
      )}
      <div className={`pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/70 via-black/20 to-transparent p-2 transition duration-300 sm:p-3 ${chromeVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <div className="pointer-events-auto min-w-0 rounded-[15px] bg-black/38 px-2.5 py-1.5 text-left backdrop-blur-md sm:rounded-2xl sm:px-3 sm:py-2">
              <p className="truncate text-xs font-semibold text-white sm:text-base">{peer?.name || (finding ? 'Searching...' : 'Random live')}</p>
              <p className="mt-0.5 text-[11px] font-semibold capitalize text-white/52">{status || 'idle'}</p>
            </div>
            <div className="pointer-events-auto hidden sm:block">
              {modeTabs}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="pointer-events-auto sm:hidden">
              {modeTabs}
            </div>
            <button
              type="button"
              onClick={onToggleFocus}
              className="pointer-events-auto grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/42 text-white/82 backdrop-blur-md transition hover:bg-white/12 sm:h-10 sm:w-10"
              aria-label={focused ? 'Exit full screen random chat' : 'Open full screen random chat'}
            >
              {focused ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
          </div>
        </div>
      </div>
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/78 via-black/22 to-transparent px-2 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-10 transition duration-300 sm:px-3 ${chromeVisible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}>
        <div className="pointer-events-auto mx-auto grid w-full max-w-md grid-cols-3 gap-2 rounded-[24px] bg-[#171f33]/65 border border-white/5 p-2 backdrop-blur-md sm:max-w-3xl sm:grid-cols-6 sm:gap-3 sm:rounded-full sm:p-2.5">
          {actions}
        </div>
      </div>
    </div>
  );
}

function ModeTabs({ value, onChange }) {
  const modes = [
    { value: 'chat', label: 'Chat', icon: MessageCircle },
    { value: 'video', label: 'Video', icon: Video }
  ];

  return (
    <div data-no-tab-swipe className="glass-panel p-1 rounded-full flex gap-1 relative shadow-inner">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const active = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
              active ? 'bg-accent text-white shadow-md' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Icon size={14} />
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function formatCountdown(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function LocalPreview({ stream, videoRef, cameraOff, chromeVisible }) {
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream, videoRef, cameraOff]);

  return (
    <div className={`absolute right-2 top-14 z-10 h-20 w-16 overflow-hidden rounded-[14px] bg-slate-950 shadow-[0_18px_42px_rgba(0,0,0,0.45)] transition duration-300 sm:right-4 sm:top-20 sm:h-28 sm:w-24 lg:h-28 lg:w-24 ${chromeVisible ? 'opacity-100' : 'opacity-45'}`}>
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

function CircleControl({ icon: Icon, label, onClick, disabled, primary, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-[10px] font-semibold capitalize disabled:opacity-35 sm:h-12 sm:px-3.5 sm:text-xs ${primary ? 'btn-primary' : danger ? 'bg-rose/12 text-rose hover:bg-rose/18' : 'bg-white/10 text-white/82 hover:bg-white/16'} ${label.includes('3:00') ? 'ring-1 ring-mint/45' : ''}`}
    >
      <Icon size={17} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function ConnectionQualityIndicator({ state }) {
  if (state !== 'connected' && state !== 'connecting') return null;
  const bars = state === 'connected' ? 3 : 1;
  return (
    <div className="flex items-center gap-1 py-0.5 px-2 bg-surface-hover rounded-xl" title="WebRTC Connection Quality">
      <div className="flex items-end gap-0.5 h-3">
        <div className={`w-0.5 rounded-t-sm h-1.5 ${bars >= 1 ? 'bg-success' : 'bg-border-default'}`} />
        <div className={`w-0.5 rounded-t-sm h-2.5 ${bars >= 2 ? 'bg-success' : 'bg-border-default'}`} />
        <div className={`w-0.5 rounded-t-sm h-3.5 ${bars >= 3 ? 'bg-success' : 'bg-border-default'}`} />
      </div>
    </div>
  );
}

function EmptyRandom({ finding, queueText, activeUsers }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden py-8 px-4"
    >
      <div className="relative w-full max-w-sm aspect-square flex items-center justify-center">
        {finding && (
          <>
            <div className="pulse-circle" style={{ animationDelay: '0s' }}></div>
            <div className="pulse-circle" style={{ animationDelay: '1s' }}></div>
            <div className="pulse-circle" style={{ animationDelay: '2s' }}></div>
          </>
        )}
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center shadow-[0_0_40px_rgba(124,58,237,0.3)] animate-bounce duration-[2000ms]">
            <Shuffle className="text-white text-5xl" size={40} />
          </div>
          <div className="mt-8 text-center">
            <h2 className="text-xl font-semibold text-accent animate-pulse">
              {finding ? 'Searching...' : 'Ready to Match'}
            </h2>
            <p className="text-xs text-text-muted mt-2">
              {finding ? queueText : 'Connecting you with someone electric'}
            </p>
          </div>
        </div>
      </div>
      {activeUsers > 0 && !finding && (
        <p className="mt-4 text-[11px] font-semibold text-accent bg-accent-light px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
          {activeUsers} {activeUsers === 1 ? 'user' : 'users'} active now
        </p>
      )}
    </motion.div>
  );
}

function SafetyModal({ open, onClose, onAgree }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4 backdrop-blur">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-sm bg-surface p-5 shadow-elevated">
        <span className="tone-ring grid h-12 w-12 place-items-center rounded-2xl bg-accent-light text-accent">
          <ShieldCheck size={23} />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-text-primary">Before you start</h3>
        <div className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
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

function ElectricCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let sparks = [];
    let animationFrameId;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resize);
    resize();

    class Spark {
      constructor() {
        this.init();
      }

      init() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 1.5;
        this.speedY = (Math.random() - 0.5) * 1.5;
        this.opacity = Math.random() * 0.5 + 0.2;
        this.life = Math.random() * 100 + 50;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life--;
        if (this.life <= 0) this.init();
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(124, 58, 237, ${this.opacity})`;
        ctx.fill();

        sparks.forEach(other => {
          let dx = this.x - other.x;
          let dy = this.y - other.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(124, 58, 237, ${0.08 * (1 - dist / 80)})`;
            ctx.stroke();
          }
        });
      }
    }

    for (let i = 0; i < 40; i++) {
      sparks.push(new Spark());
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparks.forEach(s => {
        s.update();
        s.draw();
      });
      animationFrameId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="electric-canvas" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, opacity: 0.4 }} />;
}


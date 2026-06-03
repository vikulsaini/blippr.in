import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Flag, Loader2, MessageCircle, Mic, MicOff, PhoneOff, Send, Shuffle, UserPlus, Video, VideoOff } from 'lucide-react';
import UserProfileModal from '../components/UserProfileModal.jsx';
import { api } from '../lib/api.js';
import { getRealtimeSocket } from '../lib/realtime.js';
import { createPeer, getCallMediaStream, getRtcIceServers } from '../lib/webrtc.js';

const waitingLines = [
  'Looking for someone active...',
  'Pairing you with a random online user...',
  'Keeping friends and blocked users out of this queue...'
];

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
  const [incomingVideoInvite, setIncomingVideoInvite] = useState(false);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteIceQueueRef = useRef([]);
  const sessionRef = useRef(null);
  const callStateRef = useRef('idle');
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const peer = session?.peer;
  const waitingText = useMemo(() => waitingLines[Math.floor(Math.random() * waitingLines.length)], [finding]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    const socket = getRealtimeSocket();

    function handleMatched({ chat, peer: matchedPeer }) {
      startSession(chat, matchedPeer);
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

  function startSession(chat, matchedPeer) {
    getRealtimeSocket().emit('chat:join', { chatId: chat._id });
    setSession({ chat, peer: matchedPeer });
    setMessages([]);
    setFriendSent(false);
    setFinding(false);
    setStatus(`Connected with @${matchedPeer?.username || 'stranger'}`);
  }

  async function findStranger(next = false) {
    if (finding) return;
    setFinding(true);
    setStatus(waitingText);
    cleanupCall(false);
    const currentChatId = sessionRef.current?.chat?._id;
    if (next && currentChatId) {
      getRealtimeSocket().emit('stranger:next', { chatId: currentChatId }, handleFindAck);
      setSession(null);
      setMessages([]);
      return;
    }
    getRealtimeSocket().emit('stranger:find', { interests: [] }, handleFindAck);
  }

  function handleFindAck(result = {}) {
    if (!result.ok) {
      setFinding(false);
      setStatus(result.message || 'Could not start random chat');
      return;
    }
    if (result.matched) {
      startSession(result.chat, result.peer);
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

  async function sendMessage(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value || !session?.chat?._id) return;
    setText('');
    getRealtimeSocket().emit('message:send', { chatId: session.chat._id, text: value }, (result) => {
      if (!result?.ok) setStatus(result?.message || 'Message failed');
      else setMessages((current) => (current.some((item) => item._id === result.message._id) ? current : [...current, result.message]));
    });
  }

  async function sendFriendRequest() {
    if (!peer?._id || friendSent) return;
    try {
      await api('/api/friends/requests', { method: 'POST', body: JSON.stringify({ userId: peer._id }) });
      setFriendSent(true);
      setStatus('Friend request sent. If they accept, this moves to Chats.');
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
      findStranger(true);
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
    if (incomingVideoInvite) {
      await acceptVideoChat();
      return;
    }
    if (callState !== 'idle') return;
    try {
      setCallState('inviting');
      setStatus(`Inviting @${peer.username || 'stranger'} to video chat...`);
      sendSignal('video-invite', {});
    } catch (error) {
      cleanupCall();
      setStatus(error.message || 'Camera or microphone permission failed');
    }
  }

  async function acceptVideoChat() {
    if (!sessionRef.current?.chat?._id || !sessionRef.current?.peer?._id) return;
    try {
      setIncomingVideoInvite(false);
      setCallState('connecting');
      setStatus('Starting video chat...');
      await ensureLocalStream();
      sendSignal('video-accept', {});
    } catch (error) {
      sendSignal('video-reject', { reason: error.message });
      cleanupCall(false);
      setStatus(error.message || 'Camera or microphone permission failed');
    }
  }

  function rejectVideoChat() {
    if (incomingVideoInvite) {
      sendSignal('video-reject', { reason: 'Video request declined' });
      setIncomingVideoInvite(false);
      setStatus('Video request declined');
      return;
    }
    cleanupCall();
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

    if (type === 'video-invite') {
      if (callStateRef.current !== 'idle') {
        sendSignal('video-reject', { reason: 'Already in a video chat' });
        return;
      }
      setIncomingVideoInvite(true);
      setStatus(`${sessionRef.current.peer?.name || 'Stranger'} wants to start video chat.`);
      return;
    }

    if (type === 'video-accept') {
      if (callStateRef.current !== 'inviting') return;
      setCallState('connecting');
      setStatus('Connecting video chat...');
      await createAndSendOffer();
      return;
    }

    if (type === 'video-reject') {
      cleanupCall(false);
      setStatus(payload?.reason || 'Video request was declined');
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
      setCallState('connecting');
      await nextPeer.setRemoteDescription(new RTCSessionDescription(payload));
      await flushRemoteIceQueue();
      const answer = await nextPeer.createAnswer();
      await nextPeer.setLocalDescription(answer);
      sendSignal('answer', answer);
    }

    if (type === 'answer') {
      await nextPeer.setRemoteDescription(new RTCSessionDescription(payload));
      await flushRemoteIceQueue();
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
    setIncomingVideoInvite(false);
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

  return (
    <div className="mx-auto grid h-full min-h-[calc(100dvh-7rem)] w-full max-w-6xl gap-4 pb-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
      <section className="depth-panel flex min-h-[30rem] flex-col overflow-hidden rounded-[28px]">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose">Random live</p>
            <h2 className="truncate text-xl font-semibold">{peer ? peer.name : finding ? 'Searching...' : 'Meet someone new'}</h2>
            <p className="truncate text-xs text-white/48">{status}</p>
          </div>
          <button onClick={() => findStranger(true)} className="btn-primary flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
            {finding ? <Loader2 className="animate-spin" size={17} /> : <Shuffle size={17} />}
            Next
          </button>
        </div>

        <div className="grid flex-1 gap-3 p-3 md:grid-cols-2">
          <VideoPanel label="You" stream={localStream} videoRef={localVideoRef} muted local emptyText="Start video when you are ready" />
          <VideoPanel label={peer?.name || 'Stranger'} stream={remoteStream} videoRef={remoteVideoRef} emptyText={finding ? 'Waiting for a person...' : 'Remote video appears here'} />
        </div>

        <div className="grid gap-2 border-t border-white/8 p-3 sm:grid-cols-5">
          <ControlButton onClick={startVideoChat} disabled={!session || (!incomingVideoInvite && callState !== 'idle')} icon={Video} label={incomingVideoInvite ? 'Accept' : callState === 'idle' ? 'Video' : callState} primary />
          <ControlButton onClick={toggleMute} disabled={!localStream} icon={muted ? MicOff : Mic} label={muted ? 'Muted' : 'Mic'} />
          <ControlButton onClick={toggleCamera} disabled={!localStream} icon={cameraOff ? VideoOff : Video} label={cameraOff ? 'Hidden' : 'Camera'} />
          <ControlButton onClick={rejectVideoChat} disabled={callState === 'idle' && !incomingVideoInvite} icon={PhoneOff} label={incomingVideoInvite ? 'Decline' : 'End'} danger />
          <ControlButton onClick={reportPeer} disabled={!peer} icon={Flag} label="Report" danger />
        </div>
      </section>

      <aside className="depth-panel flex min-h-[30rem] flex-col overflow-hidden rounded-[28px]">
        <div className="border-b border-white/8 p-4">
          {peer ? (
            <div className="flex items-center gap-3">
              <button onClick={() => setProfileUser(peer)} className="relative">
                <img src={peer.avatar} alt="" className="h-12 w-12 rounded-2xl object-cover" />
                <span className="live-dot absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-mint text-mint" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{peer.name}</p>
                <p className="truncate text-xs text-white/48">@{peer.username} - {peer.gender} - {peer.age}</p>
              </div>
              <button onClick={sendFriendRequest} disabled={friendSent} className={`grid h-11 w-11 place-items-center rounded-full ${friendSent ? 'bg-mint text-ink' : 'btn-primary'}`} aria-label="Send friend request">
                {friendSent ? <Check size={18} /> : <UserPlus size={18} />}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/8 text-rose"><MessageCircle size={21} /></span>
              <div>
                <p className="font-semibold">Random chat</p>
                <p className="text-xs text-white/48">Text first, start video when both sides are ready.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {!session && (
            <EmptyRandom finding={finding} onStart={() => findStranger(false)} />
          )}
          {messages.map((message) => {
            const mine = (message.sender?._id || message.sender) !== peer?._id;
            return (
              <div key={message._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-mint text-ink' : 'bg-white/8 text-white'}`}>
                  {message.text}
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={sendMessage} className="flex gap-2 border-t border-white/8 p-3">
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

      <UserProfileModal user={profileUser} onClose={() => setProfileUser(null)} />
    </div>
  );
}

function VideoPanel({ label, stream, videoRef, muted = false, local = false, emptyText }) {
  return (
    <div className="relative min-h-[16rem] overflow-hidden rounded-[24px] border border-white/8 bg-black/35">
      {stream ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className={`h-full min-h-[16rem] w-full object-cover ${local ? 'scale-x-[-1]' : ''}`} />
      ) : (
        <div className="grid h-full min-h-[16rem] place-items-center p-6 text-center">
          <div>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/8 text-white/50"><Video size={24} /></span>
            <p className="mt-3 text-sm text-white/48">{emptyText}</p>
          </div>
        </div>
      )}
      <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-ink/70 px-3 py-1 text-xs font-semibold backdrop-blur">{label}</span>
    </div>
  );
}

function ControlButton({ icon: Icon, label, onClick, disabled, primary, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-semibold capitalize disabled:opacity-35 ${primary ? 'btn-primary' : danger ? 'bg-rose/12 text-rose hover:bg-rose/18' : 'btn-secondary'}`}
    >
      <Icon size={17} />
      {label}
    </button>
  );
}

function EmptyRandom({ finding, onStart }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid h-full min-h-[18rem] place-items-center text-center">
      <div>
        <span className="tone-ring mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose/10 text-rose">
          {finding ? <Loader2 className="animate-spin" size={24} /> : <Shuffle size={24} />}
        </span>
        <p className="mt-4 font-semibold">{finding ? 'Waiting for someone' : 'Start random chat'}</p>
        <p className="mx-auto mt-1 max-w-64 text-sm leading-6 text-white/50">
          {finding ? 'You will connect automatically when another online user joins.' : 'Meet a random online user, talk live, and send a friend request if it clicks.'}
        </p>
        {!finding && (
          <button onClick={onStart} className="btn-primary mt-5 rounded-full px-5 py-3 text-sm font-semibold">
            Find stranger
          </button>
        )}
      </div>
    </motion.div>
  );
}

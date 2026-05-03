import { useEffect, useRef, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { Search } from 'lucide-react';
import CallOverlay from '../components/CallOverlay.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import UserProfileModal from '../components/UserProfileModal.jsx';
import { api } from '../lib/api.js';
import { presenceText } from '../lib/presence.js';
import { getRealtimeSocket } from '../lib/realtime.js';
import { playMessageSound, startCallSound, stopCallSound, vibrate } from '../lib/sounds.js';
import { createPeer } from '../lib/webrtc.js';

export default function Chats() {
  const location = useLocation();
  const { setBottomNavHidden } = useOutletContext() || {};
  const [me, setMe] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [profileChat, setProfileChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [calls, setCalls] = useState([]);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [typingChatId, setTypingChatId] = useState(null);
  const [call, setCall] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const typingTimerRef = useRef(null);
  const callRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const vibrationTimerRef = useRef(null);
  const callTimeoutRef = useRef(null);

  function mergeChat(updatedChat, unreadCount) {
    setChats((current) => {
      const withCount = { ...updatedChat, unreadCount };
      const rest = current.filter((chat) => chat._id !== updatedChat._id);
      return [withCount, ...rest].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    });
    setActiveChat((current) => (current?._id === updatedChat._id ? { ...updatedChat, unreadCount } : current));
  }

  function mergeCall(updatedCall) {
    if (!updatedCall?._id) return;
    setCalls((current) => {
      const rest = current.filter((callItem) => callItem._id !== updatedCall._id);
      return [...rest, updatedCall].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });
  }

  function openProfile(user, chat) {
    setProfileUser(user);
    setProfileChat(chat);
  }

  function closeProfile() {
    setProfileUser(null);
    setProfileChat(null);
  }

  function updateCall(next) {
    callRef.current = typeof next === 'function' ? next(callRef.current) : next;
    setCall(callRef.current);
  }

  function clearCallTimeout() {
    if (callTimeoutRef.current) window.clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = null;
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

  function startRingtone({ tone = 'incoming', vibrate = false } = {}) {
    stopRingtone();
    startCallSound({ outgoing: tone === 'outgoing' });
    if (vibrate) {
      const pattern = [700, 220, 700, 220, 1000];
      vibrate(pattern);
      vibrationTimerRef.current = window.setInterval(() => vibrate(pattern), 2600);
    }
  }

  function stopRingtone() {
    if (vibrationTimerRef.current) window.clearInterval(vibrationTimerRef.current);
    vibrationTimerRef.current = null;
    stopCallSound();
  }

  function showIncomingCallNotification(fromUser, callType) {
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
    async function load() {
      const [{ user }, { chats: loadedChats }] = await Promise.all([
        api('/api/users/me'),
        api('/api/chats')
      ]);
      setMe(user);
      setChats(loadedChats);
      const requestedChatId = new URLSearchParams(location.search).get('chat');
      setActiveChat(requestedChatId ? loadedChats.find((chat) => chat._id === requestedChatId) || null : null);
    }
    load().catch(() => {});
  }, [location.search]);

  useEffect(() => {
    setBottomNavHidden?.(!!activeChat);
    return () => setBottomNavHidden?.(false);
  }, [activeChat, setBottomNavHidden]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    const handleChatUpdated = ({ chat, unreadCount = 0 }) => mergeChat(chat, unreadCount);
    const handleChatRemoved = ({ chatId }) => {
      setChats((current) => current.filter((chat) => chat._id !== chatId));
      setActiveChat((current) => (current?._id === chatId ? null : current));
      setProfileChat((current) => (current?._id === chatId ? null : current));
    };
    const handlePresence = ({ userId, isOnline }) => {
      setChats((current) =>
        current.map((chat) => ({
          ...chat,
          members: chat.members.map((member) =>
            member._id === userId ? { ...member, isOnline, lastSeenAt: isOnline ? member.lastSeenAt : new Date().toISOString() } : member
          )
        }))
      );
    };
    const handleAccepted = ({ chat }) => mergeChat(chat, 0);

    socket.on('chat:updated', handleChatUpdated);
    socket.on('chat:removed', handleChatRemoved);
    socket.on('presence:update', handlePresence);
    socket.on('friend:request:accepted', handleAccepted);

    return () => {
      socket.off('chat:updated', handleChatUpdated);
      socket.off('chat:removed', handleChatRemoved);
      socket.off('presence:update', handlePresence);
      socket.off('friend:request:accepted', handleAccepted);
    };
  }, []);

  useEffect(() => {
    const socket = getRealtimeSocket();

    const handleIncomingCall = ({ callId, from, fromUser, offer, callType }) => {
      if (callRef.current) {
        socket.emit('call:reject', { to: from, callId });
        return;
      }
      startRingtone({ tone: 'incoming', vibrate: true });
      showIncomingCallNotification(fromUser, callType);
      updateCall({
        status: 'incoming',
        direction: 'incoming',
        type: callType,
        callId,
        peerUser: findUserById(from, fromUser),
        offer,
        muted: false,
        cameraOff: false,
        speakerOn: callType === 'video'
      });
      scheduleCallTimeout(findUserById(from, fromUser), callId);
    };

    const handleAnswer = async ({ answer, callId }) => {
      if (callRef.current?.callId !== callId || !peerRef.current) return;
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      stopRingtone();
      clearCallTimeout();
      updateCall((current) => ({ ...current, status: 'connected' }));
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (!peerRef.current || !candidate) return;
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore stale candidates after a call is closed.
      }
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
  }, [activeChat, chats]);

  useEffect(() => () => stopRingtone(), []);

  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      setCalls([]);
      return;
    }
    const socket = getRealtimeSocket();
    socket.emit('chat:join', { chatId: activeChat._id });
    Promise.all([
      api(`/api/chats/${activeChat._id}/messages`),
      api(`/api/chats/${activeChat._id}/calls`)
    ])
      .then(async ([messageData, callData]) => {
        setMessages(messageData.messages);
        setCalls(callData.calls || []);
        await api(`/api/chats/${activeChat._id}/read`, { method: 'PATCH' });
        setChats((current) => current.map((chat) => (chat._id === activeChat._id ? { ...chat, unreadCount: 0 } : chat)));
      })
      .catch(() => {
        setMessages([]);
        setCalls([]);
      });
  }, [activeChat]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    const handleMessage = ({ message }) => {
      const mine = (message.sender?._id || message.sender) === me?._id;
      if (!mine && (!activeChat || message.chat !== activeChat._id || document.visibilityState !== 'visible')) {
        playMessageSound();
      }
      setMessages((current) => {
        if (current.some((item) => item._id === message._id)) return current;
        return [...current, message];
      });
    };
    const handleReaction = ({ messageId, reactions }) => {
      setMessages((current) => current.map((message) => (message._id === messageId ? { ...message, reactions } : message)));
    };
    const handleTypingStart = ({ chatId, userId }) => {
      if (userId !== me?._id) setTypingChatId(chatId);
    };
    const handleTypingStop = ({ chatId, userId }) => {
      if (userId !== me?._id) setTypingChatId((current) => (current === chatId ? null : current));
    };
    socket.on('message:new', handleMessage);
    socket.on('message:reaction', handleReaction);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    return () => {
      socket.off('message:new', handleMessage);
      socket.off('message:reaction', handleReaction);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
    };
  }, [activeChat, me?._id]);

  async function sendMessage(event) {
    event.preventDefault();
    if (!activeChat || !text.trim()) return;
    const { message } = await api(`/api/chats/${activeChat._id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text: text.trim(), replyTo: replyTo?._id })
    });
    setMessages((current) => (current.some((item) => item._id === message._id) ? current : [...current, message]));
    handleTextChange('');
    setReplyTo(null);
  }

  function handleTextChange(value) {
    setText(value);
    if (!activeChat) return;

    const socket = getRealtimeSocket();
    socket.emit(value ? 'typing:start' : 'typing:stop', { chatId: activeChat._id });
    clearTimeout(typingTimerRef.current);
    if (value) {
      typingTimerRef.current = setTimeout(() => {
        socket.emit('typing:stop', { chatId: activeChat._id });
      }, 900);
    }
  }

  useEffect(() => {
    return () => {
      clearTimeout(typingTimerRef.current);
      if (activeChat) getRealtimeSocket().emit('typing:stop', { chatId: activeChat._id });
    };
  }, [activeChat]);

  async function reactToMessage(messageId, emoji) {
    const { message } = await api(`/api/chats/${activeChat._id}/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    });
    setMessages((current) => current.map((item) => (item._id === messageId ? message : item)));
  }

  async function updateNickname(chatId, userId, nickname) {
    const { chat } = await api(`/api/chats/${chatId}/nicknames`, {
      method: 'PATCH',
      body: JSON.stringify({ userId, nickname })
    });
    mergeChat(chat, chat.unreadCount || 0);
    setProfileChat(chat);
  }

  async function unfriendChat(chatId) {
    await api(`/api/chats/${chatId}`, { method: 'DELETE' });
    setChats((current) => current.filter((chat) => chat._id !== chatId));
    setActiveChat((current) => (current?._id === chatId ? null : current));
    closeProfile();
  }

  async function blockUser(userId, chatId) {
    await api('/api/safety/block', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
    if (chatId) await unfriendChat(chatId);
  }

  async function reportUser(userId, reason) {
    await api('/api/safety/report', {
      method: 'POST',
      body: JSON.stringify({ userId, reason, notes: 'Reported from chat profile.' })
    });
  }

  async function getLocalStream(type) {
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: type === 'video' ? { facingMode: 'user' } : false
    };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      if (error.name !== 'OverconstrainedError' && error.name !== 'ConstraintNotSatisfiedError') throw error;
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' ? true : false });
    }
    localStreamRef.current = stream;
    return stream;
  }

  function createCallPeer(peerUser) {
    const socket = getRealtimeSocket();
    const peer = createPeer({
      onTrack: (remoteStream) => updateCall((current) => ({ ...current, remoteStream })),
      onIceCandidate: (candidate) => socket.emit('call:ice-candidate', { to: peerUser._id, candidate })
    });
    peerRef.current = peer;
    return peer;
  }

  async function startCall(type) {
    const peerUser = activeChat?.members?.find((member) => member._id !== me?._id);
    if (!peerUser || !navigator.mediaDevices?.getUserMedia) return;

    try {
      startRingtone({ tone: 'outgoing' });
      const localStream = await getLocalStream(type);
      const peer = createCallPeer(peerUser);
      localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      updateCall({ status: 'calling', direction: 'outgoing', type, peerUser, localStream, muted: false, cameraOff: false, speakerOn: type === 'video' });
      getRealtimeSocket().emit('call:offer', { to: peerUser._id, offer, callType: type }, (ack) => {
        if (ack?.ok) {
          updateCall((current) => ({ ...current, callId: ack.callId }));
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
      const peer = createCallPeer(currentCall.peerUser);
      localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
      await peer.setRemoteDescription(new RTCSessionDescription(currentCall.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      getRealtimeSocket().emit('call:answer', { to: currentCall.peerUser._id, answer, callId: currentCall.callId });
      clearCallTimeout();
      updateCall((callState) => ({ ...callState, status: 'connected', localStream, speakerOn: currentCall.type === 'video' || callState?.speakerOn }));
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
    stopRingtone();
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    updateCall(null);
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
    updateCall((current) => ({ ...current, speakerOn: !current?.speakerOn }));
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

  const visibleChats = chats.filter((chat) => {
    const other = chat.members?.find((member) => member._id !== me?._id);
    const displayName = getNickname(chat, me?._id, other);
    const value = `${displayName} ${other?.name || ''} ${other?.username || ''} ${chat.lastMessage?.text || ''} ${callPreview(chat.lastCall, me?._id)}`.toLowerCase();
    return value.includes(query.trim().toLowerCase());
  });

  return (
    <div className={activeChat ? 'min-h-dvh' : 'min-h-[calc(100vh-6.5rem)]'}>
      {activeChat ? (
        <ChatWindow
          chat={activeChat}
          messages={messages}
          calls={calls}
          currentUserId={me?._id}
          text={text}
          setText={handleTextChange}
          onSend={sendMessage}
          onBack={() => setActiveChat(null)}
          onProfile={(user) => openProfile(user, activeChat)}
          replyTo={replyTo}
          onReply={setReplyTo}
          onCancelReply={() => setReplyTo(null)}
          onReact={reactToMessage}
          onStartCall={startCall}
          isTyping={typingChatId === activeChat._id}
        />
      ) : (
        <section className="min-h-[calc(100vh-6.5rem)] space-y-1 px-4 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Chats</h2>
              <p className="text-sm text-white/45">{chats.length} friends</p>
            </div>
          </div>
          <label className="mb-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
            <Search size={18} className="text-white/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder="Search friends or messages"
            />
          </label>
          {visibleChats.map((chat) => {
            const other = chat.members?.find((member) => member._id !== me?._id);
            const displayName = getNickname(chat, me?._id, other);
            return (
              <article key={chat._id} className={`flex w-full items-center gap-3 border-b border-white/8 px-1 py-2.5 text-left ${chat.unreadCount ? 'bg-mint/8' : ''}`}>
                <button onClick={() => other && openProfile(other, chat)} aria-label={`View ${displayName || 'friend'} profile`}>
                  {other?.avatar ? <img src={other.avatar} alt="" className="h-10 w-10 rounded-2xl object-cover" /> : <div className="h-10 w-10 rounded-2xl bg-white/10" />}
                </button>
                <button onClick={() => setActiveChat(chat)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium">{displayName || 'Friend'}</p>
                    <span className={`h-2 w-2 rounded-full ${other?.isOnline ? 'bg-mint' : 'bg-white/25'}`} />
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className={`truncate text-xs ${typingChatId === chat._id ? 'font-semibold text-mint' : chat.unreadCount ? 'font-semibold text-white' : 'text-white/45'}`}>
                      {typingChatId === chat._id ? 'typing...' : chat.lastMessage?.text || callPreview(chat.lastCall, me?._id) || presenceText(other)}
                    </p>
                    {chat.unreadCount > 0 && (
                      <span className="shrink-0 rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold text-ink">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              </article>
            );
          })}
          {!chats.length && (
            <div className="glass rounded-3xl p-6 text-center">
              <p className="font-medium">No friends yet</p>
              <p className="mt-1 text-sm text-white/55">Accept a request or send one from Discover to start chatting.</p>
            </div>
          )}
          {chats.length > 0 && !visibleChats.length && (
            <div className="rounded-3xl border border-white/10 bg-white/8 p-6 text-center">
              <p className="font-medium">No chats found</p>
              <p className="mt-1 text-sm text-white/45">Try another name or message.</p>
            </div>
          )}
        </section>
      )}
      <UserProfileModal
        user={profileUser}
        chat={profileChat}
        currentUserId={me?._id}
        onClose={closeProfile}
        onNickname={updateNickname}
        onUnfriend={unfriendChat}
        onBlock={blockUser}
        onReport={reportUser}
      />
      <CallOverlay
        call={call}
        onAccept={acceptCall}
        onReject={rejectCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onSwitchCamera={switchCamera}
        onToggleSpeaker={toggleSpeaker}
      />
    </div>
  );
}

function getNickname(chat, currentUserId, user) {
  if (!user) return '';
  return chat?.nicknames?.[`${currentUserId}:${user._id}`] || user.name;
}

function callPreview(call, currentUserId) {
  if (!call) return '';
  const mine = (typeof call.caller === 'string' ? call.caller : call.caller?._id) === currentUserId;
  const direction = mine ? 'Outgoing' : 'Incoming';
  const status = call.status === 'rejected' ? 'declined' : call.status === 'missed' ? 'missed' : call.status === 'ringing' ? 'ringing' : 'ended';
  return `${direction} ${call.type} call ${status}`;
}

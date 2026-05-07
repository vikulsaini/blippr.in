import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { Pin, Search, Star, Trash2, X } from 'lucide-react';
import CallOverlay from '../components/CallOverlay.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import UserProfileModal from '../components/UserProfileModal.jsx';
import { api, getTokenSubject } from '../lib/api.js';
import { readCache, writeCache } from '../lib/cache.js';
import { presenceText } from '../lib/presence.js';
import { getRealtimeSocket } from '../lib/realtime.js';
import { playMessageSound, startCallSound, stopCallSound, vibrate as vibrateDevice } from '../lib/sounds.js';
import { createPeer } from '../lib/webrtc.js';

export default function Chats() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setBottomNavHidden } = useOutletContext() || {};
  const tokenUserId = normalizeId(getTokenSubject());
  const [me, setMe] = useState(() => readCache('me', 'global'));
  const [chats, setChats] = useState(() => readCache('chats', tokenUserId, []));
  const [activeChat, setActiveChat] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [profileChat, setProfileChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [calls, setCalls] = useState([]);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [typingChatId, setTypingChatId] = useState(null);
  const [call, setCall] = useState(null);
  const [callMinimized, setCallMinimized] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [selectedChats, setSelectedChats] = useState(new Set());
  const currentUserId = normalizeId(me?._id || tokenUserId);
  const typingTimerRef = useRef(null);
  const callRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const vibrationTimerRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const remoteIceQueueRef = useRef([]);
  const localIceQueueRef = useRef([]);
  const activeChatIdRef = useRef(null);

  function mergeChat(updatedChat, unreadCount) {
    setChats((current) => {
      const withCount = { ...updatedChat, unreadCount };
      const rest = current.filter((chat) => chat._id !== updatedChat._id);
      return sortChats([withCount, ...rest]);
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

  function closeConversation() {
    setActiveChat(null);
    setReplyTo(null);
    setText('');
    if (location.pathname !== '/app' || location.search) navigate('/app', { replace: true });
  }

  function clearSelection() {
    setSelectedChats(new Set());
  }

  function toggleSelect(chatId) {
    setSelectedChats((current) => {
      const next = new Set(current);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  }

  function handleChatOpen(chat) {
    if (selectedChats.size) {
      toggleSelect(chat._id);
      return;
    }
    setActiveChat(chat);
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
    const cachedMe = readCache('me', 'global');
    if (cachedMe) setMe(cachedMe);
    const cacheUserId = normalizeId(cachedMe?._id || tokenUserId);
    if (cacheUserId) {
      const cachedChats = readCache('chats', cacheUserId, []);
      if (cachedChats.length) setChats(cachedChats);
    }

    async function load() {
      const [{ user }, { chats: loadedChats }] = await Promise.all([
        api('/api/users/me'),
        api('/api/chats')
      ]);
      setMe(user);
      setChats(loadedChats);
      writeCache('me', user, 'global');
      writeCache('chats', loadedChats, user._id);
      const requestedChatId = new URLSearchParams(location.search).get('chat');
      if (requestedChatId) setActiveChat(loadedChats.find((chat) => chat._id === requestedChatId) || null);
    }
    load().catch(() => {});
  }, [location.search]);

  useEffect(() => {
    if (me) writeCache('me', me, 'global');
  }, [me]);

  useEffect(() => {
    if (currentUserId) writeCache('chats', chats, currentUserId);
  }, [chats, currentUserId]);

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
      startRingtone({ tone: 'incoming', shouldVibrate: true, peerId: from });
      setCallMinimized(false);
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
      await flushRemoteIceQueue();
      stopRingtone();
      clearCallTimeout();
      updateCall((current) => ({ ...current, status: 'connected' }));
    };

    const handleIceCandidate = async ({ candidate, callId }) => {
      if (callId && callRef.current?.callId && callRef.current.callId !== callId) return;
      if (!peerRef.current || !candidate) return;
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
  }, [activeChat, chats]);

  useEffect(() => () => stopRingtone(), []);

  useEffect(() => {
    activeChatIdRef.current = activeChat?._id || null;
    if (!activeChat) {
      setMessages([]);
      setCalls([]);
      return;
    }
    const socket = getRealtimeSocket();
    socket.emit('chat:join', { chatId: activeChat._id });
    if (currentUserId) {
      setMessages(readCache(`messages:${activeChat._id}`, currentUserId, []));
      setCalls(readCache(`calls:${activeChat._id}`, currentUserId, []));
    }
    Promise.all([
      api(`/api/chats/${activeChat._id}/messages`),
      api(`/api/chats/${activeChat._id}/calls`)
    ])
      .then(async ([messageData, callData]) => {
        if (activeChatIdRef.current !== activeChat._id) return;
        setMessages(messageData.messages);
        setCalls(callData.calls || []);
        if (currentUserId) {
          writeCache(`messages:${activeChat._id}`, messageData.messages, currentUserId);
          writeCache(`calls:${activeChat._id}`, callData.calls || [], currentUserId);
        }
        await api(`/api/chats/${activeChat._id}/read`, { method: 'PATCH' });
        setChats((current) => current.map((chat) => (chat._id === activeChat._id ? { ...chat, unreadCount: 0 } : chat)));
      })
      .catch(() => {
        if (!currentUserId) {
          setMessages([]);
          setCalls([]);
        }
      });
  }, [activeChat, currentUserId]);

  useEffect(() => {
    if (activeChat?._id && currentUserId) writeCache(`messages:${activeChat._id}`, messages, currentUserId);
  }, [messages, activeChat?._id, currentUserId]);

  useEffect(() => {
    if (activeChat?._id && currentUserId) writeCache(`calls:${activeChat._id}`, calls, currentUserId);
  }, [calls, activeChat?._id, currentUserId]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    const handleMessage = ({ message }) => {
      const mine = getMessageSenderId(message) === currentUserId;
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
    const handleEdited = ({ message }) => {
      setMessages((current) => current.map((item) => (item._id === message._id ? message : item)));
    };
    const handleDeleted = ({ messageId }) => {
      setMessages((current) => current.filter((message) => message._id !== messageId));
    };
    const handleDelivered = ({ userId }) => {
      if (normalizeId(userId) === currentUserId) return;
      setMessages((current) => current.map((message) => (getMessageSenderId(message) === currentUserId && message.status === 'sent' ? { ...message, status: 'delivered' } : message)));
    };
    const handleSeen = ({ userId }) => {
      if (normalizeId(userId) === currentUserId) return;
      setMessages((current) => current.map((message) => (getMessageSenderId(message) === currentUserId ? { ...message, status: 'seen' } : message)));
    };
    const handleTypingStart = ({ chatId, userId }) => {
      if (normalizeId(userId) !== currentUserId) setTypingChatId(chatId);
    };
    const handleTypingStop = ({ chatId, userId }) => {
      if (normalizeId(userId) !== currentUserId) setTypingChatId((current) => (current === chatId ? null : current));
    };
    socket.on('message:new', handleMessage);
    socket.on('message:reaction', handleReaction);
    socket.on('message:edited', handleEdited);
    socket.on('message:deleted', handleDeleted);
    socket.on('message:delivered', handleDelivered);
    socket.on('message:seen', handleSeen);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    return () => {
      socket.off('message:new', handleMessage);
      socket.off('message:reaction', handleReaction);
      socket.off('message:edited', handleEdited);
      socket.off('message:deleted', handleDeleted);
      socket.off('message:delivered', handleDelivered);
      socket.off('message:seen', handleSeen);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
    };
  }, [activeChat, currentUserId]);

  async function sendMessage(event) {
    event.preventDefault();
    if (!activeChat || !text.trim()) return;
    const messageText = text.trim();
    const repliedMessage = replyTo;
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      chat: activeChat._id,
      sender: currentUserId,
      text: messageText,
      replyTo: repliedMessage ? { _id: repliedMessage._id, text: repliedMessage.text, sender: repliedMessage.sender } : null,
      reactions: [],
      status: 'sending',
      createdAt: new Date().toISOString()
    };

    setMessages((current) => [...current, optimisticMessage]);
    setChats((current) =>
      current
        .map((chat) => (chat._id === activeChat._id ? { ...chat, lastMessage: optimisticMessage, updatedAt: optimisticMessage.createdAt } : chat))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    );
    handleTextChange('');
    setReplyTo(null);

    try {
      const { message } = await api(`/api/chats/${activeChat._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: messageText, replyTo: repliedMessage?._id })
      });
      setMessages((current) => current.map((item) => (item._id === tempId ? message : item)).filter((item, index, all) => all.findIndex((entry) => entry._id === item._id) === index));
    } catch {
      setMessages((current) => current.map((item) => (item._id === tempId ? { ...item, status: 'failed' } : item)));
    }
  }

  async function sendMedia(file) {
    if (!activeChat || !file) return;
    const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : 'file';
    const previewUrl = URL.createObjectURL(file);
    const tempId = `temp-media-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      chat: activeChat._id,
      sender: currentUserId,
      text: '',
      media: { url: previewUrl, type: kind, name: file.name, local: true },
      reactions: [],
      status: 'sending',
      createdAt: new Date().toISOString()
    };

    setMessages((current) => [...current, optimisticMessage]);
    setChats((current) =>
      current
        .map((chat) => (chat._id === activeChat._id ? { ...chat, lastMessage: optimisticMessage, updatedAt: optimisticMessage.createdAt } : chat))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    );
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { media } = await api('/api/media/upload', {
        method: 'POST',
        body: formData
      });
      const { message } = await api(`/api/chats/${activeChat._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ media })
      });
      setMessages((current) => current.map((item) => (item._id === tempId ? message : item)));
      URL.revokeObjectURL(previewUrl);
    } catch {
      setMessages((current) => current.map((item) => (item._id === tempId ? { ...item, status: 'failed' } : item)));
    }
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

  async function editMessage(messageId, nextText) {
    const previous = messages;
    setMessages((current) => current.map((message) => (message._id === messageId ? { ...message, text: nextText, editedAt: new Date().toISOString() } : message)));
    try {
      const { message } = await api(`/api/chats/${activeChat._id}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ text: nextText })
      });
      setMessages((current) => current.map((item) => (item._id === messageId ? message : item)));
    } catch {
      setMessages(previous);
    }
  }

  async function deleteMessage(messageId, scope = 'me') {
    const previous = messages;
    setMessages((current) => current.filter((message) => message._id !== messageId));
    try {
      await api(`/api/chats/${activeChat._id}/messages/${messageId}?scope=${scope}`, { method: 'DELETE' });
    } catch {
      setMessages(previous);
    }
  }

  async function reportMessage(message) {
    const other = activeChat?.members?.find((member) => normalizeId(member) !== currentUserId);
    if (!other) return;
    await api('/api/safety/report', {
      method: 'POST',
      body: JSON.stringify({
        userId: other._id,
        reason: 'Reported message',
        notes: `Message ${message._id}: ${message.text || '[media]'}`
      })
    });
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

  async function hideSelectedChats() {
    const ids = [...selectedChats];
    if (!ids.length) return;
    const ok = window.confirm(`Delete ${ids.length} selected chat${ids.length > 1 ? 's' : ''} from your chat list?`);
    if (!ok) return;
    const previousChats = chats;
    try {
      clearSelection();
      setChats((current) => current.filter((chat) => !ids.includes(chat._id)));
      await Promise.all(ids.map((chatId) => api(`/api/chats/${chatId}/hide`, { method: 'PATCH' })));
    } catch (err) {
      setChats(previousChats);
      window.alert(err.message || 'Could not delete selected chats');
    }
  }

  async function setSelectedPreference(kind) {
    const ids = [...selectedChats];
    if (!ids.length) return;
    const enabled = ids.some((chatId) => !chats.find((chat) => chat._id === chatId)?.[kind === 'pin' ? 'pinned' : 'starred']);
    const path = kind === 'pin' ? 'pin' : 'star';
    const flag = kind === 'pin' ? 'pinned' : 'starred';
    setChats((current) => sortChats(current.map((chat) => (ids.includes(chat._id) ? { ...chat, [flag]: enabled } : chat))));
    clearSelection();
    await Promise.all(ids.map((chatId) => api(`/api/chats/${chatId}/${path}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }).catch(() => null)));
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
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000
      },
      video: type === 'video' ? { facingMode: 'user', width: { ideal: 640, max: 960 }, height: { ideal: 360, max: 540 }, frameRate: { ideal: 24, max: 30 } } : false
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

  function createCallPeer(peerUser) {
    const peer = createPeer({
      onTrack: (remoteStream) => updateCall((current) => ({ ...current, remoteStream })),
      onIceCandidate: (candidate) => emitIceCandidate(peerUser, candidate),
      onConnectionStateChange: (state) => {
        if (state === 'connected') updateCall((current) => ({ ...current, status: 'connected' }));
        if (state === 'disconnected') updateCall((current) => ({ ...current, status: current?.status === 'connected' ? 'reconnecting' : current?.status }));
        if (state === 'failed') cleanupCall();
      }
    });
    peerRef.current = peer;
    return peer;
  }

  async function startCall(type) {
    const peerUser = activeChat?.members?.find((member) => normalizeId(member) !== currentUserId);
    if (!peerUser || !navigator.mediaDevices?.getUserMedia) return;

    try {
      startRingtone({ tone: 'outgoing', peerId: peerUser._id });
      const localStream = await getLocalStream(type);
      const peer = createCallPeer(peerUser);
      localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      updateCall({ status: 'calling', direction: 'outgoing', type, peerUser, localStream, muted: false, cameraOff: false, speakerOn: type === 'video' });
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
      const peer = createCallPeer(currentCall.peerUser);
      localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
      await peer.setRemoteDescription(new RTCSessionDescription(currentCall.offer));
      await flushRemoteIceQueue();
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
    const other = chat.members?.find((member) => normalizeId(member) !== currentUserId);
    const displayName = getNickname(chat, currentUserId, other);
    const value = `${displayName} ${other?.name || ''} ${other?.username || ''} ${chat.lastMessage?.text || ''} ${callPreview(chat.lastCall, currentUserId)}`.toLowerCase();
    return value.includes(query.trim().toLowerCase());
  });

  return (
    <div className={activeChat ? 'h-full min-h-0' : 'flex h-full min-h-0 flex-col'}>
      {activeChat ? (
        <ChatWindow
          chat={activeChat}
          messages={messages}
          calls={calls}
          currentUserId={currentUserId}
          text={text}
          setText={handleTextChange}
          onSend={sendMessage}
          onSendMedia={sendMedia}
          onBack={closeConversation}
          onProfile={(user) => openProfile(user, activeChat)}
          replyTo={replyTo}
          onReply={setReplyTo}
          onCancelReply={() => setReplyTo(null)}
          onReact={reactToMessage}
          onEditMessage={editMessage}
          onDeleteMessage={deleteMessage}
          onReportMessage={reportMessage}
          onStartCall={startCall}
          isTyping={typingChatId === activeChat._id}
        />
      ) : (
        <section className="flex min-h-0 flex-1 flex-col px-4 pt-3">
          <div className="mb-3 flex shrink-0 items-center justify-between">
            {selectedChats.size ? (
              <>
                <button onClick={clearSelection} className="btn-icon h-10 w-10" aria-label="Cancel selection"><X size={18} /></button>
                <p className="font-semibold">{selectedChats.size} selected</p>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedPreference('pin')} className="btn-icon h-10 w-10" aria-label="Pin selected"><Pin size={17} /></button>
                  <button onClick={() => setSelectedPreference('star')} className="btn-icon h-10 w-10" aria-label="Star selected"><Star size={17} /></button>
                  <button onClick={hideSelectedChats} className="grid h-10 w-10 place-items-center rounded-full bg-coral/12 text-coral" aria-label="Delete selected"><Trash2 size={17} /></button>
                </div>
              </>
            ) : (
              <div>
                <h2 className="text-2xl font-semibold">Chats</h2>
                <p className="text-sm text-white/45">{chats.length} friends</p>
              </div>
            )}
          </div>
          {!selectedChats.size && <label className="mb-3 flex shrink-0 items-center gap-3 rounded-[16px] border border-white/8 bg-white/5 px-4 py-3">
            <Search size={18} className="text-white/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder="Search friends or messages"
            />
          </label>}
          <div data-chat-feed className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24">
          {visibleChats.map((chat) => {
            const other = chat.members?.find((member) => normalizeId(member) !== currentUserId);
            const displayName = getNickname(chat, currentUserId, other);
            return (
              <article
                key={chat._id}
                onContextMenu={(event) => {
                  event.preventDefault();
                  toggleSelect(chat._id);
                }}
                className={`flex w-full items-center gap-3 border-b border-white/8 px-1 py-2.5 text-left ${chat.unreadCount ? 'bg-white/5' : ''} ${selectedChats.has(chat._id) ? 'bg-mint/10' : ''}`}
              >
                <button onClick={() => other && openProfile(other, chat)} aria-label={`View ${displayName || 'friend'} profile`}>
                  {other?.avatar ? <img src={other.avatar} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 rounded-full bg-white/8" />}
                </button>
                <ChatRowButton chatId={chat._id} onOpen={() => handleChatOpen(chat)} onLongSelect={() => toggleSelect(chat._id)}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium">{displayName || 'Friend'}</p>
                    <span className="flex items-center gap-1">
                      {chat.pinned && <Pin size={12} className="text-mint" />}
                      {chat.starred && <Star size={12} className="fill-mint text-mint" />}
                      <span className={`h-2 w-2 rounded-full ${other?.isOnline ? 'bg-mint' : 'bg-white/25'}`} />
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className={`truncate text-xs ${typingChatId === chat._id ? 'font-semibold text-mint' : chat.unreadCount ? 'font-semibold text-white' : 'text-white/45'}`}>
                      {typingChatId === chat._id ? 'typing...' : chat.lastMessage?.text || callPreview(chat.lastCall, currentUserId) || presenceText(other)}
                    </p>
                    {chat.unreadCount > 0 && (
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-ink">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </ChatRowButton>
              </article>
            );
          })}
          {!chats.length && (
            <div className="surface rounded-[20px] p-6 text-center">
              <p className="font-medium">No friends yet</p>
              <p className="mt-1 text-sm text-white/55">Accept a request or send one from Discover to start chatting.</p>
            </div>
          )}
          {chats.length > 0 && !visibleChats.length && (
            <div className="rounded-[20px] border border-white/8 bg-white/5 p-6 text-center">
              <p className="font-medium">No chats found</p>
              <p className="mt-1 text-sm text-white/45">Try another name or message.</p>
            </div>
          )}
          </div>
        </section>
      )}
      <UserProfileModal
        user={profileUser}
        chat={profileChat}
        currentUserId={currentUserId}
        onClose={closeProfile}
        onNickname={updateNickname}
        onUnfriend={unfriendChat}
        onBlock={blockUser}
        onReport={reportUser}
      />
      <CallOverlay
        call={call}
        minimized={callMinimized}
        onMinimize={() => setCallMinimized(true)}
        onExpand={() => setCallMinimized(false)}
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

function ChatRowButton({ children, onOpen, onLongSelect }) {
  const timerRef = useRef(null);
  const longPressRef = useRef(false);
  function start() {
    clearTimeout(timerRef.current);
    longPressRef.current = false;
    timerRef.current = setTimeout(() => {
      longPressRef.current = true;
      onLongSelect();
    }, 420);
  }
  function clear() {
    clearTimeout(timerRef.current);
  }
  function click() {
    if (longPressRef.current) {
      longPressRef.current = false;
      return;
    }
    onOpen();
  }
  return (
    <button
      onClick={click}
      onPointerDown={start}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      className="min-w-0 flex-1 text-left"
    >
      {children}
    </button>
  );
}

function sortChats(chats) {
  return [...chats].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getMessageSenderId(message) {
  return normalizeId(message.sender);
}

function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (value._id) return normalizeId(value._id);
    if (value.$oid) return value.$oid;
    if (value.toString && value.toString !== Object.prototype.toString) return value.toString();
  }
  return String(value);
}

function callPreview(call, currentUserId) {
  if (!call) return '';
  const mine = normalizeId(call.caller) === normalizeId(currentUserId);
  const direction = mine ? 'Outgoing' : 'Incoming';
  const status = call.status === 'rejected' ? 'declined' : call.status === 'missed' ? 'missed' : call.status === 'ringing' ? 'ringing' : 'ended';
  return `${direction} ${call.type} call ${status}`;
}

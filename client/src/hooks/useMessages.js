import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { readCache, writeCache } from '../lib/cache.js';
import { getMessageSenderId, getOtherMember, normalizeId } from '../lib/chat.js';
import { getRealtimeSocket } from '../lib/realtime.js';
import { playMessageSound } from '../lib/sounds.js';

const RETRY_KEY = 'blippr_message_retry_queue';
const loadedChatsCache = new Set();

function readRetryQueue() {
  try {
    return JSON.parse(localStorage.getItem(RETRY_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeRetryQueue(queue) {
  localStorage.setItem(RETRY_KEY, JSON.stringify(queue.slice(-50)));
}

export function useMessages({ activeChat, currentUserId, setChats }) {
  const [messages, setMessages] = useState([]);
  const [calls, setCalls] = useState([]);
  const [text, setText] = useState('');
  const [typingChats, setTypingChats] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const typingTimerRef = useRef(null);
  const activeChatIdRef = useRef(null);
  const retryingRef = useRef(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const lastUserIdRef = useRef(null);

  // Clear cache if active user changes to prevent cross-user leak
  useEffect(() => {
    if (currentUserId && lastUserIdRef.current !== currentUserId) {
      loadedChatsCache.clear();
      lastUserIdRef.current = currentUserId;
    }
  }, [currentUserId]);

  const mergeCall = useCallback((updatedCall) => {
    if (!updatedCall?._id) return;
    setCalls((current) => {
      const rest = current.filter((callItem) => callItem._id !== updatedCall._id);
      return [...rest, updatedCall].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });
  }, []);

  const resetComposer = useCallback(() => {
    setReplyTo(null);
    setText('');
  }, []);

  const handleTextChange = useCallback((value) => {
    setText(value);
    if (!activeChat || activeChat.isMock) return;

    const socket = getRealtimeSocket();
    socket.emit(value ? 'typing:start' : 'typing:stop', { chatId: activeChat._id });
    clearTimeout(typingTimerRef.current);
    if (value) {
      typingTimerRef.current = setTimeout(() => {
        socket.emit('typing:stop', { chatId: activeChat._id });
      }, 900);
    }
  }, [activeChat]);

  useEffect(() => {
    const chatId = activeChat?._id;
    activeChatIdRef.current = chatId || null;
    if (!chatId) {
      setMessages([]);
      setCalls([]);
      return;
    }
    if (activeChat.isMock) {
      setMessages([]);
      setCalls([]);
      return;
    }
    if (!currentUserId) {
      setMessages([]);
      setCalls([]);
      return;
    }
    const socket = getRealtimeSocket();
    socket.emit('chat:join', { chatId });

    // Instantly load from local cache
    const cachedMsgs = readCache(`messages:${chatId}`, currentUserId, []);
    const cachedCalls = readCache(`calls:${chatId}`, currentUserId, []);
    setMessages(cachedMsgs);
    setCalls(cachedCalls);

    // Skip server fetching if this chat was already fetched in this session
    if (loadedChatsCache.has(chatId)) {
      api(`/api/chats/${chatId}/read`, { method: 'PATCH' }).catch(() => {});
      setChats((current) => current.map((chat) => (chat._id === chatId ? { ...chat, unreadCount: 0 } : chat)));
      return;
    }

    Promise.all([
      api(`/api/chats/${chatId}/messages`).catch((err) => {
        console.error('Failed to fetch messages:', err);
        return { messages: [] };
      }),
      api(`/api/chats/${chatId}/calls`).catch((err) => {
        console.error('Failed to fetch calls:', err);
        return { calls: [] };
      })
    ])
      .then(async ([messageData, callData]) => {
        if (activeChatIdRef.current !== chatId) return;
        setMessages(messageData.messages || []);
        setCalls(callData.calls || []);
        writeCache(`messages:${chatId}`, messageData.messages || [], currentUserId);
        writeCache(`calls:${chatId}`, callData.calls || [], currentUserId);
        loadedChatsCache.add(chatId);
        await api(`/api/chats/${chatId}/read`, { method: 'PATCH' }).catch(() => {});
        setChats((current) => current.map((chat) => (chat._id === chatId ? { ...chat, unreadCount: 0 } : chat)));
      })
      .catch((err) => {
        console.error('Failed to process chat loading:', err);
      });
  }, [activeChat?._id, currentUserId, setChats, refreshTrigger]);

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
      const isForActiveChat = activeChat && message.chat === activeChat._id;
      if (!mine && (!isForActiveChat || document.visibilityState !== 'visible')) {
        playMessageSound();
      }
      if (isForActiveChat) {
        setMessages((current) => {
          if (current.some((item) => item._id === message._id)) return current;
          if (mine) {
            let foundIndex = -1;
            if (message.media?.url) {
              foundIndex = current.findIndex((item) => item.sender === currentUserId && (item.status === 'sending' || item.status === 'queued') && item.media?.type === message.media.type);
            } else if (message.location) {
              foundIndex = current.findIndex((item) => item.sender === currentUserId && (item.status === 'sending' || item.status === 'queued') && item.location?.type === message.location.type);
            } else {
              foundIndex = current.findIndex((item) => item.sender === currentUserId && (item.status === 'sending' || item.status === 'queued') && item.text === message.text);
            }
            if (foundIndex !== -1) {
              const next = [...current];
              const optimisticClientId = next[foundIndex].clientId || next[foundIndex]._id;
              next[foundIndex] = {
                ...message,
                clientId: optimisticClientId,
                status: message.status || 'sent'
              };
              return next;
            }
          }
          return [...current, message];
        });
      }
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
    const handleDelivered = ({ chatId, userId }) => {
      if (normalizeId(userId) === currentUserId) return;
      if (!activeChat || chatId !== activeChat._id) return;
      setMessages((current) => current.map((message) => (getMessageSenderId(message) === currentUserId && message.status === 'sent' ? { ...message, status: 'delivered' } : message)));
    };
    const handleSeen = ({ chatId, userId }) => {
      if (normalizeId(userId) === currentUserId) return;
      if (!activeChat || chatId !== activeChat._id) return;
      setMessages((current) => current.map((message) => (getMessageSenderId(message) === currentUserId ? { ...message, status: 'seen' } : message)));
    };
    const handleStatus = ({ messageId, status }) => {
      setMessages((current) => current.map((message) => (message._id === messageId ? { ...message, status } : message)));
    };
    const handleTypingStart = ({ chatId, userId }) => {
      if (normalizeId(userId) !== currentUserId) {
        setTypingChats((current) => ({ ...current, [chatId]: true }));
      }
    };
    const handleTypingStop = ({ chatId, userId }) => {
      if (normalizeId(userId) !== currentUserId) {
        setTypingChats((current) => {
          const next = { ...current };
          delete next[chatId];
          return next;
        });
      }
    };
    socket.on('message:new', handleMessage);
    socket.on('message:reaction', handleReaction);
    socket.on('message:edited', handleEdited);
    socket.on('message:deleted', handleDeleted);
    socket.on('message:delivered', handleDelivered);
    socket.on('message:seen', handleSeen);
    socket.on('message:status', handleStatus);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    return () => {
      socket.off('message:new', handleMessage);
      socket.off('message:reaction', handleReaction);
      socket.off('message:edited', handleEdited);
      socket.off('message:deleted', handleDeleted);
      socket.off('message:delivered', handleDelivered);
      socket.off('message:seen', handleSeen);
      socket.off('message:status', handleStatus);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
    };
  }, [activeChat, currentUserId]);

  useEffect(() => {
    return () => {
      clearTimeout(typingTimerRef.current);
      if (activeChat) getRealtimeSocket().emit('typing:stop', { chatId: activeChat._id });
    };
  }, [activeChat]);

  const flushRetryQueue = useCallback(async () => {
    if (retryingRef.current || !navigator.onLine) return;
    const queue = readRetryQueue();
    if (!queue.length) return;
    retryingRef.current = true;
    const remaining = [];
    for (const item of queue) {
      try {
        const { message } = await api(`/api/chats/${item.chatId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ text: item.text, replyTo: item.replyToId })
        });
        setMessages((current) => current.map((entry) => (entry._id === item.tempId ? message : entry)));
      } catch {
        remaining.push(item);
      }
    }
    writeRetryQueue(remaining);
    retryingRef.current = false;
  }, []);

  useEffect(() => {
    let isInitial = true;
    function retry() {
      if (!isInitial) {
        loadedChatsCache.clear();
        setRefreshTrigger((prev) => prev + 1);
      }
      isInitial = false;
      flushRetryQueue().catch(() => {});
    }
    window.addEventListener('online', retry);
    window.addEventListener('blippr:socket-state', retry);
    retry();
    return () => {
      window.removeEventListener('online', retry);
      window.removeEventListener('blippr:socket-state', retry);
    };
  }, [flushRetryQueue]);

  const sendMessage = useCallback(async (event) => {
    event.preventDefault();
    if (!activeChat || !text.trim()) return;
    const messageText = text.trim();
    const repliedMessage = replyTo;
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      clientId: tempId,
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
      setMessages((current) => {
        const hasRealId = current.some((item) => item._id === message._id);
        if (hasRealId) {
          return current.filter((item) => item._id !== tempId);
        }
        return current.map((item) =>
          item._id === tempId
            ? { ...item, _id: message._id, status: message.status || 'sent', clientId: tempId }
            : item
        );
      });
    } catch {
      const queued = {
        tempId,
        chatId: activeChat._id,
        text: messageText,
        replyToId: repliedMessage?._id,
        createdAt: new Date().toISOString()
      };
      writeRetryQueue([...readRetryQueue().filter((item) => item.tempId !== tempId), queued]);
      setMessages((current) => current.map((item) => (item._id === tempId ? { ...item, status: navigator.onLine ? 'failed' : 'queued' } : item)));
    }
  }, [activeChat, text, replyTo, currentUserId, setChats, handleTextChange]);

  const sendMedia = useCallback(async (file, metadata = {}) => {
    if (!activeChat || !file) return;
    const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : 'file';
    const previewUrl = URL.createObjectURL(file);
    const tempId = `temp-media-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      clientId: tempId,
      chat: activeChat._id,
      sender: currentUserId,
      text: '',
      media: {
        url: previewUrl,
        type: kind,
        name: file.name,
        local: true,
        duration: metadata.duration,
        waveform: metadata.waveform
      },
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
        body: JSON.stringify({
          media: {
            ...media,
            name: media.name || file.name,
            mimeType: media.mimeType || file.type,
            size: media.size || file.size,
            duration: metadata.duration,
            waveform: metadata.waveform
          }
        })
      });
      setMessages((current) => {
        const hasRealId = current.some((item) => item._id === message._id);
        if (hasRealId) {
          return current.filter((item) => item._id !== tempId);
        }
        return current.map((item) =>
          item._id === tempId
            ? { ...item, _id: message._id, status: message.status || 'sent', media: message.media, clientId: tempId }
            : item
        );
      });
      URL.revokeObjectURL(previewUrl);
    } catch (err) {
      setMessages((current) => current.map((item) => (item._id === tempId ? { ...item, status: 'failed' } : item)));
      throw new Error(err.message || 'Could not send media. Check storage setup or try a smaller file.');
    }
  }, [activeChat, currentUserId, setChats]);

  const sendLocation = useCallback(async ({ latitude, longitude, accuracy, live = false, durationMs = 15 * 60 * 1000 }) => {
    if (!activeChat) return null;
    const tempId = `temp-location-${Date.now()}`;
    const now = new Date();
    const optimisticMessage = {
      _id: tempId,
      clientId: tempId,
      chat: activeChat._id,
      sender: currentUserId,
      text: live ? 'Shared live location' : 'Shared current location',
      location: {
        type: live ? 'live' : 'current',
        coordinates: [longitude, latitude],
        accuracy,
        startedAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt: live ? new Date(now.getTime() + durationMs).toISOString() : undefined
      },
      reactions: [],
      status: 'sending',
      createdAt: now.toISOString()
    };

    setMessages((current) => [...current, optimisticMessage]);
    setChats((current) =>
      current
        .map((chat) => (chat._id === activeChat._id ? { ...chat, lastMessage: optimisticMessage, updatedAt: optimisticMessage.createdAt } : chat))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    );

    try {
      const { message } = await api(`/api/chats/${activeChat._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          text: optimisticMessage.text,
          location: { latitude, longitude, accuracy, type: live ? 'live' : 'current', durationMs }
        })
      });
      setMessages((current) => {
        const hasRealId = current.some((item) => item._id === message._id);
        if (hasRealId) {
          return current.filter((item) => item._id !== tempId);
        }
        return current.map((item) =>
          item._id === tempId
            ? { ...item, _id: message._id, status: message.status || 'sent', location: message.location, clientId: tempId }
            : item
        );
      });
      return message;
    } catch (err) {
      setMessages((current) => current.map((item) => (item._id === tempId ? { ...item, status: 'failed' } : item)));
      throw new Error(err.message || 'Could not share location');
    }
  }, [activeChat, currentUserId, setChats]);

  const updateLiveLocation = useCallback(async (messageId, { latitude, longitude, accuracy, ended = false }) => {
    if (!activeChat || !messageId) return null;
    const { message } = await api(`/api/chats/${activeChat._id}/messages/${messageId}/location`, {
      method: 'PATCH',
      body: JSON.stringify({ latitude, longitude, accuracy, ended })
    });
    setMessages((current) => current.map((item) => (item._id === message._id ? message : item)));
    return message;
  }, [activeChat]);

  const reactToMessage = useCallback(async (messageId, emoji) => {
    const { message } = await api(`/api/chats/${activeChat._id}/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    });
    setMessages((current) => current.map((item) => (item._id === messageId ? message : item)));
  }, [activeChat]);

  const editMessage = useCallback(async (messageId, nextText) => {
    setMessages((current) => current.map((message) => (message._id === messageId ? { ...message, text: nextText, editedAt: new Date().toISOString() } : message)));
    try {
      const { message } = await api(`/api/chats/${activeChat._id}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ text: nextText })
      });
      setMessages((current) => current.map((item) => (item._id === messageId ? message : item)));
    } catch {
      // Revert if request fails
      setMessages((current) => current.map((message) => (message._id === messageId ? { ...message, text: message.text } : message)));
    }
  }, [activeChat]);

  const deleteMessage = useCallback(async (messageId, scope = 'me') => {
    const previous = messages;
    setMessages((current) => current.filter((message) => message._id !== messageId));
    try {
      await api(`/api/chats/${activeChat._id}/messages/${messageId}?scope=${scope}`, { method: 'DELETE' });
    } catch {
      setMessages(previous);
    }
  }, [activeChat, messages]);

  const reportMessage = useCallback(async (message) => {
    const other = getOtherMember(activeChat, currentUserId);
    if (!other) return;
    await api('/api/safety/report', {
      method: 'POST',
      body: JSON.stringify({
        userId: other._id,
        reason: 'Reported message',
        category: 'other',
        chatId: activeChat._id,
        messageId: message._id,
        notes: `Message ${message._id}: ${message.text || '[media]'}`
      })
    });
  }, [activeChat, currentUserId]);

  const retryMessage = useCallback(async (tempId) => {
    setMessages((current) => {
      const msg = current.find((m) => m._id === tempId || m.clientId === tempId);
      if (!msg) return current;

      (async () => {
        try {
          let res;
          if (msg.media) {
            res = await api(`/api/chats/${msg.chat}/messages`, {
              method: 'POST',
              body: JSON.stringify({
                media: msg.media,
                replyTo: msg.replyTo?._id
              })
            });
          } else if (msg.location) {
            res = await api(`/api/chats/${msg.chat}/messages`, {
              method: 'POST',
              body: JSON.stringify({
                text: msg.text,
                location: {
                  latitude: msg.location.coordinates[1],
                  longitude: msg.location.coordinates[0],
                  accuracy: msg.location.accuracy,
                  type: msg.location.type
                },
                replyTo: msg.replyTo?._id
              })
            });
          } else {
            res = await api(`/api/chats/${msg.chat}/messages`, {
              method: 'POST',
              body: JSON.stringify({
                text: msg.text,
                replyTo: msg.replyTo?._id
              })
            });
          }

          const { message } = res;
          writeRetryQueue(readRetryQueue().filter((item) => item.tempId !== tempId));
          setMessages((prev) => prev.map((item) =>
            (item._id === tempId || item.clientId === tempId)
              ? { ...item, _id: message._id, status: message.status || 'sent', clientId: tempId }
              : item
          ));
        } catch {
          setMessages((prev) => prev.map((item) =>
            (item._id === tempId || item.clientId === tempId) ? { ...item, status: 'failed' } : item
          ));
        }
      })();

      return current.map((item) =>
        (item._id === tempId || item.clientId === tempId) ? { ...item, status: 'sending' } : item
      );
    });
  }, []);

  return {
    messages,
    calls,
    text,
    typingChats,
    replyTo,
    setReplyTo,
    setText: handleTextChange,
    resetComposer,
    mergeCall,
    sendMessage,
    sendMedia,
    sendLocation,
    updateLiveLocation,
    reactToMessage,
    editMessage,
    deleteMessage,
    reportMessage,
    retryMessage
  };
}

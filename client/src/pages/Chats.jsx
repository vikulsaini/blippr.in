import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CallOverlay from '../components/CallOverlay.jsx';
import ChatList from '../components/ChatList.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import ConfirmSheet from '../components/ConfirmSheet.jsx';
import UserProfileModal from '../components/UserProfileModal.jsx';
import { useCallSession } from '../hooks/useCallSession.js';
import { useChatSelection } from '../hooks/useChatSelection.js';
import { useMessages } from '../hooks/useMessages.js';
import { api, getTokenSubject } from '../lib/api.js';
import { readCache, writeCache } from '../lib/cache.js';
import { normalizeId, sortChats } from '../lib/chat.js';
import { getRealtimeSocket } from '../lib/realtime.js';

const MOCK_CHANNELS = [
  {
    _id: 'mock_ui_ux_design',
    isMock: true,
    type: 'channel',
    name: '🚀 UI/UX-design',
    category: 'general',
    unreadCount: 2,
    description: 'A space for sharing UI/UX designs, case studies, and getting feedback from the community!',
    members: [
      { _id: 'mock_samantha', name: 'Samantha', username: 'samantha', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', isOnline: true, bio: 'UI/UX Designer @ Google' },
      { _id: 'mock_nico', name: 'Nico Alexis', username: 'nico_alexis', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', isOnline: true, bio: 'Product Designer @ Figma' },
      { _id: 'mock_bima', name: 'Bima Algifari', username: 'bima_alg', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', isOnline: false, bio: 'Visual Designer & Illustrator' }
    ]
  },
  {
    _id: 'mock_ui_ux_discussion',
    isMock: true,
    type: 'channel',
    name: '📚 UI/UX-discussion',
    category: 'general',
    unreadCount: 0,
    description: 'General discussions about design philosophy, typography, user research, and more.',
    members: [
      { _id: 'mock_samantha', name: 'Samantha', username: 'samantha', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', isOnline: true, bio: 'UI/UX Designer @ Google' },
      { _id: 'mock_nico', name: 'Nico Alexis', username: 'nico_alexis', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', isOnline: true, bio: 'Product Designer @ Figma' },
      { _id: 'mock_bima', name: 'Bima Algifari', username: 'bima_alg', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', isOnline: false, bio: 'Visual Designer & Illustrator' }
    ]
  },
  {
    _id: 'mock_design_challenges',
    isMock: true,
    type: 'channel',
    name: '🎯 Design-challenges',
    category: 'events',
    unreadCount: 1,
    description: 'Weekly design sprints, brainstorms, and community feedback challenges.',
    members: [
      { _id: 'mock_samantha', name: 'Samantha', username: 'samantha', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', isOnline: true, bio: 'UI/UX Designer @ Google' },
      { _id: 'mock_nico', name: 'Nico Alexis', username: 'nico_alexis', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', isOnline: true, bio: 'Product Designer @ Figma' },
      { _id: 'mock_bima', name: 'Bima Algifari', username: 'bima_alg', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', isOnline: false, bio: 'Visual Designer & Illustrator' }
    ]
  },
  {
    _id: 'mock_support_group',
    isMock: true,
    type: 'channel',
    name: '🌱 Support-group',
    category: 'events',
    unreadCount: 0,
    description: 'A place to discuss design career paths, mentorship, work-life balance, and burnout.',
    members: [
      { _id: 'mock_samantha', name: 'Samantha', username: 'samantha', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', isOnline: true, bio: 'UI/UX Designer @ Google' },
      { _id: 'mock_nico', name: 'Nico Alexis', username: 'nico_alexis', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', isOnline: true, bio: 'Product Designer @ Figma' },
      { _id: 'mock_bima', name: 'Bima Algifari', username: 'bima_alg', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', isOnline: false, bio: 'Visual Designer & Illustrator' }
    ]
  }
];

export default function Chats() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setBottomNavHidden } = useOutletContext() || {};
  const tokenUserId = normalizeId(getTokenSubject());
  const [me, setMe] = useState(() => readCache('me', 'global'));
  const [chats, setChats] = useState(() => friendChats(readCache('chats', tokenUserId, [])));
  const [activeChat, setActiveChat] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [profileChat, setProfileChat] = useState(null);
  const [query, setQuery] = useState('');
  const [loadingChats, setLoadingChats] = useState(!friendChats(readCache('chats', tokenUserId, [])).length);

  // Mock channels state
  const [mockChannels, setMockChannels] = useState(MOCK_CHANNELS);
  const [mockTypingChatId, setMockTypingChatId] = useState(null);
  const [mockChannelMessages, setMockChannelMessages] = useState({
    mock_ui_ux_design: [
      {
        _id: 'm1',
        chat: 'mock_ui_ux_design',
        text: 'Hey everyone! Have you checked out the new Figma auto-layout updates?',
        sender: 'mock_samantha',
        senderName: 'Samantha',
        senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        _id: 'm2',
        chat: 'mock_ui_ux_design',
        text: 'Yes! The wrap option is an absolute life-saver for responsive grids.',
        sender: 'mock_nico',
        senderName: 'Nico Alexis',
        senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        createdAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        _id: 'm3',
        chat: 'mock_ui_ux_design',
        text: 'Agreed. I just published a new component kit using it. Check it out!',
        sender: 'mock_bima',
        senderName: 'Bima Algifari',
        senderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
        createdAt: new Date(Date.now() - 1800000).toISOString()
      }
    ],
    mock_ui_ux_discussion: [
      {
        _id: 'md1',
        chat: 'mock_ui_ux_discussion',
        text: 'What is your favorite font pairing for SaaS applications?',
        sender: 'mock_nico',
        senderName: 'Nico Alexis',
        senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        createdAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        _id: 'md2',
        chat: 'mock_ui_ux_discussion',
        text: 'I really like Inter for body text paired with Plus Jakarta Sans for headings. It looks incredibly clean and modern!',
        sender: 'mock_samantha',
        senderName: 'Samantha',
        senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        createdAt: new Date(Date.now() - 1200000).toISOString()
      }
    ],
    mock_design_challenges: [
      {
        _id: 'mc1',
        chat: 'mock_design_challenges',
        text: 'The weekly challenge is now live! Redesign a banking app landing page.',
        sender: 'mock_samantha',
        senderName: 'Samantha',
        senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        _id: 'mc2',
        chat: 'mock_design_challenges',
        text: 'Count me in! I will submit my entry by Friday.',
        sender: 'mock_bima',
        senderName: 'Bima Algifari',
        senderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
        createdAt: new Date(Date.now() - 43200000).toISOString()
      }
    ],
    mock_support_group: [
      {
        _id: 'ms1',
        chat: 'mock_support_group',
        text: 'Feeling a bit burnt out this week. How do you guys manage work-life balance?',
        sender: 'mock_bima',
        senderName: 'Bima Algifari',
        senderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
        createdAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        _id: 'ms2',
        chat: 'mock_support_group',
        text: 'Taking regular screen breaks and exercising helps a lot. Remember to step away from the canvas!',
        sender: 'mock_nico',
        senderName: 'Nico Alexis',
        senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        createdAt: new Date(Date.now() - 1800000).toISOString()
      }
    ]
  });

  const currentUserId = normalizeId(me?._id || tokenUserId);

  const {
    selectedChats,
    pendingDelete,
    selectionError,
    clearSelection,
    toggleSelect,
    requestHideSelectedChats,
    confirmHideSelectedChats,
    cancelHideSelectedChats,
    clearSelectionError,
    setSelectedPreference
  } = useChatSelection({ chats, setChats });

  const {
    messages,
    calls,
    text,
    typingChats,
    replyTo,
    setReplyTo,
    setText,
    resetComposer,
    mergeCall,
    sendMessage,
    sendMedia,
    sendLocation,
    updateLiveLocation,
    reactToMessage,
    editMessage,
    deleteMessage,
    reportMessage
  } = useMessages({ activeChat, currentUserId, setChats });

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const callSession = useCallSession({
    activeChat,
    chats,
    currentUserId,
    mergeCall,
    setChats
  });

  function mergeChat(updatedChat, unreadCount) {
    if (!isFriendChat(updatedChat)) return;
    setChats((current) => {
      const withCount = { ...updatedChat, unreadCount };
      const rest = current.filter((chat) => chat._id !== updatedChat._id);
      return sortChats([withCount, ...rest]);
    });
    setActiveChat((current) => (current?._id === updatedChat._id ? { ...updatedChat, unreadCount } : current));
  }

  function openProfile(user, chat) {
    setProfileUser(user);
    setProfileChat(chat);
  }

  function handleOpenMockProfile() {
    if (!activeChat) return;
    const channelProfileUser = {
      _id: activeChat._id,
      name: activeChat.name,
      username: activeChat._id,
      avatar: activeChat.avatar || '',
      bio: activeChat.description || 'No description provided.',
      isChannel: true,
      members: activeChat.members || []
    };
    openProfile(channelProfileUser, activeChat);
  }

  function closeProfile() {
    setProfileUser(null);
    setProfileChat(null);
  }

  function closeConversation() {
    setActiveChat(null);
    resetComposer();
    if (location.pathname !== '/app' || location.search) navigate('/app', { replace: true });
  }

  function handleChatOpen(chat) {
    if (selectedChats.size) {
      if (!chat.isMock) {
        toggleSelect(chat._id);
      }
      return;
    }
    if (chat.isMock) {
      setMockChannels(prev => prev.map(c => c._id === chat._id ? { ...c, unreadCount: 0 } : c));
    }
    setActiveChat(chat);
    const nextSearch = `?chat=${chat._id}`;
    if (location.pathname !== '/app' || location.search !== nextSearch) {
      navigate(`/app${nextSearch}`);
    }
  }

  useEffect(() => {
    const cachedMe = readCache('me', 'global');
    if (cachedMe) setMe(cachedMe);
    const cacheUserId = normalizeId(cachedMe?._id || tokenUserId);
    if (cacheUserId) {
      const cachedChats = friendChats(readCache('chats', cacheUserId, []));
      if (cachedChats.length) setChats(cachedChats);
    }

    async function load() {
      setLoadingChats(true);
      const [{ user }, activeData, archivedData] = await Promise.all([
        api('/api/users/me'),
        api('/api/chats'),
        api('/api/chats?archived=true')
      ]);
      const loadedChats = [...(activeData.chats || []), ...(archivedData.chats || [])]
        .filter(isFriendChat)
        .filter((chat, index, all) => all.findIndex((item) => item._id === chat._id) === index);
      setMe(user);
      setChats(loadedChats);
      writeCache('me', user, 'global');
      writeCache('chats', loadedChats, user._id);
      setLoadingChats(false);
    }
    load().catch(() => setLoadingChats(false));
  }, [tokenUserId]);

  useEffect(() => {
    const requestedChatId = new URLSearchParams(location.search).get('chat');
    if (!requestedChatId) {
      setActiveChat(null);
      return;
    }
    setActiveChat((current) => {
      if (current?._id === requestedChatId) return current;
      const mockChat = mockChannels.find((c) => c._id === requestedChatId);
      if (mockChat) {
        setMockChannels(prev => prev.map(c => c._id === requestedChatId ? { ...c, unreadCount: 0 } : c));
        return { ...mockChat, unreadCount: 0 };
      }
      return chats.find((chat) => chat._id === requestedChatId) || current || null;
    });
  }, [chats, location.search]);

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

  const handleSendMockMessage = (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    const messageText = text.trim();
    const newMsg = {
      _id: `mock_msg_${Date.now()}`,
      chat: activeChat._id,
      text: messageText,
      sender: currentUserId,
      senderName: me?.name || 'Guest User',
      senderAvatar: me?.avatar || '',
      createdAt: new Date().toISOString()
    };
    setMockChannelMessages(prev => ({
      ...prev,
      [activeChat._id]: [...(prev[activeChat._id] || []), newMsg]
    }));
    setText('');
    setReplyTo(null);

    // Simulate typing and response
    const chatId = activeChat._id;
    setTimeout(() => {
      setMockTypingChatId(chatId);
      setTimeout(() => {
        setMockTypingChatId(null);
        const responses = [
          "That sounds like a great idea! Let's explore it.",
          "I agree with Samantha's point on this one.",
          "Interesting layout choice, is there a specific reason for that?",
          "Thanks for sharing, will try this out in my designs today!",
          "Can you link the Figma file if possible?",
          "Awesome design updates, I love the alignment!"
        ];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        const systemMembers = activeChat.members || [];
        const randomMember = systemMembers[Math.floor(Math.random() * systemMembers.length)] || {
          _id: 'mock_samantha',
          name: 'Samantha',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
        };
        const replyMsg = {
          _id: `mock_msg_${Date.now()}`,
          chat: chatId,
          text: randomResponse,
          sender: randomMember._id,
          senderName: randomMember.name,
          senderAvatar: randomMember.avatar,
          createdAt: new Date().toISOString()
        };
        setMockChannelMessages(prev => ({
          ...prev,
          [chatId]: [...(prev[chatId] || []), replyMsg]
        }));
      }, 1500);
    }, 600);
  };

  async function updateNickname(chatId, userId, nickname) {
    if (chatId.startsWith('mock_')) {
      setMockChannels(prev => prev.map(c => {
        if (c._id === chatId) {
          return {
            ...c,
            nicknames: {
              ...c.nicknames,
              [`${currentUserId}:${userId}`]: nickname
            }
          };
        }
        return c;
      }));
      setProfileChat(prev => {
        if (prev?._id === chatId) {
          return {
            ...prev,
            nicknames: {
              ...prev.nicknames,
              [`${currentUserId}:${userId}`]: nickname
            }
          };
        }
        return prev;
      });
      return;
    }
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

  async function setOneChatPreference(chat, kind) {
    const config = {
      pin: { flag: 'pinned', path: 'pin' },
      star: { flag: 'starred', path: 'star' },
      mute: { flag: 'muted', path: 'mute' },
      archive: { flag: 'archived', path: 'archive' }
    }[kind];
    if (!config) return;
    const enabled = !chat[config.flag];
    setChats((current) => sortChats(current.map((item) => (item._id === chat._id ? { ...item, [config.flag]: enabled } : item))));
    try {
      const { chat: updatedChat } = await api(`/api/chats/${chat._id}/${config.path}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled })
      });
      mergeChat(updatedChat, updatedChat.unreadCount || chat.unreadCount || 0);
    } catch {
      setChats((current) => sortChats(current.map((item) => (item._id === chat._id ? chat : item))));
    }
  }

  return (
    <div className="h-full min-h-0 md:grid md:grid-cols-[22rem_minmax(0,1fr)] md:gap-3 xl:grid-cols-[26rem_minmax(0,1fr)] relative">
      <div className={`${activeChat && isMobile ? 'hidden' : 'flex'} min-h-0 flex-1 flex-col overflow-hidden md:rounded-3xl md:border md:border-border-default md:bg-surface md:shadow-card md:flex`}>
        <ChatList
          chats={chats}
          mockChannels={mockChannels}
          me={me}
          currentUserId={currentUserId}
          query={query}
          setQuery={setQuery}
          typingChats={mockTypingChatId ? { ...typingChats, [mockTypingChatId]: true } : typingChats}
          loading={loadingChats}
          selectedChats={selectedChats}
          onClearSelection={clearSelection}
          onPreference={setSelectedPreference}
          onDeleteSelected={requestHideSelectedChats}
          onSetChatPreference={setOneChatPreference}
          onOpenChat={handleChatOpen}
          onToggleSelect={toggleSelect}
          onOpenProfile={openProfile}
          onFindPeople={() => navigate('/app/stranger')}
        />
      </div>
      <AnimatePresence>
        {activeChat && (
          <motion.div
            initial={isMobile ? { x: '100vw' } : { opacity: 0, scale: 0.98 }}
            animate={isMobile ? { x: 0 } : { opacity: 1, scale: 1 }}
            exit={isMobile ? { x: '100vw' } : { opacity: 0, scale: 0.98 }}
            transition={isMobile ? { type: 'spring', stiffness: 380, damping: 35 } : { duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-30 md:relative md:inset-auto md:z-0 min-h-0 overflow-hidden md:rounded-3xl md:border md:border-border-default md:shadow-card bg-bg flex flex-col"
          >
            <ChatWindow
              chat={activeChat}
              messages={activeChat?.isMock ? (mockChannelMessages[activeChat._id] || []) : messages}
              calls={calls}
              currentUserId={currentUserId}
              text={text}
              setText={setText}
              onSend={activeChat?.isMock ? handleSendMockMessage : sendMessage}
              onSendMedia={activeChat?.isMock ? undefined : sendMedia}
              onSendLocation={activeChat?.isMock ? undefined : sendLocation}
              onUpdateLiveLocation={updateLiveLocation}
              onBack={closeConversation}
              onProfile={activeChat?.isMock ? handleOpenMockProfile : (user) => openProfile(user, activeChat)}
              replyTo={replyTo}
              onReply={setReplyTo}
              onCancelReply={() => setReplyTo(null)}
              onReact={activeChat?.isMock ? undefined : reactToMessage}
              onEditMessage={activeChat?.isMock ? undefined : editMessage}
              onDeleteMessage={activeChat?.isMock ? undefined : deleteMessage}
              onReportMessage={activeChat?.isMock ? undefined : reportMessage}
              onStartCall={activeChat?.isMock ? undefined : callSession.startCall}
              isTyping={activeChat?.isMock ? activeChat._id === mockTypingChatId : !!typingChats?.[activeChat._id]}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {!activeChat && !isMobile && (
        <div className="hidden min-h-0 place-items-center rounded-3xl border border-border-default bg-surface p-8 text-center shadow-card md:grid">
          <div>
            <p className="text-2xl font-bold text-text-primary">Open a Conversation</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-text-muted">Select a friend from the list to chat, send media, or start a call.</p>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={!!pendingDelete}
        title="Delete Selected Chats?"
        description={`This removes ${pendingDelete?.count || 0} chat${pendingDelete?.count === 1 ? '' : 's'} from your list only.`}
        confirmLabel="Delete"
        tone="danger"
        onCancel={cancelHideSelectedChats}
        onConfirm={confirmHideSelectedChats}
      />

      <ConfirmSheet
        open={!!selectionError}
        title="Action Failed"
        description={selectionError}
        confirmLabel="Okay"
        onCancel={clearSelectionError}
        onConfirm={clearSelectionError}
      />

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
        call={callSession.call}
        minimized={callSession.callMinimized}
        onMinimize={() => callSession.setCallMinimized(true)}
        onExpand={() => callSession.setCallMinimized(false)}
        onAccept={callSession.acceptCall}
        onReject={callSession.rejectCall}
        onEnd={callSession.endCall}
        onToggleMute={callSession.toggleMute}
        onToggleCamera={callSession.toggleCamera}
        onSwitchCamera={callSession.switchCamera}
        onToggleSpeaker={callSession.toggleSpeaker}
        onToggleLowDataMode={callSession.toggleLowDataMode}
      />
    </div>
  );
}

function isFriendChat(chat) {
  return chat?.type === 'direct' && chat?.temporary !== true;
}

function friendChats(chats = []) {
  return chats.filter(isFriendChat);
}

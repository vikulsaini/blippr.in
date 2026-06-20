import { useCallback, useEffect, useState } from 'react';
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

export default function Chats() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setBottomNavHidden, me, setMe } = useOutletContext() || {};
  const tokenUserId = normalizeId(getTokenSubject());
  const [chats, setChats] = useState(() => friendChats(readCache('chats', tokenUserId, [])));
  const [activeChat, setActiveChat] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [profileChat, setProfileChat] = useState(null);
  const [query, setQuery] = useState('');
  const [loadingChats, setLoadingChats] = useState(!friendChats(readCache('chats', tokenUserId, [])).length);

  const currentUserId = normalizeId(me?._id || tokenUserId);
  const [activeCursor, setActiveCursor] = useState(null);
  const [hasMoreActive, setHasMoreActive] = useState(false);
  const [archivedCursor, setArchivedCursor] = useState(null);
  const [hasMoreArchived, setHasMoreArchived] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

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
    reportMessage,
    retryMessage
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
      toggleSelect(chat._id);
      return;
    }
    setActiveChat(chat);
    const nextSearch = `?chat=${chat._id}`;
    if (location.pathname !== '/app' || location.search !== nextSearch) {
      navigate(`/app${nextSearch}`);
    }
  }

  useEffect(() => {
    const cacheUserId = tokenUserId;
    if (!cacheUserId) {
      setLoadingChats(false);
      return;
    }
    const cachedChats = friendChats(readCache('chats', cacheUserId, []));
    if (cachedChats.length) setChats(cachedChats);

    async function load() {
      setLoadingChats(true);
      try {
        const [activeData, archivedData] = await Promise.all([
          api('/api/chats'),
          api('/api/chats?archived=true')
        ]);
        const loadedChats = [...(activeData.chats || []), ...(archivedData.chats || [])]
          .filter(isFriendChat)
          .filter((chat, index, all) => all.findIndex((item) => item._id === chat._id) === index);
        setChats(loadedChats);
        setActiveCursor(activeData.pageInfo?.nextCursor || null);
        setHasMoreActive(!!activeData.pageInfo?.hasMore);
        setArchivedCursor(archivedData.pageInfo?.nextCursor || null);
        setHasMoreArchived(!!archivedData.pageInfo?.hasMore);
        writeCache('chats', loadedChats, cacheUserId);
      } catch (err) {
        console.warn('Failed to load chats:', err);
      } finally {
        setLoadingChats(false);
      }
    }
    load();
  }, [tokenUserId]);

  const loadMore = useCallback(async (isArchived = false) => {
    if (loadingMore) return;
    const cursor = isArchived ? archivedCursor : activeCursor;
    const hasMore = isArchived ? hasMoreArchived : hasMoreActive;
    if (!hasMore || !cursor) return;

    setLoadingMore(true);
    try {
      const url = isArchived 
        ? `/api/chats?archived=true&cursor=${encodeURIComponent(cursor)}` 
        : `/api/chats?cursor=${encodeURIComponent(cursor)}`;
      const data = await api(url);
      const newChats = (data.chats || []).filter(isFriendChat);

      setChats((current) => {
        const combined = [...current, ...newChats];
        return combined.filter((chat, index, all) => all.findIndex((item) => item._id === chat._id) === index);
      });

      if (isArchived) {
        setArchivedCursor(data.pageInfo?.nextCursor || null);
        setHasMoreArchived(!!data.pageInfo?.hasMore);
      } else {
        setActiveCursor(data.pageInfo?.nextCursor || null);
        setHasMoreActive(!!data.pageInfo?.hasMore);
      }
    } catch (err) {
      console.warn('Failed to load more chats:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [activeCursor, hasMoreActive, archivedCursor, hasMoreArchived, loadingMore]);

  useEffect(() => {
    const requestedChatId = new URLSearchParams(location.search).get('chat');
    if (!requestedChatId) {
      setActiveChat(null);
      return;
    }
    setActiveChat((current) => {
      if (current?._id === requestedChatId) return current;
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
      <div className={`${activeChat && isMobile ? 'hidden' : 'flex'} min-h-0 flex-1 flex-col overflow-hidden md:rounded-3xl md:border md:border-border-default glass-card md:shadow-card md:flex`}>
        <ChatList
          chats={chats}
          me={me}
          currentUserId={currentUserId}
          query={query}
          setQuery={setQuery}
          typingChats={typingChats}
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
          hasMoreActive={hasMoreActive}
          hasMoreArchived={hasMoreArchived}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
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
              messages={messages}
              calls={calls}
              currentUserId={currentUserId}
              text={text}
              setText={setText}
              onSend={sendMessage}
              onSendMedia={sendMedia}
              onSendLocation={sendLocation}
              onUpdateLiveLocation={updateLiveLocation}
              onBack={closeConversation}
              onProfile={(user) => openProfile(user, activeChat)}
              replyTo={replyTo}
              onReply={setReplyTo}
              onCancelReply={() => setReplyTo(null)}
              onReact={reactToMessage}
              onEditMessage={editMessage}
              onDeleteMessage={deleteMessage}
              onReportMessage={reportMessage}
              onStartCall={callSession.startCall}
              isTyping={!!typingChats?.[activeChat._id]}
              onRetryMessage={retryMessage}
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

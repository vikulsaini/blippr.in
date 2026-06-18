import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, ArrowLeft, Camera, FileText, Image, MapPin, Mic, Navigation, Phone, Plus, Reply, Search, Send, Smile, Square, Video, X } from 'lucide-react';
import ConversationTimeline from './chat/ConversationTimeline.jsx';
import { getNickname, getOtherMember, normalizeId } from '../lib/chat.js';
import { presenceText } from '../lib/presence.js';

const composerEmojis = ['\u{1F60A}', '\u{1F602}', '\u{1F970}', '\u{1F60D}', '\u{1F44B}', '\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F525}', '\u{1F389}', '\u{1F622}', '\u{1F62E}', '\u{1F64F}', '\u{1F914}', '\u{1F634}', '\u{1F618}', '\u{2728}'];

export default function ChatWindow({ chat, messages = [], calls = [], currentUserId, text, setText, onSend, onSendMedia, onSendLocation, onUpdateLiveLocation, onBack, onProfile, replyTo, onReply, onCancelReply, onReact, onEditMessage, onDeleteMessage, onReportMessage, onStartCall, isTyping = false }) {
  const myId = normalizeId(currentUserId);
  const otherMember = getOtherMember(chat, myId);
  const displayName = getNickname(chat, currentUserId, otherMember);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [permissionPrompt, setPermissionPrompt] = useState(null);
  const [fileAccept, setFileAccept] = useState('image/*,video/*,audio/*,application/pdf,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.zip');
  const [captureMode, setCaptureMode] = useState('');
  const [viewportHeight, setViewportHeight] = useState(0);
  const [showScrollFAB, setShowScrollFAB] = useState(false);
  const scrollContainerRef = useRef(null);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const liveLocationRef = useRef({ watchId: null, messageId: null, timer: null, lastSentAt: 0 });

  useEffect(() => {
    return () => stopLiveLocation();
  }, []);

  const activeChatId = chat?._id;
  const lastScrolledChatRef = useRef(null);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    
    const hasMessages = messages.length > 0;
    const isNewChat = lastScrolledChatRef.current !== activeChatId;
    
    if (isNewChat && hasMessages) {
      container.scrollTop = container.scrollHeight;
      lastScrolledChatRef.current = activeChatId;
      return;
    }
    
    if (isNewChat && !hasMessages) {
      container.scrollTop = container.scrollHeight;
      return;
    }
    
    const lastMessage = messages.at(-1);
    const isMine = lastMessage && normalizeId(lastMessage.sender) === myId;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    
    if (isMine || isNearBottom || isTyping) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: isMine ? 'smooth' : 'auto'
      });
    }
  }, [messages.length, messages.at(-1)?._id, calls.length, calls.at(-1)?._id, isTyping, activeChatId, myId]);

  function handleScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 300;
    setShowScrollFAB(isScrolledUp);
  }

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    function updateHeight() {
      setViewportHeight(window.innerWidth < 768 ? viewport.height : 0);
    }

    updateHeight();
    viewport.addEventListener('resize', updateHeight);
    viewport.addEventListener('scroll', updateHeight);
    return () => {
      viewport.removeEventListener('resize', updateHeight);
      viewport.removeEventListener('scroll', updateHeight);
    };
  }, []);

  function handleTextInput(value) {
    if (emojiOpen) setEmojiOpen(false);
    if (attachmentOpen) setAttachmentOpen(false);
    setText(value);
  }

  function openPicker({ accept, capture = '', title, message }) {
    setEmojiOpen(false);
    setAttachmentOpen(false);
    setUploadError('');
    setPermissionPrompt({
      title,
      message,
      action: () => {
        if (!window.isSecureContext && location.hostname !== 'localhost') {
          setUploadError('Open Blippr on HTTPS to allow mobile photos, media and files.');
          return;
        }
        setFileAccept(accept);
        setCaptureMode(capture);
        window.setTimeout(() => fileInputRef.current?.click(), 0);
      }
    });
  }

  function openAttachmentSheet() {
    setEmojiOpen(false);
    setAttachmentOpen((open) => !open);
  }

  function shareCurrentLocation() {
    setEmojiOpen(false);
    setAttachmentOpen(false);
    setUploadError('');
    if (!navigator.geolocation) {
      setUploadError('Location sharing is not supported on this device.');
      return;
    }
    setPermissionPrompt({
      title: 'Share current location?',
      message: 'We need location permission to share your current approximate location with this friend.',
      action: requestCurrentLocation
    });
  }

  function requestCurrentLocation() {
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await onSendLocation?.({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            live: false
          });
        } catch (err) {
          setUploadError(err.message || 'Could not share location');
        }
      },
      () => setUploadError('Location permission was denied or unavailable.'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  function shareLiveLocation() {
    setEmojiOpen(false);
    setAttachmentOpen(false);
    setUploadError('');
    if (!navigator.geolocation) {
      setUploadError('Live location is not supported on this device.');
      return;
    }
    setPermissionPrompt({
      title: 'Share live location?',
      message: 'We need location permission to share your live approximate location with this friend for 15 minutes.',
      action: startLiveLocationWatch
    });
  }

  function startLiveLocationWatch() {
    stopLiveLocation();
    const durationMs = 15 * 60 * 1000;
    liveLocationRef.current.timer = window.setTimeout(() => stopLiveLocation(true), durationMs);
    liveLocationRef.current.watchId = navigator.geolocation.watchPosition(
      async ({ coords }) => {
        try {
          const state = liveLocationRef.current;
          if (!state.messageId) {
            const message = await onSendLocation?.({
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy,
              live: true,
              durationMs
            });
            state.messageId = message?._id;
            state.lastSentAt = Date.now();
            setUploadError('Live location sharing for 15 minutes.');
            return;
          }
          if (Date.now() - state.lastSentAt < 15000) return;
          state.lastSentAt = Date.now();
          await onUpdateLiveLocation?.(state.messageId, {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy
          });
        } catch (err) {
          setUploadError(err.message || 'Could not update live location');
        }
      },
      () => setUploadError('Location permission was denied or unavailable.'),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 30000 }
    );
  }

  function stopLiveLocation(updateServer = false) {
    const state = liveLocationRef.current;
    if (state.watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(state.watchId);
    if (state.timer) window.clearTimeout(state.timer);
    if (updateServer && state.messageId) {
      onUpdateLiveLocation?.(state.messageId, { latitude: 0, longitude: 0, ended: true }).catch(() => {});
    }
    liveLocationRef.current = { watchId: null, messageId: null, timer: null, lastSentAt: 0 };
  }

  async function handleFilePick(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setCaptureMode('');
    if (!file || !onSendMedia) return;
    setEmojiOpen(false);
    setUploadError('');
    setUploading(true);
    try {
      await onSendMedia(file);
    } catch (err) {
      setUploadError(err.message || 'Could not send media');
    } finally {
      setUploading(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return;
    setEmojiOpen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size && onSendMedia) {
        setUploading(true);
        setUploadError('');
        try {
          await onSendMedia(new File([blob], `voice-${Date.now()}.webm`, { type: blob.type }));
        } catch (err) {
          setUploadError(err.message || 'Could not send voice note');
        } finally {
          setUploading(false);
        }
        }
      };
      recorder.start();
      setRecording(true);
    } catch {
      setRecording(false);
      setUploadError('Microphone permission is needed to record voice notes.');
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div data-no-tab-swipe className="flex h-full min-h-0 flex-col overflow-hidden bg-bg relative" style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}>
      <header className="shrink-0 border-b border-border-default bg-surface px-3 py-2.5 shadow-card z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={onBack} className="btn-icon h-10 w-10" aria-label="Back to chats"><ArrowLeft size={18} /></button>
            {chat?.isMock && chat?.type === 'channel' ? (
              <button onClick={() => onProfile?.()} className="relative" aria-label={`View ${chat.name} info`}>
                <div className="h-10 w-10 rounded-xl bg-accent-light text-accent border border-border-default flex items-center justify-center shrink-0">
                  <Hash size={19} />
                </div>
              </button>
            ) : otherMember?.avatar ? (
              <button onClick={() => onProfile?.(otherMember)} className="relative" aria-label={`View ${displayName} profile`}>
                <img src={otherMember.avatar} alt="" className="h-10 w-10 rounded-full object-cover border border-border-default" />
                <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface ${otherMember.isOnline ? 'bg-success' : 'bg-border-default'}`} />
              </button>
            ) : null}
            <button onClick={() => (chat?.isMock ? onProfile?.() : (otherMember && onProfile?.(otherMember)))} className="min-w-0 text-left">
              <p className="truncate font-semibold text-text-primary">{chat?.isMock ? chat.name : (displayName || 'Select a chat')}</p>
              <p className={`truncate text-xs font-medium ${isTyping || (chat?.isMock ? isTyping : otherMember?.isOnline) ? 'text-accent' : 'text-text-muted'}`}>
                {isTyping ? 'typing...' : chat?.isMock ? '3 members • 2 online' : otherMember ? presenceText(otherMember) : 'No active conversation'}
              </p>
            </button>
          </div>
          <div className="flex gap-2">
            {chat?.isMock && chat?.type === 'channel' ? (
              <>
                <IconButton label="Search messages" icon={Search} onClick={() => setSearchOpen((open) => !open)} />
                <IconButton label="Channel info" icon={FileText} onClick={() => onProfile?.()} />
              </>
            ) : (
              <>
                <IconButton label="Audio call" icon={Phone} onClick={() => onStartCall?.('audio')} />
                <IconButton label="Video call" icon={Video} onClick={() => onStartCall?.('video')} />
                <IconButton label="Search messages" icon={Search} onClick={() => setSearchOpen((open) => !open)} />
              </>
            )}
          </div>
        </div>
        {searchOpen && (
          <label className="search-container mt-2">
            <Search size={16} className="text-text-muted shrink-0" />
            <input
              type="text"
              value={messageSearch}
              onChange={(event) => setMessageSearch(event.target.value)}
              placeholder="Search in conversation"
            />
            {messageSearch && (
              <button 
                onClick={() => setMessageSearch('')} 
                type="button" 
                className="rounded-full bg-border-default p-1.5 text-text-muted hover:text-text-primary transition active:scale-90 flex items-center justify-center shrink-0" 
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </label>
        )}
      </header>

      <section
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 scrollbar-thin"
      >
        <ConversationTimeline
          messages={messages}
          calls={calls}
          messageSearch={messageSearch}
          currentUserId={currentUserId}
          displayName={displayName}
          isTyping={isTyping}
          endRef={endRef}
          onReply={onReply}
          onReact={onReact}
          onEditMessage={onEditMessage}
          onDeleteMessage={onDeleteMessage}
          onReportMessage={onReportMessage}
        />
      </section>

      {/* Scroll-to-bottom FAB */}
      <AnimatePresence>
        {showScrollFAB && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            onClick={() => {
              scrollContainerRef.current?.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: 'smooth'
              });
            }}
            className="absolute bottom-24 right-4 btn-primary flex items-center gap-1.5 rounded-full px-3 py-2 text-xs shadow-float z-20"
          >
            <ArrowDown size={14} />
            <span>Recent Messages</span>
            {chat?.unreadCount > 0 && (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[8px] font-bold text-white badge-pulse">
                {chat.unreadCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <form onSubmit={onSend} className="shrink-0 border-t border-border-default bg-surface px-3 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-3 shadow-card z-10">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-accent/20 bg-accent-tint px-3 py-2 text-sm">
            <Reply size={15} className="text-accent" />
            <p className="min-w-0 flex-1 truncate text-text-secondary">{replyTo.text || 'Replying to message'}</p>
            <button type="button" onClick={onCancelReply} className="rounded-full bg-border-default p-1 text-text-muted hover:text-text-primary" aria-label="Cancel reply"><X size={14} /></button>
          </div>
        )}
        {uploadError && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
            <span>{uploadError}</span>
            <button type="button" onClick={() => setUploadError('')} className="rounded-full bg-border-default p-1 text-text-muted hover:text-text-primary" aria-label="Dismiss media error"><X size={13} /></button>
          </div>
        )}
        {emojiOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="mb-2 grid grid-cols-8 gap-1 rounded-2xl border border-border-default bg-surface p-2 shadow-float"
          >
            {composerEmojis.map((emoji, index) => (
              <motion.button
                key={`${emoji}-${index}`}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.015 }}
                whileTap={{ scale: 0.82 }}
                onClick={() => setText(`${text}${emoji}`)}
                className="grid h-9 place-items-center rounded-xl text-xl hover:bg-surface-hover"
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
        {attachmentOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="mb-2 rounded-[22px] border border-border-default bg-surface p-3 shadow-float"
          >
            <p className="mb-2 px-1 text-xs font-semibold text-text-faint">Share with this friend</p>
            <div className="grid grid-cols-4 gap-2">
              <AttachButton icon={Image} label="Gallery" onClick={() => openPicker({ accept: 'image/*,video/*', title: 'Open gallery?', message: 'We need access to your photos and videos so you can share media in this chat.' })} />
              <AttachButton icon={FileText} label="Document" onClick={() => openPicker({ accept: 'application/pdf,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.zip', title: 'Choose document?', message: 'We need access to your files so you can choose a document to share.' })} />
              <AttachButton icon={Camera} label="Camera" onClick={() => openPicker({ accept: 'image/*,video/*', capture: 'environment', title: 'Open camera?', message: 'We need camera access so you can take a photo or video to share.' })} />
              <AttachButton icon={MapPin} label="Location" onClick={shareCurrentLocation} />
            </div>
            <button type="button" onClick={shareLiveLocation} className="btn-secondary mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-2 text-xs font-semibold">
              <Navigation size={14} />
              Share live location
            </button>
          </motion.div>
        )}
        <div className="flex items-center gap-2 rounded-full border border-border-default bg-surface shadow-sm p-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept={fileAccept}
            capture={captureMode || undefined}
            className="hidden"
            onChange={handleFilePick}
          />
          <button type="button" onClick={openAttachmentSheet} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${attachmentOpen ? 'bg-accent text-white' : 'bg-bg text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`} aria-label="Share photos, media, files or location">
            <Plus size={18} />
          </button>
          <button type="button" onClick={() => setEmojiOpen((open) => !open)} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${emojiOpen ? 'bg-accent text-white' : 'bg-bg text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`} aria-label="Emoji"><Smile size={18} /></button>
          <textarea
            value={text}
            onChange={(event) => handleTextInput(event.target.value)}
            onFocus={() => setEmojiOpen(false)}
            className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm font-medium text-text-primary outline-none self-center"
            placeholder={uploading ? 'Uploading...' : recording ? 'Recording voice...' : chat ? 'Message' : 'Start from Discover'}
            disabled={!chat || uploading || recording}
            rows={1}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          {text.trim() ? (
            <button disabled={!chat || uploading} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white hover:bg-accent-hover active:scale-[0.96] transition disabled:opacity-40" aria-label="Send"><Send size={16} /></button>
          ) : recording ? (
            <button type="button" onClick={stopRecording} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-danger text-white hover:bg-red-600 active:scale-[0.96] transition" aria-label="Stop recording"><Square size={14} /></button>
          ) : (
            <button type="button" onClick={startRecording} disabled={!chat || uploading} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg text-text-secondary hover:bg-surface-hover hover:text-text-primary active:scale-[0.96] transition disabled:opacity-40" aria-label="Voice message"><Mic size={16} /></button>
          )}
        </div>
        {permissionPrompt && (
          <PermissionPrompt
            title={permissionPrompt.title}
            message={permissionPrompt.message}
            onCancel={() => setPermissionPrompt(null)}
            onContinue={() => {
              const action = permissionPrompt.action;
              setPermissionPrompt(null);
              action?.();
            }}
          />
        )}
      </form>
    </div>
  );
}

function PermissionPrompt({ title, message, onCancel, onContinue }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-end bg-black/45 p-3 backdrop-blur-sm">
      <motion.div initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="surface-card w-full max-w-md rounded-[24px] p-4 shadow-elevated">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-light text-accent">
            <MapPin size={19} />
          </span>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-text-muted">{message}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary rounded-2xl py-3 text-sm font-semibold">Not now</button>
          <button type="button" onClick={onContinue} className="btn-primary rounded-2xl py-3 text-sm font-semibold">Continue</button>
        </div>
      </motion.div>
    </div>
  );
}

function AttachButton({ icon: Icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="btn-secondary grid min-h-20 place-items-center rounded-2xl px-2 py-3 text-[11px] font-semibold text-text-secondary hover:translate-y-[-1px] transition">
      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-accent-tint text-accent">
        <Icon size={17} />
      </span>
      {label}
    </button>
  );
}

function IconButton({ label, icon: Icon, onClick }) {
  return (
    <button onClick={onClick} className="btn-icon h-10 w-10" aria-label={label}>
      <Icon size={18} />
    </button>
  );
}

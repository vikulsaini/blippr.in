import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Mic, Phone, Plus, Reply, Search, Send, Smile, Square, Video, X } from 'lucide-react';
import ConversationTimeline from './chat/ConversationTimeline.jsx';
import { getNickname, getOtherMember, normalizeId } from '../lib/chat.js';
import { presenceText } from '../lib/presence.js';

const composerEmojis = ['\u{1F60A}', '\u{1F602}', '\u{1F970}', '\u{1F60D}', '\u{1F44B}', '\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F525}', '\u{1F389}', '\u{1F622}', '\u{1F62E}', '\u{1F64F}', '\u{1F914}', '\u{1F634}', '\u{1F618}', '\u{2728}'];

export default function ChatWindow({ chat, messages = [], calls = [], currentUserId, text, setText, onSend, onSendMedia, onBack, onProfile, replyTo, onReply, onCancelReply, onReact, onEditMessage, onDeleteMessage, onReportMessage, onStartCall, isTyping = false }) {
  const myId = normalizeId(currentUserId);
  const otherMember = getOtherMember(chat, myId);
  const displayName = getNickname(chat, currentUserId, otherMember);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [viewportHeight, setViewportHeight] = useState(0);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.at(-1)?._id, calls.at(-1)?._id, isTyping]);

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
    setText(value);
  }

  async function handleFilePick(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
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
    <div data-no-tab-swipe className="flex h-full min-h-0 flex-col overflow-hidden bg-ink" style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}>
      <header className="shrink-0 border-b border-white/8 bg-slate-950/45 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={onBack} className="btn-icon h-10 w-10" aria-label="Back to chats"><ArrowLeft size={18} /></button>
            {otherMember?.avatar && (
              <button onClick={() => onProfile?.(otherMember)} className="relative" aria-label={`View ${displayName} profile`}>
                <img src={otherMember.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink ${otherMember.isOnline ? 'bg-mint' : 'bg-white/30'}`} />
              </button>
            )}
            <button onClick={() => otherMember && onProfile?.(otherMember)} className="min-w-0 text-left">
              <p className="truncate font-semibold text-white">{displayName || 'Select a chat'}</p>
              <p className={`truncate text-xs font-medium ${isTyping || otherMember?.isOnline ? 'text-mint' : 'text-slate-400'}`}>{isTyping ? 'typing...' : otherMember ? presenceText(otherMember) : 'No active conversation'}</p>
            </button>
          </div>
          <div className="flex gap-2">
            <IconButton label="Audio call" icon={Phone} onClick={() => onStartCall?.('audio')} />
            <IconButton label="Video call" icon={Video} onClick={() => onStartCall?.('video')} />
            <IconButton label="Search messages" icon={Search} onClick={() => setSearchOpen((open) => !open)} />
          </div>
        </div>
        {searchOpen && (
          <label className="mt-2 flex items-center gap-2 rounded-2xl border border-white/8 bg-black/24 px-3 shadow-[inset_0_2px_8px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]">
            <Search size={16} className="text-slate-400" />
            <input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" placeholder="Search in conversation" />
            {messageSearch && <button onClick={() => setMessageSearch('')} type="button" className="rounded-full bg-white/10 p-1" aria-label="Clear search"><X size={13} /></button>}
          </label>
        )}
      </header>

      <section className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
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

      <form onSubmit={onSend} className="shrink-0 border-t border-white/8 bg-slate-950/50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-3 backdrop-blur-xl">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-mint/20 bg-mint/10 px-3 py-2 text-sm">
            <Reply size={15} className="text-mint" />
            <p className="min-w-0 flex-1 truncate text-white/70">{replyTo.text || 'Replying to message'}</p>
            <button type="button" onClick={onCancelReply} className="rounded-full bg-white/10 p-1" aria-label="Cancel reply"><X size={14} /></button>
          </div>
        )}
        {uploadError && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-coral/25 bg-coral/10 px-3 py-2 text-xs text-coral">
            <span>{uploadError}</span>
            <button type="button" onClick={() => setUploadError('')} className="rounded-full bg-white/10 p-1" aria-label="Dismiss media error"><X size={13} /></button>
          </div>
        )}
        {emojiOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="mb-2 grid grid-cols-8 gap-1 rounded-2xl border border-white/8 bg-panel p-2 shadow-glow"
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
                className="grid h-9 place-items-center rounded-xl text-xl hover:bg-white/8"
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
        <div className="flex items-end gap-2 rounded-[20px] border border-white/8 bg-black/24 p-1.5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <input ref={fileInputRef} type="file" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt" className="hidden" onChange={handleFilePick} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-icon h-10 w-10 shrink-0" aria-label="Share media">
            <Plus size={19} />
          </button>
          <button type="button" onClick={() => setEmojiOpen((open) => !open)} className={`h-10 w-10 shrink-0 ${emojiOpen ? 'btn-primary rounded-full' : 'btn-icon'}`} aria-label="Emoji"><Smile size={18} /></button>
          <textarea
            value={text}
            onChange={(event) => handleTextInput(event.target.value)}
            onFocus={() => setEmojiOpen(false)}
            className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm font-medium text-slate-100 outline-none"
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
            <button disabled={!chat || uploading} className="btn-primary grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-40" aria-label="Send"><Send size={18} /></button>
          ) : recording ? (
            <button type="button" onClick={stopRecording} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-coral text-ink" aria-label="Stop recording"><Square size={16} /></button>
          ) : (
            <button type="button" onClick={startRecording} disabled={!chat || uploading} className="btn-icon h-10 w-10 shrink-0 disabled:opacity-40" aria-label="Voice message"><Mic size={18} /></button>
          )}
        </div>
      </form>
    </div>
  );
}

function IconButton({ label, icon: Icon, onClick }) {
  return (
    <button onClick={onClick} className="btn-icon h-10 w-10" aria-label={label}>
      <Icon size={18} />
    </button>
  );
}

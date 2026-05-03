import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ImagePlus, MessageCircle, Mic, Phone, PhoneMissed, Reply, Send, Smile, Video, X } from 'lucide-react';
import { presenceText } from '../lib/presence.js';

const quickEmojis = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F64F}'];
const composerEmojis = ['\u{1F60A}', '\u{1F602}', '\u{1F970}', '\u{1F60D}', '\u{1F44B}', '\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F525}', '\u{1F389}', '\u{1F622}', '\u{1F62E}', '\u{1F64F}', '\u{1F914}', '\u{1F634}', '\u{1F618}', '\u{2728}'];

export default function ChatWindow({ chat, messages = [], calls = [], currentUserId, text, setText, onSend, onBack, onProfile, replyTo, onReply, onCancelReply, onReact, onStartCall, isTyping = false }) {
  const otherMember = chat?.members?.find((member) => member._id !== currentUserId);
  const displayName = getNickname(chat, currentUserId, otherMember);
  const timeline = buildTimeline(messages, calls);
  const [reactionTarget, setReactionTarget] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  function react(emoji) {
    if (!reactionTarget) return;
    onReact?.(reactionTarget._id, emoji);
    setReactionTarget(null);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink">
      <header className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10" aria-label="Back to chats"><ArrowLeft size={18} /></button>
          {otherMember?.avatar && (
            <button onClick={() => onProfile?.(otherMember)} className="relative" aria-label={`View ${displayName} profile`}>
              <img src={otherMember.avatar} alt="" className="h-11 w-11 rounded-2xl object-cover" />
              <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink ${otherMember.isOnline ? 'bg-mint' : 'bg-white/30'}`} />
            </button>
          )}
          <button onClick={() => otherMember && onProfile?.(otherMember)} className="min-w-0 text-left">
            <p className="truncate font-semibold">{displayName || 'Select a chat'}</p>
            <p className={`truncate text-xs ${isTyping || otherMember?.isOnline ? 'text-mint' : 'text-white/45'}`}>{isTyping ? 'typing...' : otherMember ? presenceText(otherMember) : 'No active conversation'}</p>
          </button>
        </div>
        <div className="flex gap-2">
          <IconButton label="Audio call" icon={Phone} onClick={() => onStartCall?.('audio')} />
          <IconButton label="Video call" icon={Video} onClick={() => onStartCall?.('video')} />
        </div>
      </header>

      <section className="relative flex-1 overflow-y-auto bg-gradient-to-b from-white/[0.03] to-transparent p-4">
        {!timeline.length ? (
          <EmptyState name={displayName} />
        ) : (
          <div className="space-y-3">
            {timeline.map((item, index) => {
              const showDate = shouldShowDate(timeline[index - 1], item);
              if (item.kind === 'call') {
                return (
                  <div key={`call-${item.call._id}`}>
                    {showDate && <DateDivider value={item.createdAt} />}
                    <CallHistoryItem call={item.call} currentUserId={currentUserId} />
                  </div>
                );
              }
              const message = item.message;
              const mine = message.sender === currentUserId;
              return (
                <div key={`message-${message._id}`}>
                  {showDate && <DateDivider value={item.createdAt} />}
                  <MessageBubble
                    message={message}
                    mine={mine}
                    onLongPress={() => setReactionTarget(message)}
                    onSwipeRight={() => onReply?.(message)}
                  />
                </div>
              );
            })}
            {isTyping && <TypingBubble />}
          </div>
        )}
        {isTyping && !messages.length && <TypingBubble />}
        {reactionTarget && (
          <ReactionTray
            message={reactionTarget}
            onClose={() => setReactionTarget(null)}
            onReact={react}
          />
        )}
      </section>

      <form onSubmit={onSend} className="border-t border-white/10 bg-ink/40 p-3">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-2xl border border-mint/20 bg-mint/10 px-3 py-2 text-sm">
            <Reply size={15} className="text-mint" />
            <p className="min-w-0 flex-1 truncate text-white/70">{replyTo.text || 'Replying to message'}</p>
            <button type="button" onClick={onCancelReply} className="rounded-full bg-white/10 p-1" aria-label="Cancel reply"><X size={14} /></button>
          </div>
        )}
        {emojiOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="mb-2 grid grid-cols-8 gap-1 rounded-3xl border border-white/10 bg-white/10 p-2 shadow-glow backdrop-blur"
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
                className="grid h-9 place-items-center rounded-2xl text-xl hover:bg-white/10"
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
        <div className="flex items-end gap-2 rounded-3xl border border-white/10 bg-white/8 p-2">
          <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10" aria-label="Attach media"><ImagePlus size={18} /></button>
          <button type="button" onClick={() => setEmojiOpen((open) => !open)} className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${emojiOpen ? 'bg-mint text-ink' : 'bg-white/10'}`} aria-label="Emoji"><Smile size={18} /></button>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-sm outline-none"
            placeholder={chat ? 'Message' : 'Start from Discover'}
            disabled={!chat}
            rows={1}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          {text.trim() ? (
            <button disabled={!chat} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mint text-ink disabled:opacity-40" aria-label="Send"><Send size={18} /></button>
          ) : (
            <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10" aria-label="Voice message"><Mic size={18} /></button>
          )}
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message, mine, onLongPress, onSwipeRight }) {
  const timerRef = useRef(null);

  function startPress() {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onLongPress, 450);
  }

  function stopPress() {
    clearTimeout(timerRef.current);
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 64 }}
        dragElastic={0.25}
        onDragEnd={(_, info) => {
          if (info.offset.x > 42) onSwipeRight();
        }}
        onPointerDown={startPress}
        onPointerUp={stopPress}
        onPointerCancel={stopPress}
        onPointerLeave={stopPress}
        className={`max-w-[78%] touch-pan-y rounded-2xl px-3 py-1.5 text-sm shadow-sm ${mine ? 'rounded-br-md bg-mint text-ink' : 'rounded-bl-md bg-white/10 text-white'}`}
      >
        {message.replyTo && (
          <div className={`mb-1.5 rounded-xl border-l-2 px-2.5 py-1.5 text-xs ${mine ? 'border-ink/30 bg-ink/10 text-ink/65' : 'border-mint/50 bg-white/10 text-white/55'}`}>
            <p className="line-clamp-2">{message.replyTo.text || 'Replied message'}</p>
          </div>
        )}
        {message.media?.url && <MediaPreview media={message.media} />}
        {message.text && <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>}
        <div className={`mt-0.5 flex items-center justify-end gap-2 text-[10px] ${mine ? 'text-ink/55' : 'text-white/40'}`}>
          <span>{formatTime(message.createdAt)}</span>
          {mine && <span>{message.status || 'sent'}</span>}
        </div>
        {!!message.reactions?.length && (
          <div className="mt-1 flex flex-wrap gap-1">
            {reactionSummary(message.reactions).map((reaction) => (
              <span key={reaction.emoji} className={`rounded-full px-2 py-0.5 text-xs ${mine ? 'bg-ink/10' : 'bg-white/10'}`}>
                {reaction.emoji} {reaction.count}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function ReactionTray({ message, onClose, onReact }) {
  return (
    <div className="absolute inset-x-4 bottom-4 z-20">
      <div className="glass rounded-3xl p-3 shadow-glow">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="truncate text-xs text-white/50">React to: {message.text || 'message'}</p>
          <button onClick={onClose} className="rounded-full bg-white/10 p-1" aria-label="Close reactions"><X size={14} /></button>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {quickEmojis.map((emoji) => (
            <button key={emoji} onClick={() => onReact(emoji)} className="rounded-2xl bg-white/10 py-3 text-xl" aria-label={`React ${emoji}`}>
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CallHistoryItem({ call, currentUserId }) {
  const mine = getId(call.caller) === currentUserId;
  const isMissed = ['missed', 'rejected'].includes(call.status);
  const Icon = isMissed ? PhoneMissed : call.type === 'video' ? Video : Phone;
  const direction = mine ? 'Outgoing' : 'Incoming';
  const statusText = call.status === 'rejected' ? 'Declined' : call.status === 'missed' ? 'Missed' : formatDuration(call.durationSeconds);

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center">
      <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${isMissed ? 'border-coral/20 bg-coral/10 text-coral' : 'border-white/10 bg-white/8 text-white/62'}`}>
        <Icon size={15} />
        <span>{direction} {call.type} call</span>
        <span className="text-white/35">-</span>
        <span>{statusText}</span>
      </div>
    </motion.div>
  );
}

function TypingBubble() {
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white/10 px-3 py-2">
        {[0, 1, 2].map((dot) => (
          <motion.span
            key={dot}
            className="h-1.5 w-1.5 rounded-full bg-white/55"
            animate={{ y: [0, -4, 0], opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 0.85, repeat: Infinity, delay: dot * 0.14, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function IconButton({ label, icon: Icon, onClick }) {
  return (
    <button onClick={onClick} className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10" aria-label={label}>
      <Icon size={18} />
    </button>
  );
}

function EmptyState({ name }) {
  return (
    <div className="grid h-full place-items-center text-center">
      <div>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-mint/15 text-mint"><MessageCircle size={26} /></span>
        <p className="mt-4 font-semibold">Start the conversation</p>
        <p className="mt-1 text-sm text-white/45">{name ? `Say hello to ${name}.` : 'Choose a friend from your list.'}</p>
      </div>
    </div>
  );
}

function DateDivider({ value }) {
  return (
    <div className="my-4 flex justify-center">
      <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] text-white/45">{formatDate(value)}</span>
    </div>
  );
}

function MediaPreview({ media }) {
  if (media.type === 'image') return <img src={media.url} alt="" className="mb-2 max-h-64 rounded-2xl object-cover" />;
  return <a href={media.url} className="mb-2 block rounded-2xl bg-white/10 px-3 py-2 text-xs underline">Open attachment</a>;
}

function shouldShowDate(previous, current) {
  const currentDate = current?.createdAt || current?.message?.createdAt || current?.call?.createdAt;
  const previousDate = previous?.createdAt || previous?.message?.createdAt || previous?.call?.createdAt;
  if (!currentDate) return false;
  if (!previousDate) return true;
  return new Date(previousDate).toDateString() !== new Date(currentDate).toDateString();
}

function formatDate(value) {
  if (!value) return 'Today';
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function reactionSummary(reactions = []) {
  return Object.values(
    reactions.reduce((acc, reaction) => {
      acc[reaction.emoji] ||= { emoji: reaction.emoji, count: 0 };
      acc[reaction.emoji].count += 1;
      return acc;
    }, {})
  );
}

function buildTimeline(messages, calls) {
  return [
    ...messages.map((message) => ({ kind: 'message', message, createdAt: message.createdAt })),
    ...calls.map((call) => ({ kind: 'call', call, createdAt: call.createdAt }))
  ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function getId(value) {
  return typeof value === 'string' ? value : value?._id;
}

function formatDuration(seconds = 0) {
  if (!seconds) return '0s';
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (!minutes) return `${remaining}s`;
  return `${minutes}m ${String(remaining).padStart(2, '0')}s`;
}

function getNickname(chat, currentUserId, user) {
  if (!user) return '';
  return chat?.nicknames?.[`${currentUserId}:${user._id}`] || user.name;
}

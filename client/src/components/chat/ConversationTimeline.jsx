import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, CheckCheck, Copy, Edit3, Flag, MapPin, MessageCircle, Phone, PhoneMissed, Reply, Trash2, Video, X } from 'lucide-react';
import { normalizeId } from '../../lib/chat.js';

const quickEmojis = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F64F}'];

export default function ConversationTimeline({
  messages,
  calls,
  messageSearch,
  currentUserId,
  displayName,
  isTyping,
  endRef,
  onReply,
  onReact,
  onEditMessage,
  onDeleteMessage,
  onReportMessage
}) {
  const myId = normalizeId(currentUserId);
  const [actionTarget, setActionTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editText, setEditText] = useState('');
  const normalizedSearch = messageSearch.trim().toLowerCase();
  const timeline = buildTimeline(messages, calls);
  const visibleTimeline = normalizedSearch
    ? timeline.filter((item) => item.kind === 'message' && `${item.message.text || ''} ${item.message.media?.name || ''}`.toLowerCase().includes(normalizedSearch))
    : timeline;

  async function copyMessage(message) {
    const value = message.text || message.media?.url || '';
    if (!value) return;
    await navigator.clipboard?.writeText(value).catch(() => {});
  }

  function react(emoji) {
    if (!actionTarget) return;
    onReact?.(actionTarget._id, emoji);
    setActionTarget(null);
  }

  if (!visibleTimeline.length) {
    return (
      <>
        <EmptyState name={displayName} />
        {isTyping && <TypingBubble />}
      </>
    );
  }

  return (
    <>
    <div className="space-y-2.5">
        {visibleTimeline.map((item, index) => {
          const showDate = shouldShowDate(visibleTimeline[index - 1], item);
          if (item.kind === 'call') {
            return (
              <div key={`call-${item.call._id}`}>
                {showDate && <DateDivider value={item.createdAt} />}
                <CallHistoryItem call={item.call} currentUserId={currentUserId} />
              </div>
            );
          }
          const message = item.message;
          const mine = normalizeId(message.sender) === myId;
          return (
            <div key={`message-${message._id}`}>
              {showDate && <DateDivider value={item.createdAt} />}
              <MessageBubble
                message={message}
                mine={mine}
                onLongPress={() => setActionTarget(message)}
                onSwipeRight={() => onReply?.(message)}
              />
            </div>
          );
        })}
        {isTyping && <TypingBubble />}
        <div ref={endRef} />
      </div>

      {actionTarget && (
        <MessageActionSheet
          message={actionTarget}
          mine={normalizeId(actionTarget.sender) === myId}
          onClose={() => setActionTarget(null)}
          onReact={react}
          onReply={() => {
            onReply?.(actionTarget);
            setActionTarget(null);
          }}
          onEdit={() => {
            setEditTarget(actionTarget);
            setEditText(actionTarget.text || '');
            setActionTarget(null);
          }}
          onDeleteMe={() => {
            onDeleteMessage?.(actionTarget._id, 'me');
            setActionTarget(null);
          }}
          onDeleteEveryone={() => {
            onDeleteMessage?.(actionTarget._id, 'everyone');
            setActionTarget(null);
          }}
          onCopy={() => {
            copyMessage(actionTarget);
            setActionTarget(null);
          }}
          onReport={() => {
            onReportMessage?.(actionTarget);
            setActionTarget(null);
          }}
        />
      )}

      {editTarget && (
        <EditMessageSheet
          value={editText}
          onChange={setEditText}
          onClose={() => setEditTarget(null)}
          onSave={() => {
            const nextText = editText.trim();
            if (nextText) onEditMessage?.(editTarget._id, nextText);
            setEditTarget(null);
          }}
        />
      )}
    </>
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
    <motion.div layout initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }} className={`flex w-full ${mine ? 'justify-end' : 'justify-start'}`}>
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
        className={`max-w-[78%] touch-pan-y rounded-[20px] px-3 py-2 text-sm ${mine ? 'rounded-br-md border border-cyan-100/10 bg-gradient-to-r from-mint to-cyan-500 text-ink shadow-[3px_3px_10px_rgba(0,0,0,0.3)]' : 'rounded-bl-md border border-white/5 bg-ink text-slate-100 shadow-nm-flat-sm'}`}
      >
        {message.replyTo && (
          <div className={`mb-1.5 rounded-xl border-l-2 px-2.5 py-1.5 text-xs ${mine ? 'border-ink/30 bg-ink/10 text-ink/70' : 'border-mint/50 bg-white/8 text-slate-300'}`}>
            <p className="line-clamp-2">{message.replyTo.text || 'Replied message'}</p>
          </div>
        )}
        {message.media && <MediaPreview media={message.media} />}
        {message.location && <LocationPreview location={message.location} mine={mine} />}
        {message.text && <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>}
        <div className={`mt-1 flex items-center justify-end gap-2 text-[10px] font-medium ${mine ? 'text-ink/62' : 'text-slate-400'}`}>
          {message.editedAt && <span>edited</span>}
          <span>{formatTime(message.createdAt)}</span>
          {mine && <StatusIcon status={message.status} />}
        </div>
        {!!message.reactions?.length && (
          <div className="mt-1 flex flex-wrap gap-1">
            {reactionSummary(message.reactions).map((reaction) => (
              <span key={reaction.emoji} className={`rounded-full px-2 py-0.5 text-xs ${mine ? 'bg-ink/12' : 'bg-white/8'}`}>
                {reaction.emoji} {reaction.count}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function MessageActionSheet({ message, mine, onClose, onReact, onReply, onEdit, onDeleteMe, onDeleteEveryone, onCopy, onReport }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <button className="fixed inset-0 cursor-default bg-black/35 backdrop-blur-[2px]" onClick={onClose} aria-label="Close message actions" />
      <motion.div initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="surface relative mx-auto max-w-md rounded-t-[24px] p-3 shadow-glow">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="truncate text-xs text-white/50">{message.text || 'Message options'}</p>
          <button onClick={onClose} className="btn-icon h-7 w-7" aria-label="Close reactions"><X size={14} /></button>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {quickEmojis.map((emoji) => (
            <button key={emoji} onClick={() => onReact(emoji)} className="btn-secondary rounded-xl py-3 text-xl" aria-label={`React ${emoji}`}>
              {emoji}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ActionButton icon={Reply} label="Reply" onClick={onReply} />
          <ActionButton icon={Copy} label="Copy" onClick={onCopy} disabled={!message.text && !message.media?.url} />
          {mine && <ActionButton icon={Edit3} label="Edit" onClick={onEdit} />}
          <ActionButton icon={Trash2} label="Delete for me" onClick={onDeleteMe} tone="danger" />
          {mine && <ActionButton icon={Trash2} label="Delete everyone" onClick={onDeleteEveryone} tone="danger" />}
          {!mine && <ActionButton icon={Flag} label="Report" onClick={onReport} tone="danger" />}
        </div>
      </motion.div>
    </div>
  );
}

function EditMessageSheet({ value, onChange, onClose, onSave }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[65] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <button className="fixed inset-0 cursor-default bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-label="Close edit message" />
      <motion.div initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="surface relative mx-auto max-w-md rounded-t-[24px] p-4 shadow-glow">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Edit message</h3>
            <p className="mt-0.5 text-xs text-white/45">Update the text and save it back to the conversation.</p>
          </div>
          <button onClick={onClose} className="btn-icon h-8 w-8" aria-label="Cancel edit"><X size={15} /></button>
        </div>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoFocus
          rows={3}
          className="mt-4 w-full resize-none rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-sm outline-none focus:border-mint/40"
          placeholder="Edit message"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="btn-secondary rounded-2xl py-3 text-sm font-semibold">Cancel</button>
          <button type="button" onClick={onSave} disabled={!value.trim()} className="btn-primary rounded-2xl py-3 text-sm font-semibold disabled:opacity-35">Save</button>
        </div>
      </motion.div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, tone = 'neutral', disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold disabled:opacity-35 ${tone === 'danger' ? 'border border-coral/20 bg-coral/10 text-coral' : 'btn-secondary'}`}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function StatusIcon({ status }) {
  if (status === 'failed') return <span className="text-coral">!</span>;
  if (status === 'queued') return <span className="text-[9px] text-current/70">queued</span>;
  if (status === 'sending') return <span className="h-2 w-2 animate-pulse rounded-full bg-current/60" title="Sending" />;
  if (status === 'seen') return <CheckCheck size={13} className="text-mint" aria-label="Seen" />;
  if (status === 'delivered') return <CheckCheck size={13} aria-label="Delivered" />;
  return <Check size={13} aria-label="Sent" />;
}

function CallHistoryItem({ call, currentUserId }) {
  const mine = normalizeId(call.caller) === normalizeId(currentUserId);
  const isMissed = ['missed', 'rejected'].includes(call.status);
  const Icon = isMissed ? PhoneMissed : call.type === 'video' ? Video : Phone;
  const direction = mine ? 'Outgoing' : 'Incoming';
  const statusText = call.status === 'rejected' ? 'Declined' : call.status === 'missed' ? 'Missed' : formatDuration(call.durationSeconds);

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center">
      <div className={`flex max-w-[82%] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-nm-flat-sm ${isMissed ? 'border-coral/18 bg-coral/10 text-coral' : 'border-white/5 bg-ink text-slate-300'}`}>
        <Icon size={13} />
        <span>{direction} {call.type} call</span>
        <span className="text-slate-500">-</span>
        <span>{statusText}</span>
      </div>
    </motion.div>
  );
}

function TypingBubble() {
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
      <div className="flex items-center gap-1 rounded-[20px] rounded-bl-md border border-white/5 bg-ink px-3 py-2 shadow-nm-flat-sm">
        {[0, 1, 2].map((dot) => (
          <motion.span
            key={dot}
            className="h-1.5 w-1.5 rounded-full bg-slate-300"
            animate={{ y: [0, -4, 0], opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 0.85, repeat: Infinity, delay: dot * 0.14, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function EmptyState({ name }) {
  return (
    <div className="grid h-full place-items-center text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/8 text-mint"><MessageCircle size={24} /></span>
        <p className="mt-4 font-semibold">Start the conversation</p>
        <p className="mt-1 text-sm text-white/45">{name ? `Say hello to ${name}.` : 'Choose a friend from your list.'}</p>
      </div>
    </div>
  );
}

function DateDivider({ value }) {
  return (
    <div className="my-4 flex justify-center">
      <span className="rounded-full border border-white/5 bg-ink px-3 py-1 text-[11px] font-medium text-slate-400 shadow-nm-inset-sm">{formatDate(value)}</span>
    </div>
  );
}

function MediaPreview({ media }) {
  if (!media.url) return <span className="mb-2 block rounded-2xl bg-white/10 px-3 py-2 text-xs">Preparing attachment...</span>;
  if (media.type === 'image') return <img src={media.url} alt="" className="mb-2 max-h-64 rounded-2xl object-cover" />;
  if (media.type === 'audio') {
    return (
      <div className="mb-2 rounded-2xl bg-white/10 p-2">
        <div className="mb-2 flex h-8 items-end gap-0.5">
          {Array.from({ length: 24 }).map((_, index) => (
            <span key={index} className="w-1 rounded-full bg-mint/70" style={{ height: `${8 + ((index * 7) % 22)}px` }} />
          ))}
        </div>
        <audio src={media.url} controls className="max-w-full" />
      </div>
    );
  }
  if (media.type === 'video') return <video src={media.url} controls className="mb-2 max-h-64 rounded-2xl" />;
  return <a href={media.url} className="mb-2 block rounded-2xl bg-white/10 px-3 py-2 text-xs underline">{media.name || 'Open attachment'}</a>;
}

function LocationPreview({ location, mine }) {
  const [longitude, latitude] = location.coordinates || [];
  const mapUrl = typeof latitude === 'number' && typeof longitude === 'number' ? `https://maps.google.com/?q=${latitude},${longitude}` : '';
  const live = location.type === 'live';
  const ended = !!location.endedAt || (location.expiresAt && new Date(location.expiresAt).getTime() < Date.now());

  return (
    <a
      href={mapUrl || undefined}
      target="_blank"
      rel="noreferrer"
      className={`mb-2 block rounded-2xl border p-3 no-underline ${mine ? 'border-ink/12 bg-ink/10 text-ink' : 'border-white/8 bg-white/8 text-slate-100'}`}
    >
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-2xl ${live && !ended ? 'bg-mint text-ink' : 'bg-white/10'}`}>
          <MapPin size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{live ? (ended ? 'Live location ended' : 'Live location') : 'Current location'}</span>
          <span className={`block truncate text-xs ${mine ? 'text-ink/58' : 'text-white/50'}`}>
            {mapUrl ? 'Tap to open map' : 'Waiting for coordinates'}
            {location.updatedAt ? ` · updated ${formatTime(location.updatedAt)}` : ''}
          </span>
        </span>
      </div>
    </a>
  );
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

function formatDuration(seconds = 0) {
  if (!seconds) return '0s';
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (!minutes) return `${remaining}s`;
  return `${minutes}m ${String(remaining).padStart(2, '0')}s`;
}

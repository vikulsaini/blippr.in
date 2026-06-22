import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Clock, Eye, Send, Copy, Edit3, Flag, MapPin, MessageCircle, Phone, PhoneMissed, Reply, Trash2, Video, X } from 'lucide-react';
import { normalizeId } from '../../lib/chat.js';
import { useProximity } from '../../hooks/useProximity.js';

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
  onReportMessage,
  otherMember,
  onRetryMessage
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

  const [visibleCount, setVisibleCount] = useState(50);

  // Progressive list windowing: render additional items when scrolling near the top
  useEffect(() => {
    const parent = endRef.current?.closest('.overflow-y-auto');
    if (!parent) return;

    const handleScroll = () => {
      if (parent.scrollTop < 250) {
        setVisibleCount((prev) => Math.min(prev + 25, visibleTimeline.length));
      }
    };

    parent.addEventListener('scroll', handleScroll);
    return () => parent.removeEventListener('scroll', handleScroll);
  }, [visibleTimeline.length, endRef]);

  // Reset window count to 50 when the active chat changes
  const activeChatId = timeline[0]?.message?.chat || timeline[0]?.call?.chat || '';
  useEffect(() => {
    setVisibleCount(50);
  }, [activeChatId]);

  const renderedTimeline = useMemo(() => {
    return visibleTimeline.slice(-visibleCount);
  }, [visibleTimeline, visibleCount]);

  const lastSeenMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (normalizeId(m.sender) === myId && m.status === 'seen') {
        return m._id;
      }
    }
    return null;
  }, [messages, myId]);

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

  if (!renderedTimeline.length) {
    return (
      <>
        <div className="flex justify-center my-6">
          <div className="bg-[#171f33]/70 backdrop-blur-xl px-4 py-1.5 rounded-full flex items-center gap-2 border border-[#d2bbff]/20 shadow-sm">
            <span className="material-symbols-outlined text-[#d2bbff] text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            <span className="text-[10px] text-[#ccc3d8] uppercase tracking-widest font-semibold font-label-md">Blipp-Sync Active</span>
          </div>
        </div>
        <EmptyState name={displayName} />
        {isTyping && <TypingBubble name={displayName} />}
      </>
    );
  }

  return (
    <>
      <div className="flex justify-center my-6">
        <div className="bg-[#171f33]/70 backdrop-blur-xl px-4 py-1.5 rounded-full flex items-center gap-2 border border-[#d2bbff]/20 shadow-sm">
          <span className="material-symbols-outlined text-[#d2bbff] text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
          <span className="text-[10px] text-[#ccc3d8] uppercase tracking-widest font-semibold font-label-md">Blipp-Sync Active</span>
        </div>
      </div>

      <div className="space-y-2.5" style={{ transition: 'none' }}>
        <AnimatePresence initial={false}>
          {renderedTimeline.map((item, index) => {
            const showDate = shouldShowDate(renderedTimeline[index - 1], item);
            if (item.kind === 'call') {
              return (
                <motion.div
                  key={`call-${item.call._id}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '50px' }}
                >
                  {showDate && <DateDivider value={item.createdAt} />}
                  <CallHistoryItem call={item.call} currentUserId={currentUserId} />
                </motion.div>
              );
            }
            const message = item.message;
            const mine = normalizeId(message.sender) === myId;
            const isOptimistic = message.status === 'sending' || message.status === 'queued' || message.status === 'failed';
            return (
              <motion.div
                key={`message-${message.clientId || message._id}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                style={{ contentVisibility: 'auto', containIntrinsicSize: '80px' }}
              >
                {showDate && <DateDivider value={item.createdAt} />}
                <MessageBubble
                  message={message}
                  mine={mine}
                  onLongPress={isOptimistic ? undefined : setActionTarget}
                  onSwipeRight={isOptimistic ? undefined : onReply}
                  isLastSeen={message._id === lastSeenMessageId}
                  otherMember={otherMember}
                  onRetry={() => onRetryMessage?.(message.clientId || message._id)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
        {isTyping && <TypingBubble name={displayName} />}
        <div ref={endRef} />
      </div>

      <AnimatePresence>
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
      </AnimatePresence>

      <AnimatePresence>
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
      </AnimatePresence>
    </>
  );
}

const MessageBubble = memo(function MessageBubble({ message, mine, onLongPress, onSwipeRight, isLastSeen, otherMember, onRetry }) {
  const timerRef = useRef(null);

  function startPress() {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onLongPress?.(message), 3000);
  }

  function stopPress() {
    clearTimeout(timerRef.current);
  }

  return (
    <div className={`flex w-full flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <motion.div
        initial={{
          opacity: 0,
          scale: 0.82,
          y: 12,
          x: mine ? 22 : -22
        }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          x: 0
        }}
        transition={{
          type: 'spring',
          stiffness: 380,
          damping: 26
        }}
        className="w-full flex"
        style={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}
      >
        <motion.div
          drag={onSwipeRight ? "x" : false}
          dragConstraints={{ left: 0, right: 64 }}
          dragElastic={0.25}
          dragSnapToOrigin={true}
          onDragEnd={(_, info) => {
            if (onSwipeRight && info.offset.x > 42) onSwipeRight(message);
          }}
          onPointerDown={onLongPress ? startPress : undefined}
          onPointerUp={stopPress}
          onPointerCancel={stopPress}
          onPointerLeave={stopPress}
          className={`max-w-[82%] touch-pan-y rounded-2xl p-4 text-sm ${mine ? 'rounded-br-none bg-[#7c3aed] text-[#ede0ff] shadow-[0_4px_12px_rgba(124,58,237,0.2)]' : 'rounded-bl-none border border-white/5 bg-[#222a3e] text-[#dbe2fd] shadow-sm'} transition-all duration-200`}
          style={{
            opacity: (message.status === 'sending' || message.status === 'queued') ? 0.7 : 1,
            transition: 'background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease, opacity 200ms ease'
          }}
        >
          {message.replyTo && (
            <div className={`mb-1.5 rounded-xl border-l-2 px-2.5 py-1.5 text-xs ${mine ? 'border-white/40 bg-white/10 text-white/95' : 'border-[#7c3aed]/40 bg-[#0b1326]/40 text-[#ccc3d8]'}`}>
              <p className="line-clamp-2">{message.replyTo.text || 'Replied message'}</p>
            </div>
          )}
          {message.media && <MediaPreview media={message.media} />}
          {message.location && <LocationPreview location={message.location} mine={mine} />}
          {message.text && (
            <p className={`whitespace-pre-wrap leading-relaxed ${mine ? 'text-[#ede0ff]' : 'text-[#dbe2fd] font-medium'}`}>
              {message.text}
            </p>
          )}
          <div className={`mt-1 flex items-center justify-end gap-2 text-[10px] font-medium ${mine ? 'text-white/70' : 'text-[#ccc3d8]/60'}`}>
            {message.editedAt && <span>edited</span>}
            <span>{formatTime(message.createdAt)}</span>
            {mine && <StatusIcon status={message.status} onRetry={onRetry} />}
          </div>
          {!!message.reactions?.length && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {reactionSummary(message.reactions).map((reaction) => (
                <span key={reaction.emoji} className={`rounded-full px-2 py-0.5 text-xs border ${mine ? 'bg-white/10 border-white/25 text-white' : 'bg-[#0b1326]/50 border-white/10 text-[#ccc3d8]'}`}>
                  {reaction.emoji} {reaction.count}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
      {isLastSeen && otherMember?.avatar && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6, y: -2 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="mt-1 flex items-center justify-end px-1"
        >
          <img
            src={otherMember.avatar}
            alt=""
            className="h-3.5 w-3.5 rounded-full object-cover border border-border-default shadow-sm"
          />
        </motion.div>
      )}
    </div>
  );
}, (prev, next) => {
  return (
    prev.mine === next.mine &&
    prev.isLastSeen === next.isLastSeen &&
    prev.otherMember?.avatar === next.otherMember?.avatar &&
    prev.message._id === next.message._id &&
    prev.message.status === next.message.status &&
    prev.message.text === next.message.text &&
    prev.message.editedAt === next.message.editedAt &&
    prev.message.reactions?.length === next.message.reactions?.length
  );
});

function MessageActionSheet({ message, mine, onClose, onReact, onReply, onEdit, onDeleteMe, onDeleteEveryone, onCopy, onReport }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <motion.button 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 cursor-default bg-black/60 backdrop-blur-[4px]" 
        onClick={onClose} 
        aria-label="Close message actions" 
      />
      <motion.div 
        initial={{ y: 80, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className="relative mx-auto max-w-md rounded-t-[24px] border border-white/10 bg-[#171f33]/90 backdrop-blur-xl p-4 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] text-[#dbe2fd]"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="truncate text-xs text-[#ccc3d8]/80">{message.text || 'Message options'}</p>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/10 text-[#ccc3d8] transition-colors" aria-label="Close reactions"><X size={14} /></button>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {quickEmojis.map((emoji) => (
            <motion.button
              key={emoji}
              whileHover={{ scale: 1.18, y: -2 }}
              whileTap={{ scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              onClick={() => onReact(emoji)}
              className="border border-white/5 bg-white/5 hover:bg-white/10 text-white rounded-xl py-3 text-xl transition-all"
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </motion.button>
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
      <motion.button 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 cursor-default bg-black/50 backdrop-blur-[3px]" 
        onClick={onClose} 
        aria-label="Close edit message" 
      />
      <motion.div 
        initial={{ y: 80, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className="relative mx-auto max-w-md rounded-t-[24px] border border-white/10 bg-[#171f33]/95 backdrop-blur-xl p-5 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] text-[#dbe2fd]"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg text-white">Edit message</h3>
            <p className="mt-0.5 text-xs text-[#ccc3d8]/80">Update the text and save it back to the conversation.</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10 text-[#ccc3d8] transition-colors" aria-label="Cancel edit"><X size={15} /></button>
        </div>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoFocus
          rows={3}
          className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-[#0b1326]/60 px-3 py-3 text-sm outline-none focus:border-[#d2bbff]/40 text-[#dbe2fd] placeholder-[#ccc3d8]/40"
          placeholder="Edit message"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="border border-white/10 bg-[#131b2e]/60 hover:bg-[#171f33] text-[#dbe2fd] rounded-2xl py-3 text-sm font-semibold transition-colors">Cancel</button>
          <button type="button" onClick={onSave} disabled={!value.trim()} className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-2xl py-3 text-sm font-semibold disabled:opacity-35 shadow-[0_0_15px_rgba(124,58,237,0.4)] transition-all">Save</button>
        </div>
      </motion.div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, tone = 'neutral', disabled = false }) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: disabled ? 1 : 1.03, y: disabled ? 0 : -1 }}
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold disabled:opacity-35 transition-all duration-200 ${tone === 'danger' ? 'border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'border border-white/10 bg-[#131b2e]/60 hover:bg-[#171f33] text-[#dbe2fd] hover:border-[#d2bbff]/30'}`}
    >
      <Icon size={15} />
      {label}
    </motion.button>
  );
}

function StatusIcon({ status, onRetry }) {
  if (status === 'failed') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRetry?.();
        }}
        className="flex items-center gap-1 rounded bg-red-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-red-300 hover:bg-red-500/45 hover:text-white transition active:scale-95 cursor-pointer border border-red-500/30 outline-none"
        title="Failed to send. Tap to retry."
      >
        <AlertCircle size={10} className="stroke-[2.5]" />
        <span>Failed to Send. Tap to retry.</span>
      </button>
    );
  }
  if (status === 'sending' || status === 'queued') {
    return (
      <span className="flex items-center gap-0.5 text-[9px] text-[#d2bbff]/80 font-medium" title="Pending">
        <Clock size={10} className="animate-pulse" />
        <span>pending</span>
      </span>
    );
  }
  if (status === 'seen') {
    return (
      <span className="flex items-center gap-0.5 text-[9px] text-[#4edea3] font-bold" title="Seen">
        <Eye size={10} className="stroke-[2.5]" />
        <span>seen</span>
      </span>
    );
  }
  // status === 'sent' / 'delivered' / other
  return (
    <span className="flex items-center gap-0.5 text-[9px] text-[#d2bbff] font-medium" title="Sent">
      <Send size={10} />
      <span>sent</span>
    </span>
  );
}

function CallHistoryItem({ call, currentUserId }) {
  const mine = normalizeId(call.caller) === normalizeId(currentUserId);
  const isMissed = ['missed', 'rejected'].includes(call.status);
  const Icon = isMissed ? PhoneMissed : call.type === 'video' ? Video : Phone;
  const direction = mine ? 'Outgoing' : 'Incoming';
  const statusText = call.status === 'rejected' ? 'Declined' : call.status === 'missed' ? 'Missed' : formatDuration(call.durationSeconds);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className="flex justify-center"
    >
      <div className={`flex max-w-[82%] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-md backdrop-blur-sm ${isMissed ? 'border-red-500/20 bg-red-500/10 text-red-400' : 'border-white/10 bg-[#171f33]/50 text-[#ccc3d8]'}`}>
        <Icon size={13} />
        <span>{direction} {call.type} call</span>
        <span className="text-white/20">-</span>
        <span>{statusText}</span>
      </div>
    </motion.div>
  );
}

function TypingBubble({ name = 'Someone' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className="flex items-center gap-2 mt-4 ml-2"
    >
      <div className="typing-indicator flex items-center gap-1 bg-[#171f33]/70 backdrop-blur-xl px-3 py-2 rounded-full border border-white/10">
        <span className="h-1.5 w-1.5 bg-[#4edea3] rounded-full"></span>
        <span className="h-1.5 w-1.5 bg-[#4edea3] rounded-full"></span>
        <span className="h-1.5 w-1.5 bg-[#4edea3] rounded-full"></span>
      </div>
      <span className="font-label-md text-xs text-[#ccc3d8]/60 italic">{name} is typing...</span>
    </motion.div>
  );
}

function EmptyState({ name }) {
  return (
    <div className="grid h-full place-items-center text-center py-20">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#7c3aed]/25 text-[#d2bbff] border border-[#7c3aed]/35 shadow-[0_0_15px_rgba(124,58,237,0.2)]"><MessageCircle size={24} /></span>
        <p className="mt-4 font-semibold text-white">Start the conversation</p>
        <p className="mt-1 text-sm text-[#ccc3d8]/80">{name ? `Say hello to ${name}.` : 'Choose a friend from your list.'}</p>
      </div>
    </div>
  );
}

function DateDivider({ value }) {
  return (
    <div className="my-4 flex justify-center">
      <span className="rounded-full border border-white/10 bg-[#171f33]/40 backdrop-blur-sm px-3.5 py-1 text-[11px] font-semibold text-[#ccc3d8]/80">{formatDate(value)}</span>
    </div>
  );
}

function MediaPreview({ media }) {
  if (!media.url) return <span className="mb-2 block rounded-2xl border border-white/5 bg-[#0b1326]/30 px-3 py-2 text-xs text-[#ccc3d8]">Preparing attachment...</span>;
  if (media.type === 'image') {
    return (
      <div className="mb-2 w-[260px] max-w-full aspect-[4/3] bg-black/40 rounded-2xl overflow-hidden relative border border-white/10">
        <img src={media.url} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }
  if (media.type === 'audio') {
    return <VoiceNotePlayer media={media} />;
  }
  if (media.type === 'video') {
    return (
      <div className="mb-2 w-[260px] max-w-full aspect-[16/9] bg-black/40 rounded-2xl overflow-hidden relative border border-white/10">
        <video src={media.url} controls className="h-full w-full object-cover" />
      </div>
    );
  }
  return <a href={media.url} className="mb-2 block rounded-2xl border border-white/5 bg-[#0b1326]/30 px-3 py-2 text-xs underline text-[#d2bbff] hover:text-white transition-colors">{media.name || 'Open attachment'}</a>;
}

function formatAudioDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
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
      className={`mb-2 block rounded-2xl border p-3 no-underline ${mine ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-[#0b1326]/40 text-[#dbe2fd]'}`}
    >
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-2xl ${live && !ended ? 'bg-white text-[#7c3aed]' : 'bg-[#7c3aed]/25 text-[#d2bbff] border border-[#7c3aed]/35'}`}>
          <MapPin size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{live ? (ended ? 'Live location ended' : 'Live location') : 'Current location'}</span>
          <span className={`block truncate text-xs ${mine ? 'text-white/75' : 'text-[#ccc3d8]/70'}`}>
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
  
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = todayStart.getTime() - dateStart.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'long' });
  }
  
  const options = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== today.getFullYear()) {
    options.year = 'numeric';
  }
  return date.toLocaleDateString([], options);
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

function VoiceNotePlayer({ media }) {
  const audioRef = useRef(null);
  const proximityNear = useProximity();

  useEffect(() => {
    if (audioRef.current) {
      setAudioOutput(audioRef.current, !proximityNear).catch(() => {});
    }
  }, [proximityNear]);

  const hasWaveform = Array.isArray(media.waveform) && media.waveform.length > 0;
  const waveformData = hasWaveform ? media.waveform : Array.from({ length: 24 }).map((_, index) => 8 + ((index * 7) % 22));

  return (
    <div className="mb-2 rounded-2xl border border-white/5 bg-[#0b1326]/50 p-3">
      <div className="mb-2 flex h-10 items-end gap-1 px-1">
        {waveformData.map((amplitude, index) => {
          const height = Math.max(4, Math.round((amplitude / 100) * 36));
          return (
            <span key={index} className="w-1 rounded-full bg-[#d2bbff]/70 transition-all duration-200" style={{ height: `${height}px` }} />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] text-[#ccc3d8] mb-1 px-1 font-semibold">
        <span>Voice note {proximityNear ? '· Earpiece Active' : ''}</span>
        {media.duration && <span>{formatAudioDuration(media.duration)}</span>}
      </div>
      <audio ref={audioRef} src={media.url} controls className="max-w-full rounded-lg" />
    </div>
  );
}

async function setAudioOutput(audioElement, speakerOn) {
  if (!audioElement?.setSinkId) return;
  try {
    const outputs = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    const audioOutputs = outputs.filter((device) => device.kind === 'audiooutput');
    const speaker = audioOutputs.find((device) => /speaker|loudspeaker/i.test(device.label));
    const earpiece = audioOutputs.find((device) => /earpiece|receiver|phone|communications|headset/i.test(device.label));

    if (speakerOn) {
      if (speaker?.deviceId) {
        await audioElement.setSinkId(speaker.deviceId);
      } else {
        await audioElement.setSinkId('');
      }
    } else {
      if (earpiece?.deviceId) {
        await audioElement.setSinkId(earpiece.deviceId);
      } else {
        await audioElement.setSinkId('');
      }
    }
  } catch (error) {
    console.warn('setSinkId failed in VoiceNotePlayer:', error);
  }
}

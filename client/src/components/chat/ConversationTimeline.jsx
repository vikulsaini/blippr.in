import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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
  otherMember
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

  const lastSeenMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (normalizeId(m.sender) === myId && m.status === 'seen') {
        return m._id;
      }
    }
    return null;
  }, [messages, myId]);

  return (
    <>
    <div className="space-y-2.5" style={{ transition: 'all 0.2s ease-out' }}>
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
          const isOptimistic = message.status === 'sending' || message.status === 'queued' || message.status === 'failed';
          return (
            <div key={`message-${message._id}`}>
              {showDate && <DateDivider value={item.createdAt} />}
              <MessageBubble
                message={message}
                mine={mine}
                onLongPress={isOptimistic ? undefined : () => setActionTarget(message)}
                onSwipeRight={isOptimistic ? undefined : () => onReply?.(message)}
                isLastSeen={message._id === lastSeenMessageId}
                otherMember={otherMember}
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

function MessageBubble({ message, mine, onLongPress, onSwipeRight, isLastSeen, otherMember }) {
  const timerRef = useRef(null);

  function startPress() {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onLongPress, 450);
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
            if (onSwipeRight && info.offset.x > 42) onSwipeRight();
          }}
          onPointerDown={onLongPress ? startPress : undefined}
          onPointerUp={stopPress}
          onPointerCancel={stopPress}
          onPointerLeave={stopPress}
          className={`max-w-[78%] touch-pan-y rounded-[20px] px-3.5 py-2.5 text-sm ${mine ? 'rounded-br-none bg-gradient-to-br from-accent to-accent-hover text-white shadow-card' : 'rounded-bl-none border border-border-default bg-surface text-text-primary shadow-card'} transition-colors duration-200`}
          style={{
            opacity: (message.status === 'sending' || message.status === 'queued') ? 0.7 : 1,
            transition: 'background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease, opacity 200ms ease'
          }}
        >
          {message.replyTo && (
            <div className={`mb-1.5 rounded-xl border-l-2 px-2.5 py-1.5 text-xs ${mine ? 'border-white/40 bg-white/10 text-white/90' : 'border-accent/40 bg-bg text-text-secondary'}`}>
              <p className="line-clamp-2">{message.replyTo.text || 'Replied message'}</p>
            </div>
          )}
          {message.media && <MediaPreview media={message.media} />}
          {message.location && <LocationPreview location={message.location} mine={mine} />}
          {message.text && (
            <p className={`whitespace-pre-wrap leading-relaxed ${mine ? 'text-white' : 'text-text-primary font-medium'}`}>
              {message.text}
            </p>
          )}
          <div className={`mt-1 flex items-center justify-end gap-2 text-[10px] font-medium ${mine ? 'text-white/80' : 'text-text-muted'}`}>
            {message.editedAt && <span>edited</span>}
            <span>{formatTime(message.createdAt)}</span>
            {mine && <StatusIcon status={message.status} />}
          </div>
          {!!message.reactions?.length && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {reactionSummary(message.reactions).map((reaction) => (
                <span key={reaction.emoji} className={`rounded-full px-2 py-0.5 text-xs ${mine ? 'bg-white/20 text-white' : 'bg-bg text-text-secondary border border-border-default'}`}>
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
}

function MessageActionSheet({ message, mine, onClose, onReact, onReply, onEdit, onDeleteMe, onDeleteEveryone, onCopy, onReport }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <button className="fixed inset-0 cursor-default bg-black/35 backdrop-blur-[2px]" onClick={onClose} aria-label="Close message actions" />
      <motion.div initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="surface-card relative mx-auto max-w-md rounded-t-[24px] p-3 shadow-elevated">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="truncate text-xs text-text-muted">{message.text || 'Message options'}</p>
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
      <motion.div initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="surface-card relative mx-auto max-w-md rounded-t-[24px] p-4 shadow-elevated">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Edit message</h3>
            <p className="mt-0.5 text-xs text-text-muted">Update the text and save it back to the conversation.</p>
          </div>
          <button onClick={onClose} className="btn-icon h-8 w-8" aria-label="Cancel edit"><X size={15} /></button>
        </div>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoFocus
          rows={3}
          className="mt-4 w-full resize-none rounded-2xl border border-border-default bg-bg px-3 py-3 text-sm outline-none focus:border-accent/40 text-text-primary"
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
      className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold disabled:opacity-35 ${tone === 'danger' ? 'border border-danger/20 bg-danger/10 text-danger hover:bg-danger/20 transition' : 'btn-secondary'}`}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function StatusIcon({ status }) {
  if (status === 'failed') {
    return (
      <span className="flex items-center gap-0.5 text-[9px] text-red-200 font-semibold" title="Failed">
        <AlertCircle size={10} />
        <span>failed</span>
      </span>
    );
  }
  if (status === 'sending' || status === 'queued') {
    return (
      <span className="flex items-center gap-0.5 text-[9px] text-white/70 font-medium" title="Pending">
        <Clock size={10} className="animate-pulse" />
        <span>pending</span>
      </span>
    );
  }
  if (status === 'seen') {
    return (
      <span className="flex items-center gap-0.5 text-[9px] text-teal-200 font-bold" title="Seen">
        <Eye size={10} className="stroke-[2.5]" />
        <span>seen</span>
      </span>
    );
  }
  // status === 'sent' / 'delivered' / other
  return (
    <span className="flex items-center gap-0.5 text-[9px] text-white/90 font-medium" title="Sent">
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
      <div className={`flex max-w-[82%] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-card ${isMissed ? 'border-danger/18 bg-danger/10 text-danger' : 'border-border-default bg-surface text-text-secondary'}`}>
        <Icon size={13} />
        <span>{direction} {call.type} call</span>
        <span className="text-text-faint">-</span>
        <span>{statusText}</span>
      </div>
    </motion.div>
  );
}

function TypingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className="flex justify-start"
    >
      <div className="flex items-center gap-1.5 rounded-[20px] rounded-bl-none border border-border-default bg-surface px-4 py-2.5 shadow-card">
        {[0, 1, 2].map((dot) => (
          <motion.span
            key={dot}
            className="h-2 w-2 rounded-full bg-accent"
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
    <div className="grid h-full place-items-center text-center py-20">
      <div>
        <span className="tone-ring mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-light text-accent"><MessageCircle size={24} /></span>
        <p className="mt-4 font-semibold text-text-primary">Start the conversation</p>
        <p className="mt-1 text-sm text-text-muted">{name ? `Say hello to ${name}.` : 'Choose a friend from your list.'}</p>
      </div>
    </div>
  );
}

function DateDivider({ value }) {
  return (
    <div className="my-4 flex justify-center">
      <span className="rounded-full border border-border-default bg-bg px-3 py-1 text-[11px] font-semibold text-text-muted">{formatDate(value)}</span>
    </div>
  );
}

function MediaPreview({ media }) {
  if (!media.url) return <span className="mb-2 block rounded-2xl bg-bg/40 px-3 py-2 text-xs">Preparing attachment...</span>;
  if (media.type === 'image') return <img src={media.url} alt="" className="mb-2 max-h-64 rounded-2xl object-cover" />;
  if (media.type === 'audio') {
    return <VoiceNotePlayer media={media} />;
  }
  if (media.type === 'video') return <video src={media.url} controls className="mb-2 max-h-64 rounded-2xl" />;
  return <a href={media.url} className="mb-2 block rounded-2xl bg-bg/40 px-3 py-2 text-xs underline">{media.name || 'Open attachment'}</a>;
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
      className={`mb-2 block rounded-2xl border p-3 no-underline ${mine ? 'border-white/20 bg-white/10 text-white' : 'border-border-default bg-bg text-text-primary'}`}
    >
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-2xl ${live && !ended ? 'bg-white text-accent' : 'bg-accent-tint text-accent'}`}>
          <MapPin size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{live ? (ended ? 'Live location ended' : 'Live location') : 'Current location'}</span>
          <span className={`block truncate text-xs ${mine ? 'text-white/75' : 'text-text-muted'}`}>
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
    <div className="mb-2 rounded-2xl bg-bg/40 p-3">
      <div className="mb-2 flex h-10 items-end gap-1 px-1">
        {waveformData.map((amplitude, index) => {
          const height = Math.max(4, Math.round((amplitude / 100) * 36));
          return (
            <span key={index} className="w-1 rounded-full bg-accent/70 transition-all duration-200" style={{ height: `${height}px` }} />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] text-text-muted mb-1 px-1 font-semibold">
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

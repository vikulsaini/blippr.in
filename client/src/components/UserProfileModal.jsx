import { useEffect, useState } from 'react';
import { Ban, Flag, Music, Save, UserMinus, Volume2, X, Search, MessageCircle, Bell, MoreHorizontal, Image, Link, FileText, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { presenceText } from '../lib/presence.js';
import { previewSound } from '../lib/sounds.js';
import { getRingtoneForFriend, mediaToSound, packSound, setFriendRingtone, soundPack } from '../lib/soundPrefs.js';

export default function UserProfileModal({ user, chat, currentUserId, onClose, onNickname, onUnfriend, onBlock, onReport }) {
  const [nickname, setNickname] = useState('');
  const [reportReason, setReportReason] = useState('Inappropriate behavior');
  const [busyAction, setBusyAction] = useState('');
  const [notice, setNotice] = useState('');
  const [friendTone, setFriendTone] = useState(null);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    if (!user) return;
    setActiveTab(user.isChannel ? 'members' : 'details');
    if (user.isChannel) {
      setNickname('');
      return;
    }
    if (!chat || !currentUserId) {
      setNickname('');
      return;
    }
    setNickname(chat.nicknames?.[`${currentUserId}:${user._id}`] || '');
    setFriendTone(getRingtoneForFriend(user._id));
    setNotice('');
  }, [chat, currentUserId, user]);

  async function runAction(action, handler) {
    try {
      setBusyAction(action);
      setNotice('');
      await handler();
      setNotice(action === 'nickname' ? 'Nickname updated' : 'Done');
    } catch (err) {
      setNotice(err.message || 'Something went wrong');
    } finally {
      setBusyAction('');
    }
  }

  async function uploadFriendTone(file) {
    try {
      const sound = await mediaToSound(file);
      setFriendRingtone(user._id, sound);
      setFriendTone(sound);
      setNotice('Friend ringtone saved');
    } catch (err) {
      setNotice(err.message);
    }
  }

  return (
    <AnimatePresence>
      {user && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-40 grid place-items-end bg-black/55 px-4 pb-4 sm:place-items-center"
        >
          <motion.section
            initial={{ y: 50, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 50, scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(event) => event.stopPropagation()}
            className="surface-card max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[24px] p-5 shadow-elevated bg-surface border border-border-default flex flex-col"
          >
        {/* Cancel/Save Top Bar */}
        <div className="flex items-center justify-between mb-4 border-b border-border-default pb-3 shrink-0">
          <button 
            type="button"
            onClick={onClose} 
            className="px-4 py-1.5 rounded-full text-xs font-semibold bg-bg text-text-secondary hover:bg-surface-hover transition active:scale-95 cursor-pointer"
          >
            Cancel
          </button>
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
            {user.isChannel ? 'Channel Details' : 'User Profile'}
          </span>
          <button 
            type="button"
            onClick={async () => {
              if (!user.isChannel && chat) {
                await runAction('nickname', () => onNickname?.(chat._id, user._id, nickname));
              }
              onClose();
            }}
            disabled={busyAction === 'nickname'}
            className="px-4 py-1.5 rounded-full text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            Save
          </button>
        </div>

        {/* Centered Avatar / Details */}
        <div className="flex flex-col items-center text-center mt-2 px-2 pb-4">
          {user.isChannel ? (
            <div className="grid h-20 w-20 place-items-center rounded-2xl bg-accent-light text-accent text-2xl border border-border-default shadow-sm shrink-0">
              <Hash size={36} />
            </div>
          ) : user.avatar ? (
            <img src={user.avatar} alt="" className="h-20 w-20 rounded-full object-cover border-2 border-border-default shadow-card shrink-0" />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/10 font-bold text-accent text-2xl border border-border-default shadow-card shrink-0">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <h2 className="mt-3 text-xl font-bold text-text-primary leading-snug">{nickname || user.name}</h2>
          <p className="text-xs text-text-muted">@{user.username || user._id}</p>
          <p className="mt-2 text-xs text-text-secondary leading-relaxed max-w-xs">{user.bio || 'No bio or description provided.'}</p>
        </div>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-4 gap-4 px-2 py-3 border-t border-b border-border-default mb-4 text-center">
          <div className="flex flex-col items-center gap-1">
            <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-accent text-white transition active:scale-90 cursor-pointer" aria-label="Search">
              <Search size={18} />
            </button>
            <span className="text-[10px] font-semibold text-text-muted">Search</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-success text-white transition active:scale-90 cursor-pointer" aria-label="Threads">
              <MessageCircle size={18} />
            </button>
            <span className="text-[10px] font-semibold text-text-muted">Threads</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-amber-500 text-white transition active:scale-90 cursor-pointer" aria-label="Notify">
              <Bell size={18} />
            </button>
            <span className="text-[10px] font-semibold text-text-muted">Notify</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button type="button" className="grid h-10 w-10 place-items-center rounded-full bg-bg text-text-secondary hover:bg-surface-hover transition active:scale-90 border border-border-default cursor-pointer" aria-label="More">
              <MoreHorizontal size={18} />
            </button>
            <span className="text-[10px] font-semibold text-text-muted">More</span>
          </div>
        </div>

        {/* Segmented Tab Row */}
        <div className="mb-4 grid grid-cols-4 gap-1 rounded-2xl border border-border-default bg-bg p-1">
          {user.isChannel ? (
            <TabButton active={activeTab === 'members'} onClick={() => setActiveTab('members')} label="Members" />
          ) : (
            <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')} label="Details" />
          )}
          <TabButton active={activeTab === 'media'} onClick={() => setActiveTab('media')} label="Media" />
          <TabButton active={activeTab === 'links'} onClick={() => setActiveTab('links')} label="Links" />
          <TabButton active={activeTab === 'files'} onClick={() => setActiveTab('files')} label="Files" />
        </div>

        {/* Tab Body Contents */}
        {activeTab === 'members' && user.isChannel && (
          <div className="space-y-3.5 mt-2">
            {(user.members || []).map((member) => (
              <div key={member._id} className="flex items-center gap-3 px-1">
                <div className="relative shrink-0">
                  {member.avatar ? (
                    <img src={member.avatar} alt="" className="h-9 w-9 rounded-full object-cover border border-border-default shadow-sm" />
                  ) : (
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-accent/10 font-bold text-accent text-xs">
                      {member.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface ${member.isOnline ? 'bg-success' : 'bg-text-faint'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-text-primary">{member.name}</p>
                    <span className="text-[9px] font-medium text-text-faint">@{member.username}</span>
                  </div>
                  <p className="truncate text-[10px] text-text-muted mt-0.5">{member.bio || 'Hey there! I am using Varta.'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'details' && !user.isChannel && (
          <div className="space-y-4 mt-2 animate-fadeIn">
            {/* Set Nickname */}
            <div>
              <p className="text-xs uppercase tracking-wide text-text-faint font-semibold">Set Nickname</p>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-border-default bg-bg px-3 py-2 text-sm outline-none text-text-primary font-medium focus:border-accent transition"
                maxLength={40}
                placeholder={`Nickname for ${user.name}`}
              />
            </div>

            {/* Sound Ringtones selection */}
            <div className="rounded-2xl border border-border-default bg-bg p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Music size={16} className="text-accent" />
                <p className="text-sm font-semibold text-text-primary">Friend ringtone</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {soundPack.map((sound) => (
                  <button
                    key={sound.id}
                    onClick={() => {
                      const next = packSound(sound.id);
                      setFriendRingtone(user._id, next);
                      setFriendTone(next);
                    }}
                    className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${friendTone?.type === 'pack' && friendTone.id === sound.id ? 'btn-primary' : 'bg-surface text-text-secondary border border-border-default hover:bg-surface-hover'}`}
                  >
                    {sound.name}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl btn-secondary px-3 py-2 text-xs font-semibold">
                  <Music size={15} />
                  Upload audio
                  <input type="file" accept="audio/*" className="hidden" onChange={(event) => uploadFriendTone(event.target.files?.[0])} />
                </label>
                <button onClick={() => previewSound(friendTone, 'call')} className="btn-icon h-10 w-10 shrink-0" aria-label="Preview friend ringtone">
                  <Volume2 size={16} />
                </button>
              </div>
              <p className="mt-2 truncate text-[11px] font-semibold text-text-muted">{friendTone?.name || 'Default ringtone'}</p>
            </div>

            {/* Info details */}
            <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
              <Info label="Gender" value={user.gender || 'Not set'} />
              <Info label="Age" value={user.age || '18+'} />
              <Info label="Phone" value={user.phone || 'Not shared'} />
              <Info label="Email" value={user.email || 'Not shared'} />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                label="Unfriend"
                icon={UserMinus}
                disabled={busyAction === 'unfriend'}
                onClick={() => runAction('unfriend', () => onUnfriend?.(chat?._id))}
              />
              <ActionButton
                label="Block"
                icon={Ban}
                disabled={busyAction === 'block'}
                onClick={() => runAction('block', () => onBlock?.(user._id, chat?._id))}
                danger
              />
            </div>

            {/* Report user form */}
            <div className="rounded-2xl border border-border-default bg-surface p-3 shadow-sm">
              <label className="text-xs text-text-muted font-semibold" htmlFor="report-reason">Report reason</label>
              <input
                id="report-reason"
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-border-default bg-bg px-3 py-2 text-sm outline-none text-text-primary"
                maxLength={120}
              />
              <button
                onClick={() => runAction('report', () => onReport?.(user._id, reportReason))}
                disabled={busyAction === 'report' || reportReason.trim().length < 3}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-danger hover:bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 transition cursor-pointer"
              >
                <Flag size={16} />
                Report user
              </button>
            </div>

            {notice && <p className="text-center text-xs text-text-muted font-medium">{notice}</p>}
          </div>
        )}

        {/* Media / Links / Files Empty States */}
        {(activeTab === 'media' || activeTab === 'links' || activeTab === 'files') && (
          <div className="py-8 text-center animate-fadeIn">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-bg border border-border-default text-text-faint mx-auto animate-bounce">
              {activeTab === 'media' && <Image size={20} />}
              {activeTab === 'links' && <Link size={20} />}
              {activeTab === 'files' && <FileText size={20} />}
            </div>
            <p className="mt-3 text-sm font-semibold text-text-primary capitalize">{activeTab} Empty</p>
            <p className="mt-1 text-xs text-text-muted leading-relaxed max-w-xs mx-auto">No {activeTab} shared in this chat workspace yet.</p>
          </div>
        )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TabButton({ active, label, onClick }) {
  return (
    <button 
      type="button"
      onClick={onClick} 
      className={`relative cursor-pointer rounded-xl py-2 text-[11px] font-bold transition active:scale-[0.96] z-10 ${active ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
    >
      <span className="z-10 relative">{label}</span>
      {active && (
        <motion.span 
          layoutId="active-profile-tab"
          className="absolute inset-0 bg-surface rounded-xl shadow-sm border border-border-default/50 -z-10"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
    </button>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-border-default bg-bg p-3">
      <p className="text-xs text-text-faint font-semibold">{label}</p>
      <p className="mt-1 truncate text-text-secondary font-medium">{value}</p>
    </div>
  );
}

function ActionButton({ label, icon: Icon, onClick, disabled, danger = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-bold disabled:opacity-50 transition cursor-pointer ${danger ? 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/18' : 'btn-secondary'}`}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

import { useEffect, useState } from 'react';
import { Ban, Flag, Save, UserMinus, X } from 'lucide-react';
import { presenceText } from '../lib/presence.js';

export default function UserProfileModal({ user, chat, currentUserId, onClose, onNickname, onUnfriend, onBlock, onReport }) {
  const [nickname, setNickname] = useState('');
  const [reportReason, setReportReason] = useState('Inappropriate behavior');
  const [busyAction, setBusyAction] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!user || !chat || !currentUserId) {
      setNickname('');
      return;
    }
    setNickname(chat.nicknames?.[`${currentUserId}:${user._id}`] || '');
    setNotice('');
  }, [chat, currentUserId, user]);

  if (!user) return null;

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

  return (
    <div onClick={onClose} className="fixed inset-0 z-40 grid place-items-end bg-black/55 px-4 pb-4 sm:place-items-center">
      <section onClick={(event) => event.stopPropagation()} className="glass max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl p-5 shadow-glow">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <img src={user.avatar} alt="" className="h-20 w-20 rounded-3xl bg-white/10 object-cover" />
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-semibold">{nickname || user.name}</h2>
              <p className="text-sm text-white/55">@{user.username}</p>
              <p className={`mt-1 text-sm ${user.isOnline ? 'text-mint' : 'text-white/45'}`}>{presenceText(user)}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-white/10 p-2" aria-label="Close profile">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Info label="Gender" value={user.gender || 'Not set'} />
          <Info label="Age" value={user.age || '18+'} />
          <Info label="Phone" value={user.phone || 'Not shared'} />
          <Info label="Email" value={user.email || 'Not shared'} />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/8 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">Bio</p>
          <p className="mt-2 text-sm text-white/72">{user.bio || 'No bio added yet.'}</p>
        </div>

        {chat && (
          <div className="mt-4 space-y-3 rounded-3xl border border-white/10 bg-white/8 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/40">Chat update</p>
              <div className="mt-2 flex gap-2">
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-ink/40 px-3 py-2 text-sm outline-none"
                  maxLength={40}
                  placeholder={`Nickname for ${user.name}`}
                />
                <button
                  onClick={() => runAction('nickname', () => onNickname?.(chat._id, user._id, nickname))}
                  disabled={busyAction === 'nickname'}
                  className="grid h-10 w-10 place-items-center rounded-2xl bg-mint text-ink disabled:opacity-50"
                  aria-label="Save nickname"
                >
                  <Save size={17} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                label="Unfriend"
                icon={UserMinus}
                disabled={busyAction === 'unfriend'}
                onClick={() => runAction('unfriend', () => onUnfriend?.(chat._id))}
              />
              <ActionButton
                label="Block"
                icon={Ban}
                disabled={busyAction === 'block'}
                onClick={() => runAction('block', () => onBlock?.(user._id, chat._id))}
                danger
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-ink/30 p-3">
              <label className="text-xs text-white/45" htmlFor="report-reason">Report reason</label>
              <input
                id="report-reason"
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-sm outline-none"
                maxLength={120}
              />
              <button
                onClick={() => runAction('report', () => onReport?.(user._id, reportReason))}
                disabled={busyAction === 'report' || reportReason.trim().length < 3}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-coral px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
              >
                <Flag size={16} />
                Report user
              </button>
            </div>

            {notice && <p className="text-center text-xs text-white/55">{notice}</p>}
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-3">
      <p className="text-xs text-white/40">{label}</p>
      <p className="mt-1 truncate text-white/78">{value}</p>
    </div>
  );
}

function ActionButton({ label, icon: Icon, onClick, disabled, danger = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold disabled:opacity-50 ${danger ? 'bg-coral/90 text-ink' : 'bg-white/10 text-white/78'}`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

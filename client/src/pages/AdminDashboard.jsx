import { Shield, ShieldAlert, CheckCircle2, MessageSquare, Users, Activity, Loader2, Send } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { claimAdmin, getAdminStats, searchAdminUsers, sendAdminBroadcast, updateAdminUserStatus } from '../lib/api.js';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [error, setError] = useState(null);
  const [claimSecret, setClaimSecret] = useState('');

  useEffect(() => {
    fetchStats();
    fetchUsers();
  }, []);

  async function fetchStats() {
    try {
      const data = await getAdminStats();
      if (data.ok) setStats(data.stats);
      setError(null);
    } catch (err) {
      if (err.status === 403 || err.status === 401) {
        setError('unauthorized');
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers(q = '') {
    try {
      const data = await searchAdminUsers(q);
      if (data.ok) setUsers(data.users);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!error) fetchUsers(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, error]);

  async function handleClaim(e) {
    e.preventDefault();
    try {
      await claimAdmin(claimSecret);
      window.location.reload();
    } catch (err) {
      alert(err.message || 'Failed to claim admin');
    }
  }

  async function toggleBan(user) {
    const isBanned = !!user.bannedUntil;
    if (!window.confirm(isBanned ? `Unban ${user.name}?` : `Ban ${user.name} for 100 years?`)) return;
    try {
      await updateAdminUserStatus(user._id, 'ban', !isBanned);
      fetchUsers(search);
    } catch (err) {
      alert(err.message);
    }
  }

  async function toggleVerify(user) {
    const isVerified = user.isVerified;
    if (!window.confirm(isVerified ? `Remove verification from ${user.name}?` : `Verify ${user.name}?`)) return;
    try {
      await updateAdminUserStatus(user._id, 'verify', !isVerified);
      fetchUsers(search);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleBroadcast(e) {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    if (!window.confirm('Send broadcast to ALL users online right now?')) return;
    try {
      await sendAdminBroadcast(broadcastMessage);
      setBroadcastMessage('');
      alert('Broadcast sent!');
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) {
    return (
      <div className="grid h-full place-items-center text-text-muted">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error === 'unauthorized') {
    return (
      <div className="mx-auto max-w-md p-6 mt-12">
        <div className="surface-card rounded-[24px] p-6 bg-surface border border-border-default shadow-card text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-error mb-4" />
          <h2 className="text-xl font-bold text-text-primary mb-2">Access Denied</h2>
          <p className="text-text-muted mb-6 text-sm">You do not have administrative privileges.</p>
          <form onSubmit={handleClaim} className="space-y-4">
            <input
              type="password"
              placeholder="Admin Claim Secret"
              value={claimSecret}
              onChange={(e) => setClaimSecret(e.target.value)}
              className="w-full bg-bg border border-border-default rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent"
            />
            <button type="submit" className="w-full py-3 bg-accent text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
              Claim Admin
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6 pb-24">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-accent" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Admin Dashboard</h1>
          <p className="text-sm text-text-muted">Manage Blippr users and monitor activity</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={<Users />} label="Total Users" value={stats.totalUsers} />
          <StatCard icon={<Activity className="text-success" />} label="Online Now" value={stats.activeUsers} />
          <StatCard icon={<MessageSquare />} label="Total Chats" value={stats.totalChats} />
          <StatCard icon={<MessageSquare />} label="Total Messages" value={stats.totalMessages} />
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="surface-card rounded-[24px] bg-surface border border-border-default shadow-card overflow-hidden flex flex-col h-[500px]">
            <div className="p-4 border-b border-border-default flex justify-between items-center bg-surface">
              <h3 className="font-semibold text-text-primary">User Management</h3>
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-bg border border-border-default rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent w-48"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {users.length === 0 ? (
                <div className="p-8 text-center text-text-muted text-sm">No users found.</div>
              ) : (
                <div className="divide-y divide-border-default">
                  {users.map((u) => (
                    <div key={u._id} className="p-4 flex items-center justify-between hover:bg-bg/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                            <span className="text-accent font-medium text-sm">{u.name?.charAt(0) || '?'}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm text-text-primary truncate">{u.name}</p>
                            {u.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />}
                            {u.role === 'admin' && (
                              <span className="bg-error/10 text-error text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide shrink-0">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted truncate">@{u.username} • {u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleVerify(u)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            u.isVerified ? 'bg-bg text-text-muted hover:bg-error/10 hover:text-error' : 'bg-accent/10 text-accent hover:bg-accent hover:text-white'
                          }`}
                        >
                          {u.isVerified ? 'Unverify' : 'Verify'}
                        </button>
                        <button
                          onClick={() => toggleBan(u)}
                          disabled={u.role === 'admin'}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            u.bannedUntil ? 'bg-error text-white hover:bg-error/90' : 'bg-error/10 text-error hover:bg-error hover:text-white'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {u.bannedUntil ? 'Unban' : 'Ban'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface-card rounded-[24px] p-5 bg-surface border border-border-default shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Send className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-text-primary">System Broadcast</h3>
            </div>
            <p className="text-xs text-text-muted mb-4 leading-relaxed">
              Send a real-time push notification to all users currently connected to the platform.
            </p>
            <form onSubmit={handleBroadcast}>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Type system message..."
                className="w-full bg-bg border border-border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent min-h-[100px] resize-none mb-3"
              />
              <button
                type="submit"
                disabled={!broadcastMessage.trim()}
                className="w-full py-2.5 bg-accent text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Send Broadcast
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="surface-card rounded-[20px] p-4 bg-surface border border-border-default flex flex-col items-center text-center">
      <div className="mb-2 text-text-muted">{icon}</div>
      <div className="text-2xl font-bold text-text-primary">{value?.toLocaleString() || 0}</div>
      <div className="text-xs font-medium text-text-muted uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

import React, { useEffect, useState, useRef } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  CheckCircle2, 
  MessageSquare, 
  Users, 
  Activity, 
  Loader2, 
  Send, 
  Database, 
  Folder, 
  FileText, 
  Globe, 
  Search, 
  Trash2, 
  RefreshCw, 
  AlertCircle, 
  Clock, 
  Eye, 
  Play, 
  Check, 
  Slash,
  LogOut,
  Maximize2,
  ChevronRight,
  TrendingUp,
  Settings,
  Bell,
  Mail,
  MoreHorizontal,
  UserCheck
} from 'lucide-react';
import { 
  claimAdmin, 
  getAdminStats, 
  searchAdminUsers, 
  updateAdminUserStatus, 
  sendAdminBroadcast,
  getAdminMetrics,
  getAdminDbStats,
  runAdminDbQuery,
  getAdminSlowQueries,
  getAdminFiles,
  deleteAdminFile,
  getAdminFileStats,
  revokeAdminUserSessions,
  getAdminAuditLogs
} from '../lib/api.js';
import { getRealtimeSocket } from '../lib/realtime.js';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [claimSecret, setClaimSecret] = useState('');
  const [activeTab, setActiveTab] = useState('analytics');

  // Toasts
  const [toast, setToast] = useState(null);

  // Stats / Analytics Tab
  const [metrics, setMetrics] = useState({ minute: [], hour: [] });
  const [liveRequests, setLiveRequests] = useState([]);
  
  // Database Tab
  const [dbStats, setDbStats] = useState([]);
  const [slowQueries, setSlowQueries] = useState([]);
  const [activeOps, setActiveOps] = useState([]);
  const [queryCollection, setQueryCollection] = useState('');
  const [queryAction, setQueryAction] = useState('find');
  const [queryFilter, setQueryFilter] = useState('{\n  \n}');
  const [queryUpdate, setQueryUpdate] = useState('{\n  "$set": {\n    \n  }\n}');
  const [queryProjection, setQueryProjection] = useState('{\n  \n}');
  const [queryLimit, setQueryLimit] = useState(10);
  const [querySkip, setQuerySkip] = useState(0);
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [queryLoading, setQueryLoading] = useState(false);

  // File Manager Tab
  const [files, setFiles] = useState([]);
  const [fileStats, setFileStats] = useState(null);
  const [fileTypeFilter, setFileTypeFilter] = useState('all');

  // Audit Log Tab
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditSearch, setAuditSearch] = useState('');

  // Live registration feed
  const [liveRegs, setLiveRegs] = useState([]);

  // Broadcast
  const [broadcastMessage, setBroadcastMessage] = useState('');

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    initializeDashboard();
  }, []);

  async function initializeDashboard() {
    try {
      const statsData = await getAdminStats();
      if (statsData.ok) {
        setStats(statsData.stats);
        setError(null);
        
        fetchUsers();
        loadAnalytics();
        loadDbStats();
        loadFiles();
        loadAuditLogs();
      }
    } catch (err) {
      if (err.status === 403 || err.status === 401) {
        setError('unauthorized');
      } else {
        setError(err.message || 'Failed to connect');
      }
    } finally {
      setLoading(false);
    }
  }

  // Socket setup for live analytics
  useEffect(() => {
    if (error === 'unauthorized') return;
    
    let socket;
    try {
      socket = getRealtimeSocket();
      socket.emit('admin:join', {});
      
      socket.on('admin:traffic', (data) => {
        setLiveRequests(prev => {
          const next = [data, ...prev];
          return next.slice(0, 100);
        });
      });

      socket.on('admin:user-registered', (data) => {
        setLiveRegs(prev => [data, ...prev]);
        setStats(prev => prev ? { ...prev, totalUsers: prev.totalUsers + 1 } : null);
        showToast(`New user registered: @${data.username}`, 'info');
      });
      
      socket.on('presence:update', ({ userId, isOnline }) => {
        setUsers(prev => prev.map(u => u._id === userId ? { ...u, isOnline } : u));
      });
      
    } catch (err) {
      console.warn('Realtime connection issue:', err);
    }

    return () => {
      if (socket) {
        socket.off('admin:traffic');
        socket.off('admin:user-registered');
        socket.off('presence:update');
      }
    };
  }, [error]);

  async function loadAnalytics() {
    try {
      const res = await getAdminMetrics();
      if (res.ok) setMetrics(res.metrics);
    } catch (err) {
      console.error('Failed to load metrics', err);
    }
  }

  async function loadDbStats() {
    try {
      const res = await getAdminDbStats();
      if (res.ok) {
        setDbStats(res.collections);
        if (res.collections.length > 0 && !queryCollection) {
          setQueryCollection(res.collections[0].name);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadSlowQueries() {
    try {
      const res = await getAdminSlowQueries();
      if (res.ok) {
        setSlowQueries(res.slowQueries);
        setActiveOps(res.activeOperations);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadFiles() {
    try {
      const listRes = await getAdminFiles(fileTypeFilter);
      const statsRes = await getAdminFileStats();
      if (listRes.ok) setFiles(listRes.files);
      if (statsRes.ok) setFileStats(statsRes.stats);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAuditLogs() {
    try {
      const res = await getAdminAuditLogs();
      if (res.ok) setAuditLogs(res.logs);
    } catch (err) {
      console.error(err);
    }
  }

  function handleRefresh() {
    if (activeTab === 'analytics') {
      loadAnalytics();
      initializeDashboard();
    } else if (activeTab === 'database') {
      loadDbStats();
      loadSlowQueries();
    } else if (activeTab === 'files') {
      loadFiles();
    } else if (activeTab === 'audit') {
      loadAuditLogs();
    } else if (activeTab === 'users') {
      fetchUsers(search);
    }
    showToast('Stats synced');
  }

  useEffect(() => {
    if (activeTab === 'files') loadFiles();
  }, [fileTypeFilter]);

  useEffect(() => {
    if (activeTab === 'database') loadSlowQueries();
  }, [activeTab]);

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
      if (!error && activeTab === 'users') fetchUsers(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, error, activeTab]);

  // Auth Claim
  async function handleClaim(e) {
    e.preventDefault();
    try {
      await claimAdmin(claimSecret);
      window.location.reload();
    } catch (err) {
      alert(err.message || 'Failed to claim admin');
    }
  }

  // User Actions
  async function toggleBan(user) {
    const isBanned = !!user.bannedUntil;
    if (!window.confirm(isBanned ? `Unban ${user.name}?` : `Ban ${user.name} for 100 years?`)) return;
    try {
      await updateAdminUserStatus(user._id, 'ban', !isBanned);
      showToast(isBanned ? `Unbanned ${user.name}` : `Banned ${user.name}`);
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
      showToast(isVerified ? `Verification removed` : `${user.name} verified`);
      fetchUsers(search);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleRevokeSessions(user) {
    if (!window.confirm(`Force-expire all sessions and disconnect user ${user.name}?`)) return;
    try {
      const res = await revokeAdminUserSessions(user._id);
      if (res.ok) {
        showToast(`Revoked sessions for ${user.name}`);
        fetchUsers(search);
      }
    } catch (err) {
      alert(err.message);
    }
  }

  // Database Execution
  async function handleExecuteQuery(e) {
    e.preventDefault();
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      const res = await runAdminDbQuery({
        collection: queryCollection,
        action: queryAction,
        filter: queryFilter,
        update: queryUpdate,
        projection: queryProjection,
        limit: queryLimit,
        skip: querySkip
      });
      if (res.ok) {
        setQueryResult(res.result);
        showToast('Query executed successfully');
        loadDbStats();
      }
    } catch (err) {
      setQueryError(err.message || 'Query failed');
    } finally {
      setQueryLoading(false);
    }
  }

  // File Delete
  async function handleDeleteFile(file) {
    if (!window.confirm(`Permanently delete file "${file.name}"?`)) return;
    try {
      const res = await deleteAdminFile(file.id, file.provider);
      if (res.ok) {
        showToast('File deleted');
        loadFiles();
      }
    } catch (err) {
      alert(err.message);
    }
  }

  // Broadcast Action
  async function handleBroadcast(e) {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    if (!window.confirm('Send broadcast message to ALL online users right now?')) return;
    try {
      await sendAdminBroadcast(broadcastMessage);
      setBroadcastMessage('');
      showToast('System broadcast delivered');
    } catch (err) {
      alert(err.message);
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMethodColor = (method) => {
    switch (method) {
      case 'GET': return 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20';
      case 'POST': return 'text-[#8b5cf6] bg-[#8b5cf6]/10 border-[#8b5cf6]/20';
      case 'PATCH': return 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20';
      case 'DELETE': return 'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20';
      default: return 'text-text-muted bg-border-default/10';
    }
  };

  const getStatusColor = (status) => {
    if (status >= 500) return 'text-[#ef4444]';
    if (status >= 400) return 'text-[#f59e0b]';
    if (status >= 300) return 'text-[#3b82f6]';
    return 'text-[#10b981]';
  };

  // Render Nilova-Style Columns Bar Chart
  const renderColumnsChart = (data, valKey) => {
    if (!data || data.length === 0) {
      return <div className="h-full flex items-center justify-center text-xs text-text-muted">No metrics available</div>;
    }
    const maxVal = Math.max(...data.map(d => d[valKey] || 0), 10);
    const barsCount = Math.min(12, data.length);
    const chartData = data.slice(-barsCount);
    
    return (
      <div className="flex h-full items-end justify-between px-2 pt-6">
        {chartData.map((d, i) => {
          const val = d[valKey] || 0;
          const percentage = (val / maxVal) * 100;
          return (
            <div key={i} className="flex flex-col items-center flex-1 group relative">
              <div 
                className="w-2 sm:w-3.5 bg-gradient-to-t from-accent to-accent-hover rounded-t-full transition-all duration-500 relative"
                style={{ height: `${Math.max(8, percentage * 0.8)}px` }}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[#0f172a] text-white text-[9px] px-2 py-1 rounded shadow font-sans z-10 whitespace-nowrap">
                  {val.toLocaleString()}
                </div>
              </div>
              <span className="text-[8px] text-text-muted font-sans mt-2">
                {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Nilova Audience Reached Donut Chart
  const renderPresenceDonut = () => {
    const total = stats ? stats.totalUsers : 1;
    const online = stats ? stats.activeUsers : 0;
    const offline = Math.max(0, total - online);
    const onlinePercent = Math.min(100, Math.round((online / total) * 100));
    
    // Circular calculations
    const radius = 15.9155;
    const circumference = 2 * Math.PI * radius; // 100
    const strokeDashoffset = 100 - onlinePercent;

    return (
      <div className="flex flex-col items-center justify-center h-full py-4">
        <div className="relative w-36 h-36 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--border)" strokeWidth="3" />
            <circle 
              cx="18" 
              cy="18" 
              r={radius} 
              fill="none" 
              stroke="var(--accent)" 
              strokeWidth="3.5" 
              strokeDasharray="100" 
              strokeDashoffset={strokeDashoffset} 
              strokeLinecap="round" 
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Presence</span>
            <div className="text-2xl font-black text-text-primary">{onlinePercent}%</div>
            <span className="text-[9px] text-[#10b981] font-bold">{online} Active</span>
          </div>
        </div>

        <div className="w-full grid grid-cols-2 gap-4 mt-6 text-xs border-t border-border pt-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
              <span className="text-text-muted font-bold">Online Users</span>
            </div>
            <div className="font-extrabold text-text-primary">{online}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-border inline-block" />
              <span className="text-text-muted font-bold">Offline Users</span>
            </div>
            <div className="font-extrabold text-text-primary">{offline}</div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="grid h-screen place-items-center text-text-muted bg-bg">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-accent mx-auto mb-4" />
          <p className="text-sm font-semibold tracking-wide">Syncing Control Console...</p>
        </div>
      </div>
    );
  }

  if (error === 'unauthorized') {
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-4 py-12">
        <div className="w-full max-w-md">
          <div className="surface-card rounded-[28px] p-8 bg-surface border border-border shadow-elevated text-center relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 animated-gradient" />
            <ShieldAlert className="mx-auto h-14 w-14 text-danger mb-4 shrink-0" />
            <h2 className="text-2xl font-bold text-text-primary mb-2">Access Restrained</h2>
            <p className="text-text-muted mb-8 text-sm leading-relaxed">
              Your profile requires administrative credentials to view the control panel.
            </p>
            <form onSubmit={handleClaim} className="space-y-4">
              <input
                type="password"
                placeholder="Access Claim Token"
                value={claimSecret}
                onChange={(e) => setClaimSecret(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-4 py-3.5 text-sm font-mono focus:outline-none focus:border-accent text-center"
              />
              <button type="submit" className="w-full py-3.5 btn-primary rounded-xl font-bold text-sm tracking-wide shadow-glow">
                Claim Admin Key
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#030712] flex flex-col md:flex-row font-sans antialiased text-text-primary">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-elevated border flex items-center gap-3 animate-fadeSlideUp ${
          toast.type === 'error' ? 'bg-danger-bg text-danger border-danger-border' : 
          toast.type === 'info' ? 'bg-accent-tint text-accent border-accent-ring' : 'bg-surface text-text-primary border-border'
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Left Sidebar Menu - Twin layout of Nilova */}
      <aside className="w-full md:w-64 bg-surface border-b md:border-b-0 md:border-r border-border flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="p-6 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-glow">
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-extrabold text-lg text-text-primary tracking-tight font-sans">NILOVA</span>
          </div>
          <span className="bg-accent/15 text-accent text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase">VARTA</span>
        </div>

        {/* Sidebar Navigation items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Main items */}
          <div>
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider px-3 block mb-2">Main</span>
            <nav className="space-y-1">
              <SidebarItem icon={<Activity />} label="Dashboards" id="analytics" active={activeTab} onClick={setActiveTab} />
              <SidebarItem icon={<Users />} label="Users & Sessions" id="users" active={activeTab} onClick={setActiveTab} />
              <SidebarItem icon={<Database />} label="Database Visualizer" id="database" active={activeTab} onClick={setActiveTab} />
            </nav>
          </div>

          {/* Web Apps items */}
          <div>
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider px-3 block mb-2">Web Apps</span>
            <nav className="space-y-1">
              <SidebarItem icon={<Folder />} label="File Storage" id="files" active={activeTab} onClick={setActiveTab} />
              <SidebarItem icon={<FileText />} label="System Audit Logs" id="audit" active={activeTab} onClick={setActiveTab} />
              <SidebarItem icon={<Send />} label="System Broadcast" id="broadcast" active={activeTab} onClick={setActiveTab} />
            </nav>
          </div>
        </div>

        {/* User profile bottom widget */}
        <div className="p-4 border-t border-border bg-bg/15 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0 border border-accent/20">
            <UserCheck className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-xs font-bold text-text-primary leading-tight truncate">Tom Philip</p>
            <p className="text-[10px] text-text-muted truncate">tomphilip@gmail.com</p>
          </div>
          <a href="/app" className="p-1.5 text-text-muted hover:text-accent rounded-lg border border-transparent hover:bg-bg transition-all" title="Return to Blippr">
            <LogOut className="w-4 h-4" />
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-surface border-b border-border px-6 flex items-center justify-between shrink-0">
          {/* Left search */}
          <div className="relative w-64 flex items-center hidden sm:flex">
            <Search className="absolute left-3 w-4.5 h-4.5 text-text-faint" />
            <input 
              type="text" 
              placeholder="What are you Looking For ?" 
              className="w-full bg-[#f8f9fa] dark:bg-[#090d16] border border-border rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-accent"
            />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4 ml-auto">
            <button onClick={handleRefresh} className="p-2 hover:bg-bg rounded-lg transition-all text-text-secondary hover:text-accent hover:rotate-180 duration-500">
              <RefreshCw className="w-4.5 h-4.5" />
            </button>
            <button className="p-2 hover:bg-bg rounded-lg transition-all text-text-secondary relative">
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent live-dot" />
            </button>
            <button className="p-2 hover:bg-bg rounded-lg transition-all text-text-secondary">
              <Settings className="w-4.5 h-4.5" />
            </button>
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#f59e0b]/20 flex items-center justify-center font-bold text-xs text-[#f59e0b] border border-[#f59e0b]/20">
                TP
              </div>
              <span className="text-xs font-bold text-text-primary hidden md:inline">Tom Philip</span>
            </div>
          </div>
        </header>

        {/* Inner Content Body */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Header Dashboard stats exactly like Nilova top bar */}
          {stats && (
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <NilovaMiniCard label="Registered Users" value={stats.totalUsers} icon={<Users />} percent="2.97%" growth="up" />
              <NilovaMiniCard label="Online Now" value={stats.activeUsers} icon={<Activity />} percent="14.90%" growth="up" isAccent />
              <NilovaMiniCard label="Total Chats" value={stats.totalChats} icon={<MessageSquare />} percent="9.75%" growth="up" />
              <NilovaMiniCard label="Total Messages" value={stats.totalMessages} icon={<Globe />} percent="12.65%" growth="up" />
              <NilovaMiniCard label="Cloud Storage" value={fileStats ? formatBytes(fileStats.totalSize) : '24 GB'} icon={<Folder />} percent="24.78%" growth="up" />
            </section>
          )}

          {/* MAIN MODULE: ANALYTICS MONITOR */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Donut and Bar Charts Side-by-Side */}
              <div className="grid md:grid-cols-3 gap-6">
                {/* Audience Reached Donut Chart */}
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border md:col-span-1 shadow-sm text-left">
                  <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Audience Reached</h3>
                    <MoreHorizontal className="w-4 h-4 text-text-faint" />
                  </div>
                  {renderPresenceDonut()}
                </div>

                {/* Profile Visits Column Bar Chart */}
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border md:col-span-2 shadow-sm flex flex-col justify-between text-left">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Profile Visits & Performance</h3>
                    <div className="flex gap-2">
                      <span className="text-[10px] bg-bg px-2.5 py-1 rounded text-text-secondary border border-border">Hourly Stats</span>
                    </div>
                  </div>
                  <div className="h-56 relative bg-[#f8f9fa] dark:bg-[#0b121f] rounded-xl border border-border p-2 mt-4">
                    {renderColumnsChart(metrics.minute, 'requestCount')}
                  </div>
                </div>
              </div>

              {/* Lower Section: Traffic Sources + Table */}
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Left Traffic Progress Bars */}
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border lg:col-span-1 shadow-sm text-left">
                  <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Traffic Endpoints</h3>
                    <MoreHorizontal className="w-4 h-4 text-text-faint" />
                  </div>
                  
                  <div className="space-y-4">
                    <ProgressItem label="Auth Services (/api/auth/*)" value={78} color="bg-[#10b981]" />
                    <ProgressItem label="Chats Exchange (/api/chats/*)" value={64} color="bg-[#3b82f6]" />
                    <ProgressItem label="User Services (/api/users/*)" value={45} color="bg-[#f59e0b]" />
                    <ProgressItem label="Media Deliveries (/api/media/*)" value={32} color="bg-[#8b5cf6]" />
                    <ProgressItem label="WebRTC Signaling (/api/calls/*)" value={18} color="bg-[#ef4444]" />
                  </div>
                </div>

                {/* Right Registrations / Actions Insight Table */}
                <div className="surface-card bg-surface rounded-[12px] border border-border lg:col-span-2 shadow-sm flex flex-col h-[340px]">
                  <div className="p-5 border-b border-border flex items-center justify-between bg-surface/50">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Recent Registered Accounts</h3>
                    <button onClick={() => setActiveTab('users')} className="text-[10px] text-accent font-bold hover:underline">
                      View All
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-[#f8f9fa] dark:bg-[#0b121f] text-[9px] uppercase tracking-wider text-text-muted font-bold font-mono">
                          <th className="p-3 pl-5">User</th>
                          <th className="p-3">Username</th>
                          <th className="p-3">Role</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 pr-5 text-right">Registered Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-xs">
                        {users.slice(0, 5).map((u, i) => (
                          <tr key={i} className="hover:bg-bg/40 transition-colors">
                            <td className="p-3 pl-5 flex items-center gap-3.5">
                              {u.avatar ? (
                                <img src={u.avatar} alt="" className="w-7.5 h-7.5 rounded-full object-cover border border-border" />
                              ) : (
                                <div className="w-7.5 h-7.5 rounded-full bg-accent/15 flex items-center justify-center font-bold text-xs text-accent">
                                  {u.name?.charAt(0)}
                                </div>
                              )}
                              <span className="font-bold text-text-primary">{u.name}</span>
                            </td>
                            <td className="p-3 font-mono text-text-muted">@{u.username}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                u.role === 'admin' ? 'bg-[#ef4444]/10 text-[#ef4444]' : 'bg-[#3b82f6]/10 text-[#3b82f6]'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${u.isOnline ? 'bg-[#10b981]' : 'bg-text-faint'}`} />
                                <span className="text-[10px] text-text-secondary">{u.isOnline ? 'Online' : 'Offline'}</span>
                              </div>
                            </td>
                            <td className="p-3 pr-5 text-right text-[10px] text-text-faint font-mono">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Live scrolling API activity feed exactly like a Nilova card */}
              <div className="surface-card bg-[#090D16] border-[#1e293b] p-5 rounded-[12px] overflow-hidden flex flex-col h-[320px]">
                <div className="flex items-center justify-between pb-3 border-b border-[#1e293b] mb-4">
                  <div className="flex items-center gap-2">
                    <span className="status-dot online animate-pulse" />
                    <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">api_traffic_transmission_log</h3>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">WebSocket socket.io</span>
                </div>

                <div className="flex-1 overflow-y-auto font-mono text-xs text-slate-300 space-y-1.5 pr-1">
                  {liveRequests.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500 text-center py-12">
                      <div className="space-y-2">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto opacity-50" />
                        <p>Awaiting production API traffic stream...</p>
                      </div>
                    </div>
                  ) : (
                    liveRequests.map((req, i) => (
                      <div key={i} className="flex flex-wrap items-center justify-between py-1 border-b border-slate-900/60 hover:bg-slate-900/40 px-2 rounded">
                        <div className="flex items-center gap-2.5">
                          <span className="text-slate-500 text-[10px]">{new Date(req.timestamp).toLocaleTimeString()}</span>
                          <span className={`px-1.5 py-0.5 border text-[9px] font-extrabold rounded ${getMethodColor(req.method)}`}>
                            {req.method}
                          </span>
                          <span className="text-slate-200 font-semibold">{req.path}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`font-bold ${getStatusColor(req.status)}`}>{req.status}</span>
                          <span className="text-accent text-[11px] font-bold">{req.duration}ms</span>
                          <span className="text-slate-600 text-[10px] hidden sm:inline">{req.ip}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODULE 2: USERS & SESSIONS */}
          {activeTab === 'users' && (
            <div className="grid md:grid-cols-3 gap-6 text-left">
              {/* User management list */}
              <div className="md:col-span-2 space-y-4">
                <div className="surface-card bg-surface rounded-[12px] border border-border shadow-sm overflow-hidden flex flex-col h-[600px]">
                  <div className="p-5 border-b border-border flex items-center gap-4 justify-between bg-surface/50">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Account Registry</h3>
                    <div className="relative w-56 flex items-center">
                      <Search className="absolute left-3 w-4 h-4 text-text-faint" />
                      <input
                        type="text"
                        placeholder="Filter accounts..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-[#f8f9fa] border border-border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-border">
                    {users.length === 0 ? (
                      <div className="p-8 text-center text-text-muted text-xs">No accounts match search query.</div>
                    ) : (
                      users.map((u) => (
                        <div key={u._id} className="p-4 flex items-center justify-between hover:bg-bg/25 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative">
                              {u.avatar ? (
                                <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-border shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent-ring flex items-center justify-center shrink-0">
                                  <span className="text-accent font-bold text-xs">{u.name?.charAt(0) || '?'}</span>
                                </div>
                              )}
                              <span className={`status-dot absolute -bottom-0.5 -right-0.5 ${u.isOnline ? 'online' : 'offline'}`} />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-bold text-xs text-text-primary truncate">{u.name}</p>
                                {u.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />}
                                {u.role === 'admin' && (
                                  <span className="bg-danger-bg text-danger border border-danger-border text-[9px] px-1.5 py-0.5 rounded font-black uppercase shrink-0">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-text-muted truncate">
                                @{u.username} • {u.email || 'No email'}
                              </p>
                              <p className="text-[9px] text-text-faint">
                                Created: {new Date(u.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleVerify(u)}
                              className={`p-2 rounded-xl border text-[10px] font-bold transition-all ${
                                u.isVerified 
                                  ? 'bg-bg text-text-muted border-border hover:bg-danger-bg hover:text-danger hover:border-danger-border' 
                                  : 'bg-accent-tint text-accent border-accent-ring hover:bg-accent hover:text-white'
                              }`}
                              title={u.isVerified ? 'Revoke verification badge' : 'Grant verification badge'}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            
                            <button
                              onClick={() => handleRevokeSessions(u)}
                              className="p-2 bg-surface text-text-secondary border border-border hover:border-warning hover:text-warning rounded-xl transition-all"
                              title="Force Session Revocation"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => toggleBan(u)}
                              disabled={u.role === 'admin'}
                              className={`p-2 border rounded-xl transition-all disabled:opacity-50 ${
                                u.bannedUntil 
                                  ? 'bg-danger text-white border-danger hover:bg-danger/90' 
                                  : 'bg-danger-bg text-danger border-danger-border hover:bg-danger hover:text-white'
                              }`}
                              title={u.bannedUntil ? 'Lift suspension' : 'Suspend account'}
                            >
                              <Slash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Side feeds */}
              <div className="space-y-6 md:col-span-1">
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border shadow-sm h-[600px] flex flex-col">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                    <Activity className="w-4 h-4 text-accent" />
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Registration Log Feed</h3>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {liveRegs.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-center py-12 text-xs text-text-muted">
                        Awaiting registrations...
                      </div>
                    ) : (
                      liveRegs.map((reg, i) => (
                        <div key={i} className="p-3 bg-[#f8f9fa] dark:bg-[#0b121f] border border-border rounded-xl flex gap-3 animate-fadeSlideUp">
                          {reg.avatar ? (
                            <img src={reg.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-border" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                              <span className="text-accent font-bold text-xs">{reg.name?.charAt(0)}</span>
                            </div>
                          )}
                          <div className="min-w-0 text-left">
                            <p className="text-xs font-bold text-text-primary leading-tight truncate">{reg.name}</p>
                            <p className="text-[10px] text-text-muted truncate">@{reg.username}</p>
                            <span className="text-[8px] text-text-faint block mt-1">
                              {new Date(reg.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 3: DATABASE VISUALIZER */}
          {activeTab === 'database' && (
            <div className="space-y-6 text-left">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Collection stats summary */}
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border shadow-sm md:col-span-1 h-[600px] overflow-y-auto">
                  <div className="pb-3 border-b border-border mb-4">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Collections Stats</h3>
                  </div>

                  <div className="space-y-3">
                    {dbStats.map((c, i) => (
                      <div key={i} className="p-3 bg-[#f8f9fa] dark:bg-[#0b121f] border border-border hover:border-accent-ring rounded-xl transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-text-primary font-mono">{c.name}</span>
                          <span className="text-[10px] bg-accent/15 text-accent font-bold px-2 py-0.5 rounded-full">
                            {c.count} docs
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-border-default/50 text-[10px] text-text-muted">
                          <div>
                            <span>Storage:</span>
                            <span className="block font-bold text-text-secondary">{formatBytes(c.storageSize)}</span>
                          </div>
                          <div>
                            <span>Indices:</span>
                            <span className="block font-bold text-text-secondary">{c.nindexes} active</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* JSON query builder */}
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border shadow-sm md:col-span-2 flex flex-col h-[600px]">
                  <div className="pb-3 border-b border-border flex items-center justify-between mb-4">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">JSON Query Dispatcher</h3>
                  </div>

                  <form onSubmit={handleExecuteQuery} className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto pr-1">
                    <div>
                      <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Collection</label>
                      <select 
                        value={queryCollection} 
                        onChange={(e) => setQueryCollection(e.target.value)}
                        className="w-full bg-[#f8f9fa] border border-border rounded-xl px-3 py-2 text-xs focus:border-accent outline-none"
                      >
                        {dbStats.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Operation</label>
                      <select 
                        value={queryAction} 
                        onChange={(e) => setQueryAction(e.target.value)}
                        className="w-full bg-[#f8f9fa] border border-border rounded-xl px-3 py-2 text-xs focus:border-accent outline-none"
                      >
                        <option value="find">find()</option>
                        <option value="updateOne">updateOne()</option>
                        <option value="updateMany">updateMany()</option>
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Query JSON Filter</label>
                      <textarea 
                        value={queryFilter}
                        onChange={(e) => setQueryFilter(e.target.value)}
                        rows="3"
                        className="w-full bg-[#f8f9fa] border border-border rounded-xl p-3 text-xs font-mono focus:border-accent outline-none"
                      />
                    </div>

                    {queryAction !== 'find' && (
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Update Operators (JSON)</label>
                        <textarea 
                          value={queryUpdate}
                          onChange={(e) => setQueryUpdate(e.target.value)}
                          rows="3"
                          className="w-full bg-[#f8f9fa] border border-border rounded-xl p-3 text-xs font-mono focus:border-accent outline-none"
                        />
                      </div>
                    )}

                    {queryAction === 'find' && (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Projection Document</label>
                          <textarea 
                            value={queryProjection}
                            onChange={(e) => setQueryProjection(e.target.value)}
                            rows="2"
                            className="w-full bg-[#f8f9fa] border border-border rounded-xl p-2.5 text-xs font-mono focus:border-accent outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Limit</label>
                            <input 
                              type="number" 
                              value={queryLimit}
                              onChange={(e) => setQueryLimit(Number(e.target.value))}
                              className="w-full bg-[#f8f9fa] border border-border rounded-xl px-3 py-2 text-xs focus:border-accent outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Skip</label>
                            <input 
                              type="number" 
                              value={querySkip}
                              onChange={(e) => setQuerySkip(Number(e.target.value))}
                              className="w-full bg-[#f8f9fa] border border-border rounded-xl px-3 py-2 text-xs focus:border-accent outline-none"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="col-span-2 pt-2">
                      <button 
                        type="submit" 
                        disabled={queryLoading}
                        className="w-full py-3 btn-primary rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-glow"
                      >
                        {queryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Execute Query
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Query output and Profiler */}
              <div className="grid md:grid-cols-2 gap-6">
                {queryResult || queryError ? (
                  <div className="surface-card bg-surface p-5 rounded-[12px] border border-border shadow-sm h-[400px] flex flex-col">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider pb-3 border-b border-border mb-3">QueryResult Output</h3>
                    <div className="flex-1 overflow-auto bg-[#f8f9fa] dark:bg-[#0b121f] p-4 rounded-xl border border-border font-mono text-xs text-text-secondary whitespace-pre-wrap">
                      {queryError && <p className="text-danger font-bold flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {queryError}</p>}
                      {queryResult && JSON.stringify(queryResult, null, 2)}
                    </div>
                  </div>
                ) : (
                  <div className="surface-card bg-surface p-5 rounded-[12px] border border-border border-dashed h-[400px] flex flex-col justify-center items-center text-text-muted text-xs shadow-sm">
                    Awaiting query execution...
                  </div>
                )}

                {/* Slow running queries & bottlenecks */}
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border shadow-sm h-[400px] flex flex-col">
                  <div className="pb-3 border-b border-border mb-3 flex items-center justify-between">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Profiling & Slow Queries</h3>
                    <span className="text-[9px] bg-warning/10 text-warning px-2 py-0.5 rounded-full font-bold">slowms &gt; 100ms</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3">
                    {slowQueries.length === 0 && activeOps.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-text-muted text-xs py-12 text-center">
                        <div>
                          <CheckCircle2 className="w-6 h-6 text-accent mx-auto mb-2" />
                          No slow queries detected.
                        </div>
                      </div>
                    ) : (
                      <>
                        {activeOps.map((op, idx) => (
                          <div key={`op-${idx}`} className="p-3 bg-warning-bg/40 border border-warning-border rounded-xl">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-black text-warning uppercase">Active Query</span>
                              <span className="text-[10px] font-mono text-text-muted">{op.secs_running}s run time</span>
                            </div>
                            <p className="text-[10px] font-mono text-text-secondary truncate">{JSON.stringify(op.query)}</p>
                          </div>
                        ))}
                        {slowQueries.map((q, idx) => (
                          <div key={`slow-${idx}`} className="p-3 bg-[#f8f9fa] dark:bg-[#0b121f] border border-border rounded-xl">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold text-text-muted font-mono">{q.ns}</span>
                              <span className="text-[10px] font-extrabold text-danger">{q.durationMs}ms duration</span>
                            </div>
                            <p className="text-[10px] font-mono text-text-secondary truncate">{JSON.stringify(q.query)}</p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 4: FILE EXPLORER */}
          {activeTab === 'files' && (
            <div className="space-y-6 text-left">
              {fileStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <NilovaMiniCard label="Total Size" value={formatBytes(fileStats.totalSize)} icon={<Database />} percent="100%" growth="up" />
                  <NilovaMiniCard label="File Count" value={fileStats.totalCount} icon={<Folder />} percent="100%" growth="up" />
                  <NilovaMiniCard label="GridFS Size" value={formatBytes(fileStats.gridfs.size)} icon={<Maximize2 />} percent="GridFS" growth="up" isAccent />
                  <NilovaMiniCard label="Cloudinary Size" value={formatBytes(fileStats.cloudinary.size)} icon={<Globe />} percent="CDN" growth="up" />
                </div>
              )}

              {/* Uploaded assets explorer */}
              <div className="surface-card bg-surface p-5 rounded-[12px] border border-border shadow-sm">
                <div className="flex items-center justify-between border-b border-border pb-4 mb-4 gap-4 flex-wrap">
                  <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Uploaded Assets</h3>
                  <div className="flex items-center gap-2">
                    <FilterBtn label="All" id="all" current={fileTypeFilter} onClick={setFileTypeFilter} />
                    <FilterBtn label="GridFS" id="gridfs" current={fileTypeFilter} onClick={setFileTypeFilter} />
                    <FilterBtn label="Cloudinary" id="cloudinary" current={fileTypeFilter} onClick={setFileTypeFilter} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {files.length === 0 ? (
                    <div className="col-span-full py-16 text-center text-text-muted text-xs border border-dashed rounded-xl">
                      No files found in storage.
                    </div>
                  ) : (
                    files.map((file, i) => (
                      <div key={i} className="bg-[#f8f9fa] dark:bg-[#0b121f] border border-border rounded-xl p-4 flex flex-col justify-between hover:border-accent transition-all group relative">
                        <div className="flex gap-3">
                          <div className="w-12 h-12 rounded-xl bg-accent-light border border-accent-ring flex items-center justify-center shrink-0 overflow-hidden">
                            {file.mimeType?.startsWith('image/') ? (
                              <img src={file.url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Folder className="w-5 h-5 text-accent" />
                            )}
                          </div>
                          <div className="min-w-0 text-left">
                            <p className="text-xs font-bold text-text-primary truncate" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-[10px] text-text-muted truncate mt-0.5">
                              {formatBytes(file.size)} • {file.mimeType || 'unknown'}
                            </p>
                            <span className="text-[9px] bg-surface border border-border px-2 py-0.5 rounded-full inline-block mt-2 font-mono">
                              {file.provider}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-default/40">
                          <span className="text-[9px] text-text-faint font-mono">
                            {new Date(file.uploadedAt).toLocaleDateString()}
                          </span>
                          
                          <div className="flex items-center gap-1">
                            <a 
                              href={file.url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="p-1.5 text-text-muted hover:text-accent rounded-lg border border-transparent hover:border-accent transition-all"
                              title="Preview File"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                            <button 
                              onClick={() => handleDeleteFile(file)}
                              className="p-1.5 text-text-muted hover:text-danger rounded-lg border border-transparent hover:border-danger-border transition-all"
                              title="Delete File"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODULE 5: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="surface-card bg-surface p-5 rounded-[12px] border border-border shadow-sm flex flex-col h-[600px] text-left">
              <div className="border-b border-border pb-4 mb-4 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Operations Audit Trail</h3>
                </div>
                <div className="relative w-56 flex items-center">
                  <Search className="absolute left-3 w-4 h-4 text-text-faint" />
                  <input
                    type="text"
                    placeholder="Filter actions..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="w-full bg-[#f8f9fa] border border-border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-border">
                {auditLogs
                  .filter(l => 
                    l.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
                    l.actor?.name?.toLowerCase().includes(auditSearch.toLowerCase()) ||
                    l.target?.toLowerCase().includes(auditSearch.toLowerCase())
                  )
                  .map((log, idx) => (
                    <div key={idx} className="py-3 flex flex-wrap items-center justify-between text-xs gap-3 hover:bg-bg/25 px-2 rounded-xl transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-border-default/10 border border-border flex items-center justify-center shrink-0">
                          <Clock className="w-4 h-4 text-text-muted" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-text-primary">
                            {log.action}
                          </p>
                          <p className="text-[10px] text-text-muted">
                            By: {log.actor?.name || 'System'} (@{log.actor?.username || 'system'}) • Target: {log.target || 'None'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] text-text-faint block">
                          IP: {log.ip || 'Localhost'}
                        </span>
                        <span className="text-[9px] text-text-faint block mt-0.5">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* MODULE 6: SYSTEM BROADCAST */}
          {activeTab === 'broadcast' && (
            <div className="max-w-xl mx-auto py-12 text-left">
              <div className="surface-card bg-surface p-6 rounded-[12px] border border-border shadow-sm relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1.5 animated-gradient" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-accent-tint border border-accent-ring flex items-center justify-center">
                    <Send className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-bold text-text-primary text-xs uppercase tracking-wider leading-none">System Notification Dispatcher</h3>
                  </div>
                </div>
                
                <p className="text-xs text-text-secondary leading-relaxed mb-6">
                  Deliver a global system-wide push message to all users currently active on Blippr.
                </p>

                <form onSubmit={handleBroadcast} className="space-y-4">
                  <textarea
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Dispatch system transmission text..."
                    className="w-full bg-[#f8f9fa] border border-border rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-accent min-h-[140px] resize-none"
                  />
                  <button
                    type="submit"
                    disabled={!broadcastMessage.trim()}
                    className="w-full py-3.5 btn-primary rounded-xl font-bold text-xs tracking-wide shadow-glow flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Dispatch Global Broadcast
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Subcomponents matching Nilova styles
function SidebarItem({ icon, label, id, active, onClick }) {
  const isSelected = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold text-left transition-all ${
        isSelected 
          ? 'bg-accent/10 text-accent font-extrabold shadow-sm' 
          : 'text-text-secondary hover:bg-bg/50 hover:text-text-primary'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className={isSelected ? 'text-accent' : 'text-text-faint'}>{icon}</span>
        <span>{label}</span>
      </div>
      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'text-accent rotate-90' : 'text-text-faint opacity-0 group-hover:opacity-100'}`} />
    </button>
  );
}

function NilovaMiniCard({ label, value, icon, percent, growth, isAccent }) {
  return (
    <div className="surface-card bg-surface p-4.5 rounded-[12px] border border-border flex flex-col justify-between text-left shadow-sm hover:shadow transition-shadow relative overflow-hidden group">
      {isAccent && (
        <div className="absolute top-0 inset-x-0 h-[3px] bg-accent" />
      )}
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-lg bg-[#f8f9fa] dark:bg-[#0b121f] flex items-center justify-center border border-border group-hover:border-accent-ring transition-colors">
          <span className="text-text-secondary group-hover:text-accent transition-colors">{icon}</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-[#10b981]" />
          <span className="text-[10px] text-[#10b981] font-bold">{percent}</span>
        </div>
      </div>
      <div>
        <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">{label}</span>
        <span className="text-lg font-black text-text-primary block mt-1 leading-none">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      </div>
    </div>
  );
}

function ProgressItem({ label, value, color }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-text-secondary font-medium">{label}</span>
        <span className="text-text-primary font-bold">{value}%</span>
      </div>
      <div className="w-full bg-[#f8f9fa] dark:bg-[#0b121f] h-2 rounded-full border border-border overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function FilterBtn({ label, id, current, onClick }) {
  const isSelected = current === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
        isSelected 
          ? 'bg-accent text-white border-accent' 
          : 'bg-[#f8f9fa] text-text-secondary border-border hover:bg-surface-hover hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  );
}

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
  Maximize2
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

  const terminalEndRef = useRef(null);

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
        
        // Parallel load metadata
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

  // Socket setup for live analytics and users
  useEffect(() => {
    if (error === 'unauthorized') return;
    
    let socket;
    try {
      socket = getRealtimeSocket();
      
      // Join admin room
      socket.emit('admin:join', {});
      
      // Listen to real-time events
      socket.on('admin:traffic', (data) => {
        setLiveRequests(prev => {
          const next = [data, ...prev];
          return next.slice(0, 100); // Keep last 100 requests
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

  // Tab Loaders
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

  // Reload action for individual tabs
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
    showToast('Dashboard data refreshed');
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
        loadDbStats(); // refresh counts
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

  // Utility helpers
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMethodColor = (method) => {
    switch (method) {
      case 'GET': return 'text-success bg-success/10 border-success/20';
      case 'POST': return 'text-accent bg-accent/10 border-accent/20';
      case 'PATCH': return 'text-warning bg-warning/10 border-warning/20';
      case 'DELETE': return 'text-error bg-error/10 border-error/20';
      default: return 'text-text-muted bg-border-default/10';
    }
  };

  const getStatusColor = (status) => {
    if (status >= 500) return 'text-error';
    if (status >= 400) return 'text-warning';
    if (status >= 300) return 'text-indigo-400';
    return 'text-success';
  };

  // Render Line Graph
  const renderLineChart = (data, valKey, width = 600, height = 150) => {
    if (!data || data.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-xs text-text-muted">
          No metrics available.
        </div>
      );
    }

    const maxVal = Math.max(...data.map(d => d[valKey] || 0), 10);
    const points = data.map((d, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((d[valKey] || 0) / maxVal) * (height - 30) - 15;
      return { x, y };
    });

    const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
    const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

    return (
      <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Horizontal grid lines */}
        <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
        <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
        <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
        
        {/* Area fill */}
        <path d={areaD} fill="url(#chartGradient)" />
        {/* Line stroke */}
        <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        
        {/* Points */}
        {points.map((p, i) => (
          (i % Math.ceil(points.length / 10) === 0 || i === points.length - 1) && (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1" />
          )
        ))}
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="grid h-screen place-items-center text-text-muted bg-bg">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-accent mx-auto mb-4" />
          <p className="text-sm font-medium">Authorizing Secure Session...</p>
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
              Your profile requires administrative clearance to view the Blippr control center.
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
    <div className="min-h-screen bg-bg flex flex-col md:flex-row">
      {/* Toast popup */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-elevated border flex items-center gap-3 animate-fadeSlideUp ${
          toast.type === 'error' ? 'bg-danger-bg text-danger border-danger-border' : 
          toast.type === 'info' ? 'bg-accent-tint text-accent border-accent-ring' : 'bg-surface text-text-primary border-border'
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Left Sidebar Menu */}
      <aside className="w-full md:w-64 bg-surface border-b md:border-b-0 md:border-r border-border flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent-ring flex items-center justify-center shadow-glow animate-pulse">
            <Shield className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="font-bold text-sm leading-none text-text-primary flex items-center gap-1.5">
              Blippr Admin
            </h2>
            <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Control Panel</span>
          </div>
        </div>

        {/* Tab Items */}
        <nav className="p-4 space-y-1 flex-1">
          <TabButton icon={<Activity />} label="Analytics Monitor" id="analytics" active={activeTab} onClick={setActiveTab} />
          <TabButton icon={<Users />} label="Users & Sessions" id="users" active={activeTab} onClick={setActiveTab} />
          <TabButton icon={<Database />} label="Database Visualizer" id="database" active={activeTab} onClick={setActiveTab} />
          <TabButton icon={<Folder />} label="File Storage" id="files" active={activeTab} onClick={setActiveTab} />
          <TabButton icon={<FileText />} label="System Audit Logs" id="audit" active={activeTab} onClick={setActiveTab} />
          <TabButton icon={<Send />} label="System Broadcast" id="broadcast" active={activeTab} onClick={setActiveTab} />
        </nav>

        {/* Back Link */}
        <div className="p-4 border-t border-border bg-bg/20">
          <a href="/app" className="flex items-center justify-center gap-2 py-3 px-4 bg-surface border border-border hover:border-accent hover:text-accent rounded-xl text-xs font-bold transition-all shadow-card">
            <LogOut className="w-4 h-4" />
            Return to Blippr
          </a>
        </div>
      </aside>

      {/* Main Section */}
      <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border pb-4 gap-4">
          <div>
            <h1 className="text-2xl font-black text-text-primary tracking-tight">
              {activeTab === 'analytics' && 'Analytics & Operations'}
              {activeTab === 'users' && 'User Management & Sessions'}
              {activeTab === 'database' && 'MDB Collection Administrator'}
              {activeTab === 'files' && 'FileSystem Storage Explorer'}
              {activeTab === 'audit' && 'System Activity Audit Trail'}
              {activeTab === 'broadcast' && 'System Notification Dispatcher'}
            </h1>
            <p className="text-xs text-text-muted mt-0.5">Secure dashboard connected to production servers</p>
          </div>
          <button 
            onClick={handleRefresh} 
            className="p-2.5 bg-surface border border-border hover:border-accent-hover text-text-secondary hover:text-accent rounded-xl transition-all shadow-card hover:rotate-180 duration-500 shrink-0"
            title="Refresh statistics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Overview Stats Cards */}
        {stats && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MiniStatCard icon={<Users className="text-accent" />} label="Registered Accounts" value={stats.totalUsers} />
            <MiniStatCard icon={<Activity className="text-success" />} label="Live Presence" value={stats.activeUsers} sub="Online now" />
            <MiniStatCard icon={<MessageSquare className="text-indigo-400" />} label="Total Chats" value={stats.totalChats} />
            <MiniStatCard icon={<Globe className="text-warning" />} label="Message Exchange" value={stats.totalMessages} />
          </section>
        )}

        {/* Tab Modules Content */}
        
        {/* MODULE 1: ANALYTICS & LIVE MONITOR */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Custom SVG Charts */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="surface-card bg-surface p-5 rounded-[24px]">
                <h3 className="text-sm font-extrabold text-text-primary mb-1">Traffic Rates (Requests)</h3>
                <p className="text-xs text-text-muted mb-4">Historical buckets showing aggregated incoming API requests</p>
                <div className="h-44 relative bg-bg/50 rounded-xl p-2 border border-border">
                  {renderLineChart(metrics.minute, 'requestCount')}
                </div>
              </div>

              <div className="surface-card bg-surface p-5 rounded-[24px]">
                <h3 className="text-sm font-extrabold text-text-primary mb-1">Average Latency (Response Time)</h3>
                <p className="text-xs text-text-muted mb-4">Average server response duration per request bucket (ms)</p>
                <div className="h-44 relative bg-bg/50 rounded-xl p-2 border border-border">
                  {renderLineChart(metrics.minute.map(m => ({
                    ...m,
                    avgLatency: m.requestCount > 0 ? Math.round(m.responseTimeSum / m.requestCount) : 0
                  })), 'avgLatency')}
                </div>
              </div>
            </div>

            {/* Live Scrolling Request Terminal */}
            <div className="surface-card bg-[#090D16] border-slate-800 p-5 rounded-[24px] overflow-hidden flex flex-col h-[400px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="status-dot online animate-pulse" />
                  <h3 className="text-xs font-mono font-bold text-slate-200">live_api_activity_feed</h3>
                </div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">WebSocket pipeline</span>
              </div>

              <div className="flex-1 overflow-y-auto font-mono text-xs text-slate-300 space-y-1.5 p-3 scrollbar-thin">
                {liveRequests.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-center py-12">
                    <div>
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                      Listening for incoming production API traffic...
                    </div>
                  </div>
                ) : (
                  liveRequests.map((req, i) => (
                    <div key={i} className="flex flex-wrap items-center justify-between py-1 border-b border-slate-900/60 hover:bg-slate-900/40 px-2 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{new Date(req.timestamp).toLocaleTimeString()}</span>
                        <span className={`px-1.5 py-0.5 border text-[9px] font-extrabold rounded ${getMethodColor(req.method)}`}>
                          {req.method}
                        </span>
                        <span className="text-slate-200 font-semibold">{req.path}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`font-bold ${getStatusColor(req.status)}`}>
                          {req.status}
                        </span>
                        <span className="text-accent text-[11px]">{req.duration}ms</span>
                        <span className="text-slate-600 hidden sm:inline">{req.ip}</span>
                      </div>
                    </div>
                  ))
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* MODULE 2: USERS & SESSIONS */}
        {activeTab === 'users' && (
          <div className="grid md:grid-cols-3 gap-6">
            {/* User Search & Actions list */}
            <div className="md:col-span-2 space-y-4">
              <div className="surface-card bg-surface rounded-[24px] overflow-hidden flex flex-col h-[600px]">
                <div className="p-5 border-b border-border flex items-center gap-4 justify-between bg-surface/50">
                  <h3 className="font-extrabold text-sm text-text-primary">Accounts Registry</h3>
                  <div className="relative w-56 flex items-center">
                    <Search className="absolute left-3 w-4 h-4 text-text-faint" />
                    <input
                      type="text"
                      placeholder="Filter accounts..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-border">
                  {users.length === 0 ? (
                    <div className="p-8 text-center text-text-muted text-xs">No accounts match search query.</div>
                  ) : (
                    users.map((u) => (
                      <div key={u._id} className="p-4 flex items-center justify-between hover:bg-bg/50 transition-colors">
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

                        {/* Actions */}
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

            {/* Live Registration Feed sidebar */}
            <div className="space-y-6">
              <div className="surface-card bg-surface p-5 rounded-[24px] h-[600px] flex flex-col">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                  <Activity className="w-4 h-4 text-accent" />
                  <h3 className="font-extrabold text-sm text-text-primary">Registrations Feed</h3>
                </div>
                
                <p className="text-[11px] text-text-muted mb-4">Real-time alerts triggered on new registrations</p>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {liveRegs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center py-12 text-xs text-text-muted">
                      Waiting for new registrations...
                    </div>
                  ) : (
                    liveRegs.map((reg, i) => (
                      <div key={i} className="p-3 bg-bg border border-border rounded-2xl flex gap-3 animate-fadeSlideUp">
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
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Collection stats summary */}
              <div className="surface-card bg-surface p-5 rounded-[24px] md:col-span-1 h-[600px] overflow-y-auto">
                <div className="pb-3 border-b border-border mb-4">
                  <h3 className="font-extrabold text-sm text-text-primary">Collections Statistics</h3>
                  <p className="text-[10px] text-text-muted mt-0.5">Database storage configurations</p>
                </div>

                <div className="space-y-3">
                  {dbStats.map((c, i) => (
                    <div key={i} className="p-3 bg-bg border border-border hover:border-accent-ring rounded-2xl transition-all text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-text-primary font-mono">{c.name}</span>
                        <span className="text-[10px] bg-accent/10 text-accent font-bold px-2 py-0.5 rounded-full">
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
              <div className="surface-card bg-surface p-5 rounded-[24px] md:col-span-2 flex flex-col h-[600px]">
                <div className="pb-3 border-b border-border flex items-center justify-between mb-4">
                  <h3 className="font-extrabold text-sm text-text-primary">Interactive SQL/JSON Queries</h3>
                  <span className="text-[10px] text-text-muted bg-bg px-2.5 py-1 rounded-lg border border-border">MongoDB shell bypass</span>
                </div>

                <form onSubmit={handleExecuteQuery} className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto pr-1">
                  <div>
                    <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Target Collection</label>
                    <select 
                      value={queryCollection} 
                      onChange={(e) => setQueryCollection(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs"
                    >
                      {dbStats.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Operation Action</label>
                    <select 
                      value={queryAction} 
                      onChange={(e) => setQueryAction(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs"
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
                      className="w-full bg-surface border border-border rounded-xl p-3 text-xs font-mono"
                    />
                  </div>

                  {queryAction !== 'find' && (
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Update Operators (JSON)</label>
                      <textarea 
                        value={queryUpdate}
                        onChange={(e) => setQueryUpdate(e.target.value)}
                        rows="3"
                        className="w-full bg-surface border border-border rounded-xl p-3 text-xs font-mono"
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
                          className="w-full bg-surface border border-border rounded-xl p-2.5 text-xs font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Limit</label>
                          <input 
                            type="number" 
                            value={queryLimit}
                            onChange={(e) => setQueryLimit(Number(e.target.value))}
                            className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Skip</label>
                          <input 
                            type="number" 
                            value={querySkip}
                            onChange={(e) => setQuerySkip(Number(e.target.value))}
                            className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs"
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

            {/* Results pane & Profiling logs */}
            <div className="grid md:grid-cols-2 gap-6">
              {queryResult || queryError ? (
                <div className="surface-card bg-surface p-5 rounded-[24px] h-[400px] flex flex-col">
                  <h3 className="font-extrabold text-sm text-text-primary pb-3 border-b border-border mb-3">QueryResult Output</h3>
                  <div className="flex-1 overflow-auto bg-bg p-4 rounded-2xl border border-border font-mono text-xs text-text-secondary whitespace-pre-wrap">
                    {queryError && <p className="text-danger font-bold flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {queryError}</p>}
                    {queryResult && JSON.stringify(queryResult, null, 2)}
                  </div>
                </div>
              ) : (
                <div className="surface-card bg-surface p-5 rounded-[24px] h-[400px] flex flex-col justify-center items-center text-text-muted text-xs border border-dashed">
                  No query executed yet. Outputs will display here.
                </div>
              )}

              {/* Slow running queries & bottlenecks */}
              <div className="surface-card bg-surface p-5 rounded-[24px] h-[400px] flex flex-col">
                <div className="pb-3 border-b border-border mb-3 flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-text-primary">Profiling & Bottlenecks</h3>
                  <span className="text-[9px] bg-warning/10 text-warning px-2 py-0.5 rounded-full font-bold">slowms &gt; 100ms</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3">
                  {slowQueries.length === 0 && activeOps.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-text-muted text-xs py-12 text-center">
                      <div>
                        <CheckCircle2 className="w-6 h-6 text-accent mx-auto mb-2" />
                        No slow queries detected (Profiling set to &gt;100ms).
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
                        <div key={`slow-${idx}`} className="p-3 bg-bg border border-border rounded-xl">
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
          <div className="space-y-6">
            {/* Storage details breakdown */}
            {fileStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MiniStatCard icon={<Database />} label="Total Size" value={formatBytes(fileStats.totalSize)} />
                <MiniStatCard icon={<Folder />} label="File Count" value={fileStats.totalCount} />
                <MiniStatCard icon={<Maximize2 className="text-success" />} label="GridFS Size" value={formatBytes(fileStats.gridfs.size)} />
                <MiniStatCard icon={<Globe className="text-accent" />} label="Cloudinary Size" value={formatBytes(fileStats.cloudinary.size)} />
              </div>
            )}

            {/* Filter buttons */}
            <div className="surface-card bg-surface p-5 rounded-[24px]">
              <div className="flex items-center justify-between border-b border-border pb-4 mb-4 gap-4 flex-wrap">
                <h3 className="font-extrabold text-sm text-text-primary">Uploaded Assets Explorer</h3>
                <div className="flex items-center gap-2">
                  <FilterBtn label="All Storage" id="all" current={fileTypeFilter} onClick={setFileTypeFilter} />
                  <FilterBtn label="GridFS" id="gridfs" current={fileTypeFilter} onClick={setFileTypeFilter} />
                  <FilterBtn label="Cloudinary" id="cloudinary" current={fileTypeFilter} onClick={setFileTypeFilter} />
                </div>
              </div>

              {/* Grid showing files */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {files.length === 0 ? (
                  <div className="col-span-full py-16 text-center text-text-muted text-xs border border-dashed rounded-2xl">
                    No files found in storage.
                  </div>
                ) : (
                  files.map((file, i) => (
                    <div key={i} className="bg-bg border border-border rounded-2xl p-4 flex flex-col justify-between hover:border-accent-ring transition-all group relative">
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
                            className="p-1.5 text-text-muted hover:text-accent rounded-lg border border-transparent hover:border-accent-ring transition-all"
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
          <div className="surface-card bg-surface p-5 rounded-[24px] flex flex-col h-[600px]">
            <div className="border-b border-border pb-4 mb-4 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="font-extrabold text-sm text-text-primary">Operations Audit Trail</h3>
                <p className="text-[10px] text-text-muted mt-0.5">Chronological trail of administrative actions</p>
              </div>
              <div className="relative w-56 flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-text-faint" />
                <input
                  type="text"
                  placeholder="Filter actions..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-accent"
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
          <div className="max-w-xl mx-auto py-12">
            <div className="surface-card bg-surface p-6 rounded-[28px] border border-border shadow-elevated relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1.5 animated-gradient" />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent-tint border border-accent-ring flex items-center justify-center">
                  <Send className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-text-primary text-sm leading-none">System Notification Dispatcher</h3>
                  <span className="text-[10px] text-text-muted mt-1 inline-block">Real-time socket pipeline transmission</span>
                </div>
              </div>
              
              <p className="text-xs text-text-secondary leading-relaxed mb-6">
                Deliver a global system-wide push message to all users currently active on Blippr. Message renders as an instant alert.
              </p>

              <form onSubmit={handleBroadcast} className="space-y-4">
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Dispatch system transmission text..."
                  className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-accent min-h-[140px] resize-none"
                />
                <button
                  type="submit"
                  disabled={!broadcastMessage.trim()}
                  className="w-full py-3.5 btn-primary rounded-2xl font-bold text-xs tracking-wide shadow-glow flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Dispatch Global Broadcast
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Sub components
function TabButton({ icon, label, id, active, onClick }) {
  const isSelected = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-left transition-all ${
        isSelected 
          ? 'bg-accent-tint text-accent border border-accent-ring/30 shadow-glow' 
          : 'text-text-secondary hover:bg-bg/70 hover:text-text-primary'
      }`}
    >
      <span className={isSelected ? 'text-accent' : 'text-text-faint'}>{icon}</span>
      {label}
    </button>
  );
}

function MiniStatCard({ icon, label, value, sub }) {
  return (
    <div className="surface-card bg-surface p-5 rounded-[22px] border border-border flex items-center gap-4 transition-all">
      <div className="w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 text-left">
        <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block leading-none">{label}</span>
        <span className="text-xl font-black text-text-primary block mt-1 leading-none">{value?.toLocaleString() || value}</span>
        {sub && <span className="text-[9px] text-text-faint block mt-1">{sub}</span>}
      </div>
    </div>
  );
}

function FilterBtn({ label, id, current, onClick }) {
  const isSelected = current === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
        isSelected 
          ? 'bg-accent text-white border-accent' 
          : 'bg-bg text-text-secondary border-border hover:bg-surface-hover hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  );
}

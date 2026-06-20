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
  Download,
  ChevronRight,
  TrendingUp,
  Settings,
  Bell,
  MoreHorizontal,
  UserCheck,
  UserX,
  FileCode,
  TrendingDown,
  Sun,
  Moon,
  Menu,
  X
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
import BrandLogo from '../components/BrandLogo.jsx';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpCascade } from '../lib/motion.js';
import { API_URL } from '../lib/config.js';

export default function AdminDashboard() {
  const getInitials = (name) => {
    if (!name) return 'AD';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const [theme, setTheme] = useState(() => localStorage.getItem('blippr_theme') || 'light');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(() => {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
  });

  useEffect(() => {
    // Dynamic manifest swap for separate Admin PWA download
    const origManifest = document.querySelector('link[rel="manifest"]');
    const origHref = origManifest ? origManifest.getAttribute('href') : null;

    let adminManifest = document.querySelector('link[id="admin-manifest"]');
    if (!adminManifest) {
      adminManifest = document.createElement('link');
      adminManifest.id = 'admin-manifest';
      adminManifest.rel = 'manifest';
      adminManifest.href = '/admin.webmanifest';
      if (origManifest) {
        origManifest.remove();
      }
      document.head.appendChild(adminManifest);
    }

    // PWA Install prompt listener
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setInstallPrompt(null);
      showToast('Admin Control Center installed successfully!', 'success');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);

      // Restore main application manifest
      if (adminManifest) {
        adminManifest.remove();
      }
      if (origHref) {
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = origHref;
        document.head.appendChild(link);
      }
    };
  }, []);

  async function handleInstallAdminApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      showToast('Installing Admin App...', 'info');
    }
    setInstallPrompt(null);
  }

  function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('blippr_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }
  }

  function handleLogout() {
    localStorage.removeItem('blippr_token');
    localStorage.removeItem('blippr_is_guest');
    window.location.href = '/app';
  }

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [claimSecret, setClaimSecret] = useState('');
  const [activeTab, setActiveTab] = useState('analytics');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabChange = (id) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  // Sidebar collapse
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      } else if (window.innerWidth >= 1024) {
        setSidebarCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
  const [fileSearch, setFileSearch] = useState('');

  // Database Tab
  const [dbSearch, setDbSearch] = useState('');

  // Audit Log Tab
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditSearch, setAuditSearch] = useState('');

  // Live registration feed
  const [liveRegs, setLiveRegs] = useState([]);

  // Broadcast
  const [broadcastMessage, setBroadcastMessage] = useState('');

  // Calculate aggregated analytics metrics
  const minuteData = metrics.minute || [];
  const totalRequests = minuteData.reduce((sum, d) => sum + (d.requestCount || 0), 0);
  const totalDuration = minuteData.reduce((sum, d) => sum + (d.responseTimeSum || 0), 0);
  const avgLatency = totalRequests > 0 ? Math.round(totalDuration / totalRequests) : 0;
  const totalErrors = minuteData.reduce((sum, d) => sum + (d.errorCount || 0), 0);

  const getSearchValue = () => {
    switch (activeTab) {
      case 'users': return search;
      case 'audit': return auditSearch;
      case 'files': return fileSearch;
      case 'database': return dbSearch;
      default: return '';
    }
  };

  const handleSearchChange = (val) => {
    switch (activeTab) {
      case 'users': setSearch(val); break;
      case 'audit': setAuditSearch(val); break;
      case 'files': setFileSearch(val); break;
      case 'database': setDbSearch(val); break;
    }
  };

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(fileSearch.toLowerCase())
  );

  const filteredDbStats = dbStats.filter(c => 
    c.name.toLowerCase().includes(dbSearch.toLowerCase())
  );

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
      if (err.status === 403 || err.status === 401 || err.message?.includes('Forbidden') || err.message?.includes('Unauthorized')) {
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

  // Render Stacked Columns Bar Chart matching Nilova (segmented bars)
  const renderStackedColumnsChart = (data, valKey) => {
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
          const totalHeight = (val / maxVal) * 110; // scale height max 110px

          // Stack segment ratios based on response groups
          const s1Ratio = d.status2xx ? d.status2xx / val : 0.7;
          const s2Ratio = d.status3xx || d.status4xx ? (d.status3xx + d.status4xx) / val : 0.2;
          const s3Ratio = d.status5xx ? d.status5xx / val : 0.1;

          const h1 = Math.max(3, totalHeight * s1Ratio);
          const h2 = Math.max(2, totalHeight * s2Ratio);
          const h3 = Math.max(2, totalHeight * s3Ratio);

          return (
            <div key={i} className="flex flex-col items-center flex-1 group relative">
              <div className="w-3.5 flex flex-col justify-end items-center rounded-full overflow-hidden transition-all duration-500" style={{ height: `${Math.max(10, totalHeight)}px` }}>
                {/* Segment 3: Light Green (Top) */}
                <div className="w-full bg-accent/30 dark:bg-accent/20" style={{ height: `${h3}px` }} />
                {/* Segment 2: Medium Green (Middle) */}
                <div className="w-full bg-accent/60 dark:bg-accent/50" style={{ height: `${h2}px` }} />
                {/* Segment 1: Solid Accent Green (Bottom) */}
                <div className="w-full bg-accent dark:bg-accent/80" style={{ height: `${h1}px` }} />
              </div>
              <span className="text-[8.5px] text-text-muted font-sans mt-2">
                {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Nilova Audience Reached Donut Chart representing verification status
  const renderPresenceDonut = () => {
    const total = stats ? stats.totalUsers : 1;
    const verified = stats && typeof stats.verifiedUsers === 'number' ? stats.verifiedUsers : 0;
    const guests = stats && typeof stats.guestUsers === 'number' ? stats.guestUsers : 0;
    
    const verifiedPercent = total > 0 ? Math.min(100, Math.round((verified / total) * 100)) : 0;
    const guestPercent = total > 0 ? Math.min(100, Math.round((guests / total) * 100)) : 0;
    
    // Circular calculations based on verified percentage
    const radius = 15.9155;
    const strokeDashoffset = 100 - verifiedPercent;

    return (
      <div className="flex flex-col h-full justify-between py-2 text-left">
        <div className="relative w-36 h-36 mx-auto flex items-center justify-center mt-3">
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
            <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider font-sans">Verified</span>
            <div className="text-xl font-black text-text-primary leading-none mt-0.5">{verifiedPercent}%</div>
          </div>
        </div>

        <div className="space-y-4 mt-6 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
              <div className="text-xs">
                <span className="font-bold text-text-primary block">Verified Users</span>
                <span className="text-[10px] text-text-muted">ID verified members</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-text-primary block">{verified}</span>
              <span className="text-[9.5px] text-success font-bold">+{verifiedPercent}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-border inline-block" />
              <div className="text-xs">
                <span className="font-bold text-text-primary block">Guest Accounts</span>
                <span className="text-[10px] text-text-muted">Unconverted guests</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-text-primary block">{guests}</span>
              <span className="text-[9.5px] text-danger font-bold">-{guestPercent}%</span>
            </div>
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
          <p className="text-sm font-semibold tracking-wide">Connecting Dashboard Pipeline...</p>
        </div>
      </div>
    );
  }

  if (error === 'unauthorized') {
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-4 py-12">
        <div className="w-full max-w-md">
          <div className="surface-card bg-surface rounded-[16px] p-8 border border-border shadow-elevated text-center relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-accent animate-pulse" />
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
                className="w-full bg-bg/50 border border-border rounded-xl px-4 py-3.5 text-sm font-mono focus:outline-none focus:border-accent text-center"
              />
              <button type="submit" className="w-full py-3.5 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold text-sm tracking-wide transition-colors">
                Claim Admin Key
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Find users who have safety violation or are unverified for Suggestions card
  const flaggedUsers = users.filter(u => u.role !== 'admin' && (u.safetyViolationCount > 0 || !u.isVerified)).slice(0, 4);

  // Live calculations for rolling real-time charts
  const rollingRequests = liveRequests.slice(0, 20);
  const rollingAvgLatency = rollingRequests.length > 0
    ? Math.round(rollingRequests.reduce((sum, r) => sum + r.duration, 0) / rollingRequests.length)
    : 0;

  const rollingErrors = rollingRequests.filter(r => r.status >= 400).length;
  const rollingErrorRate = rollingRequests.length > 0
    ? Math.round((rollingErrors / rollingRequests.length) * 100)
    : 0;

  const last50 = liveRequests.slice(0, 50);
  const total50 = last50.length || 1;
  const s2xx = last50.filter(r => r.status >= 200 && r.status < 300).length;
  const s3xx = last50.filter(r => r.status >= 300 && r.status < 400).length;
  const s4xx = last50.filter(r => r.status >= 400 && r.status < 500).length;
  const s5xx = last50.filter(r => r.status >= 500).length;

  const chartRequests = [...liveRequests.slice(0, 15)].reverse();
  const maxDuration = Math.max(...chartRequests.map(r => r.duration), 200);
  const points = chartRequests.map((r, idx) => {
    const x = chartRequests.length > 1 ? (idx / (chartRequests.length - 1)) * 100 : 50;
    const y = 85 - (r.duration / maxDuration) * 70;
    return `${x},${y}`;
  });
  const linePath = points.length > 0 ? `M ${points.join(' L ')}` : '';
  const areaPath = points.length > 0 ? `M 0,100 L ${points.join(' L ')} L 100,100 Z` : '';

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row font-sans antialiased text-text-primary">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-elevated border flex items-center gap-3 animate-fadeSlideUp ${
          toast.type === 'error' ? 'bg-danger/10 text-danger border-danger/20' : 
          toast.type === 'info' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-surface text-text-primary border-border'
        }`}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Sidebar Backdrop Overlay on Mobile */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden animate-fadeIn"
        />
      )}

      {/* Left Sidebar Menu */}
      <aside className={`bg-surface border-r border-border flex flex-col shrink-0 transition-transform duration-300 ease-in-out z-50
        fixed inset-y-0 left-0 w-64 md:static md:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${sidebarCollapsed ? 'md:w-20' : 'md:w-64'}
      `}>
        {/* Brand Header */}
        <div className="p-5 flex items-center justify-between border-b border-border min-h-16">
          <div className="flex flex-col text-left">
            <BrandLogo compactTitle={!sidebarCollapsed} compact={sidebarCollapsed} />
            {!sidebarCollapsed && (
              <span className="text-[8px] bg-red-500/10 text-red-500 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-widest mt-1.5 w-max">
                Control Center
              </span>
            )}
          </div>
          <button 
            onClick={() => {
              if (window.innerWidth < 768) {
                setMobileMenuOpen(false);
              } else {
                setSidebarCollapsed(!sidebarCollapsed);
              }
            }}
            className="p-1 hover:bg-bg rounded-lg transition-all text-text-muted hover:text-text-primary"
            title={window.innerWidth < 768 ? "Close Menu" : "Collapse Sidebar"}
          >
            <span className="md:hidden"><X className="w-5 h-5" /></span>
            <span className="hidden md:block"><MoreHorizontal className="w-5 h-5" /></span>
          </button>
        </div>

        {/* Sidebar Navigation items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Main items */}
          <div>
            {!sidebarCollapsed && <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider px-3 block mb-2 text-left">Main</span>}
            <nav className="space-y-1">
              <SidebarItem icon={<Activity />} label="Dashboards" id="analytics" active={activeTab} onClick={handleTabChange} collapsed={sidebarCollapsed} />
              <SidebarItem icon={<Users />} label="Users & Sessions" id="users" active={activeTab} onClick={handleTabChange} collapsed={sidebarCollapsed} />
              <SidebarItem icon={<Database />} label="Database Visualizer" id="database" active={activeTab} onClick={handleTabChange} collapsed={sidebarCollapsed} />
            </nav>
          </div>

          {/* Web Apps items */}
          <div>
            {!sidebarCollapsed && <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider px-3 block mb-2 text-left">Web Apps</span>}
            <nav className="space-y-1">
              <SidebarItem icon={<Folder />} label="File Storage" id="files" active={activeTab} onClick={handleTabChange} collapsed={sidebarCollapsed} />
              <SidebarItem icon={<FileText />} label="System Audit Logs" id="audit" active={activeTab} onClick={handleTabChange} collapsed={sidebarCollapsed} />
              <SidebarItem icon={<Send />} label="System Broadcast" id="broadcast" active={handleTabChange} collapsed={sidebarCollapsed} />
            </nav>
          </div>
        </div>

        {/* Bottom Menu Items */}
        <div className="p-4 border-t border-border bg-bg/15 space-y-2">
          {!isAppInstalled && (
            <button 
              onClick={handleInstallAdminApp}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-accent hover:text-white hover:bg-accent rounded-lg transition-all text-left"
              title="Install standalone Admin App"
            >
              <Download className="w-4.5 h-4.5" />
              {!sidebarCollapsed && <span>Install Admin App</span>}
            </button>
          )}
          <button 
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-text-secondary hover:text-text-primary rounded-lg transition-colors text-left"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'light' ? <Moon className="w-4.5 h-4.5 text-text-faint" /> : <Sun className="w-4.5 h-4.5 text-accent" />}
            {!sidebarCollapsed && <span>Toggle Theme ({theme === 'light' ? 'Dark' : 'Light'})</span>}
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-text-secondary hover:text-text-primary rounded-lg transition-colors text-left"
          >
            <LogOut className="w-4.5 h-4.5" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="p-4 border-t border-border flex items-center gap-3 text-left">
            {stats?.adminUser?.avatar ? (
              <img src={stats.adminUser.avatar} className="w-8 h-8 rounded-full object-cover border border-border" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center font-bold text-xs text-accent border border-accent/20">
                {getInitials(stats?.adminUser?.name || 'Admin')}
              </div>
            )}
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs font-bold text-text-primary leading-none truncate">{stats?.adminUser?.name || 'Administrator'}</p>
              <p className="text-[9.5px] text-text-muted truncate mt-1">{stats?.adminUser?.email || 'admin@blippr.in'}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-text-faint" />
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-surface border-b border-border px-4 sm:px-6 flex items-center justify-between shrink-0 animate-fadeIn">
          {/* Hamburger Menu Button on Mobile */}
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 hover:bg-bg/60 rounded-xl text-text-secondary hover:text-text-primary transition-colors md:hidden mr-2 shrink-0"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb Title on Mobile */}
          <div className="text-xs font-black text-text-primary uppercase tracking-wider font-mono block sm:hidden">
            {activeTab === 'analytics' ? 'Analytics' : 
             activeTab === 'users' ? 'Accounts' : 
             activeTab === 'database' ? 'Database' : 
             activeTab === 'files' ? 'Files' : 
             activeTab === 'audit' ? 'Audit' : 'Broadcast'}
          </div>

          {['users', 'audit', 'files', 'database'].includes(activeTab) ? (
            <div className="relative w-64 flex items-center hidden sm:flex">
              <Search className="absolute left-3 w-5 h-5 text-text-faint" />
              <input 
                type="text" 
                placeholder={
                  activeTab === 'users' ? 'Search accounts...' : 
                  activeTab === 'audit' ? 'Search audit logs...' : 
                  activeTab === 'files' ? 'Search files...' : 
                  activeTab === 'database' ? 'Search collections...' : 
                  'Search...'
                }
                value={getSearchValue()}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full bg-bg/80 border border-border rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          ) : (
            <div className="hidden sm:block text-xs font-bold text-text-muted uppercase tracking-wider font-mono">
              {activeTab === 'analytics' ? 'Analytics Monitor' : 'System Broadcast'}
            </div>
          )}

          {/* Right actions */}
          <div className="flex items-center gap-4 ml-auto">
            <button onClick={handleRefresh} className="p-2 hover:bg-bg rounded-lg transition-all text-text-secondary hover:text-accent hover:rotate-180 duration-500" title="Refresh Panel Data">
              <RefreshCw className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-bg rounded-lg transition-all text-text-secondary relative" title="Notifications">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent live-dot" />
            </button>
            <button onClick={toggleTheme} className="p-2 hover:bg-bg rounded-lg transition-all text-text-secondary" title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}>
              {theme === 'light' ? <Moon className="w-5 h-5 text-text-faint" /> : <Sun className="w-5 h-5 text-accent" />}
            </button>
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-2">
              {stats?.adminUser?.avatar ? (
                <img src={stats.adminUser.avatar} className="w-8 h-8 rounded-full object-cover border border-border" alt="" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center font-bold text-xs text-accent border border-accent/20">
                  {getInitials(stats?.adminUser?.name || 'Admin')}
                </div>
              )}
              <div className="text-left hidden md:block">
                <span className="text-xs font-bold text-text-primary block leading-none">{stats?.adminUser?.name || 'Administrator'}</span>
                <span className="text-[9px] text-text-muted mt-1 block">{stats?.adminUser?.email || 'admin@blippr.in'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Inner Content Body */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Header Dashboard stats exactly like Nilova top bar */}
          {stats && (
            <motion.section 
              variants={staggerContainer(0.04, 0.05)}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
            >
              <NilovaMiniCard 
                label="Registered Users" 
                value={stats.totalUsers} 
                icon={<Users />} 
                percent={stats.totalUsers > 0 ? Math.round(((stats.verifiedUsers || 0) / stats.totalUsers) * 100) + '% Ver.' : '0%'} 
                growth="up" 
              />
              <NilovaMiniCard 
                label="Online Now" 
                value={stats.activeUsers} 
                icon={<Activity />} 
                percent={stats.totalUsers > 0 ? Math.round(((stats.activeUsers || 0) / stats.totalUsers) * 100) + '% On.' : '0%'} 
                growth="up" 
                isAccent 
              />
              <NilovaMiniCard 
                label="Total Chats" 
                value={stats.totalChats} 
                icon={<MessageSquare />} 
                percent={stats.totalUsers > 0 ? ((stats.totalChats || 0) / stats.totalUsers).toFixed(1) + '/usr' : '0/usr'} 
                growth="up" 
              />
              <NilovaMiniCard 
                label="Total Messages" 
                value={stats.totalMessages} 
                icon={<Globe />} 
                percent={stats.totalChats > 0 ? ((stats.totalMessages || 0) / stats.totalChats).toFixed(0) + '/chat' : '0/chat'} 
                growth="up" 
              />
              <NilovaMiniCard 
                label="Cloud Storage" 
                value={fileStats ? formatBytes(fileStats.totalSize) : '0 B'} 
                icon={<Folder />} 
                percent={fileStats && fileStats.totalSize > 0 ? Math.round(((fileStats.cloudinary?.size || 0) / fileStats.totalSize) * 100) + '% CDN' : '0%'} 
                growth="up" 
              />
            </motion.section>
          )}

          {/* MAIN MODULE: ANALYTICS MONITOR */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              
              {/* Live Real-time Telemetry Monitor */}
              <div className="grid md:grid-cols-2 gap-6 animate-fadeIn">
                {/* Latency Wave Chart */}
                <div className="bg-[#090D16] border border-[#1e293b] p-5 rounded-[12px] shadow-sm text-left flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-[#1e293b] mb-4">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                        </span>
                        <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">live_api_latency_sparkline</h3>
                      </div>
                      <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded font-mono font-bold border border-accent/20">Rolling 15 Requests</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs mb-4 font-mono">
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                        <span className="text-[9px] text-slate-400 block">Avg Latency (20 reqs)</span>
                        <span className="text-lg font-black text-accent block mt-1">{rollingAvgLatency} ms</span>
                      </div>
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                        <span className="text-[9px] text-slate-400 block">Max Peak Latency</span>
                        <span className="text-lg font-black text-slate-200 block mt-1">{Math.round(maxDuration)} ms</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="h-36 relative bg-slate-950/40 rounded-xl border border-slate-800 p-2 overflow-hidden flex items-end">
                    {points.length > 0 ? (
                      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="liveGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <motion.path 
                          d={areaPath} 
                          fill="url(#liveGradient)" 
                          animate={{ d: areaPath }}
                          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                        />
                        <motion.path 
                          d={linePath} 
                          fill="none" 
                          stroke="var(--accent)" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          animate={{ d: linePath }}
                          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                        />
                      </svg>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                        Awaiting network telemetry...
                      </div>
                    )}
                  </div>
                </div>

                {/* HTTP Status Bar Chart */}
                <div className="bg-[#090D16] border border-[#1e293b] p-5 rounded-[12px] shadow-sm text-left flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-[#1e293b] mb-4">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                        </span>
                        <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">live_http_status_codes</h3>
                      </div>
                      <span className="text-[10px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded font-mono font-bold border border-rose-500/20">Rolling 50 Requests</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs mb-4 font-mono">
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                        <span className="text-[9px] text-slate-400 block">Error Rate (20 reqs)</span>
                        <span className={`text-lg font-black block mt-1 ${rollingErrorRate > 10 ? 'text-rose-500' : 'text-slate-200'}`}>{rollingErrorRate}%</span>
                      </div>
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                        <span className="text-[9px] text-slate-400 block">Status Counts</span>
                        <span className="text-lg font-black text-slate-200 block mt-1">Total {last50.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="h-36 relative bg-slate-950/40 rounded-xl border border-slate-800 p-4 overflow-hidden flex items-end justify-between gap-4">
                    {[
                      { count: s2xx, label: '2xx', color: 'bg-emerald-500' },
                      { count: s3xx, label: '3xx', color: 'bg-sky-500' },
                      { count: s4xx, label: '4xx', color: 'bg-amber-500' },
                      { count: s5xx, label: '5xx', color: 'bg-rose-500' }
                    ].map((item) => {
                      const percentageHeight = last50.length > 0 ? (item.count / last50.length) * 100 : 0;
                      return (
                        <div key={item.label} className="flex-1 flex flex-col items-center justify-end h-full gap-2 font-mono">
                          <span className="text-[10px] font-bold text-slate-400">{item.count}</span>
                          <div className="w-full bg-slate-800/40 rounded-t-lg h-20 flex items-end overflow-hidden">
                            <motion.div
                              className={`w-full rounded-t-lg ${item.color}`}
                              initial={{ height: 0 }}
                              animate={{ height: `${percentageHeight}%` }}
                              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            />
                          </div>
                          <span className="text-[10px] font-extrabold text-slate-400">{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Donut, Bar Chart & Sidebar Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Audience Reached Donut Chart */}
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border md:col-span-1 lg:col-span-1 shadow-sm text-left">
                  <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Audience Reached</h3>
                    <MoreHorizontal className="w-4 h-4 text-text-faint" />
                  </div>
                  {renderPresenceDonut()}
                </div>

                {/* Profile Visits Stacked Column Bar Chart */}
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border md:col-span-2 lg:col-span-2 shadow-sm flex flex-col justify-between text-left">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Profile Visits & Aggregates</h3>
                    <div className="flex gap-2">
                      <span className="text-[10.5px] bg-accent/10 text-accent px-2.5 py-1 rounded font-bold border border-accent/20">Hourly Metrics</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
                    <div className="bg-bg/60 border border-border rounded-xl p-3 text-left">
                      <span className="text-[9.5px] text-text-muted font-bold uppercase tracking-wider block">Total API Calls</span>
                      <span className="text-base font-black text-text-primary block mt-1">{totalRequests.toLocaleString()}</span>
                    </div>
                    <div className="bg-bg/60 border border-border rounded-xl p-3 text-left">
                      <span className="text-[9.5px] text-text-muted font-bold uppercase tracking-wider block">Avg Latency</span>
                      <span className="text-base font-black text-accent block mt-1">{avgLatency} ms</span>
                    </div>
                    <div className="bg-bg/60 border border-border rounded-xl p-3 text-left">
                      <span className="text-[9.5px] text-text-muted font-bold uppercase tracking-wider block">Errors (5xx)</span>
                      <span className={`text-base font-black block mt-1 ${totalErrors > 0 ? 'text-danger' : 'text-text-primary'}`}>{totalErrors}</span>
                    </div>
                  </div>
                  <div className="h-56 relative bg-bg/60 rounded-xl border border-border p-2 mt-4">
                    {renderStackedColumnsChart(metrics.minute, 'requestCount')}
                  </div>
                </div>

                {/* Growth Drive Widget */}
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border md:col-span-1 lg:col-span-1 shadow-sm text-left flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                      <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Growth Drive</h3>
                      <span className="bg-[#10b981]/15 text-[#10b981] text-[9px] px-2 py-0.5 rounded-full font-bold">Active</span>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-relaxed">
                      Track new accounts registration targets and active user engagement metrics.
                    </p>
                  </div>

                  <div className="my-4 space-y-3.5">
                    <div>
                      <span className="text-xl font-black text-text-primary block leading-none">{stats?.totalUsers || 2539}</span>
                      <span className="text-[9.5px] text-text-muted uppercase font-bold tracking-wider block mt-1">New Registrations</span>
                    </div>
                    <div>
                      <span className="text-xl font-black text-accent block leading-none">43,000</span>
                      <span className="text-[9.5px] text-text-muted uppercase font-bold tracking-wider block mt-1">Growth Target</span>
                    </div>
                  </div>

                  {/* Stack of overlapping avatars of recent users */}
                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <div className="flex -space-x-2.5 overflow-hidden">
                      {users.slice(0, 4).map((u, i) => (
                        <div key={i} className="inline-block h-7 w-7 rounded-full ring-2 ring-surface">
                          {u.avatar ? (
                            <img src={u.avatar} className="h-full w-full rounded-full object-cover" alt="" />
                          ) : (
                            <div className="h-full w-full rounded-full bg-accent/25 text-accent text-[10px] font-black flex items-center justify-center">
                              {u.name?.charAt(0)}
                            </div>
                          )}
                        </div>
                      ))}
                      {users.length > 4 && (
                        <div className="inline-block h-7 w-7 rounded-full ring-2 ring-surface bg-accent-light text-accent text-[10px] font-extrabold flex items-center justify-center">
                          +{users.length - 4}
                        </div>
                      )}
                    </div>
                    <span onClick={() => setActiveTab('users')} className="text-[10px] text-accent font-bold hover:underline cursor-pointer">View Details</span>
                  </div>
                </div>
              </div>

              {/* Lower Section: Traffic Sources + Table + Suggestions */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Left Traffic Progress Bars */}
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border md:col-span-1 lg:col-span-1 shadow-sm text-left">
                  <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Traffic Endpoints</h3>
                    <MoreHorizontal className="w-4 h-4 text-text-faint" />
                  </div>
                  
                  <div className="space-y-4">
                    <ProgressItem label="Auth Services (/api/auth/*)" value={stats?.endpointPercentages?.auth ?? 0} color="bg-accent" />
                    <ProgressItem label="Chats Exchange (/api/chats/*)" value={stats?.endpointPercentages?.chats ?? 0} color="bg-violet-500" />
                    <ProgressItem label="User Services (/api/users/*)" value={stats?.endpointPercentages?.users ?? 0} color="bg-success" />
                    <ProgressItem label="Media Deliveries (/api/media/*)" value={stats?.endpointPercentages?.media ?? 0} color="bg-gold" />
                    <ProgressItem label="WebRTC Signaling (/api/calls/*)" value={stats?.endpointPercentages?.calls ?? 0} color="bg-danger" />
                  </div>
                </div>

                {/* Center Registrations Table */}
                <div className="surface-card bg-surface rounded-[12px] border border-border md:col-span-1 lg:col-span-1 shadow-sm flex flex-col h-[340px]">
                  <div className="p-5 border-b border-border flex items-center justify-between bg-surface/50">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Registrations Feed</h3>
                    <button onClick={() => setActiveTab('users')} className="text-[10px] text-accent font-bold hover:underline">
                      See All
                    </button>
                  </div>

                  <div className="flex-1 overflow-auto scrollbar-thin">
                    <table className="w-full min-w-[340px] text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-bg/60 text-[9px] uppercase tracking-wider text-text-muted font-bold">
                          <th className="p-3 pl-4">User</th>
                          <th className="p-3">Role</th>
                          <th className="p-3 pr-4 text-right">Registered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-xs">
                        {users.slice(0, 5).map((u, i) => (
                          <tr key={i} className="hover:bg-bg/40 transition-colors">
                            <td className="p-3 pl-4 flex items-center gap-2.5">
                              {u.avatar ? (
                                <img src={u.avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-border" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-accent-light flex items-center justify-center font-bold text-[10px] text-accent">
                                  {u.name?.charAt(0)}
                                </div>
                              )}
                              <div>
                                <span className="font-bold text-text-primary block leading-none">{u.name}</span>
                                <span className="text-[9.5px] text-text-muted mt-1 block">@{u.username}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                u.role === 'admin' ? 'bg-danger/10 text-danger' : 'bg-accent/15 text-accent'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="p-3 pr-4 text-right text-[9.5px] text-text-faint font-mono">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Suggestions widget (Flagged Accounts Audit) */}
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border md:col-span-2 lg:col-span-1 shadow-sm flex flex-col justify-between h-[340px] text-left">
                  <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Suggestions for You</h3>
                    <span className="text-[9px] text-accent font-bold hover:underline cursor-pointer" onClick={() => setActiveTab('users')}>See All</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {flaggedUsers.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-text-muted text-xs text-center py-8">
                        No pending user verification or moderation needed.
                      </div>
                    ) : (
                      flaggedUsers.map((fu, i) => (
                        <div key={i} className="flex items-center justify-between gap-2.5 py-1.5 border-b border-border last:border-b-0">
                          <div className="flex items-center gap-2 min-w-0">
                            {fu.avatar ? (
                              <img src={fu.avatar} className="w-10 h-10 rounded-full object-cover shrink-0 border border-border" alt="" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-accent-light text-accent font-bold flex items-center justify-center text-xs shrink-0">
                                {fu.name?.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0 text-left">
                              <span className="font-bold text-xs text-text-primary block truncate leading-none">{fu.name}</span>
                              <span className="text-[9.5px] text-text-muted mt-1 block truncate">@{fu.username}</span>
                            </div>
                          </div>

                          <button 
                            onClick={() => toggleVerify(fu)}
                            className="px-2.5 py-1 bg-accent hover:bg-accent-hover text-white text-[9.5px] font-bold rounded-lg transition-colors shrink-0"
                          >
                            Verify
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Live scrolling API activity feed exactly like a Nilova card */}
              <div className="bg-[#090D16] border border-[#1e293b] p-5 rounded-[12px] overflow-hidden flex flex-col h-[320px]">
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
                <div className="surface-card bg-surface rounded-[12px] border border-border shadow-sm overflow-hidden flex flex-col h-[500px] md:h-[600px]">
                  <div className="p-5 border-b border-border flex items-center gap-4 justify-between bg-surface/50">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Account Registry</h3>
                    <div className="relative w-56 flex items-center">
                      <Search className="absolute left-3 w-4 h-4 text-text-faint" />
                      <input
                        type="text"
                        placeholder="Filter accounts..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-bg/50 border border-border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-border">
                    {users.length === 0 ? (
                      <div className="p-8 text-center text-text-muted text-xs">No accounts match search query.</div>
                    ) : (
                      users.map((u) => (
                        <div key={u._id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-bg/25 transition-colors">
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
                                  <span className="bg-danger/10 text-danger border border-danger/20 text-[9px] px-1.5 py-0.5 rounded font-black uppercase shrink-0">
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

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                              onClick={() => toggleVerify(u)}
                              className={`p-2 rounded-xl border text-[10px] font-bold transition-all ${
                                u.isVerified 
                                  ? 'bg-bg text-text-muted border-border hover:bg-danger/10 hover:text-danger hover:border-danger/20' 
                                  : 'bg-accent/10 text-accent border-accent/20 hover:bg-accent hover:text-white'
                              }`}
                              title={u.isVerified ? 'Revoke verification badge' : 'Grant verification badge'}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            
                            <button
                              onClick={() => handleRevokeSessions(u)}
                              className="p-2 bg-surface text-text-secondary border border-border hover:border-warning-border hover:text-warning-text rounded-xl transition-all"
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
                                  : 'bg-danger/10 text-danger border-danger/20 hover:bg-danger hover:text-white'
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
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border shadow-sm h-[500px] md:h-[600px] flex flex-col">
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
                        <div key={i} className="p-3 bg-bg/60 border border-border rounded-xl flex gap-3 animate-fadeSlideUp">
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
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border shadow-sm md:col-span-1 h-[500px] md:h-[600px] overflow-y-auto">
                  <div className="pb-3 border-b border-border mb-4">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Collections Stats</h3>
                  </div>

                  <div className="space-y-3">
                    {filteredDbStats.length === 0 ? (
                      <div className="text-center text-text-muted text-xs py-8">
                        No collections found.
                      </div>
                    ) : (
                      filteredDbStats.map((c, i) => (
                        <div key={i} className="p-3 bg-bg/60 border border-border hover:border-accent-ring rounded-xl transition-all">
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
                    ))
                  )}
                  </div>
                </div>

                {/* JSON query builder */}
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border shadow-sm md:col-span-2 flex flex-col h-[500px] md:h-[600px]">
                  <div className="pb-3 border-b border-border flex items-center justify-between mb-4">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">JSON Query Dispatcher</h3>
                  </div>

                  <form onSubmit={handleExecuteQuery} className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 overflow-auto pr-1 scrollbar-thin">
                    <div>
                      <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Collection</label>
                      <select 
                        value={queryCollection} 
                        onChange={(e) => setQueryCollection(e.target.value)}
                        className="w-full bg-bg/50 border border-border rounded-xl px-3 py-2 text-xs focus:border-accent outline-none"
                      >
                        {dbStats.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Operation</label>
                      <select 
                        value={queryAction} 
                        onChange={(e) => setQueryAction(e.target.value)}
                        className="w-full bg-bg/50 border border-border rounded-xl px-3 py-2 text-xs focus:border-accent outline-none"
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
                        className="w-full bg-bg/50 border border-border rounded-xl p-3 text-xs font-mono focus:border-accent outline-none"
                      />
                    </div>

                    {queryAction !== 'find' && (
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Update Operators (JSON)</label>
                        <textarea 
                          value={queryUpdate}
                          onChange={(e) => setQueryUpdate(e.target.value)}
                          rows="3"
                          className="w-full bg-bg/50 border border-border rounded-xl p-3 text-xs font-mono focus:border-accent outline-none"
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
                            className="w-full bg-bg/50 border border-border rounded-xl p-2.5 text-xs font-mono focus:border-accent outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Limit</label>
                            <input 
                              type="number" 
                              value={queryLimit}
                              onChange={(e) => setQueryLimit(Number(e.target.value))}
                              className="w-full bg-bg/50 border border-border rounded-xl px-3 py-2 text-xs focus:border-accent outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-text-secondary mb-1.5 uppercase">Skip</label>
                            <input 
                              type="number" 
                              value={querySkip}
                              onChange={(e) => setQuerySkip(Number(e.target.value))}
                              className="w-full bg-bg/50 border border-border rounded-xl px-3 py-2 text-xs focus:border-accent outline-none"
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
                  <div className="surface-card bg-surface p-5 rounded-[12px] border border-border shadow-sm h-[350px] md:h-[400px] flex flex-col">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider pb-3 border-b border-border mb-3">QueryResult Output</h3>
                    <div className="flex-1 overflow-auto bg-bg/60 p-4 rounded-xl border border-border font-mono text-xs text-text-secondary whitespace-pre-wrap">
                      {queryError && <p className="text-danger font-bold flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {queryError}</p>}
                      {queryResult && JSON.stringify(queryResult, null, 2)}
                    </div>
                  </div>
                ) : (
                  <div className="surface-card bg-surface p-5 rounded-[12px] border border-border border-dashed h-[350px] md:h-[400px] flex flex-col justify-center items-center text-text-muted text-xs shadow-sm">
                    Awaiting query execution...
                  </div>
                )}

                {/* Slow running queries & bottlenecks */}
                <div className="surface-card bg-surface p-5 rounded-[12px] border border-border shadow-sm h-[350px] md:h-[400px] flex flex-col">
                  <div className="pb-3 border-b border-border mb-3 flex items-center justify-between">
                    <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">Profiling & Slow Queries</h3>
                    <span className="text-[9px] bg-warning/10 text-warning px-2 py-0.5 rounded-full font-bold">slowms &gt; 100ms</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3">
                    {slowQueries.length === 0 && activeOps.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-text-muted text-xs py-12 text-center">
                        <div>
                          <CheckCircle2 className="w-6 h-6 text-[#6366f1] mx-auto mb-2" />
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
                          <div key={`slow-${idx}`} className="p-3 bg-bg/60 border border-border rounded-xl">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredFiles.length === 0 ? (
                    <div className="col-span-full py-16 text-center text-text-muted text-xs border border-dashed rounded-xl">
                      {fileSearch ? 'No files match search query.' : 'No files found in storage.'}
                    </div>
                  ) : (
                    filteredFiles.map((file, i) => {
                      const fileUrl = file.url?.startsWith('/') ? `${API_URL}${file.url}` : file.url;
                      return (
                        <div key={i} className="bg-bg/60 border border-border rounded-xl p-4 flex flex-col justify-between hover:border-accent transition-all group relative">
                          <div className="flex gap-3">
                            <div className="w-12 h-12 rounded-xl bg-accent-light border border-accent-ring flex items-center justify-center shrink-0 overflow-hidden">
                              {file.mimeType?.startsWith('image/') ? (
                                <img src={fileUrl} alt="" className="w-full h-full object-cover" />
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
                                href={fileUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="p-1.5 text-text-muted hover:text-accent rounded-lg border border-transparent hover:border-accent transition-all"
                                title="Preview File"
                              >
                                <Eye className="w-4 h-4" />
                              </a>
                              <button 
                                onClick={() => handleDeleteFile(file)}
                                className="p-1.5 text-text-muted hover:text-danger rounded-lg border border-transparent hover:border-danger/25 transition-all"
                                title="Delete File"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODULE 5: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="surface-card bg-surface p-5 rounded-[12px] border border-border shadow-sm flex flex-col h-[500px] md:h-[600px] text-left">
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
                    className="w-full bg-bg/50 border border-border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-accent"
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
                    className="w-full bg-bg/50 border border-border rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-accent min-h-[140px] resize-none"
                  />
                  <button
                    type="submit"
                    disabled={!broadcastMessage.trim()}
                    className="w-full py-3.5 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold text-xs tracking-wide transition-colors flex items-center justify-center gap-2 shadow-glow"
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
function SidebarItem({ icon, label, id, active, onClick, collapsed }) {
  const isSelected = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold text-left transition-all relative ${
        isSelected 
          ? 'text-accent font-extrabold shadow-sm' 
          : 'text-text-secondary hover:bg-bg/50 hover:text-text-primary'
      }`}
    >
      {isSelected && (
        <motion.div 
          layoutId="active-sidebar-pill"
          className="absolute inset-0 bg-accent/10 rounded-lg -z-10"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <div className="flex items-center gap-2.5 z-10">
        <motion.span 
          whileHover={{ scale: 1.05, rotate: 2 }}
          transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          className={isSelected ? 'text-accent' : 'text-text-faint'}
        >
          {icon}
        </motion.span>
        {!collapsed && <span>{label}</span>}
      </div>
      {!collapsed && (
        <ChevronRight className={`w-3.5 h-3.5 transition-transform z-10 ${isSelected ? 'text-accent rotate-90' : 'text-text-faint opacity-0'}`} />
      )}
    </button>
  );
}

function NilovaMiniCard({ label, value, icon, percent, growth, isAccent }) {
  return (
    <motion.div 
      variants={fadeUpCascade}
      whileHover={{ y: -4, scale: 1.01, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="surface-card bg-surface p-4 sm:p-5 rounded-[12px] border border-border flex flex-col justify-between text-left shadow-sm relative overflow-hidden group cursor-pointer will-change-motion"
    >
      {isAccent && (
        <div className="absolute top-0 inset-x-0 h-[3.5px] bg-accent" />
      )}
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-lg bg-bg/60 flex items-center justify-center border border-border group-hover:border-accent-ring transition-colors">
          <span className="text-text-secondary group-hover:text-accent transition-colors">{icon}</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-success" />
          <span className="text-[10px] text-success font-bold">{percent}</span>
        </div>
      </div>
      <div>
        <span className="text-[9px] sm:text-[9.5px] text-text-muted font-bold uppercase tracking-wider block">{label}</span>
        <span className="text-base sm:text-lg font-black text-text-primary block mt-1 leading-none">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      </div>
    </motion.div>
  );
}

// Progress Bar matching Nilova
function ProgressItem({ label, value, color }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10.5px]">
        <span className="text-text-secondary font-semibold">{label}</span>
        <span className="text-text-primary font-extrabold">{value}%</span>
      </div>
      <div className="w-full bg-bg/60 h-2 rounded-full border border-border overflow-hidden">
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
          : 'bg-bg/60 text-text-secondary border-border hover:bg-surface-hover hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copyright, Verified, Zap, Terminal, Shield, Camera, Mic, Info, ExternalLink } from 'lucide-react';
import { showToast } from '../components/Toast.jsx';

export default function LegalCenter() {
  const navigate = useNavigate();
  const [managingPermissions, setManagingPermissions] = useState(false);

  const openSourceLibraries = [
    { name: 'Socket.io', license: 'MIT License', url: 'https://socket.io/' },
    { name: 'Mongoose', license: 'MIT License', url: 'https://mongoosejs.com/' }
  ];

  function handleManagePermissions() {
    setManagingPermissions(true);
    showToast('Requesting hardware check...', 'info');
    
    // Simulate browser permission query or request
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .then(() => {
          showToast('Permissions are active and granted.', 'success');
          setManagingPermissions(false);
        })
        .catch((err) => {
          showToast(`Permission status: ${err.message || 'Restricted'}`, 'warning');
          setManagingPermissions(false);
        });
    } else {
      setTimeout(() => {
        showToast('System settings are managed by your browser.', 'success');
        setManagingPermissions(false);
      }, 1000);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg py-6 px-4 bg-bg text-text-primary pb-24 scrollbar-none min-h-screen">
      
      {/* Header */}
      <header className="flex items-center gap-3.5 mb-8">
        <button 
          onClick={() => navigate('/app/profile')} 
          className="text-primary hover:opacity-80 p-2 -ml-2 rounded-full transition active:scale-95" 
          aria-label="Back to profile"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Legal Center</h2>
          <p className="text-xs text-text-muted">Licensing, attributions, &amp; data governance</p>
        </div>
      </header>

      {/* Hero Intro */}
      <section className="mb-6 px-1">
        <p className="text-xs text-text-secondary leading-relaxed">
          Review our official documentation, licensing, open source components, and hardware permission guidelines. We maintain transparency regarding how we build, deploy, and execute our code.
        </p>
      </section>

      {/* Copyright Card */}
      <section className="glass-panel rounded-2xl p-5 mb-4 border border-white/10 relative overflow-hidden">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
            <Copyright size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Official Copyright</h3>
            <p className="text-[10px] text-text-muted">Version 1.0.4 • Oct 2024</p>
          </div>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          © 2024 Blippr Inc. All rights reserved. No part of this application may be reproduced, distributed, or transmitted in any form without the prior written permission of the publisher.
        </p>
      </section>

      {/* Trademark Card */}
      <section className="glass-panel rounded-2xl p-5 mb-4 border border-white/10 relative overflow-hidden">
        <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none text-secondary">
          <Zap size={80} />
        </div>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary shrink-0">
            <Verified size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Trademarks</h3>
            <p className="text-[10px] text-text-muted">Intellectual Property</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black text-primary uppercase tracking-widest">Engine</span>
              <span className="text-[9px] text-text-muted font-mono">TM #482910</span>
            </div>
            <p className="text-xs font-black text-white">Blipp-Sync™ Engine</p>
            <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
              Our proprietary low-latency real-time synchronization protocol designed for near-instantaneous global social discovery.
            </p>
          </div>
          <p className="text-[10px] text-text-muted italic px-1 leading-relaxed">
            'Blippr', the Blippr logo, and 'Blipp-Sync' are registered trademarks of Blippr Inc.
          </p>
        </div>
      </section>

      {/* Third Party Open Source Attributions */}
      <section className="glass-panel rounded-2xl p-5 mb-4 border border-white/10 relative overflow-hidden">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-tertiary-fixed-dim bg-[#4edea3]/20 flex items-center justify-center text-[#4edea3] shrink-0">
            <Terminal size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Open Source</h3>
            <p className="text-[10px] text-text-muted">Third-Party Attribution</p>
          </div>
        </div>
        <div className="space-y-2">
          {openSourceLibraries.map((lib, idx) => (
            <a 
              key={idx} 
              href={lib.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group"
            >
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white group-hover:text-primary transition-colors">{lib.name}</span>
                <span className="text-[10px] text-text-muted">{lib.license}</span>
              </div>
              <ExternalLink size={14} className="text-text-muted group-hover:text-white transition-colors" />
            </a>
          ))}
        </div>
      </section>

      {/* Hardware Access Permissions */}
      <section className="glass-panel rounded-2xl p-5 mb-4 border border-white/10 relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none text-white">
          <Shield size={100} />
        </div>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Permissions</h3>
            <p className="text-[10px] text-text-muted">Hardware Access Governance</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Camera size={16} className="text-text-muted shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-white">Camera Access</p>
              <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                Used solely for video calls and profile customization. Feed data is handled transiently and is never stored without explicit user intent.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mic size={16} className="text-text-muted shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-white">Microphone Access</p>
              <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                Required for real-time video/audio chat syncing. Audio streams are ephemeral and never written or recorded to disk storage.
              </p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={handleManagePermissions}
            disabled={managingPermissions}
            className="w-full py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 font-bold text-xs text-primary transition-all active:scale-[0.98]"
          >
            {managingPermissions ? 'CHECKING HARDWARE...' : 'MANAGE SYSTEM PERMISSIONS'}
          </button>
        </div>
      </section>

      {/* Footer Info */}
      <footer className="text-center mt-12 mb-6 opacity-40">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white">Blippr v1.0.4 Build 882</p>
        <p className="text-[10px] text-text-muted mt-1">Crafted for the Electric Generation.</p>
      </footer>

    </div>
  );
}

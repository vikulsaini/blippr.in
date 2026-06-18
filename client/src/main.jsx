import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { repairStaleDeploymentCache } from './lib/deployment.js';
import { initNativeApp } from './lib/native.js';
import { installSoundUnlock } from './lib/sounds.js';
import './styles.css';

installSoundUnlock();
initNativeApp().catch(() => {});
repairStaleDeploymentCache().catch(() => {});

/* ─── Theme Initialization ─── */
function initTheme() {
  const saved = localStorage.getItem('blippr_theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark-theme');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0B1120');
  } else {
    document.documentElement.classList.remove('dark-theme');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#F8FAFC');
  }
}

initTheme();

/* ─── Mouse Follow Light Effect ─── */
function initMouseLight() {
  const root = document.documentElement;
  let rafId = null;

  function onMove(event) {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      root.style.setProperty('--mouse-x', `${event.clientX}px`);
      root.style.setProperty('--mouse-y', `${event.clientY}px`);
      rafId = null;
    });
  }

  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    if (touch) onMove({ clientX: touch.clientX, clientY: touch.clientY });
  }, { passive: true });
}

initMouseLight();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

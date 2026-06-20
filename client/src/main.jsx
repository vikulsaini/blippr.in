import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { repairStaleDeploymentCache } from './lib/deployment.js';
import { initNativeApp } from './lib/native.js';
import { installSoundUnlock } from './lib/sounds.js';
import './styles.css';

/* ─── Prevent Self-XSS Warning in DevTools ─── */
function initConsoleWarning() {
  console.log(
    '%cStop!',
    'color: #ef4444; font-size: 36px; font-weight: bold; font-family: sans-serif; text-shadow: 1px 1px 0px #000;'
  );
  console.log(
    '%cUsing this console may allow attackers to impersonate you and steal your information using an attack called Self-XSS. Do not enter or paste code that you do not understand.',
    'font-size: 14px; font-family: sans-serif; font-weight: bold;'
  );
}

initConsoleWarning();

installSoundUnlock();
initNativeApp().catch(() => {});
repairStaleDeploymentCache().catch(() => {});



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

// Gracefully fade out and remove LCP shell after first paint
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const shell = document.getElementById('lcp-shell');
    if (shell) {
      shell.style.opacity = '0';
      shell.style.transition = 'opacity 0.25s ease-out';
      setTimeout(() => {
        shell.remove();
      }, 250);
    }
  });
});

let context;
let unlocked = false;
let activeInterval;

function getContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  context ||= new AudioContext();
  return context;
}

export function unlockSounds() {
  const audioContext = getContext();
  if (!audioContext) return;
  audioContext.resume?.().catch(() => {});

  const gain = audioContext.createGain();
  const oscillator = audioContext.createOscillator();
  gain.gain.value = 0.0001;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.02);
  unlocked = true;
}

export function installSoundUnlock() {
  const unlock = () => unlockSounds();
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
}

export function playTone({ frequency = 760, duration = 0.18, volume = 0.05, type = 'sine' } = {}) {
  const audioContext = getContext();
  if (!audioContext || !unlocked) return;
  audioContext.resume?.().catch(() => {});

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration + 0.03);
}

export function playMessageSound() {
  playTone({ frequency: 920, duration: 0.09, volume: 0.045, type: 'triangle' });
  window.setTimeout(() => playTone({ frequency: 1240, duration: 0.08, volume: 0.035, type: 'triangle' }), 90);
  vibrate([80, 45, 80]);
}

export function startCallSound({ outgoing = false } = {}) {
  stopCallSound();
  const pulse = () => {
    playTone({
      frequency: outgoing ? 520 : 860,
      duration: outgoing ? 0.26 : 0.48,
      volume: outgoing ? 0.04 : 0.07
    });
    if (!outgoing) window.setTimeout(() => playTone({ frequency: 660, duration: 0.36, volume: 0.055 }), 520);
  };
  pulse();
  activeInterval = window.setInterval(pulse, outgoing ? 1300 : 1800);
}

export function stopCallSound() {
  if (activeInterval) window.clearInterval(activeInterval);
  activeInterval = null;
  vibrate(0);
}

export function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

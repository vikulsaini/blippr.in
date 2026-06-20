import { getRingtoneForFriend, loadSoundPrefs } from './soundPrefs.js';

let context;
let unlocked = false;
let activeInterval;
let activeAudio;

function getContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!unlocked) return null;
  context ||= new AudioContext();
  return context;
}

export function unlockSounds() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  context ||= new AudioContext();
  unlocked = true;
  const audioContext = context;
  if (!audioContext) return;
  audioContext.resume?.().catch(() => {});

  const gain = audioContext.createGain();
  const oscillator = audioContext.createOscillator();
  gain.gain.value = 0.0001;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.02);
}

export function installSoundUnlock() {
  const handler = () => {
    unlockSounds();
    const events = ['click', 'touchstart', 'keydown', 'mousedown'];
    events.forEach((e) => window.removeEventListener(e, handler));
  };
  const events = ['click', 'touchstart', 'keydown', 'mousedown'];
  events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
}

export function playTone({ frequency = 760, duration = 0.18, volume = 0.05, type = 'sine' } = {}) {
  if (!unlocked) return;
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

function playCustomAudio(sound, { loop = false, volume = 0.55 } = {}) {
  if (!unlocked || !sound?.dataUrl) return false;
  stopAudio();
  activeAudio = new Audio(sound.dataUrl);
  activeAudio.loop = loop;
  activeAudio.volume = volume;
  activeAudio.play().catch(() => {});
  return true;
}

function stopAudio() {
  if (!activeAudio) return;
  activeAudio.pause();
  activeAudio.currentTime = 0;
  activeAudio = null;
}

function playPackSound(id, role = 'message') {
  const tone = id || 'pulse';
  if (role === 'outgoing') {
    playTone({ frequency: 440, duration: 0.12, volume: 0.045, type: 'sine' });
    window.setTimeout(() => playTone({ frequency: 560, duration: 0.12, volume: 0.04, type: 'sine' }), 180);
    return;
  }
  const presets = {
    pulse: [[860, 0.42, 0.07], [650, 0.32, 0.052]],
    glass: [[920, 0.09, 0.045], [1240, 0.08, 0.035]],
    soft: [[520, 0.18, 0.04], [680, 0.18, 0.032]],
    classic: [[780, 0.26, 0.055], [780, 0.26, 0.045]]
  };
  const sequence = presets[tone] || presets.pulse;
  sequence.forEach(([frequency, duration, volume], index) => {
    window.setTimeout(() => playTone({ frequency, duration, volume, type: role === 'call' ? 'sine' : 'triangle' }), index * 280);
  });
}

export function playMessageSound() {
  const prefs = loadSoundPrefs();
  if (prefs.dnd) return;
  const sound = prefs.messageTone;
  if (sound?.type === 'custom' && playCustomAudio(sound, { volume: 0.46 })) {
    vibrate([80, 45, 80]);
    return;
  }
  playPackSound(sound?.id || 'glass', 'message');
  vibrate([80, 45, 80]);
}

export function previewSound(sound, role = 'message') {
  if (sound?.type === 'custom') {
    playCustomAudio(sound, { volume: role === 'call' ? 0.58 : 0.45 });
    return;
  }
  playPackSound(sound?.id, role);
}

export function startCallSound({ outgoing = false, peerId } = {}) {
  stopCallSound();
  const prefs = loadSoundPrefs();
  if (prefs.dnd) return;
  const selectedSound = outgoing ? { type: 'pack', id: 'classic' } : getRingtoneForFriend(peerId);
  const pulse = () => {
    if (selectedSound?.type === 'custom' && !outgoing) {
      playCustomAudio(selectedSound, { loop: false, volume: 0.62 });
      return;
    }
    playPackSound(selectedSound?.id || 'pulse', outgoing ? 'outgoing' : 'call');
  };
  pulse();
  activeInterval = window.setInterval(pulse, outgoing ? 1500 : 2100);
}

export function stopCallSound() {
  if (activeInterval) window.clearInterval(activeInterval);
  activeInterval = null;
  stopAudio();
  vibrate(0);
}

export function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

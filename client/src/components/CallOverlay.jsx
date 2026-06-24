import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ear, Gauge, Maximize2, Mic, MicOff, Minimize2, Phone, PhoneOff, RotateCw, Signal, SignalLow, Volume2, VolumeX, Video, VideoOff } from 'lucide-react';

export default function CallOverlay({ 
  call, 
  minimized = false, 
  onMinimize, 
  onExpand, 
  onAccept, 
  onReject, 
  onEnd, 
  onToggleMute, 
  onToggleCamera, 
  onSwitchCamera, 
  onToggleSpeaker, 
  onToggleLowDataMode,
  messages = [],
  onSendMessage,
  currentUserId
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteAudioVideoRef = useRef(null);
  const chromeTimerRef = useRef(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [duration, setDuration] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (call?.status !== 'connected') {
      setDuration(0);
      return;
    }
    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [call?.status]);

  function formatCallDuration(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = call?.localStream || null;
  }, [call?.localStream]);

  useEffect(() => {
    if (call?.type === 'video') {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = call?.remoteStream || null;
        remoteVideoRef.current.volume = 1;
        setAudioOutput(remoteVideoRef.current, call?.speakerOn, 'video').catch(() => {});
        remoteVideoRef.current.play?.().catch(() => {});
      }
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      if (remoteAudioVideoRef.current) remoteAudioVideoRef.current.srcObject = null;
    } else {
      const useVideoElement = !!call?.speakerOn;
      const activeEl = useVideoElement ? remoteAudioVideoRef.current : remoteAudioRef.current;
      const inactiveEl = useVideoElement ? remoteAudioRef.current : remoteAudioVideoRef.current;

      if (inactiveEl) inactiveEl.srcObject = null;
      if (activeEl) {
        activeEl.srcObject = call?.remoteStream || null;
        activeEl.volume = 1;
        setAudioOutput(activeEl, call?.speakerOn, 'audio').catch(() => {});
        activeEl.play?.().catch(() => {});
      }
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    }
  }, [call?.remoteStream, call?.speakerOn, call?.type]);

  const isVideo = call?.type === 'video';
  const canAutoHideChrome = isVideo && call?.status !== 'incoming';
  const chromeClass = canAutoHideChrome && !chromeVisible ? 'translate-y-2 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100';
  const title = call?.status === 'incoming' ? 'Incoming call' : call?.status === 'calling' ? 'Calling...' : call?.status === 'reconnecting' ? 'Reconnecting...' : 'Connected';
  const routeLabel = isVideo ? 'Video speaker' : call?.speakerOn ? 'Speaker' : 'Receiver';
  const QualityIcon = call?.quality === 'poor' ? SignalLow : Signal;
  const qualityLabel = call?.quality === 'reconnecting' ? 'Reconnecting' : call?.quality === 'poor' ? 'Poor connection' : call?.quality === 'good' ? 'Good connection' : 'Checking connection';

  const revealChrome = () => {
    setChromeVisible(true);
    window.clearTimeout(chromeTimerRef.current);
    if (call?.type === 'video' && call?.status !== 'incoming') {
      chromeTimerRef.current = window.setTimeout(() => setChromeVisible(false), 2600);
    }
  };

  const controls = call?.status === 'incoming' ? (
    <div className="grid w-full max-w-sm grid-cols-2 gap-2">
      <CallButton label="Reject" icon={PhoneOff} onClick={onReject} tone="danger" />
      <CallButton label="Accept" icon={Phone} onClick={onAccept} tone="mint" />
    </div>
  ) : call?.status === "calling" ? (
    <div className="grid w-full max-w-sm mx-auto">
      <CallButton label="End" icon={PhoneOff} onClick={onEnd} tone="danger" />
    </div>
  ) : (
    <div className={`grid w-full gap-1.5 sm:gap-2 ${isVideo ? 'max-w-md grid-cols-3 sm:max-w-3xl sm:grid-cols-6' : 'max-w-lg grid-cols-5'}`}>
      <CallButton label={call?.muted ? 'Unmute' : 'Mute'} icon={call?.muted ? MicOff : Mic} onClick={onToggleMute} />
      <CallButton label={isVideo ? 'Speaker' : call?.speakerOn ? 'Speaker' : 'Earpiece'} icon={call?.speakerOn ? Volume2 : Ear} onClick={onToggleSpeaker} active={call?.speakerOn} />
      <CallButton label={call?.cameraOff ? 'Camera' : 'Video'} icon={call?.cameraOff ? VideoOff : Video} onClick={onToggleCamera} disabled={!isVideo} />
      {isVideo && <CallButton label="Low data" icon={Gauge} onClick={onToggleLowDataMode} active={call?.lowDataMode} />}
      <CallButton label="Switch" icon={RotateCw} onClick={onSwitchCamera} disabled={!isVideo || call?.cameraOff} />
      <CallButton label="End" icon={PhoneOff} onClick={onEnd} tone="danger" />
    </div>
  );

  useEffect(() => {
    revealChrome();
    return () => window.clearTimeout(chromeTimerRef.current);
  }, [call?.callId, call?.status, call?.type]);

  return (
    <AnimatePresence>
      {call && (
        minimized ? (
          <motion.div
            key="minimized-call"
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 350, damping: 26 }}
            className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-[22px] border border-white/10 bg-[#171f33]/90 backdrop-blur-md p-3 text-[#dbe2fd] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center gap-3">
              <img src={call.peerUser?.avatar} alt="" className="h-11 w-11 rounded-2xl bg-[#131b2e] object-cover shadow-sm border border-white/5" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{call.peerUser?.name || 'Blippr friend'}</p>
                <p className="truncate text-xs text-[#ccc3d8]/80">{title} - {qualityLabel}</p>
              </div>
              {call.status === 'incoming' ? (
                <>
                  <button onClick={onReject} className="grid h-10 w-10 place-items-center rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors border border-red-500/20" aria-label="Reject call"><PhoneOff size={17} /></button>
                  <button onClick={onAccept} className="grid h-10 w-10 place-items-center rounded-full bg-[#4edea3] hover:bg-[#3ecb90] text-black font-bold shadow-[0_0_12px_rgba(78,222,163,0.4)] transition-colors border border-[#4edea3]/20" aria-label="Accept call"><Phone size={17} /></button>
                </>
              ) : (
                <button onClick={onEnd} className="grid h-10 w-10 place-items-center rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors border border-red-500/20" aria-label="End call"><PhoneOff size={17} /></button>
              )}
              <button onClick={onExpand} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition-colors" aria-label="Open call"><Maximize2 size={17} /></button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="expanded-call"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-0 z-50 bg-[#0b1326] text-[#dbe2fd]"
          >
            <motion.section
              onPointerDown={revealChrome}
              onPointerMove={revealChrome}
              onTouchStart={revealChrome}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative h-dvh overflow-hidden p-1 sm:p-1.5"
            >
              <div className="relative h-full overflow-hidden rounded-[16px] border border-white/10 bg-[#0b1326] shadow-2xl sm:rounded-[20px]">
                {!isVideo && (
                  <>
                    <audio ref={remoteAudioRef} autoPlay playsInline />
                    <video ref={remoteAudioVideoRef} autoPlay playsInline style={{ display: 'none' }} />
                  </>
                )}
                {isVideo && call.remoteStream && call.quality !== 'poor' && call.status !== 'reconnecting' ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-contain"
                    style={{ transform: 'translate3d(0,0,0)', willChange: 'transform', backfaceVisibility: 'hidden' }}
                  />
                ) : isVideo && call.remoteStream ? (
                  <div className="relative grid h-full place-items-center p-6 text-center bg-[#0b1326] overflow-hidden">
                    {/* Blurred background avatar */}
                    <div className="absolute inset-0 opacity-30 blur-2xl scale-110 pointer-events-none">
                      <img src={call.peerUser?.avatar} alt="" className="h-full w-full object-cover" />
                    </div>
                    
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="relative h-28 w-28 mb-6">
                        <span className="absolute inset-0 animate-ping rounded-full bg-[#7c3aed]/20" />
                        <img src={call.peerUser?.avatar} alt="" className="relative h-28 w-28 rounded-full bg-[#131b2e] object-cover shadow-[0_0_20px_rgba(124,58,237,0.3)] border border-[#d2bbff]/20" />
                      </div>
                      <p className="text-lg font-semibold text-white">{call.peerUser?.name || 'Blippr friend'}</p>
                      
                      {/* Premium 5-bar animated audio wave graphic */}
                      <div className="mt-6 flex items-end gap-1.5 h-12">
                        {[0, 1, 2, 3, 4].map((bar) => (
                          <motion.span
                            key={bar}
                            className="w-1.5 rounded-full bg-[#d2bbff]"
                            animate={{
                              height: [12, 48, 12]
                            }}
                            transition={{
                              duration: 0.8,
                              repeat: Infinity,
                              delay: bar * 0.15,
                              ease: 'easeInOut'
                            }}
                          />
                        ))}
                      </div>

                      {/* Notice Banner explaining video paused to prioritize audio */}
                      <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-400 max-w-xs leading-normal animate-pulse backdrop-blur-md">
                        Video paused to prioritize audio stream quality.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative grid h-full place-items-center p-6 text-center bg-[#0b1326] overflow-hidden">
                    {/* Pulsing background auras */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
                      <div className="absolute w-[320px] h-[320px] rounded-full bg-[#7c3aed]/15 blur-[50px] pulse-aura" />
                      <div className="absolute w-[440px] h-[440px] rounded-full bg-[#4edea3]/10 blur-[70px] pulse-aura" style={{ animationDelay: '1.5s' }} />
                    </div>

                    {/* Blurred background avatar */}
                    <div className="absolute inset-0 opacity-20 blur-3xl scale-110 pointer-events-none">
                      <img src={call.peerUser?.avatar} alt="" className="h-full w-full object-cover" />
                    </div>
                    
                    <div className="relative z-10 flex flex-col items-center">
                      {/* Large Glowing Avatar Border */}
                      <div className="relative h-36 w-36 mb-8 flex items-center justify-center">
                        {/* Outer pulsing ring */}
                        <span className="absolute -inset-4 rounded-full border border-white/5 bg-white/[0.02] backdrop-blur-sm animate-pulse" />
                        {/* Glowing secondary ring */}
                        <span className="absolute -inset-2 rounded-full border border-[#4edea3]/20 shadow-[0_0_30px_rgba(78,222,163,0.2)] animate-pulse" style={{ animationDuration: '4s' }} />
                        <img 
                          src={call.peerUser?.avatar} 
                          alt="" 
                          className="relative h-36 w-36 rounded-full bg-[#131b2e] object-cover shadow-[0_0_40px_rgba(78,222,163,0.3)] border-2 border-[#4edea3]/80" 
                        />
                      </div>

                      {/* Contact Identity & State */}
                      <h2 className="text-2xl font-bold tracking-tight text-white mb-2">{call.peerUser?.name || 'Blippr friend'}</h2>
                      <p className="text-sm font-medium tracking-wider text-[#ccc3d8]/80 uppercase">
                        {call.status === 'incoming' 
                          ? 'Incoming call...' 
                          : call.status === 'calling' 
                            ? 'Calling...' 
                            : call.status === 'reconnecting' 
                              ? 'Reconnecting...' 
                              : 'Connected'}
                      </p>

                      {/* Dynamic Live Waveform Bar Visualization */}
                      <div className="mt-8 flex items-end justify-center gap-1.5 h-16 w-64">
                        {Array.from({ length: 18 }).map((_, idx) => {
                          const baseHeight = 8;
                          const isConnected = call.status === 'connected';
                          const maxHeight = isConnected ? 56 : 16;
                          const duration = 0.6 + (idx % 4) * 0.15;
                          return (
                            <motion.span
                              key={idx}
                              className="w-1.5 rounded-full bg-gradient-to-t from-[#4edea3] to-[#7c3aed]"
                              animate={isConnected ? {
                                height: [baseHeight, maxHeight - (idx % 3) * 10, baseHeight]
                              } : {
                                height: [baseHeight, baseHeight + 8, baseHeight]
                              }}
                              transition={{
                                duration: duration,
                                repeat: Infinity,
                                repeatType: "reverse",
                                delay: idx * 0.05,
                                ease: 'easeInOut'
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Top Status Bar (Floating) */}
                <header className={`absolute top-0 left-0 w-full z-50 p-6 flex items-start justify-between transition-opacity duration-300 ${chromeClass}`}>
                  <div className="flex flex-col gap-1">
                    <h1 className="font-headline-md text-headline-md text-white drop-shadow-lg">{call.peerUser?.name || 'Blippr Friend'}</h1>
                    <div className="flex items-center gap-2 px-3 py-1 bg-black/30 backdrop-blur-md rounded-full border border-white/10 w-fit">
                      <span className="w-2 h-2 rounded-full bg-secondary active-glow"></span>
                      <span className="font-label-md text-label-md text-white">{formatCallDuration(duration)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="glass-panel px-3 py-2 rounded-xl flex items-center gap-2 group cursor-pointer hover:bg-white/10 transition-colors">
                      <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                      <span className="font-label-md text-label-md text-white/90">Encrypted Connection</span>
                    </div>
                    {/* Network Strength */}
                    <div className="flex gap-0.5 h-4 items-end px-2">
                      <div className="w-1 h-1 bg-secondary rounded-full"></div>
                      <div className="w-1 h-2 bg-secondary rounded-full"></div>
                      <div className="w-1 h-3 bg-secondary rounded-full"></div>
                      <div className={`w-1 h-4 bg-secondary rounded-full ${call.quality === 'poor' ? 'opacity-30' : 'opacity-100'}`}></div>
                    </div>
                  </div>
                </header>

                {/* Picture-in-Picture (Selfie Window) */}
                {isVideo && call.localStream && (
                  <motion.div
                    drag
                    dragConstraints={{ left: -300, right: 0, top: 0, bottom: 500 }}
                    dragElastic={0.15}
                    dragMomentum={false}
                    className="absolute top-24 right-4 w-32 h-44 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-40 drag-handle cursor-grab active:cursor-grabbing"
                  >
                    {call.cameraOff ? (
                      <div className="grid h-full place-items-center text-white/45"><VideoOff size={22} /></div>
                    ) : (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="h-full w-full object-cover select-none pointer-events-none"
                        style={{ transform: 'translate3d(0,0,0)', willChange: 'transform', backfaceVisibility: 'hidden' }}
                      />
                    )}
                    {/* Selfie Label Overlay */}
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/40 backdrop-blur-sm rounded-md border border-white/10">
                      <p className="font-label-md text-[10px] text-white uppercase tracking-widest">You</p>
                    </div>
                  </motion.div>
                )}

                {/* Interaction Controls (Floating Action Bar) */}
                <nav className={`absolute bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-[400px] px-6 transition-opacity duration-300 ${chromeClass}`}>
                  <div className={`glass-panel p-4 rounded-[32px] flex items-center shadow-2xl w-full ${call.status === 'connected' || call.status === 'reconnecting' ? 'justify-between' : 'justify-center'}`}>
                    {/* Mute Toggle */}
                    <button 
                      onClick={onToggleMute}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${call.muted ? 'bg-error-container text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                      <span className="material-symbols-outlined">{call.muted ? 'mic_off' : 'mic'}</span>
                    </button>
                    {/* Flip Camera */}
                    <button 
                      onClick={onSwitchCamera}
                      disabled={!isVideo || call.cameraOff}
                      className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-all active:scale-90 disabled:opacity-35"
                    >
                      <span className="material-symbols-outlined">flip_camera_ios</span>
                    </button>
                    {/* End Call */}
                    <button 
                      onClick={onEnd}
                      className="w-16 h-16 rounded-full flex items-center justify-center bg-error-container text-white shadow-lg pulse-red hover:brightness-110 transition-all active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>call_end</span>
                    </button>
                    {/* Chat Toggle */}
                    <button 
                      onClick={() => setChatOpen(!chatOpen)}
                      className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-all active:scale-90 relative"
                    >
                      <span className="material-symbols-outlined">chat_bubble</span>
                      <span className="absolute top-2 right-2 w-3 h-3 bg-secondary border-2 border-surface rounded-full"></span>
                    </button>
                    {/* Speaker Output Toggle */}
                    <button 
                      onClick={onToggleSpeaker}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${call.speakerOn ? 'bg-secondary text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                      <span className="material-symbols-outlined">{call.speakerOn ? 'volume_up' : 'volume_down'}</span>
                    </button>
                  </div>
                </nav>

                {/* Hidden Chat Overlay (Slide-up) */}
                <AnimatePresence>
                  {chatOpen && (
                    <motion.div 
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                      className="absolute inset-x-0 bottom-0 z-[60] h-3/4"
                    >
                      <div className="h-full glass-panel rounded-t-[40px] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                        {/* Drag Handle */}
                        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-4 shrink-0"></div>
                        <div className="px-6 pb-4 border-b border-white/5 flex items-center justify-between">
                          <h2 className="font-headline-sm text-headline-sm text-white">Chat</h2>
                          <button className="text-on-surface-variant hover:text-white transition-colors" onClick={() => setChatOpen(false)}>
                            <span className="material-symbols-outlined">keyboard_arrow_down</span>
                          </button>
                        </div>
                        <div className="flex-grow overflow-y-auto p-6 space-y-4">
                          {messages.map((msg, i) => {
                            const mine = msg.sender === currentUserId || msg.sender?._id === currentUserId;
                            return (
                              <div key={msg._id || i} className={`flex ${mine ? 'flex-row-reverse' : ''} items-end gap-3`}>
                                {!mine && (
                                  <div className="w-8 h-8 rounded-full bg-surface-variant shrink-0 overflow-hidden border border-white/10">
                                    <img src={call.peerUser?.avatar} alt="" className="h-full w-full object-cover" />
                                  </div>
                                )}
                                <div className={`max-w-[70%] rounded-2xl p-3 shadow-md ${mine ? 'bg-primary-container rounded-br-none text-white' : 'bg-surface-container-high rounded-bl-none text-white border border-white/5'}`}>
                                  <p className="text-body-sm text-white">{msg.text}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Input Field */}
                        <form 
                          onSubmit={(e) => {
                            e.preventDefault();
                            const textVal = e.target.elements.chatInput.value.trim();
                            if (textVal) {
                              onSendMessage?.(textVal);
                              e.target.elements.chatInput.value = '';
                            }
                          }}
                          className="p-6 pb-10 bg-surface-container-lowest/50"
                        >
                          <div className="relative flex items-center">
                            <input 
                              name="chatInput"
                              className="w-full bg-white/5 border border-white/10 text-white rounded-full py-4 px-6 focus:ring-secondary focus:border-secondary transition-all outline-none" 
                              placeholder="Type a message..." 
                              type="text"
                            />
                            <button type="submit" className="absolute right-2 w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-on-secondary shadow-md active:scale-90 transition-transform">
                              <span className="material-symbols-outlined">send</span>
                            </button>
                          </div>
                        </form>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.section>
          </motion.div>
        )
      )}
    </AnimatePresence>
  );
}

async function setAudioOutput(audioElement, speakerOn, callType) {
  if (!audioElement?.setSinkId) return;
  audioElement.setAttribute('playsinline', 'true');

  try {
    const outputs = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    const audioOutputs = outputs.filter((device) => device.kind === 'audiooutput');
    const speaker = audioOutputs.find((device) => /speaker|loudspeaker/i.test(device.label));
    const earpiece = audioOutputs.find((device) => /earpiece|receiver|phone|communications|headset/i.test(device.label));

    if (speakerOn || callType === 'video') {
      if (speaker?.deviceId) {
        await audioElement.setSinkId(speaker.deviceId);
      } else {
        await audioElement.setSinkId('');
      }
    } else {
      if (earpiece?.deviceId) {
        await audioElement.setSinkId(earpiece.deviceId);
      } else {
        await audioElement.setSinkId('');
      }
    }
  } catch (error) {
    console.warn('setSinkId failed:', error);
  }
}

function CallButton({ label, icon: Icon, onClick, tone = 'neutral', disabled = false, active = false }) {
  const tones = {
    neutral: active ? 'bg-[#7c3aed] text-white shadow-[0_0_12px_rgba(124,58,237,0.4)] border border-[#d2bbff]/20' : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-[#ccc3d8] hover:text-white',
    danger: 'bg-red-500 hover:bg-red-600 border border-red-500/20 text-white',
    mint: 'bg-[#4edea3] text-black font-bold hover:bg-[#3ecb90] border border-[#4edea3]/20 shadow-[0_0_12px_rgba(78,222,163,0.4)]'
  };

  const isIncomingAccept = tone === 'mint';

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.94 }}
      animate={isIncomingAccept ? {
        scale: [1, 1.05, 1],
        boxShadow: ["0px 0px 0px rgba(78, 222, 163, 0)", "0px 0px 12px rgba(78, 222, 163, 0.5)", "0px 0px 0px rgba(78, 222, 163, 0)"]
      } : {}}
      transition={isIncomingAccept ? {
        scale: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
        boxShadow: { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
      } : { duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1 text-[10px] font-semibold disabled:opacity-35 sm:min-h-12 sm:text-[11px] ${tones[tone]} transition-colors`}
    >
      <Icon size={19} />
      <span className="truncate">{label}</span>
    </motion.button>
  );
}

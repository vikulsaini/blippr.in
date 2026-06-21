import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ear, Gauge, Maximize2, Mic, MicOff, Minimize2, Phone, PhoneOff, RotateCw, Signal, SignalLow, Volume2, VolumeX, Video, VideoOff } from 'lucide-react';

export default function CallOverlay({ call, minimized = false, onMinimize, onExpand, onAccept, onReject, onEnd, onToggleMute, onToggleCamera, onSwitchCamera, onToggleSpeaker, onToggleLowDataMode }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteAudioVideoRef = useRef(null);
  const chromeTimerRef = useRef(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [duration, setDuration] = useState(0);

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
                    {/* Blurred background avatar */}
                    <div className="absolute inset-0 opacity-40 blur-2xl scale-110 pointer-events-none">
                      <img src={call.peerUser?.avatar} alt="" className="h-full w-full object-cover" />
                    </div>
                    
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="relative h-28 w-28 mb-6">
                        <span className="absolute inset-0 animate-ping rounded-full bg-[#4edea3]/20" />
                        <img src={call.peerUser?.avatar} alt="" className="relative h-28 w-28 rounded-full bg-[#131b2e] object-cover shadow-[0_0_20px_rgba(78,222,163,0.3)] border border-[#4edea3]/20" />
                      </div>
                      <p className="text-lg font-semibold text-white">{call.peerUser?.name || 'Blippr friend'}</p>
                      <p className="mt-2 text-sm text-[#ccc3d8]/80">
                        {call.status === 'incoming' 
                          ? 'Incoming call...' 
                          : call.status === 'calling' 
                            ? 'Calling...' 
                            : call.status === 'reconnecting' 
                              ? 'Reconnecting...' 
                              : 'Ringing...'}
                      </p>
                    </div>
                  </div>
                )}

                <div className={`absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/80 via-black/20 to-transparent p-2 transition duration-300 sm:p-3 ${chromeClass}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 rounded-[14px] border border-white/10 bg-[#171f33]/80 px-2.5 py-1.5 text-left backdrop-blur-md sm:rounded-2xl sm:px-3">
                      <p className="truncate text-[11px] font-semibold text-white sm:text-sm">{call.peerUser?.name || 'Blippr friend'}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-semibold text-[#ccc3d8]/80 sm:text-[11px]">
                        <span>{title}</span>
                        <span>{routeLabel}</span>
                        <span className={`inline-flex items-center gap-1 ${call.quality === 'poor' ? 'text-red-400' : call.quality === 'reconnecting' ? 'text-white/55' : 'text-[#4edea3]'}`}>
                          <QualityIcon size={12} />
                          {qualityLabel}
                        </span>
                      </div>
                    </div>

                    {/* Premium Call Metrics & Signal Layer */}
                    {call.status === 'connected' && (
                      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#171f33]/80 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-md">
                        <span className="h-2 w-2 rounded-full bg-[#4edea3] shadow-[0_0_8px_#4edea3] animate-pulse" />
                        <span>HD</span>
                        <span className="text-white/30">|</span>
                        <span>{formatCallDuration(duration)}</span>
                      </div>
                    )}

                    <button onClick={onMinimize} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-[#171f33]/80 text-white/82 backdrop-blur-md transition hover:bg-white/10 sm:h-9 sm:w-9" aria-label="Minimize call">
                      <Minimize2 size={16} />
                    </button>
                  </div>
                </div>

                {isVideo && call.localStream && (
                  <motion.div
                    drag
                    dragConstraints={{ left: -300, right: 0, top: 0, bottom: 500 }}
                    dragElastic={0.15}
                    dragMomentum={false}
                    className="absolute right-2 top-16 z-10 h-20 w-16 overflow-hidden rounded-2xl border border-white/20 bg-slate-950 shadow-[0_18px_42px_rgba(0,0,0,0.45)] sm:right-4 sm:top-20 sm:h-28 sm:w-24 cursor-grab active:cursor-grabbing"
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
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold backdrop-blur select-none pointer-events-none">You</span>
                  </motion.div>
                )}

                <div className={`absolute inset-x-0 bottom-0 z-20 grid place-items-center bg-gradient-to-t from-black/60 via-transparent to-black/40 px-2 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] pt-12 transition duration-300 sm:px-3 ${chromeClass}`}>
                  <div className="flex w-full max-w-sm justify-center rounded-[24px] border border-white/10 bg-[#171f33]/85 p-1.5 backdrop-blur-md sm:max-w-3xl sm:rounded-full sm:p-2 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                    {controls}
                  </div>
                </div>
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

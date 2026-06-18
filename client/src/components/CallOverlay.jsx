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
            className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-[22px] border border-white/5 bg-slate-950 p-3 text-white shadow-float"
          >
            <div className="flex items-center gap-3">
              <img src={call.peerUser?.avatar} alt="" className="h-11 w-11 rounded-2xl bg-slate-800 object-cover shadow-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{call.peerUser?.name || 'Blippr friend'}</p>
                <p className="truncate text-xs text-white/45">{title} - {qualityLabel}</p>
              </div>
              {call.status === 'incoming' ? (
                <>
                  <button onClick={onReject} className="grid h-10 w-10 place-items-center rounded-full bg-danger text-white" aria-label="Reject call"><PhoneOff size={17} /></button>
                  <button onClick={onAccept} className="grid h-10 w-10 place-items-center rounded-full bg-success text-white" aria-label="Accept call"><Phone size={17} /></button>
                </>
              ) : (
                <button onClick={onEnd} className="grid h-10 w-10 place-items-center rounded-full bg-danger text-white" aria-label="End call"><PhoneOff size={17} /></button>
              )}
              <button onClick={onExpand} className="btn-icon h-10 w-10" aria-label="Open call"><Maximize2 size={17} /></button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="expanded-call"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-0 z-50 bg-slate-950 text-white"
          >
            <motion.section
              onPointerDown={revealChrome}
              onPointerMove={revealChrome}
              onTouchStart={revealChrome}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative h-dvh overflow-hidden p-1 sm:p-1.5"
            >
              <div className="relative h-full overflow-hidden rounded-[16px] border border-white/5 bg-slate-900 shadow-inner sm:rounded-[20px]">
                {!isVideo && (
                  <>
                    <audio ref={remoteAudioRef} autoPlay playsInline />
                    <video ref={remoteAudioVideoRef} autoPlay playsInline style={{ display: 'none' }} />
                  </>
                )}
                {isVideo && call.remoteStream ? (
                  <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-contain" />
                ) : (
                  <div className="grid h-full place-items-center p-6 text-center">
                    <div>
                      <div className="relative mx-auto h-28 w-28">
                        <span className="absolute inset-0 animate-ping rounded-full bg-success/15" />
                        <img src={call.peerUser?.avatar} alt="" className="relative h-28 w-28 rounded-full bg-slate-800 object-cover shadow-md border border-white/5" />
                      </div>
                      <p className="mt-5 text-base font-semibold">{call.peerUser?.name || 'Blippr friend'}</p>
                      <p className="mt-2 text-sm text-white/52">{call.status === 'reconnecting' ? 'Trying to restore connection...' : call.status === 'connected' ? 'Voice connected' : 'Waiting for answer'}</p>
                    </div>
                  </div>
                )}

                <div className={`absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/76 via-black/24 to-transparent p-2 transition duration-300 sm:p-3 ${chromeClass}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 rounded-[14px] border border-white/10 bg-black/40 px-2.5 py-1.5 text-left backdrop-blur-md sm:rounded-2xl sm:px-3">
                      <p className="truncate text-[11px] font-semibold text-white sm:text-sm">{call.peerUser?.name || 'Blippr friend'}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-semibold text-white/52 sm:text-[11px]">
                        <span>{title}</span>
                        <span>{routeLabel}</span>
                        <span className={`inline-flex items-center gap-1 ${call.quality === 'poor' ? 'text-danger' : call.quality === 'reconnecting' ? 'text-white/55' : 'text-success'}`}>
                          <QualityIcon size={12} />
                          {qualityLabel}
                        </span>
                      </div>
                    </div>
                    <button onClick={onMinimize} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-black/42 text-white/82 backdrop-blur-md transition hover:bg-white/12 sm:h-9 sm:w-9" aria-label="Minimize call">
                      <Minimize2 size={16} />
                    </button>
                  </div>
                </div>

                {isVideo && call.localStream && (
                  <div className="absolute right-2 top-16 z-10 h-20 w-16 overflow-hidden rounded-[14px] border border-white/12 bg-slate-950 shadow-[0_18px_42px_rgba(0,0,0,0.45)] sm:right-4 sm:top-20 sm:h-28 sm:w-24">
                    {call.cameraOff ? (
                      <div className="grid h-full place-items-center text-white/45"><VideoOff size={22} /></div>
                    ) : (
                      <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                    )}
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">You</span>
                  </div>
                )}

                <div className={`absolute inset-x-0 bottom-0 z-20 grid place-items-center bg-gradient-to-t from-black/82 via-black/25 to-transparent px-2 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] pt-12 transition duration-300 sm:px-3 ${chromeClass}`}>
                  <div className="flex w-full max-w-sm justify-center rounded-[24px] border border-white/10 bg-black/40 p-1.5 backdrop-blur-md sm:max-w-3xl sm:rounded-full sm:p-2">
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
    neutral: active ? 'btn-primary' : 'btn-secondary',
    danger: 'bg-danger text-white',
    mint: 'btn-primary'
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1 text-[10px] font-semibold disabled:opacity-35 sm:min-h-12 sm:text-[11px] ${tones[tone]}`}>
      <Icon size={19} />
      <span className="truncate">{label}</span>
    </button>
  );
}

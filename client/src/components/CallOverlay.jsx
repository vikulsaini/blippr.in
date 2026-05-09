import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Gauge, Maximize2, Mic, MicOff, Minimize2, Phone, PhoneOff, RotateCw, Signal, SignalLow, Volume2, VolumeX, Video, VideoOff } from 'lucide-react';

export default function CallOverlay({ call, minimized = false, onMinimize, onExpand, onAccept, onReject, onEnd, onToggleMute, onToggleCamera, onSwitchCamera, onToggleSpeaker, onToggleLowDataMode }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = call?.localStream || null;
  }, [call?.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = call?.remoteStream || null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = call?.remoteStream || null;
    if (remoteAudioRef.current) remoteAudioRef.current.volume = 1;
    setAudioOutput(remoteAudioRef.current, call?.speakerOn, call?.type).catch(() => {});
    remoteAudioRef.current?.play?.().catch(() => {});
    remoteVideoRef.current?.play?.().catch(() => {});
  }, [call?.remoteStream, call?.speakerOn, call?.type]);

  if (!call) return null;

  const isVideo = call.type === 'video';
  const title = call.status === 'incoming' ? 'Incoming call' : call.status === 'calling' ? 'Calling...' : call.status === 'reconnecting' ? 'Reconnecting...' : 'Connected';
  const routeLabel = isVideo ? 'Video speaker' : call.speakerOn ? 'Speaker' : 'Receiver';
  const QualityIcon = call.quality === 'poor' ? SignalLow : Signal;
  const qualityLabel = call.quality === 'reconnecting' ? 'Reconnecting' : call.quality === 'poor' ? 'Poor connection' : call.quality === 'good' ? 'Good connection' : 'Checking connection';

  if (minimized) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-[22px] border border-white/12 bg-ink/92 p-3 text-white shadow-glow backdrop-blur"
      >
        <div className="flex items-center gap-3">
          <img src={call.peerUser?.avatar} alt="" className="h-11 w-11 rounded-2xl bg-white/8 object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{call.peerUser?.name || 'Varta friend'}</p>
            <p className="truncate text-xs text-white/45">{title} - {qualityLabel}</p>
          </div>
          {call.status === 'incoming' ? (
            <>
              <button onClick={onReject} className="grid h-10 w-10 place-items-center rounded-full bg-coral text-ink" aria-label="Reject call"><PhoneOff size={17} /></button>
              <button onClick={onAccept} className="grid h-10 w-10 place-items-center rounded-full bg-mint text-ink" aria-label="Accept call"><Phone size={17} /></button>
            </>
          ) : (
            <button onClick={onEnd} className="grid h-10 w-10 place-items-center rounded-full bg-coral text-ink" aria-label="End call"><PhoneOff size={17} /></button>
          )}
          <button onClick={onExpand} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label="Open call"><Maximize2 size={17} /></button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink text-white">
      <motion.section
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative flex h-dvh flex-col px-4 py-5"
      >
        <div className="text-center">
          <button onClick={onMinimize} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label="Minimize call">
            <Minimize2 size={18} />
          </button>
          <p className="text-sm text-white/50">{title}</p>
          <h2 className="mt-1 text-2xl font-semibold">{call.peerUser?.name || 'Varta friend'}</h2>
          <div className="mt-2 flex items-center justify-center gap-2 text-sm text-white/48">
            <span>{routeLabel}</span>
            <span className="h-1 w-1 rounded-full bg-white/25" />
            <span className={`inline-flex items-center gap-1 ${call.quality === 'poor' ? 'text-coral' : call.quality === 'reconnecting' ? 'text-white/55' : 'text-mint'}`}>
              <QualityIcon size={15} />
              {qualityLabel}
            </span>
          </div>
        </div>

        <div className="relative mt-7 flex flex-1 items-center justify-center overflow-hidden rounded-[24px] border border-white/8 bg-panel">
          <audio ref={remoteAudioRef} autoPlay playsInline />
          {isVideo && call.remoteStream ? (
            <video ref={remoteVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          ) : (
            <div className="grid place-items-center text-center">
              <div className="relative">
                <span className="absolute inset-0 animate-ping rounded-full bg-mint/15" />
                <img src={call.peerUser?.avatar} alt="" className="relative h-28 w-28 rounded-full bg-white/8 object-cover" />
              </div>
              <p className="mt-5 text-sm text-white/52">{call.status === 'reconnecting' ? 'Trying to restore audio...' : call.status === 'connected' ? 'Voice connected' : 'Waiting for answer'}</p>
            </div>
          )}

          {isVideo && call.localStream && (
            <div className="absolute right-3 top-3 h-[8.5rem] w-24 overflow-hidden rounded-[18px] border border-white/12 bg-ink shadow-glow">
              {call.cameraOff ? (
                <div className="grid h-full place-items-center text-white/45"><VideoOff size={22} /></div>
              ) : (
                <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              )}
            </div>
          )}
        </div>

        <div className="safe-bottom mt-6">
          {call.status === 'incoming' ? (
            <div className="grid grid-cols-2 gap-3">
              <CallButton label="Reject" icon={PhoneOff} onClick={onReject} tone="danger" />
              <CallButton label="Accept" icon={Phone} onClick={onAccept} tone="mint" />
            </div>
          ) : (
            <div className={`grid gap-2 ${isVideo ? 'grid-cols-6' : 'grid-cols-5'}`}>
              <CallButton label={call.muted ? 'Unmute' : 'Mute'} icon={call.muted ? MicOff : Mic} onClick={onToggleMute} />
              <CallButton label={isVideo ? 'Speaker' : call.speakerOn ? 'Speaker' : 'Receiver'} icon={call.speakerOn ? Volume2 : VolumeX} onClick={onToggleSpeaker} active={call.speakerOn} />
              <CallButton label={call.cameraOff ? 'Camera' : 'Video'} icon={call.cameraOff ? VideoOff : Video} onClick={onToggleCamera} disabled={!isVideo} />
              {isVideo && <CallButton label="Low data" icon={Gauge} onClick={onToggleLowDataMode} active={call.lowDataMode} />}
              <CallButton label="Switch" icon={RotateCw} onClick={onSwitchCamera} disabled={!isVideo || call.cameraOff} />
              <CallButton label="End" icon={PhoneOff} onClick={onEnd} tone="danger" />
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}

async function setAudioOutput(audioElement, speakerOn, callType) {
  if (!audioElement?.setSinkId || !navigator.mediaDevices?.enumerateDevices) return;
  audioElement.setAttribute('playsinline', 'true');

  const outputs = await navigator.mediaDevices.enumerateDevices();
  const audioOutputs = outputs.filter((device) => device.kind === 'audiooutput');
  const speaker = audioOutputs.find((device) => /speaker|loudspeaker/i.test(device.label));
  const earpiece = audioOutputs.find((device) => /earpiece|receiver|phone|communications|headset/i.test(device.label));

  if (speakerOn || callType === 'video') {
    await audioElement.setSinkId(speaker?.deviceId || 'default');
    return;
  }

  await audioElement.setSinkId(earpiece?.deviceId || 'communications').catch(() => audioElement.setSinkId('default'));
}

function CallButton({ label, icon: Icon, onClick, tone = 'neutral', disabled = false, active = false }) {
  const tones = {
    neutral: active ? 'btn-primary' : 'btn-secondary',
    danger: 'bg-coral text-ink',
    mint: 'btn-primary'
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[18px] text-[11px] font-semibold disabled:opacity-35 ${tones[tone]}`}>
      <Icon size={19} />
      {label}
    </button>
  );
}

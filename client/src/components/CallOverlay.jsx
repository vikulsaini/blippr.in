import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Phone, PhoneOff, RotateCw, Volume2, VolumeX, Video, VideoOff } from 'lucide-react';

export default function CallOverlay({ call, onAccept, onReject, onEnd, onToggleMute, onToggleCamera, onSwitchCamera, onToggleSpeaker }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = call?.localStream || null;
  }, [call?.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = call?.remoteStream || null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = call?.remoteStream || null;
    if (remoteAudioRef.current) remoteAudioRef.current.volume = call?.speakerOn ? 1 : 0.72;
    setAudioOutput(remoteAudioRef.current, call?.speakerOn).catch(() => {});
    remoteAudioRef.current?.play?.().catch(() => {});
    remoteVideoRef.current?.play?.().catch(() => {});
  }, [call?.remoteStream, call?.speakerOn]);

  if (!call) return null;

  const isVideo = call.type === 'video';
  const title = call.status === 'incoming' ? 'Incoming call' : call.status === 'calling' ? 'Calling...' : 'Connected';

  return (
    <div className="fixed inset-0 z-50 bg-ink text-white">
      <motion.section
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative flex h-dvh flex-col px-4 py-5"
      >
        <div className="text-center">
          <p className="text-sm text-white/50">{title}</p>
          <h2 className="mt-1 text-2xl font-semibold">{call.peerUser?.name || 'Varta friend'}</h2>
          <p className="mt-1 text-sm text-white/45">{isVideo ? 'Video call' : 'Voice call'}</p>
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
              <p className="mt-5 text-sm text-white/52">{call.status === 'connected' ? 'Voice connected' : 'Waiting for answer'}</p>
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
            <div className="grid grid-cols-5 gap-2">
              <CallButton label={call.muted ? 'Unmute' : 'Mute'} icon={call.muted ? MicOff : Mic} onClick={onToggleMute} />
              <CallButton label="Speaker" icon={call.speakerOn ? Volume2 : VolumeX} onClick={onToggleSpeaker} active={call.speakerOn} />
              <CallButton label={call.cameraOff ? 'Camera' : 'Video'} icon={call.cameraOff ? VideoOff : Video} onClick={onToggleCamera} disabled={!isVideo} />
              <CallButton label="Switch" icon={RotateCw} onClick={onSwitchCamera} disabled={!isVideo || call.cameraOff} />
              <CallButton label="End" icon={PhoneOff} onClick={onEnd} tone="danger" />
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}

async function setAudioOutput(audioElement, speakerOn) {
  if (!audioElement?.setSinkId || !navigator.mediaDevices?.enumerateDevices) return;

  const outputs = await navigator.mediaDevices.enumerateDevices();
  const speaker = outputs.find((device) => device.kind === 'audiooutput' && /speaker|default/i.test(device.label));
  await audioElement.setSinkId(speakerOn && speaker ? speaker.deviceId : 'default');
}

function CallButton({ label, icon: Icon, onClick, tone = 'neutral', disabled = false, active = false }) {
  const tones = {
    neutral: active ? 'bg-white text-ink' : 'bg-white/8 text-white',
    danger: 'bg-coral text-ink',
    mint: 'bg-mint text-ink'
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[18px] text-[11px] font-semibold disabled:opacity-35 ${tones[tone]}`}>
      <Icon size={19} />
      {label}
    </button>
  );
}

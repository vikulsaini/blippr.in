import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Phone, PhoneOff, RotateCcw, Video, VideoOff } from 'lucide-react';

export default function CallOverlay({ call, onAccept, onReject, onEnd, onToggleMute, onToggleCamera, onSwitchCamera }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = call?.localStream || null;
  }, [call?.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = call?.remoteStream || null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = call?.remoteStream || null;
  }, [call?.remoteStream]);

  if (!call) return null;

  const isVideo = call.type === 'video';
  const title = call.status === 'incoming' ? 'Incoming call' : call.status === 'calling' ? 'Calling...' : 'Connected';

  return (
    <div className="fixed inset-0 z-50 bg-ink text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(94,234,212,0.18),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(251,113,133,0.16),transparent_35%)]" />
      <motion.section
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative flex h-dvh flex-col px-5 py-6"
      >
        <div className="text-center">
          <p className="text-sm text-white/50">{title}</p>
          <h2 className="mt-1 text-3xl font-semibold">{call.peerUser?.name || 'Varta friend'}</h2>
          <p className="mt-1 text-sm text-white/45">{isVideo ? 'Video call' : 'Voice call'}</p>
        </div>

        <div className="relative mt-8 flex flex-1 items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-white/8">
          {!isVideo && <audio ref={remoteAudioRef} autoPlay />}
          {isVideo && call.remoteStream ? (
            <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
          ) : (
            <div className="grid place-items-center text-center">
              <div className="relative">
                <span className="absolute inset-0 animate-ping rounded-[2rem] bg-mint/20" />
                <img src={call.peerUser?.avatar} alt="" className="relative h-32 w-32 rounded-[2rem] bg-white/10 object-cover" />
              </div>
              <p className="mt-5 text-sm text-white/52">{call.status === 'connected' ? 'Voice connected' : 'Waiting for answer'}</p>
            </div>
          )}

          {isVideo && call.localStream && (
            <div className="absolute right-4 top-4 h-36 w-24 overflow-hidden rounded-3xl border border-white/15 bg-ink shadow-glow">
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
            <div className="grid grid-cols-2 gap-4">
              <CallButton label="Reject" icon={PhoneOff} onClick={onReject} tone="danger" />
              <CallButton label="Accept" icon={Phone} onClick={onAccept} tone="mint" />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              <CallButton label={call.muted ? 'Unmute' : 'Mute'} icon={call.muted ? MicOff : Mic} onClick={onToggleMute} />
              <CallButton label={call.cameraOff ? 'Camera' : 'Video'} icon={call.cameraOff ? VideoOff : Video} onClick={onToggleCamera} disabled={!isVideo} />
              <CallButton label="Switch" icon={RotateCcw} onClick={onSwitchCamera} disabled={!isVideo || call.cameraOff} />
              <CallButton label="End" icon={PhoneOff} onClick={onEnd} tone="danger" />
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}

function CallButton({ label, icon: Icon, onClick, tone = 'neutral', disabled = false }) {
  const tones = {
    neutral: 'bg-white/10 text-white',
    danger: 'bg-coral text-ink',
    mint: 'bg-mint text-ink'
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-3xl text-xs font-semibold disabled:opacity-35 ${tones[tone]}`}>
      <Icon size={21} />
      {label}
    </button>
  );
}

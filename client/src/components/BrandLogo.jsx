import { MessageCircle } from 'lucide-react';

export default function BrandLogo({ compact = false, className = '' }) {
  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-2.5'} ${className}`}>
      <span className={`tone-ring relative grid place-items-center border border-cyan-200/20 bg-[linear-gradient(135deg,#ecfeff,#99f6e4_46%,#c4b5fd)] text-ink shadow-[0_14px_34px_rgba(6,182,212,0.18)] ${compact ? 'h-8 w-8 rounded-[14px]' : 'h-10 w-10 rounded-[18px]'}`}>
        <MessageCircle size={compact ? 16 : 19} strokeWidth={2.5} />
        <span className={`absolute rounded-full border-2 border-ink bg-rose ${compact ? '-right-0.5 -top-0.5 h-2.5 w-2.5' : '-right-0.5 -top-0.5 h-3 w-3'}`} />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block bg-gradient-to-r from-white via-cyan-100 to-mint bg-clip-text text-[1.45rem] font-bold tracking-normal text-transparent">Varta</span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300/80">live chat</span>
        </span>
      )}
    </div>
  );
}

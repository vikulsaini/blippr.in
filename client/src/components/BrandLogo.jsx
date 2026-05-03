import { MessageCircle } from 'lucide-react';

export default function BrandLogo({ compact = false, className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="relative grid h-10 w-10 place-items-center rounded-[18px] border border-white/12 bg-white text-ink shadow-[0_12px_32px_rgba(255,255,255,0.18)]">
        <MessageCircle size={19} strokeWidth={2.5} />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-ink bg-mint" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-[1.45rem] font-semibold tracking-normal">Varta</span>
          <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-white/38">live chat</span>
        </span>
      )}
    </div>
  );
}

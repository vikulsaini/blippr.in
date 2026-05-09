import { MessageCircle } from 'lucide-react';

export default function BrandLogo({ compact = false, className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="tone-ring relative grid h-10 w-10 place-items-center rounded-[18px] border border-white/12 bg-[linear-gradient(135deg,#ffffff,#d8fff8_48%,#e8e3ff)] text-ink">
        <MessageCircle size={19} strokeWidth={2.5} />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-ink bg-rose" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block bg-gradient-to-r from-white via-mint to-sky bg-clip-text text-[1.45rem] font-semibold tracking-normal text-transparent">Varta</span>
          <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-white/42">live chat</span>
        </span>
      )}
    </div>
  );
}

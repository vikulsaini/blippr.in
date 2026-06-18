export default function BrandLogo({ compact = false, compactTitle = false, className = '' }) {
  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-2.5'} ${className} group`}>
      <span className={`relative grid place-items-center rounded-2xl bg-surface border border-border-default shadow-card transition-all duration-200 group-hover:shadow-glow group-hover:scale-[1.03] ${compact || compactTitle ? 'h-9 w-9 p-1' : 'h-11 w-11 p-1.5'}`}>
        <svg viewBox="0 0 100 100" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Arch/Roof */}
          <path d="M 32 36 A 22 22 0 0 1 68 36" stroke="url(#logo-grad)" strokeWidth="7.5" strokeLinecap="round" />
          <path d="M 20 48 A 36 36 0 0 1 80 48" stroke="url(#logo-grad)" strokeWidth="7.5" strokeLinecap="round" />
          
          {/* Left Person */}
          <circle cx="41" cy="56" r="7.5" fill="url(#left-grad)" />
          <path d="M 33 80 C 33 70, 45 70, 48 79" fill="url(#left-grad)" />
          
          {/* Right Person */}
          <circle cx="59" cy="56" r="7.5" fill="url(#right-grad)" />
          <path d="M 67 80 C 67 70, 55 70, 52 79" fill="url(#right-grad)" />
          
          {/* Embrace Arm */}
          <path d="M 43 72 Q 50 78, 55 72" stroke="url(#left-grad)" strokeWidth="5.5" strokeLinecap="round" />
          
          <defs>
            <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
            <linearGradient id="left-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
            <linearGradient id="right-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      {!compact && (
        <span className="leading-none">
          <span className={`block font-heading font-bold tracking-tight text-text-primary ${compactTitle ? 'text-[1.1rem]' : 'text-[1.5rem]'}`}>
            blippr<span className="gradient-text">.in</span>
          </span>
          <span className={`mt-0.5 block font-semibold uppercase text-text-muted ${compactTitle ? 'text-[8px] tracking-[0.12em]' : 'text-[10px] tracking-[0.18em]'}`}>
            digital cafe
          </span>
        </span>
      )}
    </div>
  );
}

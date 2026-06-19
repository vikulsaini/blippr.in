export default function BrandLogo({ compact = false, compactTitle = false, className = '' }) {
  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-2.5'} ${className} group`}>
      <span className={`relative overflow-hidden grid place-items-center rounded-2xl bg-surface border border-border-default shadow-card transition-all duration-200 group-hover:shadow-glow group-hover:scale-[1.03] ${compact || compactTitle ? 'h-9 w-9 p-0.5' : 'h-11 w-11 p-1'}`}>
        <img src="/logo.png" alt="Blippr Logo" className="h-full w-full object-cover rounded-xl" />
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

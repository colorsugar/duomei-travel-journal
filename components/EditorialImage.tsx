type EditorialImageProps = {
  background: string;
  label?: string;
  className?: string;
};

export function EditorialImage({
  background,
  label,
  className = ""
}: EditorialImageProps) {
  return (
    <div
      className={`group relative overflow-hidden bg-stone ${className}`}
      style={{ background }}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      <div className="absolute inset-0 animate-image-drift bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.28),transparent_34%),linear-gradient(90deg,rgba(0,0,0,0.28),transparent_58%)] opacity-80 transition duration-[1600ms] ease-editorial group-hover:scale-105" />
      <div className="absolute inset-0 border border-white/20" />
    </div>
  );
}

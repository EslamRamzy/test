/** A placeholder block matching the real layout's shape (docs/architecture/06 §4: "no spinners, no layout shift"). */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}): React.JSX.Element {
  return (
    <span
      className={`d-block placeholder-glow ${className ?? ''}`}
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-sm)',
        ...style,
      }}
      aria-hidden="true"
    >
      <span className="placeholder w-100 h-100 d-block" />
    </span>
  );
}

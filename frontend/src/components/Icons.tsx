/** Icons use the locally hosted Google Material Symbols Outlined font. */
export function Icon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={`material-symbol ${className}`}>
      {name}
    </span>
  );
}
export function Spark({ className = "" }: { className?: string }) {
  return <Icon name="neurology" className={className} />;
}
export function SearchIcon() {
  return <Icon name="search" />;
}
export function GridIcon() {
  return <Icon name="apps" />;
}

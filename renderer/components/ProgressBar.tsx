export default function ProgressBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));

  return (
    <div
      className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
      aria-label="progress"
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-600 to-orange-400"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

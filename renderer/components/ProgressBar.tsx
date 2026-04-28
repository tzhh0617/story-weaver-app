import { Progress } from './ui/progress';

export default function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <Progress
      value={safeValue}
      aria-label="章节进度"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      className="mt-3 h-2.5"
    />
  );
}

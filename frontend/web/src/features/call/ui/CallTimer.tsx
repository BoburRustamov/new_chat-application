import { useState, useEffect, useCallback } from 'react';

interface CallTimerProps {
  startTime: Date | null;
}

export function CallTimer({ startTime }: CallTimerProps) {
  const calculateDuration = useCallback(() => {
    if (!startTime) return 0;
    const now = new Date();
    return Math.floor((now.getTime() - startTime.getTime()) / 1000);
  }, [startTime]);

  const [duration, setDuration] = useState(calculateDuration);

  useEffect(() => {
    if (!startTime) {
      return;
    }

    const interval = setInterval(() => {
      setDuration(calculateDuration());
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, calculateDuration]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <span className="text-sm font-mono text-white/80">
      {formatDuration(duration)}
    </span>
  );
}

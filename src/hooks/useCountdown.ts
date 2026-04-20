import { useEffect, useState } from 'react';

export function useCountdown() {
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    if (value === null) {
      return;
    }

    if (value <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setValue((current) => (current === null ? null : current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [value]);

  return {
    countdown: value,
    startCountdown: (seconds: number) => setValue(seconds),
    clearCountdown: () => setValue(null)
  };
}

interface CountdownOverlayProps {
  value: number | null;
}

export function CountdownOverlay({ value }: CountdownOverlayProps) {
  if (value === null || value <= 0) {
    return null;
  }

  return (
    <div className="countdown-overlay" aria-live="assertive">
      <div className="countdown-number">{value}</div>
    </div>
  );
}

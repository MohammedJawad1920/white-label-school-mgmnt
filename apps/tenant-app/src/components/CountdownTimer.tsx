import React, { useEffect, useRef, useState } from "react";

interface CountdownTimerProps {
  expiresAt: string; // ISO timestamp
  onExpired?: () => void;
}

export function CountdownTimer({ expiresAt, onExpired }: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(
      0,
      Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
    ),
  );
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpiredRef.current?.();
      return;
    }
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          onExpiredRef.current?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft <= 120;
  const isWarning = secondsLeft <= 300;

  return (
    <div
      aria-live={isUrgent ? "assertive" : isWarning ? "polite" : "off"}
      role="timer"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium
        ${isUrgent ? "bg-red-100 text-red-700 font-bold" : isWarning ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-700"}`}
    >
      {isUrgent && <span aria-hidden="true">⚠️</span>}
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}{" "}
      remaining
    </div>
  );
}

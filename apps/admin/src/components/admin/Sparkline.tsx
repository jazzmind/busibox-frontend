/**
 * Small chart primitives shared across dashboard/usage views.
 * Pure SVG, no charting library dependency.
 */

'use client';

import { useState, useEffect, useRef } from 'react';

export function Sparkline({
  data,
  color = '#3b82f6',
  height = 40,
  showArea = true,
}: {
  data: number[];
  color?: string;
  height?: number;
  showArea?: boolean;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4);
    return `${x},${y}`;
  }).join(' ');

  const areaPath = `M0,${height} L${points} L${width},${height} Z`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {showArea && (
        <path
          d={areaPath}
          fill={`${color}20`}
          className="transition-all duration-500"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-500"
      />
      {/* Latest point indicator */}
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / range) * (height - 4)}
        r="3"
        fill={color}
        className="animate-pulse"
      />
    </svg>
  );
}

export function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value === prevValue.current) return;

    const startValue = prevValue.current;
    const endValue = value;
    const duration = 500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      setDisplayValue(Math.round(startValue + (endValue - startValue) * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
    prevValue.current = value;
  }, [value]);

  return <>{prefix}{displayValue.toLocaleString()}{suffix}</>;
}

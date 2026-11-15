import { useEffect, useId, useState } from 'react';

interface ScoreMeterProps {
  score: number | null;
  label?: string;
  size?: number;
  strokeWidth?: number;
  subtitle?: string;
}

const TICK_COUNT = 40;

export default function ScoreMeter({
  score,
  label = 'Entertainment Consistency Score',
  size = 240,
  strokeWidth = 14,
  subtitle,
}: ScoreMeterProps) {
  const isInsufficient = score === null || !Number.isFinite(score);
  const clamped = isInsufficient ? 0 : Math.max(0, Math.min(100, Math.round(score)));
  const [animatedValue, setAnimatedValue] = useState(0);
  const gradientId = useId();
  const glowFilterId = useId();

  useEffect(() => {
    if (isInsufficient) {
      setAnimatedValue(0);
      return;
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setAnimatedValue(clamped);
      return;
    }

    let rafId = 0;
    const duration = 1150;
    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setAnimatedValue(clamped * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setAnimatedValue(clamped);
      }
    };

    setAnimatedValue(0);
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [clamped, isInsufficient]);

  const displayScore = Math.round(animatedValue);
  const center = size / 2;
  const tickOuterRadius = size / 2 - 4;
  const tickInnerRadius = size / 2 - 11;
  const radius = size / 2 - 22 - strokeWidth / 2;
  const innerRingRadius = radius - strokeWidth / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const ratio = isInsufficient ? 0 : Math.max(0, Math.min(1, animatedValue / 100));
  const offset = circumference * (1 - ratio);

  const angleRad = (-90 + ratio * 360) * (Math.PI / 180);
  const tipX = center + radius * Math.cos(angleRad);
  const tipY = center + radius * Math.sin(angleRad);

  const ticks = Array.from({ length: TICK_COUNT }, (_, idx) => {
    const tickRatio = idx / TICK_COUNT;
    const theta = (-90 + tickRatio * 360) * (Math.PI / 180);
    const isActive = !isInsufficient && tickRatio <= ratio && animatedValue > 0;
    const isMajor = idx % 5 === 0;
    const rStart = isMajor ? tickInnerRadius - 2 : tickInnerRadius;
    return {
      x1: center + rStart * Math.cos(theta),
      y1: center + rStart * Math.sin(theta),
      x2: center + tickOuterRadius * Math.cos(theta),
      y2: center + tickOuterRadius * Math.sin(theta),
      isActive,
      isMajor,
    };
  });

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-4 rounded-full blur-xl ${
            isInsufficient
              ? 'bg-[radial-gradient(circle,rgba(245,158,11,0.14)_0%,rgba(148,163,184,0.08)_60%,transparent_100%)]'
              : 'bg-[radial-gradient(circle,rgba(34,211,238,0.18)_0%,rgba(59,130,246,0.12)_45%,rgba(139,92,246,0.08)_75%,transparent_100%)]'
          }`}
        />

        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="relative z-10"
          role="img"
          aria-label={
            isInsufficient
              ? `${label}: Insufficient evidence to generate a score`
              : `${label}: ${clamped} out of 100`
          }
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="50%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#A855F7" />
            </linearGradient>
            <filter id={glowFilterId} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {ticks.map((t, idx) => (
            <line
              key={idx}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={
                isInsufficient
                  ? 'rgba(251, 191, 36, 0.28)'
                  : t.isActive
                  ? '#22D3EE'
                  : 'rgba(148, 163, 184, 0.2)'
              }
              strokeWidth={t.isMajor ? 1.8 : 1}
              strokeLinecap="round"
              opacity={t.isActive ? 0.9 : 0.45}
            />
          ))}

          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={isInsufficient ? 'rgba(251, 191, 36, 0.22)' : 'rgba(148, 163, 184, 0.14)'}
            strokeWidth={strokeWidth}
            strokeDasharray={isInsufficient ? '6 8' : undefined}
          />

          {innerRingRadius > 20 && (
            <circle
              cx={center}
              cy={center}
              r={innerRingRadius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={1}
              strokeDasharray="3 5"
            />
          )}

          {!isInsufficient && (
            <g transform={`rotate(-90 ${center} ${center})`}>
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                filter={`url(#${glowFilterId})`}
              />
            </g>
          )}

          {!isInsufficient && animatedValue > 1 && (
            <circle
              cx={tipX}
              cy={tipY}
              r={strokeWidth * 0.34}
              fill="#F8FAFC"
              filter={`url(#${glowFilterId})`}
            />
          )}
        </svg>

        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-4">
          <span
            className={`font-mono text-[11px] font-medium tracking-wider uppercase ${
              isInsufficient ? 'text-amber-300/90' : 'text-cyan-300/90'
            }`}
          >
            {isInsufficient ? 'Unscored' : 'Index'}
          </span>
          <div className="mt-0.5 font-mono text-5xl leading-none font-semibold tracking-tight text-white tabular-nums sm:text-[54px]">
            {isInsufficient ? '—' : displayScore}
          </div>
          <div className="mt-1.5 font-mono text-xs text-slate-400 tabular-nums">
            {isInsufficient ? 'Need more context' : '/ 100'}
          </div>
        </div>
      </div>

      <p
        className={`mt-4 text-sm font-semibold ${
          isInsufficient ? 'text-amber-300' : 'text-cyan-300'
        }`}
      >
        {label}
      </p>
      {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}

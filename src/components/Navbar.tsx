import { useState } from 'react';
import { Menu, Volume2, VolumeX, X } from 'lucide-react';
import type { AppView } from '../types';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenQuestionChallenge: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'text-test', label: 'Text Test' },
  { id: 'question-challenge', label: 'Question Challenge' },
  { id: 'challenge-friend', label: 'Challenge a Friend' },
];

export default function Navbar({
  currentView,
  onNavigate,
  onOpenQuestionChallenge,
  soundEnabled,
  onToggleSound,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSelect = (view: AppView) => {
    setMobileOpen(false);
    onNavigate(view);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050814]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleSelect('home')}
          className="flex shrink-0 items-center gap-2.5 text-left whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <defs>
              <linearGradient id="tc-brand-grad" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3B82F6" />
                <stop offset="0.5" stopColor="#22D3EE" />
                <stop offset="1" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="24" height="24" rx="7" stroke="url(#tc-brand-grad)" strokeWidth="2" />
            <path
              d="M7.5 14.5H10.5L12.5 9.5L15.5 18.5L17.5 13.5H20.5"
              stroke="url(#tc-brand-grad)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            TruthCheck AI
          </span>
        </button>

        {/* Zone 2: Concise Single-Line Navigation Links */}
        <nav aria-label="Primary navigation" className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => {
            const isActive =
              currentView === item.id ||
              ((currentView === 'results' || currentView === 'offline-results') &&
                item.id === 'question-challenge');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-400 ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute right-0 -bottom-1 left-0 h-0.5 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-purple-500"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Sound Toggle & Primary Action */}
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
            aria-pressed={!soundEnabled}
            title={soundEnabled ? 'Sound effects: On' : 'Sound effects: Muted'}
            className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
              soundEnabled
                ? 'border-white/15 bg-white/[0.04] text-cyan-300 hover:border-cyan-400/40 hover:text-cyan-200'
                : 'border-white/10 bg-transparent text-slate-400 hover:border-white/20 hover:text-slate-200'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <VolumeX className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="hidden lg:inline">{soundEnabled ? 'Sound On' : 'Muted'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onOpenQuestionChallenge();
            }}
            className="hidden rounded-lg bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap shrink-0 shadow-[0_0_20px_rgba(34,211,238,0.22)] transition-transform duration-150 hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 sm:inline-flex"
          >
            5-Question Challenge
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-200 hover:bg-white/5 md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#070C1D] px-4 py-3 md:hidden">
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                currentView === item.id ||
                ((currentView === 'results' || currentView === 'offline-results') &&
                  item.id === 'question-challenge');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`flex min-h-[44px] items-center rounded-lg px-3 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={onToggleSound}
              aria-pressed={!soundEnabled}
              className="mt-1 flex min-h-[44px] items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 text-left text-sm font-medium text-slate-200 hover:bg-white/5"
            >
              <span>Sound Effects</span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${soundEnabled ? 'text-cyan-300' : 'text-slate-400'}`}>
                {soundEnabled ? (
                  <>
                    <Volume2 className="h-4 w-4" aria-hidden="true" />
                    <span>On</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-4 w-4" aria-hidden="true" />
                    <span>Muted</span>
                  </>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenQuestionChallenge();
              }}
              className="mt-2 flex min-h-[44px] items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-4 text-sm font-semibold text-white"
            >
              Open 5-Question Challenge
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";

type Mode = "focus" | "shortBreak" | "longBreak";
type Theme = "dark" | "light";

type HistoryEntry = {
  date: string; // YYYY-MM-DD
  count: number;
};

const MODES: Record<
  Mode,
  { minutes: number; label: string; subtitle: string }
> = {
  focus: {
    minutes: 25,
    label: "Focus",
    subtitle: "Deep work with no distractions.",
  },
  shortBreak: {
    minutes: 5,
    label: "Short break",
    subtitle: "Breathe, stretch, refill your water.",
  },
  longBreak: {
    minutes: 15,
    label: "Long break",
    subtitle: "Step away for a bit and reset.",
  },
};

const ACCENTS: Record<
  Mode,
  {
    badgeBorder: string;
    badgeBg: string;
    badgeText: string;
    dotBg: string;
    highlightText: string;
    buttonBg: string;
    buttonHover: string;
    buttonShadow: string;
    ringColor: string; // used in conic gradient
  }
> = {
  focus: {
    badgeBorder: "border-amber-500/30",
    badgeBg: "bg-amber-500/10",
    badgeText: "text-amber-300",
    dotBg: "bg-amber-400",
    highlightText: "text-amber-300",
    buttonBg: "bg-amber-400",
    buttonHover: "hover:bg-amber-300",
    buttonShadow: "shadow-[0_10px_30px_rgba(251,191,36,0.35)]",
    ringColor: "rgb(251 191 36)", // amber-400
  },
  shortBreak: {
    badgeBorder: "border-teal-400/30",
    badgeBg: "bg-teal-400/10",
    badgeText: "text-teal-200",
    dotBg: "bg-teal-300",
    highlightText: "text-teal-200",
    buttonBg: "bg-teal-400",
    buttonHover: "hover:bg-teal-300",
    buttonShadow: "shadow-[0_10px_30px_rgba(45,212,191,0.35)]",
    ringColor: "rgb(45 212 191)", // teal-400
  },
  longBreak: {
    badgeBorder: "border-indigo-400/30",
    badgeBg: "bg-indigo-400/10",
    badgeText: "text-indigo-200",
    dotBg: "bg-indigo-300",
    highlightText: "text-indigo-200",
    buttonBg: "bg-indigo-400",
    buttonHover: "hover:bg-indigo-300",
    buttonShadow: "shadow-[0_10px_30px_rgba(129,140,248,0.35)]",
    ringColor: "rgb(129 140 248)", // indigo-400
  },
};

const DAILY_GOAL = 4;
const HISTORY_KEY = "ttf_history";
const THEME_KEY = "ttf_theme";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function todayString() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Tiny "ding" using Web Audio API (no external file needed)
function playDing() {
  try {
    const AudioContextClass =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880; // A5

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    gainNode.gain.setValueAtTime(0.0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    oscillator.start(now);
    oscillator.stop(now + 0.45);
  } catch {
    // ignore if audio not supported
  }
}

function getLast7Days(history: HistoryEntry[]) {
  const days: { date: string; label: string; count: number }[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const weekday = "SMTWTFS"[d.getDay()];
    const entry = history.find((h) => h.date === dateStr);
    days.push({
      date: dateStr,
      label: weekday,
      count: entry?.count ?? 0,
    });
  }

  return days;
}

export default function App() {
  const [mode, setMode] = useState<Mode>("focus");
  const [theme, setTheme] = useState<Theme>("dark");

  const isDark = theme === "dark";
  const currentMode = MODES[mode];
  const accent = ACCENTS[mode];

  const [secondsLeft, setSecondsLeft] = useState(currentMode.minutes * 60);
  const [isRunning, setIsRunning] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sessionCount, setSessionCount] = useState(0);

  // Load theme from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") {
        setTheme(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Load history (and migrate old single-day storage if present)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed
            .filter(
              (item: any) =>
                item &&
                typeof item.date === "string" &&
                typeof item.count === "number"
            )
            .map((item: any) => ({
              date: item.date,
              count: item.count,
            }));
          setHistory(valid);
          return;
        } else if (parsed && typeof parsed.date === "string") {
          setHistory([
            {
              date: parsed.date,
              count:
                typeof parsed.count === "number" ? parsed.count : 0,
            },
          ]);
          return;
        }
      }

      // Legacy migration from older "ttf_sessions" {date, count}
      const legacyRaw = localStorage.getItem("ttf_sessions");
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw) as {
          date?: string;
          count?: number;
        };
        if (legacy?.date) {
          setHistory([
            {
              date: legacy.date,
              count: legacy.count ?? 0,
            },
          ]);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Persist history and update today's sessionCount whenever history changes
  useEffect(() => {
    try {
      if (history.length > 0) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      }
    } catch {
      // ignore
    }

    const today = todayString();
    const todayEntry = history.find((h) => h.date === today);
    setSessionCount(todayEntry?.count ?? 0);
  }, [history]);

  // Helper to increment today's focus session count and update history
  const incrementFocusSession = useCallback(() => {
    const today = todayString();
    setHistory((prev) => {
      let next = [...prev];
      const idx = next.findIndex((h) => h.date === today);
      if (idx === -1) {
        next.push({ date: today, count: 1 });
      } else {
        next[idx] = { ...next[idx], count: next[idx].count + 1 };
      }

      // Sort by date and keep only the last ~14 days
      next.sort((a, b) => a.date.localeCompare(b.date));
      if (next.length > 14) {
        next = next.slice(next.length - 14);
      }

      return next;
    });
  }, []);

  // Reset timer whenever mode changes
  useEffect(() => {
    setSecondsLeft(currentMode.minutes * 60);
    setIsRunning(false);
  }, [mode, currentMode.minutes]);

  // Countdown logic (and increment session history when a FOCUS session finishes)
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (mode === "focus") {
            incrementFocusSession();
          }
          playDing();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, mode, incrementFocusSession]);

  const totalSeconds = currentMode.minutes * 60;
  const progress = Math.min(1, 1 - secondsLeft / totalSeconds || 0);

  const last7Days = getLast7Days(history);
  const maxCount = last7Days.reduce(
    (max, d) => (d.count > max ? d.count : max),
    1
  );
  const goalProgress = Math.min(1, sessionCount / DAILY_GOAL);

  const handleStartPause = useCallback(() => {
    if (secondsLeft === 0) {
      setSecondsLeft(totalSeconds);
    }
    setIsRunning((prev) => !prev);
  }, [secondsLeft, totalSeconds]);

  const handleReset = useCallback(() => {
    setSecondsLeft(totalSeconds);
    setIsRunning(false);
  }, [totalSeconds]);

  // Keyboard shortcuts: Space = start/pause, R = reset
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;

      if (key === " " || key === "Spacebar") {
        event.preventDefault();
        handleStartPause();
      } else if (key === "r" || key === "R") {
        event.preventDefault();
        handleReset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleStartPause, handleReset]);

  const statusLabel = isRunning
    ? "In progress"
    : secondsLeft === 0
    ? "Completed"
    : "Idle";

  const rootClasses = `min-h-screen flex items-center justify-center px-4 ${
    isDark
      ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100"
      : "bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 text-slate-900"
  }`;

  const shellClasses = `w-full max-w-5xl rounded-3xl border backdrop-blur-md grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] ${
    isDark
      ? "border-slate-800 bg-slate-950/70 shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
      : "border-slate-200 bg-white/80 shadow-[0_18px_60px_rgba(15,23,42,0.12)]"
  }`;

  const panelBorderClasses = isDark
    ? "border-slate-800"
    : "border-slate-200";

  const cardClasses = `rounded-2xl border p-3 space-y-1.5 ${
    isDark
      ? "border-slate-800 bg-slate-900/60"
      : "border-slate-200 bg-slate-50"
  }`;

  const outerRingClasses = `absolute inset-0 rounded-full border shadow-inner ${
    isDark
      ? "border-slate-800 bg-slate-900/70"
      : "border-slate-200 bg-slate-50"
  }`;

  const innerCircleClasses = `absolute inset-[18%] rounded-full border flex flex-col items-center justify-center text-center px-4 ${
    isDark ? "bg-slate-950/90 border-slate-800" : "bg-white border-slate-200"
  }`;

  const historyBarBg = isDark ? "bg-slate-700" : "bg-slate-300";
  const historyFillBg = isDark ? "bg-slate-100" : "bg-slate-900";

  return (
    <div className={rootClasses}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={shellClasses}
      >
        {/* LEFT – Brand / copy / mode selector */}
        <section
          className={`border-b md:border-b-0 md:border-r ${panelBorderClasses} p-6 sm:p-8 flex flex-col justify-between gap-8`}
        >
          <div className="space-y-6">
            {/* badge + title + theme toggle */}
            <div className="space-y-3">
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] ${accent.badgeBorder} ${accent.badgeBg} ${accent.badgeText}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${accent.dotBg}`} />
                {currentMode.label} mode
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                    TickTick
                    <span className={accent.highlightText}>Focus</span>
                  </h1>
                  <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                    A calm, minimal pomodoro-style timer for deep work. Choose
                    your mode and stay present with one task at a time.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
                  }
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium border transition-colors ${
                    isDark
                      ? "border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="mr-1.5">
                    {isDark ? "🌞" : "🌙"}
                  </span>
                  {isDark ? "Light mode" : "Dark mode"}
                </button>
              </div>
            </div>

            {/* mode selector buttons */}
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MODES) as Mode[]).map((m) => {
                const active = m === mode;
                const config = MODES[m];
                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm border transition-colors ${
                      active
                        ? "border-slate-100 bg-slate-100 text-slate-950"
                        : isDark
                        ? "border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {config.label} • {config.minutes}m
                  </button>
                );
              })}
            </div>

            {/* stats cards */}
            <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className={cardClasses}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Session length
                </p>
                <p className={`text-lg font-semibold ${accent.highlightText}`}>
                  {currentMode.minutes} min
                </p>
                <p className="text-[11px] text-slate-500">
                  {currentMode.subtitle}
                </p>
              </div>
              <div className={cardClasses}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Status
                </p>
                <p className="text-lg font-semibold">{statusLabel}</p>
                <p className="text-[11px] text-slate-500">
                  Press start to begin this{" "}
                  {currentMode.label.toLowerCase()}.
                </p>
              </div>
            </div>

            {/* Today's focus progress */}
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Today&apos;s focus</span>
                  <span className="font-medium text-slate-300">
                    {sessionCount} / {DAILY_GOAL} sessions
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800/60 overflow-hidden">
                  <div
                    className="h-full bg-slate-100"
                    style={{ width: `${goalProgress * 100}%` }}
                  />
                </div>
              </div>

              {/* Last 7 days mini history */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Last 7 days</span>
                </div>
                <div className="flex items-end gap-2">
                  {last7Days.map((day) => {
                    const height =
                      day.count === 0
                        ? 4
                        : (day.count / maxCount) * 40 + 6; // 6–46px
                    return (
                      <div
                        key={day.date}
                        className="flex flex-col items-center gap-1"
                      >
                        <div
                          className={`w-2 sm:w-3 rounded-full ${historyBarBg}`}
                          style={{ height: 46 }}
                        >
                          <div
                            className={`w-full rounded-full ${
                              day.count > 0 ? historyFillBg : "bg-transparent"
                            }`}
                            style={{ height }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {day.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Tip: Try 4× focus sessions with short breaks, then a long break.
          </p>
        </section>

        {/* RIGHT – Timer */}
        <section
          className={`p-6 sm:p-8 flex flex-col items-center justify-center gap-6 sm:gap-8 ${panelBorderClasses}`}
        >
          {/* Circular timer */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 180, damping: 18 }}
            className="relative flex items-center justify-center"
          >
            <div className="relative h-56 w-56 sm:h-64 sm:w-64">
              {/* Outer ring */}
              <div className={outerRingClasses} />

              {/* Progress arc */}
              <div
                className="absolute inset-3 rounded-full"
                style={{
                  background: `conic-gradient(
                    ${accent.ringColor} ${progress * 360}deg,
                    ${isDark ? "rgba(15,23,42,0.96)" : "rgba(248,250,252,0.96)"} ${
                    progress * 360
                  }deg
                  )`,
                }}
              />

              {/* Inner circle */}
              <div className={innerCircleClasses}>
                <motion.div
                  key={secondsLeft + mode} // re-animate when mode changes too
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="font-mono text-4xl sm:text-5xl font-semibold tabular-nums tracking-tight"
                >
                  {formatTime(secondsLeft)}
                </motion.div>
                <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-slate-500">
                  {currentMode.label.toLowerCase()}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Controls + shortcut hint */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleStartPause}
                className={`px-6 py-2.5 rounded-full text-sm font-medium text-slate-950 transition-colors ${accent.buttonBg} ${accent.buttonHover} ${accent.buttonShadow}`}
              >
                {isRunning
                  ? "Pause"
                  : secondsLeft === 0
                  ? "Restart session"
                  : "Start"}
              </button>
            <button
              onClick={handleReset}
              className={`px-5 py-2 rounded-full text-xs font-medium border transition-colors ${
                isDark
                  ? "border-slate-700 text-slate-200 hover:bg-slate-900"
                  : "border-slate-300 text-slate-700 hover:bg-slate-100"
              }`}
            >
              Reset
            </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Space = start / pause · R = reset
            </p>
          </div>

          <div className="flex w-full justify-between text-[11px] text-slate-500 max-w-xs">
            <span>0:00</span>
            <span>{currentMode.minutes}:00</span>
          </div>
        </section>
      </motion.div>
    </div>
  );
}

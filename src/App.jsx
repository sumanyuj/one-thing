import { useEffect, useId, useMemo, useRef, useState } from "react";

const MAX_TITLE_LENGTH = 80;
const MAX_LOCATION_LENGTH = 80;
const MAX_DURATION_INPUT_LENGTH = 32;
const MAX_TIMER_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_EXTEND_MINUTES = 8 * 60; // 8h

const steps = [
  {
    key: "title",
    label: "Title",
    placeholder: "Type your one thing",
    hint: "Press Enter to continue",
  },
  {
    key: "location",
    label: "Location",
    placeholder: "Where will you do it?",
    hint: "Studio, cafe, room, city...",
  },
  {
    key: "duration",
    label: "Duration",
    placeholder: "e.g. 45 minutes or 1h 15m",
    hint: "Examples: 30m, 1h, 1h 30m",
  },
];

function sanitizeUserText(input, maxLength) {
  return input
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function parseDurationToMs(input) {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":").map(Number);
    const minutes = h * 60 + m;
    return minutes > 0 ? minutes * 60 * 1000 : null;
  }

  let totalMinutes = 0;
  let matched = false;
  const regex = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|m)/g;
  let result;
  while ((result = regex.exec(raw)) !== null) {
    matched = true;
    const quantity = parseFloat(result[1]);
    const unit = result[2];
    if (unit.startsWith("h")) {
      totalMinutes += quantity * 60;
    } else {
      totalMinutes += quantity;
    }
  }

  if (!matched && /^\d+(?:\.\d+)?$/.test(raw)) {
    totalMinutes = parseFloat(raw);
  }

  if (totalMinutes <= 0) return null;
  const ms = Math.round(totalMinutes * 60 * 1000);
  if (ms > MAX_TIMER_DURATION_MS) return null;
  return ms;
}

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (v) => v.toString().padStart(2, "0");
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function humanizeDuration(ms) {
  const totalMinutes = Math.round(ms / 60000);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return parts.length ? parts.join(" ") : `${totalMinutes}m`;
}

export default function App() {
  const [view, setView] = useState("capture"); // capture | timer
  const [stepIndex, setStepIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const [promptLive, setPromptLive] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

  const [task, setTask] = useState({ title: "", location: "", durationMs: 0 });
  const [timerDuration, setTimerDuration] = useState(0);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState("5");
  const [animateHourglass, setAnimateHourglass] = useState(false);

  const inputRef = useRef(null);
  const intervalRef = useRef(null);
  const endTimeRef = useRef(null);
  const rafRef = useRef(null);
  const flipTimeoutRef = useRef(null);

  const baseId = useId().replace(/:/g, "");
  const hourglassClipId = `hg-clip-${baseId}`;
  const sandGradientId = `hg-sand-${baseId}`;
  const glassGradientId = `hg-glass-${baseId}`;
  const streamGradientId = `hg-stream-${baseId}`;
  const glassPath =
    "M64 26 Q100 16 136 26 C138 64 126 96 108 130 C126 164 138 196 136 234 Q100 244 64 234 C62 196 74 164 92 130 C74 96 62 64 64 26 Z";

  const currentStep = steps[stepIndex];

  useEffect(() => {
    if (view !== "capture") return undefined;
    setPromptLive(false);
    const id = window.setTimeout(() => setPromptLive(true), 1000);
    return () => window.clearTimeout(id);
  }, [view]);

  useEffect(() => {
    if (view === "capture" && promptLive && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [view, promptLive, stepIndex]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (flipTimeoutRef.current) {
        clearTimeout(flipTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!timerRunning) return undefined;

    const tick = () => {
      const remaining = Math.max(0, endTimeRef.current - Date.now());
      setTimerRemaining(remaining);
      if (remaining <= 0) {
        setTimerRunning(false);
        setShowCompletion(true);
      }
    };

    tick();
    intervalRef.current = window.setInterval(tick, 300);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timerRunning]);

  useEffect(() => {
    if (!timerRunning) return undefined;
    setAnimateHourglass(false);
    rafRef.current = requestAnimationFrame(() => setAnimateHourglass(true));
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [timerDuration, timerRunning]);

  const timerMeta = useMemo(() => {
    const durationLabel = humanizeDuration(timerDuration);
    return [task.location, durationLabel].filter(Boolean).join(" • ");
  }, [task.location, timerDuration]);

  function triggerFlip() {
    if (flipTimeoutRef.current) {
      clearTimeout(flipTimeoutRef.current);
      flipTimeoutRef.current = null;
    }
    setIsFlipping(true);
    flipTimeoutRef.current = window.setTimeout(() => {
      setIsFlipping(false);
      flipTimeoutRef.current = null;
    }, 700);
  }

  function restartTimer(durationMs) {
    if (!durationMs) return;
    triggerFlip();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    endTimeRef.current = Date.now() + durationMs;
    setTimerDuration(durationMs);
    setTimerRemaining(durationMs);
    setTimerRunning(true);
    setShowCompletion(false);
    setShowExtend(false);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const step = steps[stepIndex];
    const maxLen =
      step.key === "duration"
        ? MAX_DURATION_INPUT_LENGTH
        : step.key === "title"
          ? MAX_TITLE_LENGTH
          : MAX_LOCATION_LENGTH;
    const value = sanitizeUserText(inputValue, maxLen);
    if (!value) {
      setError("Please add something first.");
      return;
    }
    setError("");

    if (step.key === "duration") {
      const parsedMs = parseDurationToMs(value);
      if (!parsedMs) {
        setError("Try 30m, 1h, 1h 30m, or 90 minutes (max 24h).");
        return;
      }
      const nextTask = { ...task, durationMs: parsedMs };
      setTask(nextTask);
      setView("timer");
      restartTimer(parsedMs);
    } else {
      setTask((prev) => ({ ...prev, [step.key]: value }));
      setStepIndex((prev) => prev + 1);
      setInputValue("");
    }
  }

  function handleFinish() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    if (flipTimeoutRef.current) {
      clearTimeout(flipTimeoutRef.current);
      flipTimeoutRef.current = null;
    }
    endTimeRef.current = null;
    setView("capture");
    setStepIndex(0);
    setInputValue("");
    setError("");
    setTask({ title: "", location: "", durationMs: 0 });
    setTimerDuration(0);
    setTimerRemaining(0);
    setTimerRunning(false);
    setAnimateHourglass(false);
    setShowCompletion(false);
    setShowExtend(false);
    setExtendMinutes("5");
    setIsFlipping(false);
  }

  function handleExtendClick() {
    setShowExtend(true);
    setExtendMinutes("5");
  }

  function handleConfirmExtend() {
    const minutes = Number(extendMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setExtendMinutes("5");
      return;
    }
    if (minutes > MAX_EXTEND_MINUTES) {
      setExtendMinutes(String(MAX_EXTEND_MINUTES));
      return;
    }
    const durationMs = minutes * 60 * 1000;
    setTask((prev) => ({ ...prev, durationMs }));
    restartTimer(durationMs);
  }

  const remainingLabel = formatRemaining(timerRemaining);
  const hourglassClass = [
    "hourglass",
    animateHourglass ? "is-animating" : "",
    timerRunning ? "is-running" : "",
    isFlipping ? "is-flipping" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="app">
      <div className="backdrop">
        <div className="backdrop__glow" />
        <div className="backdrop__grain" />
      </div>

      {view === "capture" ? (
        <section className="screen">
          <div className="hero">
            <h1 className="hero__question">What is your One Thing?</h1>
            <form className={`prompt ${promptLive ? "is-live" : ""}`} onSubmit={handleSubmit}>
              <p className="prompt__label">{currentStep.label}</p>
              <div className="prompt__field">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  placeholder={currentStep.placeholder}
                  maxLength={
                    currentStep.key === "duration"
                      ? MAX_DURATION_INPUT_LENGTH
                      : currentStep.key === "title"
                        ? MAX_TITLE_LENGTH
                        : MAX_LOCATION_LENGTH
                  }
                  autoComplete="off"
                  spellCheck={currentStep.key !== "duration"}
                  onChange={(event) => setInputValue(event.target.value)}
                />
                <span className="prompt__caret" aria-hidden="true">
                  _
                </span>
              </div>
              <p className="prompt__hint">{currentStep.hint}</p>
              <p className="prompt__error" role="alert">
                {error}
              </p>
            </form>
          </div>
        </section>
      ) : (
        <section className="screen screen--timer">
          <div className="timer-card">
            <div className="timer-card__header">
              <p className="badge">Up next</p>
              <p className="timer-card__task">{task.title}</p>
              <p className="timer-card__meta">{timerMeta}</p>
            </div>
            <div className="timer-card__body">
              <div
                className={hourglassClass}
                style={{ "--timer-duration": `${Math.max(timerDuration, 1)}ms` }}
              >
                <svg
                  className="hourglass__svg"
                  viewBox="0 0 200 260"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id={sandGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fde9a0" />
                      <stop offset="45%" stopColor="#f3d77a" />
                      <stop offset="100%" stopColor="#e7b94f" />
                    </linearGradient>
                    <linearGradient id={glassGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
                      <stop offset="45%" stopColor="#ffffff" stopOpacity="0.05" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0.12" />
                    </linearGradient>
                    <linearGradient id={streamGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fde9a0" stopOpacity="0.95" />
                      <stop offset="70%" stopColor="#f3d77a" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#f3d77a" stopOpacity="0.1" />
                    </linearGradient>
                    <clipPath id={hourglassClipId}>
                      <path d={glassPath} />
                    </clipPath>
                  </defs>

                  <g clipPath={`url(#${hourglassClipId})`}>
                    <rect
                      className="hourglass__sand-fill hourglass__sand-fill--top"
                      x="0"
                      y="0"
                      width="200"
                      height="130"
                      fill={`url(#${sandGradientId})`}
                    />
                    <rect
                      className="hourglass__stream"
                      x="98"
                      y="124"
                      width="4"
                      height="110"
                      rx="2"
                      fill={`url(#${streamGradientId})`}
                    />
                    <circle className="hourglass__grain hourglass__grain--a" cx="100" cy="126" r="1.65" />
                    <circle className="hourglass__grain hourglass__grain--b" cx="100" cy="126" r="1.15" />
                    <circle className="hourglass__grain hourglass__grain--c" cx="100" cy="126" r="1.35" />
                    <circle className="hourglass__grain hourglass__grain--d" cx="100" cy="126" r="1.05" />
                    <rect
                      className="hourglass__sand-fill hourglass__sand-fill--bottom"
                      x="0"
                      y="130"
                      width="200"
                      height="130"
                      fill={`url(#${sandGradientId})`}
                    />
                  </g>

                  <rect className="hourglass__cap hourglass__cap--top" x="52" y="14" width="96" height="18" rx="9" />
                  <rect
                    className="hourglass__cap hourglass__cap--bottom"
                    x="52"
                    y="228"
                    width="96"
                    height="18"
                    rx="9"
                  />
                  <path className="hourglass__glass" d={glassPath} fill={`url(#${glassGradientId})`} />
                  <path className="hourglass__outline" d={glassPath} />
                  <path className="hourglass__highlight" d="M78 36 C74 78 92 112 98 130 C92 148 74 182 78 224" />
                  <path className="hourglass__highlight" d="M122 36 C126 78 108 112 102 130 C108 148 126 182 122 224" />
                </svg>
              </div>
              <div className="timer-readout">
                <p className="timer-readout__label">Time remaining</p>
                <p className="timer-readout__value">{remainingLabel}</p>
              </div>
            </div>
            <div className="timer-card__footer">
              {showCompletion ? (
                <>
                  <p className="timer-card__question">Did you finish your One Thing?</p>
                  <div className="actions">
                    <button type="button" className="btn" onClick={handleFinish}>
                      Finished
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={handleExtendClick}>
                      Not yet, extend
                    </button>
                  </div>
                  {showExtend ? (
                    <div className="extend">
                      <label htmlFor="extend-input">Add more time (minutes)</label>
                      <div className="extend__row">
                        <input
                          id="extend-input"
                          type="number"
                          min="1"
                          max={MAX_EXTEND_MINUTES}
                          value={extendMinutes}
                          onChange={(event) => setExtendMinutes(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleConfirmExtend();
                            }
                          }}
                        />
                        <button type="button" className="btn btn--ghost" onClick={handleConfirmExtend}>
                          Extend timer
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="timer-card__question">Stay with it until the sand runs out.</p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

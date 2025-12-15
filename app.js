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

const promptForm = document.getElementById("prompt-form");
const promptLabel = document.getElementById("prompt-label");
const promptInput = document.getElementById("prompt-input");
const promptHint = document.getElementById("prompt-hint");
const promptError = document.getElementById("prompt-error");
const captureScreen = document.getElementById("capture-screen");
const timerScreen = document.getElementById("timer-screen");
const taskSummary = document.getElementById("task-summary");
const taskMeta = document.getElementById("task-meta");
const timeRemainingEl = document.getElementById("time-remaining");
const completionPanel = document.getElementById("completion-panel");
const extendButton = document.getElementById("extend-button");
const finishButton = document.getElementById("finish-button");
const extendControls = document.getElementById("extend-controls");
const extendInput = document.getElementById("extend-input");
const confirmExtend = document.getElementById("confirm-extend");
const hourglassEl = document.getElementById("hourglass");

let stepIndex = 0;
let task = { title: "", location: "", durationMs: 0 };
let countdownId = null;
let endTime = null;

function showStep(index) {
  const step = steps[index];
  promptForm.classList.add("is-live");
  promptLabel.textContent = step.label;
  promptInput.placeholder = step.placeholder;
  promptHint.textContent = step.hint;
  promptError.textContent = "";
  promptInput.value = "";

  requestAnimationFrame(() => promptInput.focus());
}

function handleSubmit(event) {
  event.preventDefault();
  const value = promptInput.value.trim();
  const currentStep = steps[stepIndex];
  if (!value) {
    promptError.textContent = "Please add something first.";
    return;
  }

  if (currentStep.key === "duration") {
    const parsedMs = parseDurationToMs(value);
    if (!parsedMs) {
      promptError.textContent = "Try 30m, 1h, 1h 30m, or 90 minutes.";
      return;
    }
    task.durationMs = parsedMs;
  } else if (currentStep.key === "title") {
    task.title = value;
  } else if (currentStep.key === "location") {
    task.location = value;
  }

  stepIndex += 1;
  if (stepIndex >= steps.length) {
    startTimerFlow();
  } else {
    showStep(stepIndex);
  }
}

function startTimerFlow() {
  captureScreen.hidden = true;
  timerScreen.hidden = false;
  completionPanel.hidden = true;
  extendControls.hidden = true;
  extendButton.disabled = false;

  taskSummary.textContent = task.title;
  taskMeta.textContent = `${task.location} • ${humanizeDuration(task.durationMs)}`;
  startTimer(task.durationMs);
}

function startTimer(durationMs) {
  clearInterval(countdownId);
  endTime = Date.now() + durationMs;
  updateRemaining();
  restartHourglass(durationMs);

  countdownId = setInterval(() => {
    updateRemaining();
    if (Date.now() >= endTime) {
      clearInterval(countdownId);
      timeRemainingEl.textContent = formatRemaining(0);
      onTimerComplete();
    }
  }, 300);
}

function updateRemaining() {
  const diff = Math.max(0, endTime - Date.now());
  timeRemainingEl.textContent = formatRemaining(diff);
}

function restartHourglass(durationMs) {
  hourglassEl.style.setProperty("--timer-duration", `${durationMs}ms`);
  hourglassEl.classList.remove("is-animating");
  // Force reflow so the animation restarts.
  void hourglassEl.offsetWidth;
  hourglassEl.classList.add("is-animating");
}

function onTimerComplete() {
  completionPanel.hidden = false;
  extendControls.hidden = true;
}

function resetApp() {
  clearInterval(countdownId);
  countdownId = null;
  endTime = null;
  task = { title: "", location: "", durationMs: 0 };
  stepIndex = 0;
  timerScreen.hidden = true;
  captureScreen.hidden = false;
  completionPanel.hidden = true;
  extendControls.hidden = true;
  promptError.textContent = "";
  promptInput.value = "";
  promptForm.classList.remove("is-live");
  window.setTimeout(() => showStep(stepIndex), 200);
}

function parseDurationToMs(input) {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  // Handle clock-style input like 1:30 -> 1h 30m.
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

  if (!matched && /^\\d+(?:\\.\\d+)?$/.test(raw)) {
    totalMinutes = parseFloat(raw);
  }

  if (totalMinutes <= 0) return null;
  return Math.round(totalMinutes * 60 * 1000);
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
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return parts.length ? parts.join(" ") : `${totalMinutes}m`;
}

extendButton.addEventListener("click", () => {
  extendControls.hidden = false;
  extendInput.focus();
});

finishButton.addEventListener("click", resetApp);

confirmExtend.addEventListener("click", () => {
  const minutes = Number(extendInput.value);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    extendInput.value = "5";
    extendInput.focus();
    return;
  }
  const durationMs = minutes * 60 * 1000;
  task.durationMs = durationMs;
  taskMeta.textContent = `${task.location} • +${minutes}m extension`;
  completionPanel.hidden = true;
  extendControls.hidden = true;
  extendButton.disabled = false;
  startTimer(durationMs);
});

extendInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    confirmExtend.click();
  }
});

promptForm.addEventListener("submit", handleSubmit);

// Kick things off once the intro text has animated in.
window.setTimeout(() => {
  showStep(stepIndex);
}, 1000);

/* ==========================================================================
   Toast
   ========================================================================== */

const TOAST_CONTAINER_ID = "toastContainer";

const DEFAULT_DURATION = 4000;

const DEFAULT_TYPE = "primary";

const TOAST_TYPES = new Set([
  "primary",
  "success",
  "info",
  "attention",
  "warning",
  "danger",
]);

const ICONS = Object.freeze({
  primary: "•",
  success: "✓",
  info: "i",
  attention: "!",
  warning: "!",
  danger: "×",
});

const toastTimers = new WeakMap();

let initialized = false;

/* ==========================================================================
   Helpers
   ========================================================================== */

function isElement(value) {
  return value instanceof HTMLElement;
}

function normalizeType(value) {
  const type = String(value ?? "")
    .trim()
    .toLowerCase();

  return TOAST_TYPES.has(type) ? type : DEFAULT_TYPE;
}

function normalizeDuration(value, fallback = DEFAULT_DURATION) {
  const duration = Number(value);

  if (!Number.isFinite(duration)) {
    return fallback;
  }

  return Math.max(0, duration);
}

function prefersReducedMotion() {
  return document.documentElement.dataset.motionPreference === "reduce";
}

/* ==========================================================================
   Container
   ========================================================================== */

function getContainer() {
  let container = document.getElementById(TOAST_CONTAINER_ID);

  if (isElement(container)) {
    return container;
  }

  container = document.createElement("div");

  container.id = TOAST_CONTAINER_ID;
  container.className = "toast-container";

  /*
   * Individual Toasts carry their own status/alert semantics.
   *
   * The stack itself should not be atomic, otherwise adding one Toast can
   * cause assistive technology to announce the entire existing stack again.
   */
  container.setAttribute("aria-relevant", "additions removals");

  document.body.appendChild(container);

  return container;
}

/* ==========================================================================
   Timer Management
   ========================================================================== */

function clearToastTimer(toast) {
  const state = toastTimers.get(toast);

  if (!state) {
    return;
  }

  if (state.timeoutId !== null) {
    window.clearTimeout(state.timeoutId);

    state.timeoutId = null;
  }
}

function scheduleToastRemoval(toast, duration) {
  if (!isElement(toast) || duration <= 0) {
    return;
  }

  clearToastTimer(toast);

  const state = toastTimers.get(toast) || {
    duration,
    remaining: duration,
    startedAt: 0,
    timeoutId: null,
  };

  state.duration = duration;
  state.remaining = duration;
  state.startedAt = performance.now();

  state.timeoutId = window.setTimeout(() => {
    state.timeoutId = null;

    removeToast(toast);
  }, state.remaining);

  toastTimers.set(toast, state);
}

function pauseToastTimer(toast) {
  const state = toastTimers.get(toast);

  if (!state || state.timeoutId === null) {
    return;
  }

  const elapsed = performance.now() - state.startedAt;

  state.remaining = Math.max(0, state.remaining - elapsed);

  window.clearTimeout(state.timeoutId);

  state.timeoutId = null;
}

function resumeToastTimer(toast) {
  const state = toastTimers.get(toast);

  if (
    !state ||
    state.timeoutId !== null ||
    state.remaining <= 0 ||
    toast.classList.contains("is-leaving")
  ) {
    return;
  }

  state.startedAt = performance.now();

  state.timeoutId = window.setTimeout(() => {
    state.timeoutId = null;

    removeToast(toast);
  }, state.remaining);
}

/* ==========================================================================
   Removal
   ========================================================================== */

function finalizeToastRemoval(toast) {
  if (!isElement(toast)) {
    return;
  }

  clearToastTimer(toast);

  toastTimers.delete(toast);

  toast.remove();
}

function removeToast(toast) {
  if (!isElement(toast) || toast.classList.contains("is-leaving")) {
    return;
  }

  clearToastTimer(toast);

  toast.classList.add("is-leaving");

  /*
   * No animationend event is guaranteed when motion is reduced, so remove
   * immediately in that mode.
   */
  if (prefersReducedMotion()) {
    requestAnimationFrame(() => {
      finalizeToastRemoval(toast);
    });

    return;
  }

  let removed = false;

  const finish = () => {
    if (removed) {
      return;
    }

    removed = true;

    finalizeToastRemoval(toast);
  };

  toast.addEventListener("animationend", finish, {
    once: true,
  });

  /*
   * Safety fallback in case animationend is lost because styles change,
   * the element is moved, or animation becomes unavailable.
   */
  window.setTimeout(finish, 600);
}

/* ==========================================================================
   Element Construction
   ========================================================================== */

function createToastIcon(type) {
  const icon = document.createElement("div");

  icon.className = "toast-icon";

  icon.setAttribute("aria-hidden", "true");

  icon.textContent = ICONS[type] ?? ICONS[DEFAULT_TYPE];

  return icon;
}

function createToastContent(title, message) {
  const content = document.createElement("div");

  content.className = "toast-content";

  if (title) {
    const heading = document.createElement("h4");

    heading.className = "toast-title";

    heading.textContent = title;

    content.appendChild(heading);
  }

  if (message) {
    const paragraph = document.createElement("p");

    paragraph.className = "toast-message";

    paragraph.textContent = message;

    content.appendChild(paragraph);
  }

  return content;
}

function createToastCloseButton(closeLabel) {
  const button = document.createElement("button");

  button.className = "toast-close";

  button.type = "button";

  button.setAttribute("aria-label", closeLabel);

  button.textContent = "×";

  return button;
}

/* ==========================================================================
   Public Toast Creation
   ========================================================================== */

/**
 * Create and display a Toast.
 *
 * @param {{
 *   type?: "primary" | "success" | "info" | "attention" | "warning" | "danger",
 *   title?: string,
 *   message?: string,
 *   duration?: number,
 *   closeLabel?: string
 * }} options
 *
 * Set duration to 0 to keep a Toast open until explicitly dismissed.
 *
 * @returns {HTMLElement}
 */

export function showToast({
  type = DEFAULT_TYPE,
  title = "Notification",
  message = "",
  duration = DEFAULT_DURATION,
  closeLabel = "Close notification",
} = {}) {
  const normalizedType = normalizeType(type);

  const normalizedDuration = normalizeDuration(duration);

  const normalizedTitle = String(title ?? "");

  const normalizedMessage = String(message ?? "");

  const normalizedCloseLabel = String(closeLabel || "Close notification");

  const container = getContainer();

  const toast = document.createElement("div");

  toast.className = `toast toast-${normalizedType}`;

  /*
   * Danger notifications warrant immediate announcement.
   * Other Toasts use polite status semantics.
   */
  toast.setAttribute("role", normalizedType === "danger" ? "alert" : "status");

  toast.setAttribute("aria-atomic", "true");

  const icon = createToastIcon(normalizedType);

  const content = createToastContent(normalizedTitle, normalizedMessage);

  const closeButton = createToastCloseButton(normalizedCloseLabel);

  toast.append(icon, content, closeButton);

  container.appendChild(toast);

  closeButton.addEventListener("click", () => {
    removeToast(toast);
  });

  /*
   * Do not dismiss while the user is reading/interacting with the Toast.
   */
  toast.addEventListener("pointerenter", () => {
    pauseToastTimer(toast);
  });

  toast.addEventListener("pointerleave", () => {
    if (!toast.contains(document.activeElement)) {
      resumeToastTimer(toast);
    }
  });

  toast.addEventListener("focusin", () => {
    pauseToastTimer(toast);
  });

  toast.addEventListener("focusout", (event) => {
    const nextTarget = event.relatedTarget;

    if (nextTarget instanceof Node && toast.contains(nextTarget)) {
      return;
    }

    resumeToastTimer(toast);
  });

  if (normalizedDuration > 0) {
    scheduleToastRemoval(toast, normalizedDuration);
  }

  return toast;
}

/* ==========================================================================
   Declarative Triggers
   ========================================================================== */

function handleToastTrigger(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  const trigger = event.target.closest("[data-toast]");

  if (!isElement(trigger)) {
    return;
  }

  if (
    trigger.disabled ||
    trigger.classList.contains("is-disabled") ||
    trigger.getAttribute("aria-disabled") === "true"
  ) {
    return;
  }

  const rawDuration = trigger.dataset.toastDuration;

  showToast({
    type: trigger.dataset.toast || DEFAULT_TYPE,

    title: trigger.dataset.toastTitle || "Notification",

    message: trigger.dataset.toastMessage || "",

    duration:
      rawDuration === undefined
        ? DEFAULT_DURATION
        : normalizeDuration(rawDuration, DEFAULT_DURATION),

    closeLabel: trigger.dataset.toastCloseLabel || "Close notification",
  });
}

/* ==========================================================================
   Initialization
   ========================================================================== */

export function initToasts() {
  if (initialized) {
    return;
  }

  initialized = true;

  document.addEventListener("click", handleToastTrigger);
}

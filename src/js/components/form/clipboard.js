/* ==========================================================================
   Configuration
   ========================================================================== */

const SELECTOR = "[data-copy-target]";
const DEFAULT_FEEDBACK_DURATION = 2000;

const MESSAGES = {
  en: {
    idle: "Copy",
    success: "Copied",
    error: "Copy failed",
  },
  ar: {
    idle: "نسخ",
    success: "تم النسخ",
    error: "تعذر النسخ",
  },
};

const initializedActions = new WeakSet();
const pendingActions = new WeakSet();
const feedbackTimers = new WeakMap();

/* ==========================================================================
   Element Helpers
   ========================================================================== */

function getCopyActions(root) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return [];
  }

  const actions = Array.from(root.querySelectorAll(SELECTOR));

  if (typeof root.matches === "function" && root.matches(SELECTOR)) {
    actions.unshift(root);
  }

  return actions;
}

function getCopyTarget(action) {
  const targetId = action.dataset.copyTarget?.trim();

  if (!targetId) {
    return null;
  }

  const root = action.getRootNode();

  return typeof root.getElementById === "function"
    ? root.getElementById(targetId)
    : action.ownerDocument.getElementById(targetId);
}

function getCopyText(target) {
  if ("value" in target && typeof target.value === "string") {
    return target.value;
  }

  return target.textContent?.trim() ?? "";
}

function getLabelElement(action) {
  const explicitLabel = action.querySelector("[data-copy-label]");

  if (explicitLabel) {
    return explicitLabel;
  }

  return (
    Array.from(action.children)
      .reverse()
      .find((element) => element.getAttribute("aria-hidden") !== "true") || null
  );
}

/* ==========================================================================
   Labels and Feedback
   ========================================================================== */

function getLanguage(action) {
  const language =
    action.closest("[lang]")?.getAttribute("lang") ||
    action.ownerDocument.documentElement.lang ||
    "en";

  return language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

function getLabels(action) {
  const messages = MESSAGES[getLanguage(action)];

  return {
    idle: action.dataset.copyDefaultLabel || messages.idle,
    success: action.dataset.copySuccessLabel || messages.success,
    error: action.dataset.copyErrorLabel || messages.error,
  };
}

function getFeedbackDuration(action) {
  const duration = Number(action.dataset.copyFeedbackDuration);

  return Number.isFinite(duration) && duration >= 0
    ? duration
    : DEFAULT_FEEDBACK_DURATION;
}

function updateActionState(action, state) {
  const label = getLabels(action)[state];
  const labelElement = getLabelElement(action);

  if (labelElement) {
    labelElement.textContent = label;
  } else if (!action.firstElementChild) {
    action.textContent = label;
  }

  action.setAttribute("aria-label", label);
  action.dataset.copyState = state;

  action.classList.toggle("is-copied", state === "success");
  action.classList.toggle("has-error", state === "error");
}

function showFeedback(action, state) {
  const activeTimer = feedbackTimers.get(action);

  if (activeTimer !== undefined) {
    clearTimeout(activeTimer);
  }

  updateActionState(action, state);

  const duration = getFeedbackDuration(action);

  if (duration === 0) {
    updateActionState(action, "idle");
    return;
  }

  const timer = setTimeout(() => {
    feedbackTimers.delete(action);
    updateActionState(action, "idle");
  }, duration);

  feedbackTimers.set(action, timer);
}

/* ==========================================================================
   Clipboard
   ========================================================================== */

function preserveSelection(documentRoot) {
  const selection = documentRoot.getSelection();
  const ranges = [];

  if (selection) {
    for (let index = 0; index < selection.rangeCount; index += 1) {
      ranges.push(selection.getRangeAt(index).cloneRange());
    }
  }

  return () => {
    if (!selection) {
      return;
    }

    selection.removeAllRanges();
    ranges.forEach((range) => selection.addRange(range));
  };
}

function restoreFocus(element) {
  if (!element || typeof element.focus !== "function") {
    return;
  }

  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function copyWithFallback(text, documentRoot) {
  if (!documentRoot.body || typeof documentRoot.execCommand !== "function") {
    return false;
  }

  const activeElement = documentRoot.activeElement;
  const restoreSelection = preserveSelection(documentRoot);
  const textarea = documentRoot.createElement("textarea");

  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");

  Object.assign(textarea.style, {
    position: "fixed",
    inset: "-9999px auto auto -9999px",
    opacity: "0",
    pointerEvents: "none",
  });

  documentRoot.body.append(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;

  try {
    copied = documentRoot.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    textarea.remove();
    restoreFocus(activeElement);
    restoreSelection();
  }

  return copied;
}

async function copyText(text, documentRoot) {
  const clipboard = documentRoot.defaultView?.navigator?.clipboard;

  if (typeof clipboard?.writeText === "function") {
    try {
      await clipboard.writeText(text);
      return;
    } catch {
      // Continue to the compatibility fallback.
    }
  }

  if (!copyWithFallback(text, documentRoot)) {
    throw new Error("Clipboard access is unavailable.");
  }
}

/* ==========================================================================
   Initialization
   ========================================================================== */

function initializeAction(action) {
  if (initializedActions.has(action)) {
    return;
  }

  const target = getCopyTarget(action);

  if (!target) {
    return;
  }

  initializedActions.add(action);
  updateActionState(action, "idle");

  action.addEventListener("click", async (event) => {
    event.preventDefault();

    if (pendingActions.has(action)) {
      return;
    }

    pendingActions.add(action);
    action.setAttribute("aria-busy", "true");

    try {
      await copyText(getCopyText(target), action.ownerDocument);
      showFeedback(action, "success");
    } catch {
      showFeedback(action, "error");
    } finally {
      pendingActions.delete(action);
      action.removeAttribute("aria-busy");
    }
  });
}

/**
 * Initializes copy actions within a document or component root.
 *
 * Required markup:
 * - `data-copy-target="element-id"` on the action
 *
 * Optional configuration:
 * - `data-copy-label` on a nested label element
 * - `data-copy-default-label`
 * - `data-copy-success-label`
 * - `data-copy-error-label`
 * - `data-copy-feedback-duration` in milliseconds
 *
 * @param {Document | Element | DocumentFragment} root
 */
export function initClipboardActions(root = document) {
  getCopyActions(root).forEach(initializeAction);
}

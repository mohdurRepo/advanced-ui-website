import { ARIA, COMPONENT_EVENTS, DEFAULTS, LIMITS } from "./constants";

/* ==========================================================================
   Type Guards
   ========================================================================== */

export function isElement(value) {
  return value instanceof Element;
}

export function isHTMLElement(value) {
  return value instanceof HTMLElement;
}

export function isButtonElement(value) {
  return value instanceof HTMLButtonElement;
}

/* ==========================================================================
   Numbers
   ========================================================================== */

export function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

export function parseNumberAttribute(
  element,
  attribute,
  {
    fallback = 0,
    minimum = Number.NEGATIVE_INFINITY,
    maximum = Number.POSITIVE_INFINITY,
    integer = false,
  } = {},
) {
  if (!element?.hasAttribute(attribute)) {
    return fallback;
  }

  const parsedValue = Number(element.getAttribute(attribute));

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  const normalizedValue = integer ? Math.trunc(parsedValue) : parsedValue;

  return clamp(normalizedValue, minimum, maximum);
}

/* ==========================================================================
   Booleans
   ========================================================================== */

export function parseBooleanAttribute(element, attribute) {
  if (!element?.hasAttribute(attribute)) {
    return false;
  }

  const value = element.getAttribute(attribute);

  return (
    value === "" || value === "true" || value === "1" || value === attribute
  );
}

/* ==========================================================================
   Enumerated Attributes
   ========================================================================== */

export function parseEnumAttribute(
  element,
  attribute,
  supportedValues,
  fallback,
) {
  const value = element?.getAttribute(attribute)?.trim();

  if (!value || !supportedValues.includes(value)) {
    return fallback;
  }

  return value;
}

/* ==========================================================================
   Locale and Direction
   ========================================================================== */

export function getDocumentLocale(element = document.documentElement) {
  const documentReference = element?.ownerDocument || document;

  return (
    element?.closest?.("[lang]")?.getAttribute("lang")?.trim() ||
    documentReference.documentElement.lang?.trim() ||
    DEFAULTS.locale
  );
}

export function getDocumentDirection(element = document.documentElement) {
  const documentReference = element?.ownerDocument || document;

  const explicitDirection = element
    ?.closest?.("[dir]")
    ?.getAttribute("dir")
    ?.trim()
    ?.toLowerCase();

  if (explicitDirection === "rtl" || explicitDirection === "ltr") {
    return explicitDirection;
  }

  const computedDirection =
    documentReference.defaultView?.getComputedStyle(element)?.direction || "";

  return computedDirection === "rtl" ? "rtl" : "ltr";
}

/* ==========================================================================
   Motion Preference
   ========================================================================== */

export function prefersReducedMotion(documentReference = document) {
  const root = documentReference.documentElement;

  if (root.dataset.motion === "reduce") {
    return true;
  }

  return Boolean(
    documentReference.defaultView?.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches,
  );
}

/* ==========================================================================
   CSS Time
   ========================================================================== */

export function parseCssTime(value, fallback = 0) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedValue) {
    return fallback;
  }

  if (normalizedValue.endsWith("ms")) {
    const milliseconds = Number.parseFloat(normalizedValue);

    return Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : fallback;
  }

  if (normalizedValue.endsWith("s")) {
    const seconds = Number.parseFloat(normalizedValue);

    return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : fallback;
  }

  const numericValue = Number.parseFloat(normalizedValue);

  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : fallback;
}

export function readCssTime(element, property, fallback = 0) {
  if (!element) {
    return fallback;
  }

  const value = element.ownerDocument.defaultView
    ?.getComputedStyle(element)
    ?.getPropertyValue(property);

  return parseCssTime(value, fallback);
}

/* ==========================================================================
   CSS Properties
   ========================================================================== */

export function setCssTime(element, property, milliseconds) {
  if (!element?.style) return;

  element.style.setProperty(property, `${Math.max(0, milliseconds)}ms`);
}

export function setCssNumber(element, property, value) {
  if (!element?.style || !Number.isFinite(value)) return;

  element.style.setProperty(property, String(value));
}

export function removeCssProperty(element, property) {
  element?.style?.removeProperty(property);
}

/* ==========================================================================
   DOM Creation
   ========================================================================== */

export function createElement(
  tagName,
  { className = "", text = null, attributes = {} } = {},
  documentReference = document,
) {
  const element = documentReference.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (text !== null && text !== undefined) {
    element.textContent = String(text);
  }

  Object.entries(attributes).forEach(([name, value]) => {
    if (value === null || value === undefined || value === false) {
      return;
    }

    element.setAttribute(name, value === true ? "" : String(value));
  });

  return element;
}

/* ==========================================================================
   Text
   ========================================================================== */

export function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

export function getElementText(element) {
  return normalizeText(element?.textContent || "");
}

/**
 * Returns direct text while ignoring generated accessibility and animation
 * wrappers during refresh operations.
 */

export function getOriginalText(element) {
  if (!element) return "";

  const storedText = element.dataset.textAnimationOriginal;

  if (typeof storedText === "string") {
    return storedText;
  }

  return getElementText(element);
}

/* ==========================================================================
   Grapheme and Word Segmentation
   ========================================================================== */

export function segmentGraphemes(text, locale) {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(locale, {
      granularity: "grapheme",
    });

    return Array.from(segmenter.segment(text), ({ segment }) => segment);
  }

  return Array.from(text);
}

export function segmentWords(text, locale) {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(locale, {
      granularity: "word",
    });

    return Array.from(segmenter.segment(text), ({ segment, isWordLike }) => ({
      value: segment,
      isWord: Boolean(isWordLike),
      isWhitespace: /^\s+$/u.test(segment),
    }));
  }

  return text.split(/(\s+)/u).map((segment) => ({
    value: segment,
    isWord: !/^\s+$/u.test(segment),
    isWhitespace: /^\s+$/u.test(segment),
  }));
}

/* ==========================================================================
   Number Formatting
   ========================================================================== */

export function createNumberFormatter(
  locale,
  { decimals = 0, grouping = false } = {},
) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  });
}

/* ==========================================================================
   Animation Frames
   ========================================================================== */

export function nextAnimationFrame(windowReference = window) {
  return new Promise((resolve) => {
    windowReference.requestAnimationFrame(() => {
      windowReference.requestAnimationFrame(resolve);
    });
  });
}

export function cancelFrame(windowReference, frameId) {
  if (frameId === null || frameId === undefined) return;

  windowReference.cancelAnimationFrame(frameId);
}

/* ==========================================================================
   Timers
   ========================================================================== */

export function clearTimer(windowReference, timerId) {
  if (timerId === null || timerId === undefined) return;

  windowReference.clearTimeout(timerId);
}

export function clearIntervalTimer(windowReference, timerId) {
  if (timerId === null || timerId === undefined) return;

  windowReference.clearInterval(timerId);
}

/* ==========================================================================
   Event Dispatch
   ========================================================================== */

export function dispatchComponentEvent(
  element,
  type,
  detail = {},
  { cancelable = false } = {},
) {
  if (!element) {
    return null;
  }

  const event = new CustomEvent(type, {
    bubbles: true,
    cancelable,
    detail,
  });

  element.dispatchEvent(event);

  return event;
}

export function dispatchError(element, error, context = {}) {
  return dispatchComponentEvent(element, COMPONENT_EVENTS.error, {
    error,
    ...context,
  });
}

/* ==========================================================================
   ARIA
   ========================================================================== */

export function setPressed(element, pressed) {
  element?.setAttribute(ARIA.pressed, pressed ? "true" : "false");
}

export function setBusy(element, busy) {
  if (!element) return;

  if (busy) {
    element.setAttribute(ARIA.busy, "true");
  } else {
    element.removeAttribute(ARIA.busy);
  }
}

export function setHidden(element, hidden) {
  if (!element) return;

  if (hidden) {
    element.setAttribute(ARIA.hidden, "true");
  } else {
    element.removeAttribute(ARIA.hidden);
  }
}

/* ==========================================================================
   Focus
   ========================================================================== */

export function focusSafely(element) {
  if (!element?.focus) return;

  try {
    element.focus({
      preventScroll: true,
    });
  } catch {
    element.focus();
  }
}

/* ==========================================================================
   Animation Timing
   ========================================================================== */

export function calculateStaggerDuration({
  duration,
  delay = 0,
  stagger = 0,
  unitCount = 1,
  maximumStagger = LIMITS.maximumStagger,
}) {
  const lastIndex = Math.max(0, unitCount - 1);

  const staggerDuration = Math.min(
    lastIndex * Math.max(0, stagger),
    Math.max(0, maximumStagger),
  );

  return Math.max(0, delay) + staggerDuration + Math.max(0, duration);
}

/* ==========================================================================
   Viewport
   ========================================================================== */

export function isInViewport(element) {
  if (!element?.getBoundingClientRect) {
    return false;
  }

  const rectangle = element.getBoundingClientRect();

  const viewportWidth = element.ownerDocument.documentElement.clientWidth;

  const viewportHeight = element.ownerDocument.documentElement.clientHeight;

  return (
    rectangle.bottom > 0 &&
    rectangle.right > 0 &&
    rectangle.top < viewportHeight &&
    rectangle.left < viewportWidth
  );
}

/* ==========================================================================
   Root Queries
   ========================================================================== */

export function queryIncludingRoot(root, selector) {
  if (!root?.querySelectorAll) {
    return [];
  }

  const elements = [];

  if (root.matches?.(selector)) {
    elements.push(root);
  }

  elements.push(...root.querySelectorAll(selector));

  return elements;
}

/* ==========================================================================
   Attribute Restoration
   ========================================================================== */

export function restoreAttribute(element, name, originalValue) {
  if (!element) return;

  if (originalValue === null || originalValue === undefined) {
    element.removeAttribute(name);
    return;
  }

  element.setAttribute(name, originalValue);
}

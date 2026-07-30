import { ARIA } from "./constants";

/* ==========================================================================
   DOM Creation
   ========================================================================== */

export function setAttributes(element, attributes = {}) {
  Object.entries(attributes).forEach(([name, value]) => {
    if (value === null || value === undefined || value === false) {
      element.removeAttribute(name);
      return;
    }

    element.setAttribute(name, value === true ? "" : String(value));
  });

  return element;
}

export function createElement(
  tagName,
  { className = "", attributes = {}, text = null } = {},
  documentContext = document,
) {
  const element = documentContext.createElement(tagName);
  const classes = Array.isArray(className)
    ? className.filter(Boolean).join(" ")
    : className;

  if (classes) {
    element.className = classes;
  }

  setAttributes(element, attributes);

  if (text !== null && text !== undefined) {
    element.textContent = String(text);
  }

  return element;
}

/* ==========================================================================
   IDs and Labels
   ========================================================================== */

let idCounter = 0;

function normalizeIdPrefix(prefix) {
  const normalized = String(prefix || "custom-select")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "custom-select";
}

export function createUniqueId(prefix = "custom-select", documentContext) {
  const ownerDocument = documentContext || document;
  const normalizedPrefix = normalizeIdPrefix(prefix);
  let id;

  do {
    idCounter += 1;
    id = `${normalizedPrefix}-${idCounter}`;
  } while (ownerDocument.getElementById(id));

  return id;
}

export function ensureId(element, prefix = "custom-select") {
  if (element.id) return element.id;

  const id = createUniqueId(prefix, element.ownerDocument);
  element.id = id;

  return id;
}

export function getAssociatedLabel(control) {
  if (!control) return null;

  if (control.labels?.length) {
    return control.labels[0];
  }

  const labelledBy = control.getAttribute(ARIA.labelledBy);

  if (!labelledBy) return null;

  return labelledBy
    .trim()
    .split(/\s+/)
    .map((id) => control.ownerDocument.getElementById(id))
    .find(Boolean);
}

/* ==========================================================================
   Native Options
   ========================================================================== */

export function getOptionLabel(option) {
  return String(option?.label || option?.textContent || "").trim();
}

export function isOptionDisabled(option) {
  if (!option) return true;

  const group = option.parentElement;
  const groupIsDisabled =
    group?.tagName === "OPTGROUP" && Boolean(group.disabled);

  return Boolean(option.disabled || groupIsDisabled);
}

export function getSelectableOptions(select) {
  return Array.from(select?.options || []).filter(
    (option) => !option.hidden && !isOptionDisabled(option),
  );
}

export function getSelectedOptions(select) {
  return Array.from(select?.options || []).filter((option) => option.selected);
}

/* ==========================================================================
   Text Search
   ========================================================================== */

/**
 * Normalizes Latin accents, Arabic marks, case, and repeated whitespace for
 * search and typeahead comparisons without altering the displayed label.
 */

export function normalizeSearchText(value, locale = "en") {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase(locale);
}

export function escapeRegularExpression(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isPrintableKey(event) {
  return Boolean(
    event?.key?.length === 1 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey,
  );
}

/* ==========================================================================
   Numbers and CSS Time
   ========================================================================== */

export function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function parseCssTime(value, fallback = 0) {
  const durations = String(value ?? "")
    .split(",")
    .map((part) => {
      const match = part.trim().match(/(-?(?:\d+|\d*\.\d+))\s*(ms|s)\b/i);

      if (!match) return Number.NaN;

      const amount = Number(match[1]);
      const milliseconds =
        match[2].toLowerCase() === "s" ? amount * 1000 : amount;

      return Math.max(0, milliseconds);
    })
    .filter(Number.isFinite);

  if (!durations.length) {
    return Number.isFinite(fallback) ? Math.max(0, fallback) : 0;
  }

  return Math.max(...durations);
}

export function readCssTime(element, propertyName, fallback = 0) {
  const view = element?.ownerDocument?.defaultView;

  if (!view || typeof view.getComputedStyle !== "function") {
    return fallback;
  }

  const value = view.getComputedStyle(element).getPropertyValue(propertyName);

  return parseCssTime(value, fallback);
}

/* ==========================================================================
   Focus
   ========================================================================== */

export function focusSafely(element, options = { preventScroll: true }) {
  if (!element || typeof element.focus !== "function") return false;

  try {
    element.focus(options);
  } catch {
    element.focus();
  }

  return true;
}

/* ==========================================================================
   Component Events
   ========================================================================== */

export function dispatchComponentEvent(
  target,
  type,
  detail = {},
  { cancelable = false } = {},
) {
  const EventConstructor =
    target?.ownerDocument?.defaultView?.CustomEvent || globalThis.CustomEvent;

  if (
    !target ||
    typeof target.dispatchEvent !== "function" ||
    !EventConstructor
  ) {
    return null;
  }

  const event = new EventConstructor(type, {
    bubbles: true,
    cancelable,
    detail,
  });

  target.dispatchEvent(event);

  return event;
}

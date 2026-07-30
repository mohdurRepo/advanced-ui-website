import {
  CLASS_NAMES,
  DATA_ATTRIBUTES,
  DOM_EVENTS,
  PLACEMENTS,
} from "./constants";
import { clamp } from "./utils";

/* ==========================================================================
   Configuration
   ========================================================================== */

const ESTIMATED_POPOVER_HEIGHT = 320;
const FALLBACK_POPOVER_GAP = 8;
const FALLBACK_VIEWPORT_GAP = 12;

const STYLE_PROPERTIES = Object.freeze([
  "--custom-select-popover-top",
  "--custom-select-popover-left",
  "--custom-select-popover-inline-size",
  "--custom-select-available-block-size",
]);

/* ==========================================================================
   CSS Lengths
   ========================================================================== */

function cssLengthToPixels(value, element, fallback) {
  const match = String(value || "")
    .trim()
    .match(/^(-?(?:\d+|\d*\.\d+))(px|rem|em)?$/i);

  if (!match) return fallback;

  const amount = Number(match[1]);
  const unit = (match[2] || "px").toLowerCase();

  if (!Number.isFinite(amount)) return fallback;
  if (unit === "px") return amount;

  const view = element.ownerDocument.defaultView;
  const root = element.ownerDocument.documentElement;
  const fontTarget = unit === "rem" ? root : element;
  const fontSize = Number.parseFloat(
    view.getComputedStyle(fontTarget).fontSize,
  );

  return Number.isFinite(fontSize) ? amount * fontSize : fallback;
}

function readComponentLength(component, propertyName, fallback) {
  const view = component.ownerDocument.defaultView;
  const value = view.getComputedStyle(component).getPropertyValue(propertyName);

  return Math.max(0, cssLengthToPixels(value, component, fallback));
}

/* ==========================================================================
   Viewport
   ========================================================================== */

function getViewportRect(view) {
  const visualViewport = view.visualViewport;
  const documentElement = view.document.documentElement;

  const left = visualViewport?.offsetLeft || 0;
  const top = visualViewport?.offsetTop || 0;
  const width =
    visualViewport?.width || view.innerWidth || documentElement.clientWidth;
  const height =
    visualViewport?.height || view.innerHeight || documentElement.clientHeight;

  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

function getDirection(component) {
  const view = component.ownerDocument.defaultView;
  const computedDirection = view.getComputedStyle(component).direction;

  return (
    computedDirection ||
    component.closest("[dir]")?.getAttribute("dir") ||
    component.ownerDocument.documentElement.dir ||
    "ltr"
  ).toLowerCase();
}

function toPixels(value) {
  return `${Math.round(value * 100) / 100}px`;
}

/* ==========================================================================
   Positioning
   ========================================================================== */

/**
 * Positions one custom-select popover against its trigger.
 *
 * The calculation uses physical viewport coordinates because the popover is
 * fixed-positioned. Logical start alignment is preserved by mirroring the
 * horizontal edge when the component direction is RTL.
 */

export function positionCustomSelectPopover({ component, anchor, popover }) {
  if (!component || !anchor || !popover) return null;

  const view = component.ownerDocument.defaultView;
  const viewport = getViewportRect(view);
  const anchorRect = anchor.getBoundingClientRect();

  const popoverGap = readComponentLength(
    component,
    "--custom-select-popover-gap",
    FALLBACK_POPOVER_GAP,
  );

  const viewportGap = readComponentLength(
    component,
    "--custom-select-viewport-gap",
    FALLBACK_VIEWPORT_GAP,
  );

  const spaceBelow = Math.max(
    0,
    viewport.bottom - anchorRect.bottom - popoverGap - viewportGap,
  );

  const spaceAbove = Math.max(
    0,
    anchorRect.top - viewport.top - popoverGap - viewportGap,
  );

  const initialRect = popover.getBoundingClientRect();
  const measuredHeight = Math.max(
    initialRect.height || 0,
    popover.scrollHeight || 0,
  );

  const desiredHeight = measuredHeight || ESTIMATED_POPOVER_HEIGHT;
  const opensUp = desiredHeight > spaceBelow && spaceAbove > spaceBelow;
  const availableBlockSize = opensUp ? spaceAbove : spaceBelow;

  const maximumInlineSize = Math.max(0, viewport.width - viewportGap * 2);

  const inlineSize = Math.min(Math.max(0, anchorRect.width), maximumInlineSize);

  popover.style.setProperty(
    "--custom-select-popover-inline-size",
    toPixels(inlineSize),
  );

  popover.style.setProperty(
    "--custom-select-available-block-size",
    toPixels(availableBlockSize),
  );

  const placement = opensUp ? PLACEMENTS.top : PLACEMENTS.bottom;

  component.classList.toggle(CLASS_NAMES.openUp, opensUp);
  popover.classList.add(CLASS_NAMES.positioned);
  popover.setAttribute(DATA_ATTRIBUTES.placement, placement);

  const renderedRect = popover.getBoundingClientRect();
  const renderedHeight = Math.min(
    renderedRect.height || desiredHeight,
    availableBlockSize,
  );

  const renderedWidth = Math.min(
    renderedRect.width || inlineSize,
    maximumInlineSize,
  );

  let top = opensUp
    ? anchorRect.top - popoverGap - renderedHeight
    : anchorRect.bottom + popoverGap;

  const minimumTop = viewport.top + viewportGap;
  const maximumTop = Math.max(
    minimumTop,
    viewport.bottom - viewportGap - renderedHeight,
  );

  top = clamp(top, minimumTop, maximumTop);

  const isRTL = getDirection(component) === "rtl";

  let left = isRTL ? anchorRect.right - renderedWidth : anchorRect.left;

  const minimumLeft = viewport.left + viewportGap;
  const maximumLeft = Math.max(
    minimumLeft,
    viewport.right - viewportGap - renderedWidth,
  );

  left = clamp(left, minimumLeft, maximumLeft);

  popover.style.setProperty("--custom-select-popover-top", toPixels(top));
  popover.style.setProperty("--custom-select-popover-left", toPixels(left));

  return Object.freeze({
    placement,
    opensUp,
    top,
    left,
    inlineSize: renderedWidth,
    availableBlockSize,
  });
}

/* ==========================================================================
   Reset
   ========================================================================== */

export function resetCustomSelectPopover({ component, popover }) {
  if (!component || !popover) return;

  component.classList.remove(CLASS_NAMES.openUp);
  popover.classList.remove(CLASS_NAMES.positioned);
  popover.removeAttribute(DATA_ATTRIBUTES.placement);

  STYLE_PROPERTIES.forEach((property) => {
    popover.style.removeProperty(property);
  });
}

/* ==========================================================================
   Positioner
   ========================================================================== */

/**
 * Owns viewport, ancestor-scroll, visual-viewport, and resize observation for
 * one open custom select. All updates are coalesced into one animation frame.
 */

export class CustomSelectPositioner {
  constructor({ component, anchor, popover }) {
    if (!component || !anchor || !popover) {
      throw new TypeError(
        "CustomSelectPositioner requires component, anchor, and popover.",
      );
    }

    this.component = component;
    this.anchor = anchor;
    this.popover = popover;
    this.view = component.ownerDocument.defaultView;

    this.isStarted = false;
    this.frameId = null;
    this.cancelScheduledFrame = null;
    this.resizeObserver = null;

    this.handleViewportChange = this.schedule.bind(this);
  }

  start() {
    if (!this.view) return this;

    if (this.isStarted) {
      this.schedule();
      return this;
    }

    this.isStarted = true;

    this.view.addEventListener(DOM_EVENTS.resize, this.handleViewportChange, {
      passive: true,
    });

    this.view.addEventListener(DOM_EVENTS.scroll, this.handleViewportChange, {
      capture: true,
      passive: true,
    });

    this.view.visualViewport?.addEventListener(
      DOM_EVENTS.resize,
      this.handleViewportChange,
      { passive: true },
    );

    this.view.visualViewport?.addEventListener(
      DOM_EVENTS.scroll,
      this.handleViewportChange,
      { passive: true },
    );

    if (typeof this.view.ResizeObserver === "function") {
      this.resizeObserver = new this.view.ResizeObserver(
        this.handleViewportChange,
      );

      this.resizeObserver.observe(this.anchor);
      this.resizeObserver.observe(this.popover);
    }

    this.position();

    return this;
  }

  position() {
    return positionCustomSelectPopover({
      component: this.component,
      anchor: this.anchor,
      popover: this.popover,
    });
  }

  schedule() {
    if (!this.view || !this.isStarted || this.frameId !== null) return;

    const hasAnimationFrame =
      typeof this.view.requestAnimationFrame === "function";

    const requestFrame = hasAnimationFrame
      ? this.view.requestAnimationFrame.bind(this.view)
      : (callback) => this.view.setTimeout(callback, 16);

    this.cancelScheduledFrame = hasAnimationFrame
      ? this.view.cancelAnimationFrame.bind(this.view)
      : this.view.clearTimeout.bind(this.view);

    this.frameId = requestFrame(() => {
      this.frameId = null;
      this.cancelScheduledFrame = null;

      if (this.isStarted) {
        this.position();
      }
    });
  }

  stop({ reset = false } = {}) {
    if (!this.view) return this;
    if (!this.isStarted && !reset) return this;

    this.isStarted = false;

    this.view.removeEventListener(DOM_EVENTS.resize, this.handleViewportChange);

    this.view.removeEventListener(
      DOM_EVENTS.scroll,
      this.handleViewportChange,
      true,
    );

    this.view.visualViewport?.removeEventListener(
      DOM_EVENTS.resize,
      this.handleViewportChange,
    );

    this.view.visualViewport?.removeEventListener(
      DOM_EVENTS.scroll,
      this.handleViewportChange,
    );

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.frameId !== null) {
      this.cancelScheduledFrame?.(this.frameId);
      this.frameId = null;
      this.cancelScheduledFrame = null;
    }

    if (reset) {
      resetCustomSelectPopover({
        component: this.component,
        popover: this.popover,
      });
    }

    return this;
  }

  destroy() {
    if (!this.view) return;

    this.stop({ reset: true });

    this.component = null;
    this.anchor = null;
    this.popover = null;
    this.view = null;
  }
}

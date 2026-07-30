import {
  CLASS_NAMES,
  DATA_ATTRIBUTES,
  DEFAULTS,
  DOM_EVENTS,
  MODES,
  PLACEMENTS,
} from "./constants";

import { clamp, getDocumentDirection, readCssLength } from "./utils";

/* ==========================================================================
   Responsive Presentation
   ========================================================================== */

/**
 * Must remain aligned with the design-system `sm` breakpoint.
 *
 * Viewports below 32rem high use the native fallback through responsive SCSS,
 * so the floating-sheet branch only applies when the enhanced interface is
 * available.
 */

const FLOATING_SHEET_QUERY = "(max-width: 575.98px) and (min-height: 32rem)";

/* ==========================================================================
   Positioning Properties
   ========================================================================== */

const STYLE_PROPERTIES = Object.freeze([
  "--custom-date-popover-top",
  "--custom-date-popover-left",
  "--custom-date-positioned-inline-size",
  "--custom-date-available-block-size",
]);

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

/* ==========================================================================
   Presentation Detection
   ========================================================================== */

function usesFloatingSheet(view) {
  return Boolean(view?.matchMedia?.(FLOATING_SHEET_QUERY).matches);
}

/* ==========================================================================
   CSS Lengths
   ========================================================================== */

function getRequestedPopoverWidth(component, mode) {
  const propertyName =
    mode === MODES.range
      ? "--custom-date-range-popover-inline-size"
      : "--custom-date-popover-inline-size";

  const fallback = mode === MODES.range ? 704 : 352;

  return readCssLength(component, propertyName, fallback);
}

function getPopoverGap(component) {
  return readCssLength(
    component,
    "--custom-date-popover-gap",
    DEFAULTS.popoverGap,
  );
}

function getViewportGap(component) {
  return readCssLength(
    component,
    "--custom-date-viewport-gap",
    DEFAULTS.viewportGap,
  );
}

/* ==========================================================================
   Values
   ========================================================================== */

function toPixels(value) {
  const roundedValue = Math.round(value * 100) / 100;

  return `${roundedValue}px`;
}

/* ==========================================================================
   Inline Position Cleanup
   ========================================================================== */

function clearPositionStyles(popover) {
  STYLE_PROPERTIES.forEach((propertyName) => {
    popover.style.removeProperty(propertyName);
  });
}

/* ==========================================================================
   Popover Measurement
   ========================================================================== */

/**
 * Uses measurable content height whenever possible.
 *
 * The estimate is only used before the browser has produced a measurable
 * layout. This avoids unnecessarily opening upward when a compact calendar
 * already fits below its control.
 */

function getPopoverHeight(popover) {
  const rectangle = popover.getBoundingClientRect();

  const renderedHeight = rectangle.height || 0;

  const contentHeight = popover.scrollHeight || 0;

  if (contentHeight > 0) {
    return contentHeight;
  }

  if (renderedHeight > 0) {
    return renderedHeight;
  }

  return DEFAULTS.estimatedPopoverHeight;
}

/* ==========================================================================
   Horizontal Position
   ========================================================================== */

function getHorizontalPosition({
  anchorRectangle,
  popoverWidth,
  viewport,
  viewportGap,
  direction,
}) {
  const preferredLeft =
    direction === "rtl"
      ? anchorRectangle.right - popoverWidth
      : anchorRectangle.left;

  const minimumLeft = viewport.left + viewportGap;

  const maximumLeft = Math.max(
    minimumLeft,
    viewport.right - viewportGap - popoverWidth,
  );

  return clamp(preferredLeft, minimumLeft, maximumLeft);
}

/* ==========================================================================
   Vertical Position
   ========================================================================== */

function getVerticalPosition({
  anchorRectangle,
  popoverHeight,
  viewport,
  viewportGap,
  popoverGap,
}) {
  const minimumTop = viewport.top + viewportGap;

  const maximumBottom = viewport.bottom - viewportGap;

  const spaceBelow = Math.max(
    0,
    maximumBottom - anchorRectangle.bottom - popoverGap,
  );

  const spaceAbove = Math.max(0, anchorRectangle.top - popoverGap - minimumTop);

  /*
   * Prefer opening below.
   *
   * Open above only when the popover does not fit below and the upper side
   * provides more usable space.
   */
  const opensUp = popoverHeight > spaceBelow && spaceAbove > spaceBelow;

  const availableBlockSize = opensUp ? spaceAbove : spaceBelow;

  const renderedHeight = Math.min(popoverHeight, availableBlockSize);

  const preferredTop = opensUp
    ? anchorRectangle.top - popoverGap - renderedHeight
    : anchorRectangle.bottom + popoverGap;

  const maximumTop = Math.max(minimumTop, maximumBottom - renderedHeight);

  return {
    opensUp,
    availableBlockSize,
    top: clamp(preferredTop, minimumTop, maximumTop),
  };
}

/* ==========================================================================
   Floating Sheet State
   ========================================================================== */

/**
 * Mobile placement is fully owned by responsive SCSS.
 *
 * Clearing desktop position properties prevents stale coordinates from
 * affecting the centered floating sheet after a responsive transition.
 */

function applyFloatingSheetState({ component, popover }) {
  clearPositionStyles(popover);

  component.classList.remove(CLASS_NAMES.openUp);

  popover.removeAttribute(DATA_ATTRIBUTES.placement);

  popover.classList.add(CLASS_NAMES.positioned);

  return Object.freeze({
    presentation: "floating-sheet",
    placement: PLACEMENTS.bottom,
    opensUp: false,
    top: null,
    left: null,
    inlineSize: null,
    availableBlockSize: null,
  });
}

/* ==========================================================================
   Position Popover
   ========================================================================== */

/**
 * Positions one custom-date popover against its generated control.
 *
 * Desktop and tablet presentations use fixed physical viewport coordinates.
 * Mobile floating-sheet placement is delegated to responsive SCSS.
 */

export function positionCustomDatePopover({
  component,
  anchor,
  popover,
  mode,
}) {
  if (!component || !anchor || !popover) {
    return null;
  }

  const view = component.ownerDocument.defaultView;

  if (!view) {
    return null;
  }

  if (usesFloatingSheet(view)) {
    return applyFloatingSheetState({
      component,
      popover,
    });
  }

  const viewport = getViewportRect(view);

  const anchorRectangle = anchor.getBoundingClientRect();

  const viewportGap = getViewportGap(component);

  const popoverGap = getPopoverGap(component);

  const maximumWidth = Math.max(0, viewport.width - viewportGap * 2);

  const requestedWidth = getRequestedPopoverWidth(component, mode);

  const popoverWidth = Math.min(
    Math.max(anchorRectangle.width, requestedWidth),
    maximumWidth,
  );

  popover.style.setProperty(
    "--custom-date-positioned-inline-size",
    toPixels(popoverWidth),
  );

  const popoverHeight = getPopoverHeight(popover);

  const verticalPosition = getVerticalPosition({
    anchorRectangle,
    popoverHeight,
    viewport,
    viewportGap,
    popoverGap,
  });

  popover.style.setProperty(
    "--custom-date-available-block-size",
    toPixels(verticalPosition.availableBlockSize),
  );

  const direction = getDocumentDirection(component.ownerDocument);

  const left = getHorizontalPosition({
    anchorRectangle,
    popoverWidth,
    viewport,
    viewportGap,
    direction,
  });

  popover.style.setProperty(
    "--custom-date-popover-top",
    toPixels(verticalPosition.top),
  );

  popover.style.setProperty("--custom-date-popover-left", toPixels(left));

  const placement = verticalPosition.opensUp
    ? PLACEMENTS.top
    : PLACEMENTS.bottom;

  component.classList.toggle(CLASS_NAMES.openUp, verticalPosition.opensUp);

  popover.classList.add(CLASS_NAMES.positioned);

  popover.setAttribute(DATA_ATTRIBUTES.placement, placement);

  return Object.freeze({
    presentation: "anchored",
    placement,
    opensUp: verticalPosition.opensUp,
    top: verticalPosition.top,
    left,
    inlineSize: popoverWidth,
    availableBlockSize: verticalPosition.availableBlockSize,
  });
}

/* ==========================================================================
   Reset Position
   ========================================================================== */

export function resetCustomDatePopover({ component, popover }) {
  if (!component || !popover) {
    return;
  }

  component.classList.remove(CLASS_NAMES.openUp);

  popover.classList.remove(CLASS_NAMES.positioned);

  popover.removeAttribute(DATA_ATTRIBUTES.placement);

  clearPositionStyles(popover);
}

/* ==========================================================================
   Positioner
   ========================================================================== */

/**
 * Owns responsive positioning for one open custom-date component.
 *
 * Resize, scroll, visual-viewport and element-size changes are coalesced into
 * one animation frame.
 */

export class CustomDatePositioner {
  constructor({ component, anchor, popover, mode }) {
    if (!component || !anchor || !popover) {
      throw new TypeError(
        "CustomDatePositioner requires component, anchor, and popover.",
      );
    }

    this.component = component;
    this.anchor = anchor;
    this.popover = popover;
    this.mode = mode;

    this.view = component.ownerDocument.defaultView;

    this.isStarted = false;
    this.frameId = null;
    this.cancelScheduledFrame = null;
    this.resizeObserver = null;

    this.handleViewportChange = this.schedule.bind(this);
  }

  start() {
    if (!this.view) {
      return this;
    }

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
    return positionCustomDatePopover({
      component: this.component,
      anchor: this.anchor,
      popover: this.popover,
      mode: this.mode,
    });
  }

  schedule() {
    if (!this.view || !this.isStarted || this.frameId !== null) {
      return;
    }

    const supportsAnimationFrame =
      typeof this.view.requestAnimationFrame === "function";

    const requestFrame = supportsAnimationFrame
      ? this.view.requestAnimationFrame.bind(this.view)
      : (callback) => this.view.setTimeout(callback, 16);

    this.cancelScheduledFrame = supportsAnimationFrame
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
    if (!this.view) {
      return this;
    }

    if (!this.isStarted && !reset) {
      return this;
    }

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
      resetCustomDatePopover({
        component: this.component,
        popover: this.popover,
      });
    }

    return this;
  }

  destroy() {
    if (!this.view) {
      return;
    }

    this.stop({ reset: true });

    this.component = null;
    this.anchor = null;
    this.popover = null;
    this.mode = null;
    this.view = null;
  }
}

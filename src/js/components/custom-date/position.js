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

/**
 * CSS custom properties owned by the JavaScript positioner.
 *
 * Keeping them in one collection makes responsive transitions and teardown
 * predictable.
 */
const STYLE_PROPERTIES = Object.freeze([
  "--custom-date-popover-top",
  "--custom-date-popover-left",
  "--custom-date-positioned-inline-size",
  "--custom-date-available-block-size",
]);

/* ==========================================================================
   Viewport
   ========================================================================== */

/**
 * Returns the currently visible viewport.
 *
 * visualViewport is preferred where available so browser zoom, mobile browser
 * chrome, and virtual-keyboard changes are reflected in positioning.
 */
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
  if (!view || typeof view.matchMedia !== "function") {
    return false;
  }

  return view.matchMedia(FLOATING_SHEET_QUERY).matches;
}

/* ==========================================================================
   CSS Lengths
   ========================================================================== */

/**
 * Returns the requested popover width from the component's CSS variables.
 */
function getRequestedPopoverWidth(component, mode) {
  const propertyName =
    mode === MODES.range
      ? "--custom-date-range-popover-inline-size"
      : "--custom-date-popover-inline-size";

  const fallback = mode === MODES.range ? 704 : 352;

  return readCssLength(component, propertyName, fallback);
}

/**
 * Distance between the control and its anchored popover.
 */
function getPopoverGap(component) {
  return readCssLength(
    component,
    "--custom-date-popover-gap",
    DEFAULTS.popoverGap,
  );
}

/**
 * Minimum distance maintained between the popover and viewport edges.
 */
function getViewportGap(component) {
  return readCssLength(
    component,
    "--custom-date-viewport-gap",
    DEFAULTS.viewportGap,
  );
}

/* ==========================================================================
   CSS Values
   ========================================================================== */

/**
 * Converts a numeric layout value into a compact pixel value.
 *
 * Two decimal places are retained to avoid unnecessary sub-pixel noise while
 * still preserving accurate placement on scaled displays.
 */
function toPixels(value) {
  const number = Number.isFinite(value) ? value : 0;

  const roundedValue = Math.round(number * 100) / 100;

  return `${roundedValue}px`;
}

/* ==========================================================================
   Inline Position Cleanup
   ========================================================================== */

function clearPositionStyles(popover) {
  if (!popover) {
    return;
  }

  STYLE_PROPERTIES.forEach((propertyName) => {
    popover.style.removeProperty(propertyName);
  });
}

/* ==========================================================================
   Popover Measurement
   ========================================================================== */

/**
 * Returns the content height required by the popover.
 *
 * scrollHeight is preferred because the visible box may already have been
 * constrained by CSS. getBoundingClientRect() remains useful during initial
 * layout, and the configured estimate is used only as a final fallback.
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

/**
 * Positions the popover along the inline axis while keeping it inside the
 * visible viewport.
 *
 * LTR prefers alignment with the anchor's left edge.
 * RTL prefers alignment with the anchor's right edge.
 */
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

/**
 * Determines whether the popover should open below or above its control.
 *
 * Below remains the preferred placement. The popover opens above only when it
 * cannot fit below and more usable space exists above.
 */
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

  const spaceAbove = Math.max(
    0,

    anchorRectangle.top - popoverGap - minimumTop,
  );

  const opensUp = popoverHeight > spaceBelow && spaceAbove > spaceBelow;

  const availableBlockSize = opensUp ? spaceAbove : spaceBelow;

  const renderedHeight = Math.min(popoverHeight, availableBlockSize);

  const preferredTop = opensUp
    ? anchorRectangle.top - popoverGap - renderedHeight
    : anchorRectangle.bottom + popoverGap;

  const maximumTop = Math.max(
    minimumTop,

    maximumBottom - renderedHeight,
  );

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
 * Mobile placement is owned by responsive SCSS.
 *
 * Any coordinates left behind by the anchored desktop/tablet presentation are
 * removed before switching to floating-sheet mode.
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
 * Desktop and tablet:
 *   Fixed physical viewport coordinates are calculated here.
 *
 * Mobile:
 *   Placement is delegated to responsive SCSS through floating-sheet mode.
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

  const documentReference = component.ownerDocument;

  const view = documentReference?.defaultView;

  if (!view) {
    return null;
  }

  /*
   * Mobile presentation is CSS-owned.
   */
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

  /*
   * The popover must never be wider than the usable viewport.
   */
  const maximumWidth = Math.max(
    0,

    viewport.width - viewportGap * 2,
  );

  const requestedWidth = getRequestedPopoverWidth(component, mode);

  /*
   * The control itself establishes the minimum useful width unless the
   * viewport is too narrow to support it.
   */
  const popoverWidth = Math.min(
    Math.max(anchorRectangle.width, requestedWidth),

    maximumWidth,
  );

  popover.style.setProperty(
    "--custom-date-positioned-inline-size",
    toPixels(popoverWidth),
  );

  /*
   * Width can influence wrapping and therefore height, so measure height only
   * after applying the final inline size.
   */
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

  const direction = getDocumentDirection(documentReference);

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

/**
 * Removes all positioning state added while the popover was open.
 */
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
 * Owns responsive positioning for one open CustomDate component.
 *
 * Resize, scroll, visual-viewport changes, and element-size changes are
 * coalesced into one animation frame.
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

    this.view = component.ownerDocument?.defaultView || null;

    this.isStarted = false;

    this.frameId = null;

    this.cancelScheduledFrame = null;

    this.resizeObserver = null;

    /*
     * Keep one stable callback reference so addEventListener() and
     * removeEventListener() always use the same function.
     */
    this.handleViewportChange = this.schedule.bind(this);
  }

  /* ==========================================================================
     Start
     ========================================================================== */

  start() {
    if (!this.view) {
      return this;
    }

    /*
     * Starting an already-running positioner should not register listeners
     * again. It only requests a fresh position.
     */
    if (this.isStarted) {
      this.schedule();

      return this;
    }

    this.isStarted = true;

    this.view.addEventListener(DOM_EVENTS.resize, this.handleViewportChange, {
      passive: true,
    });

    /*
     * Capture scroll events from scrollable ancestors as well as the window.
     */
    this.view.addEventListener(DOM_EVENTS.scroll, this.handleViewportChange, {
      capture: true,
      passive: true,
    });

    const visualViewport = this.view.visualViewport;

    visualViewport?.addEventListener(
      DOM_EVENTS.resize,
      this.handleViewportChange,
      {
        passive: true,
      },
    );

    visualViewport?.addEventListener(
      DOM_EVENTS.scroll,
      this.handleViewportChange,
      {
        passive: true,
      },
    );

    /*
     * Reposition when either the control or popover changes size.
     *
     * This is useful when:
     *
     * - the calendar changes month;
     * - presets appear or disappear;
     * - translated text changes dimensions;
     * - responsive styles change the control size.
     */
    if (typeof this.view.ResizeObserver === "function") {
      this.resizeObserver = new this.view.ResizeObserver(
        this.handleViewportChange,
      );

      this.resizeObserver.observe(this.anchor);

      this.resizeObserver.observe(this.popover);
    }

    /*
     * Position immediately on opening so the component does not wait for the
     * first resize/scroll/animation-frame event.
     */
    this.position();

    return this;
  }

  /* ==========================================================================
     Position
     ========================================================================== */

  position() {
    if (!this.component || !this.anchor || !this.popover) {
      return null;
    }

    return positionCustomDatePopover({
      component: this.component,

      anchor: this.anchor,

      popover: this.popover,

      mode: this.mode,
    });
  }

  /* ==========================================================================
     Schedule
     ========================================================================== */

  /**
   * Coalesces repeated position requests into one browser frame.
   */
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
      /*
       * Clear scheduling state before positioning so a ResizeObserver fired
       * by the resulting layout can safely request the next frame.
       */
      this.frameId = null;

      this.cancelScheduledFrame = null;

      if (this.isStarted && this.component && this.anchor && this.popover) {
        this.position();
      }
    });
  }

  /* ==========================================================================
     Stop
     ========================================================================== */

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

    const visualViewport = this.view.visualViewport;

    visualViewport?.removeEventListener(
      DOM_EVENTS.resize,
      this.handleViewportChange,
    );

    visualViewport?.removeEventListener(
      DOM_EVENTS.scroll,
      this.handleViewportChange,
    );

    this.resizeObserver?.disconnect();

    this.resizeObserver = null;

    /*
     * Cancel any position request that has not executed yet.
     */
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

  /* ==========================================================================
     Destroy
     ========================================================================== */

  destroy() {
    /*
     * stop() handles listeners, ResizeObserver, pending frames, and CSS state.
     */
    this.stop({
      reset: true,
    });

    this.component = null;

    this.anchor = null;

    this.popover = null;

    this.mode = null;

    this.view = null;
  }
}

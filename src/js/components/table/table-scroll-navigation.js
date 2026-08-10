import {
  ATTRIBUTES,
  CLASSES,
  DEFAULTS,
  DIRECTIONS,
  OVERFLOW,
  SELECTORS,
} from "./constants";

/* ==========================================================================
   Instance Registry
   ========================================================================== */

const instances = new WeakMap();

/* ==========================================================================
   RTL Scroll Type
   ========================================================================== */

let rtlScrollType = null;

function detectRtlScrollType() {
  if (rtlScrollType) {
    return rtlScrollType;
  }

  const outer = document.createElement("div");
  const inner = document.createElement("div");

  outer.dir = "rtl";

  outer.style.position = "absolute";
  outer.style.inset = "-9999px auto auto -9999px";
  outer.style.inlineSize = "4px";
  outer.style.blockSize = "1px";
  outer.style.overflow = "scroll";

  inner.style.inlineSize = "8px";
  inner.style.blockSize = "1px";

  outer.appendChild(inner);
  document.body.appendChild(outer);

  if (outer.scrollLeft > 0) {
    rtlScrollType = "positive-descending";
  } else {
    outer.scrollLeft = 1;

    rtlScrollType = outer.scrollLeft === 0 ? "negative" : "positive-ascending";
  }

  outer.remove();

  return rtlScrollType;
}

/* ==========================================================================
   Table Scroll Navigation
   ========================================================================== */

export class TableScrollNavigation {
  constructor(element) {
    if (!(element instanceof Element)) {
      throw new TypeError(
        "TableScrollNavigation requires a valid root element.",
      );
    }

    this.element = element;

    this.scroller = element.querySelector(SELECTORS.scroller);

    this.jump = element.querySelector(SELECTORS.jump);

    if (!this.scroller || !this.jump) {
      throw new Error(
        "TableScrollNavigation requires a scroller and jump control.",
      );
    }

    this.handleScroll = this.handleScroll.bind(this);

    this.handleJump = this.handleJump.bind(this);

    this.init();
  }

  /* ==========================================================================
     Static API
     ========================================================================== */

  static getInstance(element) {
    return instances.get(element) || null;
  }

  static getOrCreateInstance(element) {
    const existing = TableScrollNavigation.getInstance(element);

    if (existing) {
      existing.refresh();

      return existing;
    }

    try {
      return new TableScrollNavigation(element);
    } catch (error) {
      console.error("TableScrollNavigation:", error);

      return null;
    }
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */

  init() {
    instances.set(this.element, this);

    this.scroller.addEventListener("scroll", this.handleScroll, {
      passive: true,
    });

    this.jump.addEventListener("click", this.handleJump);

    this.refresh();
  }

  /* ==========================================================================
     Direction
     ========================================================================== */

  isRtl() {
    return getComputedStyle(this.scroller).direction === "rtl";
  }

  /* ==========================================================================
     Motion
     ========================================================================== */

  prefersReducedMotion() {
    if (document.documentElement.dataset.motion === "reduce") {
      return true;
    }

    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ==========================================================================
     Metrics
     ========================================================================== */

  getMaxScroll() {
    return Math.max(0, this.scroller.scrollWidth - this.scroller.clientWidth);
  }

  getLogicalPosition() {
    const maxScroll = this.getMaxScroll();

    const physical = this.scroller.scrollLeft;

    if (!this.isRtl()) {
      return Math.min(maxScroll, Math.max(0, physical));
    }

    const type = detectRtlScrollType();

    switch (type) {
      case "negative":
        return Math.min(maxScroll, Math.abs(physical));

      case "positive-descending":
        return Math.min(maxScroll, Math.max(0, maxScroll - physical));

      case "positive-ascending":
      default:
        return Math.min(maxScroll, Math.max(0, physical));
    }
  }

  getState() {
    const maxScroll = this.getMaxScroll();

    const position = this.getLogicalPosition();

    const threshold = DEFAULTS.threshold;

    return {
      maxScroll,
      position,

      hasOverflow: maxScroll > threshold,

      atStart: position <= threshold,

      atEnd: maxScroll - position <= threshold,
    };
  }

  /* ==========================================================================
     Labels
     ========================================================================== */

  getLabel(direction) {
    const lang = document.documentElement.lang || "en";

    const isArabic = lang.startsWith("ar");

    if (direction === DIRECTIONS.start) {
      return isArabic ? "الانتقال إلى الأعمدة الأولى" : "Jump to first columns";
    }

    return isArabic ? "الانتقال إلى الأعمدة الأخيرة" : "Jump to last columns";
  }

  /* ==========================================================================
     Jump State
     ========================================================================== */

  setJumpDirection(direction) {
    this.jump.setAttribute(ATTRIBUTES.direction, direction);

    const label = this.getLabel(direction);

    this.jump.setAttribute("aria-label", label);

    this.jump.setAttribute("title", label);

    const goToStart = direction === DIRECTIONS.start;

    this.jump.classList.toggle(CLASSES.iconStart, goToStart);

    this.jump.classList.toggle(CLASSES.iconEnd, !goToStart);
  }

  /* ==========================================================================
     Overflow State
     ========================================================================== */

  setOverflow(value) {
    if (!value) {
      this.element.removeAttribute(ATTRIBUTES.overflow);

      return;
    }

    this.element.setAttribute(ATTRIBUTES.overflow, value);
  }

  /* ==========================================================================
     Rendering
     ========================================================================== */

  refresh() {
    const state = this.getState();

    if (!state.hasOverflow) {
      this.jump.hidden = true;

      this.setOverflow(null);

      return;
    }

    this.jump.hidden = false;

    if (state.atStart && !state.atEnd) {
      this.setOverflow(OVERFLOW.end);

      this.setJumpDirection(DIRECTIONS.end);

      return;
    }

    if (state.atEnd && !state.atStart) {
      this.setOverflow(OVERFLOW.start);

      this.setJumpDirection(DIRECTIONS.start);

      return;
    }

    this.setOverflow(OVERFLOW.both);
  }

  /* ==========================================================================
     Physical Scroll Target
     ========================================================================== */

  getPhysicalTarget(direction) {
    const maxScroll = this.getMaxScroll();

    if (!this.isRtl()) {
      return direction === DIRECTIONS.end ? maxScroll : 0;
    }

    const type = detectRtlScrollType();

    if (direction === DIRECTIONS.start) {
      switch (type) {
        case "negative":
        case "positive-descending":
          return 0;

        case "positive-ascending":
        default:
          return 0;
      }
    }

    switch (type) {
      case "negative":
        return -maxScroll;

      case "positive-descending":
        return 0;

      case "positive-ascending":
      default:
        return maxScroll;
    }
  }

  /* ==========================================================================
     Scrolling
     ========================================================================== */

  scrollTo(direction) {
    this.scroller.scrollTo({
      left: this.getPhysicalTarget(direction),

      behavior: this.prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  /* ==========================================================================
     Events
     ========================================================================== */

  handleScroll() {
    this.refresh();
  }

  handleJump() {
    const direction =
      this.jump.getAttribute(ATTRIBUTES.direction) || DIRECTIONS.end;

    this.scrollTo(direction);
  }

  /* ==========================================================================
     Destruction
     ========================================================================== */

  destroy() {
    this.scroller.removeEventListener("scroll", this.handleScroll);

    this.jump.removeEventListener("click", this.handleJump);

    this.element.removeAttribute(ATTRIBUTES.overflow);

    this.jump.removeAttribute(ATTRIBUTES.direction);

    this.jump.hidden = true;

    instances.delete(this.element);
  }
}

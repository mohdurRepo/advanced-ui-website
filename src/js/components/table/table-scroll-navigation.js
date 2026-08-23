import {
  ATTRIBUTES,
  CLASSES,
  DEFAULTS,
  DIRECTIONS,
  OVERFLOW,
  SELECTORS,
} from "./constants";

const instances = new WeakMap();

let rtlScrollType = null;

function getScroller(element) {
  return (
    element.querySelector(".dt-scroll-body") ||
    element.querySelector(SELECTORS.scroller)
  );
}

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

export class TableScrollNavigation {
  constructor(element) {
    if (!(element instanceof Element)) {
      throw new TypeError(
        "TableScrollNavigation requires a valid shell element.",
      );
    }

    this.element = element;
    this.scroller = getScroller(element);
    this.jump = element.querySelector(SELECTORS.jump);

    if (!this.scroller || !this.jump) {
      throw new Error(
        "TableScrollNavigation requires a scroller and jump control.",
      );
    }

    this.resizeObserver = null;
    this.mutationObserver = null;
    this.refreshFrame = null;

    this.handleScroll = this.handleScroll.bind(this);
    this.handleJump = this.handleJump.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleMutations = this.handleMutations.bind(this);

    this.init();
  }

  static getInstance(element) {
    return instances.get(element) || null;
  }

  static getOrCreateInstance(element) {
    const existing = TableScrollNavigation.getInstance(element);

    if (existing) {
      existing.refresh();

      return existing;
    }

    /*
     * DataTables creates `.dt-scroll-body` after initialization.
     * No available scroller is an expected temporary state.
     */
    if (!getScroller(element) || !element.querySelector(SELECTORS.jump)) {
      return null;
    }

    return new TableScrollNavigation(element);
  }

  init() {
    instances.set(this.element, this);

    this.scroller.addEventListener("scroll", this.handleScroll, {
      passive: true,
    });

    this.jump.addEventListener("click", this.handleJump);

    this.observeLayout();
    this.refresh();
  }

  observeLayout() {
    if (typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver(this.handleResize);

      this.resizeObserver.observe(this.element);
    }

    this.observeScroller();
  }

  observeScroller() {
    this.resizeObserver?.observe(this.scroller);

    if (typeof MutationObserver === "function") {
      this.mutationObserver = new MutationObserver(this.handleMutations);

      this.mutationObserver.observe(this.scroller, {
        childList: true,
        subtree: true,
      });
    }
  }

  /*
   * Native tables use [data-table-scroll]. DataTables uses .dt-scroll-body.
   * Prefer the DataTables scroller whenever it exists.
   */
  syncScroller() {
    const nextScroller = getScroller(this.element);

    if (!nextScroller || nextScroller === this.scroller) {
      return;
    }

    this.scroller.removeEventListener("scroll", this.handleScroll);
    this.resizeObserver?.unobserve(this.scroller);
    this.mutationObserver?.disconnect();

    this.scroller = nextScroller;

    this.scroller.addEventListener("scroll", this.handleScroll, {
      passive: true,
    });

    this.observeScroller();
  }

  scheduleRefresh() {
    if (this.refreshFrame !== null) {
      return;
    }

    this.refreshFrame = window.requestAnimationFrame(() => {
      this.refreshFrame = null;
      this.refresh();
    });
  }

  isRtl() {
    return getComputedStyle(this.scroller).direction === "rtl";
  }

  prefersReducedMotion() {
    if (document.documentElement.dataset.motion === "reduce") {
      return true;
    }

    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  getMaxScroll() {
    return Math.max(0, this.scroller.scrollWidth - this.scroller.clientWidth);
  }

  getLogicalPosition() {
    const maxScroll = this.getMaxScroll();
    const physical = this.scroller.scrollLeft;

    if (!this.isRtl()) {
      return Math.min(maxScroll, Math.max(0, physical));
    }

    switch (detectRtlScrollType()) {
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

  getLabel(direction) {
    const lang = document.documentElement.lang || "en";
    const isArabic = lang.startsWith("ar");

    if (direction === DIRECTIONS.start) {
      return isArabic ? "الانتقال إلى الأعمدة الأولى" : "Jump to first columns";
    }

    return isArabic ? "الانتقال إلى الأعمدة الأخيرة" : "Jump to last columns";
  }

  getIconClass(direction) {
    const pointsToStart = direction === DIRECTIONS.start;
    const useLeftChevron = this.isRtl() ? !pointsToStart : pointsToStart;

    return useLeftChevron ? CLASSES.iconStart : CLASSES.iconEnd;
  }

  setJumpDirection(direction) {
    this.jump.setAttribute(ATTRIBUTES.direction, direction);

    const label = this.getLabel(direction);

    this.jump.setAttribute("aria-label", label);
    this.jump.setAttribute("title", label);

    this.jump.classList.remove(CLASSES.iconStart, CLASSES.iconEnd);
    this.jump.classList.add(this.getIconClass(direction));
  }

  setOverflow(value) {
    if (!value) {
      this.element.removeAttribute(ATTRIBUTES.overflow);

      return;
    }

    this.element.setAttribute(ATTRIBUTES.overflow, value);
  }

  refresh() {
    this.syncScroller();

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

    const direction =
      state.position < state.maxScroll / 2 ? DIRECTIONS.end : DIRECTIONS.start;

    this.setJumpDirection(direction);
  }

  getPhysicalTarget(direction) {
    const maxScroll = this.getMaxScroll();

    if (!this.isRtl()) {
      return direction === DIRECTIONS.end ? maxScroll : 0;
    }

    switch (detectRtlScrollType()) {
      case "negative":
        return direction === DIRECTIONS.end ? -maxScroll : 0;

      case "positive-descending":
        return direction === DIRECTIONS.end ? 0 : maxScroll;

      case "positive-ascending":
      default:
        return direction === DIRECTIONS.end ? maxScroll : 0;
    }
  }

  scrollTo(direction) {
    this.scroller.scrollTo({
      left: this.getPhysicalTarget(direction),
      behavior: this.prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  handleScroll() {
    this.refresh();
  }

  handleJump() {
    const direction =
      this.jump.getAttribute(ATTRIBUTES.direction) || DIRECTIONS.end;

    this.scrollTo(direction);
  }

  handleResize() {
    this.scheduleRefresh();
  }

  handleMutations() {
    this.scheduleRefresh();
  }

  destroy() {
    this.scroller.removeEventListener("scroll", this.handleScroll);
    this.jump.removeEventListener("click", this.handleJump);

    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();

    if (this.refreshFrame !== null) {
      window.cancelAnimationFrame(this.refreshFrame);
    }

    this.element.removeAttribute(ATTRIBUTES.overflow);

    this.jump.removeAttribute(ATTRIBUTES.direction);
    this.jump.hidden = true;

    instances.delete(this.element);
  }
}

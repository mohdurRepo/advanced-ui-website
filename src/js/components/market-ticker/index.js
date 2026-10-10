/* ==========================================================================
   Market Ticker
   ========================================================================== */

/**
 * Saudi Exchange market ticker controller.
 *
 * Direction
 *   - Ticker geometry (viewport, track, lists) is always physical LTR;
 *     the stylesheet owns this.
 *   - Page direction controls travel: LTR travels left, RTL travels right.
 *   - Item content follows the page direction; company names resolve their
 *     own direction (dir="auto"); financial values stay LTR.
 *
 * Motion
 *   Governed only by the ticker's own preferences on <html>:
 *     data-ticker-visibility  visible | hidden
 *     data-ticker-speed       slow | normal | fast  (via --market-ticker-speed)
 *   The site "reduce motion" setting and OS motion settings do not stop it.
 *
 *   Movement uses requestAnimationFrame and an inline transform, so the
 *   .is-theme-switching class (which disables CSS transitions/animations)
 *   never interrupts it.
 *
 *   Movement pauses while:
 *     - the tab is hidden;
 *     - the ticker is outside the viewport;
 *     - the pointer is over it;
 *     - it contains keyboard focus;
 *     - the visibility preference is "hidden".
 *
 * Accessibility
 *   - Presentation clones are aria-hidden, inert and untabbable.
 *   - A keyboard-focused item is moved into view by the ticker itself,
 *     never by the browser scrolling the hidden-overflow viewport.
 *
 * Logos
 *   company logo → FALLBACK_LOGO_URL → initials.
 *
 * Position
 *   Saved to sessionStorage when the page is hidden or left, so the ticker
 *   continues where it was on the next page.
 */

/* ==========================================================================
   Configuration
   ========================================================================== */

const ROOT_SELECTOR = "[data-market-ticker]";

/* Pixels per second; the real value comes from --market-ticker-speed. */

const DEFAULT_SPEED = 48;
const MINIMUM_SPEED = 1;

/* Seconds. Clamps long frames so a resumed tab never jumps. */

const MAXIMUM_FRAME_TIME = 0.1;

/* Space kept between a focused item and the viewport edge (edge fades). */

const FOCUS_INSET = 48;

const FALLBACK_LOGO_URL = "/default-Logo.png";

const POSITION_STORAGE_PREFIX = "se-market-ticker-position";

const controllers = new WeakMap();

/**
 * If the fallback logo fails once, stop requesting it for the rest of the
 * page lifecycle and let initials show instead.
 */

let fallbackLogoUnavailable = false;

/* ==========================================================================
   Locale
   ========================================================================== */

function getDirection() {
  return document.documentElement.dir === "rtl" ? "rtl" : "ltr";
}

function getLanguage() {
  return document.documentElement.lang || "en";
}

function isArabicLanguage(language) {
  return String(language).toLowerCase().startsWith("ar");
}

/* ==========================================================================
   Numbers
   ========================================================================== */

function parseNumber(value) {
  if (value === null || value === undefined || value === "" || value === "-") {
    return null;
  }

  const number = Number.parseFloat(value);

  return Number.isFinite(number) ? number : null;
}

function getPriceState(changePercent) {
  const value = parseNumber(changePercent);

  if (value === null || value === 0) {
    return { className: "price-neutral", iconClass: null };
  }

  return value > 0
    ? { className: "price-up", iconClass: "icon-triangle-up" }
    : { className: "price-down", iconClass: "icon-triangle-down" };
}

/* ==========================================================================
   URLs
   ========================================================================== */

/**
 * Only http(s) URLs are accepted, so javascript:, data: or malformed values
 * never reach a link or an image.
 */

function getSafeUrl(value, fallback = "#") {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  try {
    const url = new URL(value.trim(), window.location.origin);

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : fallback;
  } catch {
    return fallback;
  }
}

/* ==========================================================================
   Initials
   ========================================================================== */

function getCompanyInitials(companyName, language) {
  const initials = String(companyName || "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] || "")
    .filter(Boolean)
    .join(" ");

  if (initials) {
    return initials;
  }

  return isArabicLanguage(language) ? "م ح" : "SA";
}

/* ==========================================================================
   Data
   ========================================================================== */

function getTickerData(root) {
  const sourceId = root.dataset.marketTickerSource;

  const source = sourceId ? document.getElementById(sourceId) : null;

  if (!source) {
    return [];
  }

  try {
    const data = JSON.parse(source.textContent);

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Market ticker data could not be parsed.", error);

    return [];
  }
}

/* ==========================================================================
   DOM Helpers
   ========================================================================== */

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (textContent !== undefined) {
    element.textContent = textContent;
  }

  return element;
}

function collectRoots(container) {
  const roots = [];

  if (container instanceof Element && container.matches(ROOT_SELECTOR)) {
    roots.push(container);
  }

  roots.push(...container.querySelectorAll(ROOT_SELECTOR));

  return roots;
}

/* ==========================================================================
   Controller
   ========================================================================== */

class MarketTicker {
  constructor(root, data) {
    this.root = root;
    this.data = data;

    this.viewport = null;
    this.track = null;
    this.sourceList = null;

    this.direction = getDirection();
    this.language = getLanguage();

    this.numberFormatter = null;
    this.signedNumberFormatter = null;

    this.speed = DEFAULT_SPEED;

    this.sourceWidth = 0;
    this.viewportWidth = 0;
    this.position = 0;

    this.frameId = null;
    this.resizeFrameId = null;
    this.lastTimestamp = null;

    this.pauseReasons = new Set();
    this.cleanups = [];

    this.resizeObserver = null;
    this.intersectionObserver = null;
    this.preferenceObserver = null;

    this.destroyed = false;

    this.handleFrame = this.handleFrame.bind(this);
    this.handlePointerEnter = this.handlePointerEnter.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleFocusIn = this.handleFocusIn.bind(this);
    this.handleFocusOut = this.handleFocusOut.bind(this);
    this.handleViewportScroll = this.handleViewportScroll.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handlePageHide = this.handlePageHide.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handlePreferenceMutations = this.handlePreferenceMutations.bind(this);

    this.updateFormatters();
  }

  /* ========================================================================
     Initialization
     ======================================================================== */

  init() {
    if (!this.data.length) {
      this.root.hidden = true;

      return;
    }

    this.render();

    this.updateSpeed();

    this.bindEvents();

    this.root.classList.add("is-ready");

    this.root.dataset.marketTickerInitialized = "true";

    this.rebuildCopies({ restorePosition: true });
  }

  /* ========================================================================
     Formatting
     ======================================================================== */

  /**
   * Latin digits are pinned explicitly. Without this, the default digits
   * for Arabic locales can differ between browsers and versions.
   */

    updateFormatters() {
    const options = {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      numberingSystem: "latn",
    };

    this.numberFormatter = new Intl.NumberFormat(this.language, options);

    this.signedNumberFormatter = new Intl.NumberFormat(this.language, {
      ...options,
      signDisplay: "auto", 
    });
  }


  formatNumber(value, signed = false) {
    const number = parseNumber(value);

    if (number === null) {
      return "–";
    }

    return signed
      ? this.signedNumberFormatter.format(number)
      : this.numberFormatter.format(number);
  }

  /* ========================================================================
     Rendering
     ======================================================================== */

  /**
   * Builds (or rebuilds) the viewport. Direction is owned by the
   * stylesheet, so no dir attributes are set on the geometry.
   */

  render() {
    this.viewport?.removeEventListener("scroll", this.handleViewportScroll);

    this.viewport?.remove();

    this.viewport = createElement(
      "div",
      "market-ticker__viewport custom-scrollbar",
    );

    this.viewport.dataset.marketTickerViewport = "";

    this.track = createElement("div", "market-ticker__track");

    this.track.dataset.marketTickerTrack = "";

    this.sourceList = this.createList(this.data);

    this.sourceList.dataset.marketTickerList = "";

    this.track.append(this.sourceList);

    this.viewport.append(this.track);

    this.root.append(this.viewport);

    this.viewport.addEventListener("scroll", this.handleViewportScroll, {
      passive: true,
    });

    this.observeLayout();
  }

  createList(items) {
    const list = createElement("ul", "market-ticker__list");

    const fragment = document.createDocumentFragment();

    for (const item of items) {
      fragment.append(this.createItem(item));
    }

    list.append(fragment);

    return list;
  }

  createItem(item) {
    const listItem = createElement("li", "market-ticker__item");

    const link = createElement("a", "market-ticker__link");

    const companyName =
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim()
        : String(item.symbol || "").trim();

    const price = this.formatNumber(item.price);
    const change = this.formatNumber(item.change, true);
    const changePercent = this.formatNumber(item.changePercent, true);

    const state = getPriceState(item.changePercent);

    link.href = getSafeUrl(item.url);

    link.setAttribute(
      "aria-label",
      [companyName, price, change, `${changePercent}%`]
        .filter(Boolean)
        .join(", "),
    );

    /* Company name: resolves its own direction from its text. */

    const name = createElement("span", "market-ticker__name", companyName);

    name.dir = "auto";

    /* Price */

    const priceElement = createElement("data", "market-ticker__price", price);

    const numericPrice = parseNumber(item.price);

    if (numericPrice !== null) {
      priceElement.value = String(numericPrice);
    }

    /* Change. Neutral values intentionally receive no trend icon. */

    const changeElement = createElement(
      "span",
      `market-ticker__change ${state.className}`,
    );

    if (state.iconClass) {
      const icon = createElement(
        "span",
        `market-ticker__direction has-icon ${state.iconClass} icon-xm`,
      );

      icon.setAttribute("aria-hidden", "true");

      changeElement.append(icon);
    }

    changeElement.append(
      this.createDataValue(change, item.change),
      this.createDataValue(`(${changePercent}%)`, item.changePercent),
    );

    link.append(
      this.createLogo(item, companyName),
      name,
      priceElement,
      changeElement,
    );

    listItem.append(link);

    return listItem;
  }

  createDataValue(text, rawValue) {
    const element = createElement("data", "", text);

    const number = parseNumber(rawValue);

    if (number !== null) {
      element.value = String(number);
    }

    return element;
  }

  /* ========================================================================
     Company Logo
     ======================================================================== */

  /**
   * Initials sit underneath the image, so removing a failed image reveals
   * them without any extra work.
   */

  createLogo(item, companyName) {
    const shell = createElement("span", "market-ticker__logo");

    shell.setAttribute("aria-hidden", "true");

    shell.append(
      createElement(
        "span",
        "market-ticker__logo-initials",
        getCompanyInitials(companyName, this.language),
      ),
    );

    const logoUrl = getSafeUrl(item.logo, "");

    if (logoUrl) {
      this.appendLogoImage(shell, logoUrl, "primary");
    } else if (!fallbackLogoUnavailable) {
      this.appendLogoImage(shell, FALLBACK_LOGO_URL, "fallback");
    }

    return shell;
  }

  appendLogoImage(shell, source, stage) {
    const image = createElement("img", "market-ticker__logo-image");

    image.alt = "";

    /* Intrinsic size for the 2.5rem desktop shell; CSS handles responsive. */

    image.width = 40;
    image.height = 40;

    image.decoding = "async";
    image.loading = "eager";

    image.dataset.marketTickerLogoStage = stage;

    this.bindLogoError(image, shell);

    /* Listeners are attached before src is assigned. */

    image.src = source;

    shell.append(image);
  }

  bindLogoError(image, shell) {
    image.addEventListener(
      "error",
      () => {
        this.handleLogoError(image, shell);
      },
      { once: true },
    );
  }

  handleLogoError(image, shell) {
    if (this.destroyed || !image.isConnected) {
      return;
    }

    const stage = image.dataset.marketTickerLogoStage;

    image.remove();

    if (stage === "primary" && !fallbackLogoUnavailable) {
      this.appendLogoImage(shell, FALLBACK_LOGO_URL, "fallback");

      return;
    }

    if (stage === "fallback") {
      fallbackLogoUnavailable = true;

      this.track
        ?.querySelectorAll('[data-market-ticker-logo-stage="fallback"]')
        .forEach((fallbackImage) => fallbackImage.remove());
    }
  }

  /* ========================================================================
     Seamless Copies
     ======================================================================== */

  removeCopies() {
    this.track
      ?.querySelectorAll("[data-market-ticker-clone]")
      .forEach((copy) => copy.remove());
  }

  /**
   * Enough presentation copies to cover the viewport plus one full cycle.
   * cloneNode() does not copy listeners, so logo fallbacks are re-bound.
   */

  createCopies() {
    const totalCopies = Math.max(
      2,
      Math.ceil(this.viewportWidth / this.sourceWidth) + 2,
    );

    const fragment = document.createDocumentFragment();

    for (let index = 1; index < totalCopies; index += 1) {
      const clone = this.sourceList.cloneNode(true);

      clone.removeAttribute("data-market-ticker-list");

      clone.dataset.marketTickerClone = "";

      clone.setAttribute("aria-hidden", "true");

      clone.setAttribute("inert", "");

      clone.querySelectorAll("a").forEach((link) => {
        link.tabIndex = -1;
      });

      clone.querySelectorAll(".market-ticker__logo-image").forEach((image) => {
        const shell = image.closest(".market-ticker__logo");

        const isDeadFallback =
          image.dataset.marketTickerLogoStage === "fallback" &&
          fallbackLogoUnavailable;

        if (!shell || isDeadFallback) {
          image.remove();

          return;
        }

        this.bindLogoError(image, shell);
      });

      fragment.append(clone);
    }

    this.track.append(fragment);
  }

  /**
   * Measures, rebuilds the copies and (re)starts movement.
   */

  rebuildCopies({ restorePosition = false } = {}) {
    if (this.destroyed || !this.sourceList || !this.viewport) {
      return;
    }

    this.stopAnimation();

    this.removeCopies();

    this.viewport.scrollLeft = 0;

    this.sourceWidth = this.sourceList.getBoundingClientRect().width;

    this.viewportWidth = this.viewport.clientWidth;

    if (this.sourceWidth <= 0 || this.viewportWidth <= 0) {
      this.position = 0;

      this.applyPosition();

      return;
    }

    this.createCopies();

    if (restorePosition) {
      this.restorePosition();
    }

    this.normalisePosition();

    this.applyPosition();

    this.startAnimation();
  }

  /**
   * Keeps the position inside one source-list cycle. RTL starts one cycle
   * to the left so it can travel physically right.
   */

  normalisePosition() {
    if (this.sourceWidth <= 0) {
      this.position = 0;

      return;
    }

    let offset = this.position % this.sourceWidth;

    if (offset > 0) {
      offset -= this.sourceWidth;
    }

    if (this.direction === "rtl" && offset === 0) {
      offset = -this.sourceWidth;
    }

    this.position = offset;
  }

  /* ========================================================================
     Speed
     ======================================================================== */

  updateSpeed() {
    const speed = Number.parseFloat(
      getComputedStyle(this.root).getPropertyValue("--market-ticker-speed"),
    );

    this.speed =
      Number.isFinite(speed) && speed >= MINIMUM_SPEED ? speed : DEFAULT_SPEED;
  }

  /* ========================================================================
     Animation
     ======================================================================== */

  canMove() {
    return !this.destroyed && !this.pauseReasons.size && this.sourceWidth > 0;
  }

  applyPosition() {
    if (this.track) {
      this.track.style.transform = `translate3d(${this.position}px, 0, 0)`;
    }
  }

  handleFrame(timestamp) {
    this.frameId = null;

    if (!this.canMove()) {
      this.lastTimestamp = null;

      return;
    }

    this.lastTimestamp ??= timestamp;

    const elapsed = Math.min(
      (timestamp - this.lastTimestamp) / 1000,
      MAXIMUM_FRAME_TIME,
    );

    const distance = this.speed * elapsed;

    /* Wrapping by exactly one cycle is seamless because copies match. */

    if (this.direction === "rtl") {
      this.position += distance;

      if (this.position >= 0) {
        this.position -= this.sourceWidth;
      }
    } else {
      this.position -= distance;

      if (this.position <= -this.sourceWidth) {
        this.position += this.sourceWidth;
      }
    }

    this.applyPosition();

    this.lastTimestamp = timestamp;

    this.startAnimation();
  }

  startAnimation() {
    if (this.frameId !== null || !this.canMove()) {
      return;
    }

    this.frameId = window.requestAnimationFrame(this.handleFrame);
  }

  stopAnimation() {
    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId);

      this.frameId = null;
    }

    this.lastTimestamp = null;
  }

  /* ========================================================================
     Pause State
     ======================================================================== */

  setPaused(reason, paused) {
    if (paused) {
      this.pauseReasons.add(reason);
    } else {
      this.pauseReasons.delete(reason);
    }

    this.root.classList.toggle("is-paused", this.pauseReasons.size > 0);

    if (this.pauseReasons.size) {
      this.stopAnimation();

      return;
    }

    this.startAnimation();
  }

  /* ========================================================================
     Interaction
     ======================================================================== */

  handlePointerEnter() {
    this.setPaused("pointer", true);
  }

  handlePointerLeave() {
    this.setPaused("pointer", false);
  }

  handleFocusIn(event) {
    this.setPaused("focus", true);

    this.revealFocusedItem(event.target);
  }

  handleFocusOut(event) {
    if (event.relatedTarget && this.root.contains(event.relatedTarget)) {
      return;
    }

    this.setPaused("focus", false);
  }

  /**
   * Browsers scroll even overflow:hidden containers to reveal a focused
   * element, which would add a scroll offset on top of the transform.
   * The scroll is undone and the ticker moves the item into view instead.
   */

  handleViewportScroll() {
    if (!this.viewport || this.viewport.scrollLeft === 0) {
      return;
    }

    this.viewport.scrollLeft = 0;

    this.revealFocusedItem(document.activeElement);
  }

  revealFocusedItem(target) {
    if (
      !(target instanceof Element) ||
      !this.viewport?.contains(target) ||
      this.sourceWidth <= 0
    ) {
      return;
    }

    const link = target.closest(".market-ticker__link");

    if (!link) {
      return;
    }

    const bounds = this.viewport.getBoundingClientRect();

    const item = link.getBoundingClientRect();

    const inset = Math.min(FOCUS_INSET, bounds.width / 4);

    let shift = 0;

    if (item.left < bounds.left + inset) {
      shift = bounds.left + inset - item.left;
    } else if (item.right > bounds.right - inset) {
      shift = bounds.right - inset - item.right;
    }

    if (shift === 0) {
      return;
    }

    /* Any position within one cycle keeps the viewport fully covered. */

    this.position = Math.min(
      0,
      Math.max(-this.sourceWidth, this.position + shift),
    );

    this.applyPosition();
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.savePosition();
    }

    this.setPaused("document-hidden", document.hidden);
  }

  handlePageHide() {
    this.savePosition();
  }

  /* ========================================================================
     Preferences and Locale
     ======================================================================== */

  handlePreferenceMutations(mutations) {
    const attributes = new Set(
      mutations.map((mutation) => mutation.attributeName),
    );

    if (attributes.has("data-ticker-speed")) {
      this.updateSpeed();
    }

    if (attributes.has("data-ticker-visibility")) {
      this.syncVisibilityPreference();
    }

    if (attributes.has("dir") || attributes.has("lang")) {
      this.handleLocaleChange();
    }
  }

  /**
   * The stylesheet hides the ticker with display:none; the controller only
   * pauses it and keeps its place for when it is shown again.
   */

  syncVisibilityPreference() {
    const hidden =
      document.documentElement.dataset.tickerVisibility === "hidden";

    if (hidden) {
      this.savePosition();
    }

    this.setPaused("preference-hidden", hidden);

    if (!hidden) {
      this.handleResize();
    }
  }

  /**
   * A runtime direction or language change re-renders the items so
   * numbers, initials and travel direction all follow the new locale.
   */

  handleLocaleChange() {
    const direction = getDirection();

    const language = getLanguage();

    if (direction === this.direction && language === this.language) {
      return;
    }

    this.savePosition();

    this.direction = direction;

    this.language = language;

    this.updateFormatters();

    this.render();

    this.position = 0;

    this.rebuildCopies({ restorePosition: true });
  }

  /* ========================================================================
     Measurement
     ======================================================================== */

  /**
   * The viewport and the source list are observed, so width changes from
   * resizing, font loading or visibility all trigger one rebuild per frame.
   */

  observeLayout() {
    if (typeof window.ResizeObserver !== "function") {
      return;
    }

    this.resizeObserver ??= new ResizeObserver(this.handleResize);

    this.resizeObserver.disconnect();

    this.resizeObserver.observe(this.viewport);

    this.resizeObserver.observe(this.sourceList);
  }

  handleResize() {
    if (this.destroyed || this.resizeFrameId !== null) {
      return;
    }

    this.resizeFrameId = window.requestAnimationFrame(() => {
      this.resizeFrameId = null;

      if (this.destroyed || !this.root.isConnected || !this.viewport) {
        return;
      }

      const viewportChanged =
        Math.abs(this.viewport.clientWidth - this.viewportWidth) > 0.5;

      const sourceChanged =
        Math.abs(
          this.sourceList.getBoundingClientRect().width - this.sourceWidth,
        ) > 0.5;

      if (!viewportChanged && !sourceChanged) {
        return;
      }

      /* Coming back from zero size (e.g. un-hidden): continue in place. */

      this.rebuildCopies({ restorePosition: this.sourceWidth <= 0 });
    });
  }

  /* ========================================================================
     Position Persistence
     ======================================================================== */

  getPositionStorageKey() {
    const source =
      this.root.dataset.marketTickerSource || this.root.id || "default";

    return [POSITION_STORAGE_PREFIX, source, this.direction].join(":");
  }

  savePosition() {
    if (this.destroyed || this.sourceWidth <= 0) {
      return;
    }

    let offset = -this.position % this.sourceWidth;

    if (offset < 0) {
      offset += this.sourceWidth;
    }

    const progress = offset / this.sourceWidth;

    if (!Number.isFinite(progress)) {
      return;
    }

    try {
      window.sessionStorage.setItem(
        this.getPositionStorageKey(),
        String(progress),
      );
    } catch {
      /* Storage unavailable: the ticker simply starts from the beginning. */
    }
  }

  restorePosition() {
    let storedValue = null;

    try {
      storedValue = window.sessionStorage.getItem(this.getPositionStorageKey());
    } catch {
      return;
    }

    const progress = Number.parseFloat(storedValue);

    if (Number.isFinite(progress) && progress >= 0 && progress < 1) {
      this.position = -progress * this.sourceWidth;
    }
  }

  /* ========================================================================
     Events
     ======================================================================== */

  bindEvents() {
    const root = document.documentElement;

    this.listen(this.root, "pointerenter", this.handlePointerEnter);
    this.listen(this.root, "pointerleave", this.handlePointerLeave);
    this.listen(this.root, "focusin", this.handleFocusIn);
    this.listen(this.root, "focusout", this.handleFocusOut);

    this.listen(document, "visibilitychange", this.handleVisibilityChange);
    this.listen(window, "pagehide", this.handlePageHide);

    if (typeof window.ResizeObserver !== "function") {
      this.listen(window, "resize", this.handleResize, { passive: true });
    }

    /* Pause while outside the browser viewport. */

    if (typeof window.IntersectionObserver === "function") {
      this.intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          this.setPaused("outside-viewport", !entry.isIntersecting);
        },
        { threshold: 0 },
      );

      this.intersectionObserver.observe(this.root);
    }

    /* Only attributes that affect ticker mechanics are observed. */

    this.preferenceObserver = new MutationObserver(
      this.handlePreferenceMutations,
    );

    this.preferenceObserver.observe(root, {
      attributes: true,
      attributeFilter: [
        "data-ticker-speed",
        "data-ticker-visibility",
        "dir",
        "lang",
      ],
    });

    this.setPaused("document-hidden", document.hidden);

    this.syncVisibilityPreference();
  }

  listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);

    this.cleanups.push(() => {
      target.removeEventListener(type, listener, options);
    });
  }

  /* ========================================================================
     Cleanup
     ======================================================================== */

  destroy() {
    if (this.destroyed) {
      return;
    }

    /* Saved first: savePosition() ignores destroyed controllers. */

    this.savePosition();

    this.destroyed = true;

    this.stopAnimation();

    if (this.resizeFrameId !== null) {
      window.cancelAnimationFrame(this.resizeFrameId);

      this.resizeFrameId = null;
    }

    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.preferenceObserver?.disconnect();

    this.cleanups.forEach((cleanup) => cleanup());

    this.cleanups = [];

    this.viewport?.removeEventListener("scroll", this.handleViewportScroll);

    this.viewport?.remove();

    this.viewport = null;
    this.track = null;
    this.sourceList = null;

    this.root.classList.remove("is-ready", "is-paused");

    this.root.removeAttribute("data-market-ticker-initialized");

    controllers.delete(this.root);
  }
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function initMarketTicker(container = document) {
  for (const root of collectRoots(container)) {
    if (controllers.has(root)) {
      continue;
    }

    const controller = new MarketTicker(root, getTickerData(root));

    controllers.set(root, controller);

    controller.init();
  }
}

export function destroyMarketTicker(container = document) {
  for (const root of collectRoots(container)) {
    controllers.get(root)?.destroy();
  }
}

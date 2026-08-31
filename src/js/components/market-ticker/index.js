/* ==========================================================================
   Market Ticker
   ========================================================================== */

/**
 * Saudi Exchange market ticker.
 *
 * Principles:
 *
 * - Physical ticker geometry is always LTR.
 * - Page direction controls travel direction only:
 *     LTR -> travels left
 *     RTL -> travels right
 * - Company names use dir="auto".
 * - Financial values remain LTR.
 * - Animation uses requestAnimationFrame.
 * - Animation stops when:
 *     - document is hidden
 *     - ticker is outside the viewport
 *     - pointer is over the ticker
 *     - ticker contains keyboard focus
 *     - reduced motion is enabled
 *     - ticker visibility preference is hidden
 * - Presentation clones are inaccessible:
 *     aria-hidden + inert + tabindex=-1.
 * - Logo fallback:
 *     company logo -> /no-image.png -> initials.
 * - Position persistence is throttled and never written every frame.
 */

const DEFAULT_SPEED = 48;
const MINIMUM_SPEED = 1;
const MAXIMUM_FRAME_TIME = 0.1;

const FALLBACK_LOGO_URL = "/no-image.png";

const POSITION_SAVE_INTERVAL = 5000;
const POSITION_STORAGE_PREFIX = "se-market-ticker-position";

const controllers = new WeakMap();

/* ==========================================================================
   Shared State
   ========================================================================== */

/**
 * If /no-image.png fails once, do not keep trying it for every broken
 * company logo during the current page lifecycle.
 */
let fallbackLogoUnavailable = false;

/* ==========================================================================
   Direction / Language
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
   Motion
   ========================================================================== */

function hasReducedMotion(motionQuery) {
  return (
    document.documentElement.dataset.motion === "reduce" || motionQuery.matches
  );
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

/* ==========================================================================
   Price State
   ========================================================================== */

function getPriceState(changePercent) {
  const value = parseNumber(changePercent);

  if (value === null || value === 0) {
    return {
      className: "price-neutral",
      iconClass: null,
    };
  }

  if (value > 0) {
    return {
      className: "price-up",
      iconClass: "icon-trending-up",
    };
  }

  return {
    className: "price-down",
    iconClass: "icon-trending-down",
  };
}

/* ==========================================================================
   URLs
   ========================================================================== */

function getSafeUrl(
  value,
  fallback = "#",
  { allowHttp = true, allowHttps = true } = {},
) {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  try {
    const url = new URL(value.trim(), window.location.origin);

    const allowedProtocols = [];

    if (allowHttp) {
      allowedProtocols.push("http:");
    }

    if (allowHttps) {
      allowedProtocols.push("https:");
    }

    if (!allowedProtocols.includes(url.protocol)) {
      return fallback;
    }

    return url.href;
  } catch {
    return fallback;
  }
}

/**
 * Logo URLs use the same URL validation as normal links.
 *
 * This protects against malformed/javascript/data URLs, but note that no
 * client-side code can prevent DevTools from reporting the initial request
 * when a syntactically valid remote hostname does not resolve.
 */
function getSafeLogoUrl(value) {
  return getSafeUrl(value, "");
}

/* ==========================================================================
   Initials
   ========================================================================== */

function getCompanyInitials(companyName) {
  const words = String(companyName || "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);

  if (!words.length) {
    return "";
  }

  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] || "")
    .filter(Boolean)
    .join(" ");
}

/* ==========================================================================
   Data
   ========================================================================== */

function getTickerData(root) {
  const sourceId = root.dataset.marketTickerSource;

  if (!sourceId) {
    return [];
  }

  const source = document.getElementById(sourceId);

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

/* ==========================================================================
   Media Query Helper
   ========================================================================== */

function addMediaQueryListener(mediaQuery, listener) {
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", listener);

    return () => {
      mediaQuery.removeEventListener("change", listener);
    };
  }

  /*
   * Safari legacy fallback.
   */
  mediaQuery.addListener(listener);

  return () => {
    mediaQuery.removeListener(listener);
  };
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

    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    this.reducedMotion = hasReducedMotion(this.motionQuery);

    this.speed = DEFAULT_SPEED;

    this.sourceWidth = 0;
    this.position = 0;

    this.measuredViewportWidth = 0;
    this.measuredSourceWidth = 0;

    this.frameId = null;
    this.resizeFrameId = null;
    this.lastTimestamp = null;

    this.pauseReasons = new Set();
    this.cleanups = [];

    this.resizeObserver = null;
    this.intersectionObserver = null;
    this.preferenceObserver = null;

    this.positionSaveTimer = null;

    this.destroyed = false;

    this.handleFrame = this.handleFrame.bind(this);

    this.handlePointerEnter = this.handlePointerEnter.bind(this);

    this.handlePointerLeave = this.handlePointerLeave.bind(this);

    this.handleFocusIn = this.handleFocusIn.bind(this);

    this.handleFocusOut = this.handleFocusOut.bind(this);

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    this.handleMotionChange = this.handleMotionChange.bind(this);

    this.handleResize = this.handleResize.bind(this);

    this.handlePageHide = this.handlePageHide.bind(this);

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
    this.configureMotion();

    this.root.classList.add("is-ready");

    this.root.dataset.marketTickerInitialized = "true";

    this.waitForFonts();
  }

  /* ========================================================================
     Formatting
     ======================================================================== */

  updateFormatters() {
    this.numberFormatter = new Intl.NumberFormat(this.language, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    this.signedNumberFormatter = new Intl.NumberFormat(this.language, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: "exceptZero",
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

  render() {
    /*
     * Do not retain stale rendered DOM if the controller is re-rendered.
     */
    this.viewport?.remove();

    this.viewport = createElement(
      "div",
      "market-ticker__viewport custom-scrollbar",
    );

    this.viewport.dataset.marketTickerViewport = "";

    /*
     * Physical coordinate origin is always LTR.
     */
    this.viewport.dir = "ltr";

    this.track = createElement("div", "market-ticker__track");

    this.track.dataset.marketTickerTrack = "";

    this.track.dir = "ltr";

    this.sourceList = this.createList(this.data);

    this.sourceList.dataset.marketTickerList = "";

    /*
     * The list also remains physically LTR.
     * Individual company names use dir="auto".
     */
    this.sourceList.dir = "ltr";

    this.track.append(this.sourceList);
    this.viewport.append(this.track);
    this.root.append(this.viewport);
  }

  createList(items) {
    const list = createElement("ul", "market-ticker__list");

    list.dir = "ltr";

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

    /*
     * Company logo.
     */
    link.append(this.createLogo(item, companyName));

    /*
     * Company name.
     */
    const name = createElement("span", "market-ticker__name", companyName);

    name.dir = "auto";

    /*
     * Price.
     */
    const priceElement = createElement("data", "market-ticker__price", price);

    const numericPrice = parseNumber(item.price);

    if (numericPrice !== null) {
      priceElement.value = String(numericPrice);
    }

    /*
     * Change.
     */
    const changeElement = createElement(
      "span",
      ["market-ticker__change", state.className].join(" "),
    );

    /*
     * Neutral values intentionally do not
     * receive a trending icon.
     */
    if (state.iconClass) {
      const directionIcon = createElement(
        "span",
        [
          "market-ticker__direction",
          "has-icon",
          state.iconClass,
          "icon-sm",
        ].join(" "),
      );

      directionIcon.setAttribute("aria-hidden", "true");

      changeElement.append(directionIcon);
    }

    const changeValue = createElement("data", "", change);

    const percentageValue = createElement("data", "", `(${changePercent}%)`);

    const numericChange = parseNumber(item.change);

    const numericPercentage = parseNumber(item.changePercent);

    if (numericChange !== null) {
      changeValue.value = String(numericChange);
    }

    if (numericPercentage !== null) {
      percentageValue.value = String(numericPercentage);
    }

    changeElement.append(changeValue, percentageValue);

    link.append(name, priceElement, changeElement);

    listItem.append(link);

    return listItem;
  }

  /* ========================================================================
     Company Logo
     ======================================================================== */

  createLogo(item, companyName) {
    const shell = createElement("span", "market-ticker__logo");

    shell.setAttribute("aria-hidden", "true");

    const initials = createElement(
      "span",
      "market-ticker__logo-initials",
      getCompanyInitials(companyName, this.language),
    );

    shell.append(initials);

    const logoUrl = getSafeLogoUrl(item.logo);

    if (!logoUrl) {
      if (!fallbackLogoUnavailable) {
        this.appendLogoImage(shell, FALLBACK_LOGO_URL, "fallback");
      }

      return shell;
    }

    this.appendLogoImage(shell, logoUrl, "primary");

    return shell;
  }

  appendLogoImage(shell, source, stage) {
    const image = createElement("img", "market-ticker__logo-image");

    image.alt = "";

    image.width = 32;
    image.height = 32;

    image.decoding = "async";
    image.loading = "eager";

    image.dataset.marketTickerLogoStage = stage;

    image.addEventListener(
      "load",
      () => {
        image.dataset.marketTickerLogoLoaded = "true";
      },
      {
        once: true,
      },
    );

    image.addEventListener(
      "error",
      () => {
        this.handleLogoError(image, shell);
      },
      {
        once: true,
      },
    );

    /*
     * Attach listeners before assigning src.
     */
    image.src = source;

    shell.append(image);
  }

  handleLogoError(image, shell) {
    if (this.destroyed || !image.isConnected) {
      return;
    }

    const stage = image.dataset.marketTickerLogoStage;

    image.remove();

    /*
     * Primary logo failed:
     *
     * logo -> /no-image.png
     */
    if (stage === "primary" && !fallbackLogoUnavailable) {
      this.appendLogoImage(shell, FALLBACK_LOGO_URL, "fallback");

      return;
    }

    /*
     * /no-image.png also failed.
     *
     * Remember this once so later companies go
     * directly to their initials.
     */
    if (stage === "fallback") {
      fallbackLogoUnavailable = true;

      this.removeFallbackImages();
    }

    /*
     * Initials are already present underneath,
     * so removing the image reveals them.
     */
  }

  removeFallbackImages() {
    if (!this.track) {
      return;
    }

    const fallbackImages = this.track.querySelectorAll(
      '[data-market-ticker-logo-stage="fallback"]',
    );

    for (const image of fallbackImages) {
      image.remove();
    }
  }

  /* ========================================================================
     Clone Logo Events
     ======================================================================== */

  /**
   * cloneNode() does not copy event listeners.
   *
   * Reconnect logo failure handling on every presentation clone.
   */
  bindCloneLogoImages(clone) {
    const images = clone.querySelectorAll(".market-ticker__logo-image");

    for (const image of images) {
      const shell = image.closest(".market-ticker__logo");

      if (!shell) {
        image.remove();

        continue;
      }

      /*
       * If the shared fallback is already known
       * to be unavailable, do not request it again.
       */
      if (
        image.dataset.marketTickerLogoStage === "fallback" &&
        fallbackLogoUnavailable
      ) {
        image.remove();

        continue;
      }

      image.addEventListener(
        "error",
        () => {
          this.handleLogoError(image, shell);
        },
        {
          once: true,
        },
      );
    }
  }

  /* ========================================================================
     Seamless Copies
     ======================================================================== */

  removeCopies() {
    if (!this.track) {
      return;
    }

    const copies = this.track.querySelectorAll("[data-market-ticker-clone]");

    for (const copy of copies) {
      copy.remove();
    }
  }

  createCopies() {
    if (!this.sourceList || this.sourceWidth <= 0) {
      return;
    }

    const totalCopies = Math.max(
      2,
      Math.ceil(this.measuredViewportWidth / this.sourceWidth) + 2,
    );

    const fragment = document.createDocumentFragment();

    for (let index = 1; index < totalCopies; index += 1) {
      const clone = this.sourceList.cloneNode(true);

      clone.dataset.marketTickerClone = "";

      clone.removeAttribute("data-market-ticker-list");

      clone.setAttribute("aria-hidden", "true");

      clone.setAttribute("inert", "");

      clone.dir = "ltr";

      for (const link of clone.querySelectorAll("a")) {
        link.tabIndex = -1;
      }

      this.bindCloneLogoImages(clone);

      fragment.append(clone);
    }

    this.track.append(fragment);
  }

  rebuildCopies({ restorePosition = false } = {}) {
    if (this.destroyed || !this.sourceList || !this.viewport) {
      return;
    }

    this.stopAnimation();
    this.removeCopies();

    this.sourceWidth = this.sourceList.getBoundingClientRect().width;

    this.measuredSourceWidth = this.sourceWidth;

    this.measuredViewportWidth = this.viewport.clientWidth;

    if (this.sourceWidth <= 0 || this.measuredViewportWidth <= 0) {
      this.position = 0;

      this.applyPosition();

      return;
    }

    /*
     * Reduced motion uses only the accessible
     * source list and manual scrolling.
     */
    if (this.reducedMotion) {
      this.position = 0;

      this.applyPosition();

      return;
    }

    this.createCopies();

    if (restorePosition) {
      const restored = this.restorePosition();

      if (!restored) {
        this.setInitialPosition();
      }
    } else {
      this.normalisePosition();
    }

    this.applyPosition();
    this.startAnimation();
  }

  setInitialPosition() {
    this.position = this.direction === "rtl" ? -this.sourceWidth : 0;
  }

  normalisePosition() {
    if (this.sourceWidth <= 0) {
      this.position = 0;

      return;
    }

    /*
     * Keep the position inside one source-list
     * cycle after resize/font changes.
     */
    let offset = this.position % this.sourceWidth;

    if (offset > 0) {
      offset -= this.sourceWidth;
    }

    /*
     * LTR may safely start at zero.
     * RTL must begin one complete source width
     * to the left so it can travel right.
     */
    if (this.direction === "rtl" && offset === 0) {
      offset = -this.sourceWidth;
    }

    this.position = offset;
  }

  /* ========================================================================
     Speed
     ======================================================================== */

  updateSpeed() {
    const computedSpeed = Number.parseFloat(
      getComputedStyle(this.root).getPropertyValue("--market-ticker-speed"),
    );

    this.speed =
      Number.isFinite(computedSpeed) && computedSpeed >= MINIMUM_SPEED
        ? computedSpeed
        : DEFAULT_SPEED;
  }

  /* ========================================================================
     Animation
     ======================================================================== */

  applyPosition() {
    if (!this.track) {
      return;
    }

    this.track.style.transform = `translate3d(${this.position}px, 0, 0)`;
  }

  handleFrame(timestamp) {
    this.frameId = null;

    if (
      this.destroyed ||
      this.pauseReasons.size ||
      this.reducedMotion ||
      this.sourceWidth <= 0
    ) {
      this.lastTimestamp = null;

      return;
    }

    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
    }

    /*
     * Clamp long browser frames so returning from
     * a suspended tab cannot create a large jump.
     */
    const elapsed = Math.min(
      (timestamp - this.lastTimestamp) / 1000,
      MAXIMUM_FRAME_TIME,
    );

    const distance = this.speed * elapsed;

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
    if (
      this.destroyed ||
      this.frameId !== null ||
      this.pauseReasons.size ||
      this.reducedMotion ||
      this.sourceWidth <= 0
    ) {
      return;
    }

    this.root.classList.remove("is-paused");

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

    if (this.pauseReasons.size) {
      this.root.classList.add("is-paused");

      this.stopAnimation();

      return;
    }

    this.root.classList.remove("is-paused");

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

  handleFocusIn() {
    this.setPaused("focus", true);
  }

  handleFocusOut(event) {
    if (event.relatedTarget && this.root.contains(event.relatedTarget)) {
      return;
    }

    this.setPaused("focus", false);
  }

  handleVisibilityChange() {
    this.setPaused("document-hidden", document.hidden);

    if (document.hidden) {
      this.savePosition();
    }
  }

  handleMotionChange() {
    this.configureMotion();
  }

  handlePageHide() {
    this.savePosition();
  }

  /* ========================================================================
     Measurement
     ======================================================================== */

  handleResize() {
    if (this.destroyed || this.resizeFrameId !== null) {
      return;
    }

    /*
     * Collapse all ResizeObserver notifications from
     * the current frame into one measurement.
     */
    this.resizeFrameId = window.requestAnimationFrame(() => {
      this.resizeFrameId = null;

      if (this.destroyed || !this.root.isConnected) {
        return;
      }

      const nextDirection = getDirection();

      const nextViewportWidth = this.viewport.clientWidth;

      const nextSourceWidth = this.sourceList.getBoundingClientRect().width;

      const directionChanged = nextDirection !== this.direction;

      const viewportChanged =
        Math.abs(nextViewportWidth - this.measuredViewportWidth) > 0.5;

      const sourceChanged =
        Math.abs(nextSourceWidth - this.measuredSourceWidth) > 0.5;

      if (!directionChanged && !viewportChanged && !sourceChanged) {
        return;
      }

      if (directionChanged) {
        this.direction = nextDirection;

        /*
         * Direction affects movement only.
         * The DOM geometry remains LTR.
         */
        this.setInitialPosition();
      }

      this.updateSpeed();

      this.rebuildCopies();
    });
  }

  /* ========================================================================
     Reduced Motion
     ======================================================================== */

  configureMotion() {
    const wasReduced = this.reducedMotion;

    this.reducedMotion = hasReducedMotion(this.motionQuery);

    if (this.reducedMotion) {
      this.pauseReasons.add("reduced-motion");

      this.root.classList.add("is-paused");

      this.stopAnimation();

      this.removeCopies();

      this.position = 0;
      this.applyPosition();

      this.viewport.scrollLeft = 0;

      return;
    }

    this.pauseReasons.delete("reduced-motion");

    /*
     * Restore the last ticker position only during
     * initial setup / transition out of reduced motion.
     */
    this.rebuildCopies({
      restorePosition: wasReduced || this.sourceWidth === 0,
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

  getPositionProgress() {
    if (this.sourceWidth <= 0) {
      return null;
    }

    /*
     * Convert current physical offset to one normalised
     * cycle in the range [0, 1).
     */
    let offset = -this.position % this.sourceWidth;

    if (offset < 0) {
      offset += this.sourceWidth;
    }

    return offset / this.sourceWidth;
  }

  savePosition() {
    if (this.destroyed || this.reducedMotion || this.sourceWidth <= 0) {
      return;
    }

    const progress = this.getPositionProgress();

    if (progress === null || !Number.isFinite(progress)) {
      return;
    }

    try {
      sessionStorage.setItem(this.getPositionStorageKey(), String(progress));
    } catch {
      /*
       * Storage may be blocked.
       * Ticker operation must not depend on it.
       */
    }
  }

  restorePosition() {
    if (this.sourceWidth <= 0) {
      return false;
    }

    let storedValue = null;

    try {
      storedValue = sessionStorage.getItem(this.getPositionStorageKey());
    } catch {
      return false;
    }

    if (storedValue === null) {
      return false;
    }

    const progress = Number.parseFloat(storedValue);

    if (!Number.isFinite(progress) || progress < 0 || progress >= 1) {
      return false;
    }

    let position = -progress * this.sourceWidth;

    if (this.direction === "rtl" && position === 0) {
      position = -this.sourceWidth;
    }

    this.position = position;

    return true;
  }

  startPositionPersistence() {
    if (this.positionSaveTimer !== null) {
      return;
    }

    this.positionSaveTimer = window.setInterval(() => {
      if (!document.hidden && !this.pauseReasons.size) {
        this.savePosition();
      }
    }, POSITION_SAVE_INTERVAL);
  }

  stopPositionPersistence() {
    if (this.positionSaveTimer === null) {
      return;
    }

    window.clearInterval(this.positionSaveTimer);

    this.positionSaveTimer = null;
  }

  /* ========================================================================
     Observers / Events
     ======================================================================== */

  bindEvents() {
    this.viewport.addEventListener("pointerenter", this.handlePointerEnter);

    this.viewport.addEventListener("pointerleave", this.handlePointerLeave);

    this.root.addEventListener("focusin", this.handleFocusIn);

    this.root.addEventListener("focusout", this.handleFocusOut);

    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    window.addEventListener("pagehide", this.handlePageHide);

    const removeMotionListener = addMediaQueryListener(
      this.motionQuery,
      this.handleMotionChange,
    );

    this.cleanups.push(() => {
      this.viewport.removeEventListener(
        "pointerenter",
        this.handlePointerEnter,
      );

      this.viewport.removeEventListener(
        "pointerleave",
        this.handlePointerLeave,
      );

      this.root.removeEventListener("focusin", this.handleFocusIn);

      this.root.removeEventListener("focusout", this.handleFocusOut);

      document.removeEventListener(
        "visibilitychange",
        this.handleVisibilityChange,
      );

      window.removeEventListener("pagehide", this.handlePageHide);

      removeMotionListener();
    });

    /*
     * ResizeObserver only watches the viewport.
     * Presentation clones are intentionally not observed.
     */
    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(this.handleResize);

      this.resizeObserver.observe(this.viewport);
    } else {
      window.addEventListener("resize", this.handleResize, {
        passive: true,
      });

      this.cleanups.push(() => {
        window.removeEventListener("resize", this.handleResize);
      });
    }

    /*
     * Stop animation when the ticker itself is outside
     * the visible viewport.
     */
    if ("IntersectionObserver" in window) {
      const bounds = this.root.getBoundingClientRect();

      const initiallyOutsideViewport =
        bounds.bottom <= 0 || bounds.top >= window.innerHeight;

      this.setPaused("outside-viewport", initiallyOutsideViewport);

      this.intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          this.setPaused("outside-viewport", !entry.isIntersecting);
        },
        {
          threshold: 0,
        },
      );

      this.intersectionObserver.observe(this.root);
    }

    /*
     * Observe only settings that actually affect ticker
     * mechanics. Theme/accent are intentionally excluded.
     */
    this.preferenceObserver = new MutationObserver((mutations) => {
      const attributes = new Set(
        mutations.map((mutation) => mutation.attributeName),
      );

      if (attributes.has("data-ticker-speed")) {
        this.updateSpeed();
      }

      if (attributes.has("dir")) {
        const nextDirection = getDirection();

        if (nextDirection !== this.direction) {
          this.savePosition();

          this.direction = nextDirection;

          this.setInitialPosition();
          this.rebuildCopies({
            restorePosition: true,
          });
        }
      }

      if (attributes.has("lang")) {
        this.language = getLanguage();

        this.updateFormatters();

        /*
         * Source content is server/localisation owned.
         * We don't rebuild company text from another
         * language dataset here, but measurements may
         * change after the page language changes.
         */
        this.rebuildCopies();
      }

      if (attributes.has("data-motion")) {
        this.configureMotion();
      }

      if (attributes.has("data-ticker-visibility")) {
        const hidden =
          document.documentElement.dataset.tickerVisibility === "hidden";

        this.setPaused("preference-hidden", hidden);

        if (!hidden) {
          this.handleResize();
        }
      }
    });

    this.preferenceObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "data-motion",
        "data-ticker-speed",
        "data-ticker-visibility",
        "dir",
        "lang",
      ],
    });

    this.setPaused("document-hidden", document.hidden);

    this.setPaused(
      "preference-hidden",
      document.documentElement.dataset.tickerVisibility === "hidden",
    );

    this.startPositionPersistence();
  }

  /* ========================================================================
     Fonts
     ======================================================================== */

  waitForFonts() {
    if (!document.fonts?.ready) {
      return;
    }

    document.fonts.ready
      .then(() => {
        if (this.destroyed || !this.root.isConnected) {
          return;
        }

        this.rebuildCopies();
      })
      .catch(() => {
        /*
         * A font failure must never prevent the ticker
         * from operating with its fallback font.
         */
      });
  }

  /* ========================================================================
     Cleanup
     ======================================================================== */

  destroy() {
    if (this.destroyed) {
      return;
    }

    /*
     * Save before marking destroyed because savePosition()
     * intentionally ignores destroyed controllers.
     */
    this.savePosition();

    this.destroyed = true;

    this.stopAnimation();
    this.stopPositionPersistence();

    if (this.resizeFrameId !== null) {
      window.cancelAnimationFrame(this.resizeFrameId);

      this.resizeFrameId = null;
    }

    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.preferenceObserver?.disconnect();

    for (const cleanup of this.cleanups) {
      cleanup();
    }

    this.cleanups = [];

    this.root.classList.remove("is-ready", "is-paused");

    this.root.removeAttribute("data-market-ticker-initialized");

    this.viewport?.remove();

    this.viewport = null;
    this.track = null;
    this.sourceList = null;

    controllers.delete(this.root);
  }
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function initMarketTicker(container = document) {
  const roots = [];

  if (
    container instanceof Element &&
    container.matches("[data-market-ticker]")
  ) {
    roots.push(container);
  }

  roots.push(...container.querySelectorAll("[data-market-ticker]"));

  for (const root of roots) {
    if (controllers.has(root)) {
      continue;
    }

    const data = getTickerData(root);

    const controller = new MarketTicker(root, data);

    controllers.set(root, controller);

    controller.init();
  }
}

export function destroyMarketTicker(container = document) {
  const roots = [];

  if (
    container instanceof Element &&
    container.matches("[data-market-ticker]")
  ) {
    roots.push(container);
  }

  roots.push(...container.querySelectorAll("[data-market-ticker]"));

  for (const root of roots) {
    controllers.get(root)?.destroy();
  }
}

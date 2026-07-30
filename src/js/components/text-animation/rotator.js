import { ARIA, CLASS_NAMES, CSS_PROPERTIES, DEFAULTS } from "./constants";
import {
  clearTimer,
  nextAnimationFrame,
  restoreAttribute,
  setCssTime,
} from "./utils";

/* ==========================================================================
   Phrase Rotator
   ========================================================================== */

/**
 * Manages one rotating-phrase component.
 *
 * The first phrase remains visible before enhancement. Automatic rotation is
 * disabled when reduced motion is requested, while manual previous/next
 * controls continue to work without animated transitions.
 */

export class RotatorAnimation {
  constructor(
    element,
    {
      interval = DEFAULTS.rotateInterval,
      duration = DEFAULTS.rotateDuration,
      delay = DEFAULTS.delay,
      reducedMotion = false,
      onChange = null,
      onStart = null,
    } = {},
  ) {
    this.element = element;
    this.document = element.ownerDocument;
    this.view = this.document.defaultView;

    this.phrases = Array.from(
      element.querySelectorAll(":scope > [data-text-animation-phrase]"),
    );

    this.config = {
      interval: Math.max(DEFAULTS.minimumInterval, interval),

      duration: Math.max(0, duration),
      delay: Math.max(0, delay),
      reducedMotion,
    };

    this.onChange = typeof onChange === "function" ? onChange : null;

    this.onStart = typeof onStart === "function" ? onStart : null;

    this.original = {
      live: element.getAttribute(ARIA.live),
      atomic: element.getAttribute(ARIA.atomic),

      phrases: this.phrases.map((phrase) => ({
        element: phrase,
        hidden: phrase.getAttribute("hidden"),
        ariaHidden: phrase.getAttribute(ARIA.hidden),
        className: phrase.getAttribute("class"),
      })),
    };

    const initiallyActiveIndex = this.phrases.findIndex(
      (phrase) =>
        phrase.classList.contains(CLASS_NAMES.active) ||
        !phrase.hasAttribute("hidden"),
    );

    this.state = {
      prepared: false,
      running: false,
      paused: false,
      transitioning: false,
      destroyed: false,

      activeIndex: initiallyActiveIndex >= 0 ? initiallyActiveIndex : 0,
    };

    this.rotationTimer = null;
    this.transitionTimer = null;
    this.startTimer = null;
    this.transitionToken = 0;

    this.resizeObserver = null;
  }

  /* ========================================================================
     State
     ======================================================================== */

  get activePhrase() {
    return this.phrases[this.state.activeIndex] || null;
  }

  get hasMultiplePhrases() {
    return this.phrases.length > 1;
  }

  /* ========================================================================
     Preparation
     ======================================================================== */

  prepare() {
    if (
      this.state.destroyed ||
      this.state.prepared ||
      this.phrases.length === 0
    ) {
      return this.state.prepared;
    }

    this.applyTimingProperties();

    if (!this.element.hasAttribute(ARIA.live)) {
      this.element.setAttribute(ARIA.live, "polite");
    }

    if (!this.element.hasAttribute(ARIA.atomic)) {
      this.element.setAttribute(ARIA.atomic, "true");
    }

    this.phrases.forEach((phrase, index) => {
      phrase.removeAttribute("hidden");

      phrase.classList.remove(
        CLASS_NAMES.active,
        CLASS_NAMES.entering,
        CLASS_NAMES.leaving,
      );

      const active = index === this.state.activeIndex;

      phrase.classList.toggle(CLASS_NAMES.active, active);
      phrase.setAttribute(ARIA.hidden, active ? "false" : "true");
    });

    this.element.classList.add(CLASS_NAMES.ready);

    this.state.prepared = true;

    this.measure();

    if (typeof this.view.ResizeObserver === "function") {
      this.resizeObserver = new this.view.ResizeObserver(() => {
        if (!this.state.destroyed) {
          this.measure();
        }
      });

      this.resizeObserver.observe(this.element);
    }

    return true;
  }

  applyTimingProperties() {
    setCssTime(
      this.element,
      "--text-animation-rotate-duration",
      this.config.duration,
    );

    setCssTime(this.element, CSS_PROPERTIES.delay, this.config.delay);

    setCssTime(this.element, CSS_PROPERTIES.runtimeDelay, this.config.delay);
  }

  /* ========================================================================
     Measurement
     ======================================================================== */

  measure() {
    if (!this.state.prepared || this.state.destroyed) {
      return;
    }

    let maximumInlineSize = 0;
    let maximumBlockSize = 0;

    this.phrases.forEach((phrase) => {
      const rectangle = phrase.getBoundingClientRect();

      maximumInlineSize = Math.max(
        maximumInlineSize,
        rectangle.width,
        phrase.scrollWidth,
      );

      maximumBlockSize = Math.max(
        maximumBlockSize,
        rectangle.height,
        phrase.scrollHeight,
      );
    });

    if (maximumInlineSize > 0) {
      this.element.style.setProperty(
        CSS_PROPERTIES.rotateInlineSize,
        `${Math.ceil(maximumInlineSize)}px`,
      );
    }

    if (maximumBlockSize > 0) {
      this.element.style.setProperty(
        CSS_PROPERTIES.rotateBlockSize,
        `${Math.ceil(maximumBlockSize)}px`,
      );
    }
  }

  /* ========================================================================
     Automatic Rotation
     ======================================================================== */

  start({ immediate = false } = {}) {
    if (this.state.destroyed || !this.prepare()) {
      return false;
    }

    if (this.state.running) {
      return true;
    }

    this.state.running = true;
    this.state.paused = false;

    this.element.classList.remove(CLASS_NAMES.paused);

    this.onStart?.();

    if (this.config.reducedMotion || !this.hasMultiplePhrases) {
      return true;
    }

    this.clearStartTimer();

    if (immediate || this.config.delay === 0) {
      this.scheduleNext();
      return true;
    }

    this.startTimer = this.view.setTimeout(() => {
      this.startTimer = null;

      if (this.state.running && !this.state.paused && !this.state.destroyed) {
        this.scheduleNext();
      }
    }, this.config.delay);

    return true;
  }

  stop() {
    if (this.state.destroyed) {
      return false;
    }

    this.clearTimers();

    this.state.running = false;
    this.state.paused = false;

    this.element.classList.remove(CLASS_NAMES.paused);

    return true;
  }

  scheduleNext() {
    this.clearRotationTimer();

    if (
      !this.state.running ||
      this.state.paused ||
      this.state.destroyed ||
      this.config.reducedMotion ||
      !this.hasMultiplePhrases
    ) {
      return;
    }

    this.rotationTimer = this.view.setTimeout(() => {
      this.rotationTimer = null;

      if (!this.state.running || this.state.paused || this.state.destroyed) {
        return;
      }

      this.next({
        source: "automatic",
      });
    }, this.config.interval);
  }

  /* ========================================================================
     Navigation
     ======================================================================== */

  next({ source = "next" } = {}) {
    if (!this.hasMultiplePhrases) {
      return false;
    }

    const nextIndex = (this.state.activeIndex + 1) % this.phrases.length;

    return this.goTo(nextIndex, {
      source,
    });
  }

  previous({ source = "previous" } = {}) {
    if (!this.hasMultiplePhrases) {
      return false;
    }

    const previousIndex =
      (this.state.activeIndex - 1 + this.phrases.length) % this.phrases.length;

    return this.goTo(previousIndex, {
      source,
    });
  }

  first({ source = "first" } = {}) {
    return this.goTo(0, {
      source,
    });
  }

  last({ source = "last" } = {}) {
    return this.goTo(this.phrases.length - 1, {
      source,
    });
  }

  /* ========================================================================
     Phrase Transition
     ======================================================================== */

  async goTo(
    index,
    { source = "api", animate = !this.config.reducedMotion } = {},
  ) {
    if (
      this.state.destroyed ||
      !this.prepare() ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.phrases.length
    ) {
      return false;
    }

    if (index === this.state.activeIndex || this.state.transitioning) {
      return false;
    }

    const previousIndex = this.state.activeIndex;
    const previousPhrase = this.phrases[previousIndex];
    const nextPhrase = this.phrases[index];

    const token = ++this.transitionToken;

    this.clearTransitionTimer();
    this.clearRotationTimer();

    this.state.transitioning = true;

    this.element.classList.add(CLASS_NAMES.transitioning);

    previousPhrase.classList.remove(CLASS_NAMES.entering, CLASS_NAMES.leaving);

    nextPhrase.classList.remove(CLASS_NAMES.entering, CLASS_NAMES.leaving);

    if (!animate || this.config.duration === 0) {
      this.completeTransition({
        previousIndex,
        nextIndex: index,
        source,
        token,
      });

      return true;
    }

    previousPhrase.classList.add(CLASS_NAMES.leaving);

    nextPhrase.classList.add(CLASS_NAMES.active, CLASS_NAMES.entering);

    nextPhrase.setAttribute(ARIA.hidden, "false");

    await nextAnimationFrame(this.view);

    if (this.state.destroyed || token !== this.transitionToken) {
      return false;
    }

    this.transitionTimer = this.view.setTimeout(() => {
      this.transitionTimer = null;

      this.completeTransition({
        previousIndex,
        nextIndex: index,
        source,
        token,
      });
    }, this.config.duration + 34);

    return true;
  }

  completeTransition({ previousIndex, nextIndex, source, token }) {
    if (this.state.destroyed || token !== this.transitionToken) {
      return false;
    }

    const previousPhrase = this.phrases[previousIndex];
    const nextPhrase = this.phrases[nextIndex];

    previousPhrase?.classList.remove(
      CLASS_NAMES.active,
      CLASS_NAMES.entering,
      CLASS_NAMES.leaving,
    );

    previousPhrase?.setAttribute(ARIA.hidden, "true");

    nextPhrase?.classList.remove(CLASS_NAMES.entering, CLASS_NAMES.leaving);

    nextPhrase?.classList.add(CLASS_NAMES.active);
    nextPhrase?.setAttribute(ARIA.hidden, "false");

    this.state.activeIndex = nextIndex;
    this.state.transitioning = false;

    this.element.classList.remove(CLASS_NAMES.transitioning);

    this.measure();

    this.onChange?.({
      index: nextIndex,
      previousIndex,
      phrase: nextPhrase,
      previousPhrase,
      source,
    });

    this.scheduleNext();

    return true;
  }

  /* ========================================================================
     Pause and Resume
     ======================================================================== */

  pause() {
    if (this.state.destroyed || this.state.paused) {
      return false;
    }

    this.clearRotationTimer();
    this.clearStartTimer();

    this.state.paused = true;

    this.element.classList.add(CLASS_NAMES.paused);

    return true;
  }

  resume() {
    if (this.state.destroyed || !this.state.paused) {
      return false;
    }

    this.state.paused = false;

    this.element.classList.remove(CLASS_NAMES.paused);

    if (this.state.running && !this.config.reducedMotion) {
      this.scheduleNext();
    }

    return true;
  }

  togglePause() {
    return this.state.paused ? this.resume() : this.pause();
  }

  /* ========================================================================
     Replay
     ======================================================================== */

  replay() {
    if (this.state.destroyed) {
      return false;
    }

    this.clearTimers();

    this.state.running = true;
    this.state.paused = false;

    this.element.classList.remove(CLASS_NAMES.paused);

    const changed = this.goTo(0, {
      source: "replay",
      animate: false,
    });

    if (!changed) {
      this.scheduleNext();
    }

    return true;
  }

  /* ========================================================================
     Configuration
     ======================================================================== */

  update({
    interval = this.config.interval,
    duration = this.config.duration,
    delay = this.config.delay,
    reducedMotion = this.config.reducedMotion,
  } = {}) {
    if (this.state.destroyed) {
      return false;
    }

    this.config.interval = Math.max(DEFAULTS.minimumInterval, interval);

    this.config.duration = Math.max(0, duration);
    this.config.delay = Math.max(0, delay);
    this.config.reducedMotion = reducedMotion;

    this.applyTimingProperties();

    if (reducedMotion) {
      this.clearRotationTimer();
      this.clearStartTimer();
    } else if (this.state.running && !this.state.paused) {
      this.scheduleNext();
    }

    return true;
  }

  /* ========================================================================
     Timers
     ======================================================================== */

  clearRotationTimer() {
    clearTimer(this.view, this.rotationTimer);

    this.rotationTimer = null;
  }

  clearTransitionTimer() {
    clearTimer(this.view, this.transitionTimer);

    this.transitionTimer = null;
  }

  clearStartTimer() {
    clearTimer(this.view, this.startTimer);

    this.startTimer = null;
  }

  clearTimers() {
    this.clearRotationTimer();
    this.clearTransitionTimer();
    this.clearStartTimer();
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

  destroy() {
    if (this.state.destroyed) {
      return;
    }

    this.transitionToken += 1;

    this.clearTimers();

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.element.classList.remove(
      CLASS_NAMES.ready,
      CLASS_NAMES.paused,
      CLASS_NAMES.transitioning,
      CLASS_NAMES.failed,
    );

    restoreAttribute(this.element, ARIA.live, this.original.live);

    restoreAttribute(this.element, ARIA.atomic, this.original.atomic);

    this.original.phrases.forEach((record) => {
      const phrase = record.element;

      restoreAttribute(phrase, "hidden", record.hidden);

      restoreAttribute(phrase, ARIA.hidden, record.ariaHidden);

      restoreAttribute(phrase, "class", record.className);
    });

    this.element.style.removeProperty(CSS_PROPERTIES.rotateInlineSize);

    this.element.style.removeProperty(CSS_PROPERTIES.rotateBlockSize);

    this.element.style.removeProperty("--text-animation-rotate-duration");

    this.element.style.removeProperty(CSS_PROPERTIES.delay);

    this.element.style.removeProperty(CSS_PROPERTIES.runtimeDelay);

    this.phrases = [];
    this.onChange = null;
    this.onStart = null;

    this.state.prepared = false;
    this.state.running = false;
    this.state.paused = false;
    this.state.transitioning = false;
    this.state.destroyed = true;
  }
}

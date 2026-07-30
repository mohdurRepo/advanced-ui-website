import { CLASS_NAMES, CSS_PROPERTIES, DEFAULTS, UNITS } from "./constants";
import {
  calculateStaggerDuration,
  clearTimer,
  nextAnimationFrame,
  setCssTime,
} from "./utils";
import {
  prepareSplitText,
  refreshSplitLines,
  restoreSplitText,
} from "./splitter";

/* ==========================================================================
   Reveal Animation
   ========================================================================== */

/**
 * Manages the visual lifecycle of one reveal component.
 *
 * Public component events remain the responsibility of `text-animation.js`.
 * This class owns only DOM preparation, CSS state, timing, and cleanup.
 */

export class RevealAnimation {
  constructor(
    element,
    {
      unit = UNITS.none,
      locale = DEFAULTS.locale,
      order = DEFAULTS.order,
      unitLimit = DEFAULTS.unitLimit,

      duration = DEFAULTS.duration,
      delay = DEFAULTS.delay,
      stagger = DEFAULTS.stagger,
      maxStagger = DEFAULTS.maxStagger,

      reducedMotion = false,
      onComplete = null,
    } = {},
  ) {
    this.element = element;
    this.document = element.ownerDocument;
    this.view = this.document.defaultView;

    this.config = {
      unit,
      locale,
      order,
      unitLimit,

      duration,
      delay,
      stagger,
      maxStagger,

      reducedMotion,
    };

    this.onComplete = typeof onComplete === "function" ? onComplete : null;

    this.record = null;
    this.completionTimer = null;
    this.playToken = 0;

    this.state = {
      prepared: false,
      playing: false,
      paused: false,
      complete: false,
      destroyed: false,
    };
  }

  /* ========================================================================
     Preparation
     ======================================================================== */

  prepare() {
    if (this.state.destroyed) {
      return false;
    }

    if (this.state.prepared) {
      return true;
    }

    this.applyTimingProperties();

    this.record = prepareSplitText(this.element, {
      unit: this.config.unit,
      locale: this.config.locale,
      order: this.config.order,
      unitLimit: this.config.unitLimit,
    });

    if (!this.record) {
      return false;
    }

    this.element.classList.add(CLASS_NAMES.ready);

    this.state.prepared = true;

    return true;
  }

  applyTimingProperties() {
    setCssTime(this.element, CSS_PROPERTIES.duration, this.config.duration);

    setCssTime(
      this.element,
      CSS_PROPERTIES.runtimeDuration,
      this.config.duration,
    );

    setCssTime(this.element, CSS_PROPERTIES.delay, this.config.delay);

    setCssTime(this.element, CSS_PROPERTIES.runtimeDelay, this.config.delay);

    setCssTime(
      this.element,
      CSS_PROPERTIES.runtimeStagger,
      this.config.stagger,
    );

    this.element.style.setProperty(
      "--text-animation-max-stagger",
      `${Math.max(0, this.config.maxStagger)}ms`,
    );
  }

  /* ========================================================================
     Duration
     ======================================================================== */

  get totalDuration() {
    if (this.config.reducedMotion) {
      return 0;
    }

    return calculateStaggerDuration({
      duration: this.config.duration,
      delay: this.config.delay,
      stagger: this.config.stagger,
      unitCount: Math.max(1, this.record?.units.length || 1),
      maximumStagger: this.config.maxStagger,
    });
  }

  /* ========================================================================
     Playback
     ======================================================================== */

  async play({ restart = false } = {}) {
    if (this.state.destroyed) {
      return false;
    }

    if (!this.prepare()) {
      return false;
    }

    if (this.state.playing && !restart) {
      return true;
    }

    if (this.state.complete && !restart) {
      return true;
    }

    const token = ++this.playToken;

    this.clearCompletionTimer();

    this.state.playing = false;
    this.state.paused = false;
    this.state.complete = false;

    this.element.classList.remove(
      CLASS_NAMES.animating,
      CLASS_NAMES.complete,
      CLASS_NAMES.paused,
    );

    /**
     * Reading layout guarantees that replay begins from the prepared initial
     * state instead of continuing a completed CSS animation.
     */

    void this.element.offsetWidth;

    if (this.config.reducedMotion) {
      this.finish({
        notify: true,
      });

      return true;
    }

    await nextAnimationFrame(this.view);

    if (this.state.destroyed || token !== this.playToken) {
      return false;
    }

    this.state.playing = true;

    this.element.classList.add(CLASS_NAMES.animating);

    const totalDuration = this.totalDuration;

    if (totalDuration <= 0) {
      this.finish({
        notify: true,
      });

      return true;
    }

    this.completionTimer = this.view.setTimeout(() => {
      this.completionTimer = null;

      if (!this.state.destroyed && token === this.playToken) {
        this.finish({
          notify: true,
        });
      }
    }, totalDuration + 34);

    return true;
  }

  replay() {
    return this.play({
      restart: true,
    });
  }

  /* ========================================================================
     Pause and Resume
     ======================================================================== */

  pause() {
    if (this.state.destroyed || !this.state.playing || this.state.paused) {
      return false;
    }

    this.state.paused = true;

    this.element.classList.add(CLASS_NAMES.paused);

    return true;
  }

  resume() {
    if (this.state.destroyed || !this.state.playing || !this.state.paused) {
      return false;
    }

    this.state.paused = false;

    this.element.classList.remove(CLASS_NAMES.paused);

    return true;
  }

  /* ========================================================================
     Completion
     ======================================================================== */

  finish({ notify = true } = {}) {
    if (this.state.destroyed) {
      return false;
    }

    const wasComplete = this.state.complete;

    this.clearCompletionTimer();

    this.state.playing = false;
    this.state.paused = false;
    this.state.complete = true;

    this.element.classList.remove(CLASS_NAMES.animating, CLASS_NAMES.paused);

    this.element.classList.add(CLASS_NAMES.complete);

    if (!wasComplete && notify) {
      this.onComplete?.();
    }

    return true;
  }

  /* ========================================================================
     Reset
     ======================================================================== */

  reset() {
    if (this.state.destroyed) {
      return false;
    }

    this.playToken += 1;

    this.clearCompletionTimer();

    this.state.playing = false;
    this.state.paused = false;
    this.state.complete = false;

    this.element.classList.remove(
      CLASS_NAMES.animating,
      CLASS_NAMES.complete,
      CLASS_NAMES.paused,
    );

    return true;
  }

  /* ========================================================================
     Line Refresh
     ======================================================================== */

  refreshLines() {
    if (
      this.state.destroyed ||
      this.config.unit !== UNITS.lines ||
      !this.state.prepared
    ) {
      return false;
    }

    const wasComplete = this.state.complete;

    this.clearCompletionTimer();

    this.record = refreshSplitLines(this.element, {
      locale: this.config.locale,
      order: this.config.order,
      unitLimit: this.config.unitLimit,
    });

    if (wasComplete) {
      this.finish({
        notify: false,
      });
    }

    return Boolean(this.record);
  }

  /* ========================================================================
     Configuration Refresh
     ======================================================================== */

  update({
    duration = this.config.duration,
    delay = this.config.delay,
    stagger = this.config.stagger,
    maxStagger = this.config.maxStagger,
    reducedMotion = this.config.reducedMotion,
  } = {}) {
    if (this.state.destroyed) {
      return false;
    }

    this.config.duration = duration;
    this.config.delay = delay;
    this.config.stagger = stagger;
    this.config.maxStagger = maxStagger;
    this.config.reducedMotion = reducedMotion;

    this.applyTimingProperties();

    if (reducedMotion && !this.state.complete) {
      this.finish({
        notify: true,
      });
    }

    return true;
  }

  /* ========================================================================
     Timer Cleanup
     ======================================================================== */

  clearCompletionTimer() {
    clearTimer(this.view, this.completionTimer);

    this.completionTimer = null;
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

  destroy() {
    if (this.state.destroyed) {
      return;
    }

    this.playToken += 1;

    this.clearCompletionTimer();

    this.element.classList.remove(
      CLASS_NAMES.ready,
      CLASS_NAMES.animating,
      CLASS_NAMES.complete,
      CLASS_NAMES.paused,
      CLASS_NAMES.failed,
      CLASS_NAMES.unitLimit,
    );

    this.element.style.removeProperty(CSS_PROPERTIES.duration);
    this.element.style.removeProperty(CSS_PROPERTIES.runtimeDuration);

    this.element.style.removeProperty(CSS_PROPERTIES.delay);
    this.element.style.removeProperty(CSS_PROPERTIES.runtimeDelay);

    this.element.style.removeProperty(CSS_PROPERTIES.runtimeStagger);

    this.element.style.removeProperty("--text-animation-max-stagger");

    restoreSplitText(this.element);

    this.record = null;
    this.onComplete = null;

    this.state.prepared = false;
    this.state.playing = false;
    this.state.paused = false;
    this.state.complete = false;
    this.state.destroyed = true;
  }
}

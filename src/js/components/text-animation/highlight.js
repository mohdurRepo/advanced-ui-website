import { CLASS_NAMES, CSS_PROPERTIES, DEFAULTS } from "./constants";
import { clearTimer, nextAnimationFrame, setCssTime } from "./utils";

/* ==========================================================================
   Highlight Animation
   ========================================================================== */

/**
 * Controls underline, marker, and fill highlight effects.
 *
 * The decoration itself is CSS-generated. JavaScript manages preparation,
 * playback, pause, replay, completion, and cleanup.
 */

export class HighlightAnimation {
  constructor(
    element,
    {
      duration = 700,
      delay = DEFAULTS.delay,
      reducedMotion = false,
      onComplete = null,
    } = {},
  ) {
    this.element = element;
    this.document = element.ownerDocument;
    this.view = this.document.defaultView;

    this.config = {
      duration: Math.max(0, duration),
      delay: Math.max(0, delay),
      reducedMotion,
    };

    this.onComplete = typeof onComplete === "function" ? onComplete : null;

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

    this.element.classList.add(CLASS_NAMES.ready);

    this.state.prepared = true;

    return true;
  }

  applyTimingProperties() {
    setCssTime(
      this.element,
      "--text-animation-highlight-duration",
      this.config.duration,
    );

    setCssTime(this.element, CSS_PROPERTIES.delay, this.config.delay);

    setCssTime(this.element, CSS_PROPERTIES.runtimeDelay, this.config.delay);
  }

  /* ========================================================================
     Duration
     ======================================================================== */

  get totalDuration() {
    if (this.config.reducedMotion) {
      return 0;
    }

    return this.config.delay + this.config.duration;
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

    if (this.totalDuration <= 0) {
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
    }, this.totalDuration + 34);

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
     Configuration Refresh
     ======================================================================== */

  update({
    duration = this.config.duration,
    delay = this.config.delay,
    reducedMotion = this.config.reducedMotion,
  } = {}) {
    if (this.state.destroyed) {
      return false;
    }

    this.config.duration = Math.max(0, duration);
    this.config.delay = Math.max(0, delay);
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
    );

    this.element.style.removeProperty("--text-animation-highlight-duration");

    this.element.style.removeProperty(CSS_PROPERTIES.delay);
    this.element.style.removeProperty(CSS_PROPERTIES.runtimeDelay);

    this.onComplete = null;

    this.state.prepared = false;
    this.state.playing = false;
    this.state.paused = false;
    this.state.complete = false;
    this.state.destroyed = true;
  }
}

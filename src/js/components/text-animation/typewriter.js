import { ARIA, CLASS_NAMES, DEFAULTS } from "./constants";
import {
  cancelFrame,
  clearTimer,
  createElement,
  normalizeText,
  restoreAttribute,
  segmentGraphemes,
  setCssTime,
} from "./utils";

/* ==========================================================================
   Typewriter Animation
   ========================================================================== */

/**
 * Uses requestAnimationFrame instead of one timeout per character.
 *
 * The original DOM nodes are moved into a detached fragment and restored
 * exactly during destruction, preserving node identity and event listeners.
 */

export class TypewriterAnimation {
  constructor(
    element,
    {
      speed = DEFAULTS.typeSpeed,
      startDelay = DEFAULTS.typeStartDelay,
      reducedMotion = false,
      onComplete = null,
    } = {},
  ) {
    this.element = element;
    this.document = element.ownerDocument;
    this.view = this.document.defaultView;

    this.config = {
      speed: Math.max(0, speed),
      startDelay: Math.max(0, startDelay),
      reducedMotion,
    };

    this.onComplete = typeof onComplete === "function" ? onComplete : null;

    this.original = {
      label: element.getAttribute(ARIA.label),
    };

    this.originalFragment = null;
    this.typingElement = null;

    this.text = "";
    this.graphemes = [];

    this.frameId = null;
    this.startTimer = null;
    this.startTime = null;
    this.playToken = 0;

    this.state = {
      prepared: false,
      playing: false,
      paused: false,
      complete: false,
      destroyed: false,

      visibleCount: 0,
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

    this.originalFragment = this.document.createDocumentFragment();

    while (this.element.firstChild) {
      this.originalFragment.append(this.element.firstChild);
    }

    this.text = normalizeText(this.originalFragment.textContent || "");

    if (!this.text) {
      this.element.append(this.originalFragment);
      this.originalFragment = null;

      return false;
    }

    const locale =
      this.element.closest("[lang]")?.getAttribute("lang") ||
      this.document.documentElement.lang ||
      DEFAULTS.locale;

    this.graphemes = segmentGraphemes(this.text, locale);

    this.typingElement = createElement(
      "span",
      {
        className: CLASS_NAMES.typing,
      },
      this.document,
    );

    this.typingElement.textContent = this.text;

    this.element.append(this.typingElement);

    if (!this.original.label) {
      this.element.setAttribute(ARIA.label, this.text);
    }

    this.typingElement.setAttribute(ARIA.hidden, "true");

    this.applyTimingProperties();

    this.element.classList.add(CLASS_NAMES.ready);

    this.state.prepared = true;

    return true;
  }

  applyTimingProperties() {
    setCssTime(this.element, "--text-animation-type-speed", this.config.speed);

    setCssTime(
      this.element,
      "--text-animation-type-start-delay",
      this.config.startDelay,
    );
  }

  /* ========================================================================
     Rendering
     ======================================================================== */

  renderVisibleCount(count) {
    if (!this.typingElement) return;

    const nextCount = Math.max(0, Math.min(this.graphemes.length, count));

    this.state.visibleCount = nextCount;

    this.typingElement.textContent = this.graphemes
      .slice(0, nextCount)
      .join("");
  }

  renderCompleteText() {
    if (!this.typingElement) return;

    this.state.visibleCount = this.graphemes.length;
    this.typingElement.textContent = this.text;
  }

  /* ========================================================================
     Playback
     ======================================================================== */

  play({ restart = false } = {}) {
    if (this.state.destroyed || !this.prepare()) {
      return false;
    }

    if (this.state.playing && !restart) {
      return true;
    }

    if (this.state.complete && !restart) {
      return true;
    }

    const token = ++this.playToken;

    this.clearTimers();

    this.state.playing = false;
    this.state.paused = false;
    this.state.complete = false;

    this.element.classList.remove(
      CLASS_NAMES.animating,
      CLASS_NAMES.complete,
      CLASS_NAMES.paused,
    );

    this.renderVisibleCount(0);

    if (this.config.reducedMotion || this.config.speed === 0) {
      this.finish({
        notify: true,
      });

      return true;
    }

    const begin = () => {
      if (this.state.destroyed || token !== this.playToken) {
        return;
      }

      this.state.playing = true;
      this.startTime = null;

      this.element.classList.add(CLASS_NAMES.animating);

      this.frameId = this.view.requestAnimationFrame((timestamp) => {
        this.tick(timestamp, token);
      });
    };

    if (this.config.startDelay > 0) {
      this.startTimer = this.view.setTimeout(() => {
        this.startTimer = null;
        begin();
      }, this.config.startDelay);
    } else {
      begin();
    }

    return true;
  }

  replay() {
    return this.play({
      restart: true,
    });
  }

  /* ========================================================================
     Frame Loop
     ======================================================================== */

  tick(timestamp, token) {
    if (
      this.state.destroyed ||
      token !== this.playToken ||
      !this.state.playing ||
      this.state.paused
    ) {
      return;
    }

    if (this.startTime === null) {
      this.startTime = timestamp - this.state.visibleCount * this.config.speed;
    }

    const elapsed = Math.max(0, timestamp - this.startTime);

    const visibleCount = Math.min(
      this.graphemes.length,
      Math.floor(elapsed / this.config.speed) + 1,
    );

    if (visibleCount !== this.state.visibleCount) {
      this.renderVisibleCount(visibleCount);
    }

    if (visibleCount >= this.graphemes.length) {
      this.frameId = null;

      this.finish({
        notify: true,
      });

      return;
    }

    this.frameId = this.view.requestAnimationFrame((nextTimestamp) => {
      this.tick(nextTimestamp, token);
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

    cancelFrame(this.view, this.frameId);
    this.frameId = null;

    this.element.classList.add(CLASS_NAMES.paused);

    return true;
  }

  resume() {
    if (this.state.destroyed || !this.state.playing || !this.state.paused) {
      return false;
    }

    this.state.paused = false;

    this.element.classList.remove(CLASS_NAMES.paused);

    this.startTime =
      this.view.performance.now() - this.state.visibleCount * this.config.speed;

    const token = this.playToken;

    this.frameId = this.view.requestAnimationFrame((timestamp) => {
      this.tick(timestamp, token);
    });

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

    this.clearTimers();
    this.renderCompleteText();

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

    this.clearTimers();

    this.state.playing = false;
    this.state.paused = false;
    this.state.complete = false;
    this.state.visibleCount = 0;

    this.startTime = null;

    this.element.classList.remove(
      CLASS_NAMES.animating,
      CLASS_NAMES.complete,
      CLASS_NAMES.paused,
    );

    this.renderVisibleCount(0);

    return true;
  }

  /* ========================================================================
     Configuration
     ======================================================================== */

  update({
    speed = this.config.speed,
    startDelay = this.config.startDelay,
    reducedMotion = this.config.reducedMotion,
  } = {}) {
    if (this.state.destroyed) {
      return false;
    }

    this.config.speed = Math.max(0, speed);
    this.config.startDelay = Math.max(0, startDelay);

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

  clearStartTimer() {
    clearTimer(this.view, this.startTimer);

    this.startTimer = null;
  }

  clearFrame() {
    cancelFrame(this.view, this.frameId);

    this.frameId = null;
  }

  clearTimers() {
    this.clearStartTimer();
    this.clearFrame();
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

  destroy() {
    if (this.state.destroyed) {
      return;
    }

    this.playToken += 1;

    this.clearTimers();

    this.element.classList.remove(
      CLASS_NAMES.ready,
      CLASS_NAMES.animating,
      CLASS_NAMES.complete,
      CLASS_NAMES.paused,
      CLASS_NAMES.failed,
    );

    if (this.originalFragment) {
      this.element.replaceChildren(this.originalFragment);
    }

    restoreAttribute(this.element, ARIA.label, this.original.label);

    this.element.style.removeProperty("--text-animation-type-speed");

    this.element.style.removeProperty("--text-animation-type-start-delay");

    this.originalFragment = null;
    this.typingElement = null;
    this.graphemes = [];
    this.text = "";
    this.onComplete = null;

    this.state.prepared = false;
    this.state.playing = false;
    this.state.paused = false;
    this.state.complete = false;
    this.state.visibleCount = 0;
    this.state.destroyed = true;
  }
}

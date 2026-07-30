import { ARIA, CLASS_NAMES, DEFAULTS } from "./constants";
import {
  cancelFrame,
  clearTimer,
  createElement,
  createNumberFormatter,
  restoreAttribute,
  setCssTime,
} from "./utils";

/* ==========================================================================
   Counter Easing
   ========================================================================== */

function easeOutCubic(progress) {
  return 1 - Math.pow(1 - progress, 3);
}

/* ==========================================================================
   Numeric Counter
   ========================================================================== */

/**
 * Animates a numeric value with requestAnimationFrame.
 *
 * The final formatted value is exposed as the accessible name from the start,
 * preventing screen readers from announcing every intermediate number.
 */

export class CounterAnimation {
  constructor(
    element,
    {
      from = 0,
      to = 0,
      decimals = DEFAULTS.counterDecimals,
      grouping = false,
      prefix = "",
      suffix = "",

      locale = DEFAULTS.locale,
      duration = DEFAULTS.counterDuration,
      delay = DEFAULTS.delay,
      reducedMotion = false,

      onComplete = null,
    } = {},
  ) {
    this.element = element;
    this.document = element.ownerDocument;
    this.view = this.document.defaultView;

    this.config = {
      from,
      to,
      decimals,
      grouping,
      prefix,
      suffix,
      locale,

      duration: Math.max(0, duration),
      delay: Math.max(0, delay),
      reducedMotion,
    };

    this.onComplete = typeof onComplete === "function" ? onComplete : null;

    this.original = {
      label: element.getAttribute(ARIA.label),
    };

    this.originalFragment = null;

    this.prefixElement = null;
    this.valueElement = null;
    this.suffixElement = null;

    this.formatter = null;

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

      progress: 0,
      currentValue: from,
    };
  }

  /* ========================================================================
     Formatting
     ======================================================================== */

  createFormatter() {
    this.formatter = createNumberFormatter(this.config.locale, {
      decimals: this.config.decimals,
      grouping: this.config.grouping,
    });
  }

  formatNumber(value) {
    return this.formatter.format(value);
  }

  formatAccessibleValue(value) {
    return [
      this.config.prefix,
      this.formatNumber(value),
      this.config.suffix,
    ].join("");
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

    this.createFormatter();

    this.originalFragment = this.document.createDocumentFragment();

    while (this.element.firstChild) {
      this.originalFragment.append(this.element.firstChild);
    }

    this.prefixElement = createElement(
      "span",
      {
        className: CLASS_NAMES.counterPrefix,
        text: this.config.prefix,
        attributes: {
          [ARIA.hidden]: "true",
        },
      },
      this.document,
    );

    this.valueElement = createElement(
      "span",
      {
        className: CLASS_NAMES.counterValue,
        attributes: {
          [ARIA.hidden]: "true",
        },
      },
      this.document,
    );

    this.suffixElement = createElement(
      "span",
      {
        className: CLASS_NAMES.counterSuffix,
        text: this.config.suffix,
        attributes: {
          [ARIA.hidden]: "true",
        },
      },
      this.document,
    );

    if (this.config.prefix) {
      this.element.append(this.prefixElement);
    }

    this.element.append(this.valueElement);

    if (this.config.suffix) {
      this.element.append(this.suffixElement);
    }

    this.element.setAttribute(
      ARIA.label,
      this.formatAccessibleValue(this.config.to),
    );

    this.applyTimingProperties();

    this.renderValue(this.config.to);

    this.element.classList.add(CLASS_NAMES.ready);

    this.state.prepared = true;

    return true;
  }

  applyTimingProperties() {
    setCssTime(
      this.element,
      "--text-animation-counter-duration",
      this.config.duration,
    );

    setCssTime(this.element, "--text-animation-duration", this.config.duration);

    setCssTime(
      this.element,
      "--text-animation-runtime-duration",
      this.config.duration,
    );

    setCssTime(this.element, "--text-animation-delay", this.config.delay);

    setCssTime(
      this.element,
      "--text-animation-runtime-delay",
      this.config.delay,
    );
  }

  /* ========================================================================
     Rendering
     ======================================================================== */

  renderValue(value) {
    if (!this.valueElement) return;

    this.state.currentValue = value;
    this.valueElement.textContent = this.formatNumber(value);
  }

  renderProgress(progress) {
    const normalizedProgress = Math.min(1, Math.max(0, progress));

    const easedProgress = easeOutCubic(normalizedProgress);

    const value =
      this.config.from + (this.config.to - this.config.from) * easedProgress;

    this.state.progress = normalizedProgress;

    this.renderValue(value);
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
    this.state.progress = 0;

    this.startTime = null;

    this.element.classList.remove(
      CLASS_NAMES.animating,
      CLASS_NAMES.complete,
      CLASS_NAMES.paused,
      CLASS_NAMES.updating,
    );

    this.renderValue(this.config.from);

    if (this.config.reducedMotion || this.config.duration === 0) {
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

    if (this.config.delay > 0) {
      this.startTimer = this.view.setTimeout(() => {
        this.startTimer = null;
        begin();
      }, this.config.delay);
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
      this.startTime = timestamp - this.state.progress * this.config.duration;
    }

    const elapsed = Math.max(0, timestamp - this.startTime);

    const progress = Math.min(1, elapsed / this.config.duration);

    this.renderProgress(progress);

    if (progress >= 1) {
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
      this.view.performance.now() - this.state.progress * this.config.duration;

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

    this.state.playing = false;
    this.state.paused = false;
    this.state.complete = true;
    this.state.progress = 1;

    this.renderValue(this.config.to);

    this.element.classList.remove(
      CLASS_NAMES.animating,
      CLASS_NAMES.paused,
      CLASS_NAMES.updating,
    );

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
    this.state.progress = 0;

    this.startTime = null;

    this.element.classList.remove(
      CLASS_NAMES.animating,
      CLASS_NAMES.complete,
      CLASS_NAMES.paused,
      CLASS_NAMES.updating,
    );

    this.renderValue(this.config.from);

    return true;
  }

  /* ========================================================================
     Value Update
     ======================================================================== */

  updateValue(nextValue, { animate = true, fromCurrent = true } = {}) {
    if (this.state.destroyed || !Number.isFinite(nextValue)) {
      return false;
    }

    if (!this.prepare()) {
      return false;
    }

    this.config.from = fromCurrent ? this.state.currentValue : this.config.from;

    this.config.to = nextValue;

    this.element.setAttribute(
      ARIA.label,
      this.formatAccessibleValue(nextValue),
    );

    this.element.classList.add(CLASS_NAMES.updating);

    if (!animate || this.config.reducedMotion) {
      this.finish({
        notify: true,
      });

      return true;
    }

    return this.play({
      restart: true,
    });
  }

  /* ========================================================================
     Configuration
     ======================================================================== */

  update({
    from = this.config.from,
    to = this.config.to,
    decimals = this.config.decimals,
    grouping = this.config.grouping,
    prefix = this.config.prefix,
    suffix = this.config.suffix,
    locale = this.config.locale,
    duration = this.config.duration,
    delay = this.config.delay,
    reducedMotion = this.config.reducedMotion,
  } = {}) {
    if (this.state.destroyed) {
      return false;
    }

    this.config.from = from;
    this.config.to = to;
    this.config.decimals = decimals;
    this.config.grouping = grouping;
    this.config.prefix = prefix;
    this.config.suffix = suffix;
    this.config.locale = locale;
    this.config.duration = Math.max(0, duration);
    this.config.delay = Math.max(0, delay);
    this.config.reducedMotion = reducedMotion;

    this.createFormatter();
    this.applyTimingProperties();

    if (this.prefixElement) {
      this.prefixElement.textContent = this.config.prefix;
    }

    if (this.suffixElement) {
      this.suffixElement.textContent = this.config.suffix;
    }

    this.element.setAttribute(
      ARIA.label,
      this.formatAccessibleValue(this.config.to),
    );

    if (reducedMotion && !this.state.complete) {
      this.finish({
        notify: true,
      });
    } else if (this.state.complete) {
      this.renderValue(this.config.to);
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
      CLASS_NAMES.loading,
      CLASS_NAMES.updating,
      CLASS_NAMES.failed,
    );

    if (this.originalFragment) {
      this.element.replaceChildren(this.originalFragment);
    }

    restoreAttribute(this.element, ARIA.label, this.original.label);

    [
      "--text-animation-counter-duration",
      "--text-animation-duration",
      "--text-animation-runtime-duration",
      "--text-animation-delay",
      "--text-animation-runtime-delay",
    ].forEach((property) => {
      this.element.style.removeProperty(property);
    });

    this.originalFragment = null;
    this.prefixElement = null;
    this.valueElement = null;
    this.suffixElement = null;
    this.formatter = null;
    this.onComplete = null;

    this.state.prepared = false;
    this.state.playing = false;
    this.state.paused = false;
    this.state.complete = false;
    this.state.progress = 0;
    this.state.destroyed = true;
  }
}

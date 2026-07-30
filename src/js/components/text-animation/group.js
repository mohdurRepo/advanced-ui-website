import {
  ARIA,
  CLASS_NAMES,
  COMPONENT_EVENTS,
  CSS_PROPERTIES,
  DATA_ATTRIBUTES,
  DEFAULTS,
  LIMITS,
  ORDERS,
  SUPPORTED,
} from "./constants";
import {
  dispatchComponentEvent,
  parseEnumAttribute,
  parseNumberAttribute,
  restoreAttribute,
  setCssNumber,
  setCssTime,
} from "./utils";

/* ==========================================================================
   Group Instance Registry
   ========================================================================== */

const groupInstances = new WeakMap();

/* ==========================================================================
   Ordered Indexes
   ========================================================================== */

function getGroupIndexes(length, order) {
  const indexes = Array.from(
    {
      length,
    },
    (_, index) => index,
  );

  if (order === ORDERS.reverse) {
    return indexes.reverse();
  }

  return indexes;
}

/* ==========================================================================
   Text Animation Group
   ========================================================================== */

/**
 * Coordinates multiple TextAnimation instances.
 *
 * Individual components keep ownership of their visual effect. The group only
 * assigns sequence delays and coordinates playback state.
 */

export class TextAnimationGroup {
  static getInstance(element) {
    return groupInstances.get(element) || null;
  }

  static getOrCreateInstance(element, { instances = [] } = {}) {
    const existing = TextAnimationGroup.getInstance(element);

    if (existing) {
      instances.forEach((instance) => {
        existing.add(instance);
      });

      return existing;
    }

    return new TextAnimationGroup(element, {
      instances,
    });
  }

  constructor(element, { instances = [] } = {}) {
    if (!element?.matches?.("[data-text-animation-group]")) {
      throw new TypeError("TextAnimationGroup requires a group element.");
    }

    this.element = element;
    this.document = element.ownerDocument;
    this.view = this.document.defaultView;

    this.instances = [];

    this.config = this.readConfiguration();

    this.original = {
      busy: element.getAttribute(ARIA.busy),

      stagger: element.style.getPropertyValue(CSS_PROPERTIES.groupStagger),

      delay: element.style.getPropertyValue(CSS_PROPERTIES.groupDelay),
    };

    this.runtimeDelayRecords = new Map();

    this.completedInstances = new Set();

    this.abortController = new this.view.AbortController();

    this.state = {
      prepared: false,
      playing: false,
      paused: false,
      complete: false,
      destroyed: false,
    };

    instances.forEach((instance) => {
      this.add(instance);
    });

    this.bindEvents();

    groupInstances.set(element, this);
  }

  /* ========================================================================
     Configuration
     ======================================================================== */

  readConfiguration() {
    return {
      stagger: parseNumberAttribute(
        this.element,
        DATA_ATTRIBUTES.groupStagger,
        {
          fallback: DEFAULTS.groupStagger,
          minimum: LIMITS.minimumStagger,
          maximum: LIMITS.maximumStagger,
        },
      ),

      delay: parseNumberAttribute(this.element, DATA_ATTRIBUTES.groupDelay, {
        fallback: DEFAULTS.groupDelay,
        minimum: LIMITS.minimumDelay,
        maximum: LIMITS.maximumDelay,
      }),

      order: parseEnumAttribute(
        this.element,
        DATA_ATTRIBUTES.groupOrder,
        SUPPORTED.orders,
        ORDERS.normal,
      ),
    };
  }

  /* ========================================================================
     Events
     ======================================================================== */

  bindEvents() {
    this.element.addEventListener(
      COMPONENT_EVENTS.complete,
      (event) => {
        this.handleComponentComplete(event);
      },
      {
        signal: this.abortController.signal,
      },
    );
  }

  handleComponentComplete(event) {
    const instance = event.detail?.instance;

    if (!instance || !this.instances.includes(instance)) {
      return;
    }

    this.completedInstances.add(instance);

    if (this.completedInstances.size >= this.instances.length) {
      this.finish();
    }
  }

  /* ========================================================================
     Instance Management
     ======================================================================== */

  add(instance) {
    if (
      this.state.destroyed ||
      !instance ||
      this.instances.includes(instance)
    ) {
      return false;
    }

    if (!this.element.contains(instance.element)) {
      return false;
    }

    this.instances.push(instance);

    if (this.state.prepared) {
      this.applySequence();
    }

    return true;
  }

  remove(instance) {
    const index = this.instances.indexOf(instance);

    if (index < 0) {
      return false;
    }

    this.restoreInstanceDelay(instance);

    this.instances.splice(index, 1);
    this.completedInstances.delete(instance);

    if (this.state.prepared) {
      this.applySequence();
    }

    return true;
  }

  /* ========================================================================
     Preparation
     ======================================================================== */

  prepare() {
    if (this.state.destroyed) {
      return false;
    }

    if (this.state.prepared) {
      this.applySequence();

      return true;
    }

    setCssTime(this.element, CSS_PROPERTIES.groupStagger, this.config.stagger);

    setCssTime(this.element, CSS_PROPERTIES.groupDelay, this.config.delay);

    this.instances.forEach((instance) => {
      instance.prepare();
    });

    this.applySequence();

    this.element.classList.add(CLASS_NAMES.groupReady);

    this.state.prepared = true;

    return true;
  }

  /* ========================================================================
     Sequence
     ======================================================================== */

  applySequence() {
    const orderedIndexes = getGroupIndexes(
      this.instances.length,
      this.config.order,
    );

    this.instances.forEach((instance, position) => {
      const animationIndex =
        this.config.order === ORDERS.together
          ? 0
          : orderedIndexes.indexOf(position);

      const element = instance.element;

      if (!this.runtimeDelayRecords.has(instance)) {
        this.runtimeDelayRecords.set(instance, {
          groupIndex: element.style.getPropertyValue(CSS_PROPERTIES.groupIndex),

          runtimeDelay: element.style.getPropertyValue(
            CSS_PROPERTIES.runtimeDelay,
          ),
        });
      }

      setCssNumber(element, CSS_PROPERTIES.groupIndex, animationIndex);

      const componentDelay = Number.isFinite(instance.config?.delay)
        ? instance.config.delay
        : DEFAULTS.delay;

      const sequenceDelay =
        this.config.order === ORDERS.together
          ? 0
          : animationIndex * this.config.stagger;

      setCssTime(
        element,
        CSS_PROPERTIES.runtimeDelay,
        componentDelay + this.config.delay + sequenceDelay,
      );
    });
  }

  restoreInstanceDelay(instance) {
    const record = this.runtimeDelayRecords.get(instance);

    if (!record) return;

    const element = instance.element;

    if (record.groupIndex) {
      element.style.setProperty(CSS_PROPERTIES.groupIndex, record.groupIndex);
    } else {
      element.style.removeProperty(CSS_PROPERTIES.groupIndex);
    }

    if (record.runtimeDelay) {
      element.style.setProperty(
        CSS_PROPERTIES.runtimeDelay,
        record.runtimeDelay,
      );
    } else {
      element.style.removeProperty(CSS_PROPERTIES.runtimeDelay);
    }

    this.runtimeDelayRecords.delete(instance);
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

    this.applySequence();
    this.completedInstances.clear();

    this.state.playing = true;
    this.state.paused = false;
    this.state.complete = false;

    this.element.classList.remove(
      CLASS_NAMES.groupComplete,
      CLASS_NAMES.paused,
    );

    this.element.classList.add(CLASS_NAMES.groupAnimating);

    this.element.setAttribute(ARIA.busy, "true");

    this.instances.forEach((instance) => {
      instance.play({
        restart,
      });
    });

    if (this.instances.length === 0) {
      this.finish();
    }

    dispatchComponentEvent(this.element, COMPONENT_EVENTS.start, {
      group: this,
      instances: [...this.instances],
    });

    return true;
  }

  replay() {
    const played = this.play({
      restart: true,
    });

    if (played) {
      dispatchComponentEvent(this.element, COMPONENT_EVENTS.replay, {
        group: this,
        instances: [...this.instances],
      });
    }

    return played;
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

    this.instances.forEach((instance) => {
      instance.pause();
    });

    dispatchComponentEvent(this.element, COMPONENT_EVENTS.pause, {
      group: this,
    });

    return true;
  }

  resume() {
    if (this.state.destroyed || !this.state.playing || !this.state.paused) {
      return false;
    }

    this.state.paused = false;

    this.element.classList.remove(CLASS_NAMES.paused);

    this.instances.forEach((instance) => {
      instance.resume();
    });

    dispatchComponentEvent(this.element, COMPONENT_EVENTS.resume, {
      group: this,
    });

    return true;
  }

  togglePause() {
    return this.state.paused ? this.resume() : this.pause();
  }

  /* ========================================================================
     Completion
     ======================================================================== */

  finish() {
    if (this.state.destroyed) {
      return false;
    }

    const wasComplete = this.state.complete;

    this.state.playing = false;
    this.state.paused = false;
    this.state.complete = true;

    this.element.classList.remove(
      CLASS_NAMES.groupAnimating,
      CLASS_NAMES.paused,
    );

    this.element.classList.add(CLASS_NAMES.groupComplete);

    this.element.removeAttribute(ARIA.busy);

    if (!wasComplete) {
      dispatchComponentEvent(this.element, COMPONENT_EVENTS.complete, {
        group: this,
        instances: [...this.instances],
      });
    }

    return true;
  }

  /* ========================================================================
     Refresh
     ======================================================================== */

  refresh() {
    if (this.state.destroyed) {
      return false;
    }

    this.config = this.readConfiguration();

    setCssTime(this.element, CSS_PROPERTIES.groupStagger, this.config.stagger);

    setCssTime(this.element, CSS_PROPERTIES.groupDelay, this.config.delay);

    this.applySequence();

    return true;
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

  destroy() {
    if (this.state.destroyed) {
      return;
    }

    this.abortController.abort();

    this.instances.forEach((instance) => {
      this.restoreInstanceDelay(instance);
    });

    this.element.classList.remove(
      CLASS_NAMES.groupReady,
      CLASS_NAMES.groupAnimating,
      CLASS_NAMES.groupComplete,
      CLASS_NAMES.paused,
    );

    restoreAttribute(this.element, ARIA.busy, this.original.busy);

    if (this.original.stagger) {
      this.element.style.setProperty(
        CSS_PROPERTIES.groupStagger,
        this.original.stagger,
      );
    } else {
      this.element.style.removeProperty(CSS_PROPERTIES.groupStagger);
    }

    if (this.original.delay) {
      this.element.style.setProperty(
        CSS_PROPERTIES.groupDelay,
        this.original.delay,
      );
    } else {
      this.element.style.removeProperty(CSS_PROPERTIES.groupDelay);
    }

    this.instances = [];
    this.completedInstances.clear();
    this.runtimeDelayRecords.clear();

    this.state.prepared = false;
    this.state.playing = false;
    this.state.paused = false;
    this.state.complete = false;
    this.state.destroyed = true;

    groupInstances.delete(this.element);
  }
}

/* ==========================================================================
   Public Group Access
   ========================================================================== */

export function getTextAnimationGroup(element) {
  return TextAnimationGroup.getInstance(element);
}

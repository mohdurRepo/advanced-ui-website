import {
  ANIMATION_TYPES,
  CLASS_NAMES,
  COMPONENT_EVENTS,
  CSS_PROPERTIES,
  DATA_ATTRIBUTES,
  DEFAULTS,
  HIGHLIGHT_EFFECTS,
  LIMITS,
  ORDERS,
  ROTATION_EFFECTS,
  SELECTORS,
  SUPPORTED,
  TRIGGERS,
  UNITS,
} from "./constants";

import { CounterAnimation } from "./counter";
import { HighlightAnimation } from "./highlight";
import { getTextAnimationGroup, TextAnimationGroup } from "./group";
import { RevealAnimation } from "./reveal";
import { RotatorAnimation } from "./rotator";
import { TypewriterAnimation } from "./typewriter";

import {
  destroyTextAnimationControls,
  initTextAnimationControls,
} from "./controls";

import {
  dispatchComponentEvent,
  dispatchError,
  getDocumentLocale,
  parseBooleanAttribute,
  parseEnumAttribute,
  parseNumberAttribute,
  prefersReducedMotion,
  queryIncludingRoot,
} from "./utils";

/* ==========================================================================
   Instance Registries
   ========================================================================== */

const instances = new WeakMap();
const instanceCollection = new Set();

const groupCollection = new Set();

/* ==========================================================================
   Infrastructure Registry
   ========================================================================== */

const infrastructures = new WeakMap();

/* ==========================================================================
   Animation Type
   ========================================================================== */

function getAnimationType(element) {
  return parseEnumAttribute(
    element,
    DATA_ATTRIBUTES.animation,
    SUPPORTED.animationTypes,
    DEFAULTS.animationType,
  );
}

/* ==========================================================================
   Effect
   ========================================================================== */

function getEffect(element, type) {
  if (type === ANIMATION_TYPES.highlight) {
    return parseEnumAttribute(
      element,
      DATA_ATTRIBUTES.effect,
      SUPPORTED.highlightEffects,
      DEFAULTS.highlightEffect,
    );
  }

  if (type === ANIMATION_TYPES.rotate) {
    return parseEnumAttribute(
      element,
      DATA_ATTRIBUTES.effect,
      SUPPORTED.rotationEffects,
      DEFAULTS.rotationEffect,
    );
  }

  return parseEnumAttribute(
    element,
    DATA_ATTRIBUTES.effect,
    SUPPORTED.revealEffects,
    DEFAULTS.revealEffect,
  );
}

/* ==========================================================================
   Counter Values
   ========================================================================== */

function parseCounterValue(element, attribute, fallback) {
  return parseNumberAttribute(element, attribute, {
    fallback,
    minimum: Number.NEGATIVE_INFINITY,
    maximum: Number.POSITIVE_INFINITY,
  });
}

/* ==========================================================================
   Configuration
   ========================================================================== */

function readConfiguration(element) {
  const type = getAnimationType(element);

  const defaultDuration =
    type === ANIMATION_TYPES.count
      ? DEFAULTS.counterDuration
      : type === ANIMATION_TYPES.rotate
        ? DEFAULTS.rotateDuration
        : DEFAULTS.duration;

  return {
    type,
    effect: getEffect(element, type),

    unit: parseEnumAttribute(
      element,
      DATA_ATTRIBUTES.unit,
      SUPPORTED.units,
      UNITS.none,
    ),

    trigger: parseEnumAttribute(
      element,
      DATA_ATTRIBUTES.trigger,
      SUPPORTED.triggers,
      DEFAULTS.trigger,
    ),

    order: parseEnumAttribute(
      element,
      DATA_ATTRIBUTES.order,
      SUPPORTED.orders,
      ORDERS.normal,
    ),

    delay: parseNumberAttribute(element, DATA_ATTRIBUTES.delay, {
      fallback: DEFAULTS.delay,
      minimum: LIMITS.minimumDelay,
      maximum: LIMITS.maximumDelay,
    }),

    duration: parseNumberAttribute(element, DATA_ATTRIBUTES.duration, {
      fallback: defaultDuration,
      minimum: LIMITS.minimumDuration,
      maximum: LIMITS.maximumDuration,
    }),

    stagger: parseNumberAttribute(element, DATA_ATTRIBUTES.stagger, {
      fallback: DEFAULTS.stagger,
      minimum: LIMITS.minimumStagger,
      maximum: LIMITS.maximumStagger,
    }),

    maxStagger: parseNumberAttribute(element, DATA_ATTRIBUTES.maxStagger, {
      fallback: DEFAULTS.maxStagger,
      minimum: LIMITS.minimumStagger,
      maximum: LIMITS.maximumDelay,
    }),

    threshold: parseNumberAttribute(element, DATA_ATTRIBUTES.threshold, {
      fallback: DEFAULTS.threshold,
      minimum: LIMITS.minimumThreshold,
      maximum: LIMITS.maximumThreshold,
    }),

    rootMargin:
      element.getAttribute(DATA_ATTRIBUTES.rootMargin)?.trim() ||
      DEFAULTS.rootMargin,

    once: parseBooleanAttribute(element, DATA_ATTRIBUTES.once),

    disabled: parseBooleanAttribute(element, DATA_ATTRIBUTES.disabled),

    locale: getDocumentLocale(element),

    unitLimit: LIMITS.maximumUnits,

    rotateInterval: parseNumberAttribute(element, DATA_ATTRIBUTES.interval, {
      fallback: DEFAULTS.rotateInterval,
      minimum: LIMITS.minimumInterval,
      maximum: LIMITS.maximumInterval,
    }),

    pauseOnHover: parseBooleanAttribute(element, DATA_ATTRIBUTES.pauseOnHover),

    pauseOnFocus: parseBooleanAttribute(element, DATA_ATTRIBUTES.pauseOnFocus),

    typeSpeed: parseNumberAttribute(element, DATA_ATTRIBUTES.speed, {
      fallback: DEFAULTS.typeSpeed,
      minimum: LIMITS.minimumTypeSpeed,
      maximum: LIMITS.maximumTypeSpeed,
    }),

    typeStartDelay: parseNumberAttribute(element, DATA_ATTRIBUTES.startDelay, {
      fallback: DEFAULTS.typeStartDelay,
      minimum: LIMITS.minimumDelay,
      maximum: LIMITS.maximumDelay,
    }),

    counterFrom: parseCounterValue(element, DATA_ATTRIBUTES.from, 0),

    counterTo: parseCounterValue(element, DATA_ATTRIBUTES.to, 0),

    counterDecimals: parseNumberAttribute(element, DATA_ATTRIBUTES.decimals, {
      fallback: DEFAULTS.counterDecimals,
      minimum: LIMITS.minimumDecimals,
      maximum: LIMITS.maximumDecimals,
      integer: true,
    }),

    counterGrouping: parseBooleanAttribute(element, DATA_ATTRIBUTES.grouping),

    counterPrefix: element.getAttribute(DATA_ATTRIBUTES.prefix) || "",

    counterSuffix: element.getAttribute(DATA_ATTRIBUTES.suffix) || "",
  };
}

/* ==========================================================================
   Text Animation
   ========================================================================== */

export class TextAnimation {
  static getInstance(element) {
    return instances.get(element) || null;
  }

  static getOrCreateInstance(element, options = {}) {
    const existing = TextAnimation.getInstance(element);

    if (existing) {
      return existing;
    }

    try {
      return new TextAnimation(element, options);
    } catch (error) {
      element?.classList?.add(CLASS_NAMES.failed);

      dispatchError(element, error, {
        phase: "initialization",
      });

      console.error("Unable to initialize text animation.", error);

      return null;
    }
  }

  constructor(element, { autoActivate = false } = {}) {
    if (!element?.matches?.(SELECTORS.component)) {
      throw new TypeError(
        `TextAnimation requires an element matching "${SELECTORS.component}".`,
      );
    }

    if (instances.has(element)) {
      throw new Error("This text animation is already initialized.");
    }

    this.element = element;
    this.document = element.ownerDocument;
    this.view = this.document.defaultView;

    this.config = readConfiguration(element);

    this.state = {
      prepared: false,
      active: false,
      hasPlayed: false,
      destroyed: false,
    };

    this.driver = null;
    this.intersectionObserver = null;
    this.resizeObserver = null;

    this.abortController = new this.view.AbortController();

    this.reducedMotion = prefersReducedMotion(this.document);

    this.createDriver();
    this.bindEvents();

    instances.set(element, this);
    instanceCollection.add(this);

    if (autoActivate) {
      this.activate();
    }
  }

  /* ========================================================================
     Public State
     ======================================================================== */

  get type() {
    return this.config.type;
  }

  get isPaused() {
    return Boolean(this.driver?.state?.paused);
  }

  get isPlaying() {
    return Boolean(this.driver?.state?.playing || this.driver?.state?.running);
  }

  get isComplete() {
    return Boolean(this.driver?.state?.complete);
  }

  get isDisabled() {
    return Boolean(
      this.config.disabled ||
      this.element.classList.contains(CLASS_NAMES.disabled),
    );
  }

  /* ========================================================================
     Driver
     ======================================================================== */

  createDriver() {
    const commonOptions = {
      delay: this.config.delay,
      reducedMotion: this.reducedMotion,

      onComplete: () => {
        this.handleComplete();
      },
    };

    if (this.config.type === ANIMATION_TYPES.highlight) {
      this.driver = new HighlightAnimation(this.element, {
        ...commonOptions,
        duration: this.config.duration,
      });

      return;
    }

    if (this.config.type === ANIMATION_TYPES.rotate) {
      this.driver = new RotatorAnimation(this.element, {
        interval: this.config.rotateInterval,
        duration: this.config.duration,
        delay: this.config.delay,
        reducedMotion: this.reducedMotion,

        onStart: () => {
          this.state.active = true;
        },

        onChange: (detail) => {
          dispatchComponentEvent(this.element, COMPONENT_EVENTS.change, {
            instance: this,
            type: this.config.type,
            ...detail,
          });
        },
      });

      return;
    }

    if (this.config.type === ANIMATION_TYPES.type) {
      this.driver = new TypewriterAnimation(this.element, {
        speed: this.config.typeSpeed,
        startDelay: this.config.typeStartDelay,
        reducedMotion: this.reducedMotion,

        onComplete: () => {
          this.handleComplete();
        },
      });

      return;
    }

    if (this.config.type === ANIMATION_TYPES.count) {
      this.driver = new CounterAnimation(this.element, {
        from: this.config.counterFrom,
        to: this.config.counterTo,
        decimals: this.config.counterDecimals,
        grouping: this.config.counterGrouping,
        prefix: this.config.counterPrefix,
        suffix: this.config.counterSuffix,

        locale: this.config.locale,
        duration: this.config.duration,
        delay: this.config.delay,
        reducedMotion: this.reducedMotion,

        onComplete: () => {
          this.handleComplete();
        },
      });

      return;
    }

    this.driver = new RevealAnimation(this.element, {
      ...commonOptions,

      unit: this.config.unit,
      locale: this.config.locale,
      order: this.config.order,
      unitLimit: this.config.unitLimit,

      duration: this.config.duration,
      stagger: this.config.stagger,
      maxStagger: this.config.maxStagger,
    });
  }

  /* ========================================================================
     Events
     ======================================================================== */

  listen(target, type, listener, options = {}) {
    if (!target?.addEventListener) {
      return;
    }

    target.addEventListener(type, listener, {
      ...options,
      signal: this.abortController.signal,
    });
  }

  bindEvents() {
    if (
      this.config.type === ANIMATION_TYPES.rotate &&
      this.config.pauseOnHover
    ) {
      this.listen(this.element, "pointerenter", () => {
        this.pause();
      });

      this.listen(this.element, "pointerleave", () => {
        this.resume();
      });
    }

    if (
      this.config.type === ANIMATION_TYPES.rotate &&
      this.config.pauseOnFocus
    ) {
      this.listen(this.element, "focusin", () => {
        this.pause();
      });

      this.listen(this.element, "focusout", (event) => {
        if (!this.element.contains(event.relatedTarget)) {
          this.resume();
        }
      });
    }
  }

  /* ========================================================================
     Preparation
     ======================================================================== */

  prepare() {
    if (this.state.destroyed || this.isDisabled) {
      this.element.classList.add(CLASS_NAMES.disabled);

      return false;
    }

    if (this.state.prepared) {
      return true;
    }

    try {
      const prepared = this.driver?.prepare();

      if (!prepared) {
        throw new Error("The text animation could not prepare its content.");
      }

      this.state.prepared = true;

      dispatchComponentEvent(this.element, COMPONENT_EVENTS.ready, {
        instance: this,
        type: this.config.type,
      });

      return true;
    } catch (error) {
      this.element.classList.add(CLASS_NAMES.failed);

      dispatchError(this.element, error, {
        instance: this,
        phase: "preparation",
      });

      console.error("Unable to prepare text animation.", error);

      return false;
    }
  }

  /* ========================================================================
     Activation
     ======================================================================== */

  activate() {
    if (this.state.destroyed || this.isDisabled || !this.prepare()) {
      return false;
    }

    if (this.config.trigger === TRIGGERS.manual) {
      return true;
    }

    if (
      this.config.trigger === TRIGGERS.immediate ||
      typeof this.view.IntersectionObserver !== "function"
    ) {
      this.play();

      return true;
    }

    this.observeViewport();

    return true;
  }

  observeViewport() {
    this.disconnectIntersectionObserver();

    this.intersectionObserver = new this.view.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.handleIntersection(entry);
        });
      },
      {
        threshold: this.config.threshold,
        rootMargin: this.config.rootMargin,
      },
    );

    this.intersectionObserver.observe(this.element);
  }

  handleIntersection(entry) {
    if (this.state.destroyed || !entry.isIntersecting) {
      return;
    }

    if (this.config.once && this.state.hasPlayed) {
      this.disconnectIntersectionObserver();

      return;
    }

    this.play({
      restart: this.state.hasPlayed && !this.config.once,
    });

    if (this.config.once) {
      this.disconnectIntersectionObserver();
    }
  }

  disconnectIntersectionObserver() {
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
  }

  /* ========================================================================
     Playback
     ======================================================================== */

  play({ restart = false } = {}) {
    if (this.state.destroyed || this.isDisabled || !this.prepare()) {
      return false;
    }

    const beforeStartEvent = dispatchComponentEvent(
      this.element,
      COMPONENT_EVENTS.beforeStart,
      {
        instance: this,
        type: this.config.type,
        restart,
      },
      {
        cancelable: true,
      },
    );

    if (beforeStartEvent?.defaultPrevented) {
      return false;
    }

    let played = false;

    if (this.config.type === ANIMATION_TYPES.rotate) {
      if (restart) {
        played = this.driver.replay();
      } else {
        played = this.driver.start();
      }
    } else {
      played = this.driver.play({
        restart,
      });
    }

    if (!played) {
      return false;
    }

    this.state.active = true;
    this.state.hasPlayed = true;

    dispatchComponentEvent(this.element, COMPONENT_EVENTS.start, {
      instance: this,
      type: this.config.type,
      restart,
    });

    return true;
  }

  replay() {
    const replayed = this.play({
      restart: true,
    });

    if (replayed) {
      dispatchComponentEvent(this.element, COMPONENT_EVENTS.replay, {
        instance: this,
        type: this.config.type,
      });
    }

    return replayed;
  }

  /* ========================================================================
     Pause and Resume
     ======================================================================== */

  pause() {
    if (this.state.destroyed || !this.driver?.pause()) {
      return false;
    }

    dispatchComponentEvent(this.element, COMPONENT_EVENTS.pause, {
      instance: this,
      type: this.config.type,
    });

    return true;
  }

  resume() {
    if (this.state.destroyed || !this.driver?.resume()) {
      return false;
    }

    dispatchComponentEvent(this.element, COMPONENT_EVENTS.resume, {
      instance: this,
      type: this.config.type,
    });

    return true;
  }

  togglePause() {
    return this.isPaused ? this.resume() : this.pause();
  }
  /* ========================================================================
     Rotator Navigation
     ======================================================================== */

  next(options = {}) {
    if (this.state.destroyed || this.config.type !== ANIMATION_TYPES.rotate) {
      return false;
    }

    return this.driver.next(options);
  }

  previous(options = {}) {
    if (this.state.destroyed || this.config.type !== ANIMATION_TYPES.rotate) {
      return false;
    }

    return this.driver.previous(options);
  }

  first(options = {}) {
    if (this.state.destroyed || this.config.type !== ANIMATION_TYPES.rotate) {
      return false;
    }

    return this.driver.first(options);
  }

  last(options = {}) {
    if (this.state.destroyed || this.config.type !== ANIMATION_TYPES.rotate) {
      return false;
    }

    return this.driver.last(options);
  }

  /* ========================================================================
     Counter Updates
     ======================================================================== */

  updateValue(value, options = {}) {
    if (
      this.state.destroyed ||
      this.config.type !== ANIMATION_TYPES.count ||
      !Number.isFinite(value)
    ) {
      return false;
    }

    this.config.counterTo = value;

    return this.driver.updateValue(value, options);
  }

  /* ========================================================================
     Completion
     ======================================================================== */

  handleComplete() {
    if (this.state.destroyed) {
      return;
    }

    this.state.active = false;

    dispatchComponentEvent(this.element, COMPONENT_EVENTS.complete, {
      instance: this,
      type: this.config.type,
    });
  }

  /* ========================================================================
     Line Measurement
     ======================================================================== */

  observeLineChanges() {
    if (
      this.config.unit !== UNITS.lines ||
      typeof this.view.ResizeObserver !== "function"
    ) {
      return;
    }

    this.disconnectResizeObserver();

    let previousInlineSize = this.element.getBoundingClientRect().width;

    let frameId = null;

    this.resizeObserver = new this.view.ResizeObserver((entries) => {
      const entry = entries[0];

      const nextInlineSize = entry?.contentRect?.width || 0;

      if (Math.abs(nextInlineSize - previousInlineSize) < 1) {
        return;
      }

      previousInlineSize = nextInlineSize;

      if (frameId !== null) {
        this.view.cancelAnimationFrame(frameId);
      }

      frameId = this.view.requestAnimationFrame(() => {
        frameId = null;

        if (
          !this.state.destroyed &&
          typeof this.driver?.refreshLines === "function"
        ) {
          this.driver.refreshLines();
        }
      });
    });

    this.resizeObserver.observe(this.element);
  }

  disconnectResizeObserver() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  /* ========================================================================
     Reduced Motion
     ======================================================================== */

  setReducedMotion(reducedMotion) {
    if (this.state.destroyed || this.reducedMotion === reducedMotion) {
      return false;
    }

    this.reducedMotion = reducedMotion;

    this.updateDriverConfiguration();

    return true;
  }

  /* ========================================================================
     Driver Configuration
     ======================================================================== */

  updateDriverConfiguration() {
    if (!this.driver?.update) {
      return false;
    }

    if (this.config.type === ANIMATION_TYPES.highlight) {
      return this.driver.update({
        duration: this.config.duration,
        delay: this.config.delay,
        reducedMotion: this.reducedMotion,
      });
    }

    if (this.config.type === ANIMATION_TYPES.rotate) {
      return this.driver.update({
        interval: this.config.rotateInterval,
        duration: this.config.duration,
        delay: this.config.delay,
        reducedMotion: this.reducedMotion,
      });
    }

    if (this.config.type === ANIMATION_TYPES.type) {
      return this.driver.update({
        speed: this.config.typeSpeed,
        startDelay: this.config.typeStartDelay,
        reducedMotion: this.reducedMotion,
      });
    }

    if (this.config.type === ANIMATION_TYPES.count) {
      return this.driver.update({
        from: this.config.counterFrom,
        to: this.config.counterTo,
        decimals: this.config.counterDecimals,
        grouping: this.config.counterGrouping,
        prefix: this.config.counterPrefix,
        suffix: this.config.counterSuffix,
        locale: this.config.locale,
        duration: this.config.duration,
        delay: this.config.delay,
        reducedMotion: this.reducedMotion,
      });
    }

    return this.driver.update({
      duration: this.config.duration,
      delay: this.config.delay,
      stagger: this.config.stagger,
      maxStagger: this.config.maxStagger,
      reducedMotion: this.reducedMotion,
    });
  }

  /* ========================================================================
     Structural Refresh
     ======================================================================== */

  rebuildDriver(nextConfiguration) {
    const wasActive = this.state.active;
    const hadPlayed = this.state.hasPlayed;

    this.disconnectIntersectionObserver();
    this.disconnectResizeObserver();

    this.abortController.abort();

    this.driver?.destroy();

    this.config = nextConfiguration;

    this.abortController = new this.view.AbortController();

    this.state.prepared = false;
    this.state.active = false;
    this.state.hasPlayed = hadPlayed;

    this.createDriver();
    this.bindEvents();

    const prepared = this.prepare();

    if (!prepared) {
      return false;
    }

    if (this.config.unit === UNITS.lines) {
      this.observeLineChanges();
    }

    if (wasActive || this.config.trigger !== TRIGGERS.manual) {
      this.activate();
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

    const nextConfiguration = readConfiguration(this.element);

    const requiresRebuild =
      nextConfiguration.type !== this.config.type ||
      nextConfiguration.unit !== this.config.unit ||
      nextConfiguration.order !== this.config.order ||
      nextConfiguration.locale !== this.config.locale;

    if (requiresRebuild) {
      return this.rebuildDriver(nextConfiguration);
    }

    this.config = nextConfiguration;

    this.element.classList.toggle(CLASS_NAMES.disabled, this.config.disabled);

    if (this.config.disabled) {
      this.driver?.finish?.({
        notify: false,
      });

      return true;
    }

    this.updateDriverConfiguration();

    if (
      this.config.unit === UNITS.lines &&
      typeof this.driver?.refreshLines === "function"
    ) {
      this.driver.refreshLines();
      this.observeLineChanges();
    }

    return true;
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

  destroy() {
    if (this.state.destroyed) {
      return;
    }

    this.state.destroyed = true;

    this.disconnectIntersectionObserver();
    this.disconnectResizeObserver();

    this.abortController.abort();

    this.driver?.destroy();
    this.driver = null;

    this.element.classList.remove(
      CLASS_NAMES.ready,
      CLASS_NAMES.animating,
      CLASS_NAMES.complete,
      CLASS_NAMES.paused,
      CLASS_NAMES.disabled,
      CLASS_NAMES.failed,
      CLASS_NAMES.loading,
      CLASS_NAMES.updating,
      CLASS_NAMES.transitioning,
      CLASS_NAMES.unitLimit,
    );

    instances.delete(this.element);
    instanceCollection.delete(this);

    dispatchComponentEvent(this.element, COMPONENT_EVENTS.destroy, {
      instance: this,
      type: this.config.type,
    });

    this.state.prepared = false;
    this.state.active = false;
  }
}

/* ==========================================================================
   Root Containment
   ========================================================================== */

function rootContains(root, element) {
  if (!root || !element) {
    return false;
  }

  if (root.nodeType === Node.DOCUMENT_NODE) {
    return root.documentElement.contains(element);
  }

  return root === element || root.contains(element);
}

function getRootDocument(root) {
  return root.nodeType === Node.DOCUMENT_NODE ? root : root.ownerDocument;
}

/* ==========================================================================
   Collection Access
   ========================================================================== */

function getInstancesWithin(root) {
  return Array.from(instanceCollection).filter(
    (instance) =>
      !instance.state.destroyed && rootContains(root, instance.element),
  );
}

function getGroupsWithin(root) {
  return Array.from(groupCollection).filter(
    (group) => !group.state.destroyed && rootContains(root, group.element),
  );
}

/* ==========================================================================
   Group Membership
   ========================================================================== */

function getDirectGroupInstances(groupElement, root) {
  return getInstancesWithin(root).filter(
    (instance) => instance.element.closest(SELECTORS.group) === groupElement,
  );
}

/* ==========================================================================
   Group Activation
   ========================================================================== */

function activateGroup(group, infrastructure) {
  const element = group.element;

  const trigger = parseEnumAttribute(
    element,
    DATA_ATTRIBUTES.trigger,
    SUPPORTED.triggers,
    DEFAULTS.trigger,
  );

  if (trigger === TRIGGERS.manual) {
    group.prepare();
    return;
  }

  if (
    trigger === TRIGGERS.immediate ||
    typeof infrastructure.view.IntersectionObserver !== "function"
  ) {
    group.play();
    return;
  }

  const threshold = parseNumberAttribute(element, DATA_ATTRIBUTES.threshold, {
    fallback: DEFAULTS.threshold,
    minimum: LIMITS.minimumThreshold,
    maximum: LIMITS.maximumThreshold,
  });

  const rootMargin =
    element.getAttribute(DATA_ATTRIBUTES.rootMargin)?.trim() ||
    DEFAULTS.rootMargin;

  const observer = new infrastructure.view.IntersectionObserver(
    (entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);

      if (!visible) {
        return;
      }

      group.play();

      observer.disconnect();
      infrastructure.groupObservers.delete(group);
    },
    {
      threshold,
      rootMargin,
    },
  );

  observer.observe(element);

  infrastructure.groupObservers.set(group, observer);
}

/* ==========================================================================
   Infrastructure
   ========================================================================== */

function createInfrastructure(documentReference) {
  const view = documentReference.defaultView;

  const infrastructure = {
    document: documentReference,
    view,

    roots: new Set(),
    groupObservers: new Map(),

    controls: null,
    mediaQuery: null,
    mediaListener: null,
  };

  if (typeof view.matchMedia === "function") {
    infrastructure.mediaQuery = view.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    infrastructure.mediaListener = () => {
      const reducedMotion = prefersReducedMotion(documentReference);

      Array.from(instanceCollection)
        .filter((instance) => instance.document === documentReference)
        .forEach((instance) => {
          instance.setReducedMotion(reducedMotion);
        });
    };

    infrastructure.mediaQuery.addEventListener?.(
      "change",
      infrastructure.mediaListener,
    );
  }

  infrastructures.set(documentReference, infrastructure);

  return infrastructure;
}

function getInfrastructure(documentReference) {
  return (
    infrastructures.get(documentReference) ||
    createInfrastructure(documentReference)
  );
}

/* ==========================================================================
   Instance Initialization
   ========================================================================== */

function initializeInstances(root) {
  return queryIncludingRoot(root, SELECTORS.component)
    .map((element) =>
      TextAnimation.getOrCreateInstance(element, {
        autoActivate: false,
      }),
    )
    .filter(Boolean);
}

/* ==========================================================================
   Group Initialization
   ========================================================================== */

function initializeGroups(root) {
  const groups = queryIncludingRoot(root, SELECTORS.group).map((element) => {
    const group = TextAnimationGroup.getOrCreateInstance(element, {
      instances: getDirectGroupInstances(element, root),
    });

    groupCollection.add(group);

    return group;
  });

  return groups;
}

/* ==========================================================================
   Activation
   ========================================================================== */

function activateInitializedComponents(root, groups, infrastructure) {
  const groupedInstances = new Set();

  groups.forEach((group) => {
    group.instances.forEach((instance) => {
      groupedInstances.add(instance);
    });

    activateGroup(group, infrastructure);
  });

  getInstancesWithin(root).forEach((instance) => {
    if (groupedInstances.has(instance)) {
      return;
    }

    instance.activate();

    if (instance.config.unit === UNITS.lines) {
      instance.observeLineChanges();
    }
  });
}

/* ==========================================================================
   Controls
   ========================================================================== */

function initializeControls(root, infrastructure) {
  infrastructure.controls = initTextAnimationControls(root, {
    getInstance: (element) => TextAnimation.getInstance(element),

    getGroup: (element) => getTextAnimationGroup(element),

    getInstances: () => getInstancesWithin(root),

    getGroups: () => getGroupsWithin(root),
  });

  infrastructure.controls.sync();
}

/* ==========================================================================
   Public Initialization
   ========================================================================== */

export function initTextAnimations(root = document) {
  if (!root?.querySelectorAll) {
    return [];
  }

  const documentReference = getRootDocument(root);

  const infrastructure = getInfrastructure(documentReference);

  infrastructure.roots.add(root);

  const initializedInstances = initializeInstances(root);

  const initializedGroups = initializeGroups(root);

  activateInitializedComponents(root, initializedGroups, infrastructure);

  initializeControls(root, infrastructure);

  return initializedInstances;
}

/* ==========================================================================
   Public Instance Access
   ========================================================================== */

export function getTextAnimation(element) {
  return TextAnimation.getInstance(element);
}

/* ==========================================================================
   Public Refresh
   ========================================================================== */

export function refreshTextAnimations(root = document) {
  if (!root?.querySelectorAll) {
    return [];
  }

  const newInstances = initializeInstances(root);

  getInstancesWithin(root).forEach((instance) => {
    instance.refresh();
  });

  const groups = initializeGroups(root);

  groups.forEach((group) => {
    group.refresh();
  });

  const infrastructure = getInfrastructure(getRootDocument(root));

  activateInitializedComponents(root, groups, infrastructure);

  initializeControls(root, infrastructure);

  return newInstances;
}

/* ==========================================================================
   Public Destruction
   ========================================================================== */

export function destroyTextAnimations(root = document) {
  if (!root) {
    return false;
  }

  const documentReference = getRootDocument(root);

  const infrastructure = infrastructures.get(documentReference);

  getGroupsWithin(root).forEach((group) => {
    const observer = infrastructure?.groupObservers.get(group);

    observer?.disconnect();

    infrastructure?.groupObservers.delete(group);

    group.destroy();
    groupCollection.delete(group);
  });

  getInstancesWithin(root).forEach((instance) => {
    instance.destroy();
  });

  destroyTextAnimationControls(root);

  infrastructure?.roots.delete(root);

  if (infrastructure && infrastructure.roots.size === 0) {
    infrastructure.groupObservers.forEach((observer) => {
      observer.disconnect();
    });

    infrastructure.groupObservers.clear();

    if (infrastructure.mediaQuery && infrastructure.mediaListener) {
      infrastructure.mediaQuery.removeEventListener?.(
        "change",
        infrastructure.mediaListener,
      );
    }

    infrastructures.delete(documentReference);
  }

  return true;
}

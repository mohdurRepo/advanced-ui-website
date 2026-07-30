/* ==========================================================================
   Selectors
   ========================================================================== */

export const SELECTORS = Object.freeze({
  component: "[data-text-animation]",
  group: "[data-text-animation-group]",
  phrase: "[data-text-animation-phrase]",

  replay: "[data-text-animation-replay]",
  replayAll: "[data-text-animation-replay-all]",
  pauseAll: "[data-text-animation-pause-all]",

  rotateToggle: "[data-text-animation-toggle]",
  rotatePrevious: "[data-text-animation-previous]",
  rotateNext: "[data-text-animation-next]",

  content: ".text-animation__content",
  unit: ".text-animation__unit",
  accessible: ".text-animation__accessible",

  counterValue: ".text-animation__counter-value",
  counterPrefix: ".text-animation__counter-prefix",
  counterSuffix: ".text-animation__counter-suffix",

  typing: ".text-animation__typing",
});

/* ==========================================================================
   Data Attributes
   ========================================================================== */

export const DATA_ATTRIBUTES = Object.freeze({
  animation: "data-text-animation",
  effect: "data-text-animation-effect",
  unit: "data-text-animation-unit",
  trigger: "data-text-animation-trigger",
  order: "data-text-animation-order",

  delay: "data-text-animation-delay",
  duration: "data-text-animation-duration",
  stagger: "data-text-animation-stagger",
  maxStagger: "data-text-animation-max-stagger",

  threshold: "data-text-animation-threshold",
  rootMargin: "data-text-animation-root-margin",

  once: "data-text-animation-once",
  disabled: "data-text-animation-disabled",

  phrase: "data-text-animation-phrase",
  interval: "data-text-animation-interval",
  pauseOnHover: "data-text-animation-pause-on-hover",
  pauseOnFocus: "data-text-animation-pause-on-focus",

  cursor: "data-text-animation-cursor",
  cursorHide: "data-text-animation-cursor-hide",
  speed: "data-text-animation-speed",
  startDelay: "data-text-animation-start-delay",

  from: "data-text-animation-from",
  to: "data-text-animation-to",
  decimals: "data-text-animation-decimals",
  prefix: "data-text-animation-prefix",
  suffix: "data-text-animation-suffix",
  grouping: "data-text-animation-grouping",

  group: "data-text-animation-group",
  groupStagger: "data-text-animation-group-stagger",
  groupDelay: "data-text-animation-group-delay",
  groupOrder: "data-text-animation-group-order",
});

/* ==========================================================================
   Class Names
   ========================================================================== */

export const CLASS_NAMES = Object.freeze({
  ready: "is-text-animation-ready",
  animating: "is-text-animation-animating",
  complete: "is-text-animation-complete",
  paused: "is-text-animation-paused",
  disabled: "is-text-animation-disabled",
  failed: "is-text-animation-failed",
  loading: "is-text-animation-loading",
  updating: "is-text-animation-updating",
  transitioning: "is-text-animation-transitioning",
  unitLimit: "is-text-animation-unit-limit",

  groupReady: "is-text-animation-group-ready",
  groupAnimating: "is-text-animation-group-animating",
  groupComplete: "is-text-animation-group-complete",

  active: "is-active",
  entering: "is-entering",
  leaving: "is-leaving",
  whitespace: "is-whitespace",

  content: "text-animation__content",
  unit: "text-animation__unit",
  word: "text-animation__word",
  character: "text-animation__character",
  space: "text-animation__space",
  line: "text-animation__line",
  lineClip: "text-animation__line-clip",
  accessible: "text-animation__accessible",

  typing: "text-animation__typing",

  counterValue: "text-animation__counter-value",
  counterPrefix: "text-animation__counter-prefix",
  counterSuffix: "text-animation__counter-suffix",
});

/* ==========================================================================
   Animation Types
   ========================================================================== */

export const ANIMATION_TYPES = Object.freeze({
  reveal: "reveal",
  highlight: "highlight",
  rotate: "rotate",
  type: "type",
  count: "count",
});

/* ==========================================================================
   Reveal Effects
   ========================================================================== */

export const REVEAL_EFFECTS = Object.freeze({
  fade: "fade",
  fadeUp: "fade-up",
  fadeDown: "fade-down",
  slideInline: "slide-inline",
  slideInlineEnd: "slide-inline-end",
  scale: "scale",
  blurIn: "blur-in",
  clip: "clip",
});

/* ==========================================================================
   Highlight Effects
   ========================================================================== */

export const HIGHLIGHT_EFFECTS = Object.freeze({
  underline: "underline",
  marker: "marker",
  fill: "fill",
});

/* ==========================================================================
   Rotation Effects
   ========================================================================== */

export const ROTATION_EFFECTS = Object.freeze({
  fade: "fade",
  fadeUp: "fade-up",
  slideInline: "slide-inline",
  scale: "scale",
});

/* ==========================================================================
   Animation Units
   ========================================================================== */

export const UNITS = Object.freeze({
  none: "none",
  words: "words",
  characters: "characters",
  lines: "lines",
});

/* ==========================================================================
   Activation Triggers
   ========================================================================== */

export const TRIGGERS = Object.freeze({
  viewport: "viewport",
  immediate: "immediate",
  manual: "manual",
});

/* ==========================================================================
   Sequence Orders
   ========================================================================== */

export const ORDERS = Object.freeze({
  normal: "normal",
  reverse: "reverse",
  center: "center",
  together: "together",
});

/* ==========================================================================
   Component Events
   ========================================================================== */

export const COMPONENT_EVENTS = Object.freeze({
  ready: "text-animation:ready",
  beforeStart: "text-animation:before-start",
  start: "text-animation:start",
  complete: "text-animation:complete",
  replay: "text-animation:replay",
  pause: "text-animation:pause",
  resume: "text-animation:resume",
  change: "text-animation:change",
  destroy: "text-animation:destroy",
  error: "text-animation:error",
});

/* ==========================================================================
   DOM Events
   ========================================================================== */

export const DOM_EVENTS = Object.freeze({
  animationEnd: "animationend",
  click: "click",
  focusIn: "focusin",
  focusOut: "focusout",
  mouseEnter: "mouseenter",
  mouseLeave: "mouseleave",
  pointerEnter: "pointerenter",
  pointerLeave: "pointerleave",
  visibilityChange: "visibilitychange",
});

/* ==========================================================================
   Keyboard Keys
   ========================================================================== */

export const KEYS = Object.freeze({
  enter: "Enter",
  space: " ",
  arrowLeft: "ArrowLeft",
  arrowRight: "ArrowRight",
  home: "Home",
  end: "End",
});

/* ==========================================================================
   CSS Custom Properties
   ========================================================================== */

export const CSS_PROPERTIES = Object.freeze({
  delay: "--text-animation-delay",
  duration: "--text-animation-duration",
  runtimeDelay: "--text-animation-runtime-delay",
  runtimeDuration: "--text-animation-runtime-duration",
  runtimeStagger: "--text-animation-runtime-stagger",

  index: "--text-animation-index",
  groupIndex: "--text-animation-group-index",

  groupStagger: "--text-animation-group-stagger",
  groupDelay: "--text-animation-group-delay",

  rotateInlineSize: "--text-animation-rotate-inline-size",
  rotateBlockSize: "--text-animation-rotate-block-size",
});

/* ==========================================================================
   ARIA Attributes
   ========================================================================== */

export const ARIA = Object.freeze({
  atomic: "aria-atomic",
  busy: "aria-busy",
  hidden: "aria-hidden",
  label: "aria-label",
  live: "aria-live",
  pressed: "aria-pressed",
});

/* ==========================================================================
   Defaults
   ========================================================================== */

export const DEFAULTS = Object.freeze({
  animationType: ANIMATION_TYPES.reveal,
  revealEffect: REVEAL_EFFECTS.fadeUp,
  highlightEffect: HIGHLIGHT_EFFECTS.underline,
  rotationEffect: ROTATION_EFFECTS.fadeUp,

  unit: UNITS.none,
  trigger: TRIGGERS.viewport,
  order: ORDERS.normal,

  delay: 0,
  duration: 560,
  stagger: 60,
  maxStagger: 800,

  threshold: 0.2,
  rootMargin: "0px 0px -8% 0px",

  rotateInterval: 2800,
  rotateDuration: 420,

  typeSpeed: 55,
  typeStartDelay: 250,

  counterDuration: 1200,
  counterDecimals: 0,

  groupStagger: 120,
  groupDelay: 0,

  unitLimit: 240,
  minimumInterval: 800,
  maximumDuration: 60000,

  locale: "en",
});

/* ==========================================================================
   Internal Boundaries
   ========================================================================== */

export const LIMITS = Object.freeze({
  minimumDelay: 0,
  maximumDelay: 60000,

  minimumDuration: 0,
  maximumDuration: DEFAULTS.maximumDuration,

  minimumStagger: 0,
  maximumStagger: 5000,

  minimumThreshold: 0,
  maximumThreshold: 1,

  minimumInterval: DEFAULTS.minimumInterval,
  maximumInterval: 60000,

  minimumTypeSpeed: 0,
  maximumTypeSpeed: 2000,

  minimumDecimals: 0,
  maximumDecimals: 20,

  maximumUnits: DEFAULTS.unitLimit,
});

/* ==========================================================================
   Supported Values
   ========================================================================== */

export const SUPPORTED = Object.freeze({
  animationTypes: Object.freeze(Object.values(ANIMATION_TYPES)),
  revealEffects: Object.freeze(Object.values(REVEAL_EFFECTS)),
  highlightEffects: Object.freeze(Object.values(HIGHLIGHT_EFFECTS)),
  rotationEffects: Object.freeze(Object.values(ROTATION_EFFECTS)),
  units: Object.freeze(Object.values(UNITS)),
  triggers: Object.freeze(Object.values(TRIGGERS)),
  orders: Object.freeze(Object.values(ORDERS)),
});

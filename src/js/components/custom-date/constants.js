/* ==========================================================================
   Class Names
   ========================================================================== */

export const CLASS_NAMES = Object.freeze({
  /* Component */
  component: "custom-date",
  range: "custom-date--range",

  /* Native fallback */
  fallback: "custom-date__fallback",
  native: "custom-date__native",
  nativeRange: "custom-date__native-range",
  initialTrigger: "custom-date__initial-trigger",

  /* Enhanced interface */
  interface: "custom-date__interface",
  control: "custom-date__control",
  trigger: "custom-date__trigger",
  value: "custom-date__value",
  indicator: "custom-date__indicator",
  clear: "custom-date__clear",

  /* Unified range value */
  rangeValue: "custom-date__range-value",
  rangeStart: "custom-date__range-start",
  rangeEnd: "custom-date__range-end",
  rangeSeparator: "custom-date__range-separator",
  rangeInstruction: "custom-date__range-instruction",

  /* Popover */
  popover: "custom-date__popover",
  popoverShell: "custom-date__popover-shell",
  popoverMain: "custom-date__popover-main",
  popoverFooter: "custom-date__popover-footer",
  calendars: "custom-date__calendars",
  status: "custom-date__status",

  /* Calendar */
  calendarPanel: "custom-date__calendar-panel",
  calendarPrimary: "custom-date__calendar-panel--primary",
  calendarSecondary: "custom-date__calendar-panel--secondary",
  calendarHeader: "custom-date__calendar-header",
  calendarView: "custom-date__calendar-view",

  /* Navigation */
  navGroup: "custom-date__nav-group",
  nav: "custom-date__nav",
  navPreviousMonth: "custom-date__nav--previous-month",
  navNextMonth: "custom-date__nav--next-month",
  navPreviousYear: "custom-date__nav--previous-year",
  navNextYear: "custom-date__nav--next-year",

  /* Calendar title */
  titleGroup: "custom-date__title-group",
  title: "custom-date__title",
  titleMonth: "custom-date__title--month",
  titleYear: "custom-date__title--year",

  /* Weekdays */
  weekdays: "custom-date__weekdays",
  weekday: "custom-date__weekday",

  /* Days */
  days: "custom-date__days",
  day: "custom-date__day",
  dayNumber: "custom-date__day-number",
  dayBlank: "custom-date__day--blank",

  /* Month and year picker */
  picker: "custom-date__picker",
  pickerGrid: "custom-date__picker-grid",
  pickerMonths: "custom-date__picker-grid--months",
  pickerYears: "custom-date__picker-grid--years",
  pickerOption: "custom-date__picker-option",

  /* Presets */
  presets: "custom-date__presets",
  presetsLabel: "custom-date__presets-label",
  preset: "custom-date__preset",

  /* Footer */
  selectionSummary: "custom-date__selection-summary",
  selectionSummaryLabel: "custom-date__selection-summary-label",
  selectionSummaryValue: "custom-date__selection-summary-value",
  actions: "custom-date__actions",
  action: "custom-date__action",
  actionClear: "custom-date__action--clear",
  actionToday: "custom-date__action--today",
  actionCancel: "custom-date__action--cancel",
  actionApply: "custom-date__action--apply",

  /* Component state */
  enhanced: "is-enhanced",
  enhancementFailed: "is-enhancement-failed",
  open: "is-open",
  openUp: "is-open-up",
  positioned: "is-positioned",
  closing: "is-closing",

  /* Control state */
  disabled: "is-disabled",
  readonly: "is-readonly",
  loading: "is-loading",
  valid: "is-valid",
  invalid: "is-invalid",
  nativeFocused: "is-native-focused",
  placeholder: "is-placeholder",
  hasValue: "has-value",

  /* Calendar state */
  active: "is-active",
  selected: "is-selected",
  today: "is-today",
  outsideMonth: "is-outside-month",

  /* Range state */
  rangeStartState: "is-range-start",
  rangeEndState: "is-range-end",
  inRange: "is-in-range",
  rangePreview: "is-range-preview",
  previewStart: "is-preview-start",
  previewEnd: "is-preview-end",
  sameDayRange: "is-same-day-range",

  /* Motion state */
  entering: "is-entering",
  movingForward: "is-moving-forward",
  movingBackward: "is-moving-backward",
  justSelected: "is-just-selected",

  /* Footer state */
  presetsOnly: "is-presets-only",
  actionsOnly: "is-actions-only",
});

/* ==========================================================================
   Selectors
   ========================================================================== */

const classSelector = (name) => `.${CLASS_NAMES[name]}`;

export const SELECTORS = Object.freeze({
  /* Component */
  component: "[data-custom-date], [data-custom-date-range]",
  singleComponent: "[data-custom-date]",
  rangeComponent: "[data-custom-date-range]",

  /* Native fallback */
  fallback: classSelector("fallback"),
  native: classSelector("native"),
  nativeRange: classSelector("nativeRange"),
  startInput: "[data-date-start]",
  endInput: "[data-date-end]",

  /* Enhanced interface */
  interface: classSelector("interface"),
  control: classSelector("control"),
  trigger: classSelector("trigger"),
  value: classSelector("value"),
  indicator: classSelector("indicator"),
  clear: classSelector("clear"),

  /* Popover */
  popover: classSelector("popover"),
  popoverMain: classSelector("popoverMain"),
  popoverFooter: classSelector("popoverFooter"),

  /* Calendar */
  calendars: classSelector("calendars"),
  calendarPanel: classSelector("calendarPanel"),
  calendarPrimary: classSelector("calendarPrimary"),
  calendarSecondary: classSelector("calendarSecondary"),
  calendarView: classSelector("calendarView"),

  /* Navigation */
  nav: classSelector("nav"),
  title: classSelector("title"),
  monthTitle: classSelector("titleMonth"),
  yearTitle: classSelector("titleYear"),

  /* Days */
  days: classSelector("days"),
  day: classSelector("day"),
  enabledDay: `.${CLASS_NAMES.day}:not(
    :disabled,
    .${CLASS_NAMES.disabled},
    [aria-disabled="true"]
  )`,

  /* Pickers */
  picker: classSelector("picker"),
  pickerOption: classSelector("pickerOption"),

  /* Presets */
  presets: classSelector("presets"),
  preset: classSelector("preset"),

  /* Footer */
  selectionSummary: classSelector("selectionSummary"),
  actions: classSelector("actions"),
  action: classSelector("action"),
  actionClear: classSelector("actionClear"),
  actionToday: classSelector("actionToday"),
  actionCancel: classSelector("actionCancel"),
  actionApply: classSelector("actionApply"),

  /* Forms */
  form: "form",
});

/* ==========================================================================
   Data Attributes
   ========================================================================== */

export const DATA_ATTRIBUTES = Object.freeze({
  /* Component */
  single: "data-custom-date",
  range: "data-custom-date-range",

  /* Native range inputs */
  start: "data-date-start",
  end: "data-date-end",

  /* Configuration */
  clearable: "data-clearable",
  placeholder: "data-placeholder",
  disablePast: "data-disable-past",
  disableFuture: "data-disable-future",
  disabledWeekdays: "data-disabled-weekdays",
  presets: "data-presets",
  action: "data-action",

  /* Generated state */
  placement: "data-placement",
  activeBoundary: "data-active-boundary",
  view: "data-view",
  side: "data-side",
  date: "data-date",
  month: "data-month",
  year: "data-year",
  preset: "data-preset",
});

/* ==========================================================================
   ARIA Attributes
   ========================================================================== */

export const ARIA = Object.freeze({
  activeDescendant: "aria-activedescendant",
  busy: "aria-busy",
  controls: "aria-controls",
  current: "aria-current",
  describedBy: "aria-describedby",
  disabled: "aria-disabled",
  expanded: "aria-expanded",
  hasPopup: "aria-haspopup",
  hidden: "aria-hidden",
  invalid: "aria-invalid",
  label: "aria-label",
  labelledBy: "aria-labelledby",
  live: "aria-live",
  modal: "aria-modal",
  pressed: "aria-pressed",
  required: "aria-required",
  selected: "aria-selected",
});

/* ==========================================================================
   Roles
   ========================================================================== */

export const ROLES = Object.freeze({
  application: "application",
  button: "button",
  dialog: "dialog",
  grid: "grid",
  gridCell: "gridcell",
  group: "group",
  heading: "heading",
  status: "status",
});

/* ==========================================================================
   Keyboard Keys
   ========================================================================== */

export const KEYS = Object.freeze({
  arrowDown: "ArrowDown",
  arrowLeft: "ArrowLeft",
  arrowRight: "ArrowRight",
  arrowUp: "ArrowUp",
  end: "End",
  enter: "Enter",
  escape: "Escape",
  home: "Home",
  pageDown: "PageDown",
  pageUp: "PageUp",
  space: " ",
  tab: "Tab",
});

/* ==========================================================================
   DOM Events
   ========================================================================== */

export const DOM_EVENTS = Object.freeze({
  blur: "blur",
  change: "change",
  click: "click",
  focus: "focus",
  input: "input",
  keydown: "keydown",
  pointerdown: "pointerdown",
  pointerenter: "pointerenter",
  pointerleave: "pointerleave",
  pointermove: "pointermove",
  reset: "reset",
  resize: "resize",
  scroll: "scroll",
  touchmove: "touchmove",
  wheel: "wheel",
});

/* ==========================================================================
   Component Events
   ========================================================================== */

export const COMPONENT_EVENTS = Object.freeze({
  beforeOpen: "form:date-before-open",
  open: "form:date-open",
  close: "form:date-close",
  change: "form:date-change",
  clear: "form:date-clear",
  viewChange: "form:date-view-change",
});

/* ==========================================================================
   Modes
   ========================================================================== */

export const MODES = Object.freeze({
  single: "single",
  range: "range",
});

/* ==========================================================================
   Range Boundaries
   ========================================================================== */

export const BOUNDARIES = Object.freeze({
  start: "start",
  end: "end",
});

/* ==========================================================================
   Calendar Views
   ========================================================================== */

export const VIEWS = Object.freeze({
  days: "days",
  months: "months",
  years: "years",
});

/* ==========================================================================
   Calendar Sides
   ========================================================================== */

export const SIDES = Object.freeze({
  primary: "primary",
  secondary: "secondary",
});

/* ==========================================================================
   Placements
   ========================================================================== */

export const PLACEMENTS = Object.freeze({
  bottom: "bottom-start",
  top: "top-start",
});

/* ==========================================================================
   Presets
   ========================================================================== */

export const PRESETS = Object.freeze({
  today: "today",
  yesterday: "yesterday",
  last7: "last7",
  last30: "last30",
  thisMonth: "thisMonth",
  lastMonth: "lastMonth",
});

/* ==========================================================================
   Date Constraints
   ========================================================================== */

/**
 * `Date#getDay()` uses:
 *
 * 0 Sunday
 * 1 Monday
 * 2 Tuesday
 * 3 Wednesday
 * 4 Thursday
 * 5 Friday
 * 6 Saturday
 */

export const WEEKDAYS = Object.freeze({
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
});

/* ==========================================================================
   Defaults
   ========================================================================== */

export const DEFAULTS = Object.freeze({
  closeDuration: 140,
  rangeSeparator: "–",

  firstDayOfWeek: 0,
  visibleMonths: 2,

  yearPageSize: 20,
  yearRangeBefore: 100,
  yearRangeAfter: 20,

  typeaheadDelay: 700,

  estimatedPopoverHeight: 480,
  popoverGap: 8,
  viewportGap: 12,

  mobileBreakpoint: 768,

  singlePlaceholder: "YYYY-MM-DD",
  rangePlaceholder: "YYYY-MM-DD – YYYY-MM-DD",
});

/* ==========================================================================
   ISO Date Pattern
   ========================================================================== */

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

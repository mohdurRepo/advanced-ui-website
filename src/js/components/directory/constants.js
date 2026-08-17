/* ==========================================================================
   Directory Constants
   ========================================================================== */

/*
 * Shared selectors and state definitions for reusable directory behavior.
 *
 * The component does not depend on:
 *
 * - <main>
 * - page-specific body classes
 * - a shared parent around filters and results
 *
 * Alphabet controls locate their result panels through aria-controls.
 */

export const SELECTORS = {
  /* Alphabet */

  alphabet: "[data-directory-alphabet]",
  alphabetControl: "[data-directory-letter]",
  letterInput: "[data-directory-letter-input]",

  /* Controlled Results */

  group: "[data-directory-group]",
  resultItem: ".directory-results__item",

  /* Optional Status Elements */

  liveStatus: "[data-directory-live-status]",
  resultCount: ".directory__count-value",
  toolbarStatus: ".directory-toolbar__status",

  /* Filter Form */

  filterForm: "[data-directory-filter-form]",
  filterReset: "[data-directory-filter-reset]",
};

/* ==========================================================================
   Attributes
   ========================================================================== */

export const ATTRIBUTES = {
  letter: "data-directory-letter",
  group: "data-directory-group",

  controls: "aria-controls",
  pressed: "aria-pressed",
  disabled: "aria-disabled",

  busy: "aria-busy",
  hidden: "hidden",
};

/* ==========================================================================
   Classes
   ========================================================================== */

export const CLASSES = {
  active: "is-active",
  disabled: "is-disabled",
  hidden: "is-hidden",
  empty: "is-empty",
};

/* ==========================================================================
   Events
   ========================================================================== */

export const EVENTS = {
  change: "directory:alphabet-change",
  reset: "directory:alphabet-reset",
};

/* ==========================================================================
   Default Labels
   ========================================================================== */

export const LABELS = {
  all: "All",
  allResults: "Showing all directory groups.",
  noResults: "No directory groups match the selected letter.",

  results(count, letter) {
    const noun = count === 1 ? "result" : "results";

    return `${count} ${noun} beginning with ${letter}.`;
  },
};

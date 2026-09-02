/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_VIEW = "overview";

export const GROUP_ORDER = Object.freeze([
  "company-name",
  "prev-close",
  "top",
  "tov",
]);

const WIDTHS = Object.freeze({
  "company-name": "15.5rem",
  "prev-close": "8.5rem",
  "top": "5.5rem",
  "tov": "6.75rem",
});

/* ==========================================================================
   Helpers
   ========================================================================== */

function cleanLabel(value, fallback = "") {
  return String(value ?? fallback)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getLabels(config = {}) {
  return config.labels?.table || {};
}

function column(definition = {}) {
  return {
    mobile: true,
    ...definition,
  };
}

function sizedColumn(width, definition = {}) {
  return column({
    width,
    ...definition,
  });
}

/* ==========================================================================
   Internal Generators
   ========================================================================== */

function createGroups(config = {}) {
  const labels = getLabels(config);
 
  return {
    "company-name": {
      id: "company-name",
      label: cleanLabel(labels.companyName, "Company Name"),
    },
 
    "prev-close": {
      id: "prev-close",
      label: cleanLabel(labels.previousClose, "Previous Close"),
    },
 
    "top": {
      id: "top",
      label: cleanLabel(labels.top, "TOP"),
    },

    "tov": {
      id: "tov",
      label: cleanLabel(labels.tov, "TOV"),
    },
  };
}

/**
 * Creates the explicit list of static columns mapping 1:1 to your layout structure.
 * Binds the exact CSS target classes and data attributes from your JSP nodes.
 */

function createColumns(config = {}) {
    const labels = getLabels(config);

    return [

        /* ----------------------------------------------------------------------
           Company Name
           ---------------------------------------------------------------------- */

        sizedColumn(WIDTHS["company-name"], {
            key: "companyName",

            label: cleanLabel(labels.companyName, "companyName"),

            /*
             * Always-visible first column.
             */
            data: "companyName",

            type: "text",

            className: "table-market__security",

            /*
             * Identity is always shown as the first column.
             */
            mobile: false,
        }),

        /* ----------------------------------------------------------------------
           Previous Close
           ---------------------------------------------------------------------- */

        sizedColumn(WIDTHS["prev-close"], {
            key: "previousClose",

            visibilityGroup: "prev-close",

            label: cleanLabel(labels.previousClose, "Previous Close"),

            data: "prev_close",

            type: "display-value",

            className: "table-market__range",
        }),

        /* ----------------------------------------------------------------------
           Top
           ---------------------------------------------------------------------- */

        sizedColumn(WIDTHS["top"], {
            key: "top",

            visibilityGroup: "top",

            label: cleanLabel(labels.top, "Top"),

            data: "top",

            type: "display-value",

            className: "table-market__group-heading",
        }),

        /* ----------------------------------------------------------------------
           TOV
           ---------------------------------------------------------------------- */

        sizedColumn(WIDTHS["tov"], {
            key: "tov",

            visibilityGroup: "tov",

            label: cleanLabel(labels.tov, "TOV"),

            data: "tov",

            type: "display-value",

            className: "table-market__group-heading",
        }),
    ];
}
 

/* ==========================================================================
   Public Columns
   ========================================================================== */

export function getColumns(config = {}, view = DEFAULT_VIEW) {
  /*
   * Nomu Market Watch currently has a static presentation schema.
   * Keep the view argument for compatibility with the common Data View contract.
   */
  void view;
  return createColumns(config);
}

/* ==========================================================================
   Column Groups
   ========================================================================== */

export function getColumnGroups(config = {}, view = DEFAULT_VIEW) {
  const groups = createGroups(config);

  const available = new Set(
    getColumns(config, view)
      .map((item) => item.visibilityGroup)
      .filter(Boolean),
  );

  return GROUP_ORDER.filter((groupId) => available.has(groupId)).map(
    (groupId) => groups[groupId],
  );
}

/* ==========================================================================
   Visible Columns
   ========================================================================== */

export function getVisibleColumns(
  config = {},
  view = DEFAULT_VIEW,
  visibleGroups = GROUP_ORDER,
) {
  const selected = new Set(visibleGroups);

  return getColumns(config, view).filter((item) => {
    /*
     * Ungrouped columns are always visible.
     */
    if (!item.visibilityGroup) {
      return true;
    }

    return selected.has(item.visibilityGroup);
  });
}

/* ==========================================================================
   Mobile Columns
   ========================================================================== */

export function getMobileColumns(
  config = {},
  view = DEFAULT_VIEW,
  visibleGroups = GROUP_ORDER,
) {
  return getVisibleColumns(config, view, visibleGroups).filter(
    (item) => item.mobile !== false,
  );
}

/* ==========================================================================
   Column Indexes by Group
   ========================================================================== */

export function getColumnIndexesByGroup(config = {}, view = DEFAULT_VIEW) {
  return getColumns(config, view).reduce((result, item, index) => {
    const groupId = item.visibilityGroup;

    if (!groupId) {
      return result;
    }

    if (!result[groupId]) {
      result[groupId] = [];
    }

    result[groupId].push(index);

    return result;
  }, {});
}

/* ==========================================================================
   Column Lookup
   ========================================================================== */

export function getColumnByKey(config = {}, view = DEFAULT_VIEW, key) {
  return getColumns(config, view).find((item) => item.key === key) || null;
}

/* ==========================================================================
   Default Groups
   ========================================================================== */

export function getDefaultVisibleGroups() {
  return [...GROUP_ORDER];
}

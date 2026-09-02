/* ==========================================================================
   Sukuk Columns
   ========================================================================== */

/*
* Single source of truth for Sukuk & Bonds presentation columns.
*/

/* ==========================================================================
   Constants
   ========================================================================== */

const DEFAULT_VIEW = "1";

const GROUP_ORDER = Object.freeze([
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

/*
 * ==========================================================================
 * Helpers
 * ==========================================================================
 */

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

/*
 * ==========================================================================
 * Column Groups
 * ==========================================================================
 */

function createGroups(config = {}) {
  const labels = getLabels(config);

  return {
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

/*
 * ==========================================================================
 * Columns Definition
 * ==========================================================================
 */

function createColumns(config = {}) {
  const labels = getLabels(config);

  return [
    /*
	 * ----------------------------------------------------------------------
	 * Company Name & Symbol (Fixed - No visibilityGroup attached)
	 * ----------------------------------------------------------------------
	 */
    sizedColumn(WIDTHS["company-name"], {
      key: "companyName",
      label: cleanLabel(labels.companyName, "Company Name"),
      type: "company",
      className: "table-market__security",
      mobile: false,
    }),

    /*
	 * ----------------------------------------------------------------------
	 * Previous Close
	 * ----------------------------------------------------------------------
	 */
    sizedColumn(WIDTHS["prev-close"], {
      key: "previousClose",
      visibilityGroup: "prev-close",
      label: cleanLabel(labels.previousClose, "Previous Close"),
      data: "prev_close",
      type: "text",
      className: "table-market__text",
    }),

    /*
	 * ----------------------------------------------------------------------
	 * TOP
	 * ----------------------------------------------------------------------
	 */
    sizedColumn(WIDTHS["top"], {
      key: "top",
      visibilityGroup: "top",
      label: cleanLabel(labels.top, "TOP"),
      data: "top",
      type: "display-value",
      className: "table-market__text",
    }),

    /*
	 * ----------------------------------------------------------------------
	 * TOV
	 * ----------------------------------------------------------------------
	 */
    sizedColumn(WIDTHS["tov"], {
      key: "tov",
      visibilityGroup: "tov",
      label: cleanLabel(labels.tov, "TOV"),
      data: "tov",
      type: "display-value",
      className: "table-market__number",
    }),
  ];
}

/*
 * ==========================================================================
 * Public Columns API
 * ==========================================================================
 */

export function getColumns(config = {}, view = DEFAULT_VIEW) {
  void view;
  return createColumns(config);
}

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

export function getVisibleColumns(
  config = {},
  view = DEFAULT_VIEW,
  visibleGroups = GROUP_ORDER,
) {
  const selected = new Set(visibleGroups);

  return getColumns(config, view).filter((item) => {
    if (!item.visibilityGroup) {
      return true;
    }
    return selected.has(item.visibilityGroup);
  });
}

export function getMobileColumns(
  config = {},
  view = DEFAULT_VIEW,
  visibleGroups = GROUP_ORDER,
) {
  return getVisibleColumns(config, view, visibleGroups).filter(
    (item) => item.mobile !== false,
  );
}

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

export function getColumnByKey(config = {}, view = DEFAULT_VIEW, key) {
  return getColumns(config, view).find((item) => item.key === key) || null;
}

export function getDefaultVisibleGroups() {
  return [...GROUP_ORDER];
}
 
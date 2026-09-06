import { ARIA, CLASS_NAMES, DATA_ATTRIBUTES, PRESETS } from "./constants";

import {
  addDays,
  addMonths,
  createElement,
  endOfMonth,
  getToday,
  isSameDay,
  startOfMonth,
} from "./utils";

/* ==========================================================================
   Supported Presets
   ========================================================================== */

export const SUPPORTED_PRESETS = Object.freeze(Object.values(PRESETS));

/* ==========================================================================
   Preset Date Calculation
   ========================================================================== */

function getTodayRange(today) {
  return {
    startDate: today,
    endDate: today,
  };
}

function getYesterdayRange(today) {
  const yesterday = addDays(today, -1);

  if (!yesterday) {
    return null;
  }

  return {
    startDate: yesterday,

    endDate: yesterday,
  };
}

function getLastDaysRange(today, numberOfDays) {
  if (!Number.isInteger(numberOfDays) || numberOfDays < 1) {
    return null;
  }

  const startDate = addDays(today, -(numberOfDays - 1));

  if (!startDate) {
    return null;
  }

  return {
    startDate,

    endDate: today,
  };
}

function getThisMonthRange(today) {
  const startDate = startOfMonth(today);

  if (!startDate) {
    return null;
  }

  return {
    startDate,

    /*
     * "This month" intentionally means month-to-date rather than the entire
     * calendar month.
     */
    endDate: today,
  };
}

function getLastMonthRange(today) {
  /*
   * Use the shared civil-date arithmetic rather than constructing Date
   * directly. This keeps month calculations consistent with the rest of the
   * date picker and avoids JavaScript's special handling of years 0–99.
   */
  const currentMonthStart = startOfMonth(today);

  if (!currentMonthStart) {
    return null;
  }

  const previousMonthDate = addMonths(currentMonthStart, -1);

  if (!previousMonthDate) {
    return null;
  }

  const startDate = startOfMonth(previousMonthDate);

  const endDate = endOfMonth(previousMonthDate);

  if (!startDate || !endDate) {
    return null;
  }

  return {
    startDate,
    endDate,
  };
}

/* ==========================================================================
   Resolve Preset
   ========================================================================== */

export function getPresetRange(preset, today = getToday()) {
  if (!today) {
    return null;
  }

  switch (preset) {
    case PRESETS.today:
      return getTodayRange(today);

    case PRESETS.yesterday:
      return getYesterdayRange(today);

    case PRESETS.last7:
      return getLastDaysRange(today, 7);

    case PRESETS.last30:
      return getLastDaysRange(today, 30);

    case PRESETS.thisMonth:
      return getThisMonthRange(today);

    case PRESETS.lastMonth:
      return getLastMonthRange(today);

    default:
      return null;
  }
}

/* ==========================================================================
   Preset Validation
   ========================================================================== */

/**
 * A preset is available only when both boundaries can be selected.
 *
 * Disabled dates between the boundaries do not invalidate the range. This
 * allows ranges such as "Last 7 days" to include unavailable weekends while
 * still preventing an unavailable date from becoming a selected boundary.
 */
export function isPresetAvailable(
  preset,
  { today = getToday(), isDateDisabled = null, isRangeSelectable = null } = {},
) {
  const range = getPresetRange(preset, today);

  if (!range) {
    return false;
  }

  /*
   * Keep this explicit boundary check even when isRangeSelectable is also
   * provided. Consumers may supply either callback independently.
   */
  if (
    typeof isDateDisabled === "function" &&
    (isDateDisabled(range.startDate) || isDateDisabled(range.endDate))
  ) {
    return false;
  }

  if (
    typeof isRangeSelectable === "function" &&
    !isRangeSelectable(range.startDate, range.endDate)
  ) {
    return false;
  }

  return true;
}

/* ==========================================================================
   Active Preset
   ========================================================================== */

export function getMatchingPreset(
  presets,
  startDate,
  endDate,
  today = getToday(),
) {
  if (!startDate || !endDate) {
    return null;
  }

  const presetList = Array.isArray(presets) ? presets : [];

  return (
    presetList.find((preset) => {
      const range = getPresetRange(preset, today);

      return Boolean(
        range &&
        isSameDay(range.startDate, startDate) &&
        isSameDay(range.endDate, endDate),
      );
    }) || null
  );
}

/* ==========================================================================
   Preset Button
   ========================================================================== */

function createPresetButton({
  preset,
  label,
  active,
  disabled,
  documentReference,
}) {
  return createElement(
    "button",
    {
      className: [
        CLASS_NAMES.preset,

        active ? CLASS_NAMES.active : "",

        disabled ? CLASS_NAMES.disabled : "",
      ]
        .filter(Boolean)
        .join(" "),

      attributes: {
        type: "button",

        [DATA_ATTRIBUTES.preset]: preset,

        [ARIA.pressed]: String(active),

        [ARIA.disabled]: disabled ? "true" : null,

        disabled: disabled || null,
      },

      text: label,
    },
    documentReference,
  );
}

/* ==========================================================================
   Normalize Presets
   ========================================================================== */

function normalizePresets(presets) {
  if (!Array.isArray(presets)) {
    return [];
  }

  return [
    ...new Set(presets.filter((preset) => SUPPORTED_PRESETS.includes(preset))),
  ];
}

/* ==========================================================================
   Render Presets
   ========================================================================== */

export function renderCustomDatePresets({
  container,
  presets = [],
  messages,
  selectedStart = null,
  selectedEnd = null,
  today = getToday(),
  isDateDisabled = null,
  isRangeSelectable = null,
}) {
  if (!container) {
    return {
      records: [],
      activePreset: null,
    };
  }

  const normalizedPresets = normalizePresets(presets);

  const activePreset = getMatchingPreset(
    normalizedPresets,
    selectedStart,
    selectedEnd,
    today,
  );

  /*
   * markup.js creates this node initially. Preserve and reuse the same element
   * so any external references to it remain valid.
   */
  const labelElement = container.querySelector(`.${CLASS_NAMES.presetsLabel}`);

  container.replaceChildren();

  if (labelElement) {
    labelElement.textContent = messages?.presetsLabel || "";

    container.append(labelElement);
  } else {
    container.append(
      createElement(
        "span",
        {
          className: CLASS_NAMES.presetsLabel,

          text: messages?.presetsLabel || "",
        },
        container.ownerDocument,
      ),
    );
  }

  const records = normalizedPresets.map((preset) => {
    const range = getPresetRange(preset, today);

    const available = Boolean(
      range &&
      isPresetAvailable(preset, {
        today,
        isDateDisabled,
        isRangeSelectable,
      }),
    );

    const label = messages?.presetLabels?.[preset] || preset;

    const element = createPresetButton({
      preset,
      label,

      active: preset === activePreset,

      disabled: !available,

      documentReference: container.ownerDocument,
    });

    container.append(element);

    return {
      preset,
      element,
      available,
      range,
    };
  });

  /*
   * Hide the complete presets region when there are no configured presets.
   * Setting the property to false correctly restores it when presets later
   * become available through refresh().
   */
  container.hidden = records.length === 0;

  return {
    records,
    activePreset,
  };
}

/* ==========================================================================
   Synchronize Preset State
   ========================================================================== */

export function syncCustomDatePresetState({
  records = [],
  selectedStart,
  selectedEnd,
  today = getToday(),
}) {
  const safeRecords = Array.isArray(records) ? records : [];

  const presets = safeRecords.map((record) => record.preset);

  const activePreset = getMatchingPreset(
    presets,
    selectedStart,
    selectedEnd,
    today,
  );

  safeRecords.forEach((record) => {
    if (!record?.element) {
      return;
    }

    const active = record.preset === activePreset;

    record.element.classList.toggle(CLASS_NAMES.active, active);

    record.element.setAttribute(ARIA.pressed, String(active));
  });

  return activePreset;
}

import { ARIA, CLASS_NAMES, DATA_ATTRIBUTES, PRESETS } from "./constants";
import {
  addDays,
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

  return {
    startDate: yesterday,
    endDate: yesterday,
  };
}

function getLastDaysRange(today, numberOfDays) {
  return {
    startDate: addDays(today, -(numberOfDays - 1)),
    endDate: today,
  };
}

function getThisMonthRange(today) {
  return {
    startDate: startOfMonth(today),
    endDate: today,
  };
}

function getLastMonthRange(today) {
  const previousMonthDate = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1,
    12,
    0,
    0,
    0,
  );

  return {
    startDate: startOfMonth(previousMonthDate),
    endDate: endOfMonth(previousMonthDate),
  };
}

/* ==========================================================================
   Resolve Preset
   ========================================================================== */

export function getPresetRange(preset, today = getToday()) {
  if (!today) return null;

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

  if (!range) return false;

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
  if (!startDate || !endDate) return null;

  return (
    presets.find((preset) => {
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
   Render Presets
   ========================================================================== */

export function renderCustomDatePresets({
  container,
  presets,
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

  const normalizedPresets = [
    ...new Set(presets.filter((preset) => SUPPORTED_PRESETS.includes(preset))),
  ];

  const activePreset = getMatchingPreset(
    normalizedPresets,
    selectedStart,
    selectedEnd,
    today,
  );

  const labelElement = container.querySelector(`.${CLASS_NAMES.presetsLabel}`);

  container.replaceChildren();

  if (labelElement) {
    labelElement.textContent = messages.presetsLabel;
    container.append(labelElement);
  } else {
    container.append(
      createElement(
        "span",
        {
          className: CLASS_NAMES.presetsLabel,
          text: messages.presetsLabel,
        },
        container.ownerDocument,
      ),
    );
  }

  const records = normalizedPresets.map((preset) => {
    const available = isPresetAvailable(preset, {
      today,
      isDateDisabled,
      isRangeSelectable,
    });

    const element = createPresetButton({
      preset,
      label: messages.presetLabels[preset] || preset,
      active: preset === activePreset,
      disabled: !available,
      documentReference: container.ownerDocument,
    });

    container.append(element);

    return {
      preset,
      element,
      available,
      range: getPresetRange(preset, today),
    };
  });

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
  records,
  selectedStart,
  selectedEnd,
  today = getToday(),
}) {
  const presets = records.map((record) => record.preset);

  const activePreset = getMatchingPreset(
    presets,
    selectedStart,
    selectedEnd,
    today,
  );

  records.forEach((record) => {
    const active = record.preset === activePreset;

    record.element.classList.toggle(CLASS_NAMES.active, active);

    record.element.setAttribute(ARIA.pressed, String(active));
  });

  return activePreset;
}

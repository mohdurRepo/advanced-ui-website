import {
  ARIA,
  BOUNDARIES,
  CLASS_NAMES,
  DATA_ATTRIBUTES,
  DEFAULTS,
  MODES,
  ROLES,
  SIDES,
  VIEWS,
} from "./constants";

import {
  addDays,
  addMonths,
  compareDates,
  createElement,
  formatAccessibleDate,
  formatAccessibleMonth,
  formatISODate,
  getMonthNames,
  getToday,
  getWeekdayNames,
  isDateBetween,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "./utils";

/* ==========================================================================
   Calendar Actions
   ========================================================================== */

export const CALENDAR_ACTIONS = Object.freeze({
  previousMonth: "previous-month",
  nextMonth: "next-month",
  previousYear: "previous-year",
  nextYear: "next-year",
  showMonths: "show-months",
  showYears: "show-years",
  selectDate: "select-date",
  selectMonth: "select-month",
  selectYear: "select-year",
});

/* ==========================================================================
   Calendar Grid
   ========================================================================== */

/**
 * Every calendar renders six complete weeks.
 *
 * A fixed 42-cell grid prevents the popover height from changing between
 * months.
 *
 * Single-date calendars display adjacent-month dates. Dual range calendars
 * render those positions as blank cells so the same date never appears in
 * both panels.
 */

function getCalendarDates(viewDate, firstDayOfWeek) {
  const monthStart = startOfMonth(viewDate);
  const gridStart = startOfWeek(monthStart, firstDayOfWeek);

  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

/* ==========================================================================
   Range State
   ========================================================================== */

function getOrderedPreviewDates(startDate, previewDate) {
  if (!startDate || !previewDate) {
    return {
      previewStart: null,
      previewEnd: null,
    };
  }

  return compareDates(startDate, previewDate) <= 0
    ? {
        previewStart: startDate,
        previewEnd: previewDate,
      }
    : {
        previewStart: previewDate,
        previewEnd: startDate,
      };
}

function getRangeClasses({
  date,
  mode,
  selectedStart,
  selectedEnd,
  previewDate,
  activeBoundary,
}) {
  if (mode !== MODES.range || !selectedStart) {
    return [];
  }

  const classes = [];

  const isStart = isSameDay(date, selectedStart);

  const isEnd = selectedEnd && isSameDay(date, selectedEnd);

  if (isStart) {
    classes.push(CLASS_NAMES.rangeStartState);
  }

  if (isEnd) {
    classes.push(CLASS_NAMES.rangeEndState);
  }

  if (isStart && isEnd) {
    classes.push(CLASS_NAMES.sameDayRange);
  }

  if (
    selectedEnd &&
    isDateBetween(date, selectedStart, selectedEnd, { inclusive: false })
  ) {
    classes.push(CLASS_NAMES.inRange);
  }

  if (!selectedEnd && previewDate && activeBoundary === BOUNDARIES.end) {
    const preview = getOrderedPreviewDates(selectedStart, previewDate);

    if (
      isDateBetween(date, preview.previewStart, preview.previewEnd, {
        inclusive: false,
      })
    ) {
      classes.push(CLASS_NAMES.rangePreview);
    }

    if (isSameDay(date, preview.previewStart)) {
      classes.push(CLASS_NAMES.previewStart);
    }

    if (isSameDay(date, preview.previewEnd)) {
      classes.push(CLASS_NAMES.previewEnd);
    }
  }

  return classes;
}

/* ==========================================================================
   Navigation Button
   ========================================================================== */

function createNavigationButton({
  action,
  className,
  iconClass,
  label,
  side,
  documentReference,
}) {
  return createElement(
    "button",
    {
      className:
        `${CLASS_NAMES.nav} ${className} ` +
        `has-icon ${iconClass} icon-flip-rtl`,
      attributes: {
        type: "button",
        [ARIA.label]: label,
        "data-date-navigation": action,
        [DATA_ATTRIBUTES.side]: side,
      },
    },
    documentReference,
  );
}

/* ==========================================================================
   Calendar Header
   ========================================================================== */

function createCalendarHeader({
  viewDate,
  side,
  locale,
  messages,
  documentReference,
}) {
  const headerElement = createElement(
    "div",
    {
      className: CLASS_NAMES.calendarHeader,
    },
    documentReference,
  );

  const previousGroup = createElement(
    "div",
    {
      className: CLASS_NAMES.navGroup,
    },
    documentReference,
  );

  const nextGroup = createElement(
    "div",
    {
      className: CLASS_NAMES.navGroup,
    },
    documentReference,
  );

  const previousYearElement = createNavigationButton({
    action: CALENDAR_ACTIONS.previousYear,
    className: CLASS_NAMES.navPreviousYear,
    iconClass: "icon-chevron-left",
    label: messages.previousYear,
    side,
    documentReference,
  });

  const previousMonthElement = createNavigationButton({
    action: CALENDAR_ACTIONS.previousMonth,
    className: CLASS_NAMES.navPreviousMonth,
    iconClass: "icon-chevron-left",
    label: messages.previousMonth,
    side,
    documentReference,
  });

  const nextMonthElement = createNavigationButton({
    action: CALENDAR_ACTIONS.nextMonth,
    className: CLASS_NAMES.navNextMonth,
    iconClass: "icon-chevron-right",
    label: messages.nextMonth,
    side,
    documentReference,
  });

  const nextYearElement = createNavigationButton({
    action: CALENDAR_ACTIONS.nextYear,
    className: CLASS_NAMES.navNextYear,
    iconClass: "icon-chevron-right",
    label: messages.nextYear,
    side,
    documentReference,
  });

  previousGroup.append(previousYearElement, previousMonthElement);

  nextGroup.append(nextMonthElement, nextYearElement);

  const titleGroup = createElement(
    "div",
    {
      className: CLASS_NAMES.titleGroup,
    },
    documentReference,
  );

  const monthNames = getMonthNames(locale);

  const monthElement = createElement(
    "button",
    {
      className: `${CLASS_NAMES.title} ` + CLASS_NAMES.titleMonth,
      attributes: {
        type: "button",
        [ARIA.label]: messages.chooseMonth,
        "data-date-navigation": CALENDAR_ACTIONS.showMonths,
        [DATA_ATTRIBUTES.side]: side,
      },
      text: monthNames[viewDate.getMonth()],
    },
    documentReference,
  );

  const yearElement = createElement(
    "button",
    {
      className: `${CLASS_NAMES.title} ` + CLASS_NAMES.titleYear,
      attributes: {
        type: "button",
        [ARIA.label]: messages.chooseYear,
        "data-date-navigation": CALENDAR_ACTIONS.showYears,
        [DATA_ATTRIBUTES.side]: side,
      },
      text: String(viewDate.getFullYear()),
    },
    documentReference,
  );

  titleGroup.append(monthElement, yearElement);

  headerElement.append(previousGroup, titleGroup, nextGroup);

  return headerElement;
}

/* ==========================================================================
   Weekdays
   ========================================================================== */

function createWeekdays({ locale, firstDayOfWeek, documentReference }) {
  const weekdaysElement = createElement(
    "div",
    {
      className: CLASS_NAMES.weekdays,
      attributes: {
        role: "row",
      },
    },
    documentReference,
  );

  const shortNames = getWeekdayNames(locale, {
    width: "short",
    firstDayOfWeek,
  });

  const longNames = getWeekdayNames(locale, {
    width: "long",
    firstDayOfWeek,
  });

  shortNames.forEach((shortName, index) => {
    const weekdayElement = createElement(
      "div",
      {
        className: CLASS_NAMES.weekday,
        attributes: {
          role: "columnheader",
          [ARIA.label]: longNames[index],
        },
        text: shortName,
      },
      documentReference,
    );

    weekdaysElement.append(weekdayElement);
  });

  return weekdaysElement;
}

/* ==========================================================================
   Blank Day Cell
   ========================================================================== */

/**
 * Blank cells preserve the six-week grid without creating a second selectable
 * representation of a date already shown by the adjacent month panel.
 */

function createBlankDayCell(documentReference) {
  return createElement(
    "span",
    {
      className: `${CLASS_NAMES.day} ` + CLASS_NAMES.dayBlank,
      attributes: {
        role: "presentation",
        [ARIA.hidden]: "true",
      },
    },
    documentReference,
  );
}

/* ==========================================================================
   Date Button
   ========================================================================== */

function createDayButton({
  date,
  viewDate,
  mode,
  locale,
  selectedStart,
  selectedEnd,
  previewDate,
  activeBoundary,
  activeDate,
  isDateDisabled,
  documentReference,
}) {
  const isoDate = formatISODate(date);

  const disabled = Boolean(isDateDisabled?.(date));

  const today = getToday();

  const selected =
    mode === MODES.single
      ? isSameDay(date, selectedStart)
      : isSameDay(date, selectedStart) || isSameDay(date, selectedEnd);

  const classes = [CLASS_NAMES.day];

  if (!isSameMonth(date, viewDate)) {
    classes.push(CLASS_NAMES.outsideMonth);
  }

  if (isSameDay(date, today)) {
    classes.push(CLASS_NAMES.today);
  }

  if (selected && mode === MODES.single) {
    classes.push(CLASS_NAMES.selected);
  }

  if (disabled) {
    classes.push(CLASS_NAMES.disabled);
  }

  classes.push(
    ...getRangeClasses({
      date,
      mode,
      selectedStart,
      selectedEnd,
      previewDate,
      activeBoundary,
    }),
  );

  const active = isSameDay(date, activeDate);

  if (active) {
    classes.push(CLASS_NAMES.active);
  }

  const buttonElement = createElement(
    "button",
    {
      className: classes.join(" "),
      attributes: {
        type: "button",
        role: ROLES.gridCell,
        [DATA_ATTRIBUTES.date]: isoDate,
        [ARIA.label]: formatAccessibleDate(date, locale),
        [ARIA.selected]: String(Boolean(selected)),
        [ARIA.current]: isSameDay(date, today) ? "date" : null,
        [ARIA.disabled]: disabled ? "true" : null,
        disabled: disabled || null,
        tabindex: active ? "0" : "-1",
      },
    },
    documentReference,
  );

  const numberElement = createElement(
    "span",
    {
      className: CLASS_NAMES.dayNumber,
      attributes: {
        [ARIA.hidden]: "true",
      },
      text: String(date.getDate()),
    },
    documentReference,
  );

  buttonElement.append(numberElement);

  return {
    date,
    element: buttonElement,
    disabled,
  };
}

/* ==========================================================================
   Days View
   ========================================================================== */

function createDaysView({
  viewDate,
  mode,
  locale,
  firstDayOfWeek,
  selectedStart,
  selectedEnd,
  previewDate,
  activeBoundary,
  activeDate,
  isDateDisabled,
  documentReference,
}) {
  const viewElement = createElement(
    "div",
    {
      className: CLASS_NAMES.calendarView,
      attributes: {
        [DATA_ATTRIBUTES.view]: VIEWS.days,
      },
    },
    documentReference,
  );

  const weekdaysElement = createWeekdays({
    locale,
    firstDayOfWeek,
    documentReference,
  });

  const daysElement = createElement(
    "div",
    {
      className: CLASS_NAMES.days,
      attributes: {
        role: ROLES.grid,
        [ARIA.label]: formatAccessibleMonth(viewDate, locale),
      },
    },
    documentReference,
  );

  const dayRecords = [];

  getCalendarDates(viewDate, firstDayOfWeek).forEach((date) => {
    const outsideMonth = !isSameMonth(date, viewDate);

    /*
     * Adjacent-month days are useful in a single calendar. Range calendars
     * use blank cells so the same date never appears in both month panels.
     */
    if (mode === MODES.range && outsideMonth) {
      daysElement.append(createBlankDayCell(documentReference));

      return;
    }

    const record = createDayButton({
      date,
      viewDate,
      mode,
      locale,
      selectedStart,
      selectedEnd,
      previewDate,
      activeBoundary,
      activeDate,
      isDateDisabled,
      documentReference,
    });

    dayRecords.push(record);

    daysElement.append(record.element);
  });

  viewElement.append(weekdaysElement, daysElement);

  return {
    viewElement,
    daysElement,
    dayRecords,
  };
}

/* ==========================================================================
   Month Picker
   ========================================================================== */

function createMonthPicker({ viewDate, side, locale, documentReference }) {
  const pickerElement = createElement(
    "div",
    {
      className: `${CLASS_NAMES.picker} ` + CLASS_NAMES.entering,
      attributes: {
        [DATA_ATTRIBUTES.view]: VIEWS.months,
      },
    },
    documentReference,
  );

  const gridElement = createElement(
    "div",
    {
      className: `${CLASS_NAMES.pickerGrid} ` + CLASS_NAMES.pickerMonths,
      attributes: {
        role: ROLES.grid,
      },
    },
    documentReference,
  );

  const monthNames = getMonthNames(locale, { width: "long" });

  const optionRecords = monthNames.map((monthName, monthIndex) => {
    const selected = monthIndex === viewDate.getMonth();

    const optionElement = createElement(
      "button",
      {
        className: [
          CLASS_NAMES.pickerOption,
          selected ? CLASS_NAMES.selected : "",
        ]
          .filter(Boolean)
          .join(" "),
        attributes: {
          type: "button",
          role: ROLES.gridCell,
          [DATA_ATTRIBUTES.month]: monthIndex,
          [DATA_ATTRIBUTES.side]: side,
          [ARIA.selected]: String(selected),
          tabindex: selected ? "0" : "-1",
        },
        text: monthName,
      },
      documentReference,
    );

    return {
      month: monthIndex,
      element: optionElement,
    };
  });

  optionRecords.forEach((record) => {
    gridElement.append(record.element);
  });

  pickerElement.append(gridElement);

  return {
    viewElement: pickerElement,
    pickerElement,
    pickerGridElement: gridElement,
    pickerRecords: optionRecords,
    dayRecords: [],
  };
}

/* ==========================================================================
   Year Picker
   ========================================================================== */

function createYearPicker({
  viewDate,
  side,
  minimumDate,
  maximumDate,
  documentReference,
}) {
  const currentYear = viewDate.getFullYear();

  const minimumYear =
    minimumDate?.getFullYear() ?? currentYear - DEFAULTS.yearRangeBefore;

  const maximumYear =
    maximumDate?.getFullYear() ?? currentYear + DEFAULTS.yearRangeAfter;

  const pickerElement = createElement(
    "div",
    {
      className: `${CLASS_NAMES.picker} ` + CLASS_NAMES.entering,
      attributes: {
        [DATA_ATTRIBUTES.view]: VIEWS.years,
      },
    },
    documentReference,
  );

  const gridElement = createElement(
    "div",
    {
      className: `${CLASS_NAMES.pickerGrid} ` + CLASS_NAMES.pickerYears,
      attributes: {
        role: ROLES.grid,
      },
    },
    documentReference,
  );

  const optionRecords = [];

  for (let year = minimumYear; year <= maximumYear; year += 1) {
    const selected = year === currentYear;

    const optionElement = createElement(
      "button",
      {
        className: [
          CLASS_NAMES.pickerOption,
          selected ? CLASS_NAMES.selected : "",
        ]
          .filter(Boolean)
          .join(" "),
        attributes: {
          type: "button",
          role: ROLES.gridCell,
          [DATA_ATTRIBUTES.year]: year,
          [DATA_ATTRIBUTES.side]: side,
          [ARIA.selected]: String(selected),
          tabindex: selected ? "0" : "-1",
        },
        text: String(year),
      },
      documentReference,
    );

    optionRecords.push({
      year,
      element: optionElement,
    });
  }

  optionRecords.forEach((record) => {
    gridElement.append(record.element);
  });

  pickerElement.append(gridElement);

  return {
    viewElement: pickerElement,
    pickerElement,
    pickerGridElement: gridElement,
    pickerRecords: optionRecords,
    dayRecords: [],
  };
}

/* ==========================================================================
   Panel View
   ========================================================================== */

function createPanelView({
  panelView,
  pickerSide,
  side,
  viewDate,
  mode,
  locale,
  firstDayOfWeek,
  selectedStart,
  selectedEnd,
  previewDate,
  activeBoundary,
  activeDate,
  minimumDate,
  maximumDate,
  isDateDisabled,
  documentReference,
}) {
  const showPicker = pickerSide === side && panelView !== VIEWS.days;

  if (showPicker && panelView === VIEWS.months) {
    return createMonthPicker({
      viewDate,
      side,
      locale,
      documentReference,
    });
  }

  if (showPicker && panelView === VIEWS.years) {
    return createYearPicker({
      viewDate,
      side,
      minimumDate,
      maximumDate,
      documentReference,
    });
  }

  return createDaysView({
    viewDate,
    mode,
    locale,
    firstDayOfWeek,
    selectedStart,
    selectedEnd,
    previewDate,
    activeBoundary,
    activeDate,
    isDateDisabled,
    documentReference,
  });
}

/* ==========================================================================
   Calendar Panel
   ========================================================================== */

function createCalendarPanel({
  side,
  viewDate,
  panelView,
  pickerSide,
  mode,
  locale,
  firstDayOfWeek,
  selectedStart,
  selectedEnd,
  previewDate,
  activeBoundary,
  activeDate,
  minimumDate,
  maximumDate,
  isDateDisabled,
  messages,
  documentReference,
}) {
  const sideClass =
    side === SIDES.secondary
      ? CLASS_NAMES.calendarSecondary
      : CLASS_NAMES.calendarPrimary;

  const panelElement = createElement(
    "section",
    {
      className: `${CLASS_NAMES.calendarPanel} ` + sideClass,
      attributes: {
        [DATA_ATTRIBUTES.side]: side,
        [ARIA.label]: formatAccessibleMonth(viewDate, locale),
      },
    },
    documentReference,
  );

  const headerElement = createCalendarHeader({
    viewDate,
    side,
    locale,
    messages,
    documentReference,
  });

  const view = createPanelView({
    panelView,
    pickerSide,
    side,
    viewDate,
    mode,
    locale,
    firstDayOfWeek,
    selectedStart,
    selectedEnd,
    previewDate,
    activeBoundary,
    activeDate,
    minimumDate,
    maximumDate,
    isDateDisabled,
    documentReference,
  });

  panelElement.append(headerElement, view.viewElement);

  return {
    side,
    viewDate,
    panelElement,
    headerElement,
    ...view,
  };
}

/* ==========================================================================
   Render Calendars
   ========================================================================== */

export function renderCustomDateCalendars({
  container,
  mode,
  primaryViewDate,
  panelView = VIEWS.days,
  pickerSide = SIDES.primary,
  locale,
  firstDayOfWeek,
  selectedStart = null,
  selectedEnd = null,
  previewDate = null,
  activeBoundary = BOUNDARIES.start,
  activeDate = null,
  minimumDate = null,
  maximumDate = null,
  isDateDisabled = null,
  messages,
}) {
  const documentReference = container.ownerDocument;

  container.replaceChildren();

  const primaryPanel = createCalendarPanel({
    side: SIDES.primary,
    viewDate: primaryViewDate,
    panelView,
    pickerSide,
    mode,
    locale,
    firstDayOfWeek,
    selectedStart,
    selectedEnd,
    previewDate,
    activeBoundary,
    activeDate,
    minimumDate,
    maximumDate,
    isDateDisabled,
    messages,
    documentReference,
  });

  const panels = [primaryPanel];

  container.append(primaryPanel.panelElement);

  if (mode === MODES.range) {
    const secondaryViewDate = startOfMonth(addMonths(primaryViewDate, 1));

    const secondaryPanel = createCalendarPanel({
      side: SIDES.secondary,
      viewDate: secondaryViewDate,
      panelView,
      pickerSide,
      mode,
      locale,
      firstDayOfWeek,
      selectedStart,
      selectedEnd,
      previewDate,
      activeBoundary,
      activeDate,
      minimumDate,
      maximumDate,
      isDateDisabled,
      messages,
      documentReference,
    });

    panels.push(secondaryPanel);

    container.append(secondaryPanel.panelElement);
  }

  return {
    panels,

    dayRecords: panels.flatMap((panel) => panel.dayRecords || []),

    pickerRecords: panels.flatMap((panel) => panel.pickerRecords || []),
  };
}

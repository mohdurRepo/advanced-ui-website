/* ==========================================================================
   Market Calendar
   ========================================================================== */

const SELECTORS = {
  root: "[data-market-calendar]",
  grid: "[data-calendar-grid]",
  events: "[data-calendar-events]",
  title: "[data-calendar-title]",
  month: "[data-calendar-month]",
  year: "[data-calendar-year]",
  weekdays: "[data-calendar-weekdays]",
  previous: "[data-calendar-prev]",
  next: "[data-calendar-next]",
  day: "[data-date-key]",
};

const CLASSES = {
  weekday: "market-calendar__weekday",

  day: "market-calendar__day",
  dayEmpty: "market-calendar__day--empty",
  dayToday: "market-calendar__day--today",
  daySelected: "market-calendar__day--selected",

  eventDot: "market-calendar__event-dot",
  event: "market-calendar__event",
  eventContent: "market-calendar__event-content",
  eventTitle: "market-calendar__event-title",
  eventMeta: "market-calendar__event-meta",
  eventIcon: "market-calendar__event-icon",
};

const MINIMUM_YEAR = 1990;
const FUTURE_YEAR_RANGE = 5;

/* ==========================================================================
   Translations
   ========================================================================== */

const CALENDAR_I18N = {
  en: {
    noEvents: "No events for this date",
    eventSummary: (count, date) =>
      `${count} event${count === 1 ? "" : "s"} for ${date}`,

    dayWithEvents: (date, count) =>
      `${date}, ${count} event${count === 1 ? "" : "s"}`,

    previousMonth: "Previous month",
    nextMonth: "Next month",
    selectMonth: "Select month",
    selectYear: "Select year",

    months: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],

    weekdays: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  },

  ar: {
    noEvents: "لا توجد فعاليات لهذا التاريخ",

    eventSummary: (count, date) =>
      count === 1
        ? `فعالية واحدة بتاريخ ${date}`
        : `${count} فعاليات بتاريخ ${date}`,

    dayWithEvents: (date, count) =>
      count === 1 ? `${date}، فعالية واحدة` : `${date}، ${count} فعاليات`,

    previousMonth: "الشهر السابق",
    nextMonth: "الشهر التالي",
    selectMonth: "اختر الشهر",
    selectYear: "اختر السنة",

    months: [
      "يناير",
      "فبراير",
      "مارس",
      "أبريل",
      "مايو",
      "يونيو",
      "يوليو",
      "أغسطس",
      "سبتمبر",
      "أكتوبر",
      "نوفمبر",
      "ديسمبر",
    ],

    weekdays: ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
  },
};

/* ==========================================================================
   Fallback Data
   ========================================================================== */

const FALLBACK_CALENDAR_DATA = {
  "20260608T000000": [
    {
      companyCode: "SIDC 2130",
      calendarType: "Extraordinary",
      eventDate: "June 8, 2026",
    },
    {
      companyCode: "SPIMACO 2070",
      calendarType: "Assembly",
      eventDate: "June 8, 2026",
    },
  ],

  "20260612T000000": [
    {
      companyCode: "TASI",
      calendarType: "Market Event",
      eventDate: "June 12, 2026",
    },
  ],
};

/* ==========================================================================
   Global State
   ========================================================================== */

const initializedRoots = new WeakSet();
const calendarInstances = new Set();

let globalEventsInitialized = false;

/* ==========================================================================
   Language
   ========================================================================== */

function getLanguage() {
  return document.documentElement.lang?.startsWith("ar") ? "ar" : "en";
}

function getLocale() {
  return getLanguage() === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
}

function getTranslations() {
  return CALENDAR_I18N[getLanguage()];
}

/* ==========================================================================
   Date Helpers
   ========================================================================== */

function formatDateToKey(date) {
  return (
    [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("") + "T000000"
  );
}

function parseKeyToDate(key) {
  if (!key || key.length < 8) return null;

  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(4, 6)) - 1;
  const day = Number(key.slice(6, 8));

  const date = new Date(year, month, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDisplayDate(date) {
  return new Intl.DateTimeFormat(getLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function isSameMonth(date, year, month) {
  return date.getFullYear() === year && date.getMonth() === month;
}

function isKeyInMonth(key, year, month) {
  const date = parseKeyToDate(key);

  return Boolean(date && isSameMonth(date, year, month));
}

function getTodayKey() {
  return formatDateToKey(new Date());
}

/* ==========================================================================
   Data
   ========================================================================== */

function getSourceData() {
  const suppliedData = window.calendarSampleData;

  if (
    suppliedData &&
    typeof suppliedData === "object" &&
    !Array.isArray(suppliedData)
  ) {
    return suppliedData;
  }

  return FALLBACK_CALENDAR_DATA;
}

function getDataYears(sourceData) {
  return Object.keys(sourceData)
    .map((key) => Number(key.slice(0, 4)))
    .filter(Number.isFinite);
}

/* ==========================================================================
   Elements
   ========================================================================== */

function getCalendarElements(root) {
  const elements = {
    root,
    grid: root.querySelector(SELECTORS.grid),
    events: root.querySelector(SELECTORS.events),
    title: root.querySelector(SELECTORS.title),
    month: root.querySelector(SELECTORS.month),
    year: root.querySelector(SELECTORS.year),
    weekdays: root.querySelector(SELECTORS.weekdays),
    previous: root.querySelector(SELECTORS.previous),
    next: root.querySelector(SELECTORS.next),
  };

  const requiredElements = Object.values(elements).filter(
    (element) => element !== root,
  );

  if (requiredElements.some((element) => !element)) {
    return null;
  }

  return elements;
}

/* ==========================================================================
   DOM Helpers
   ========================================================================== */

function createOption(value, text, selected = false) {
  const option = document.createElement("option");

  option.value = String(value);
  option.textContent = text;
  option.selected = selected;

  return option;
}

function createEventElement(event) {
  const article = document.createElement("article");
  const content = document.createElement("div");
  const title = document.createElement("h5");
  const meta = document.createElement("p");
  const icon = document.createElement("span");

  article.className = CLASSES.event;
  content.className = CLASSES.eventContent;
  title.className = CLASSES.eventTitle;
  meta.className = CLASSES.eventMeta;

  icon.className = [CLASSES.eventIcon, "has-icon", "icon-calendar"].join(" ");

  title.textContent = event.companyCode || "";
  title.dir = "auto";

  meta.textContent = [event.calendarType, event.eventDate]
    .filter(Boolean)
    .join(" · ");

  meta.dir = "auto";

  icon.setAttribute("aria-hidden", "true");

  content.append(title, meta);
  article.append(content, icon);

  return article;
}

/* ==========================================================================
   Calendar Instance
   ========================================================================== */

function createMarketCalendar(root) {
  const elements = getCalendarElements(root);

  if (!elements) return null;

  const sourceData = getSourceData();
  const now = new Date();

  const dataYears = getDataYears(sourceData);

  const configuredMinimumYear = Number(root.dataset.calendarStartYear);

  const minimumYear = Number.isFinite(configuredMinimumYear)
    ? configuredMinimumYear
    : MINIMUM_YEAR;

  const maximumYear = Math.max(
    now.getFullYear() + FUTURE_YEAR_RANGE,
    ...dataYears,
  );

  const state = {
    currentMonth: now.getMonth(),
    currentYear: now.getFullYear(),

    minimumYear,
    maximumYear,

    selectedDateKey: getTodayKey(),
    eventListByDate: {},
  };

  /* ========================================================================
     Event Data
     ======================================================================== */

  function hasEvents(dateKey) {
    return Boolean(state.eventListByDate[dateKey]?.length);
  }

  function getEventCount(dateKey) {
    return state.eventListByDate[dateKey]?.length || 0;
  }

  function loadEventData() {
    state.eventListByDate = {};

    Object.entries(sourceData).forEach(([key, events]) => {
      if (!Array.isArray(events)) return;

      if (isKeyInMonth(key, state.currentYear, state.currentMonth)) {
        state.eventListByDate[key] = events;
      }
    });
  }

  function getDefaultSelectedDateKey() {
    const today = new Date();

    if (isSameMonth(today, state.currentYear, state.currentMonth)) {
      return formatDateToKey(today);
    }

    const firstEventKey = Object.keys(state.eventListByDate).sort()[0];

    if (firstEventKey) {
      return firstEventKey;
    }

    return formatDateToKey(new Date(state.currentYear, state.currentMonth, 1));
  }

  /* ========================================================================
     Weekdays
     ======================================================================== */

  function populateWeekdays() {
    const translations = getTranslations();
    const fragment = document.createDocumentFragment();

    translations.weekdays.forEach((weekday) => {
      const element = document.createElement("span");

      element.className = CLASSES.weekday;
      element.textContent = weekday;
      element.setAttribute("aria-hidden", "true");

      fragment.appendChild(element);
    });

    elements.weekdays.replaceChildren(fragment);
  }

  /* ========================================================================
     Dropdowns
     ======================================================================== */

  function populateMonthDropdown() {
    const translations = getTranslations();
    const fragment = document.createDocumentFragment();

    translations.months.forEach((month, index) => {
      fragment.appendChild(
        createOption(index, month, index === state.currentMonth),
      );
    });

    elements.month.replaceChildren(fragment);
    elements.month.value = String(state.currentMonth);
    elements.month.setAttribute("aria-label", translations.selectMonth);
  }

  function populateYearDropdown() {
    const translations = getTranslations();
    const fragment = document.createDocumentFragment();

    for (let year = state.minimumYear; year <= state.maximumYear; year += 1) {
      fragment.appendChild(
        createOption(year, year, year === state.currentYear),
      );
    }

    elements.year.replaceChildren(fragment);
    elements.year.value = String(state.currentYear);
    elements.year.setAttribute("aria-label", translations.selectYear);
  }

  function populateDropdowns() {
    populateMonthDropdown();
    populateYearDropdown();
  }

  /* ========================================================================
     Navigation State
     ======================================================================== */

  function updateNavigationState() {
    const translations = getTranslations();

    const atMinimumMonth =
      state.currentYear === state.minimumYear && state.currentMonth === 0;

    const atMaximumMonth =
      state.currentYear === state.maximumYear && state.currentMonth === 11;

    elements.previous.disabled = atMinimumMonth;
    elements.next.disabled = atMaximumMonth;

    elements.previous.setAttribute("aria-label", translations.previousMonth);

    elements.next.setAttribute("aria-label", translations.nextMonth);
  }

  /* ========================================================================
     Selected Date
     ======================================================================== */

  function updateSelectedDayState() {
    elements.grid.querySelectorAll(SELECTORS.day).forEach((dayElement) => {
      const selected = dayElement.dataset.dateKey === state.selectedDateKey;

      dayElement.classList.toggle(CLASSES.daySelected, selected);

      dayElement.setAttribute("aria-pressed", String(selected));

      dayElement.tabIndex = selected ? 0 : -1;
    });
  }

  /* ========================================================================
     Events
     ======================================================================== */

  function dispatchDateChange(dateKey, events) {
    root.dispatchEvent(
      new CustomEvent("market-calendar:change", {
        bubbles: true,
        detail: {
          root,
          dateKey,
          date: parseKeyToDate(dateKey),
          events,
        },
      }),
    );
  }

  function renderEvents(dateKey, { emit = true } = {}) {
    const translations = getTranslations();
    const date = parseKeyToDate(dateKey);
    const events = state.eventListByDate[dateKey] || [];

    elements.events.replaceChildren();

    if (!date) {
      elements.title.textContent = translations.noEvents;
      return;
    }

    const formattedDate = formatDisplayDate(date);

    if (!events.length) {
      elements.title.textContent = `${translations.noEvents} — ${formattedDate}`;

      if (emit) {
        dispatchDateChange(dateKey, events);
      }

      return;
    }

    elements.title.textContent = translations.eventSummary(
      events.length,
      formattedDate,
    );

    const fragment = document.createDocumentFragment();

    events.forEach((event) => {
      fragment.appendChild(createEventElement(event));
    });

    elements.events.appendChild(fragment);

    if (emit) {
      dispatchDateChange(dateKey, events);
    }
  }

  function selectDate(dateKey, { emit = true } = {}) {
    if (!dateKey) return;

    state.selectedDateKey = dateKey;

    updateSelectedDayState();
    renderEvents(dateKey, { emit });
  }

  /* ========================================================================
     Keyboard Navigation
     ======================================================================== */

  function focusSelectedDay() {
    window.requestAnimationFrame(() => {
      const selectedDay = Array.from(
        elements.grid.querySelectorAll(SELECTORS.day),
      ).find(
        (dayElement) => dayElement.dataset.dateKey === state.selectedDateKey,
      );

      selectedDay?.focus({
        preventScroll: true,
      });
    });
  }

  function moveFocusToDate(date) {
    const targetYear = date.getFullYear();

    if (targetYear < state.minimumYear || targetYear > state.maximumYear) {
      return;
    }

    state.currentYear = targetYear;
    state.currentMonth = date.getMonth();
    state.selectedDateKey = formatDateToKey(date);

    elements.month.value = String(state.currentMonth);
    elements.year.value = String(state.currentYear);

    loadEventData();
    renderCalendar();
    renderEvents(state.selectedDateKey);
    updateNavigationState();

    focusSelectedDay();
  }

  function handleDayKeydown(event, date) {
    const isRTL = getComputedStyle(root).direction === "rtl";

    let targetDate = null;

    switch (event.key) {
      case "ArrowRight":
        targetDate = new Date(date);
        targetDate.setDate(date.getDate() + (isRTL ? -1 : 1));
        break;

      case "ArrowLeft":
        targetDate = new Date(date);
        targetDate.setDate(date.getDate() + (isRTL ? 1 : -1));
        break;

      case "ArrowUp":
        targetDate = new Date(date);
        targetDate.setDate(date.getDate() - 7);
        break;

      case "ArrowDown":
        targetDate = new Date(date);
        targetDate.setDate(date.getDate() + 7);
        break;

      case "Home":
        targetDate = new Date(date);
        targetDate.setDate(date.getDate() - date.getDay());
        break;

      case "End":
        targetDate = new Date(date);
        targetDate.setDate(date.getDate() + (6 - date.getDay()));
        break;

      default:
        return;
    }

    event.preventDefault();

    moveFocusToDate(targetDate);
  }

  /* ========================================================================
     Calendar Grid
     ======================================================================== */

  function renderCalendar() {
    const translations = getTranslations();
    const fragment = document.createDocumentFragment();

    const firstDay = new Date(state.currentYear, state.currentMonth, 1);

    const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0);

    const startOffset = firstDay.getDay();
    const todayKey = getTodayKey();

    for (let index = 0; index < startOffset; index += 1) {
      const spacer = document.createElement("span");

      spacer.className = [CLASSES.day, CLASSES.dayEmpty].join(" ");

      spacer.setAttribute("aria-hidden", "true");

      fragment.appendChild(spacer);
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(state.currentYear, state.currentMonth, day);

      const dateKey = formatDateToKey(date);
      const formattedDate = formatDisplayDate(date);
      const eventCount = getEventCount(dateKey);

      const button = document.createElement("button");

      button.type = "button";
      button.className = CLASSES.day;
      button.textContent = String(day);
      button.dataset.dateKey = dateKey;

      button.setAttribute(
        "aria-label",
        eventCount
          ? translations.dayWithEvents(formattedDate, eventCount)
          : formattedDate,
      );

      button.setAttribute(
        "aria-pressed",
        String(dateKey === state.selectedDateKey),
      );

      button.tabIndex = dateKey === state.selectedDateKey ? 0 : -1;

      if (dateKey === todayKey) {
        button.classList.add(CLASSES.dayToday);
        button.setAttribute("aria-current", "date");
      }

      if (dateKey === state.selectedDateKey) {
        button.classList.add(CLASSES.daySelected);
      }

      if (eventCount > 0) {
        const dot = document.createElement("span");

        dot.className = CLASSES.eventDot;
        dot.setAttribute("aria-hidden", "true");

        button.appendChild(dot);
      }

      button.addEventListener("click", () => {
        selectDate(dateKey);
      });

      button.addEventListener("keydown", (event) => {
        handleDayKeydown(event, date);
      });

      fragment.appendChild(button);
    }

    elements.grid.replaceChildren(fragment);
  }

  /* ========================================================================
     Month Loading
     ======================================================================== */

  function loadMonth({ preserveSelection = false, focus = false } = {}) {
    loadEventData();

    const selectedDate = parseKeyToDate(state.selectedDateKey);

    const selectionIsVisible =
      selectedDate &&
      isSameMonth(selectedDate, state.currentYear, state.currentMonth);

    if (!preserveSelection || !selectionIsVisible) {
      state.selectedDateKey = getDefaultSelectedDateKey();
    }

    renderCalendar();
    renderEvents(state.selectedDateKey, {
      emit: false,
    });

    updateNavigationState();

    if (focus) {
      focusSelectedDay();
    }
  }

  function changeMonth(offset) {
    const targetDate = new Date(
      state.currentYear,
      state.currentMonth + offset,
      1,
    );

    const targetYear = targetDate.getFullYear();

    if (targetYear < state.minimumYear || targetYear > state.maximumYear) {
      return;
    }

    state.currentYear = targetYear;
    state.currentMonth = targetDate.getMonth();

    elements.month.value = String(state.currentMonth);
    elements.year.value = String(state.currentYear);

    loadMonth();
  }

  /* ========================================================================
     Language Refresh
     ======================================================================== */

  function refreshLanguage() {
    populateWeekdays();
    populateDropdowns();
    renderCalendar();

    renderEvents(state.selectedDateKey, {
      emit: false,
    });

    updateNavigationState();
  }

  /* ========================================================================
     Events
     ======================================================================== */

  elements.previous.addEventListener("click", () => {
    changeMonth(-1);
  });

  elements.next.addEventListener("click", () => {
    changeMonth(1);
  });

  elements.month.addEventListener("change", () => {
    state.currentMonth = Number(elements.month.value);

    loadMonth();
  });

  elements.year.addEventListener("change", () => {
    state.currentYear = Number(elements.year.value);

    loadMonth();
  });

  /* ========================================================================
     Initialization
     ======================================================================== */

  populateWeekdays();
  populateDropdowns();
  loadMonth({
    preserveSelection: true,
  });

  return {
    root,
    refreshLanguage,
  };
}

/* ==========================================================================
   Global Events
   ========================================================================== */

function refreshAllCalendars() {
  calendarInstances.forEach((instance) => {
    instance.refreshLanguage();
  });
}

function initializeGlobalEvents() {
  if (globalEventsInitialized) return;

  globalEventsInitialized = true;

  document.addEventListener("languagechange", refreshAllCalendars);

  document.addEventListener("preferencechange", (event) => {
    if (event.detail?.name === "lang") {
      refreshAllCalendars();
    }
  });
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initMarketCalendar() {
  document.querySelectorAll(SELECTORS.root).forEach((root) => {
    if (initializedRoots.has(root)) return;

    const instance = createMarketCalendar(root);

    if (!instance) return;

    initializedRoots.add(root);
    calendarInstances.add(instance);
  });

  initializeGlobalEvents();
}

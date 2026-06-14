const calendarI18n = {
  en: {
    noEvents: "No events",
    eventText: (count, total, date) =>
      `${count} of ${total} event${total > 1 ? "s" : ""} for ${date}`,
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
    noEvents: "لا توجد فعاليات",
    eventText: (count, total, date) =>
      `${count} من ${total} فعالية بتاريخ ${date}`,
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

const fallbackCalendarData = {
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

function getLanguage() {
  return document.documentElement.lang?.startsWith("ar") ? "ar" : "en";
}

function formatDateToKey(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}${String(date.getDate()).padStart(2, "0")}T000000`;
}

function parseKeyToDate(key) {
  return new Date(
    Number(key.slice(0, 4)),
    Number(key.slice(4, 6)) - 1,
    Number(key.slice(6, 8)),
  );
}

function createCalendarCard(root) {
  const lang = getLanguage();
  const t = calendarI18n[lang];

  const elements = {
    grid: root.querySelector("[data-calendar-grid]"),
    events: root.querySelector("[data-calendar-events]"),
    title: root.querySelector("[data-calendar-title]"),
    month: root.querySelector("[data-calendar-month]"),
    year: root.querySelector("[data-calendar-year]"),
    weekdays: root.querySelector("[data-calendar-weekdays]"),
    prev: root.querySelector("[data-calendar-prev]"),
    next: root.querySelector("[data-calendar-next]"),
  };

  if (Object.values(elements).some((element) => !element)) return;

  const now = new Date();
  const sourceData = window.calendarSampleData || fallbackCalendarData;

  const state = {
    currentMonth: now.getMonth(),
    currentYear: now.getFullYear(),
    selectedDateKey: null,
    eventListByDate: {},
  };

  function hasEvent(key) {
    return Boolean(state.eventListByDate[key]?.length);
  }

  function populateWeekdays() {
    elements.weekdays.innerHTML = t.weekdays
      .map(
        (day) =>
          `<span class="calendar-card__weekday" aria-hidden="true">${day}</span>`,
      )
      .join("");
  }

  function populateDropdowns() {
    elements.month.innerHTML = t.months
      .map(
        (month, index) =>
          `<option value="${index}" ${
            index === state.currentMonth ? "selected" : ""
          }>${month}</option>`,
      )
      .join("");

    const startYear = 1990;
    const endYear = now.getFullYear();

    elements.year.innerHTML = Array.from(
      { length: endYear - startYear + 1 },
      (_, index) => {
        const year = startYear + index;

        return `<option value="${year}" ${
          year === state.currentYear ? "selected" : ""
        }>${year}</option>`;
      },
    ).join("");
  }

  function highlightSelectedDate(key) {
    elements.grid.querySelectorAll(".calendar-card__day").forEach((day) => {
      day.classList.remove("calendar-card__day--selected");
      day.removeAttribute("aria-current");
    });

    if (!key) return;

    const selectedDay = elements.grid.querySelector(`[data-date-key="${key}"]`);

    if (selectedDay) {
      selectedDay.classList.add("calendar-card__day--selected");
      selectedDay.setAttribute("aria-current", "date");
    }
  }

  function renderEvents(dateKey) {
    state.selectedDateKey = dateKey;
    highlightSelectedDate(dateKey);

    elements.events.innerHTML = "";

    if (!dateKey || !hasEvent(dateKey)) {
      elements.title.textContent = t.noEvents;
      return;
    }

    const events = state.eventListByDate[dateKey];

    const formattedDate = parseKeyToDate(dateKey).toLocaleDateString(
      lang === "ar" ? "ar-EG" : "en-US",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      },
    );

    elements.title.textContent = t.eventText(
      events.length,
      events.length,
      formattedDate,
    );

    elements.events.innerHTML = events
      .map(
        (event) => `
          <article class="calendar-card__event">
            <div class="calendar-card__event-content">
              <h4 class="calendar-card__event-title">${event.companyCode}</h4>
              <p class="calendar-card__event-meta">
                ${event.calendarType} | ${event.eventDate}
              </p>
            </div>

            <span class="calendar-card__event-icon has-icon icon-calendar" aria-hidden="true"></span>
          </article>
        `,
      )
      .join("");
  }

  function renderCalendar() {
    elements.grid.innerHTML = "";

    const firstDay = new Date(state.currentYear, state.currentMonth, 1);
    const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0);
    const startOffset = firstDay.getDay();

    for (let i = 0; i < startOffset; i += 1) {
      const spacer = document.createElement("span");
      spacer.className = "calendar-card__day calendar-card__day--empty";
      elements.grid.appendChild(spacer);
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(state.currentYear, state.currentMonth, day);
      const key = formatDateToKey(date);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-card__day";
      button.textContent = String(day);
      button.dataset.dateKey = key;

      if (hasEvent(key)) {
        const dot = document.createElement("span");
        dot.className = "calendar-card__event-dot";
        button.appendChild(dot);
      }

      button.addEventListener("click", () => renderEvents(key));

      elements.grid.appendChild(button);
    }

    highlightSelectedDate(state.selectedDateKey);
  }

  function loadEvents(year, month) {
    state.eventListByDate = {};

    Object.entries(sourceData).forEach(([key, events]) => {
      const eventYear = Number(key.slice(0, 4));
      const eventMonth = Number(key.slice(4, 6));

      if (eventYear === year && eventMonth === month) {
        state.eventListByDate[key] = events;
      }
    });

    const todayKey = formatDateToKey(new Date());

    state.selectedDateKey = hasEvent(todayKey)
      ? todayKey
      : Object.keys(state.eventListByDate)[0] || null;

    renderCalendar();
    renderEvents(state.selectedDateKey);
  }

  function changeMonth(offset) {
    state.currentMonth += offset;

    if (state.currentMonth < 0) {
      state.currentMonth = 11;
      state.currentYear -= 1;
    }

    if (state.currentMonth > 11) {
      state.currentMonth = 0;
      state.currentYear += 1;
    }

    elements.month.value = String(state.currentMonth);
    elements.year.value = String(state.currentYear);

    loadEvents(state.currentYear, state.currentMonth + 1);
  }

  elements.prev.addEventListener("click", () => changeMonth(-1));
  elements.next.addEventListener("click", () => changeMonth(1));

  elements.month.addEventListener("change", () => {
    state.currentMonth = Number(elements.month.value);
    loadEvents(state.currentYear, state.currentMonth + 1);
  });

  elements.year.addEventListener("change", () => {
    state.currentYear = Number(elements.year.value);
    loadEvents(state.currentYear, state.currentMonth + 1);
  });

  populateWeekdays();
  populateDropdowns();
  loadEvents(state.currentYear, state.currentMonth + 1);
}

export function initCalendarCards() {
  document.querySelectorAll("[data-calendar-card]").forEach(createCalendarCard);
}

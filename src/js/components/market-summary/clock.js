const KSA_TIMEZONE_OFFSET = 3;

const LOCATION = {
  en: "Riyadh, Saudi Arabia",
  ar: "الرياض، المملكة العربية السعودية",
};

const AR = {
  am: "ص",
  pm: "م",
  comma: "،",
};

const clock = {
  location: null,
  time: null,
  day: null,
  date: null,
  ticks: null,
  hands: {
    hour: null,
    minute: null,
    second: null,
  },
};

let textInterval = null;
let textTimeout = null;
let handAnimations = {};

function getUiLang() {
  const htmlLang = document.documentElement.lang || navigator.language || "en";
  return htmlLang.toLowerCase().startsWith("ar") ? "ar" : "en";
}

function getKsaDate() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;

  return new Date(utc + KSA_TIMEZONE_OFFSET * 60 * 60 * 1000);
}

function formatKsaTime(date, lang) {
  const value = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  if (lang !== "ar") return value;

  return value.replace("AM", AR.am).replace("PM", AR.pm);
}

function formatKsaDay(date, lang) {
  const day = new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en-GB", {
    weekday: "long",
  }).format(date);

  return lang === "ar" ? `${day}${AR.comma}` : `${day},`;
}

function formatKsaDate(date, lang) {
  if (lang !== "ar") {
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  const month = new Intl.DateTimeFormat("ar", {
    month: "long",
  }).format(date);

  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear());

  return `${day} ${month} ${year}`;
}

function cacheClockElements() {
  clock.location = document.getElementById("ksaLocation");
  clock.time = document.getElementById("ksaTime");
  clock.day = document.getElementById("ksaDay");
  clock.date = document.getElementById("ksaDate");
  clock.ticks = document.querySelector(".tick-marks");

  clock.hands.hour = document.querySelector(".hour-hand");
  clock.hands.minute = document.querySelector(".minute-hand");
  clock.hands.second = document.querySelector(".second-hand");
}

function updateLocation() {
  if (!clock.location) return;

  const lang = getUiLang();

  clock.location.innerHTML = `
    <span class="has-icon icon-location location-icon" aria-hidden="true"></span>
    <span class="location-text">${LOCATION[lang]}</span>
  `;

  clock.location.lang = lang;
}

function updateClockText() {
  const date = getKsaDate();
  const lang = getUiLang();

  if (clock.time) {
    clock.time.textContent = formatKsaTime(date, lang);
    clock.time.dateTime = date.toISOString();
  }

  if (clock.day) {
    clock.day.textContent = formatKsaDay(date, lang);
  }

  if (clock.date) {
    clock.date.textContent = formatKsaDate(date, lang);
    clock.date.dateTime = date.toISOString();
  }
}

function startClockText() {
  clearTimeout(textTimeout);
  clearInterval(textInterval);

  updateClockText();

  const delay = 1000 - getKsaDate().getMilliseconds();

  textTimeout = setTimeout(() => {
    updateClockText();
    textInterval = setInterval(updateClockText, 1000);
  }, delay);
}

function generateTicks() {
  if (!clock.ticks) return;

  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 60; index += 1) {
    const tick = document.createElement("span");

    tick.className = index % 5 === 0 ? "tick tick--major" : "tick";
    tick.style.setProperty("--rotation", `${index * 6}deg`);

    fragment.appendChild(tick);
  }

  clock.ticks.replaceChildren(fragment);
}

function animateHand(element, angle, duration) {
  if (!element) return null;

  return element.animate(
    [
      { transform: `translate(-50%, -100%) rotate(${angle}deg)` },
      { transform: `translate(-50%, -100%) rotate(${angle + 360}deg)` },
    ],
    {
      duration,
      iterations: Infinity,
      easing: "linear",
    },
  );
}

function startHandAnimations() {
  const date = getKsaDate();

  const milliseconds = date.getMilliseconds();
  const seconds = date.getSeconds() + milliseconds / 1000;
  const minutes = date.getMinutes() + seconds / 60;
  const hours = (date.getHours() % 12) + minutes / 60;

  Object.values(handAnimations).forEach((animation) => animation?.cancel());

  handAnimations = {
    second: animateHand(clock.hands.second, seconds * 6, 60000),
    minute: animateHand(clock.hands.minute, minutes * 6, 3600000),
    hour: animateHand(clock.hands.hour, hours * 30, 43200000),
  };
}

function pauseHands() {
  Object.values(handAnimations).forEach((animation) => animation?.pause());
}

export function initMarketClock() {
  cacheClockElements();

  if (!clock.location && !clock.time && !clock.ticks) return;

  updateLocation();
  updateClockText();
  startClockText();
  generateTicks();
  startHandAnimations();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseHands();
      return;
    }

    updateLocation();
    startClockText();
    startHandAnimations();
  });

  new MutationObserver(() => {
    updateLocation();
    startClockText();
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
}

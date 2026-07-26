/* ==========================================================================
   Indices Heatmap
   ========================================================================== */

const SELECTORS = {
  root: "[data-indices-heatmap]",
  grid: "[data-heatmap-grid]",
  item: "[data-heatmap-item]",

  legend: ".heatmap-legend",
  marker: "[data-heatmap-marker]",

  selection: "[data-heatmap-selection]",
  selectionName: "[data-heatmap-selection-name]",
  selectionValue: "[data-heatmap-selection-value]",
  selectionChange: "[data-heatmap-selection-change]",

  itemName: ".heatmap-item__name",
  itemValue: ".heatmap-item__value",
  itemChange: ".heatmap-item__change",
  itemChangeValue: ".heatmap-item__change data",
  itemChangeIcon: ".heatmap-item__change-icon",
};

const CLASSES = {
  selected: "is-selected",

  neutral: "neutral",

  minus2: "minus2",
  minus4: "minus4",
  minus6: "minus6",
  minus8: "minus8",
  minus10: "minus10",

  plus2: "plus2",
  plus4: "plus4",
  plus6: "plus6",
  plus8: "plus8",
  plus10: "plus10",

  priceUp: "price-up",
  priceDown: "price-down",
  priceNeutral: "price-neutral",

  triangleUp: "icon-triangle-up",
  triangleDown: "icon-triangle-down",
};

const EVENTS = {
  change: "heatmap:change",
  refresh: "heatmap:refresh",
};

const STATE_CLASSES = [
  CLASSES.neutral,

  CLASSES.minus2,
  CLASSES.minus4,
  CLASSES.minus6,
  CLASSES.minus8,
  CLASSES.minus10,

  CLASSES.plus2,
  CLASSES.plus4,
  CLASSES.plus6,
  CLASSES.plus8,
  CLASSES.plus10,
];

const PRICE_CLASSES = [
  CLASSES.priceUp,
  CLASSES.priceDown,
  CLASSES.priceNeutral,
];

const ICON_CLASSES = [CLASSES.triangleUp, CLASSES.triangleDown];

const SCALE_MIN = -10;
const SCALE_MAX = 10;

/*
 * Values smaller than half of the displayed 0.01 precision are treated
 * as neutral.
 */

const NEUTRAL_THRESHOLD = 0.005;

const initializedRoots = new WeakSet();

let globalEventsInitialized = false;

/* ==========================================================================
   Preferences
   ========================================================================== */

function getLanguage() {
  return document.documentElement.lang === "ar" ? "ar" : "en";
}

function getLocale() {
  return getLanguage() === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
}

function isRTL(element) {
  return getComputedStyle(element).direction === "rtl";
}

function prefersReducedMotion() {
  return (
    document.documentElement.dataset.motion === "reduce" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ==========================================================================
   Number Helpers
   ========================================================================== */

function parseNumber(value, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  const normalizedValue = String(value ?? "")
    .replaceAll(",", "")
    .replace("−", "-")
    .trim();

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatIndexValue(value) {
  return new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatChange(value) {
  const formattedMagnitude = new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  if (value > NEUTRAL_THRESHOLD) {
    return `+${formattedMagnitude}%`;
  }

  if (value < -NEUTRAL_THRESHOLD) {
    return `−${formattedMagnitude}%`;
  }

  return `${formattedMagnitude}%`;
}

/* ==========================================================================
   Item Data
   ========================================================================== */

function getItemName(item) {
  return (
    item.dataset.indexName?.trim() ||
    item.querySelector(SELECTORS.itemName)?.textContent.trim() ||
    ""
  );
}

function getItemValue(item) {
  const dataValue = item.dataset.indexValue;

  if (dataValue !== undefined) {
    return parseNumber(dataValue);
  }

  const valueElement = item.querySelector(SELECTORS.itemValue);

  return parseNumber(
    valueElement?.getAttribute("value") || valueElement?.textContent,
  );
}

function getItemChange(item) {
  return parseNumber(item.dataset.change);
}

/* ==========================================================================
   State Calculation
   ========================================================================== */

function getHeatmapState(change) {
  if (Math.abs(change) < NEUTRAL_THRESHOLD) {
    return CLASSES.neutral;
  }

  if (change > 0) {
    if (change <= 2) return CLASSES.plus2;
    if (change <= 4) return CLASSES.plus4;
    if (change <= 6) return CLASSES.plus6;
    if (change <= 8) return CLASSES.plus8;

    return CLASSES.plus10;
  }

  const magnitude = Math.abs(change);

  if (magnitude <= 2) return CLASSES.minus2;
  if (magnitude <= 4) return CLASSES.minus4;
  if (magnitude <= 6) return CLASSES.minus6;
  if (magnitude <= 8) return CLASSES.minus8;

  return CLASSES.minus10;
}

function getPriceClass(change) {
  if (change > NEUTRAL_THRESHOLD) {
    return CLASSES.priceUp;
  }

  if (change < -NEUTRAL_THRESHOLD) {
    return CLASSES.priceDown;
  }

  return CLASSES.priceNeutral;
}

function getMarkerPosition(change) {
  const clampedChange = clamp(change, SCALE_MIN, SCALE_MAX);

  return ((clampedChange - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
}

/* ==========================================================================
   Price Presentation
   ========================================================================== */

function updatePriceState(element, change) {
  if (!element) return;

  element.classList.remove(...PRICE_CLASSES);
  element.classList.add(getPriceClass(change));
}

/* ==========================================================================
   Change Icon
   ========================================================================== */

function updateChangeIcon(icon, change) {
  if (!icon) return;

  icon.classList.remove(...ICON_CLASSES);

  if (change > NEUTRAL_THRESHOLD) {
    icon.hidden = false;
    icon.classList.add(CLASSES.triangleUp);
    return;
  }

  if (change < -NEUTRAL_THRESHOLD) {
    icon.hidden = false;
    icon.classList.add(CLASSES.triangleDown);
    return;
  }

  icon.hidden = true;
}

/* ==========================================================================
   Item Presentation
   ========================================================================== */

function updateItemPresentation(item) {
  const value = getItemValue(item);
  const change = getItemChange(item);
  const state = getHeatmapState(change);

  item.classList.remove(...STATE_CLASSES);
  item.classList.add(state);

  item.dataset.heatmapState = state;

  const valueElement = item.querySelector(SELECTORS.itemValue);
  const changeElement = item.querySelector(SELECTORS.itemChange);
  const changeValueElement = item.querySelector(SELECTORS.itemChangeValue);
  const changeIcon = item.querySelector(SELECTORS.itemChangeIcon);

  if (valueElement) {
    valueElement.textContent = formatIndexValue(value);
    valueElement.setAttribute("value", String(value));
  }

  if (changeValueElement) {
    changeValueElement.textContent = formatChange(change);
    changeValueElement.setAttribute("value", String(change));
  }

  updatePriceState(changeElement, change);
  updateChangeIcon(changeIcon, change);

  return {
    value,
    change,
    state,
  };
}

/* ==========================================================================
   Elements
   ========================================================================== */

function getElements(root) {
  return {
    root,
    grid: root.querySelector(SELECTORS.grid),
    legend: root.querySelector(SELECTORS.legend),
    marker: root.querySelector(SELECTORS.marker),

    selection: root.querySelector(SELECTORS.selection),
    selectionName: root.querySelector(SELECTORS.selectionName),
    selectionValue: root.querySelector(SELECTORS.selectionValue),
    selectionChange: root.querySelector(SELECTORS.selectionChange),
  };
}

function getItems(root) {
  return Array.from(root.querySelectorAll(SELECTORS.item));
}

function getEnabledItems(root) {
  return getItems(root).filter(
    (item) => !item.disabled && item.getAttribute("aria-disabled") !== "true",
  );
}

/* ==========================================================================
   Selection Output
   ========================================================================== */

function updateSelectionOutput(elements, item, data) {
  const { root, legend, selectionName, selectionValue, selectionChange } =
    elements;

  const name = getItemName(item);
  const { value, change, state } = data;

  if (selectionName) {
    selectionName.textContent = name;
  }

  if (selectionValue) {
    selectionValue.textContent = formatIndexValue(value);
    selectionValue.setAttribute("value", String(value));
  }

  if (selectionChange) {
    selectionChange.textContent = formatChange(change);
    selectionChange.setAttribute("value", String(change));

    updatePriceState(selectionChange, change);
  }

  const markerPosition = getMarkerPosition(change);

  if (legend) {
    legend.style.setProperty(
      "--heatmap-marker-position",
      `${markerPosition.toFixed(2)}%`,
    );
  }

  root.dataset.selectedIndex = name;
  root.dataset.selectedChange = String(change);
  root.dataset.selectedState = state;
}

/* ==========================================================================
   Custom Event
   ========================================================================== */

function dispatchHeatmapChange(elements, item, data) {
  const { root } = elements;

  root.dispatchEvent(
    new CustomEvent(EVENTS.change, {
      bubbles: true,
      detail: {
        root,
        item,

        name: getItemName(item),
        value: data.value,
        change: data.change,
        state: data.state,

        position: getMarkerPosition(data.change),
      },
    }),
  );
}

/* ==========================================================================
   Selection
   ========================================================================== */

function selectItem(elements, selectedItem, { emit = true } = {}) {
  if (!selectedItem) return;

  if (
    selectedItem.disabled ||
    selectedItem.getAttribute("aria-disabled") === "true"
  ) {
    return;
  }

  const items = getItems(elements.root);

  if (!items.includes(selectedItem)) return;

  items.forEach((item) => {
    const selected = item === selectedItem;

    item.classList.toggle(CLASSES.selected, selected);

    if (selected) {
      item.setAttribute("aria-current", "true");
    } else {
      item.removeAttribute("aria-current");
    }
  });

  const data = updateItemPresentation(selectedItem);

  updateSelectionOutput(elements, selectedItem, data);

  if (emit) {
    dispatchHeatmapChange(elements, selectedItem, data);
  }
}

/* ==========================================================================
   Refresh
   ========================================================================== */

function refreshRoot(root, { emit = false } = {}) {
  const elements = getElements(root);
  const items = getItems(root);

  if (!items.length) return;

  items.forEach(updateItemPresentation);

  const selectedItem =
    items.find(
      (item) =>
        item.classList.contains(CLASSES.selected) ||
        item.getAttribute("aria-current") === "true",
    ) || items[0];

  selectItem(elements, selectedItem, {
    emit,
  });
}

export function refreshIndicesHeatmaps() {
  document.querySelectorAll(SELECTORS.root).forEach((root) => {
    refreshRoot(root);
  });
}

/* ==========================================================================
   Grid Navigation
   ========================================================================== */

function getGridColumnCount(grid) {
  if (!grid) return 1;

  const templateColumns = getComputedStyle(grid).gridTemplateColumns;

  if (!templateColumns || templateColumns === "none") {
    return 1;
  }

  return templateColumns.split(" ").filter(Boolean).length;
}

function focusItem(item) {
  if (!item) return;

  item.focus({
    preventScroll: true,
  });

  item.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "nearest",
    inline: "nearest",
  });
}

function handleGridKeydown(event, elements) {
  const currentItem = event.target.closest(SELECTORS.item);

  if (!currentItem || !elements.root.contains(currentItem)) {
    return;
  }

  const items = getEnabledItems(elements.root);
  const currentIndex = items.indexOf(currentItem);

  if (currentIndex < 0) return;

  const columnCount = getGridColumnCount(elements.grid);
  const rtl = isRTL(elements.root);

  let nextIndex = null;

  switch (event.key) {
    case "ArrowRight":
      nextIndex = currentIndex + (rtl ? -1 : 1);
      break;

    case "ArrowLeft":
      nextIndex = currentIndex + (rtl ? 1 : -1);
      break;

    case "ArrowDown":
      nextIndex = currentIndex + columnCount;
      break;

    case "ArrowUp":
      nextIndex = currentIndex - columnCount;
      break;

    case "Home":
      nextIndex = 0;
      break;

    case "End":
      nextIndex = items.length - 1;
      break;

    default:
      return;
  }

  if (nextIndex < 0 || nextIndex >= items.length) {
    return;
  }

  event.preventDefault();

  focusItem(items[nextIndex]);
}

/* ==========================================================================
   Root Events
   ========================================================================== */

function initializeRootEvents(elements) {
  const { root } = elements;

  root.addEventListener("click", (event) => {
    const item = event.target.closest(SELECTORS.item);

    if (!item || !root.contains(item)) return;

    selectItem(elements, item);
  });

  root.addEventListener("keydown", (event) => {
    handleGridKeydown(event, elements);
  });

  /*
   * Live-data integrations can update data-change, data-index-value, or
   * data-index-name and then dispatch:
   *
   * root.dispatchEvent(new CustomEvent("heatmap:refresh"));
   */

  root.addEventListener(EVENTS.refresh, () => {
    refreshRoot(root);
  });
}

/* ==========================================================================
   Root Initialization
   ========================================================================== */

function initializeRoot(root) {
  if (initializedRoots.has(root)) return;

  const items = getItems(root);

  if (!items.length) return;

  initializedRoots.add(root);

  const elements = getElements(root);

  initializeRootEvents(elements);
  refreshRoot(root);
}

/* ==========================================================================
   Global Events
   ========================================================================== */

function initializeGlobalEvents() {
  if (globalEventsInitialized) return;

  globalEventsInitialized = true;

  document.addEventListener("languagechange", refreshIndicesHeatmaps);

  document.addEventListener("preferencechange", (event) => {
    if (event.detail?.name === "lang") {
      refreshIndicesHeatmaps();
    }
  });
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initIndicesHeatmap() {
  document.querySelectorAll(SELECTORS.root).forEach(initializeRoot);

  initializeGlobalEvents();
}

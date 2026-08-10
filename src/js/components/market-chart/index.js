import {
  createMarketChart,
  destroyAllMarketCharts,
  destroyMarketChart,
  getMarketChart,
} from "./market-chart";

/* ==========================================================================
   Public Contract
   ========================================================================== */

export const MARKET_CHARTS_API_NAME = "SEMarketCharts";

export const MARKET_CHARTS_API_VERSION = "2.0.0";

export const MARKET_CHARTS_READY_EVENT = "semarketchartsready";

export const MARKET_CHARTS_REMOVED_EVENT = "semarketchartsremoved";

const API_MARKER = Symbol.for("se.market-charts.api");

/* ==========================================================================
   Public API
   ========================================================================== */

export function createMarketChartPublicAPI(bindings = {}) {
  const api = {
    version: MARKET_CHARTS_API_VERSION,

    create: bindings.create || createMarketChart,

    get: bindings.get || getMarketChart,

    destroy: bindings.destroy || destroyMarketChart,

    destroyAll: bindings.destroyAll || destroyAllMarketCharts,
  };

  Object.defineProperty(api, API_MARKER, {
    value: true,
    enumerable: false,
  });

  return Object.freeze(api);
}

const marketChartAPI = createMarketChartPublicAPI();

export function getMarketChartAPI() {
  return marketChartAPI;
}

/* ==========================================================================
   Browser Events
   ========================================================================== */

function createBrowserEvent(browserWindow, name, detail) {
  if (typeof browserWindow.CustomEvent === "function") {
    return new browserWindow.CustomEvent(name, {
      detail,
    });
  }

  const event = new browserWindow.Event(name);

  Object.defineProperty(event, "detail", {
    value: detail,
    enumerable: true,
  });

  return event;
}

function dispatchBrowserEvent(browserWindow, name, detail) {
  if (typeof browserWindow?.dispatchEvent !== "function") {
    return;
  }

  browserWindow.dispatchEvent(createBrowserEvent(browserWindow, name, detail));
}

function safelyDestroyPreviousAPI(previousAPI) {
  if (!previousAPI || typeof previousAPI.destroyAll !== "function") {
    return;
  }

  try {
    previousAPI.destroyAll();
  } catch (error) {
    console.error(
      "Previous Market Chart instances could not be destroyed.",
      error,
    );
  }
}

/* ==========================================================================
   Installation
   ========================================================================== */

export function initMarketCharts(browserWindow = globalThis.window) {
  if (!browserWindow) {
    return marketChartAPI;
  }

  const currentAPI = browserWindow[MARKET_CHARTS_API_NAME];

  if (currentAPI === marketChartAPI) {
    return marketChartAPI;
  }

  const descriptor = Object.getOwnPropertyDescriptor(
    browserWindow,
    MARKET_CHARTS_API_NAME,
  );

  if (descriptor && descriptor.configurable === false) {
    console.error(
      `${MARKET_CHARTS_API_NAME} is already installed as a non-configurable browser property.`,
    );

    return currentAPI || marketChartAPI;
  }

  safelyDestroyPreviousAPI(currentAPI);

  Object.defineProperty(browserWindow, MARKET_CHARTS_API_NAME, {
    value: marketChartAPI,

    configurable: true,
    enumerable: true,
    writable: false,
  });

  dispatchBrowserEvent(browserWindow, MARKET_CHARTS_READY_EVENT, {
    api: marketChartAPI,
    version: MARKET_CHARTS_API_VERSION,
  });

  return marketChartAPI;
}

/* ==========================================================================
   Uninstallation
   ========================================================================== */

export function uninstallMarketCharts(
  browserWindow = globalThis.window,
  { destroy = true } = {},
) {
  if (
    !browserWindow ||
    browserWindow[MARKET_CHARTS_API_NAME] !== marketChartAPI
  ) {
    return false;
  }

  if (destroy) {
    safelyDestroyPreviousAPI(marketChartAPI);
  }

  delete browserWindow[MARKET_CHARTS_API_NAME];

  dispatchBrowserEvent(browserWindow, MARKET_CHARTS_REMOVED_EVENT, {
    version: MARKET_CHARTS_API_VERSION,
  });

  return true;
}

/* ==========================================================================
   Module Exports
   ========================================================================== */

export {
  createMarketChart,
  destroyAllMarketCharts,
  destroyMarketChart,
  getMarketChart,
};

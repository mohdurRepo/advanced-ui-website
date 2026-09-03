const SELECTORS = Object.freeze({
  form: "[data-market-performance-filters]",
  report: "[data-market-performance-report]",
  period: "[data-market-performance-period]",
  sector: "[data-market-performance-sector]",
});

function requireElement(root, selector, name) {
  const element = root.querySelector(selector);

  if (!element) {
    throw new Error(`[Market Performance] Missing ${name}.`);
  }

  return element;
}

function getValue(element) {
  return String(element.value ?? "").trim();
}

export function createMarketPerformanceFilters({ root, config, onChange }) {
  if (!(root instanceof Element)) {
    throw new Error("[Market Performance] Invalid filters root.");
  }

  const form = requireElement(root, SELECTORS.form, "filters form");
  const report = requireElement(form, SELECTORS.report, "report filter");
  const period = requireElement(form, SELECTORS.period, "period filter");
  const sector = requireElement(form, SELECTORS.sector, "sector filter");

  const listeners = [];
  let destroyed = false;

  function getValues() {
    return {
      reportFilter: getValue(report) || config.request.report.active,
      sectorFilter: getValue(sector) || config.request.allMarket,
      timeFrameFilter: getValue(period) || config.request.defaultPeriod,
    };
  }

  function emitChange(event) {
    if (destroyed || typeof onChange !== "function") {
      return;
    }

    onChange(getValues(), {
      source: event?.target ?? null,
      event: event ?? null,
    });
  }

  function listen(element, type, handler) {
    element.addEventListener(type, handler);
    listeners.push(() => element.removeEventListener(type, handler));
  }

  listen(report, "change", emitChange);
  listen(period, "change", emitChange);
  listen(sector, "change", emitChange);

  return {
    getValues,

    getReport() {
      return getValue(report) || config.request.report.active;
    },

    isActiveReport() {
      return this.getReport() === config.request.report.active;
    },

    isGainersLosersReport() {
      const value = this.getReport();

      return (
        value === config.request.report.gainersLosersValue ||
        value === config.request.report.gainersLosersPercent
      );
    },

    destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;
      listeners.splice(0).forEach((remove) => remove());
    },
  };
}

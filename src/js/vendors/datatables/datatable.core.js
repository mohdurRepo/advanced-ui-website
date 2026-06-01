import DataTable from "datatables.net-dt";
import "datatables.net-fixedheader-dt";
import "datatables.net-rowgroup-dt";

import { DataTableRegistry } from "./datatable.registry";
import {
  DataTableDefaults,
  DataTablePresets,
  getDataTableLanguage,
} from "./datatable.defaults";
import { showTableLoader, hideTableLoader } from "./datatable.loader";
import { DataTablePlugins } from "./datatable.plugins";

function resolveElement(target) {
  if (!target) return null;

  if (target instanceof HTMLElement) {
    return target;
  }

  return document.querySelector(target);
}

function mergeOptions(...objects) {
  return objects.reduce((result, object) => {
    return {
      ...result,
      ...(object || {}),
    };
  }, {});
}

function getPreset(name) {
  if (!name) return {};

  return DataTablePresets[name] || {};
}

function getFeatureOptions(element, explicitFeatures = {}) {
  const features = { ...explicitFeatures };

  if (element.hasAttribute("data-datatable-fixed-header")) {
    features.fixedHeader = true;
  }

  if (element.hasAttribute("data-datatable-row-group")) {
    const source = element.getAttribute("data-datatable-row-group");
    features.rowGroup = {
      dataSrc: source ? Number(source) : 0,
    };
  }

  return features;
}

export function renderDataTable(options = {}) {
  const element = resolveElement(options.target);

  if (!element) {
    console.warn("renderDataTable: invalid target", options.target);
    return null;
  }

  element.classList.add("table");

  const existing = DataTableRegistry.get(element);
  const columns = options.columns;
  const data = options.data;
  const ajax = options.ajax;
  const features = getFeatureOptions(element, options.features);
  const lifecycle = options.lifecycle || {};
  const locale = options.locale || document.documentElement.lang || "en";

  if (existing) {
    if (existing._isRefreshing) return existing;

    if (Array.isArray(data)) {
      existing.clear();
      existing.rows.add(data);
      existing.page(0).draw(false);

      lifecycle.onRefresh?.(existing);
      return existing;
    }

    if (existing.ajax?.reload) {
      existing._isRefreshing = true;

      if (features.loader) {
        showTableLoader(element);
      }

      existing.ajax.reload(() => {
        if (features.loader) {
          hideTableLoader(element);
        }

        existing._isRefreshing = false;
        lifecycle.onRefresh?.(existing);
      }, false);

      return existing;
    }

    existing.draw(false);
    lifecycle.onRefresh?.(existing);
    return existing;
  }

  const preset = getPreset(options.preset || element.dataset.datatablePreset);
  const dtOptions = options.dtOptions || {};

  const config = mergeOptions(
    DataTableDefaults,
    preset,
    {
      language: getDataTableLanguage(locale),
    },
    dtOptions,
  );

  if (columns) config.columns = columns;
  if (Array.isArray(data)) config.data = data;
  if (ajax) config.ajax = ajax;

  DataTablePlugins.applyToConfig(config, features);

  const instance = new DataTable(element, config);

  DataTableRegistry.set(element, instance);
  DataTablePlugins.applyToInstance(instance, features);

  lifecycle.onInit?.(instance);

  return instance;
}

export function refreshDataTable(target) {
  const element = resolveElement(target);
  const instance = DataTableRegistry.get(element);

  if (!element || !instance || instance._isRefreshing) return;

  instance._isRefreshing = true;

  if (instance.ajax?.reload) {
    showTableLoader(element);

    instance.ajax.reload(() => {
      hideTableLoader(element);
      instance._isRefreshing = false;
    }, false);
  } else {
    instance.draw(false);
    instance._isRefreshing = false;
  }
}

export function destroyDataTable(target) {
  const element = resolveElement(target);
  const instance = DataTableRegistry.get(element);

  if (!element || !instance) return;

  instance.destroy();
  DataTableRegistry.remove(element);
}

export function adjustDataTable(target) {
  const element = resolveElement(target);
  const instance = DataTableRegistry.get(element);

  if (!element || !instance) return;

  instance.columns.adjust().draw(false);

  if (instance.fixedHeader?.adjust) {
    instance.fixedHeader.adjust();
  }
}

export function getDataTableInstance(target) {
  const element = resolveElement(target);
  return element ? DataTableRegistry.get(element) : null;
}

export function setDataTableData(target, data = []) {
  const instance = getDataTableInstance(target);

  if (!instance) return;

  instance.clear();
  instance.rows.add(Array.isArray(data) ? data : []);
  instance.draw(false);
}

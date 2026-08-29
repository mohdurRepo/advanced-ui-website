/* ==========================================================================
   Derivative Negotiated Contracts
   ========================================================================== */

/*
 * Dependent Contract-option loader for Derivative Negotiated.
 *
 * Responsibilities:
 *
 * - request Contract options for the selected Category
 * - cancel stale requests
 * - ignore out-of-order responses
 * - normalize service response shapes
 * - safely replace native select options
 * - synchronize the enhanced Custom Select
 * - disable the Contract control while loading
 *
 * This module intentionally has no:
 *
 * - results API request
 * - filter subscriptions
 * - date handling
 * - table or card rendering
 * - page initialization
 *
 * The page entry point decides when a Contract refresh should cause the
 * results view to reload.
 */

/* ==========================================================================
   Imports
   ========================================================================== */

import { createDataSource } from "../../common/data-view/index.js";

/* ==========================================================================
   Constants
   ========================================================================== */

const ALL_VALUE = "All";

const SELECTORS = Object.freeze({
  contract: "[data-derivative-negotiated-contract]",

  customSelect: "[data-custom-select]",
});

/* ==========================================================================
   General Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeAllValue(value) {
  return normalizeString(value) || ALL_VALUE;
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function getScope(root) {
  if (root && typeof root.querySelector === "function") {
    return root;
  }

  throw new TypeError(
    "Derivative Negotiated Contracts require a valid root element.",
  );
}

/* ==========================================================================
   Response Extraction
   ========================================================================== */

function parseResponse(response) {
  if (typeof response !== "string") {
    return response;
  }

  const normalized = response.trim();

  if (!normalized) {
    return [];
  }

  try {
    return JSON.parse(normalized);
  } catch {
    return [];
  }
}

function extractContractRows(response) {
  const parsedResponse = parseResponse(response);

  if (Array.isArray(parsedResponse)) {
    return parsedResponse;
  }

  if (!isObject(parsedResponse)) {
    return [];
  }

  const candidates = [
    parsedResponse.data,

    parsedResponse.rows,

    parsedResponse.items,

    parsedResponse.contracts,

    parsedResponse.companyList,

    parsedResponse.results,
  ];

  return candidates.find(Array.isArray) || [];
}

/* ==========================================================================
   Contract Normalization
   ========================================================================== */

function normalizeContractOption(contract) {
  if (!isObject(contract)) {
    return null;
  }

  const value = normalizeString(
    contract.value ?? contract.symbol ?? contract.contractCode ?? contract.code,
  );

  const label = normalizeString(
    contract.label ??
      contract.longName ??
      contract.contractName ??
      contract.name ??
      contract.shortName,
  );

  if (!value || !label || value === ALL_VALUE) {
    return null;
  }

  return Object.freeze({
    value,

    label,

    raw: contract,
  });
}

export function normalizeDerivativeNegotiatedContracts(response) {
  const contracts = extractContractRows(response)
    .map(normalizeContractOption)
    .filter(Boolean);

  const uniqueContracts = new Map();

  contracts.forEach((contract) => {
    if (!uniqueContracts.has(contract.value)) {
      uniqueContracts.set(contract.value, contract);
    }
  });

  return Object.freeze([...uniqueContracts.values()]);
}

/* ==========================================================================
   Custom Select Synchronization
   ========================================================================== */

function refreshCustomSelect(selectElement) {
  const customSelect = selectElement.closest(SELECTORS.customSelect);

  /*
   * Use a public design-system refresh bridge when one is available.
   */

  const refresh = window.Theme?.customSelect?.refresh;

  if (typeof refresh === "function") {
    refresh(customSelect || selectElement);

    return;
  }

  /*
   * The non-bubbling Change event lets an enhanced select instance refresh
   * itself without reaching the filter form listener. This prevents a second
   * results API request.
   */

  selectElement.dispatchEvent(
    new Event("change", {
      bubbles: false,
    }),
  );
}

/* ==========================================================================
   Select Option Replacement
   ========================================================================== */

export function replaceDerivativeNegotiatedContractOptions(
  selectElement,
  contracts = [],
  options = {},
) {
  if (!(selectElement instanceof HTMLSelectElement)) {
    throw new TypeError(
      "Derivative Negotiated Contract options require a select element.",
    );
  }

  const allLabel =
    normalizeString(options.allLabel) ||
    normalizeString(selectElement.options[0]?.textContent) ||
    ALL_VALUE;

  const requestedValue = normalizeAllValue(options.selectedValue);

  const normalizedContracts = Array.isArray(contracts)
    ? contracts
        .map((contract) => {
          if (
            isObject(contract) &&
            normalizeString(contract.value) &&
            normalizeString(contract.label)
          ) {
            return contract;
          }

          return normalizeContractOption(contract);
        })
        .filter(Boolean)
    : [];

  const uniqueContracts = new Map();

  normalizedContracts.forEach((contract) => {
    if (contract.value !== ALL_VALUE && !uniqueContracts.has(contract.value)) {
      uniqueContracts.set(contract.value, contract);
    }
  });

  const fragment = document.createDocumentFragment();

  fragment.append(new Option(allLabel, ALL_VALUE));

  uniqueContracts.forEach((contract) => {
    fragment.append(new Option(contract.label, contract.value));
  });

  selectElement.replaceChildren(fragment);

  const requestedValueExists = Array.from(selectElement.options).some(
    (option) => option.value === requestedValue,
  );

  selectElement.value = requestedValueExists ? requestedValue : ALL_VALUE;

  refreshCustomSelect(selectElement);

  return Object.freeze({
    selectedValue: selectElement.value,

    optionCount: uniqueContracts.size,

    contracts: Object.freeze([...uniqueContracts.values()]),
  });
}

/* ==========================================================================
   Public Factory
   ========================================================================== */

export function createDerivativeNegotiatedContracts(options = {}) {
  if (!isObject(options)) {
    throw new TypeError(
      "createDerivativeNegotiatedContracts requires an options object.",
    );
  }

  const root = getScope(options.root);

  const config = options.config;

  if (!isObject(config)) {
    throw new TypeError(
      "Derivative Negotiated Contracts require a validated configuration object.",
    );
  }

  const endpoint = normalizeString(config.endpoints?.contractsByCategory);

  if (!endpoint) {
    throw new Error(
      'Derivative Negotiated endpoint "contractsByCategory" is required.',
    );
  }

  const contractElement = root.querySelector(SELECTORS.contract);

  if (!(contractElement instanceof HTMLSelectElement)) {
    throw new Error("Derivative Negotiated Contract filter was not found.");
  }

  const allLabel =
    normalizeString(config.labels?.filters?.allContracts) ||
    normalizeString(contractElement.options[0]?.textContent) ||
    ALL_VALUE;

  let destroyed = false;

  let loading = false;

  let requestId = 0;

  /* ========================================================================
     Data Source
     ======================================================================== */

  const source = createDataSource({
    endpoint,

    method: "GET",

    dataType: "json",

    buildRequestData(state = {}) {
      return {
        format: "json",

        category: normalizeAllValue(state.category),
      };
    },

    normalizeResponse(response) {
      const contracts = normalizeDerivativeNegotiatedContracts(response);

      return {
        rows: contracts,

        meta: {
          total: contracts.length,
        },

        raw: response,
      };
    },
  });

  /* ========================================================================
     Loading State
     ======================================================================== */

  function setLoading(nextLoading) {
    loading = Boolean(nextLoading);

    contractElement.disabled = loading;

    const customSelect = contractElement.closest(SELECTORS.customSelect);

    if (customSelect) {
      customSelect.classList.toggle("is-disabled", loading);

      if (loading) {
        customSelect.setAttribute("aria-busy", "true");

        customSelect.setAttribute("aria-disabled", "true");
      } else {
        customSelect.removeAttribute("aria-busy");

        customSelect.removeAttribute("aria-disabled");
      }
    }

    options.onLoadingChange?.(loading);

    return loading;
  }

  /* ========================================================================
     Empty Options
     ======================================================================== */

  function clear({ refresh = true } = {}) {
    const result = replaceDerivativeNegotiatedContractOptions(
      contractElement,
      [],
      {
        allLabel,

        selectedValue: ALL_VALUE,
      },
    );

    if (!refresh) {
      contractElement.value = ALL_VALUE;
    }

    return result;
  }

  /* ========================================================================
     Load
     ======================================================================== */

  async function load(category, settings = {}) {
    if (destroyed) {
      return Object.freeze({
        cancelled: true,

        stale: true,

        contracts: Object.freeze([]),

        selectedValue: ALL_VALUE,
      });
    }

    const normalizedCategory = normalizeAllValue(category);

    const selectedValue = normalizeAllValue(settings.selectedValue);

    const currentRequestId = ++requestId;

    /*
     * Cancel any request belonging to the previously selected Category.
     */

    source.cancel();

    setLoading(true);

    try {
      const response = await source.load({
        category: normalizedCategory,
      });

      if (destroyed || currentRequestId !== requestId) {
        return Object.freeze({
          cancelled: true,

          stale: true,

          contracts: Object.freeze([]),

          selectedValue: ALL_VALUE,
        });
      }

      const contracts = Array.isArray(response?.rows) ? response.rows : [];

      const result = replaceDerivativeNegotiatedContractOptions(
        contractElement,
        contracts,
        {
          allLabel,

          selectedValue,
        },
      );

      return Object.freeze({
        cancelled: false,

        stale: false,

        category: normalizedCategory,

        contracts: result.contracts,

        selectedValue: result.selectedValue,

        optionCount: result.optionCount,
      });
    } catch (error) {
      if (destroyed || currentRequestId !== requestId || isAbortError(error)) {
        return Object.freeze({
          cancelled: true,

          stale: true,

          contracts: Object.freeze([]),

          selectedValue: ALL_VALUE,
        });
      }

      /*
       * Contracts belonging to the previous Category must not remain usable
       * after the new Category request fails.
       */

      clear();

      root.dispatchEvent(
        new CustomEvent("derivative-negotiated:contracts-error", {
          bubbles: true,

          detail: Object.freeze({
            category: normalizedCategory,

            error,
          }),
        }),
      );

      options.onError?.(error, {
        category: normalizedCategory,
      });

      throw error;
    } finally {
      if (!destroyed && currentRequestId === requestId) {
        setLoading(false);
      }
    }
  }

  /* ========================================================================
     Cancellation
     ======================================================================== */

  function cancel() {
    requestId += 1;

    source.cancel();

    if (!destroyed) {
      setLoading(false);
    }
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;

    requestId += 1;

    source.destroy();

    setLoading(false);
  }

  /* ========================================================================
     Public Instance
     ======================================================================== */

  return Object.freeze({
    load,

    clear,

    cancel,

    destroy,

    isLoading() {
      return loading;
    },

    isDestroyed() {
      return destroyed;
    },
  });
}

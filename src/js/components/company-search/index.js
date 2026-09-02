/* ==========================================================================
   Company Search
   ========================================================================== */

/**
 * Shared company search for:
 *
 * 1. Utility-rail company search modal
 * 2. Home discovery search
 *
 * Architecture:
 *
 * Portal / JSP
 *   ↓
 * GET /api
 *   ↓
 * window.searchableSymbols
 *   ↓
 * "company-search:data" event
 *   ↓
 * shared company-search store
 *   ↓
 * modal + home search
 *
 * Important:
 *
 * - Portal/JSP owns the /api request.
 * - This module performs NO network requests.
 * - This module does NOT depend on jQuery.
 * - This module does NOT use Typeahead.js or Bloodhound.
 * - Modal and home search share one company collection.
 * - Portal owns document.documentElement.lang.
 * - Portal owns document.documentElement.dir.
 * - The generic modal controller owns modal open/close behavior.
 */

const HOME_RESULT_LIMIT = 8;

const FALLBACK_LOGO_URL = "/no-image.png";

const DATA_EVENT = "company-search:data";
const ERROR_EVENT = "company-search:error";

const MARKET_ORDER = Object.freeze({
  M: 1,
  S: 2,
  E: 3,
  F: 4,
  D: 5,
  B: 6,
  O: 7,
});

const SELECTORS = Object.freeze({
  modal: "[data-company-search-modal]",

  modalTrigger: "[data-search-toggle]",

  modalForm: "[data-company-search-form]",
  modalInput: "[data-company-search-input]",

  modalResults: "[data-company-search-results]",
  modalList: "[data-company-search-list]",
  modalCount: "[data-company-search-count]",

  modalLoading: "[data-company-search-loading]",
  modalEmpty: "[data-company-search-empty]",
  modalError: "[data-company-search-error]",

  homeForm: "[data-home-discovery-search]",
  homeInput: "[data-home-discovery-search-input]",

  homeResults: "[data-home-discovery-search-results]",
  homeList: "[data-home-discovery-search-list]",

  homeLoading: "[data-home-discovery-search-loading]",
  homeEmpty: "[data-home-discovery-search-empty]",
  homeError: "[data-home-discovery-search-error]",
});

const CSS = Object.freeze({
  active: "is-active",
});

/* ==========================================================================
   Module State
   ========================================================================== */

let initialized = false;

/**
 * Keep the original Portal records untouched.
 *
 * The existing Portal submitSearch() integration expects
 * window.searchableSymbols itself.
 */
let rawCompanies = [];

/**
 * Normalized company objects used internally.
 */
let companies = [];

let modalMatches = [];
let homeMatches = [];

let modalActiveIndex = -1;
let homeActiveIndex = -1;

/**
 * Same fallback principle as Market Ticker.
 *
 * If /no-image.png fails once during the page lifecycle,
 * do not keep requesting it for every failed company logo.
 */
let fallbackLogoUnavailable = false;

/* ==========================================================================
   DOM References
   ========================================================================== */

let modal = null;
let modalTriggers = [];

let modalForm = null;
let modalInput = null;

let modalResults = null;
let modalList = null;
let modalCount = null;

let modalLoading = null;
let modalEmpty = null;
let modalError = null;

let homeForm = null;
let homeInput = null;

let homeResults = null;
let homeList = null;

let homeLoading = null;
let homeEmpty = null;
let homeError = null;

/* ==========================================================================
   Language
   ========================================================================== */

/**
 * Portal owns <html lang>.
 *
 * Company Search only reads it.
 */
function getLanguage() {
  const language = document.documentElement.lang || "en";

  return language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

function isArabic() {
  return getLanguage() === "ar";
}

/* ==========================================================================
   Generic Helpers
   ========================================================================== */

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase(getLanguage())
    .trim();
}

function compactWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim();
}

function numericOnly(value) {
  return String(value ?? "").replace(/\D+/gu, "");
}

function createElement(tagName, className = "", textContent = "") {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (textContent !== "") {
    element.textContent = textContent;
  }

  return element;
}

function clearElement(element) {
  element?.replaceChildren();
}

function setHidden(element, hidden) {
  if (!element) {
    return;
  }

  element.hidden = hidden;
}

/* ==========================================================================
   Safe URLs
   ========================================================================== */

/**
 * Same URL protection principle as Market Ticker.
 *
 * - empty values rejected
 * - malformed URLs rejected
 * - javascript:/data: rejected
 * - HTTP/HTTPS accepted
 */
function getSafeUrl(value, fallback = "") {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    const url = new URL(value.trim(), window.location.origin);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return fallback;
    }

    return url.href;
  } catch {
    return fallback;
  }
}

function getSafeLogoUrl(value) {
  return getSafeUrl(value, "");
}

/* ==========================================================================
   Company Contract
   ========================================================================== */

/**
 * Real legacy Portal /api fields:
 *
 * {
 *   companyNameEN,
 *   companyNameAR,
 *   symbol,
 *   isin,
 *   tradingNameEn,
 *   tradingNameAr,
 *   sectorNameEn,
 *   sectorNameAr,
 *   market_type,
 *   ...
 * }
 *
 * We normalize those once here.
 *
 * Everything below this boundary uses:
 *
 * {
 *   symbol,
 *   isin,
 *   nameEn,
 *   nameAr,
 *   tradingNameEn,
 *   tradingNameAr,
 *   sectorEn,
 *   sectorAr,
 *   market,
 *   logo
 * }
 */
function normalizeCompany(source, index) {
  if (!source || typeof source !== "object") {
    return null;
  }

  const symbol = String(source.symbol ?? "").trim();

  const isin = String(source.isin ?? "").trim();

  const nameEn = String(source.companyNameEN ?? "").trim();

  const nameAr = String(source.companyNameAR ?? "").trim();

  const tradingNameEn = String(source.tradingNameEn ?? "").trim();

  const tradingNameAr = String(source.tradingNameAr ?? "").trim();

  const sectorEn = String(source.sectorNameEn ?? "").trim();

  const sectorAr = String(source.sectorNameAr ?? "").trim();

  const market = String(source.market_type ?? "")
    .trim()
    .toUpperCase();

  /**
   * Do not invent a Portal image property.
   *
   * We keep `logo` strict until the actual /api object
   * confirms the property name.
   */
  const logo = String(source.logo ?? "").trim();

  const company = {
    id: `${symbol || isin || "company"}-${index}`,

    symbol,
    isin,

    nameEn,
    nameAr,

    tradingNameEn,
    tradingNameAr,

    sectorEn,
    sectorAr,

    market,
    logo,

    source,
  };

  company.searchIndex = buildSearchIndex(company);

  return company;
}

/* ==========================================================================
   Search Index
   ========================================================================== */

function buildSearchIndex(company) {
  const values = [
    company.nameEn,
    company.nameAr,

    company.symbol,
    company.isin,

    company.tradingNameEn,
    company.tradingNameAr,

    company.sectorEn,
    company.sectorAr,
  ];

  const tokens = new Set();

  for (const value of values) {
    const normalized = normalizeText(value);

    if (!normalized) {
      continue;
    }

    /**
     * Preserve complete values so phrases
     * remain searchable.
     */
    tokens.add(normalized);

    /**
     * Also index searchable pieces.
     */
    for (const token of normalized.split(/[\s\-_./()]+/gu)) {
      if (token) {
        tokens.add(token);
      }
    }
  }

  /**
   * Legacy company search also indexed a
   * numeric-only representation of ISIN.
   */
  const numericIsin = numericOnly(company.isin);

  if (numericIsin) {
    tokens.add(numericIsin);
  }

  return Array.from(tokens);
}

/* ==========================================================================
   Company Store
   ========================================================================== */

function setCompanies(source) {
  rawCompanies = Array.isArray(source) ? source : [];

  companies = rawCompanies
    .map(normalizeCompany)
    .filter(Boolean)
    .filter((company) => {
      return Boolean(
        company.symbol || company.isin || company.nameEn || company.nameAr,
      );
    });

  return companies;
}

/* ==========================================================================
   Portal Data
   ========================================================================== */

/**
 * Portal/JSP owns:
 *
 * window.searchableSymbols
 *
 * This module deliberately performs no /api request.
 */
function getPortalCompanies() {
  return Array.isArray(window.searchableSymbols)
    ? window.searchableSymbols
    : [];
}

function getCompaniesFromEvent(event) {
  const source = event?.detail?.companies;

  return Array.isArray(source) ? source : [];
}

function initializeCompanyData() {
  setCompanies(getPortalCompanies());
}

/* ==========================================================================
   Localized Values
   ========================================================================== */

function companyName(company) {
  if (isArabic()) {
    return (
      company.nameAr ||
      company.nameEn ||
      company.tradingNameAr ||
      company.tradingNameEn ||
      company.symbol
    );
  }

  return (
    company.nameEn ||
    company.nameAr ||
    company.tradingNameEn ||
    company.tradingNameAr ||
    company.symbol
  );
}

function companySector(company) {
  if (isArabic()) {
    return company.sectorAr || company.sectorEn;
  }

  return company.sectorEn || company.sectorAr;
}

/* ==========================================================================
   Initials
   ========================================================================== */

function companyInitials(company) {
  const name = compactWhitespace(companyName(company));

  if (!name) {
    return isArabic() ? "م ح" : "SA";
  }

  const words = name.split(/\s+/gu).filter(Boolean).slice(0, 2);

  if (!words.length) {
    return isArabic() ? "م ح" : "SA";
  }

  if (isArabic()) {
    return words
      .map((word) => Array.from(word)[0] || "")
      .filter(Boolean)
      .join(" ");
  }

  return words
    .map((word) => Array.from(word)[0] || "")
    .filter(Boolean)
    .join("")
    .toLocaleUpperCase("en");
}

/* ==========================================================================
   Query Tokenization
   ========================================================================== */

function tokenizeQuery(query) {
  const normalized = normalizeText(query);

  if (!normalized) {
    return [];
  }

  const tokens = new Set([normalized]);

  const numeric = numericOnly(normalized);

  if (numeric) {
    tokens.add(numeric);
  }

  for (const token of normalized.split(/[\s\-_./()]+/gu)) {
    if (token) {
      tokens.add(token);
    }
  }

  return Array.from(tokens);
}

function matchesQuery(company, tokens) {
  if (!tokens.length) {
    return true;
  }

  return tokens.every((token) => {
    return company.searchIndex.some((candidate) => candidate.includes(token));
  });
}

/* ==========================================================================
   Ranking
   ========================================================================== */

/**
 * Exact legacy market ordering:
 *
 * M → S → E → F → D → B → O → Others
 */
function marketRank(company) {
  return MARKET_ORDER[company.market] ?? 99;
}

/**
 * Mirror the legacy rankQuery() behavior.
 *
 * Within the same market:
 *
 * localized name + symbol + ISIN
 *               ↓
 * query position
 *
 * A match at position 0 comes first.
 *
 * When positions are equal, alphabetical localized
 * name is handled by sortCompanies().
 */
function queryRank(company, query) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return 0;
  }

  const candidate = normalizeText(
    [companyName(company), company.symbol, company.isin]
      .filter(Boolean)
      .join(" "),
  );

  const position = candidate.indexOf(normalizedQuery);

  return position >= 0 ? position : Number.MAX_SAFE_INTEGER;
}

function sortCompanies(items, query = "") {
  return [...items].sort((a, b) => {
    /**
     * 1. Market.
     */
    const marketDifference = marketRank(a) - marketRank(b);

    if (marketDifference !== 0) {
      return marketDifference;
    }

    /**
     * 2. Legacy query position.
     */
    const queryDifference = queryRank(a, query) - queryRank(b, query);

    if (queryDifference !== 0) {
      return queryDifference;
    }

    /**
     * 3. Localized company name.
     */
    return companyName(a).localeCompare(companyName(b), getLanguage(), {
      sensitivity: "base",
      numeric: true,
    });
  });
}

function searchCompanies(query, { limit = Infinity } = {}) {
  const tokens = tokenizeQuery(query);

  const matches = companies.filter((company) => matchesQuery(company, tokens));

  return sortCompanies(matches, query).slice(0, limit);
}

/* ==========================================================================
   Logo
   ========================================================================== */

/**
 * Same fallback chain as Market Ticker:
 *
 * company logo
 *   ↓ fails
 * /no-image.png
 *   ↓ fails
 * localized initials
 */
function createLogo(company, { rootClass, imageClass, initialsClass, size }) {
  const root = createElement("span", rootClass);

  root.setAttribute("aria-hidden", "true");

  /**
   * Initials permanently exist underneath the image.
   */
  const initials = createElement(
    "span",
    initialsClass,
    companyInitials(company),
  );

  initials.dir = isArabic() ? "rtl" : "ltr";

  root.append(initials);

  const logoUrl = getSafeLogoUrl(company.logo);

  /**
   * No primary company logo.
   *
   * Try the shared fallback image before
   * revealing initials permanently.
   */
  if (!logoUrl) {
    if (!fallbackLogoUnavailable) {
      appendLogoImage(root, FALLBACK_LOGO_URL, "fallback", imageClass, size);
    }

    return root;
  }

  appendLogoImage(root, logoUrl, "primary", imageClass, size);

  return root;
}

function appendLogoImage(root, source, stage, imageClass, size) {
  const image = createElement("img", imageClass);

  image.alt = "";

  image.width = size;
  image.height = size;

  image.decoding = "async";

  image.dataset.companyLogoStage = stage;

  image.addEventListener(
    "error",
    () => {
      handleLogoError(image, root, imageClass, size);
    },
    {
      once: true,
    },
  );

  /**
   * Listener must exist before assigning src.
   */
  image.src = source;

  root.append(image);
}

function handleLogoError(image, root, imageClass, size) {
  if (!image.isConnected) {
    return;
  }

  const stage = image.dataset.companyLogoStage;

  image.remove();

  /**
   * Company image failed.
   *
   * Try /no-image.png.
   */
  if (stage === "primary" && !fallbackLogoUnavailable) {
    appendLogoImage(root, FALLBACK_LOGO_URL, "fallback", imageClass, size);

    return;
  }

  /**
   * Shared fallback itself failed.
   */
  if (stage === "fallback") {
    fallbackLogoUnavailable = true;

    removeFallbackLogoImages();
  }

  /**
   * Initials already exist underneath.
   * Removing the failed image reveals them.
   */
}

function removeFallbackLogoImages() {
  const images = document.querySelectorAll(
    '[data-company-logo-stage="fallback"]',
  );

  images.forEach((image) => {
    image.remove();
  });
}

/* ==========================================================================
   Company Selection
   ========================================================================== */

/**
 * Exact legacy Portal integration:
 *
 * window.submitSearch(
 *   item.symbol,
 *   window.searchableSymbols
 * );
 */
function selectCompany(company) {
  if (!company) {
    return;
  }

  if (typeof window.submitSearch === "function") {
    window.submitSearch(company.symbol, window.searchableSymbols);

    return;
  }

  console.warn("CompanySearch: window.submitSearch is not available.", company);
}

/* ==========================================================================
   Modal Result
   ========================================================================== */

/**
 * Modal visual structure:
 *
 * [logo]  Company Name
 *         Symbol                 ISIN
 *         Sector
 */
function createModalResult(company, index) {
  const item = createElement("li", "company-search__item");

  const button = createElement("button", "company-search__result");

  button.type = "button";

  button.dataset.companySearchResult = "";

  button.dataset.resultIndex = String(index);

  if (company.symbol) {
    button.dataset.symbol = company.symbol;
  }

  if (company.isin) {
    button.dataset.isin = company.isin;
  }

  if (index === modalActiveIndex) {
    button.classList.add(CSS.active);
  }

  /* ------------------------------------------------------------------------
     Company Logo
     ------------------------------------------------------------------------ */

  button.append(
    createLogo(company, {
      rootClass: "company-search__logo",

      imageClass: "company-search__logo-image",

      initialsClass: "company-search__logo-initials",

      size: 44,
    }),
  );

  /* ------------------------------------------------------------------------
     Company Content
     ------------------------------------------------------------------------ */

  const content = createElement("span", "company-search__content");

  /* ------------------------------------------------------------------------
     Company Name
     ------------------------------------------------------------------------ */

  const name = createElement(
    "span",
    "company-search__name",
    companyName(company),
  );

  name.dir = "auto";

  content.append(name);

  /* ------------------------------------------------------------------------
     Symbol + ISIN
     ------------------------------------------------------------------------ */

  const meta = createElement("span", "company-search__meta");

  if (company.symbol) {
    const symbol = createElement(
      "span",
      "company-search__symbol",
      company.symbol,
    );

    symbol.dir = "ltr";
    symbol.lang = "en";

    meta.append(symbol);
  }

  if (company.isin) {
    const isin = createElement("span", "company-search__isin", company.isin);

    isin.dir = "ltr";
    isin.lang = "en";

    meta.append(isin);
  }

  if (meta.childElementCount) {
    content.append(meta);
  }

  /* ------------------------------------------------------------------------
     Sector
     ------------------------------------------------------------------------ */

  const sector = companySector(company);

  if (sector) {
    const secondary = createElement("span", "company-search__secondary");

    const sectorElement = createElement(
      "span",
      "company-search__sector",
      sector,
    );

    sectorElement.dir = "auto";

    secondary.append(sectorElement);

    content.append(secondary);
  }

  button.append(content);

  /* ------------------------------------------------------------------------
     Action Indicator
     ------------------------------------------------------------------------ */

  const indicator = createElement(
    "span",
    "company-search__result-indicator has-icon icon-chevron-right",
  );

  indicator.setAttribute("aria-hidden", "true");

  button.append(indicator);

  /* ------------------------------------------------------------------------
     Selection
     ------------------------------------------------------------------------ */

  button.addEventListener("click", () => {
    selectCompany(company);
  });

  item.append(button);

  return item;
}

/* ==========================================================================
   Home Result
   ========================================================================== */

/**
 * Home discovery keeps its existing compact presentation.
 *
 * We are intentionally not forcing the modal's new
 * name → meta → sector layout onto the home component.
 */
function createHomeResult(company, index) {
  const item = createElement("li", "home-discovery-search__item");

  const button = createElement("button", "home-discovery-search__result");

  button.type = "button";

  button.dataset.homeDiscoverySearchResult = "";

  button.dataset.resultIndex = String(index);

  if (company.symbol) {
    button.dataset.symbol = company.symbol;
  }

  if (company.isin) {
    button.dataset.isin = company.isin;
  }

  if (index === homeActiveIndex) {
    button.classList.add(CSS.active);
  }

  button.append(
    createLogo(company, {
      rootClass: "home-discovery-search__logo",

      imageClass: "home-discovery-search__logo-image",

      initialsClass: "home-discovery-search__logo-initials",

      size: 40,
    }),
  );

  const content = createElement("span", "home-discovery-search__content");

  const primary = createElement("span", "home-discovery-search__primary");

  const name = createElement(
    "span",
    "home-discovery-search__name",
    companyName(company),
  );

  name.dir = "auto";

  primary.append(name);

  if (company.symbol) {
    const symbol = createElement(
      "span",
      "home-discovery-search__symbol",
      company.symbol,
    );

    symbol.dir = "ltr";
    symbol.lang = "en";

    primary.append(symbol);
  }

  if (company.isin) {
    const isin = createElement(
      "span",
      "home-discovery-search__isin",
      company.isin,
    );

    isin.dir = "ltr";
    isin.lang = "en";

    primary.append(isin);
  }

  content.append(primary);

  const sector = companySector(company);

  if (sector) {
    const secondary = createElement("span", "home-discovery-search__secondary");

    const sectorElement = createElement(
      "span",
      "home-discovery-search__sector",
      sector,
    );

    sectorElement.dir = "auto";

    secondary.append(sectorElement);

    content.append(secondary);
  }

  button.append(content);

  const indicator = createElement(
    "span",
    "home-discovery-search__indicator has-icon icon-chevron-right",
  );

  indicator.setAttribute("aria-hidden", "true");

  button.append(indicator);

  button.addEventListener("click", () => {
    selectCompany(company);
  });

  item.append(button);

  return item;
}
/* ==========================================================================
   Modal Rendering
   ========================================================================== */

function updateModalCount(count) {
  if (!modalCount) {
    return;
  }

  modalCount.textContent = String(count);

  modalCount.setAttribute(
    "aria-label",
    `${count} ${count === 1 ? "result" : "results"}`,
  );
}

function renderModalResults(items) {
  if (!modalList) {
    return;
  }

  modalMatches = items;
  modalActiveIndex = -1;

  clearElement(modalList);

  updateModalCount(items.length);

  setHidden(modalLoading, true);

  setHidden(modalError, true);

  if (!items.length) {
    setHidden(modalResults, true);

    setHidden(modalEmpty, false);

    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((company, index) => {
    fragment.append(createModalResult(company, index));
  });

  modalList.append(fragment);

  setHidden(modalEmpty, true);

  setHidden(modalResults, false);
}

/* ==========================================================================
   Home Rendering
   ========================================================================== */

function renderHomeResults(items) {
  if (!homeList) {
    return;
  }

  homeMatches = items;
  homeActiveIndex = -1;

  clearElement(homeList);

  setHidden(homeLoading, true);

  setHidden(homeError, true);

  setHidden(homeResults, false);

  if (!items.length) {
    setHidden(homeEmpty, false);

    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((company, index) => {
    fragment.append(createHomeResult(company, index));
  });

  homeList.append(fragment);

  setHidden(homeEmpty, true);
}

/* ==========================================================================
   Modal States
   ========================================================================== */

function showModalLoading() {
  clearElement(modalList);

  modalMatches = [];
  modalActiveIndex = -1;

  updateModalCount(0);

  setHidden(modalResults, true);

  setHidden(modalEmpty, true);

  setHidden(modalError, true);

  setHidden(modalLoading, false);
}

function showModalError() {
  clearElement(modalList);

  modalMatches = [];
  modalActiveIndex = -1;

  updateModalCount(0);

  setHidden(modalResults, true);

  setHidden(modalLoading, true);

  setHidden(modalEmpty, true);

  setHidden(modalError, false);
}

/* ==========================================================================
   Home States
   ========================================================================== */

function showHomeLoading() {
  clearElement(homeList);

  homeMatches = [];
  homeActiveIndex = -1;

  setHidden(homeResults, false);

  setHidden(homeEmpty, true);

  setHidden(homeError, true);

  setHidden(homeLoading, false);
}

function showHomeError() {
  clearElement(homeList);

  homeMatches = [];
  homeActiveIndex = -1;

  setHidden(homeResults, false);

  setHidden(homeLoading, true);

  setHidden(homeEmpty, true);

  setHidden(homeError, false);
}

function clearHomeResults() {
  clearElement(homeList);

  homeMatches = [];
  homeActiveIndex = -1;

  setHidden(homeLoading, true);

  setHidden(homeEmpty, true);

  setHidden(homeError, true);

  setHidden(homeResults, true);
}

/* ==========================================================================
   Active Results
   ========================================================================== */

function setModalActiveIndex(index) {
  if (!modalMatches.length || !modalList) {
    modalActiveIndex = -1;

    return;
  }

  modalActiveIndex =
    ((index % modalMatches.length) + modalMatches.length) % modalMatches.length;

  const buttons = modalList.querySelectorAll("[data-company-search-result]");

  buttons.forEach((button, buttonIndex) => {
    const active = buttonIndex === modalActiveIndex;

    button.classList.toggle(CSS.active, active);

    if (active) {
      button.scrollIntoView({
        block: "nearest",
      });
    }
  });
}

function setHomeActiveIndex(index) {
  if (!homeMatches.length || !homeList) {
    homeActiveIndex = -1;

    return;
  }

  homeActiveIndex =
    ((index % homeMatches.length) + homeMatches.length) % homeMatches.length;

  const buttons = homeList.querySelectorAll(
    "[data-home-discovery-search-result]",
  );

  buttons.forEach((button, buttonIndex) => {
    const active = buttonIndex === homeActiveIndex;

    button.classList.toggle(CSS.active, active);

    if (active) {
      button.scrollIntoView({
        block: "nearest",
      });
    }
  });
}

/* ==========================================================================
   Modal Search
   ========================================================================== */

function filterModal() {
  if (!modalInput) {
    return;
  }

  const query = modalInput.value.trim();

  renderModalResults(searchCompanies(query));
}

/**
 * The generic modal controller owns opening and closing.
 *
 * This function only decides which company-search state
 * should be visible after the modal has been triggered.
 */
function loadModalCompanies() {
  if (!companies.length) {
    showModalLoading();

    return;
  }

  filterModal();
}

/* ==========================================================================
   Home Search
   ========================================================================== */

function searchHome() {
  if (!homeInput) {
    return;
  }

  const query = homeInput.value.trim();

  if (!query) {
    clearHomeResults();

    return;
  }

  /**
   * JSP may still be waiting for /api.
   */
  if (!companies.length) {
    showHomeLoading();

    return;
  }

  renderHomeResults(
    searchCompanies(query, {
      limit: HOME_RESULT_LIMIT,
    }),
  );
}

function refreshVisibleHomeResults() {
  if (!homeInput || !homeResults || homeResults.hidden) {
    return;
  }

  const query = homeInput.value.trim();

  if (!query) {
    clearHomeResults();

    return;
  }

  if (!companies.length) {
    showHomeLoading();

    return;
  }

  renderHomeResults(
    searchCompanies(query, {
      limit: HOME_RESULT_LIMIT,
    }),
  );
}

/* ==========================================================================
   Portal Data Events
   ========================================================================== */

/**
 * JSP publishes fresh data with:
 *
 * window.dispatchEvent(
 *   new CustomEvent("company-search:data", {
 *     detail: {
 *       companies: window.searchableSymbols
 *     }
 *   })
 * );
 */
function onCompanySearchData(event) {
  const source = getCompaniesFromEvent(event);

  /**
   * Keep the Portal global authoritative.
   */
  if (Array.isArray(source)) {
    window.searchableSymbols = source;

    setCompanies(source);
  }

  /**
   * If the modal is currently open, immediately
   * refresh whatever query is visible.
   */
  if (modal && modal.getAttribute("aria-hidden") === "false") {
    if (companies.length) {
      filterModal();
    } else {
      renderModalResults([]);
    }
  }

  /**
   * Re-run only an already-visible home query.
   */
  refreshVisibleHomeResults();
}

/**
 * The actual request failure belongs to JSP.
 *
 * This module only reflects an error when no usable
 * company collection exists.
 */
function onCompanySearchError() {
  if (companies.length) {
    return;
  }

  if (modal && modal.getAttribute("aria-hidden") === "false") {
    showModalError();
  }

  if (homeInput?.value.trim()) {
    showHomeError();
  }
}

/* ==========================================================================
   Modal Keyboard
   ========================================================================== */

function onModalKeyDown(event) {
  switch (event.key) {
    case "ArrowDown":
      if (!modalMatches.length) {
        return;
      }

      event.preventDefault();

      setModalActiveIndex(modalActiveIndex + 1);

      break;

    case "ArrowUp":
      if (!modalMatches.length) {
        return;
      }

      event.preventDefault();

      setModalActiveIndex(
        modalActiveIndex <= 0 ? modalMatches.length - 1 : modalActiveIndex - 1,
      );

      break;

    case "Home":
      if (!modalMatches.length) {
        return;
      }

      event.preventDefault();

      setModalActiveIndex(0);

      break;

    case "End":
      if (!modalMatches.length) {
        return;
      }

      event.preventDefault();

      setModalActiveIndex(modalMatches.length - 1);

      break;

    case "Enter":
      if (modalActiveIndex >= 0 && modalMatches[modalActiveIndex]) {
        event.preventDefault();

        selectCompany(modalMatches[modalActiveIndex]);
      }

      break;

    /**
     * Escape intentionally remains owned
     * by the generic modal controller.
     */
    default:
      break;
  }
}

/* ==========================================================================
   Home Keyboard
   ========================================================================== */

function onHomeKeyDown(event) {
  switch (event.key) {
    case "ArrowDown":
      if (!homeMatches.length) {
        return;
      }

      event.preventDefault();

      setHomeActiveIndex(homeActiveIndex + 1);

      break;

    case "ArrowUp":
      if (!homeMatches.length) {
        return;
      }

      event.preventDefault();

      setHomeActiveIndex(
        homeActiveIndex <= 0 ? homeMatches.length - 1 : homeActiveIndex - 1,
      );

      break;

    case "Home":
      if (!homeMatches.length) {
        return;
      }

      event.preventDefault();

      setHomeActiveIndex(0);

      break;

    case "End":
      if (!homeMatches.length) {
        return;
      }

      event.preventDefault();

      setHomeActiveIndex(homeMatches.length - 1);

      break;

    case "Enter":
      if (homeActiveIndex >= 0 && homeMatches[homeActiveIndex]) {
        event.preventDefault();

        selectCompany(homeMatches[homeActiveIndex]);

        return;
      }

      if (homeMatches.length === 1) {
        event.preventDefault();

        selectCompany(homeMatches[0]);
      }

      break;

    case "Escape":
      clearHomeResults();

      break;

    default:
      break;
  }
}

/* ==========================================================================
   Form Submission
   ========================================================================== */

function onModalSubmit(event) {
  event.preventDefault();

  if (modalActiveIndex >= 0 && modalMatches[modalActiveIndex]) {
    selectCompany(modalMatches[modalActiveIndex]);

    return;
  }

  /**
   * If exactly one company remains, Enter selects it.
   */
  if (modalMatches.length === 1) {
    selectCompany(modalMatches[0]);
  }
}

function onHomeSubmit(event) {
  event.preventDefault();

  const query = homeInput?.value.trim();

  if (!query) {
    return;
  }

  if (homeActiveIndex >= 0 && homeMatches[homeActiveIndex]) {
    selectCompany(homeMatches[homeActiveIndex]);

    return;
  }

  /**
   * Preserve the old Typeahead autoselect behavior:
   *
   * when the user submits text without manually choosing
   * a row, use the highest-ranked current match.
   */
  if (homeMatches.length) {
    selectCompany(homeMatches[0]);
  }
}

/* ==========================================================================
   Home Outside Click
   ========================================================================== */

function onDocumentPointerDown(event) {
  if (!homeForm || !homeResults || homeResults.hidden) {
    return;
  }

  if (event.target instanceof Node && !homeForm.contains(event.target)) {
    clearHomeResults();
  }
}

/* ==========================================================================
   Modal Trigger
   ========================================================================== */

function onModalTriggerClick() {
  /**
   * Generic modal owns:
   *
   * - open
   * - close
   * - backdrop
   * - Escape
   * - focus containment
   *
   * Company Search owns only the result/search state.
   */
  loadModalCompanies();

  /**
   * Let the generic modal finish opening before
   * focusing the company input.
   */
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      modalInput?.focus({
        preventScroll: true,
      });
    });
  });
}

/* ==========================================================================
   DOM Resolution
   ========================================================================== */

function resolveDom() {
  modal = document.querySelector(SELECTORS.modal);

  modalTriggers = Array.from(document.querySelectorAll(SELECTORS.modalTrigger));

  modalForm = modal?.querySelector(SELECTORS.modalForm);

  modalInput = modal?.querySelector(SELECTORS.modalInput);

  modalResults = modal?.querySelector(SELECTORS.modalResults);

  modalList = modal?.querySelector(SELECTORS.modalList);

  modalCount = modal?.querySelector(SELECTORS.modalCount);

  modalLoading = modal?.querySelector(SELECTORS.modalLoading);

  modalEmpty = modal?.querySelector(SELECTORS.modalEmpty);

  modalError = modal?.querySelector(SELECTORS.modalError);

  homeForm = document.querySelector(SELECTORS.homeForm);

  homeInput = homeForm?.querySelector(SELECTORS.homeInput);

  homeResults = homeForm?.querySelector(SELECTORS.homeResults);

  homeList = homeForm?.querySelector(SELECTORS.homeList);

  homeLoading = homeForm?.querySelector(SELECTORS.homeLoading);

  homeEmpty = homeForm?.querySelector(SELECTORS.homeEmpty);

  homeError = homeForm?.querySelector(SELECTORS.homeError);
}

/* ==========================================================================
   Event Binding
   ========================================================================== */

function bindEvents() {
  modalTriggers.forEach((trigger) => {
    trigger.addEventListener("click", onModalTriggerClick);
  });

  modalInput?.addEventListener("input", filterModal);

  modalInput?.addEventListener("keydown", onModalKeyDown);

  modalForm?.addEventListener("submit", onModalSubmit);

  homeInput?.addEventListener("input", searchHome);

  homeInput?.addEventListener("keydown", onHomeKeyDown);

  homeForm?.addEventListener("submit", onHomeSubmit);

  document.addEventListener("pointerdown", onDocumentPointerDown);

  /**
   * Portal/JSP data bridge.
   */
  window.addEventListener(DATA_EVENT, onCompanySearchData);

  window.addEventListener(ERROR_EVENT, onCompanySearchError);
}

/* ==========================================================================
   Initial State
   ========================================================================== */

function initializeState() {
  clearElement(modalList);
  clearElement(homeList);

  updateModalCount(0);

  setHidden(modalResults, true);

  setHidden(modalLoading, true);

  setHidden(modalEmpty, true);

  setHidden(modalError, true);

  setHidden(homeResults, true);

  setHidden(homeLoading, true);

  setHidden(homeEmpty, true);

  setHidden(homeError, true);
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initCompanySearch() {
  if (initialized) {
    return;
  }

  resolveDom();

  if (!modal && !homeForm) {
    return;
  }

  initialized = true;

  /**
   * Race-safe Portal initialization:
   *
   * Case A:
   * JSP AJAX completed before Vite initializes.
   * -> window.searchableSymbols is read immediately.
   *
   * Case B:
   * Vite initializes first.
   * -> "company-search:data" supplies the collection later.
   */
  initializeCompanyData();

  initializeState();

  bindEvents();
}

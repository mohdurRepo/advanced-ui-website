/* ==========================================================================
   Company Search
   ========================================================================== */

/**
 * Shared company search for:
 *
 * 1. Home discovery search
 * 2. Company search modal
 *
 * Responsibilities:
 *
 * - Uses typeahead-standalone.
 * - Does not depend on jQuery.
 * - Does not open or close modals.
 * - Does not manage modal focus.
 * - Home suggestions appear after typing.
 * - Modal shows all companies when empty/focused.
 * - Portal owns document language/direction.
 * - Portal window.submitSearch() owns final navigation.
 *
 * Company image fallback:
 *
 * /abu-ibrahim/{companyCode}.jpg
 *        ↓
 * /abu-ibrahim/default-Logo.png
 *        ↓
 * initials
 */

/* ==========================================================================
   Configuration
   ========================================================================== */

const RESULT_LIMIT = 100;

const COMPANY_IMAGE_BASE_PATH = "/abu-ibrahim";

const DEFAULT_COMPANY_IMAGE = `${COMPANY_IMAGE_BASE_PATH}/default-Logo.png`;

const SEARCH_SURFACES = Object.freeze([
  {
    selector: "#home-discovery-search-input",
    showAllWhenEmpty: false,
  },

  {
    selector: "#companySearchInput",
    showAllWhenEmpty: true,
  },
]);

const MARKET_ORDER = Object.freeze({
  M: 1,
  S: 2,
  E: 3,
  F: 4,
  D: 5,
  B: 6,
  O: 7,
});

let initialized = false;
let imageFallbackBound = false;

/* ==========================================================================
   Language
   ========================================================================== */

function getLanguage() {
  return (document.documentElement.lang || "en").toLowerCase();
}

function isArabic() {
  return getLanguage().startsWith("ar");
}

/* ==========================================================================
   Company Data
   ========================================================================== */

/**
 * Temporary development source:
 *
 * <script
 *   type="application/json"
 *   id="company-search-data"
 * >
 *   [...]
 * </script>
 *
 * Later:
 *
 * window.searchableSymbols
 */
function getCompanies() {
  const element = document.getElementById("company-search-data");

  if (element) {
    try {
      const data = JSON.parse(element.textContent || "[]");

      if (Array.isArray(data)) {
        return data;
      }

      console.warn("CompanySearch: company-search-data must contain an array.");
    } catch (error) {
      console.error("CompanySearch: invalid static company JSON.", error);
    }
  }

  /**
   * Portal/API collection.
   */
  if (Array.isArray(window.searchableSymbols)) {
    return window.searchableSymbols;
  }

  return [];
}

/* ==========================================================================
   Localized Values
   ========================================================================== */

function displayName(company) {
  if (isArabic()) {
    return (
      company.companyNameAR ||
      company.companyNameEN ||
      company.tradingNameAr ||
      company.tradingNameEn ||
      company.symbol ||
      ""
    );
  }

  return (
    company.companyNameEN ||
    company.companyNameAR ||
    company.tradingNameEn ||
    company.tradingNameAr ||
    company.symbol ||
    ""
  );
}

function displaySector(company) {
  if (isArabic()) {
    return company.sectorNameAr || company.sectorNameEn || "";
  }

  return company.sectorNameEn || company.sectorNameAr || "";
}

/* ==========================================================================
   Text Helpers
   ========================================================================== */

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase(getLanguage())
    .trim();
}

function numericOnly(value) {
  return String(value ?? "").replace(/\D+/gu, "");
}

/* ==========================================================================
   HTML Safety
   ========================================================================== */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ==========================================================================
   Initials
   ========================================================================== */

function companyInitials(company) {
  const name = displayName(company);

  const words = String(name || "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2);

  if (!words.length) {
    return isArabic() ? "ش" : "C";
  }

  const characters = words
    .map((word) => {
      return Array.from(word)[0] || "";
    })
    .filter(Boolean);

  if (isArabic()) {
    return characters.join(" ");
  }

  return characters.join("").toLocaleUpperCase("en");
}

/* ==========================================================================
   Company Images
   ========================================================================== */

function primaryCompanyImageUrl(company) {
  if (!company.companyCode) {
    return DEFAULT_COMPANY_IMAGE;
  }

  return `${COMPANY_IMAGE_BASE_PATH}/${encodeURIComponent(
    String(company.companyCode),
  )}.jpg`;
}

function initialImageStage(company) {
  return company.companyCode ? "company" : "default";
}

/* ==========================================================================
   Prepared Search Records
   ========================================================================== */

/**
 * The original Portal objects are not mutated.
 *
 * These fields exist only for the Typeahead index.
 */
function prepareCompanies(companies) {
  return companies.map((company, index) => {
    return {
      ...company,

      __searchId: [company.symbol, company.isin, index]
        .filter((value) => {
          return value !== null && value !== undefined && value !== "";
        })
        .join("-"),

      __numericIsin: numericOnly(company.isin),

      __numericSymbol: numericOnly(company.symbol),
    };
  });
}

/* ==========================================================================
   Market Ranking
   ========================================================================== */

/**
 * Legacy market priority:
 *
 * M → S → E → F → D → B → O → unknown
 */
function marketRank(company) {
  const market = String(company.market_type || "")
    .trim()
    .toUpperCase();

  return MARKET_ORDER[market] ?? 99;
}

/* ==========================================================================
   Query Ranking
   ========================================================================== */

/**
 * Ranking:
 *
 * 1. Market priority
 * 2. Query position
 * 3. Localized company name
 */
function rankQuery(a, b, query) {
  /* ------------------------------------------------------------------------
     Market
     ------------------------------------------------------------------------ */

  const marketDifference = marketRank(a) - marketRank(b);

  if (marketDifference !== 0) {
    return marketDifference;
  }

  /* ------------------------------------------------------------------------
     Query
     ------------------------------------------------------------------------ */

  const normalizedQuery = normalizeText(query);

  /**
   * Empty query is the modal's
   * default company directory.
   */
  if (!normalizedQuery) {
    return displayName(a).localeCompare(displayName(b), getLanguage(), {
      sensitivity: "base",
      numeric: true,
    });
  }

  const aText = normalizeText(
    [displayName(a), a.symbol, a.isin].filter(Boolean).join(" "),
  );

  const bText = normalizeText(
    [displayName(b), b.symbol, b.isin].filter(Boolean).join(" "),
  );

  const aIndex = aText.indexOf(normalizedQuery);

  const bIndex = bText.indexOf(normalizedQuery);

  if (aIndex !== bIndex) {
    if (aIndex === -1) {
      return 1;
    }

    if (bIndex === -1) {
      return -1;
    }

    return aIndex - bIndex;
  }

  /* ------------------------------------------------------------------------
     Name
     ------------------------------------------------------------------------ */

  return displayName(a).localeCompare(displayName(b), getLanguage(), {
    sensitivity: "base",
    numeric: true,
  });
}

function sortCompanies(companies, query = "") {
  return [...companies].sort((a, b) => {
    return rankQuery(a, b, query);
  });
}

/* ==========================================================================
   Legacy Fallback Matching
   ========================================================================== */

/**
 * The library handles indexed searching.
 *
 * If the index returns no matches,
 * preserve broad legacy substring behavior.
 */
function fallbackSearch(companies, query) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return [];
  }

  const digits = numericOnly(query);

  return companies.filter((company) => {
    const searchableValues = [
      company.companyNameEN,
      company.companyNameAR,

      company.symbol,
      company.isin,

      company.tradingNameEn,
      company.tradingNameAr,

      company.sectorNameEn,
      company.sectorNameAr,
    ];

    const haystack = searchableValues
      .filter(Boolean)
      .map(normalizeText)
      .join(" ");

    if (haystack.includes(normalizedQuery)) {
      return true;
    }

    if (digits && numericOnly(company.symbol).includes(digits)) {
      return true;
    }

    if (digits && numericOnly(company.isin).includes(digits)) {
      return true;
    }

    return false;
  });
}

/* ==========================================================================
   Suggestion Template
   ========================================================================== */

function suggestionTemplate(company) {
  const name = displayName(company);

  const sector = displaySector(company);

  const imageUrl = primaryCompanyImageUrl(company);

  const imageStage = initialImageStage(company);

  const symbolMarkup = company.symbol
    ? `
        <span
          class="tt-ticker"
          dir="ltr"
          lang="en"
        >
          ${escapeHtml(company.symbol)}
        </span>
      `
    : "";

  const isinMarkup = company.isin
    ? `
        <span
          class="tt-isin"
          dir="ltr"
          lang="en"
        >
          ${escapeHtml(company.isin)}
        </span>
      `
    : "";

  const sectorMarkup = sector
    ? `
        <span class="tt-sub">
          <span
            class="tt-chip"
            dir="auto"
          >
            ${escapeHtml(sector)}
          </span>
        </span>
      `
    : "";

  return `
    <div class="tt-row">

      <span
        class="tt-avatar"
        aria-hidden="true"
      >
        <span
          class="tt-initials"
          dir="${isArabic() ? "rtl" : "ltr"}"
        >
          ${escapeHtml(companyInitials(company))}
        </span>

        <img
          class="tt-company-image"
          src="${escapeHtml(imageUrl)}"
          alt=""
          width="40"
          height="40"
          decoding="async"
          data-company-image-stage="${imageStage}"
        >
      </span>

      <span class="tt-meta">

        <span class="tt-title-row">

          <span
            class="tt-title"
            dir="auto"
          >
            ${escapeHtml(name)}
          </span>

          ${symbolMarkup}

          ${isinMarkup}

        </span>

        ${sectorMarkup}

      </span>

    </div>
  `;
}

/* ==========================================================================
   Portal Submission
   ========================================================================== */

function submitPortalSearch(value, portalCompanies) {
  const query = String(value ?? "").trim();

  if (!query) {
    return;
  }

  if (typeof window.submitSearch === "function") {
    window.submitSearch(query, window.searchableSymbols || portalCompanies);

    return;
  }

  /**
   * Temporary static-data
   * development fallback.
   */
  console.log("CompanySearch: submitted", query);
}

function selectCompany(company, portalCompanies) {
  if (!company?.symbol) {
    return;
  }

  submitPortalSearch(company.symbol, portalCompanies);
}

/* ==========================================================================
   Templates
   ========================================================================== */

function createTemplates({ companies, showAllWhenEmpty }) {
  const templates = {
    header() {
      return `
        <div class="tt-section">
          ${isArabic() ? "النتائج" : "Results"}
        </div>
      `;
    },

    suggestion(company) {
      return suggestionTemplate(company);
    },

    notFound() {
      return `
        <span class="tt-empty-message">
          ${isArabic() ? "لا توجد نتائج" : "No matches found"}
        </span>
      `;
    },
  };

  /**
   * Modal only:
   *
   * Show the complete company list
   * while the query is empty.
   */
  if (showAllWhenEmpty) {
    templates.empty = function emptySuggestions() {
      return sortCompanies(companies, "").slice(0, RESULT_LIMIT);
    };
  }

  return templates;
}

/* ==========================================================================
   Typeahead Instance
   ========================================================================== */

function initSearchInput({
  typeahead,
  input,
  companies,
  portalCompanies,
  showAllWhenEmpty,
}) {
  if (!input) {
    return;
  }

  typeahead({
    input,

    /* ----------------------------------------------------------------------
       Source
       ---------------------------------------------------------------------- */

    source: {
      local: companies,

      keys: [
        "companyNameEN",
        "companyNameAR",

        "symbol",
        "isin",

        "tradingNameEn",
        "tradingNameAr",

        "sectorNameEn",
        "sectorNameAr",

        "__numericIsin",
        "__numericSymbol",
      ],

      identity(company) {
        return company.__searchId;
      },
    },

    /* ----------------------------------------------------------------------
       Search
       ---------------------------------------------------------------------- */

    minLength: 1,

    limit: RESULT_LIMIT,

    highlight: true,

    /**
     * Do not select the first
     * company automatically.
     */
    autoSelect: false,

    /**
     * No ghost autocomplete text.
     */
    hint: false,

    preventSubmit: true,

    retainFocus: true,

    listScrollOptions: {
      block: "nearest",
      inline: "nearest",
      behavior: "auto",
    },

    /* ----------------------------------------------------------------------
       Display / Selection
       ---------------------------------------------------------------------- */

    display(company, event) {
      const value = displayName(company);

      /**
       * Enter selection is owned
       * by onSubmit().
       *
       * Pointer/Tab selection
       * submits the company.
       */
      const isEnter = event instanceof KeyboardEvent && event.key === "Enter";

      if (event && !isEnter) {
        queueMicrotask(() => {
          selectCompany(company, portalCompanies);
        });
      }

      return value;
    },

    /* ----------------------------------------------------------------------
       Ranking
       ---------------------------------------------------------------------- */

    hooks: {
      async updateHits(resultSet) {
        const query = resultSet.query || "";

        let matches = Array.isArray(resultSet.hits) ? [...resultSet.hits] : [];

        /**
         * Broad legacy fallback.
         */
        if (!matches.length && query) {
          matches = fallbackSearch(companies, query);
        }

        matches = sortCompanies(matches, query).slice(0, RESULT_LIMIT);

        resultSet.hits = matches;

        resultSet.count = matches.length;

        return resultSet;
      },
    },

    /* ----------------------------------------------------------------------
       Templates
       ---------------------------------------------------------------------- */

    templates: createTemplates({
      companies,
      showAllWhenEmpty,
    }),

    /* ----------------------------------------------------------------------
       Enter
       ---------------------------------------------------------------------- */

    onSubmit(event, selectedCompany) {
      event.preventDefault();

      /**
       * Explicitly highlighted item.
       */
      if (selectedCompany?.symbol) {
        selectCompany(selectedCompany, portalCompanies);

        return;
      }

      /**
       * Nothing highlighted:
       * submit raw query.
       */
      submitPortalSearch(input.value, portalCompanies);
    },
  });

  /* ==========================================================================
     Form Submit
     ========================================================================== */

  const form = input.closest("form");

  if (!form) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    submitPortalSearch(input.value, portalCompanies);
  });
}

/* ==========================================================================
   Company Image Fallback
   ========================================================================== */

/**
 * Fallback sequence:
 *
 * companyCode.jpg
 *      ↓ error
 * default-Logo.png
 *      ↓ error
 * remove image
 *      ↓
 * initials underneath become visible
 */
function bindImageFallback() {
  if (imageFallbackBound) {
    return;
  }

  imageFallbackBound = true;

  document.addEventListener(
    "error",
    (event) => {
      const image = event.target;

      if (!(image instanceof HTMLImageElement)) {
        return;
      }

      if (!image.classList.contains("tt-company-image")) {
        return;
      }

      const stage = image.dataset.companyImageStage;

      /* --------------------------------------------------------------------
         Company image failed
         -------------------------------------------------------------------- */

      if (stage === "company") {
        image.dataset.companyImageStage = "default";

        image.src = DEFAULT_COMPANY_IMAGE;

        return;
      }

      /* --------------------------------------------------------------------
         Default logo failed
         -------------------------------------------------------------------- */

      image.remove();
    },
    true,
  );
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initCompanySearch() {
  if (initialized) {
    return;
  }

  /* ------------------------------------------------------------------------
     Library
     ------------------------------------------------------------------------ */

  const typeahead = window.typeahead;

  if (typeof typeahead !== "function") {
    console.error("CompanySearch: typeahead-standalone is not available.");

    return;
  }

  /* ------------------------------------------------------------------------
     Search Surfaces
     ------------------------------------------------------------------------ */

  const surfaces = SEARCH_SURFACES.map((surface) => {
    return {
      ...surface,

      input: document.querySelector(surface.selector),
    };
  }).filter((surface) => {
    return Boolean(surface.input);
  });

  if (!surfaces.length) {
    return;
  }

  /* ------------------------------------------------------------------------
     Company Collection
     ------------------------------------------------------------------------ */

  const portalCompanies = getCompanies();

  if (!portalCompanies.length) {
    console.warn("CompanySearch: no company data found.");

    return;
  }

  const companies = prepareCompanies(portalCompanies);

  /**
   * Preserve Portal contract with
   * untouched original records.
   */
  window.searchableSymbols = portalCompanies;

  /* ------------------------------------------------------------------------
     Initialize
     ------------------------------------------------------------------------ */

  surfaces.forEach((surface) => {
    initSearchInput({
      typeahead,

      input: surface.input,

      companies,

      portalCompanies,

      showAllWhenEmpty: surface.showAllWhenEmpty,
    });
  });

  bindImageFallback();

  initialized = true;

  /* ------------------------------------------------------------------------
     Temporary Development Log
     ------------------------------------------------------------------------ */

  console.log("CompanySearch: initialized", {
    companies: portalCompanies.length,

    surfaces: surfaces.map((surface) => {
      return {
        input: surface.input.id,

        showAllWhenEmpty: surface.showAllWhenEmpty,
      };
    }),

    typeahead: typeof window.typeahead,
  });
}

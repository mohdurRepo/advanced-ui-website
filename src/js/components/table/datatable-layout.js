import { TableScrollNavigation } from "./table-scroll-navigation";

/* ==========================================================================
   DataTables Layout
   ========================================================================== */

const RESIZE_DELAY = 120;

const SELECTORS = {
  siteHeader: "[data-site-header]",
  tableShell: "[data-table-shell]",
  tableScroll: ".dt-scroll-body",
  tableJump: "[data-table-scroll-jump]",
};

let resizeTimer = null;
let headerResizeObserver = null;
let initialized = false;

/* ==========================================================================
   Availability
   ========================================================================== */

function getDataTable() {
  return window.DataTable || null;
}

function isAvailable() {
  const DataTable = getDataTable();

  return DataTable && typeof DataTable.tables === "function";
}

/* ==========================================================================
   Sticky Header Offset
   ========================================================================== */

export function getSiteHeaderOffset() {
  const header = document.querySelector(SELECTORS.siteHeader);

  if (!header) {
    return 0;
  }

  return Math.ceil(header.getBoundingClientRect().height);
}

export function syncSiteHeaderOffset() {
  const offset = getSiteHeaderOffset();

  document.documentElement.style.setProperty(
    "--site-header-block-size",
    `${offset}px`,
  );

  return offset;
}

/* ==========================================================================
   DataTables Scroll Navigation
   ========================================================================== */

/*
 * DataTables creates `.dt-scroll-body` after initialization. This function
 * connects that generated scroller to the same reusable TableScrollNavigation
 * used by native responsive tables.
 *
 * Required page markup:
 *
 * <div class="table-shell" data-table-shell>
 *   <table id="..." class="table">...</table>
 *   <button data-table-scroll-jump hidden></button>
 * </div>
 */

function syncDataTableScrollNavigation(tableApi) {
  const table = tableApi?.table?.().node?.();

  if (!(table instanceof Element)) {
    return;
  }

  const shell = table.closest(SELECTORS.tableShell);

  if (!shell || !shell.querySelector(SELECTORS.tableJump)) {
    return;
  }

  const scroller = shell.querySelector(SELECTORS.tableScroll);

  if (!scroller) {
    return;
  }

  scroller.setAttribute("data-table-scroll", "");

  TableScrollNavigation.getOrCreateInstance(shell);
}

/* ==========================================================================
   FixedHeader and FixedColumns
   ========================================================================== */

function syncFixedHeaderOffset(tableApi, offset) {
  const fixedHeader = tableApi?.fixedHeader;

  if (fixedHeader?.headerOffset) {
    fixedHeader.headerOffset(offset);
  }

  if (fixedHeader?.adjust) {
    fixedHeader.adjust();
  }
}

function syncFixedColumns(tableApi) {
  if (typeof tableApi?.fixedColumns !== "function") {
    return;
  }

  const fixedColumns = tableApi.fixedColumns();

  if (fixedColumns?.relayout) {
    fixedColumns.relayout();
  }
}

/* ==========================================================================
   Adjustment
   ========================================================================== */

export function refreshDataTableLayout() {
  const headerOffset = syncSiteHeaderOffset();

  if (!isAvailable()) {
    return;
  }

  const DataTable = getDataTable();

  const tables = DataTable.tables({
    visible: true,
    api: true,
  });

  if (!tables?.context?.length) {
    return;
  }

  tables.columns.adjust();

  tables.tables().every(function adjustTable() {
    syncFixedHeaderOffset(this, headerOffset);
    syncFixedColumns(this);
    syncDataTableScrollNavigation(this);
  });
}

/* ==========================================================================
   Resize and Header Observation
   ========================================================================== */

function scheduleRefresh() {
  window.clearTimeout(resizeTimer);

  resizeTimer = window.setTimeout(() => {
    refreshDataTableLayout();
  }, RESIZE_DELAY);
}

function handleResize() {
  scheduleRefresh();
}

function observeSiteHeader() {
  if (typeof ResizeObserver !== "function") {
    return;
  }

  const header = document.querySelector(SELECTORS.siteHeader);

  if (!header) {
    return;
  }

  headerResizeObserver?.disconnect();

  headerResizeObserver = new ResizeObserver(() => {
    scheduleRefresh();
  });

  headerResizeObserver.observe(header);
}

function stopObservingSiteHeader() {
  headerResizeObserver?.disconnect();

  headerResizeObserver = null;
}

/* ==========================================================================
   Initialization
   ========================================================================== */

export function initDataTableLayout() {
  if (initialized) {
    refreshDataTableLayout();

    return;
  }

  initialized = true;

  syncSiteHeaderOffset();
  observeSiteHeader();

  window.addEventListener("resize", handleResize, {
    passive: true,
  });

  window.requestAnimationFrame(() => {
    refreshDataTableLayout();
  });

  if (document.readyState === "complete") {
    refreshDataTableLayout();
  } else {
    window.addEventListener("load", refreshDataTableLayout, {
      once: true,
    });
  }
}

/* ==========================================================================
   Destruction
   ========================================================================== */

export function destroyDataTableLayout() {
  if (!initialized) {
    return;
  }

  window.removeEventListener("resize", handleResize);

  window.clearTimeout(resizeTimer);
  stopObservingSiteHeader();

  resizeTimer = null;
  initialized = false;
}

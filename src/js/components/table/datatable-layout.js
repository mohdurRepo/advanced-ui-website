/* ==========================================================================
   DataTables Layout
   ========================================================================== */

/**
 * Global layout synchronization for initialized DataTables.
 *
 * Responsibilities:
 *
 * - Recalculate visible DataTables after viewport or layout changes
 * - Keep scroll headers aligned with their body columns
 * - Recalculate FixedHeader positioning when available
 *
 * Page-specific DataTables configuration does not belong here.
 */

const RESIZE_DELAY = 120;

let resizeTimer = null;
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
   Adjustment
   ========================================================================== */

/**
 * Recalculates all currently visible DataTables.
 *
 * DataTable.tables({ visible: true, api: true }) is the official API for
 * obtaining initialized visible tables when their sizing needs adjustment.
 */
export function refreshDataTableLayout() {
  if (!isAvailable()) {
    return;
  }

  const DataTable = getDataTable();

  const tables = DataTable.tables({
    visible: true,
    api: true,
  });

  if (!tables || !tables.context?.length) {
    return;
  }

  /*
   * Recalculate column widths.
   *
   * This also keeps DataTables' generated scroll header synchronized with
   * the scrolling body after viewport/container width changes.
   */
  tables.columns.adjust();

  /*
   * FixedHeader caches positional information and exposes its own adjustment
   * API. Run it once per DataTable where the extension is active.
   */
  tables.tables().every(function () {
    if (this.fixedHeader && typeof this.fixedHeader.adjust === "function") {
      this.fixedHeader.adjust();
    }
  });
}

/* ==========================================================================
   Resize
   ========================================================================== */

function handleResize() {
  window.clearTimeout(resizeTimer);

  resizeTimer = window.setTimeout(() => {
    refreshDataTableLayout();
  }, RESIZE_DELAY);
}

/* ==========================================================================
   Initialization
   ========================================================================== */

/**
 * Initializes global DataTables layout synchronization.
 *
 * Idempotent: repeated calls do not register duplicate listeners.
 */
export function initDataTableLayout() {
  if (initialized) {
    refreshDataTableLayout();

    return;
  }

  initialized = true;

  window.addEventListener("resize", handleResize, {
    passive: true,
  });

  /*
   * Adjust once after the current layout pass.
   */
  window.requestAnimationFrame(() => {
    refreshDataTableLayout();
  });

  /*
   * Fonts, images, and other deferred assets can alter final dimensions.
   */
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

/**
 * Removes the global resize listener.
 *
 * Primarily useful for tests, hot module replacement, or isolated
 * application environments.
 */
export function destroyDataTableLayout() {
  if (!initialized) {
    return;
  }

  window.removeEventListener("resize", handleResize);

  window.clearTimeout(resizeTimer);

  resizeTimer = null;
  initialized = false;
}

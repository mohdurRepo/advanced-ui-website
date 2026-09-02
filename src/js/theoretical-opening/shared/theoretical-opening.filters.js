/* ==========================================================================
   Theoretical Opening Filters
   ========================================================================== */

const DEFAULT_SECTOR = "All";

/* ==========================================================================
   Helpers
   ========================================================================== */

function normalizeSector(value) {
  const normalized = String(value ?? "").trim();

  return normalized || DEFAULT_SECTOR;
}

/* ==========================================================================
   Filter Controller
   ========================================================================== */

export function createTheoreticalOpeningFilters({
  root = document,
  initialState = {},
  onChange,
} = {}) {
  const sectorSelect = root.querySelector("[data-theoretical-opening-sector]");

  let currentSector = normalizeSector(initialState.sector);

  function getState() {
    return {
      sector: currentSector,
    };
  }

  function syncFromDom() {
    if (!sectorSelect) {
      return getState();
    }

    currentSector = normalizeSector(sectorSelect.value);

    return getState();
  }

  function setSector(sector, { notify = false } = {}) {
    currentSector = normalizeSector(sector);

    if (sectorSelect) {
      sectorSelect.value = currentSector;
    }

    if (notify && typeof onChange === "function") {
      onChange(getState());
    }

    return getState();
  }

  function handleSectorChange() {
    syncFromDom();

    if (typeof onChange === "function") {
      onChange(getState());
    }
  }

  function bind() {
    if (!sectorSelect) {
      return;
    }

    sectorSelect.value = currentSector;

    sectorSelect.addEventListener("change", handleSectorChange);
  }

  function destroy() {
    if (!sectorSelect) {
      return;
    }

    sectorSelect.removeEventListener("change", handleSectorChange);
  }

  bind();

  return {
    getState,
    setSector,
    syncFromDom,
    destroy,
  };
}

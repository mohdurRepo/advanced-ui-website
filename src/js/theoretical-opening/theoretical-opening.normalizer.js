/* ==========================================================================
   Theoretical Opening Normalizer
   ========================================================================== */

/*
 * Responsibilities:
 *
 * - normalize supported response containers
 * - normalize legacy backend aliases into canonical feature fields
 * - expose total / updatedAt metadata
 *
 * Shared by:
 *
 * - Theoretical Opening
 * - Nomu Theoretical Opening
 */

/* ==========================================================================
   Helpers
   ========================================================================== */

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstDefined(...values) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== "",
  );
}

/* ==========================================================================
   Response Rows
   ========================================================================== */

function getResponseRows(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (!isObject(response)) {
    return [];
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (isObject(response.data) && Array.isArray(response.data.content)) {
    return response.data.content;
  }

  if (Array.isArray(response.rows)) {
    return response.rows;
  }

  if (Array.isArray(response.results)) {
    return response.results;
  }

  if (Array.isArray(response.result)) {
    return response.result;
  }

  if (Array.isArray(response.content)) {
    return response.content;
  }

  return [];
}

/* ==========================================================================
   Row Normalization
   ========================================================================== */

function normalizeRow(row) {
  if (!isObject(row)) {
    return null;
  }

  return {
    ...row,

    /* ----------------------------------------------------------------------
       Company Identity
       ---------------------------------------------------------------------- */

    companyName: firstDefined(
      row.companyName,
      row.acrynomName,
      row.acronymName,
      row.company,
      row.name,
      row.issuerName,
      "",
    ),

    companyCode: firstDefined(
      row.companyCode,
      row.companySymbol,
      row.symbol,
      row.companyRef,
      row.securityCode,
      row.issuerCode,
      "",
    ),

    companyUrl: firstDefined(
      row.companyUrl,
      row.companyURL,
      row.pageUrl,
      row.url,
      "",
    ),

    /* ----------------------------------------------------------------------
       Sector
       ---------------------------------------------------------------------- */

    sectorName: firstDefined(
      row.sectorName,
      row.sector,
      row.sectorDescription,
      "",
    ),

    /* ----------------------------------------------------------------------
       Previous Close
       ---------------------------------------------------------------------- */

    previousClose: firstDefined(
      row.prev_close,
      row.previousClose,
      row.previousClosePrice,
      row.prevClose,
      row.previousClosingPrice,
      row.closePrice,
      "",
    ),

    /* ----------------------------------------------------------------------
       Theoretical Opening Price
       ---------------------------------------------------------------------- */

    top: firstDefined(
      row.top,
      row.TOP,
      row.theoreticalOpeningPrice,
      row.theoreticalPrice,
      row.indicativeOpeningPrice,
      row.openingPrice,
      "",
    ),

    /* ----------------------------------------------------------------------
       Theoretical Opening Volume
       ---------------------------------------------------------------------- */

    tov: firstDefined(
      row.tov,
      row.TOV,
      row.theoreticalOpeningVolume,
      row.theoreticalVolume,
      row.indicativeOpeningVolume,
      row.openingVolume,
      "",
    ),
  };
}

/* ==========================================================================
   Metadata
   ========================================================================== */

function getTotal(response, rows) {
  if (!isObject(response)) {
    return rows.length;
  }

  const total = firstDefined(
    response.total,
    response.recordsTotal,
    response.recordsFiltered,
    response.totalElements,
  );

  const numericTotal = Number(total);

  return Number.isFinite(numericTotal) ? numericTotal : rows.length;
}

function getUpdatedAt(response) {
  if (!isObject(response)) {
    return null;
  }

  return firstDefined(
    response.updatedAt,
    response.lastUpdated,
    response.timestamp,
    null,
  );
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function normalizeTheoreticalOpeningResponse(response) {
  const rows = getResponseRows(response).map(normalizeRow).filter(Boolean);

  return {
    rows,

    meta: {
      total: getTotal(response, rows),

      updatedAt: getUpdatedAt(response),
    },

    raw: response,
  };
}

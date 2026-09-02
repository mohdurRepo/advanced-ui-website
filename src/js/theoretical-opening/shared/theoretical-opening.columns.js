/* ==========================================================================
   Theoretical Opening Columns
   ========================================================================== */

export const THEORETICAL_OPENING_FIELDS = Object.freeze({
  companyName: {
    key: "companyName",

    aliases: ["companyName", "acrynomName", "company", "name", "issuerName"],

    fallback: "-",
  },

  companyCode: {
    key: "companyCode",

    aliases: [
      "symbol",
      "companyCode",
      "companySymbol",
      "companyRef",
      "issuerCode",
    ],

    fallback: "-",
  },

  companyUrl: {
    key: "companyUrl",

    aliases: ["companyURL", "companyUrl", "url"],

    fallback: "",
  },

  sectorName: {
    key: "sectorName",

    aliases: ["sectorName", "sector", "sectorDescription"],

    fallback: "",
  },

  previousClose: {
    key: "previousClose",

    aliases: [
      "prev_close",
      "previousClose",
      "previousClosePrice",
      "prevClose",
      "previousClosingPrice",
      "closePrice",
    ],

    fallback: null,
  },

  theoreticalOpeningPrice: {
    key: "theoreticalOpeningPrice",

    aliases: [
      "top",
      "TOP",
      "theoreticalOpeningPrice",
      "theoreticalPrice",
      "indicativeOpeningPrice",
      "openingPrice",
    ],

    fallback: null,
  },

  theoreticalOpeningVolume: {
    key: "theoreticalOpeningVolume",

    aliases: [
      "tov",
      "TOV",
      "theoreticalOpeningVolume",
      "theoreticalVolume",
      "indicativeOpeningVolume",
      "openingVolume",
    ],

    fallback: null,
  },
});

/* ==========================================================================
   Table Columns
   ========================================================================== */

export function createTheoreticalOpeningColumns(config = {}) {
  const labels = config.labels?.table || {};

  return [
    {
      key: "companyName",
      data: "companyName",

      label: labels.company || "Company",

      width: "40%",

      className: "table-market__security",

      orderable: false,

      type: "company",
    },

    {
      key: "previousClose",
      data: "previousClose",

      label: labels.previousClose || "Previous Close",

      width: "20%",

      className: "table-market__number text-center",

      orderable: false,

      type: "price",
    },

    {
      key: "theoreticalOpeningPrice",
      data: "theoreticalOpeningPrice",

      label: labels.top || "TOP",

      width: "20%",

      className: "table-market__number text-center",

      orderable: false,

      type: "price",
    },

    {
      key: "theoreticalOpeningVolume",
      data: "theoreticalOpeningVolume",

      label: labels.tov || "TOV",

      width: "20%",

      className: "table-market__number text-center",

      orderable: false,

      type: "quantity",
    },
  ];
}

export const DataTableI18n = {
  en: {
    emptyTable: "No data available",
    processing: "Loading...",
    search: "Search:",
    lengthMenu: "Show _MENU_ entries",
    info: "Showing _START_ to _END_ of _TOTAL_ entries",
    infoEmpty: "Showing 0 to 0 of 0 entries",
    paginate: {
      first: "First",
      last: "Last",
      next: "Next",
      previous: "Prev",
    },
  },

  ar: {
    emptyTable: "لا توجد بيانات",
    processing: "جارٍ التحميل...",
    search: "بحث:",
    lengthMenu: "عرض _MENU_ سجل",
    info: "عرض _START_ إلى _END_ من _TOTAL_",
    infoEmpty: "عرض 0 إلى 0 من 0",
    paginate: {
      first: "الأول",
      last: "الأخير",
      next: "التالي",
      previous: "السابق",
    },
  },
};

export const DataTableDefaults = {
  paging: true,
  searching: false,
  lengthChange: true,
  ordering: true,
  processing: false,
  serverSide: false,
  deferRender: true,
  autoWidth: false,
  responsive: false,

  layout: {
    topStart: "pageLength",
    topEnd: "search",
    bottomStart: "info",
    bottomEnd: "paging",
  },
};

export const DataTablePresets = {
  minimal: {
    paging: false,
    searching: false,
    lengthChange: false,
    layout: {
      topStart: null,
      topEnd: null,
      bottomStart: null,
      bottomEnd: null,
    },
  },

  standard: {
    paging: true,
    searching: false,
    lengthChange: true,
    layout: {
      topStart: "pageLength",
      topEnd: null,
      bottomStart: "info",
      bottomEnd: "paging",
    },
  },

  searchable: {
    paging: true,
    searching: true,
    lengthChange: true,
    layout: {
      topStart: "pageLength",
      topEnd: "search",
      bottomStart: "info",
      bottomEnd: "paging",
    },
  },
};

export function getDataTableLanguage(locale) {
  const lang = locale || document.documentElement.lang || "en";
  return lang.startsWith("ar") ? DataTableI18n.ar : DataTableI18n.en;
}

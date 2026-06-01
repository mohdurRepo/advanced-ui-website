export const DataTablePlugins = {
  applyToConfig(config, features = {}) {
    if (features.fixedHeader) {
      config.fixedHeader = getFixedHeaderConfig(features.fixedHeader);
    }

    if (features.rowGroup) {
      config.rowGroup = features.rowGroup === true ? {} : features.rowGroup;
    }
  },

  applyToInstance(instance, features = {}) {
    if (features.fixedHeader) {
      setupFixedHeader(instance);
    }

    if (features.totals) {
      setupTotals(instance, features.totals);
    }

    if (features.feedPagination) {
      setupFeedPagination(instance, features.feedPagination);
    }
  },
};

export function getFixedHeaderConfig(options = true) {
  const headerOffset = window.innerWidth < 992 ? 70 : 80;

  if (options === true) {
    return {
      header: true,
      footer: false,
      headerOffset,
    };
  }

  return {
    header: true,
    footer: false,
    headerOffset,
    ...options,
  };
}

function setupFixedHeader(instance) {
  setTimeout(() => {
    instance.columns.adjust();

    if (instance.fixedHeader?.adjust) {
      instance.fixedHeader.adjust();
    }
  }, 0);

  window.addEventListener("resize", () => {
    if (instance.fixedHeader?.adjust) {
      instance.fixedHeader.adjust();
    }
  });
}

function setupTotals(instance, options = {}) {
  const columns = options.columns || [];

  if (!columns.length) return;

  instance.on("draw", () => {
    columns.forEach((columnIndex) => {
      const total = instance
        .column(columnIndex, {
          page: options.pageOnly ? "current" : "all",
        })
        .data()
        .reduce((sum, value) => {
          const number = Number.parseFloat(String(value).replace(/,/g, ""));
          return sum + (Number.isFinite(number) ? number : 0);
        }, 0);

      const footer = instance.column(columnIndex).footer();

      if (footer) {
        footer.textContent = total.toFixed(options.decimals ?? 2);
      }
    });
  });
}

function setupFeedPagination(instance, options = {}) {
  const container =
    typeof options.container === "string"
      ? document.querySelector(options.container)
      : options.container;

  if (!container) return;

  const range = container.querySelector("[data-feed-range]");
  const select = container.querySelector("[data-feed-page]");
  const totalPages = container.querySelector("[data-feed-total-pages]");
  const prevBtn = container.querySelector("[data-feed-prev]");
  const nextBtn = container.querySelector("[data-feed-next]");

  function getOfText() {
    const lang = options.locale || document.documentElement.lang || "en";
    return lang.startsWith("ar") ? "من" : "of";
  }

  function update() {
    const info = instance.page.info();

    if (!info) return;

    if (range) {
      range.textContent =
        info.recordsTotal === 0
          ? `0–0 ${getOfText()} 0`
          : `${info.start + 1}–${info.end} ${getOfText()} ${info.recordsTotal}`;
    }

    if (totalPages) {
      totalPages.textContent = info.pages || 1;
    }

    if (select) {
      const current = info.page;
      const pages = info.pages || 1;

      select.innerHTML = "";

      for (let index = 0; index < pages; index += 1) {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = String(index + 1);
        select.appendChild(option);
      }

      select.value = String(current);
    }

    if (prevBtn) {
      prevBtn.disabled = info.page <= 0;
    }

    if (nextBtn) {
      nextBtn.disabled = info.page >= info.pages - 1;
    }
  }

  select?.addEventListener("change", () => {
    const page = Number(select.value);

    if (!Number.isNaN(page)) {
      instance.page(page).draw("page");
    }
  });

  prevBtn?.addEventListener("click", () => {
    instance.page("previous").draw("page");
  });

  nextBtn?.addEventListener("click", () => {
    instance.page("next").draw("page");
  });

  instance.on("draw", update);
  instance.on("xhr", () => setTimeout(update, 0));

  update();
}

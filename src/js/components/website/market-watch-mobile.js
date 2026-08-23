/* ==========================================================================
   Market Watch Mobile Cards
   ========================================================================== */

/*
 * Mobile presentation only.
 *
 * It consumes the same:
 * - schema
 * - formatter output
 * - API rows
 *
 * as the desktop DataTable. It never initializes DataTables.
 */

const SKELETON_CARD_COUNT = 4;

function getContainer(root) {
  const container = root?.matches?.("[data-market-watch-cards]")
    ? root
    : root?.querySelector?.("[data-market-watch-cards]");

  if (!(container instanceof HTMLElement)) {
    throw new Error("Market Watch mobile cards container was not found.");
  }

  return container;
}

function getJQuery() {
  const $ = window.jQuery;

  if (!$) {
    throw new Error("Market Watch mobile cards require jQuery.");
  }

  return $;
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function appendRenderedHtml(parent, html) {
  const template = document.createElement("template");

  /*
   * Market Watch formatters escape API values before returning component HTML.
   */

  template.innerHTML = html;
  parent.append(template.content);
}

function getSecurityKey(row, index) {
  return String(
    row.companyRef ||
      row.companyCode ||
      row.companySymbol ||
      row.symbol ||
      `market-watch-card-${index}`,
  );
}

/* ==========================================================================
   Public API
   ========================================================================== */

export function createMarketWatchMobile(root, options = {}) {
  const container = getContainer(root);
  const $ = getJQuery();
  const $container = $(container);

  const schema = options.schema;
  const formatters = options.formatters;

  if (!schema || !formatters) {
    throw new Error("Market Watch mobile cards require schema and formatters.");
  }

  const labels = {
    noData: "No data available.",
    details: "View details",
    hideDetails: "Hide details",
    price: "Price",
    change: "Change",
    uncategorized: "Other",
    ...options.labels,
  };

  let activeViewId = schema.getView(
    options.initialViewId || schema.defaultViewId,
  ).id;

  let activeRows = [];
  let visibleGroups = new Set();
  let cardIndex = 0;

  function getColumns() {
    return schema.getColumns(activeViewId);
  }

  function isColumnVisible(column) {
    return !column.visibilityGroup || visibleGroups.has(column.visibilityGroup);
  }

  function getDetailColumns() {
    return getColumns().filter(
      (column) =>
        column.mobile && !column.mobilePrimary && isColumnVisible(column),
    );
  }

  function getSummaryColumns() {
    const columns = getColumns();

    return {
      price:
        columns.find((column) => column.key === "last-price") ||
        columns.find((column) => column.format === "price") ||
        null,

      change:
        columns.find((column) => column.key === "change-percent") ||
        columns.find((column) => column.format === "change") ||
        null,
    };
  }

  function groupRows(rows) {
    return rows.reduce((groups, row) => {
      const groupName = row[schema.rowGroupField] || labels.uncategorized;

      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }

      groups.get(groupName).push(row);

      return groups;
    }, new Map());
  }

  function createMetric(label, column, row, className) {
    const metric = createElement(
      "div",
      `market-watch-card__metric ${className}`,
    );
    const metricLabel = createElement(
      "span",
      "market-watch-card__metric-label",
      label,
    );
    const metricValue = createElement(
      "span",
      "market-watch-card__metric-value",
    );

    appendRenderedHtml(metricValue, formatters.renderCell(column, row));

    metric.append(metricLabel, metricValue);

    return metric;
  }

  function createCard(row) {
    const currentIndex = cardIndex;
    const securityKey = getSecurityKey(row, currentIndex);
    const detailsId = `market-watch-card-details-${currentIndex}`;

    cardIndex += 1;

    const card = createElement("article", "market-watch-card");
    const header = createElement("div", "market-watch-card__header");
    const identity = createElement("div", "market-watch-card__identity");
    const metrics = createElement("div", "market-watch-card__metrics");
    const actions = createElement("div", "market-watch-card__actions");
    const details = createElement("div", "market-watch-card__details");
    const fields = createElement("dl", "market-watch-card__details-grid");

    const securityColumn = getColumns().find(
      (column) => column.key === "security",
    );

    if (securityColumn) {
      appendRenderedHtml(identity, formatters.renderCell(securityColumn, row));
    }

    const summaryColumns = getSummaryColumns();

    if (summaryColumns.price) {
      metrics.append(
        createMetric(
          labels.price,
          summaryColumns.price,
          row,
          "market-watch-card__metric--price",
        ),
      );
    }

    if (summaryColumns.change) {
      metrics.append(
        createMetric(
          labels.change,
          summaryColumns.change,
          row,
          "market-watch-card__metric--change",
        ),
      );
    }

    const toggle = createElement(
      "button",
      "btn btn-outline-primary market-watch-card__toggle",
      labels.details,
    );

    toggle.type = "button";
    toggle.setAttribute("aria-controls", detailsId);
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("data-market-watch-card-toggle", "");

    actions.append(toggle);

    getDetailColumns().forEach((column) => {
      /*
       * Price and change already appear in the card summary. Keep detail
       * fields concise by excluding them from the expanded grid.
       */

      if (
        column.key === summaryColumns.price?.key ||
        column.key === summaryColumns.change?.key
      ) {
        return;
      }

      const field = createElement("div", "market-watch-card__field");
      const term = createElement(
        "dt",
        "market-watch-card__field-label",
        column.label,
      );
      const description = createElement("dd", "market-watch-card__field-value");

      appendRenderedHtml(description, formatters.renderCell(column, row));

      field.append(term, description);
      fields.append(field);
    });

    details.id = detailsId;
    details.hidden = true;
    details.append(fields);

    header.append(identity, metrics, actions);

    card.dataset.marketWatchSecurity = securityKey;
    card.append(header, details);

    return card;
  }

  function renderLoading() {
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < SKELETON_CARD_COUNT; index += 1) {
      const card = createElement(
        "article",
        "market-watch-card market-watch-card--loading",
      );

      card.setAttribute("aria-hidden", "true");
      card.innerHTML = `
        <div class="market-watch-card__header">
          <div class="market-watch-card__identity">
            <span class="table-skeleton table-skeleton-sm"></span>
            <span class="table-skeleton table-skeleton-lg"></span>
          </div>

          <div class="market-watch-card__metrics">
            <span class="table-skeleton table-skeleton-sm"></span>
            <span class="table-skeleton table-skeleton-sm"></span>
          </div>
        </div>
      `;

      fragment.append(card);
    }

    container.replaceChildren(fragment);
  }

  function renderEmpty(message) {
    const empty = createElement(
      "p",
      "market-watch-cards__empty",
      message || labels.noData,
    );

    container.replaceChildren(empty);
  }

  function renderRows() {
    if (!activeRows.length) {
      renderEmpty(labels.noData);

      return;
    }

    cardIndex = 0;

    const fragment = document.createDocumentFragment();

    groupRows(activeRows).forEach((rows, groupName) => {
      const group = createElement("section", "market-watch-card-group");
      const title = createElement(
        "h3",
        "market-watch-card-group__title",
        groupName,
      );
      const list = createElement("div", "market-watch-card-group__list");

      rows.forEach((row) => {
        list.append(createCard(row));
      });

      group.append(title, list);
      fragment.append(group);
    });

    container.replaceChildren(fragment);
  }

  function setRows(rows = []) {
    activeRows = Array.isArray(rows) ? rows : [];
    renderRows();
  }

  function showLoading() {
    activeRows = [];
    renderLoading();
  }

  function showEmpty(message) {
    activeRows = [];
    renderEmpty(message);
  }

  function setView(viewId) {
    activeViewId = schema.getView(viewId).id;
    renderRows();
  }

  function setVisibleGroups(groups = []) {
    visibleGroups = new Set(groups);
    renderRows();
  }

  function handleCardToggle(event) {
    const button = event.currentTarget;
    const card = button.closest(".market-watch-card");
    const details = document.getElementById(
      button.getAttribute("aria-controls"),
    );

    if (!card || !details) {
      return;
    }

    const isExpanded = button.getAttribute("aria-expanded") === "true";

    button.setAttribute("aria-expanded", String(!isExpanded));
    button.textContent = isExpanded ? labels.details : labels.hideDetails;

    details.hidden = isExpanded;
    card.classList.toggle("is-expanded", !isExpanded);
  }

  function destroy() {
    $container.off(".marketWatchMobile");
    container.replaceChildren();
  }

  $container.on(
    "click.marketWatchMobile",
    "[data-market-watch-card-toggle]",
    handleCardToggle,
  );

  return Object.freeze({
    setRows,
    setView,
    setVisibleGroups,

    showLoading,
    showEmpty,

    destroy,
  });
}

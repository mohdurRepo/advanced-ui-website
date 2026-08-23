/* ==========================================================================
   Market Watch Mobile Cards
   ========================================================================== */

/*
 * Renders the mobile presentation from the same rows and schema used by the
 * desktop DataTable.
 *
 * It does not:
 * - fetch data
 * - initialize DataTables
 * - manage breakpoints
 * - manage filters
 */

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

function getSecurityKey(row, index) {
  return String(
    row.companyRef ||
      row.companySymbol ||
      row.symbol ||
      `market-watch-card-${index}`,
  );
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
   * `renderCell()` outputs escaped API values and controlled component markup.
   */

  template.innerHTML = html;
  parent.append(template.content);
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
  const labels = {
    noData: "No data available.",
    details: "View details",
    hideDetails: "Hide details",
    uncategorized: "Other",
    ...options.labels,
  };

  if (!schema || !formatters) {
    throw new Error("Market Watch mobile cards require schema and formatters.");
  }

  let activeViewId = options.initialViewId || schema.defaultViewId;
  let activeRows = [];

  function getColumns() {
    return schema.getColumns(activeViewId);
  }

  function getMobileColumns() {
    return getColumns().filter(
      (column) => column.mobile && !column.mobilePrimary,
    );
  }

  function groupRows(rows) {
    return rows.reduce((groups, row) => {
      const name = row[schema.rowGroupField] || labels.uncategorized;

      if (!groups.has(name)) {
        groups.set(name, []);
      }

      groups.get(name).push(row);

      return groups;
    }, new Map());
  }

  function getSummaryColumns() {
    const columns = getColumns();

    return {
      price: columns.find((column) => column.key === "last-price"),
      change: columns.find((column) => column.key === "change-percent"),
    };
  }

  function createCard(row, index) {
    const key = getSecurityKey(row, index);
    const detailsId = `market-watch-card-details-${index}`;
    const card = createElement("article", "market-watch-card");
    const header = createElement("div", "market-watch-card__header");
    const identity = createElement("div", "market-watch-card__identity");
    const summary = createElement("div", "market-watch-card__summary");
    const actions = createElement("div", "market-watch-card__actions");
    const details = createElement("div", "market-watch-card__details");
    const grid = createElement("dl", "market-watch-card__details-grid");

    const securityColumn = getColumns().find(
      (column) => column.key === "security",
    );

    if (securityColumn) {
      appendRenderedHtml(identity, formatters.renderCell(securityColumn, row));
    }

    const summaryColumns = getSummaryColumns();

    if (summaryColumns.price) {
      const price = createElement("span", "market-watch-card__price");

      appendRenderedHtml(
        price,
        formatters.renderCell(summaryColumns.price, row),
      );

      summary.append(price);
    }

    if (summaryColumns.change) {
      const change = createElement("span", "market-watch-card__change");

      appendRenderedHtml(
        change,
        formatters.renderCell(summaryColumns.change, row),
      );

      summary.append(change);
    }

    const toggle = createElement(
      "button",
      "btn btn-outline-primary market-watch-card__toggle",
      labels.details,
    );

    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", detailsId);
    toggle.setAttribute("data-market-watch-card-toggle", "");

    actions.append(toggle);

    header.append(identity, summary, actions);

    details.id = detailsId;
    details.hidden = true;

    getMobileColumns().forEach((column) => {
      const field = createElement("div", "market-watch-card__field");
      const term = createElement(
        "dt",
        "market-watch-card__field-label",
        column.label,
      );
      const description = createElement("dd", "market-watch-card__field-value");

      appendRenderedHtml(description, formatters.renderCell(column, row));

      field.append(term, description);
      grid.append(field);
    });

    details.append(grid);

    card.dataset.marketWatchSecurity = key;
    card.append(header, details);

    return card;
  }

  function renderEmptyState() {
    const empty = createElement(
      "p",
      "market-watch-cards__empty",
      labels.noData,
    );

    container.replaceChildren(empty);
  }

  function render() {
    if (!activeRows.length) {
      renderEmptyState();

      return;
    }

    const fragment = document.createDocumentFragment();
    let cardIndex = 0;

    groupRows(activeRows).forEach((rows, groupName) => {
      const group = createElement("section", "market-watch-card-group");
      const heading = createElement(
        "h3",
        "market-watch-card-group__title",
        groupName,
      );
      const list = createElement("div", "market-watch-card-group__list");

      rows.forEach((row) => {
        list.append(createCard(row, cardIndex));
        cardIndex += 1;
      });

      group.append(heading, list);
      fragment.append(group);
    });

    container.replaceChildren(fragment);
  }

  function setRows(rows = []) {
    activeRows = Array.isArray(rows) ? rows : [];
    render();
  }

  function setView(viewId) {
    activeViewId = schema.getView(viewId).id;
    render();
  }

  function handleCardToggle(event) {
    const button = event.currentTarget;
    const card = button.closest(".market-watch-card");
    const detailsId = button.getAttribute("aria-controls");
    const details = document.getElementById(detailsId);

    if (!card || !details) {
      return;
    }

    const isOpen = button.getAttribute("aria-expanded") === "true";

    button.setAttribute("aria-expanded", String(!isOpen));
    button.textContent = isOpen ? labels.details : labels.hideDetails;

    details.hidden = isOpen;
    card.classList.toggle("is-expanded", !isOpen);
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

  render();

  return Object.freeze({
    setRows,
    setView,
    render,
    destroy,
  });
}

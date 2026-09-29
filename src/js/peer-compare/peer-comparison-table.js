(function (window, document) {
  "use strict";
 
  const U = window.PeerComparisonUtils;
 
  function renderSummaryHeader(rows, selectedCompanies) {
    const head = document.querySelector("[data-peer-summary-head]");
    if (!head) return;
 
    const headerItems = getHeaderItems(selectedCompanies);
 
    head.innerHTML = `
      <tr>
        <th>${window.peer_metric}</th>
 
        ${headerItems.map(function (item) {
          return `
            <th>
              <span class="peer-table-head">
                <span>${item.name || "-"}</span>
 
                ${item.isBase ? "" : `
                  <button
                    type="button"
                    class="peer-remove-btn peer-remove-btn--sm"
                    aria-label="Remove ${item.name || ""}"
                    title="Remove"
                    data-peer-remove="${item.code}"
                  >
                    ×
                  </button>
                `}
              </span>
            </th>
          `;
        }).join("")}
      </tr>
    `;
  }
 
  function renderSummaryTable(rows, selectedCompanies) {
    const body = document.querySelector("[data-peer-summary-body]");
    const labels = U.getLabels();
 
    if (!body) return;
 
    const headerItems = getHeaderItems(selectedCompanies);
 
    if (!rows.length) {
      body.innerHTML = `
        <tr>
          <td colspan="${headerItems.length + 1}">
            ${labels.noData || "No data available."}
          </td>
        </tr>
      `;
      return;
    }
 
    const marketCapLabel = `
      <span style="flex-direction: row; white-space: nowrap;">
        ${labels.marketCap || "Market Cap"}
        &nbsp;(<span class="sar-symbol">^</span>&nbsp;${labels.marketCapMillion || "Million"})
      </span>
    `;
 
    body.innerHTML = `
      <tr>
        <td>${labels.sharePrice || "Share Price"}</td>
 
        ${headerItems.map(function (company) {
          const item = U.findRowBySymbol(rows, company.code);
 
          return `
            <td>
              <span class="price">
                ${U.formatNumber(item && item.sharePrice)}
              </span>
            </td>
          `;
        }).join("")}
      </tr>
 
      <tr>
        <td>${marketCapLabel}</td>
 
        ${headerItems.map(function (company) {
          const item = U.findRowBySymbol(rows, company.code);
 
          return `
            <td>
              <span class="price">
                ${U.formatNumber(item && item.marketCap, 0)}
              </span>
            </td>
          `;
        }).join("")}
      </tr>
 
      <tr>
        <td>${labels.peRatio || "P/E Ratio"}</td>
 
        ${headerItems.map(function (company) {
          const item = U.findRowBySymbol(rows, company.code);
 
          return `
            <td>
              <span class="price">
                ${U.formatNumber(item && item.peRatio, 5)}
              </span>
            </td>
          `;
        }).join("")}
      </tr>
    `;
  }
 
  function renderTableError(selectedCompanies) {
    const body = document.querySelector("[data-peer-summary-body]");
    const labels = U.getLabels();
    const headerItems = getHeaderItems(selectedCompanies);
 
    if (!body) return;
 
    body.innerHTML = `
      <tr>
        <td colspan="${headerItems.length + 1}">
          ${labels.error || "Unable to load peer comparison data."}
        </td>
      </tr>
    `;
  }
 
  function getHeaderItems(selectedCompanies) {
    return [
      {
        code: U.getBaseCompanySymbol(),
        name: U.getBaseCompanyName(),
        isBase: true
      }
    ].concat(
      (selectedCompanies || []).map(function (company) {
        return {
          code: company.code,
          name: company.name,
          isBase: false
        };
      })
    );
  }
 
  window.PeerComparisonTable = {
    renderSummaryHeader,
    renderSummaryTable,
    renderTableError,
    getHeaderItems
  };
})(window, document);
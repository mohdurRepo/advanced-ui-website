export function showTableLoader(element) {
  const tbody = element.querySelector("tbody");

  if (!tbody) return;

  tbody.innerHTML = `
    <tr class="datatable-loader-row">
      <td colspan="100">
        <div class="datatable-loader">
          <div class="datatable-spinner"></div>
          <span>Loading data...</span>
        </div>
      </td>
    </tr>
  `;
}

export function hideTableLoader(element) {
  element
    .querySelectorAll(".datatable-loader-row")
    .forEach((row) => row.remove());
}

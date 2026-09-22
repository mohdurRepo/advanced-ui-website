function updateCompanyIndicator(link, status) {
  if (!link) {
    return;
  }

  const className = getCompanyIndicatorClass(status);
  let indicator = link.querySelector(".market-movers__indicator");

  if (!className) {
    indicator?.remove();
    return;
  }

  if (!indicator) {
    indicator = document.createElement("span");
    indicator.className = "market-movers__indicator";
    indicator.setAttribute("aria-hidden", "true");
    link.append(indicator);
  }

  indicator.classList.remove(...COMPANY_INDICATOR_CLASSES);
  indicator.classList.add(className);
}

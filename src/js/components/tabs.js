document.addEventListener("click", (event) => {
  const tabButton = event.target.closest("[data-tab-target]");

  if (!tabButton) return;

  const container = tabButton.closest(".tabs");
  const target = tabButton.dataset.tabTarget;

  if (!container || !target) return;

  container.querySelectorAll(".tab-link").forEach((tab) => {
    tab.classList.remove("active");
    tab.setAttribute("aria-selected", "false");
  });

  container.querySelectorAll(".tab-pane").forEach((pane) => {
    pane.classList.remove("active");
    pane.hidden = true;
  });

  tabButton.classList.add("active");
  tabButton.setAttribute("aria-selected", "true");

  const targetPane = container.querySelector(`#${target}`);

  if (targetPane) {
    targetPane.classList.add("active");
    targetPane.hidden = false;
  }
});

document.addEventListener("click", (event) => {
  const tabButton = event.target.closest("[data-tab-target]");

  if (!tabButton) return;

  const container = tabButton.closest(".tabs");

  const target = tabButton.dataset.tabTarget;

  container
    .querySelectorAll(".tab-link")
    .forEach((tab) => tab.classList.remove("active"));

  container
    .querySelectorAll(".tab-pane")
    .forEach((pane) => pane.classList.remove("active"));

  tabButton.classList.add("active");

  container.querySelector(`#${target}`)?.classList.add("active");
});

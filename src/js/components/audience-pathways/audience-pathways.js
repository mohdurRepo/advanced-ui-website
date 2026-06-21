export function initAudiencePathways() {
  document.querySelectorAll("[data-audience-pathways]").forEach((section) => {
    const links = section.querySelectorAll("[data-audience-pathway-link]");

    links.forEach((link) => {
      link.addEventListener("click", (event) => {
        links.forEach((item) => {
          item.classList.remove("is-active");
          item.removeAttribute("aria-current");
        });

        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");
      });
    });
  });
}

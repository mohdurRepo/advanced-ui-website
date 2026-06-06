const CARD_SELECTOR = "[data-market-card]";

function setActiveCard(card) {
  const summary = card.closest(".market-summary");

  if (!summary) return;

  summary.querySelectorAll(CARD_SELECTOR).forEach((item) => {
    const isActive = item === card;

    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-selected", String(isActive));
    item.setAttribute("tabindex", isActive ? "0" : "-1");
  });
}

function scrollCardIntoView(card) {
  card.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "nearest",
  });
}

export function initMarketCards() {
  document.addEventListener("click", (event) => {
    const card = event.target.closest(CARD_SELECTOR);

    if (!card) return;

    setActiveCard(card);
    scrollCardIntoView(card);
  });

  document.addEventListener("keydown", (event) => {
    const card = event.target.closest(CARD_SELECTOR);

    if (!card) return;

    const summary = card.closest(".market-summary");
    const cards = Array.from(summary?.querySelectorAll(CARD_SELECTOR) || []);

    if (!cards.length) return;

    const currentIndex = cards.indexOf(card);

    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex =
        document.documentElement.dir === "rtl"
          ? currentIndex - 1
          : currentIndex + 1;
    }

    if (event.key === "ArrowLeft") {
      nextIndex =
        document.documentElement.dir === "rtl"
          ? currentIndex + 1
          : currentIndex - 1;
    }

    if (event.key === "Home") {
      nextIndex = 0;
    }

    if (event.key === "End") {
      nextIndex = cards.length - 1;
    }

    if (nextIndex === currentIndex) return;

    const nextCard = cards[Math.max(0, Math.min(cards.length - 1, nextIndex))];

    event.preventDefault();

    nextCard.focus();
    setActiveCard(nextCard);
    scrollCardIntoView(nextCard);
  });
}

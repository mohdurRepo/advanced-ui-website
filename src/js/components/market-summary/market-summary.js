const CARD_SELECTOR = "[data-market-card]";
const RETURN_ARROW_SELECTOR = "[data-market-return-arrow]";

function getActiveCard(summary = document) {
  return summary.querySelector(`${CARD_SELECTOR}.is-active`);
}

function getReturnArrow(card) {
  return card?.closest(".market-summary")?.querySelector(RETURN_ARROW_SELECTOR);
}

function updateReturnArrow(card = getActiveCard()) {
  const returnArrow = getReturnArrow(card);

  if (!card || !returnArrow) return;

  const scroller = card.closest(".market-summary__cards");

  if (!scroller) return;

  const isRTL = getComputedStyle(scroller).direction === "rtl";

  const cardRect = card.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();

  const isBeforeView = cardRect.left < scrollerRect.left;
  const isAfterView = cardRect.right > scrollerRect.right;

  returnArrow.classList.remove("is-visible", "is-start", "is-end");

  if (!isBeforeView && !isAfterView) return;

  const directionClass = isRTL
    ? isBeforeView
      ? "is-end"
      : "is-start"
    : isBeforeView
      ? "is-start"
      : "is-end";

  const label = isBeforeView
    ? "Scroll back to selected market"
    : "Scroll forward to selected market";

  returnArrow.classList.add("is-visible", directionClass);
  returnArrow.setAttribute("aria-label", label);
}

function requestReturnArrowUpdate(card = getActiveCard()) {
  window.requestAnimationFrame(() => {
    updateReturnArrow(card);
  });
}

function setActiveCard(card) {
  const summary = card.closest(".market-summary");

  if (!summary) return;

  summary.querySelectorAll(CARD_SELECTOR).forEach((item) => {
    const isActive = item === card;

    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-selected", String(isActive));
    item.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  requestReturnArrowUpdate(card);

  document.dispatchEvent(
    new CustomEvent("market:change", {
      detail: {
        card,
        panelId: card.getAttribute("aria-controls"),
        market: card.dataset.market,
      },
    }),
  );
}

function scrollCardIntoView(card, inline = "nearest") {
  card.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline,
  });
}

function scrollToActiveCard(event) {
  const summary = event.currentTarget.closest(".market-summary");
  const card = getActiveCard(summary);

  if (!card) return;

  scrollCardIntoView(card, "center");
  requestReturnArrowUpdate(card);
}

export function initMarketCards() {
  document.querySelectorAll(".market-summary").forEach((summary) => {
    const scroller = summary.querySelector(".market-summary__cards");
    const returnArrow = summary.querySelector(RETURN_ARROW_SELECTOR);

    requestReturnArrowUpdate(getActiveCard(summary));

    scroller?.addEventListener(
      "scroll",
      () => requestReturnArrowUpdate(getActiveCard(summary)),
      { passive: true },
    );

    returnArrow?.addEventListener("click", scrollToActiveCard);
  });

  window.addEventListener("load", () => {
    document.querySelectorAll(".market-summary").forEach((summary) => {
      requestReturnArrowUpdate(getActiveCard(summary));
    });
  });

  window.addEventListener("resize", () => {
    document.querySelectorAll(".market-summary").forEach((summary) => {
      requestReturnArrowUpdate(getActiveCard(summary));
    });
  });

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

    const isRTL = document.documentElement.dir === "rtl";
    const currentIndex = cards.indexOf(card);

    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = isRTL ? currentIndex - 1 : currentIndex + 1;
    }

    if (event.key === "ArrowLeft") {
      nextIndex = isRTL ? currentIndex + 1 : currentIndex - 1;
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

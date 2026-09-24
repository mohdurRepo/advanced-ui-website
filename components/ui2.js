const MARKET_STATUS_CODE_CLASSES = {
  0: "market-status--closed",
  1: "market-status--pre-open",
  2: "market-status--open",
  3: "market-status--closed",
  4: "market-status--closed",
  6: "market-status--pre-open",
  9: "market-status--pre-open",
  10: "market-status--auction",
};
function updateCardStatusCode(card, statusCode) {
  if (
    !card ||
    statusCode === null ||
    statusCode === undefined ||
    statusCode === ""
  ) {
    return;
  }

  const code = String(statusCode);
  const statusElement = getCardParts(card).status;
  const className = MARKET_STATUS_CODE_CLASSES[code];

  card.dataset.marketStatusCode = code;

  if (!statusElement || !className) {
    return;
  }

  statusElement.classList.remove(...MARKET_STATUS_CLASSES);
  statusElement.classList.add(className);
}
if (parts.statusLabel) {
  const explicitLabel = getExplicitStatusLabel(timingItem);

  if (explicitLabel) {
    common.setText(parts.statusLabel, explicitLabel);
  } else {
    common.setText(parts.statusLabel, presentation.label);
  }
}
////
if (parts.status) {
  parts.status.classList.remove(...MARKET_STATUS_CLASSES);

  parts.status.classList.add(presentation.className);
}

/* ==========================================================================
   Tooltip
   ========================================================================== */

(() => {
  "use strict";

  /* ==========================================================================
     Constants
     ========================================================================== */

  const SELECTORS = Object.freeze({
    root: ".tooltip",
    content: ":scope > .tooltip__content",
  });

  const CLASSES = Object.freeze({
    open: "is-open",
  });

  const PLACEMENTS = Object.freeze(["top", "bottom", "start", "end"]);

  const VIEWPORT_PADDING = 8;

  const initializedTooltips = new WeakSet();

  let started = false;
  let activeTooltip = null;
  let animationFrame = null;

  /* ==========================================================================
     General Helpers
     ========================================================================== */

  function isElement(value) {
    return value instanceof HTMLElement;
  }

  function getTooltipContent(root) {
    if (!isElement(root)) {
      return null;
    }

    const content = root.querySelector(SELECTORS.content);

    return isElement(content) ? content : null;
  }

  function getTrigger(root) {
    if (!isElement(root)) {
      return null;
    }

    return (
      Array.from(root.children).find(
        (child) =>
          child instanceof HTMLElement &&
          !child.classList.contains("tooltip__content"),
      ) || null
    );
  }

  function isRtl(root) {
    return getComputedStyle(root).direction === "rtl";
  }

  function getPreferredPlacement(root) {
    const requested = String(root.dataset.tooltipPreferred ?? "top")
      .trim()
      .toLowerCase();

    return PLACEMENTS.includes(requested) ? requested : "top";
  }

  function getOffset(root) {
    const value = getComputedStyle(root)
      .getPropertyValue("--tooltip-offset")
      .trim();

    const numeric = Number.parseFloat(value);

    return Number.isFinite(numeric) ? numeric : 12;
  }

  /* ==========================================================================
     Logical Placement Resolution
     ========================================================================== */

  function getPhysicalPlacement(logicalPlacement, rtl) {
    if (logicalPlacement === "start") {
      return rtl ? "right" : "left";
    }

    if (logicalPlacement === "end") {
      return rtl ? "left" : "right";
    }

    return logicalPlacement;
  }

  function getLogicalPlacement(physicalPlacement, rtl) {
    if (physicalPlacement === "left") {
      return rtl ? "end" : "start";
    }

    if (physicalPlacement === "right") {
      return rtl ? "start" : "end";
    }

    return physicalPlacement;
  }

  /* ==========================================================================
     Placement Measurement
     ========================================================================== */

  function getAvailableSpace(triggerRect) {
    return {
      top: triggerRect.top - VIEWPORT_PADDING,

      bottom: window.innerHeight - triggerRect.bottom - VIEWPORT_PADDING,

      left: triggerRect.left - VIEWPORT_PADDING,

      right: window.innerWidth - triggerRect.right - VIEWPORT_PADDING,
    };
  }

  function getRequiredSpace(physicalPlacement, tooltipRect, offset) {
    if (physicalPlacement === "top" || physicalPlacement === "bottom") {
      return tooltipRect.height + offset;
    }

    return tooltipRect.width + offset;
  }

  function getOppositePlacement(physicalPlacement) {
    switch (physicalPlacement) {
      case "top":
        return "bottom";

      case "bottom":
        return "top";

      case "left":
        return "right";

      case "right":
        return "left";

      default:
        return "top";
    }
  }

  function resolvePlacement(
    preferredPhysical,
    triggerRect,
    tooltipRect,
    offset,
  ) {
    const available = getAvailableSpace(triggerRect);

    const required = getRequiredSpace(preferredPhysical, tooltipRect, offset);

    if (available[preferredPhysical] >= required) {
      return preferredPhysical;
    }

    const opposite = getOppositePlacement(preferredPhysical);

    const oppositeRequired = getRequiredSpace(opposite, tooltipRect, offset);

    if (available[opposite] >= oppositeRequired) {
      return opposite;
    }

    /*
     * Neither preferred nor opposite fully fits.
     *
     * Choose whichever side provides more space.
     */
    return available[preferredPhysical] >= available[opposite]
      ? preferredPhysical
      : opposite;
  }

  /* ==========================================================================
     Coordinates
     ========================================================================== */

  function getCoordinates({
    physicalPlacement,
    triggerRect,
    tooltipRect,
    offset,
  }) {
    let x = 0;
    let y = 0;

    switch (physicalPlacement) {
      case "top":
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;

        y = triggerRect.top - tooltipRect.height - offset;
        break;

      case "bottom":
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;

        y = triggerRect.bottom + offset;
        break;

      case "left":
        x = triggerRect.left - tooltipRect.width - offset;

        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;

      case "right":
        x = triggerRect.right + offset;

        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;

      default:
        break;
    }

    return { x, y };
  }

  function clampValue(value, min, max) {
    if (max < min) {
      return min;
    }

    return Math.min(Math.max(value, min), max);
  }

  function clampCoordinates(coordinates, tooltipRect) {
    const maxX = window.innerWidth - tooltipRect.width - VIEWPORT_PADDING;

    const maxY = window.innerHeight - tooltipRect.height - VIEWPORT_PADDING;

    return {
      x: clampValue(coordinates.x, VIEWPORT_PADDING, maxX),

      y: clampValue(coordinates.y, VIEWPORT_PADDING, maxY),
    };
  }

  /* ==========================================================================
     Arrow Position
     ========================================================================== */

  function updateArrowPosition({
    root,
    physicalPlacement,
    triggerRect,
    tooltipRect,
    coordinates,
  }) {
    if (physicalPlacement === "top" || physicalPlacement === "bottom") {
      const triggerCenter = triggerRect.left + triggerRect.width / 2;

      const arrowX = triggerCenter - coordinates.x;

      const clampedArrowX = clampValue(arrowX, 12, tooltipRect.width - 12);

      root.style.setProperty("--tooltip-arrow-x", `${clampedArrowX}px`);

      root.style.removeProperty("--tooltip-arrow-y");

      return;
    }

    const triggerCenter = triggerRect.top + triggerRect.height / 2;

    const arrowY = triggerCenter - coordinates.y;

    const clampedArrowY = clampValue(arrowY, 12, tooltipRect.height - 12);

    root.style.setProperty("--tooltip-arrow-y", `${clampedArrowY}px`);

    root.style.removeProperty("--tooltip-arrow-x");
  }

  /* ==========================================================================
     Positioning
     ========================================================================== */

  function positionTooltip(root) {
    if (!isElement(root)) {
      return;
    }

    const content = getTooltipContent(root);

    const trigger = getTrigger(root);

    if (!content || !trigger || !root.classList.contains(CLASSES.open)) {
      return;
    }

    const rtl = isRtl(root);

    const preferredLogical = getPreferredPlacement(root);

    const preferredPhysical = getPhysicalPlacement(preferredLogical, rtl);

    const offset = getOffset(root);

    /*
     * Ensure the tooltip is measurable.
     */
    content.style.visibility = "hidden";
    content.style.opacity = "0";

    root.style.setProperty("--tooltip-x", "0px");

    root.style.setProperty("--tooltip-y", "0px");

    const triggerRect = trigger.getBoundingClientRect();

    const tooltipRect = content.getBoundingClientRect();

    const resolvedPhysical = resolvePlacement(
      preferredPhysical,
      triggerRect,
      tooltipRect,
      offset,
    );

    const rawCoordinates = getCoordinates({
      physicalPlacement: resolvedPhysical,

      triggerRect,
      tooltipRect,
      offset,
    });

    const coordinates = clampCoordinates(rawCoordinates, tooltipRect);

    const resolvedLogical = getLogicalPlacement(resolvedPhysical, rtl);

    root.dataset.tooltipPlacement = resolvedLogical;

    root.style.setProperty("--tooltip-x", `${Math.round(coordinates.x)}px`);

    root.style.setProperty("--tooltip-y", `${Math.round(coordinates.y)}px`);

    updateArrowPosition({
      root,
      physicalPlacement: resolvedPhysical,
      triggerRect,
      tooltipRect,
      coordinates,
    });

    content.style.removeProperty("visibility");

    content.style.removeProperty("opacity");
  }

  function schedulePosition(root) {
    if (!isElement(root)) {
      return;
    }

    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
    }

    animationFrame = requestAnimationFrame(() => {
      animationFrame = null;

      positionTooltip(root);
    });
  }

  /* ==========================================================================
     Open / Close
     ========================================================================== */

  function openTooltip(root) {
    if (!isElement(root)) {
      return;
    }

    const content = getTooltipContent(root);

    if (!content || content.textContent.trim() === "") {
      return;
    }

    if (activeTooltip && activeTooltip !== root) {
      closeTooltip(activeTooltip);
    }

    activeTooltip = root;

    root.classList.add(CLASSES.open);

    schedulePosition(root);
  }

  function closeTooltip(root) {
    if (!isElement(root)) {
      return;
    }

    root.classList.remove(CLASSES.open);

    root.removeAttribute("data-tooltip-placement");

    root.style.removeProperty("--tooltip-x");

    root.style.removeProperty("--tooltip-y");

    root.style.removeProperty("--tooltip-arrow-x");

    root.style.removeProperty("--tooltip-arrow-y");

    if (activeTooltip === root) {
      activeTooltip = null;
    }
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */

  function initializeTooltip(root) {
    if (!isElement(root) || initializedTooltips.has(root)) {
      return false;
    }

    const content = getTooltipContent(root);

    const trigger = getTrigger(root);

    if (!content || !trigger) {
      return false;
    }

    initializedTooltips.add(root);

    /*
     * Keep tooltip content hidden from normal interaction.
     */
    content.setAttribute("role", "tooltip");

    /*
     * Connect the trigger to the tooltip when markup does not already do so.
     */
    if (!content.id) {
      content.id = `tooltip-${
        crypto.randomUUID?.() || Math.random().toString(36).slice(2)
      }`;
    }

    if (!trigger.hasAttribute("aria-describedby")) {
      trigger.setAttribute("aria-describedby", content.id);
    }

    return true;
  }

  function initializeAllTooltips(scope = document) {
    if (!scope) {
      return;
    }

    if (isElement(scope) && scope.matches(SELECTORS.root)) {
      initializeTooltip(scope);
    }

    if (typeof scope.querySelectorAll !== "function") {
      return;
    }

    scope.querySelectorAll(SELECTORS.root).forEach((root) => {
      initializeTooltip(root);
    });
  }

  /* ==========================================================================
     Event Ownership
     ========================================================================== */

  function getOwningTooltip(target) {
    if (!(target instanceof Element)) {
      return null;
    }

    const root = target.closest(SELECTORS.root);

    return isElement(root) ? root : null;
  }

  /* ==========================================================================
     Pointer Interaction
     ========================================================================== */

  function handlePointerOver(event) {
    const root = getOwningTooltip(event.target);

    if (!root) {
      return;
    }

    const from = event.relatedTarget;

    if (from instanceof Node && root.contains(from)) {
      return;
    }

    openTooltip(root);
  }

  function handlePointerOut(event) {
    const root = getOwningTooltip(event.target);

    if (!root) {
      return;
    }

    const to = event.relatedTarget;

    if (to instanceof Node && root.contains(to)) {
      return;
    }

    closeTooltip(root);
  }

  /* ==========================================================================
     Focus Interaction
     ========================================================================== */

  function handleFocusIn(event) {
    const root = getOwningTooltip(event.target);

    if (!root) {
      return;
    }

    openTooltip(root);
  }

  function handleFocusOut(event) {
    const root = getOwningTooltip(event.target);

    if (!root) {
      return;
    }

    const next = event.relatedTarget;

    if (next instanceof Node && root.contains(next)) {
      return;
    }

    closeTooltip(root);
  }

  /* ==========================================================================
     Keyboard
     ========================================================================== */

  function handleKeydown(event) {
    if (event.key !== "Escape") {
      return;
    }

    if (!activeTooltip) {
      return;
    }

    closeTooltip(activeTooltip);
  }

  /* ==========================================================================
     Viewport Updates
     ========================================================================== */

  function handleViewportChange() {
    if (!activeTooltip) {
      return;
    }

    schedulePosition(activeTooltip);
  }

  /* ==========================================================================
     Dynamic Content
     ========================================================================== */

  function initializeAddedNode(node) {
    if (!isElement(node)) {
      return;
    }

    initializeAllTooltips(node);
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(initializeAddedNode);
    });
  });

  /* ==========================================================================
     Startup
     ========================================================================== */

  function startTooltips() {
    if (started) {
      return;
    }

    started = true;

    initializeAllTooltips();

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    document.addEventListener("pointerover", handlePointerOver);

    document.addEventListener("pointerout", handlePointerOut);

    document.addEventListener("focusin", handleFocusIn);

    document.addEventListener("focusout", handleFocusOut);

    document.addEventListener("keydown", handleKeydown);

    window.addEventListener("resize", handleViewportChange, {
      passive: true,
    });

    window.addEventListener("scroll", handleViewportChange, {
      passive: true,
      capture: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startTooltips, {
      once: true,
    });
  } else {
    startTooltips();
  }
})();

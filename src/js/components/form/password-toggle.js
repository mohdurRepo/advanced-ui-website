/* ==========================================================================
   Configuration
   ========================================================================== */

const SELECTOR = "[data-password-toggle]";

const MESSAGES = {
  en: {
    show: "Show",
    hide: "Hide",
    showAccessible: "Show password",
    hideAccessible: "Hide password",
  },
  ar: {
    show: "إظهار",
    hide: "إخفاء",
    showAccessible: "إظهار كلمة المرور",
    hideAccessible: "إخفاء كلمة المرور",
  },
};

const initializedToggles = new WeakSet();

/* ==========================================================================
   Element Helpers
   ========================================================================== */

function getToggleElements(root) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return [];
  }

  const toggles = Array.from(root.querySelectorAll(SELECTOR));

  if (typeof root.matches === "function" && root.matches(SELECTOR)) {
    toggles.unshift(root);
  }

  return toggles;
}

function getControlledInput(toggle) {
  const targetId = toggle.getAttribute("aria-controls")?.trim().split(/\s+/)[0];

  if (!targetId) {
    return null;
  }

  const root = toggle.getRootNode();
  const input =
    typeof root.getElementById === "function"
      ? root.getElementById(targetId)
      : toggle.ownerDocument.getElementById(targetId);

  if (!input || input.tagName !== "INPUT") {
    return null;
  }

  const isPassword = input.type === "password";
  const isVisiblePassword =
    input.type === "text" && toggle.getAttribute("aria-pressed") === "true";

  return isPassword || isVisiblePassword ? input : null;
}

/* ==========================================================================
   Labels
   ========================================================================== */

function getLanguage(toggle) {
  const language =
    toggle.closest("[lang]")?.getAttribute("lang") ||
    toggle.ownerDocument.documentElement.lang ||
    "en";

  return language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

function getLabels(toggle) {
  const messages = MESSAGES[getLanguage(toggle)];

  return {
    show: toggle.dataset.passwordShowLabel || messages.show,
    hide: toggle.dataset.passwordHideLabel || messages.hide,
    showAccessible:
      toggle.dataset.passwordShowAriaLabel || messages.showAccessible,
    hideAccessible:
      toggle.dataset.passwordHideAriaLabel || messages.hideAccessible,
  };
}

function updateToggleLabel(toggle, visible) {
  const labels = getLabels(toggle);
  const visibleLabel = visible ? labels.hide : labels.show;
  const accessibleLabel = visible
    ? labels.hideAccessible
    : labels.showAccessible;

  const label = toggle.querySelector("[data-password-toggle-label]");

  if (label) {
    label.textContent = visibleLabel;
  } else if (!toggle.firstElementChild) {
    toggle.textContent = visibleLabel;
  }

  toggle.setAttribute("aria-label", accessibleLabel);
}

/* ==========================================================================
   Visibility
   ========================================================================== */

function setPasswordVisibility(toggle, input, visible) {
  input.type = visible ? "text" : "password";

  toggle.setAttribute("aria-pressed", String(visible));
  toggle.classList.toggle("is-active", visible);

  updateToggleLabel(toggle, visible);
}

/* ==========================================================================
   Initialization
   ========================================================================== */

function initializeToggle(toggle) {
  if (initializedToggles.has(toggle)) {
    return;
  }

  const input = getControlledInput(toggle);

  if (!input) {
    return;
  }

  initializedToggles.add(toggle);

  setPasswordVisibility(toggle, input, input.type === "text");

  toggle.addEventListener("click", (event) => {
    event.preventDefault();

    setPasswordVisibility(toggle, input, input.type === "password");
  });

  input.form?.addEventListener("reset", () => {
    setPasswordVisibility(toggle, input, false);
  });
}

/**
 * Initializes password-visibility controls within a document or component.
 *
 * Required markup:
 * - `data-password-toggle` on the button
 * - `aria-controls` referencing the password input ID
 *
 * Optional localized label overrides:
 * - `data-password-show-label`
 * - `data-password-hide-label`
 * - `data-password-show-aria-label`
 * - `data-password-hide-aria-label`
 *
 * @param {Document | Element | DocumentFragment} root
 */
export function initPasswordToggles(root = document) {
  getToggleElements(root).forEach(initializeToggle);
}

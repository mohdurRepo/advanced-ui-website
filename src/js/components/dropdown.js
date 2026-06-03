const DROPDOWN_SELECTOR = "[data-dropdown]";
const TOGGLE_SELECTOR = "[data-dropdown-toggle]";
const SEARCH_SELECTOR = "[data-dropdown-search]";
const ITEM_SELECTOR = "[data-dropdown-item]";
const VALUE_SELECTOR = "[data-dropdown-value]";

const APPLY_SELECTOR = "[data-dropdown-apply]";
const SELECT_ALL_SELECTOR = "[data-dropdown-select-all]";
const CLEAR_SELECTOR = "[data-dropdown-clear]";

const CLOSE_ANIMATION_DELAY = 200;

function getMenu(dropdown) {
  return dropdown.querySelector(".dropdown-menu");
}

function getToggle(dropdown) {
  return dropdown.querySelector(TOGGLE_SELECTOR);
}

function getValueElement(dropdown) {
  return dropdown.querySelector(VALUE_SELECTOR);
}

function closeDropdown(dropdown) {
  dropdown.classList.remove("is-open");

  getToggle(dropdown)?.setAttribute("aria-expanded", "false");

  window.setTimeout(() => {
    if (!dropdown.classList.contains("is-open")) {
      dropdown.classList.remove("is-dropup");
    }
  }, CLOSE_ANIMATION_DELAY);
}

function closeAllDropdowns(exceptDropdown = null) {
  document
    .querySelectorAll(`${DROPDOWN_SELECTOR}.is-open`)
    .forEach((dropdown) => {
      if (dropdown !== exceptDropdown) {
        closeDropdown(dropdown);
      }
    });
}

function syncDropdownWidth(dropdown) {
  const toggle = getToggle(dropdown);

  if (!toggle) return;

  dropdown.style.setProperty("--dropdown-width", `${toggle.offsetWidth}px`);
}

function updateDropDirection(dropdown) {
  const toggle = getToggle(dropdown);
  const menu = getMenu(dropdown);

  if (!toggle || !menu) return;

  const toggleRect = toggle.getBoundingClientRect();
  const menuHeight = Math.min(menu.scrollHeight, 288);

  const spaceBelow = window.innerHeight - toggleRect.bottom;
  const spaceAbove = toggleRect.top;

  const shouldDropUp = spaceBelow < menuHeight + 12 && spaceAbove > spaceBelow;

  dropdown.classList.toggle("is-dropup", shouldDropUp);
}

function openDropdown(dropdown) {
  closeAllDropdowns(dropdown);

  syncDropdownWidth(dropdown);
  updateDropDirection(dropdown);

  dropdown.classList.add("is-open");

  getToggle(dropdown)?.setAttribute("aria-expanded", "true");

  const search = dropdown.querySelector(SEARCH_SELECTOR);
  search?.focus();
}

function toggleDropdown(dropdown) {
  if (dropdown.classList.contains("is-open")) {
    closeDropdown(dropdown);
  } else {
    openDropdown(dropdown);
  }
}

function updateToggleText(dropdown, text) {
  const value = getValueElement(dropdown);

  if (value) {
    value.textContent = text;
  }
}

function filterDropdown(dropdown, value) {
  const query = value.trim().toLowerCase();
  const items = dropdown.querySelectorAll(ITEM_SELECTOR);

  let visibleCount = 0;

  items.forEach((item) => {
    const text = item.textContent.trim().toLowerCase();
    const isVisible = text.includes(query);

    item.hidden = !isVisible;

    if (isVisible) {
      visibleCount += 1;
    }
  });

  dropdown.classList.toggle("has-empty", visibleCount === 0);
}

function getCheckedLabels(dropdown) {
  return Array.from(dropdown.querySelectorAll('input[type="checkbox"]:checked'))
    .map((input) => input.closest(".dropdown-checkbox")?.textContent.trim())
    .filter(Boolean);
}

function updateCheckboxText(dropdown) {
  const labels = getCheckedLabels(dropdown);
  const toggle = getToggle(dropdown);
  const placeholder = toggle?.dataset.placeholder || "Select";

  if (!labels.length) {
    updateToggleText(dropdown, placeholder);
    return;
  }

  updateToggleText(
    dropdown,
    labels.length === 1 ? labels[0] : `${labels.length} selected`,
  );
}

function activateItem(dropdown, item) {
  const clickable = item.matches(".dropdown-item")
    ? item
    : item.querySelector(".dropdown-item");

  if (!clickable) return;

  dropdown.querySelectorAll(".dropdown-item.is-active").forEach((active) => {
    active.classList.remove("is-active");
  });

  clickable.classList.add("is-active");

  updateToggleText(dropdown, clickable.textContent.trim());
}

function handleItemSelection(item) {
  const dropdown = item.closest(DROPDOWN_SELECTOR);

  if (!dropdown) return;

  const checkbox = item.querySelector('input[type="checkbox"]');

  if (checkbox) {
    updateCheckboxText(dropdown);
    return;
  }

  activateItem(dropdown, item);
  closeDropdown(dropdown);
}

function selectAll(dropdown) {
  if (!dropdown) return;

  dropdown.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = true;
  });

  updateCheckboxText(dropdown);
}

function clearAll(dropdown) {
  if (!dropdown) return;

  dropdown.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = false;
  });

  updateCheckboxText(dropdown);
}

export function initDropdowns() {
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest(TOGGLE_SELECTOR);

    if (toggle) {
      const dropdown = toggle.closest(DROPDOWN_SELECTOR);

      if (dropdown) {
        toggleDropdown(dropdown);
      }

      return;
    }

    const selectAllButton = event.target.closest(SELECT_ALL_SELECTOR);

    if (selectAllButton) {
      selectAll(selectAllButton.closest(DROPDOWN_SELECTOR));
      return;
    }

    const clearButton = event.target.closest(CLEAR_SELECTOR);

    if (clearButton) {
      clearAll(clearButton.closest(DROPDOWN_SELECTOR));
      return;
    }

    const applyButton = event.target.closest(APPLY_SELECTOR);

    if (applyButton) {
      closeDropdown(applyButton.closest(DROPDOWN_SELECTOR));
      return;
    }

    const item = event.target.closest(ITEM_SELECTOR);

    if (item) {
      handleItemSelection(item);
      return;
    }

    if (!event.target.closest(DROPDOWN_SELECTOR)) {
      closeAllDropdowns();
    }
  });

  document.addEventListener("input", (event) => {
    const search = event.target.closest(SEARCH_SELECTOR);

    if (!search) return;

    const dropdown = search.closest(DROPDOWN_SELECTOR);

    if (dropdown) {
      filterDropdown(dropdown, search.value);
    }
  });

  document.addEventListener(
    "scroll",
    (event) => {
      if (event.target.closest?.(DROPDOWN_SELECTOR)) return;

      closeAllDropdowns();
    },
    true,
  );

  window.addEventListener("resize", () => {
    closeAllDropdowns();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllDropdowns();
    }
  });
}

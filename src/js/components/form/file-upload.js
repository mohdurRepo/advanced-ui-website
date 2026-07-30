/* ==========================================================================
   Configuration
   ========================================================================== */

const SELECTORS = {
  input: '.form-file-input[type="file"]',
  wrapper: ".form-file",
  dropzone: ".form-dropzone",
  name: "[data-file-name]",
  list: "[data-file-list]",
  remove: "[data-file-remove]",
};

const CLASSES = {
  item: "form-file-item",
  icon: "has-icon",
  pdfIcon: "icon-pdf-file",
  fileIcon: "icon-file-download",
  name: "form-file-name",
  size: "form-file-size",
  remove: "form-file-remove",
  removeIcon: "icon-close-x",
  dragover: "is-dragover",
};

const MESSAGES = {
  en: {
    empty: "No file selected",
    selected: (count) => `${count} files selected`,
    remove: (name) => `Remove ${name}`,
  },
  ar: {
    empty: "لم يتم اختيار ملف",
    selected: (count) => `تم اختيار ${count} ملفات`,
    remove: (name) => `إزالة ${name}`,
  },
};

const initializedInputs = new WeakSet();
const initializedRemoveActions = new WeakSet();
const dragDepth = new WeakMap();

function getElements(root, selector) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return [];
  }

  const elements = Array.from(root.querySelectorAll(selector));

  if (typeof root.matches === "function" && root.matches(selector)) {
    elements.unshift(root);
  }

  return elements;
}

function getFiles(input) {
  return Array.from(input.files || []);
}

function getLanguage(element) {
  const language =
    element.closest("[lang]")?.getAttribute("lang") ||
    element.ownerDocument.documentElement.lang ||
    "en";

  return language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

function getLocale(element) {
  return getLanguage(element) === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
}

function getWrapper(input) {
  return input.closest(SELECTORS.wrapper);
}

function getFileNameElement(input) {
  return getWrapper(input)?.querySelector(SELECTORS.name) || null;
}

function getElementById(element, id) {
  const root = element.getRootNode();

  return typeof root.getElementById === "function"
    ? root.getElementById(id)
    : element.ownerDocument.getElementById(id);
}

function getFileList(input) {
  const listId = input.dataset.fileList?.trim();

  if (listId) {
    const list = getElementById(input, listId);

    return list !== input && list?.matches(SELECTORS.list) ? list : null;
  }

  const list =
    input.closest(".form-group")?.querySelector(SELECTORS.list) || null;

  return list !== input ? list : null;
}

function formatFileSize(bytes, locale) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / 1024 ** unitIndex;
  const maximumFractionDigits = value >= 10 || unitIndex === 0 ? 0 : 1;

  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits,
  }).format(value)} ${units[unitIndex]}`;
}

function isPdf(file) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function assignFiles(input, files) {
  const DataTransferConstructor = input.ownerDocument.defaultView?.DataTransfer;

  if (typeof DataTransferConstructor !== "function") {
    return false;
  }

  const transfer = new DataTransferConstructor();
  const selectedFiles = input.multiple ? files : files.slice(0, 1);

  selectedFiles.forEach((file) => transfer.items.add(file));

  try {
    input.files = transfer.files;
    return true;
  } catch {
    return false;
  }
}

function dispatchChange(input) {
  const EventConstructor = input.ownerDocument.defaultView?.Event || Event;

  input.dispatchEvent(
    new EventConstructor("change", {
      bubbles: true,
    }),
  );
}

function removeFile(input, index) {
  const files = getFiles(input);

  if (index < 0 || index >= files.length) {
    return;
  }

  files.splice(index, 1);

  if (assignFiles(input, files)) {
    dispatchChange(input);
  }
}

function updateFileName(input) {
  const nameElement = getFileNameElement(input);

  if (!nameElement) {
    return;
  }

  const files = getFiles(input);
  const messages = MESSAGES[getLanguage(input)];

  let label = input.dataset.fileEmptyLabel || messages.empty;

  if (files.length === 1) {
    label = files[0].name;
  } else if (files.length > 1) {
    label = input.dataset.fileSelectedLabel || messages.selected(files.length);
  }

  nameElement.textContent = label;
  nameElement.title = files.length === 1 ? files[0].name : "";
}

function createFileItem(input, file, index) {
  const documentRoot = input.ownerDocument;
  const locale = getLocale(input);
  const messages = MESSAGES[getLanguage(input)];

  const item = documentRoot.createElement("li");
  const icon = documentRoot.createElement("span");
  const name = documentRoot.createElement("span");
  const size = documentRoot.createElement("span");
  const remove = documentRoot.createElement("button");

  item.className = CLASSES.item;

  icon.className = [
    CLASSES.icon,
    isPdf(file) ? CLASSES.pdfIcon : CLASSES.fileIcon,
  ].join(" ");
  icon.setAttribute("aria-hidden", "true");

  name.className = CLASSES.name;
  name.textContent = file.name;
  name.title = file.name;

  size.className = CLASSES.size;
  size.textContent = formatFileSize(file.size, locale);

  remove.className = [CLASSES.remove, CLASSES.icon, CLASSES.removeIcon].join(
    " ",
  );
  remove.type = "button";
  remove.dataset.fileRemove = "";
  remove.dataset.fileIndex = String(index);
  remove.setAttribute("aria-label", messages.remove(file.name));

  remove.addEventListener("click", () => {
    removeFile(input, index);
  });

  item.append(icon, name, size, remove);

  return item;
}

function updateFileList(input) {
  const list = getFileList(input);

  if (!list) {
    return;
  }

  const items = getFiles(input).map((file, index) =>
    createFileItem(input, file, index),
  );

  list.replaceChildren(...items);

  if (!list.hasAttribute("aria-live")) {
    list.setAttribute("aria-live", "polite");
  }

  if (list.hasAttribute("data-file-list-hide-empty")) {
    list.hidden = items.length === 0;
  }
}

function synchronizeInput(input) {
  updateFileName(input);
  updateFileList(input);
}

function isFileDrag(event) {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}

function setDragState(wrapper, dropzone, active) {
  wrapper.classList.toggle(CLASSES.dragover, active);
  dropzone.classList.toggle(CLASSES.dragover, active);
  dropzone.dataset.dragActive = String(active);
}

function initializeDropzone(input, wrapper) {
  const dropzone = wrapper.querySelector(SELECTORS.dropzone);

  if (!dropzone) {
    return;
  }

  dragDepth.set(dropzone, 0);
  setDragState(wrapper, dropzone, false);

  dropzone.addEventListener("dragenter", (event) => {
    if (input.disabled || !isFileDrag(event)) {
      return;
    }

    event.preventDefault();

    const depth = (dragDepth.get(dropzone) || 0) + 1;

    dragDepth.set(dropzone, depth);
    setDragState(wrapper, dropzone, true);
  });

  dropzone.addEventListener("dragover", (event) => {
    if (input.disabled || !isFileDrag(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });

  dropzone.addEventListener("dragleave", () => {
    const depth = Math.max((dragDepth.get(dropzone) || 1) - 1, 0);

    dragDepth.set(dropzone, depth);

    if (depth === 0) {
      setDragState(wrapper, dropzone, false);
    }
  });

  dropzone.addEventListener("drop", (event) => {
    if (input.disabled || !isFileDrag(event)) {
      return;
    }

    event.preventDefault();

    dragDepth.set(dropzone, 0);
    setDragState(wrapper, dropzone, false);

    const files = Array.from(event.dataTransfer?.files || []);

    if (files.length > 0 && assignFiles(input, files)) {
      dispatchChange(input);
    }
  });

  dropzone.addEventListener("dragend", () => {
    dragDepth.set(dropzone, 0);
    setDragState(wrapper, dropzone, false);
  });
}

function initializeStandaloneRemoveAction(action) {
  if (initializedRemoveActions.has(action) || action.closest(SELECTORS.list)) {
    return;
  }

  const item = action.closest(`.${CLASSES.item}`);

  if (!item) {
    return;
  }

  initializedRemoveActions.add(action);

  action.addEventListener("click", () => {
    item.remove();
  });
}

function initializeInput(input) {
  if (initializedInputs.has(input)) {
    return;
  }

  const wrapper = getWrapper(input);

  if (!wrapper) {
    return;
  }

  initializedInputs.add(input);

  synchronizeInput(input);
  initializeDropzone(input, wrapper);

  input.addEventListener("change", () => {
    synchronizeInput(input);
  });

  input.form?.addEventListener("reset", () => {
    queueMicrotask(() => {
      synchronizeInput(input);
    });
  });
}

/**
 * Initializes native file-input enhancements within a document or component.
 *
 * Optional hooks:
 * - `data-file-name` for the selected-file label
 * - `data-file-list="list-id"` on the input
 * - `data-file-list` on the associated list
 * - `data-file-list-hide-empty` on the list
 * - `data-file-empty-label` on the input
 * - `data-file-selected-label` on the input
 *
 * @param {Document | Element | DocumentFragment} root
 */
export function initFileUploads(root = document) {
  getElements(root, SELECTORS.input).forEach(initializeInput);
  getElements(root, SELECTORS.remove).forEach(initializeStandaloneRemoveAction);
}

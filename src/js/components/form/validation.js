/* ==========================================================================
   Configuration
   ========================================================================== */

const SELECTORS = {
  form: 'form.form:not([data-validation="native"])',
  control: "input, select, textarea",
  target: ".form-group, .form-fieldset",
  error: ".form-error",
  success: ".form-success",
};

const MESSAGES = {
  en: {
    required: "This field is required.",
    email: "Enter a valid email address.",
    url: "Enter a valid URL.",
    pattern: "Enter a value in the required format.",
    tooShort: (minimum) => `Enter at least ${minimum} characters.`,
    tooLong: (maximum) => `Enter no more than ${maximum} characters.`,
    minimum: (minimum) => `Enter a value greater than or equal to ${minimum}.`,
    maximum: (maximum) => `Enter a value less than or equal to ${maximum}.`,
    step: "Enter a valid value.",
    number: "Enter a number.",
    generic: "Check this field and try again.",
  },
  ar: {
    required: "هذا الحقل مطلوب.",
    email: "أدخل عنوان بريد إلكتروني صحيحًا.",
    url: "أدخل رابطًا صحيحًا.",
    pattern: "أدخل قيمة بالتنسيق المطلوب.",
    tooShort: (minimum) => `أدخل ${minimum} أحرف على الأقل.`,
    tooLong: (maximum) => `أدخل ما لا يزيد على ${maximum} أحرف.`,
    minimum: (minimum) => `أدخل قيمة أكبر من أو تساوي ${minimum}.`,
    maximum: (maximum) => `أدخل قيمة أقل من أو تساوي ${maximum}.`,
    step: "أدخل قيمة صحيحة.",
    number: "أدخل رقمًا.",
    generic: "تحقق من هذا الحقل وحاول مرة أخرى.",
  },
};

const initializedForms = new WeakSet();
const formRecords = new WeakMap();

let generatedMessageId = 0;

/* ==========================================================================
   Form Records
   ========================================================================== */

function createFormRecord(form) {
  return {
    form,
    formWasValidated: form.classList.contains("was-validated"),
    targets: new Map(),
    controls: new Map(),
    messages: new Map(),
    descriptions: new Map(),
    generatedMessages: new Set(),
    errors: new WeakMap(),
    touchedTargets: new WeakSet(),
  };
}

function registerTarget(record, target) {
  if (!record.targets.has(target)) {
    record.targets.set(target, {
      valid: target.classList.contains("is-valid"),
      invalid: target.classList.contains("is-invalid"),
    });
  }

  return target;
}

function registerControl(record, control) {
  if (!record.controls.has(control)) {
    record.controls.set(control, {
      ariaInvalid: control.getAttribute("aria-invalid"),
    });
  }

  return control;
}

function registerMessage(record, message) {
  if (!record.messages.has(message)) {
    record.messages.set(message, {
      hidden: message.hidden,
      id: message.getAttribute("id"),
    });
  }

  return message;
}

function registerDescription(record, element) {
  if (!record.descriptions.has(element)) {
    record.descriptions.set(element, element.getAttribute("aria-describedby"));
  }

  return element;
}

/* ==========================================================================
   Collection Helpers
   ========================================================================== */

function getForms(root) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return [];
  }

  const forms = Array.from(root.querySelectorAll(SELECTORS.form));

  if (typeof root.matches === "function" && root.matches(SELECTORS.form)) {
    forms.unshift(root);
  }

  return forms;
}

function isValidationControl(element) {
  return (
    typeof element.matches === "function" &&
    element.matches(SELECTORS.control) &&
    element.willValidate
  );
}

function getFormControls(form) {
  return Array.from(form.elements).filter(isValidationControl);
}

function getValidationTarget(control) {
  return control.closest(SELECTORS.target) || control;
}

function getTargetControls(record, target) {
  if (isValidationControl(target)) {
    return [registerControl(record, target)];
  }

  return Array.from(target.querySelectorAll(SELECTORS.control))
    .filter(
      (control) =>
        isValidationControl(control) &&
        control.form === record.form &&
        getValidationTarget(control) === target,
    )
    .map((control) => registerControl(record, control));
}

function registerFormElements(record) {
  getFormControls(record.form).forEach((control) => {
    registerControl(record, control);
    registerTarget(record, getValidationTarget(control));
  });

  record.form
    .querySelectorAll(`${SELECTORS.error}, ${SELECTORS.success}`)
    .forEach((message) => registerMessage(record, message));
}

/* ==========================================================================
   Language and Messages
   ========================================================================== */

function getLanguage(element) {
  const language =
    element.closest("[lang]")?.getAttribute("lang") ||
    element.ownerDocument.documentElement.lang ||
    "en";

  return language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

function getValidationMessage(control) {
  const messages = MESSAGES[getLanguage(control)];
  const { validity } = control;

  if (control.dataset.validationMessage) {
    return control.dataset.validationMessage;
  }

  if (validity.customError) {
    return control.validationMessage;
  }

  if (validity.valueMissing) {
    return control.dataset.validationRequired || messages.required;
  }

  if (validity.typeMismatch) {
    if (control.type === "email") {
      return control.dataset.validationType || messages.email;
    }

    if (control.type === "url") {
      return control.dataset.validationType || messages.url;
    }
  }

  if (validity.patternMismatch) {
    return control.dataset.validationPattern || messages.pattern;
  }

  if (validity.tooShort) {
    return (
      control.dataset.validationLength || messages.tooShort(control.minLength)
    );
  }

  if (validity.tooLong) {
    return (
      control.dataset.validationLength || messages.tooLong(control.maxLength)
    );
  }

  if (validity.rangeUnderflow) {
    return control.dataset.validationMin || messages.minimum(control.min);
  }

  if (validity.rangeOverflow) {
    return control.dataset.validationMax || messages.maximum(control.max);
  }

  if (validity.stepMismatch) {
    return control.dataset.validationStep || messages.step;
  }

  if (validity.badInput) {
    return control.dataset.validationType || messages.number;
  }

  return (
    control.dataset.validationGeneric ||
    control.validationMessage ||
    messages.generic
  );
}

/* ==========================================================================
   Feedback Elements
   ========================================================================== */

function getOwnedMessage(target, selector) {
  if (isValidationControl(target)) {
    return null;
  }

  return (
    Array.from(target.querySelectorAll(selector)).find(
      (message) => message.closest(SELECTORS.target) === target,
    ) || null
  );
}

function createMessageId(message, control) {
  if (message.id) {
    return message.id;
  }

  const documentRoot = message.ownerDocument;
  const preferredId = control.id ? `${control.id}-error` : "form-error";

  let id = preferredId;

  while (documentRoot.getElementById(id)) {
    generatedMessageId += 1;
    id = `${preferredId}-${generatedMessageId}`;
  }

  message.id = id;

  return id;
}

function appendDescription(record, element, id) {
  registerDescription(record, element);

  const ids = new Set(
    (element.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter(Boolean),
  );

  ids.add(id);
  element.setAttribute("aria-describedby", Array.from(ids).join(" "));
}

function associateMessage(record, target, controls, message) {
  if (!message.hasAttribute("data-generated-validation-message")) {
    registerMessage(record, message);
  }

  const id = createMessageId(message, controls[0]);

  if (target.tagName === "FIELDSET") {
    appendDescription(record, target, id);
    return;
  }

  controls.forEach((control) => {
    appendDescription(record, control, id);
  });
}

function createErrorMessage(record, target, controls) {
  const message = target.ownerDocument.createElement("p");

  message.className = "form-error";
  message.dataset.generatedValidationMessage = "";
  message.setAttribute("aria-live", "polite");

  if (isValidationControl(target)) {
    target.insertAdjacentElement("afterend", message);
  } else {
    target.append(message);
  }

  record.generatedMessages.add(message);
  record.errors.set(target, message);
  associateMessage(record, target, controls, message);

  return message;
}

function setMessageVisibility(record, message, visible) {
  if (!message) {
    return;
  }

  if (!message.hasAttribute("data-generated-validation-message")) {
    registerMessage(record, message);
  }

  message.hidden = !visible;
}

/* ==========================================================================
   State
   ========================================================================== */

function setTargetClasses(target, state) {
  target.classList.toggle("is-valid", state === "valid");
  target.classList.toggle("is-invalid", state === "invalid");
}

function setControlAriaInvalid(record, controls, invalidControls) {
  const invalidSet = new Set(invalidControls);

  controls.forEach((control) => {
    registerControl(record, control);

    if (invalidSet.has(control)) {
      control.setAttribute("aria-invalid", "true");
    } else {
      control.removeAttribute("aria-invalid");
    }
  });
}

function applyTargetState(record, target, controls, state, invalidControls) {
  registerTarget(record, target);

  setTargetClasses(target, state);
  setControlAriaInvalid(record, controls, invalidControls);

  let error =
    record.errors.get(target) || getOwnedMessage(target, SELECTORS.error);

  const success = getOwnedMessage(target, SELECTORS.success);

  if (error) {
    record.errors.set(target, error);
  }

  if (state === "invalid") {
    const firstInvalidControl = invalidControls[0];

    if (!error) {
      error = createErrorMessage(record, target, controls);
    } else {
      associateMessage(record, target, controls, error);
    }

    if (
      error.hasAttribute("data-generated-validation-message") ||
      error.hasAttribute("data-validation-dynamic")
    ) {
      error.textContent = getValidationMessage(firstInvalidControl);
    }

    setMessageVisibility(record, error, true);
    setMessageVisibility(record, success, false);

    return;
  }

  setMessageVisibility(record, error, false);
  setMessageVisibility(record, success, state === "valid");
}

function synchronizeTarget(record, target, respectInitialInvalid = false) {
  registerTarget(record, target);

  const controls = getTargetControls(record, target);

  if (controls.length === 0) {
    return true;
  }

  const initialState = record.targets.get(target);
  const retainInitialInvalid =
    respectInitialInvalid &&
    initialState.invalid &&
    !record.touchedTargets.has(target);

  const invalidControls = controls.filter((control) => !control.validity.valid);

  if (retainInitialInvalid && invalidControls.length === 0) {
    applyTargetState(record, target, controls, "invalid", [controls[0]]);

    return false;
  }

  if (invalidControls.length > 0) {
    applyTargetState(record, target, controls, "invalid", invalidControls);

    return false;
  }

  const shouldShowValid = controls.some((control) => control.required);
  const state = shouldShowValid ? "valid" : "neutral";

  applyTargetState(record, target, controls, state, []);

  return true;
}

function synchronizeForm(record) {
  const targets = new Set();

  getFormControls(record.form).forEach((control) => {
    registerControl(record, control);

    const target = registerTarget(record, getValidationTarget(control));

    targets.add(target);
  });

  let valid = true;

  targets.forEach((target) => {
    if (!synchronizeTarget(record, target, true)) {
      valid = false;
    }
  });

  return valid;
}

/* ==========================================================================
   Focus
   ========================================================================== */

function focusControl(control) {
  if (!control || typeof control.focus !== "function") {
    return;
  }

  try {
    control.focus({ preventScroll: false });
  } catch {
    control.focus();
  }
}

function getFirstInvalidControl(record) {
  const nativeInvalid = getFormControls(record.form).find(
    (control) => !control.validity.valid,
  );

  if (nativeInvalid) {
    return nativeInvalid;
  }

  for (const [target, initialState] of record.targets) {
    if (
      initialState.invalid &&
      !record.touchedTargets.has(target) &&
      record.form.contains(target)
    ) {
      return getTargetControls(record, target)[0] || null;
    }
  }

  return null;
}

/* ==========================================================================
   Reset
   ========================================================================== */

function restoreAttribute(element, name, value) {
  if (value === null) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, value);
  }
}

function restoreForm(record) {
  record.generatedMessages.forEach((message) => {
    message.remove();
  });

  record.generatedMessages.clear();
  record.errors = new WeakMap();

  record.targets.forEach((state, target) => {
    target.classList.toggle("is-valid", state.valid);
    target.classList.toggle("is-invalid", state.invalid);
  });

  record.controls.forEach((state, control) => {
    restoreAttribute(control, "aria-invalid", state.ariaInvalid);
  });

  record.messages.forEach((state, message) => {
    if (!message.isConnected) {
      return;
    }

    message.hidden = state.hidden;
    restoreAttribute(message, "id", state.id);
  });

  record.descriptions.forEach((value, element) => {
    restoreAttribute(element, "aria-describedby", value);
  });

  record.form.classList.toggle("was-validated", record.formWasValidated);
  record.touchedTargets = new WeakSet();
}

/* ==========================================================================
   Interaction
   ========================================================================== */

function handleInteraction(record, control) {
  if (!isValidationControl(control)) {
    return;
  }

  registerControl(record, control);

  const target = registerTarget(record, getValidationTarget(control));
  const hasVisibleState =
    target.classList.contains("is-valid") ||
    target.classList.contains("is-invalid") ||
    control.hasAttribute("aria-invalid");

  record.touchedTargets.add(target);

  if (record.form.classList.contains("was-validated") || hasVisibleState) {
    synchronizeTarget(record, target);
  }
}

/* ==========================================================================
   Initialization
   ========================================================================== */

function initializeForm(form) {
  if (initializedForms.has(form)) {
    return;
  }

  initializedForms.add(form);

  const record = createFormRecord(form);

  formRecords.set(form, record);
  registerFormElements(record);

  /*
   * Disable native validation bubbles only after JavaScript is active.
   * Constraint validation itself remains available through checkValidity().
   */
  form.noValidate = true;

  form.addEventListener(
    "invalid",
    (event) => {
      if (!isValidationControl(event.target)) {
        return;
      }

      event.preventDefault();

      const target = registerTarget(record, getValidationTarget(event.target));

      synchronizeTarget(record, target);
    },
    true,
  );

  form.addEventListener("input", (event) => {
    handleInteraction(record, event.target);
  });

  form.addEventListener("change", (event) => {
    handleInteraction(record, event.target);
  });

  form.addEventListener("submit", (event) => {
    form.classList.add("was-validated");

    const nativeValid = form.checkValidity();
    const stateValid = synchronizeForm(record);

    if (nativeValid && stateValid) {
      return;
    }

    event.preventDefault();
    focusControl(getFirstInvalidControl(record));
  });

  form.addEventListener("reset", () => {
    queueMicrotask(() => {
      restoreForm(record);
    });
  });
}

/**
 * Initializes accessible validation behavior within a document or component.
 *
 * Add `data-validation="native"` to a form to retain the browser's native
 * validation interface instead.
 *
 * Authored `.form-error` and `.form-success` elements are reused. When no
 * error element exists, the module creates and associates one automatically.
 *
 * @param {Document | Element | DocumentFragment} root
 */
export function initFormValidation(root = document) {
  getForms(root).forEach(initializeForm);
}

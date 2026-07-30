/* ==========================================================================
   Configuration
   ========================================================================== */

const SELECTORS = {
  group: "[data-otp]",
  input: "[data-otp-input]",
};

const COMPLETE_EVENT = "form:otp-complete";

const initializedGroups = new WeakSet();
const updatingInputs = new WeakSet();
const completedValues = new WeakMap();

function getGroups(root) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return [];
  }

  const groups = Array.from(root.querySelectorAll(SELECTORS.group));

  if (typeof root.matches === "function" && root.matches(SELECTORS.group)) {
    groups.unshift(root);
  }

  return groups;
}

function getInputs(group) {
  return Array.from(group.querySelectorAll(SELECTORS.input));
}

function isEditable(input) {
  return !input.disabled && !input.readOnly;
}

function findEditableIndex(inputs, currentIndex, direction) {
  let index = currentIndex + direction;

  while (index >= 0 && index < inputs.length) {
    if (isEditable(inputs[index])) {
      return index;
    }

    index += direction;
  }

  return -1;
}

function findEdgeIndex(inputs, direction) {
  const startIndex = direction > 0 ? -1 : inputs.length;

  return findEditableIndex(inputs, startIndex, direction);
}

function focusInput(input) {
  if (!input || !isEditable(input)) {
    return;
  }

  input.focus();
  input.select();
}

/* ==========================================================================
   Digit Normalization
   ========================================================================== */

function normalizeDigit(character) {
  const code = character.charCodeAt(0);

  if (code >= 0x0660 && code <= 0x0669) {
    return String(code - 0x0660);
  }

  if (code >= 0x06f0 && code <= 0x06f9) {
    return String(code - 0x06f0);
  }

  if (code >= 0xff10 && code <= 0xff19) {
    return String(code - 0xff10);
  }

  return character;
}

function normalizeDigits(value) {
  return String(value)
    .replace(/[\u0660-\u0669\u06f0-\u06f9\uff10-\uff19]/g, normalizeDigit)
    .replace(/[^0-9]/g, "");
}

/* ==========================================================================
   Input Events
   ========================================================================== */

function dispatchInput(input, value) {
  const view = input.ownerDocument.defaultView;
  const InputEventConstructor = view?.InputEvent;
  const EventConstructor = view?.Event || Event;

  const event =
    typeof InputEventConstructor === "function"
      ? new InputEventConstructor("input", {
          bubbles: true,
          data: value,
          inputType: value ? "insertText" : "deleteContentBackward",
        })
      : new EventConstructor("input", { bubbles: true });

  input.dispatchEvent(event);
}

function setInputValue(input, value) {
  if (input.value === value) {
    return;
  }

  updatingInputs.add(input);

  try {
    input.value = value;
    dispatchInput(input, value);
  } finally {
    updatingInputs.delete(input);
  }
}

/* ==========================================================================
   Completion
   ========================================================================== */

function getOtpValue(inputs) {
  return inputs
    .map((input) => normalizeDigits(input.value).slice(0, 1))
    .join("");
}

function synchronizeCompletion(group, inputs, announce = true) {
  const value = getOtpValue(inputs);
  const complete =
    inputs.length > 0 &&
    inputs.every((input) => normalizeDigits(input.value).length === 1);

  group.classList.toggle("is-complete", complete);
  group.dataset.otpComplete = String(complete);

  if (!complete) {
    completedValues.delete(group);
    return;
  }

  if (!announce || completedValues.get(group) === value) {
    completedValues.set(group, value);
    return;
  }

  completedValues.set(group, value);

  const CustomEventConstructor =
    group.ownerDocument.defaultView?.CustomEvent || CustomEvent;

  group.dispatchEvent(
    new CustomEventConstructor(COMPLETE_EVENT, {
      bubbles: true,
      detail: { value },
    }),
  );
}

function fillInputs(group, inputs, startIndex, value) {
  const digits = normalizeDigits(value);

  if (!digits) {
    return;
  }

  let inputIndex = startIndex;
  let digitIndex = 0;
  let lastUpdatedIndex = -1;

  while (inputIndex < inputs.length && digitIndex < digits.length) {
    const input = inputs[inputIndex];

    if (isEditable(input)) {
      setInputValue(input, digits[digitIndex]);
      digitIndex += 1;
      lastUpdatedIndex = inputIndex;
    }

    inputIndex += 1;
  }

  synchronizeCompletion(group, inputs);

  if (lastUpdatedIndex < 0) {
    return;
  }

  const nextIndex = findEditableIndex(inputs, lastUpdatedIndex, 1);

  focusInput(inputs[nextIndex >= 0 ? nextIndex : lastUpdatedIndex]);
}

/* ==========================================================================
   Input Interaction
   ========================================================================== */

function initializeInput(group, inputs, input, index) {
  input.addEventListener("beforeinput", (event) => {
    if (
      event.isComposing ||
      !isEditable(input) ||
      typeof event.inputType !== "string" ||
      !event.inputType.startsWith("insert") ||
      event.data === null
    ) {
      return;
    }

    event.preventDefault();

    const digits = normalizeDigits(event.data);

    if (digits) {
      fillInputs(group, inputs, index, digits);
    }
  });

  input.addEventListener("input", () => {
    if (updatingInputs.has(input)) {
      return;
    }

    const digits = normalizeDigits(input.value);

    if (digits.length > 1) {
      fillInputs(group, inputs, index, digits);
      return;
    }

    input.value = digits;
    synchronizeCompletion(group, inputs);

    if (digits) {
      const nextIndex = findEditableIndex(inputs, index, 1);

      if (nextIndex >= 0) {
        focusInput(inputs[nextIndex]);
      }
    }
  });

  input.addEventListener("paste", (event) => {
    if (!isEditable(input)) {
      return;
    }

    const digits = normalizeDigits(event.clipboardData?.getData("text") || "");

    if (!digits) {
      return;
    }

    event.preventDefault();
    fillInputs(group, inputs, index, digits);
  });

  input.addEventListener("keydown", (event) => {
    if (!isEditable(input)) {
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();

      if (input.value) {
        setInputValue(input, "");
        synchronizeCompletion(group, inputs);
        return;
      }

      const previousIndex = findEditableIndex(inputs, index, -1);

      if (previousIndex >= 0) {
        setInputValue(inputs[previousIndex], "");
        synchronizeCompletion(group, inputs);
        focusInput(inputs[previousIndex]);
      }

      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      setInputValue(input, "");
      synchronizeCompletion(group, inputs);
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();

      const direction = event.key === "ArrowLeft" ? -1 : 1;
      const nextIndex = findEditableIndex(inputs, index, direction);

      if (nextIndex >= 0) {
        focusInput(inputs[nextIndex]);
      }

      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();

      const direction = event.key === "Home" ? 1 : -1;
      const edgeIndex = findEdgeIndex(inputs, direction);

      if (edgeIndex >= 0) {
        focusInput(inputs[edgeIndex]);
      }
    }
  });

  input.addEventListener("focus", () => {
    input.select();
  });
}

function initializeGroup(group) {
  if (initializedGroups.has(group)) {
    return;
  }

  const inputs = getInputs(group);

  if (inputs.length === 0) {
    return;
  }

  initializedGroups.add(group);

  inputs.forEach((input, index) => {
    input.value = normalizeDigits(input.value).slice(0, 1);
    initializeInput(group, inputs, input, index);
  });

  synchronizeCompletion(group, inputs, false);

  inputs[0].form?.addEventListener("reset", () => {
    queueMicrotask(() => {
      inputs.forEach((input) => {
        input.value = normalizeDigits(input.value).slice(0, 1);
      });

      synchronizeCompletion(group, inputs, false);
    });
  });
}

/**
 * Initializes one-time-password groups within a document or component root.
 *
 * A completed group dispatches `form:otp-complete` with:
 * `{ detail: { value: "123456" } }`.
 *
 * @param {Document | Element | DocumentFragment} root
 */
export function initOtpInputs(root = document) {
  getGroups(root).forEach(initializeGroup);
}

const PASSWORD_TOGGLE_SELECTOR = "[data-password-toggle]";
const FILE_INPUT_SELECTOR = "[data-file-input]";
const DROPZONE_SELECTOR = "[data-dropzone]";
const OTP_SELECTOR = "[data-otp]";

function togglePassword(input, button) {
  const shouldShow = input.type === "password";

  input.type = shouldShow ? "text" : "password";

  button.classList.toggle("icon-eye", !shouldShow);
  button.classList.toggle("icon-eye-slash", shouldShow);
  button.classList.toggle("is-active", shouldShow);

  button.setAttribute("aria-pressed", String(shouldShow));
  button.setAttribute(
    "aria-label",
    shouldShow ? "Hide password" : "Show password",
  );
}

function initPasswordToggles() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest(PASSWORD_TOGGLE_SELECTOR);
    if (!button) return;

    const selector = button.getAttribute("data-password-toggle");
    const input = selector ? document.querySelector(selector) : null;
    if (!input) return;

    togglePassword(input, button);
  });
}

function updateFileName(input) {
  const wrapper = input.closest(".form-file");
  const name = wrapper?.querySelector("[data-file-name]");

  if (!name) return;

  if (!input.files?.length) {
    name.textContent = "No file selected";
    return;
  }

  name.textContent =
    input.files.length === 1
      ? input.files[0].name
      : `${input.files.length} files selected`;
}

function initFileInputs() {
  document.addEventListener("change", (event) => {
    const input = event.target.closest(FILE_INPUT_SELECTOR);
    if (!input) return;

    updateFileName(input);
  });
}

function setDropzoneFiles(dropzone, files) {
  const inputSelector = dropzone.getAttribute("data-dropzone");
  const input = inputSelector ? document.querySelector(inputSelector) : null;

  if (!input || !files?.length) return;

  const transfer = new DataTransfer();

  Array.from(files).forEach((file) => {
    transfer.items.add(file);
  });

  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function initDropzones() {
  document.querySelectorAll(DROPZONE_SELECTOR).forEach((dropzone) => {
    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove("is-dragover");
      });
    });

    dropzone.addEventListener("drop", (event) => {
      setDropzoneFiles(dropzone, event.dataTransfer.files);
    });
  });
}

function initOtpInputs() {
  document.querySelectorAll(OTP_SELECTOR).forEach((otp) => {
    const inputs = Array.from(otp.querySelectorAll("input"));

    inputs.forEach((input, index) => {
      input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 1);

        if (input.value && inputs[index + 1]) {
          inputs[index + 1].focus();
        }
      });

      input.addEventListener("keydown", (event) => {
        if (event.key === "Backspace" && !input.value && inputs[index - 1]) {
          inputs[index - 1].focus();
        }
      });

      input.addEventListener("paste", (event) => {
        event.preventDefault();

        const pasted = event.clipboardData
          .getData("text")
          .replace(/\D/g, "")
          .slice(0, inputs.length);

        pasted.split("").forEach((char, charIndex) => {
          if (inputs[charIndex]) {
            inputs[charIndex].value = char;
          }
        });

        inputs[Math.min(pasted.length, inputs.length) - 1]?.focus();
      });
    });
  });
}

export function initForms() {
  initPasswordToggles();
  initFileInputs();
  initDropzones();
  initOtpInputs();
}

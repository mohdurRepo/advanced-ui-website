const TOAST_CONTAINER_ID = "toastContainer";
const DEFAULT_DURATION = 4000;

const icons = {
  success: "✓",
  info: "i",
  warning: "!",
  danger: "×",
  primary: "•",
};

function getContainer() {
  let container = document.getElementById(TOAST_CONTAINER_ID);

  if (!container) {
    container = document.createElement("div");
    container.id = TOAST_CONTAINER_ID;
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-atomic", "true");
    document.body.appendChild(container);
  }

  return container;
}

function removeToast(toast) {
  if (!toast || toast.classList.contains("is-leaving")) return;

  toast.classList.add("is-leaving");

  toast.addEventListener(
    "animationend",
    () => {
      toast.remove();
    },
    { once: true },
  );
}

export function showToast({
  type = "primary",
  title = "Notification",
  message = "",
  duration = DEFAULT_DURATION,
} = {}) {
  const container = getContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", type === "danger" ? "alert" : "status");

  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.primary}</div>

    <div class="toast-content">
      <h4 class="toast-title">${title}</h4>
      ${message ? `<p class="toast-message">${message}</p>` : ""}
    </div>

    <button class="toast-close" type="button" aria-label="Close notification">
      ×
    </button>
  `;

  container.appendChild(toast);

  const closeButton = toast.querySelector(".toast-close");
  closeButton?.addEventListener("click", () => removeToast(toast));

  if (duration > 0) {
    window.setTimeout(() => removeToast(toast), duration);
  }

  return toast;
}

export function initToasts() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-toast]");

    if (!trigger) return;

    showToast({
      type: trigger.dataset.toast || "primary",
      title: trigger.dataset.toastTitle || "Notification",
      message: trigger.dataset.toastMessage || "",
      duration: Number(trigger.dataset.toastDuration || DEFAULT_DURATION),
    });
  });
}

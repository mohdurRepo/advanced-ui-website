/* ==========================================================================
   Share
   ========================================================================== */

/**
 * Shared Share controller.
 *
 * Preserves the legacy Saudi Exchange share behavior:
 *
 * - Facebook -> share current page URL
 * - X        -> share current page URL
 * - Copy     -> copy current page URL
 *
 * Supported by:
 *
 * - News Detail
 * - Announcement Detail
 * - Company Profile
 * - future share-enabled components
 *
 * Required markup contract:
 *
 *   [data-share]
 *   [data-share-toggle]
 *   [data-share-menu]
 *   [data-share-platform]
 *
 * Supported platforms:
 *
 *   facebook
 *   x
 *   copy
 */

const SHARE_SELECTOR = "[data-share]";
const TOGGLE_SELECTOR = "[data-share-toggle]";
const MENU_SELECTOR = "[data-share-menu]";
const PLATFORM_SELECTOR = "[data-share-platform]";

/* ==========================================================================
   Registry
   ========================================================================== */

const shareControllers = [];

/* ==========================================================================
   Share URL
   ========================================================================== */

/**
 * Allow a component to provide an explicit URL when required.
 *
 * Otherwise preserve the legacy behavior and use the current browser URL.
 */

function getShareUrl(root) {
  return root.dataset.shareUrl || window.location.href;
}

/* ==========================================================================
   Platform URL
   ========================================================================== */

/**
 * These intentionally mirror the legacy Saudi Exchange destinations.
 *
 * Legacy:
 *
 * Facebook:
 * https://www.facebook.com/sharer.php?u={URL}&src=sdkpreparse
 *
 * Twitter:
 * https://twitter.com/intent/tweet?url={URL}
 */

function buildShareUrl(platform, pageUrl) {
  const encodedUrl = encodeURIComponent(pageUrl);

  switch (platform) {
    case "facebook":
      return (
        "https://www.facebook.com/sharer.php" +
        `?u=${encodedUrl}` +
        "&src=sdkpreparse"
      );

    case "x":
      return "https://twitter.com/intent/tweet" + `?url=${encodedUrl}`;

    default:
      return null;
  }
}

/* ==========================================================================
   Popup
   ========================================================================== */

function openShareWindow(url) {
  if (!url) {
    return;
  }

  const width = 720;
  const height = 560;

  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);

  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);

  const popup = window.open(
    url,
    "_blank",
    [
      "noopener",
      "noreferrer",
      `width=${width}`,
      `height=${height}`,
      `left=${Math.round(left)}`,
      `top=${Math.round(top)}`,
    ].join(","),
  );

  /*
   * Additional protection for browsers that still expose the opener
   * relationship despite popup feature flags.
   */

  if (popup) {
    popup.opener = null;
  }
}

/* ==========================================================================
   Copy URL
   ========================================================================== */

/**
 * Modern equivalent of the legacy:
 *
 *   textarea
 *   document.execCommand("copy")
 *
 * Clipboard API is preferred when available.
 *
 * The old textarea/execCommand approach remains as the fallback so this
 * continues to work in older environments.
 */

async function copyShareUrl(pageUrl) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(pageUrl);

      return true;
    } catch {
      /*
       * Continue to legacy-compatible fallback.
       */
    }
  }

  return copyShareUrlFallback(pageUrl);
}

/* ==========================================================================
   Copy URL Fallback
   ========================================================================== */

function copyShareUrlFallback(pageUrl) {
  const textArea = document.createElement("textarea");

  textArea.value = pageUrl;

  textArea.setAttribute("readonly", "");

  textArea.setAttribute("aria-hidden", "true");

  /*
   * Keep the temporary control outside the visible viewport.
   */

  textArea.style.position = "fixed";
  textArea.style.insetInlineStart = "-9999px";
  textArea.style.insetBlockStart = "0";
  textArea.style.opacity = "0";

  document.body.appendChild(textArea);

  textArea.focus();
  textArea.select();

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  textArea.remove();

  return copied;
}

/* ==========================================================================
   Copy Event
   ========================================================================== */

/**
 * Emit one reusable event after copying.
 *
 * This lets the existing Toast system show feedback later without coupling
 * the Share component directly to the Toast implementation.
 */

function dispatchCopyEvent(root, success, pageUrl) {
  root.dispatchEvent(
    new CustomEvent("share:copy", {
      bubbles: true,

      detail: {
        success,
        url: pageUrl,
      },
    }),
  );
}

/* ==========================================================================
   Close Other Shares
   ========================================================================== */

function closeOtherShares(activeController) {
  shareControllers.forEach((controller) => {
    if (controller !== activeController && controller.isOpen) {
      controller.close();
    }
  });
}

/* ==========================================================================
   Share Controller
   ========================================================================== */

class ShareController {
  constructor(root) {
    this.root = root;

    this.toggle = root.querySelector(TOGGLE_SELECTOR);

    this.menu = root.querySelector(MENU_SELECTOR);

    this.platformLinks = [...root.querySelectorAll(PLATFORM_SELECTOR)];

    if (!this.toggle || !this.menu) {
      this.isValid = false;

      return;
    }

    this.isValid = true;
    this.isOpen = false;

    this.handleToggle = this.handleToggle.bind(this);

    this.handlePlatformClick = this.handlePlatformClick.bind(this);

    this.handleDocumentClick = this.handleDocumentClick.bind(this);

    this.handleKeydown = this.handleKeydown.bind(this);

    this.init();
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */

  init() {
    this.root.dataset.shareState = "closed";

    this.toggle.setAttribute("aria-expanded", "false");

    this.menu.setAttribute("aria-hidden", "true");

    this.setActionsFocusable(false);

    this.toggle.addEventListener("click", this.handleToggle);

    this.platformLinks.forEach((link) => {
      link.addEventListener("click", this.handlePlatformClick);
    });

    document.addEventListener("click", this.handleDocumentClick);

    document.addEventListener("keydown", this.handleKeydown);
  }

  /* ------------------------------------------------------------------------
     Action Focusability
     ------------------------------------------------------------------------ */

  setActionsFocusable(enabled) {
    this.platformLinks.forEach((link) => {
      if (enabled) {
        link.removeAttribute("tabindex");
      } else {
        link.setAttribute("tabindex", "-1");
      }
    });
  }

  /* ------------------------------------------------------------------------
     Toggle
     ------------------------------------------------------------------------ */

  handleToggle(event) {
    event.preventDefault();
    event.stopPropagation();

    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /* ------------------------------------------------------------------------
     Open
     ------------------------------------------------------------------------ */

  open() {
    closeOtherShares(this);

    this.isOpen = true;

    this.root.dataset.shareState = "open";

    this.toggle.setAttribute("aria-expanded", "true");

    this.menu.setAttribute("aria-hidden", "false");

    this.setActionsFocusable(true);
  }

  /* ------------------------------------------------------------------------
     Close
     ------------------------------------------------------------------------ */

  close(returnFocus = false) {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;

    this.root.dataset.shareState = "closed";

    this.toggle.setAttribute("aria-expanded", "false");

    this.menu.setAttribute("aria-hidden", "true");

    this.setActionsFocusable(false);

    if (returnFocus) {
      this.toggle.focus();
    }
  }

  /* ------------------------------------------------------------------------
     Platform Click
     ------------------------------------------------------------------------ */

  async handlePlatformClick(event) {
    const action = event.currentTarget;

    const platform = action.dataset.sharePlatform;

    if (!platform) {
      return;
    }

    event.preventDefault();

    const pageUrl = getShareUrl(this.root);

    /* ----------------------------------------------------------------------
       Copy
       ---------------------------------------------------------------------- */

    if (platform === "copy") {
      const success = await copyShareUrl(pageUrl);

      dispatchCopyEvent(this.root, success, pageUrl);

      this.close();

      return;
    }

    /* ----------------------------------------------------------------------
       External Share
       ---------------------------------------------------------------------- */

    const shareUrl = buildShareUrl(platform, pageUrl);

    if (!shareUrl) {
      return;
    }

    openShareWindow(shareUrl);

    this.close();
  }

  /* ------------------------------------------------------------------------
     Outside Click
     ------------------------------------------------------------------------ */

  handleDocumentClick(event) {
    if (!this.isOpen) {
      return;
    }

    if (this.root.contains(event.target)) {
      return;
    }

    this.close();
  }

  /* ------------------------------------------------------------------------
     Keyboard
     ------------------------------------------------------------------------ */

  handleKeydown(event) {
    if (!this.isOpen) {
      return;
    }

    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();

    this.close(true);
  }
}

/* ==========================================================================
   Init
   ========================================================================== */

function initShare(scope = document) {
  scope.querySelectorAll(SHARE_SELECTOR).forEach((root) => {
    if (root.dataset.shareInitialized === "true") {
      return;
    }

    const controller = new ShareController(root);

    if (!controller.isValid) {
      return;
    }

    root.dataset.shareInitialized = "true";

    shareControllers.push(controller);
  });
}

/* ==========================================================================
   Exports
   ========================================================================== */

export { ShareController, initShare };

import { initClipboardActions } from "./clipboard";
import { initFileUploads } from "./file-upload";
import { initOtpInputs } from "./otp";
import { initPasswordToggles } from "./password-toggle";
import { initFormValidation } from "./validation";

/* ==========================================================================
   Form Initialization
   ========================================================================== */

/**
 * Initializes native form enhancements within a document or component root.
 *
 * Each feature module is responsible for idempotency, allowing this function
 * to run again when a page fragment is mounted dynamically.
 *
 * @param {Document | Element | DocumentFragment} root
 */
export function initForms(root = document) {
  initPasswordToggles(root);
  initClipboardActions(root);
  initFileUploads(root);
  initOtpInputs(root);
  initFormValidation(root);
}

/* ==========================================================================
   Public API
   ========================================================================== */

export {
  initClipboardActions,
  initFileUploads,
  initFormValidation,
  initOtpInputs,
  initPasswordToggles,
};

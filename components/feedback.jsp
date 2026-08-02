<%--
==============================================================================
Saudi Exchange Feedback Purpose
------------------------------------------------------------------------------
Global feedback control and drawer. Contains: - Floating feedback tab - Feedback
form drawer Rendered once in the shared theme.
==============================================================================
--%>

<!-- ==========================================================================
     Feedback Control
     ========================================================================== -->

<button
  class="feedback-tab"
  type="button"
  data-drawer-open="feedback-drawer"
  aria-controls="feedback-drawer"
  aria-expanded="false"
  aria-label="Send website feedback"
>
  <%-- Future feedback icon:

  <span
    class="feedback-tab__icon has-icon icon-mailbox-split"
    aria-hidden="true"
  ></span>
  --%>

  <span class="feedback-tab__label"> Feedback </span>
</button>

<!-- ==========================================================================
     Feedback Drawer
     ========================================================================== -->

<aside
  id="feedback-drawer"
  class="drawer feedback-drawer"
  data-drawer="feedback-drawer"
  aria-hidden="true"
>
  <div
    class="drawer-backdrop"
    data-drawer-close="feedback-drawer"
    aria-hidden="true"
  ></div>

  <div
    class="drawer-panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="feedback-title"
    aria-describedby="feedback-description"
    tabindex="-1"
    data-drawer-panel
  >
    <header class="drawer-header">
      <div class="drawer-header__content">
        <h2 id="feedback-title" class="drawer-title">Share your feedback</h2>

        <p id="feedback-description" class="drawer-text">
          Help us improve your website experience.
        </p>
      </div>

      <button
        class="drawer-close has-icon icon-close-x"
        type="button"
        data-drawer-close="feedback-drawer"
        aria-label="Close feedback form"
      ></button>
    </header>

    <div class="drawer-body">
      <form
        id="feedback-form"
        class="form feedback-form"
        data-feedback-form
        novalidate
      >
        <!-- =========================================================
                     Submission Status
                     ========================================================= -->

        <div
          class="feedback-form__status"
          data-feedback-status
          role="status"
          aria-live="polite"
          hidden
        ></div>

        <!-- =========================================================
                     Feedback Type
                     ========================================================= -->

        <fieldset class="form-fieldset">
          <legend class="form-legend">Feedback type</legend>

          <div class="feedback-form__types">
            <div class="form-check">
              <input
                id="feedback-suggestion"
                type="radio"
                name="feedbackType"
                value="suggestion"
                checked
              />

              <label for="feedback-suggestion"> Suggestion </label>
            </div>

            <div class="form-check">
              <input
                id="feedback-issue"
                type="radio"
                name="feedbackType"
                value="issue"
              />

              <label for="feedback-issue"> Report an issue </label>
            </div>

            <div class="form-check">
              <input
                id="feedback-compliment"
                type="radio"
                name="feedbackType"
                value="compliment"
              />

              <label for="feedback-compliment"> Compliment </label>
            </div>
          </div>
        </fieldset>

        <!-- =========================================================
                     Message
                     ========================================================= -->

        <div class="form-group" data-feedback-message-group>
          <label class="form-label" for="feedback-message">
            Your feedback

            <span class="form-required" aria-hidden="true"> * </span>
          </label>

          <textarea
            id="feedback-message"
            class="form-control"
            name="message"
            rows="6"
            maxlength="1000"
            required
            aria-describedby="feedback-message-help feedback-message-count feedback-message-error"
            placeholder="Describe your experience or suggestion."
          ></textarea>

          <div class="feedback-form__meta">
            <span id="feedback-message-help" class="form-help">
              Do not include confidential or sensitive information.
            </span>

            <span
              id="feedback-message-count"
              class="form-help"
              data-feedback-character-count
            >
              0 / 1000
            </span>
          </div>

          <p
            id="feedback-message-error"
            class="form-error"
            data-feedback-message-error
            hidden
          >
            Enter your feedback.
          </p>
        </div>

        <!-- =========================================================
                     Email
                     ========================================================= -->

        <div class="form-group" data-feedback-email-group>
          <label class="form-label" for="feedback-email">
            Email address

            <span class="text-muted"> (optional) </span>
          </label>

          <input
            id="feedback-email"
            class="form-control"
            name="email"
            type="email"
            autocomplete="email"
            aria-describedby="feedback-email-help feedback-email-error"
            placeholder="name@example.com"
          />

          <p id="feedback-email-help" class="form-help">
            Provide your email only if you would like a response.
          </p>

          <p
            id="feedback-email-error"
            class="form-error"
            data-feedback-email-error
            hidden
          >
            Enter a valid email address.
          </p>
        </div>

        <!-- =========================================================
                     Current Page
                     ========================================================= -->

        <div class="form-check">
          <input
            id="feedback-include-page"
            type="checkbox"
            name="includePage"
            checked
          />

          <label for="feedback-include-page">
            Include the current page address
          </label>
        </div>

        <input type="hidden" name="pageUrl" data-feedback-page-url />
      </form>
    </div>

    <footer class="drawer-footer">
      <div class="feedback-form__actions">
        <button
          class="btn btn-outline-primary"
          type="button"
          data-drawer-close="feedback-drawer"
        >
          Cancel
        </button>

        <button class="btn btn-primary" type="submit" form="feedback-form">
          Send feedback
        </button>
      </div>
    </footer>
  </div>
</aside>

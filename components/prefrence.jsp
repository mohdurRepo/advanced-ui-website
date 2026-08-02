<%--
==============================================================================
Saudi Exchange Display Preferences Purpose
------------------------------------------------------------------------------
Global drawer for theme and accessibility preferences. Rendered once in the
shared theme. Controls: - Theme - Text size - Accent color - High contrast -
Reduced motion - Reset preferences
==============================================================================
--%>

<aside
  id="preferences-drawer"
  class="drawer preferences-drawer"
  data-drawer="preferences-drawer"
  aria-hidden="true"
>
  <div
    class="drawer-backdrop"
    data-drawer-close="preferences-drawer"
    aria-hidden="true"
  ></div>

  <div
    class="drawer-panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="preferences-title"
    aria-describedby="preferences-description"
    tabindex="-1"
    data-drawer-panel
  >
    <header class="drawer-header">
      <div class="drawer-header__content">
        <h2 id="preferences-title" class="drawer-title">Display preferences</h2>

        <p id="preferences-description" class="drawer-text">
          Personalize the website’s appearance and accessibility.
        </p>
      </div>

      <button
        class="drawer-close has-icon icon-close-x"
        type="button"
        data-drawer-close="preferences-drawer"
        aria-label="Close display preferences"
      ></button>
    </header>

    <div class="drawer-body preferences-body">
      <!-- =============================================================
                 Theme
                 ============================================================= -->

      <fieldset class="preferences-group">
        <legend class="preferences-label">Theme</legend>

        <p class="preferences-help">
          Choose how the website selects its color theme.
        </p>

        <div
          class="preferences-choice-grid"
          role="group"
          aria-label="Theme options"
        >
          <button
            class="preferences-choice"
            type="button"
            data-preference="theme"
            data-preference-set="system"
            aria-pressed="false"
          >
            <span
              class="preferences-choice__icon has-icon icon-theme-palette"
              aria-hidden="true"
            ></span>

            <span class="preferences-choice__content">
              <strong>System</strong>
              <small>Use your device setting</small>
            </span>

            <span
              class="preferences-choice__check has-icon icon-check"
              aria-hidden="true"
            ></span>
          </button>

          <button
            class="preferences-choice"
            type="button"
            data-preference="theme"
            data-preference-set="light"
            aria-pressed="false"
          >
            <span
              class="preferences-choice__icon has-icon icon-sun"
              aria-hidden="true"
            ></span>

            <span class="preferences-choice__content">
              <strong>Light</strong>
              <small>Use light surfaces</small>
            </span>

            <span
              class="preferences-choice__check has-icon icon-check"
              aria-hidden="true"
            ></span>
          </button>

          <button
            class="preferences-choice"
            type="button"
            data-preference="theme"
            data-preference-set="dark"
            aria-pressed="false"
          >
            <span
              class="preferences-choice__icon has-icon icon-panel-dashboard"
              aria-hidden="true"
            ></span>

            <span class="preferences-choice__content">
              <strong>Dark</strong>
              <small>Use dark surfaces</small>
            </span>

            <span
              class="preferences-choice__check has-icon icon-check"
              aria-hidden="true"
            ></span>
          </button>
        </div>
      </fieldset>

      <!-- =============================================================
                 Text Size
                 ============================================================= -->

      <fieldset class="preferences-group">
        <legend class="preferences-label">Text size</legend>

        <p class="preferences-help">
          Adjust text without changing the size of page layouts.
        </p>

        <div
          class="preferences-text-size"
          role="group"
          aria-label="Text-size controls"
        >
          <button
            class="preferences-text-size__button"
            type="button"
            data-font-decrease
            aria-label="Decrease text size"
          >
            <span class="has-icon icon-minus-line" aria-hidden="true"></span>

            <span aria-hidden="true">A</span>
          </button>

          <button
            class="preferences-text-size__reset"
            type="button"
            data-font-reset
            aria-label="Reset text size to default"
            aria-pressed="false"
          >
            <span class="preferences-text-size__sample" aria-hidden="true">
              Aa
            </span>

            <span class="preferences-text-size__label"> Default </span>
          </button>

          <button
            class="preferences-text-size__button"
            type="button"
            data-font-increase
            aria-label="Increase text size"
          >
            <span aria-hidden="true">A</span>

            <span class="has-icon icon-add-plus" aria-hidden="true"></span>
          </button>
        </div>

        <p
          class="preferences-current-value"
          data-font-size-status
          role="status"
          aria-live="polite"
        >
          Default text size
        </p>
      </fieldset>

      <!-- =============================================================
                 Accent Color
                 ============================================================= -->

      <fieldset class="preferences-group">
        <legend class="preferences-label">Accent color</legend>

        <p class="preferences-help">
          Select the color used for actions, links, and focus indicators.
        </p>

        <div
          class="preferences-accents"
          role="group"
          aria-label="Accent-color options"
        >
          <div class="preferences-accent-option">
            <button
              class="preferences-accent preferences-accent--blue"
              type="button"
              data-preference="accent"
              data-preference-set="blue"
              aria-label="Use blue accent"
              aria-pressed="false"
            >
              <span class="has-icon icon-check" aria-hidden="true"></span>
            </button>

            <span class="preferences-accent-option__label"> Blue </span>
          </div>

          <div class="preferences-accent-option">
            <button
              class="preferences-accent preferences-accent--navy"
              type="button"
              data-preference="accent"
              data-preference-set="navy"
              aria-label="Use navy accent"
              aria-pressed="false"
            >
              <span class="has-icon icon-check" aria-hidden="true"></span>
            </button>

            <span class="preferences-accent-option__label"> Navy </span>
          </div>

          <div class="preferences-accent-option">
            <button
              class="preferences-accent preferences-accent--teal"
              type="button"
              data-preference="accent"
              data-preference-set="teal"
              aria-label="Use teal accent"
              aria-pressed="false"
            >
              <span class="has-icon icon-check" aria-hidden="true"></span>
            </button>

            <span class="preferences-accent-option__label"> Teal </span>
          </div>
        </div>
      </fieldset>

      <!-- =============================================================
                 Accessibility
                 ============================================================= -->

      <fieldset class="preferences-group">
        <legend class="preferences-label">Accessibility</legend>

        <p class="preferences-help">
          Increase visual distinction or reduce non-essential motion.
        </p>

        <div class="preferences-toggle-list">
          <button
            class="preferences-toggle-option"
            type="button"
            data-preference-toggle="contrast"
            data-preference-on="high"
            data-preference-off="normal"
            aria-pressed="false"
          >
            <span
              class="preferences-toggle-option__icon has-icon icon-analytics-filter"
              aria-hidden="true"
            ></span>

            <span class="preferences-toggle-option__content">
              <strong>High contrast</strong>

              <small> Strengthen text, borders, and focus indicators. </small>
            </span>

            <span
              class="preferences-toggle-option__control"
              aria-hidden="true"
            ></span>
          </button>

          <button
            class="preferences-toggle-option"
            type="button"
            data-preference-toggle="motion"
            data-preference-on="reduce"
            data-preference-off="normal"
            aria-pressed="false"
          >
            <span
              class="preferences-toggle-option__icon has-icon icon-sync-refresh"
              aria-hidden="true"
            ></span>

            <span class="preferences-toggle-option__content">
              <strong>Reduce motion</strong>

              <small> Minimize animations and smooth scrolling. </small>
            </span>

            <span
              class="preferences-toggle-option__control"
              aria-hidden="true"
            ></span>
          </button>
        </div>
      </fieldset>
    </div>

    <footer class="drawer-footer preferences-footer">
      <button
        class="btn btn-outline-primary btn-block has-icon icon-sync-refresh"
        type="button"
        data-preferences-reset
      >
        Reset display preferences
      </button>
    </footer>
  </div>
</aside>

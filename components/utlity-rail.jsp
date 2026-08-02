<%--
==============================================================================
Saudi Exchange Global Utility Rail Purpose
------------------------------------------------------------------------------
Fixed utility rail displayed on every page. Contains only the trigger buttons.
Related components are implemented separately: - authentication.jsp -
preferences.jsp - feedback.jsp - global-widgets.jsp
==============================================================================
--%>

<!-- ==========================================================================
     Utility Rail
     ========================================================================== -->

<aside class="utility-rail" data-utility-rail aria-label="Website tools">
  <div class="utility-rail__group">
    <!-- ===============================================================
             Search
             =============================================================== -->

    <button
      class="utility-rail__action"
      type="button"
      data-search-toggle
      aria-label="Open search"
      title="Search"
    >
      <span
        class="utility-rail__icon has-icon icon-search icon-lg"
        aria-hidden="true"
      ></span>

      <span class="utility-rail__label"> Search </span>
    </button>

    <!-- ===============================================================
             Watchlist
             Authenticated Users
             =============================================================== -->

    <button
      class="utility-rail__action"
      type="button"
      data-drawer-open="watchlist-drawer"
      data-authenticated-only
      aria-controls="watchlist-drawer"
      aria-expanded="false"
      aria-label="Open watchlist"
      title="Watchlist"
    >
      <span
        class="utility-rail__icon has-icon icon-bookmark-ribbon icon-lg"
        aria-hidden="true"
      ></span>

      <span class="utility-rail__label"> Watchlist </span>

      <!-- Static placeholder.
                 Will be replaced by Portal data later. -->

      <span
        class="utility-rail__badge"
        data-watchlist-count
        aria-label="3 watchlist items"
      >
        3
      </span>
    </button>

    <!-- ===============================================================
             Guest Login
             =============================================================== -->

    <button
      class="utility-rail__action"
      type="button"
      data-modal-open="loginModal"
      data-guest-only
      aria-controls="loginModal"
      aria-expanded="false"
      aria-label="Log in to use watchlist"
      title="Log in to use watchlist"
    >
      <span
        class="utility-rail__icon has-icon icon-panel-dashboard icon-lg"
        aria-hidden="true"
      ></span>

      <span class="utility-rail__label"> Watchlist Login </span>
    </button>

    <!-- ===============================================================
             Display Preferences
             =============================================================== -->

    <button
      class="utility-rail__action"
      type="button"
      data-drawer-open="preferences-drawer"
      aria-controls="preferences-drawer"
      aria-expanded="false"
      aria-label="Open display preferences"
      title="Display preferences"
    >
      <span
        class="utility-rail__icon has-icon icon-theme-palette icon-lg"
        aria-hidden="true"
      ></span>

      <span class="utility-rail__label"> Preferences </span>
    </button>
  </div>
</aside>

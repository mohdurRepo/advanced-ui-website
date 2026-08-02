<%--
==============================================================================
Saudi Exchange Authentication and Watchlist Purpose
------------------------------------------------------------------------------
Global authenticated and guest-user components. Contains: - Watchlist drawer -
Guest login modal Rendered once in the shared theme.
==============================================================================
--%>

<!-- ==========================================================================
     Watchlist Drawer
     Authenticated-user experience
     ========================================================================== -->

<aside
  id="watchlist-drawer"
  class="drawer watchlist-drawer"
  data-drawer="watchlist-drawer"
  aria-hidden="true"
>
  <div
    class="drawer-backdrop"
    data-drawer-close="watchlist-drawer"
    aria-hidden="true"
  ></div>

  <div
    class="drawer-panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="watchlist-title"
    aria-describedby="watchlist-description"
    tabindex="-1"
    data-drawer-panel
  >
    <header class="drawer-header">
      <div class="drawer-header__content">
        <h2 id="watchlist-title" class="drawer-title">Watchlist</h2>

        <p id="watchlist-description" class="drawer-text">
          Follow the securities that matter to you.
        </p>
      </div>

      <button
        class="drawer-close has-icon icon-close-x"
        type="button"
        data-drawer-close="watchlist-drawer"
        aria-label="Close watchlist"
      ></button>
    </header>

    <div class="drawer-body">
      <div class="watchlist" data-watchlist>
        <!-- =========================================================
                     User Summary
                     ========================================================= -->

        <section class="watchlist-user" aria-labelledby="watchlist-user-name">
          <div
            class="watchlist-user__avatar has-icon icon-panel-dashboard"
            aria-hidden="true"
          ></div>

          <div class="watchlist-user__content">
            <p class="watchlist-user__label">Signed in as</p>

            <h3
              id="watchlist-user-name"
              class="watchlist-user__name"
              data-watchlist-user-name
            >
              Ahmed Al Saud
            </h3>

            <p class="watchlist-user__email" data-watchlist-user-email>
              ahmed@example.com
            </p>
          </div>

          <button
            class="watchlist-user__logout btn btn-outline-danger btn-sm has-icon icon-logout-door"
            type="button"
            data-auth-logout
          >
            Logout
          </button>
        </section>

        <!-- =========================================================
                     Live Status
                     ========================================================= -->

        <div
          class="watchlist__status"
          data-watchlist-status
          role="status"
          aria-live="polite"
          hidden
        ></div>

        <!-- =========================================================
                     Saved Securities Heading
                     ========================================================= -->

        <div class="watchlist__section-header">
          <div>
            <h3 class="watchlist__section-title">Saved securities</h3>

            <p class="watchlist__section-text">
              Your selected market instruments.
            </p>
          </div>

          <span
            class="watchlist__section-count"
            data-watchlist-count
            aria-label="3 saved securities"
          >
            3
          </span>
        </div>

        <!-- =========================================================
                     Saved Securities
                     ========================================================= -->

        <ul
          class="watchlist__list"
          data-watchlist-list
          aria-label="Saved securities"
        >
          <!-- Saudi Aramco -->

          <li
            class="watchlist__item"
            data-watchlist-item
            data-security-id="2222"
          >
            <a class="watchlist__link" href="/company-profile.html?symbol=2222">
              <span class="watchlist__identity">
                <strong class="watchlist__symbol"> 2222 </strong>

                <span class="watchlist__name"> Saudi Aramco </span>
              </span>

              <span class="watchlist__market">
                <strong class="watchlist__price"> 27.40 </strong>

                <span class="watchlist__change is-positive">
                  <span
                    class="has-icon icon-triangle-up"
                    aria-hidden="true"
                  ></span>

                  <span>+0.55%</span>
                </span>
              </span>
            </a>

            <button
              class="watchlist__remove has-icon icon-close-x"
              type="button"
              data-watchlist-remove
              aria-label="Remove Saudi Aramco from watchlist"
              title="Remove from watchlist"
            ></button>
          </li>

          <!-- Al Rajhi Bank -->

          <li
            class="watchlist__item"
            data-watchlist-item
            data-security-id="1120"
          >
            <a class="watchlist__link" href="/company-profile.html?symbol=1120">
              <span class="watchlist__identity">
                <strong class="watchlist__symbol"> 1120 </strong>

                <span class="watchlist__name"> Al Rajhi Bank </span>
              </span>

              <span class="watchlist__market">
                <strong class="watchlist__price"> 94.10 </strong>

                <span class="watchlist__change is-negative">
                  <span
                    class="has-icon icon-triangle-down"
                    aria-hidden="true"
                  ></span>

                  <span>−0.21%</span>
                </span>
              </span>
            </a>

            <button
              class="watchlist__remove has-icon icon-close-x"
              type="button"
              data-watchlist-remove
              aria-label="Remove Al Rajhi Bank from watchlist"
              title="Remove from watchlist"
            ></button>
          </li>

          <!-- SABIC -->

          <li
            class="watchlist__item"
            data-watchlist-item
            data-security-id="2010"
          >
            <a class="watchlist__link" href="/company-profile.html?symbol=2010">
              <span class="watchlist__identity">
                <strong class="watchlist__symbol"> 2010 </strong>

                <span class="watchlist__name"> SABIC </span>
              </span>

              <span class="watchlist__market">
                <strong class="watchlist__price"> 66.70 </strong>

                <span class="watchlist__change is-positive">
                  <span
                    class="has-icon icon-triangle-up"
                    aria-hidden="true"
                  ></span>

                  <span>+0.83%</span>
                </span>
              </span>
            </a>

            <button
              class="watchlist__remove has-icon icon-close-x"
              type="button"
              data-watchlist-remove
              aria-label="Remove SABIC from watchlist"
              title="Remove from watchlist"
            ></button>
          </li>
        </ul>

        <!-- =========================================================
                     Empty State
                     ========================================================= -->

        <div class="watchlist__empty" data-watchlist-empty hidden>
          <span
            class="watchlist__empty-icon has-icon icon-bookmark-ribbon icon-2xl"
            aria-hidden="true"
          ></span>

          <h3 class="watchlist__empty-title">Your watchlist is empty</h3>

          <p class="watchlist__empty-text">
            Add securities to monitor them from this panel.
          </p>

          <a class="btn btn-outline-primary btn-sm" href="/markets.html">
            Browse securities
          </a>
        </div>
      </div>
    </div>

    <footer class="drawer-footer">
      <a class="btn btn-primary btn-block" href="/watchlist.html">
        <span>View full watchlist</span>

        <span
          class="has-icon icon-chevron-right icon-flip-rtl"
          aria-hidden="true"
        ></span>
      </a>
    </footer>
  </div>
</aside>

<!-- ==========================================================================
     Watchlist Login Modal
     Guest-user experience
     ========================================================================== -->

<div
  id="loginModal"
  class="modal modal-md modal-rounded modal-no-header modal-no-footer modal-visual"
  role="dialog"
  aria-modal="true"
  aria-hidden="true"
  aria-labelledby="loginModalTitle"
  aria-describedby="loginModalDescription"
  data-login-modal
>
  <div class="modal-backdrop" data-modal-close aria-hidden="true"></div>

  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-body">
        <!-- =========================================================
                     Heading
                     ========================================================= -->

        <div class="modal-login-heading">
          <div>
            <p class="modal-subtitle">My Watchlist</p>

            <h2 id="loginModalTitle" class="modal-title">Log in to continue</h2>

            <p id="loginModalDescription" class="modal-subtitle">
              Access your saved securities and personalized market tools.
            </p>
          </div>

          <button
            class="modal-close"
            type="button"
            data-modal-close
            aria-label="Close login modal"
          ></button>
        </div>

        <!-- =========================================================
                     Login Form
                     ========================================================= -->

        <form
          id="loginForm"
          class="form"
          action="#"
          method="post"
          data-login-form
          novalidate
        >
          <!-- General Error -->

          <div
            class="alert alert-danger"
            role="alert"
            aria-live="assertive"
            tabindex="-1"
            data-login-error
            hidden
          >
            <span
              class="alert-icon has-icon icon-info-warning"
              aria-hidden="true"
            ></span>

            <div class="alert-content">
              <p class="alert-title">Unable to log in</p>

              <p class="alert-text">Check your login details and try again.</p>
            </div>
          </div>

          <!-- Identity -->

          <div class="form-group">
            <label class="form-label" for="loginIdentity">
              User ID or email

              <span class="form-required" aria-hidden="true"> * </span>
            </label>

            <input
              id="loginIdentity"
              class="form-control"
              name="identity"
              type="text"
              autocomplete="username"
              placeholder="Enter your User ID or email"
              aria-describedby="loginIdentityError"
              required
            />

            <p
              id="loginIdentityError"
              class="form-error"
              data-field-error="identity"
              hidden
            >
              Enter your User ID or email.
            </p>
          </div>

          <!-- Password -->

          <div class="form-group">
            <div class="form-label-row">
              <label class="form-label" for="loginPassword">
                Password

                <span class="form-required" aria-hidden="true"> * </span>
              </label>

              <a href="/forgot-password.html"> Forgot password? </a>
            </div>

            <div class="form-field form-field-icon-end">
              <input
                id="loginPassword"
                class="form-control"
                name="password"
                type="password"
                autocomplete="current-password"
                placeholder="Enter your password"
                aria-describedby="loginPasswordError"
                required
              />

              <button
                class="form-field-action has-icon icon-eye"
                type="button"
                data-password-toggle
                aria-controls="loginPassword"
                aria-pressed="false"
                aria-label="Show password"
                title="Show password"
              ></button>
            </div>

            <p
              id="loginPasswordError"
              class="form-error"
              data-field-error="password"
              hidden
            >
              Enter your password.
            </p>
          </div>

          <!-- Remember Me -->

          <div class="form-check">
            <input
              id="loginRemember"
              name="remember"
              type="checkbox"
              value="1"
            />

            <label for="loginRemember"> Remember me </label>
          </div>

          <!-- Submit -->

          <button
            class="btn btn-light btn-block"
            type="submit"
            data-login-submit
          >
            <span data-login-submit-label> Log in </span>

            <span
              class="has-icon icon-chevron-right icon-flip-rtl"
              aria-hidden="true"
            ></span>
          </button>

          <!-- Register -->

          <p class="auth-alternative">
            <span>Don’t have an account?</span>

            <a href="/register.html"> Register now </a>
          </p>
        </form>
      </div>
    </div>
  </div>
</div>

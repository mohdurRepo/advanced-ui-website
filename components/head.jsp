<!-- ===============================================================
     Site Footer
================================================================ -->

<footer
  class="site-footer"
  aria-labelledby="site-footer-title"
>
  <div class="site-footer__surface">
    <div class="container">
      <h2
        id="site-footer-title"
        class="visually-hidden"
      >
        Saudi Exchange footer
      </h2>

      <div class="site-footer__main">
        <!-- =========================================================
             Brand and Contact
        ========================================================== -->

        <section
          class="site-footer__brand"
          aria-labelledby="site-footer-contact-title"
        >
          <div class="site-footer-brand">
            <a
              class="site-footer-brand__home"
              href="/wps/portal/saudiexchange_v3"
              aria-label="Saudi Exchange home"
            >
              <!-- Reading Logo from WCM Dynamically - START -->

              <c:if
                test="${fn:contains(
                  pageContext.request.locale.language,
                  'en'
                )}"
              >
                <wcm:initworkspace></wcm:initworkspace>

                <%
                  Workspace workspace =
                    (Workspace) pageContext.getAttribute(
                      Workspace.WCM_ERROR_KEY
                    );

                  RenderingContext renderingContext =
                    (RenderingContext) request.getAttribute(
                      Workspace.WCM_RENDERINGCONTEXT_KEY
                    );
                %>

                <wcm:setExplicitContext
                  path="tadawulv2_en/sa-tadawul/sa-home/sa-logo/logo"
                ></wcm:setExplicitContext>

                <wcm:content
                  pageDesign="TadawulV2_Design/LOGO/LOGO-FOOTER-PT"
                ></wcm:content>
              </c:if>

              <c:if
                test="${fn:contains(
                  pageContext.request.locale.language,
                  'ar'
                )}"
              >
                <wcm:initworkspace></wcm:initworkspace>

                <%
                  Workspace workspace =
                    (Workspace) pageContext.getAttribute(
                      Workspace.WCM_ERROR_KEY
                    );

                  RenderingContext renderingContext =
                    (RenderingContext) request.getAttribute(
                      Workspace.WCM_RENDERINGCONTEXT_KEY
                    );
                %>

                <wcm:setExplicitContext
                  path="tadawulv2_ar/sa-tadawul/sa-home/sa-logo/logo"
                ></wcm:setExplicitContext>

                <wcm:content
                  pageDesign="TadawulV2_Design/LOGO/LOGO-FOOTER-PT"
                ></wcm:content>
              </c:if>

              <!-- Reading Logo from WCM Dynamically - END -->
            </a>

            <div class="site-footer-brand__section">
              <h3
                id="site-footer-contact-title"
                class="site-footer-brand__title"
              >
                <fmt:message key="footer.contactus.title" />
              </h3>

              <p class="site-footer-brand__text">
                <fmt:message key="footer.contactus.description" />
              </p>

              <address class="site-footer-brand__address">
                <ul class="site-footer-brand__list">
                  <li>
                    <a
                      class="site-footer-brand__link"
                      href="mailto:csc@saudiexchange.sa"
                    >
                      <span
                        class="site-footer-brand__icon has-icon icon-inbox-email"
                        aria-hidden="true"
                      ></span>

                      <span>csc@saudiexchange.sa</span>
                    </a>
                  </li>

                  <li>
                    <a
                      class="site-footer-brand__link"
                      href="tel:+966920001919"
                    >
                      <span
                        class="site-footer-brand__icon has-icon icon-telephone-handle"
                        aria-hidden="true"
                      ></span>

                      <span dir="ltr">(+966) 92000 1919</span>
                    </a>
                  </li>
                </ul>
              </address>

              <a
                class="btn btn-link btn-arrow site-footer-brand__cta"
                href="/wps/portal/saudiexchange_v3/hidden/contact-us?locale=${pageContext.request.locale.language}"
              >
                <span>
                  <fmt:message key="footer.contactus" />
                </span>

                <span
                  class="has-icon icon-chevron-right icon-flip-rtl"
                  aria-hidden="true"
                ></span>
              </a>
            </div>
          </div>
        </section>

        <!-- =========================================================
             Footer Navigation
        ========================================================== -->

        <nav
          class="site-footer__navigation"
          aria-label="Footer navigation"
        >
          <!-- =======================================================
               Utility Pages
          ======================================================== -->

          <section
            class="site-footer-links"
            aria-labelledby="site-footer-utility-title"
          >
            <h3
              id="site-footer-utility-title"
              class="site-footer-links__title"
            >
              <fmt:message key="utility.pages" />
            </h3>

            <ul class="site-footer-links__list">
              <li>
                <a
                  class="site-footer-links__link"
                  href="/wps/portal/saudiexchange_v3/hidden/sitemap?locale=${pageContext.request.locale.language}"
                >
                  <fmt:message key="footer.sitemap" />
                </a>
              </li>

              <li>
                <a
                  class="site-footer-links__link"
                  href="/wps/portal/saudiexchange_v3/hidden/legal_notice?locale=${pageContext.request.locale.language}"
                >
                  <fmt:message key="footer.legalnotice" />
                </a>
              </li>

              <li>
                <a
                  class="site-footer-links__link"
                  href="/wps/portal/saudiexchange_v3/hidden/contact-us?locale=${pageContext.request.locale.language}"
                >
                  <fmt:message key="footer.contactus" />
                </a>
              </li>

              <li>
                <a
                  class="site-footer-links__link"
                  href="/wps/portal/saudiexchange_v3/hidden/privacy_policy?locale=${pageContext.request.locale.language}"
                >
                  <fmt:message key="footer.privacypolicy" />
                </a>
              </li>

              <li>
                <a
                  class="site-footer-links__link"
                  href="/wps/portal/saudiexchange_v3/hidden/feedback?locale=${pageContext.request.locale.language}"
                >
                  <fmt:message key="footer.feedback" />
                </a>
              </li>
            </ul>
          </section>

          <!-- =======================================================
               Other Pages
          ======================================================== -->

          <section
            class="site-footer-links"
            aria-labelledby="site-footer-other-title"
          >
            <h3
              id="site-footer-other-title"
              class="site-footer-links__title"
            >
              Other Pages
            </h3>

            <div class="site-footer-links__content">
              <!-- Reading Other Pages from WCM Dynamically - START -->

              <c:if
                test="${fn:contains(
                  pageContext.request.locale.language,
                  'en'
                )}"
              >
                <wcm:initworkspace></wcm:initworkspace>

                <%
                  Workspace workspace =
                    (Workspace) pageContext.getAttribute(
                      Workspace.WCM_ERROR_KEY
                    );

                  RenderingContext renderingContext =
                    (RenderingContext) request.getAttribute(
                      Workspace.WCM_RENDERINGCONTEXT_KEY
                    );
                %>

                <wcm:setExplicitContext
                  path="tadawulv2_en/sa-tadawul/sa-footer/popularpages"
                ></wcm:setExplicitContext>

                <wcm:content
                  pageDesign="TadawulV2_Design/PT-Footer/PT-POPULARPAGES"
                ></wcm:content>
              </c:if>

              <c:if
                test="${fn:contains(
                  pageContext.request.locale.language,
                  'ar'
                )}"
              >
                <wcm:initworkspace></wcm:initworkspace>

                <%
                  Workspace workspace =
                    (Workspace) pageContext.getAttribute(
                      Workspace.WCM_ERROR_KEY
                    );

                  RenderingContext renderingContext =
                    (RenderingContext) request.getAttribute(
                      Workspace.WCM_RENDERINGCONTEXT_KEY
                    );
                %>

                <wcm:setExplicitContext
                  path="tadawulv2_ar/sa-tadawul/sa-footer/popularpages"
                ></wcm:setExplicitContext>

                <wcm:content
                  pageDesign="TadawulV2_Design/PT-Footer/PT-POPULARPAGES"
                ></wcm:content>
              </c:if>

              <!-- Reading Other Pages from WCM Dynamically - END -->
            </div>
          </section>
        </nav>

        <!-- =========================================================
             Social Media
        ========================================================== -->

        <section
          class="site-footer__social"
          aria-labelledby="site-footer-social-title"
        >
          <h3
            id="site-footer-social-title"
            class="site-footer-social__title"
          >
            <fmt:message key="theme.socialmedia" />
          </h3>

          <ul
            class="site-footer-social"
            aria-label="Saudi Exchange social media accounts"
          >
            <li>
              <a
                class="site-footer-social__link has-icon icon-brand-x"
                href="https://twitter.com/tadawul"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow Saudi Exchange on X"
              ></a>
            </li>

            <li>
              <a
                class="site-footer-social__link has-icon icon-brand-whatsapp"
                href="https://wa.me/message/USWDLLJ2GIOIH1"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Contact Saudi Exchange on WhatsApp"
              ></a>
            </li>

            <li>
              <a
                class="site-footer-social__link has-icon icon-brand-facebook"
                href="https://www.facebook.com/pages/Saudi-Stock-Exchange-Tadawul/197908720243874"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow Saudi Exchange on Facebook"
              ></a>
            </li>

            <li>
              <a
                class="site-footer-social__link has-icon icon-brand-youtube"
                href="https://www.youtube.com/channel/UChsr6yDbez7LYgRIAW_yYrw"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow Saudi Exchange on YouTube"
              ></a>
            </li>

            <li>
              <a
                class="site-footer-social__link has-icon icon-brand-linkedin"
                href="REPLACE_WITH_COMPLETE_LINKEDIN_URL"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow Saudi Exchange on LinkedIn"
              ></a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>

  <!-- ===============================================================
       Footer Bottom
  ================================================================ -->

  <div class="site-footer-bottom">
    <div class="container site-footer-bottom__container">
      <p class="site-footer-bottom__text">
        &copy;
        <fmt:message key="theme.footer.copyrights1" />

        <time datetime="${year}">
          ${year}
        </time>

        <fmt:message key="theme.footer.copyrights2" />
      </p>
    </div>
  </div>
</footer>
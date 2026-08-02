<%@page import="com.ibm.portal.MetaDataProvider"%>
<%@page import="com.ibm.portal.MetaData"%>
<%@ page session="false" buffer="none"%>
<%@ taglib uri="http://java.sun.com/jsp/jstl/core" prefix="c"%>
<%@taglib uri="http://java.sun.com/jsp/jstl/fmt" prefix="fmt"%>
<%@ include file="../includePortalTaglibs.jspf"%>
<%@ taglib uri="http://java.sun.com/jsp/jstl/functions" prefix="fn"%>
<%@taglib uri="/WEB-INF/tld/portal.tld" prefix="portal"%>

<%@ taglib uri="/WEB-INF/tld/wcm.tld" prefix="wcm"%>
<%@ page import="com.ibm.workplace.wcm.api.*"%>

<c:set
    var="captchaEnabled"
    value="${wp.metadata[wp.selectionModel.selected]['tadawul.google.recaptcha.enabled']}" />
<fmt:setLocale value="${pageContext.request.locale.language}" />
<portal-core:constants />
<portal-core:defineObjects />
<portal-core:stateBase />
<portal-core:lazy-set var="themeWebDAVBaseURI"
	elExpression="wp.themeList.current.metadata['com.ibm.portal.theme.template.ref']" />
<fmt:setBundle basename="nls.tadawul.theme.ThemeLocalization" />
<%-- This file displays navigation for a given type --%>
<%-- Types:
				top: displays the children of level 0
				primary: displays the children of level 1
				secondary: displays the children of levels 2 and 3
 --%>
<%-- lazy load the selection path array --%>
<portal-core:lazy-set var="selectionPath"
	elExpression="wp.selectionModel.selectionPath" />
<c:set var="currenturl" scope="request"
	value="${wp.selectionModel.selected.metadata['com.ibm.portal.friendly.name']}" />
<c:set var="currentTitle" value="${wp.selectionModel.selected.title}"
	scope="request" />

<portlet:actionURL var="logout">
	<portlet:param name="javax.portlet.action" value="logout" />
</portlet:actionURL>

<%-- true if hidden pages should be shown in the navigation --%>
<portal-core:lazy-set var="showHiddenPages" elExpression== "wp.publicRenderParam['{http://www.ibm.com/xmlns/prod/websphere/portal/publicparams}hiddenPages']" />
<fmt:setBundle basename="nls.tadawul.theme.ThemeLocalization" />
<%-- define the startLevel, endLevel, root CSS class and root accessibility label for each type of navigation --%>
<c:set
	value="${wp.metadata[wp.selectionModel.selected]['tadawul.google.tags.ga4.enabled']}"
	var="isGoogleAnalyticsGA4Enabled" />
<c:set var="localeSwitch" value="ar" />
<c:if test="${fn:contains(pageContext.request.locale.language,'ar')}">
	<c:set var="localeSwitch" value="en" />
</c:if>

<c:choose>
	<c:when test="${param.type == 'primary'}">
		<c:set var="startLevel" value="1" />
		<c:set var="endLevel" value="1" />
		<c:set var="rootClass" value="wpthemePrimaryNav wpthemeLeft" />
		<c:set var="rootLabel" value="Portal Application" />
	</c:when>
	<c:when test="${param.type == 'secondary'}">
		<c:set var="startLevel" value="2" />
		<c:set var="endLevel" value="3" />
		<%-- if the selection path length is longer than 4, 
	display the last two levels in the selection path instead of levels 2 and 3.
	This ensures the currently selected page appears in the navigation --%>
		<c:set var="selectionPathLength" value="${fn:length(selectionPath)}" />
		<c:if test="${(selectionPathLength > startLevel + 1)}">
			<c:set var="startLevel" value="${selectionPathLength - 2}" />
			<c:set var="endLevel" value="${selectionPathLength}" />
		</c:if>
		<c:set var="rootClass" value="wpthemeSecondaryNav" />
		<c:set var="rootLabel" value="Application" />
	</c:when>
	<c:when test="${param.type == 'tertiary'}">
		<c:set var="startLevel" value="4" />
		<c:set var="endLevel" value="4" />
		<c:set var="rootClass" value="wpthemeTertiaryNav" />
		<c:set var="rootLabel" value="Application Children" />
	</c:when>
	<c:otherwise>
		<%-- top and default values --%>
		<c:set var="startLevel" value="0" />
		<c:set var="endLevel" value="0" />
		<c:set var="rootClass" value="wpthemeHeaderNav" />
		<c:set var="rootLabel" value="Portal" />
	</c:otherwise>
</c:choose>

<%-- true if the user agent is a mobile device --%>
<portal-logic:if deviceClass="smartphone/tablet">
	<%-- <c:set var="isMobile" value="true"/>--%>
	<c:set var="isMobile" value="false" />
</portal-logic:if>

<c:set var="isHomePage"
	value="${wp.metadata[wp.selectionModel.selected]['isHomePage']}" />
<c:set var="displayFeedbackButton"
	value="${wp.metadata[wp.selectionModel.selected]['display.feedback.button']}" />

<c:if test="${isGoogleAnalyticsGA4Enabled != 'false'}">
	<!-- Google tag (gtag.js) -->
	<script async
		src="https://www.googletagmanager.com/gtag/js?id=G-6L51ZES5P5"></script>
	<script>
	  window.dataLayer = window.dataLayer || [];
	  function gtag(){dataLayer.push(arguments);}
	  gtag('js', new Date());
	
	  gtag('config', 'G-6L51ZES5P5');
	</script>

</c:if>


<%--
  ============================================================================
  Saudi Exchange — Shared Header (Desktop phase)
  ----------------------------------------------------------------------------
  Included:
    - Dynamic WCM logo
    - Refactored desktop navigation
    - Six visible Level-3 entries per column
    - Conditional featured content
    - Desktop language switch
    - Mobile burger trigger

  Not included yet:
    - Mobile overlay
    - Mobile <aside>

  Temporarily disabled:
    - Level-2 descriptions
    - Mega-menu panel titles
    - Theme toggle
  ============================================================================
--%>

<header class="site-header" data-site-header>
  <div class="site-header__inner">
    <%-- ======================================================================
         Brand
         ====================================================================== --%>

    <div class="site-header__brand">
      <c:choose>
        <c:when
          test="${fn:contains(pageContext.request.locale.language, 'ar')}"
        >
          <wcm:initworkspace />

          <%
            Workspace workspace =
              (Workspace) pageContext.getAttribute(Workspace.WCM_ERROR_KEY);

            RenderingContext renderingContext =
              (RenderingContext) request.getAttribute(
                Workspace.WCM_RENDERINGCONTEXT_KEY
              );
          %>

          <wcm:setExplicitContext
            path="tadawulv2_ar/sa-tadawul/sa-home/sa-logo/logo"
          />

          <wcm:content
            pageDesign="TadawulV2_Design/LOGO/LOGO-PT_v3"
          />
        </c:when>

        <c:otherwise>
          <wcm:initworkspace />

          <%
            Workspace workspace =
              (Workspace) pageContext.getAttribute(Workspace.WCM_ERROR_KEY);

            RenderingContext renderingContext =
              (RenderingContext) request.getAttribute(
                Workspace.WCM_RENDERINGCONTEXT_KEY
              );
          %>

          <wcm:setExplicitContext
            path="tadawulv2_en/sa-tadawul/sa-home/sa-logo/logo"
          />

          <wcm:content
            pageDesign="TadawulV2_Design/LOGO/LOGO-PT_v3"
          />
        </c:otherwise>
      </c:choose>
    </div>

    <%-- ======================================================================
         Desktop navigation
         ====================================================================== --%>

    <nav
      class="site-nav site-header__nav"
      aria-label="Main navigation"
      data-site-nav
    >
      <ul class="site-nav__list">
        <c:set
          var="navigationRoot"
          value="${wp.selectionModel.selectionPath[1]}"
        />

        <c:forEach
          items="${wp.navigationModel.children[navigationRoot]}"
          var="node"
          varStatus="level1Status"
        >
          <c:set
            var="hidePageFromNavL1"
            value="${node.metadata['navVisibility']}"
          />

          <c:set
            var="isExcludedLevel1Node"
            value="${
              node.objectID.uniqueName == 'com.tadawul.home'
              or node.objectID.uniqueName == 'com.tadawul.hiddenpage'
              or node.objectID.uniqueName == 'com.tadawul.home.v3'
              or node.objectID.uniqueName == 'com.tadawul.saudiexchange.home.v3'
              or node.objectID.uniqueName == 'com.tadawul.footer.v3'
            }"
          />

          <c:if
            test="${hidePageFromNavL1 != 'hide' and not isExcludedLevel1Node}"
          >
            <c:set
              var="megaMenuId"
              value="mega-menu-${level1Status.index}"
            />

            <li class="site-nav__item has-mega-menu">
              <button
                class="site-nav__trigger"
                type="button"
                aria-expanded="false"
                aria-controls="${megaMenuId}"
                data-mega-menu-trigger
              >
                <span class="site-nav__trigger-text">
                  <c:out value="${node.title}" />
                </span>

                <span
                  class="has-icon icon-chevron-down site-nav__trigger-icon"
                  aria-hidden="true"
                ></span>
              </button>

              <div
                class="mega-menu"
                id="${megaMenuId}"
                aria-hidden="true"
                data-mega-menu
              >
                <div class="mega-menu__container">
                  <%-- ==========================================================
                       Level 2 category rail
                       ========================================================== --%>

                  <div class="mega-menu__rail">
                    <div
                      class="mega-menu-nav"
                      role="tablist"
                      aria-label="${node.title}"
                    >
                      <c:forEach
                        items="${wp.navigationModel.children[node]}"
                        var="nodeL2"
                        varStatus="level2Status"
                      >
                        <c:set
                          var="hidePageFromNavL2"
                          value="${nodeL2.metadata['navVisibility']}"
                        />

                        <c:if test="${hidePageFromNavL2 != 'hide'}">
                          <c:set
                            var="level2TabId"
                            value="mega-tab-${level1Status.index}-${level2Status.index}"
                          />

                          <c:set
                            var="level2PanelId"
                            value="mega-panel-${level1Status.index}-${level2Status.index}"
                          />

                          <button
                            class="mega-menu-nav__item${level2Status.first ? ' is-active' : ''}"
                            id="${level2TabId}"
                            type="button"
                            role="tab"
                            aria-selected="${level2Status.first ? 'true' : 'false'}"
                            aria-controls="${level2PanelId}"
                            tabindex="${level2Status.first ? '0' : '-1'}"
                            data-mega-menu-tab
                          >
                            <span
                              class="has-icon icon-segment-container mega-menu-nav__icon"
                              aria-hidden="true"
                            ></span>

                            <span class="mega-menu-nav__body">
                              <span class="mega-menu-nav__heading">
                                <c:out value="${nodeL2.title}" />
                              </span>

                              <%--
                                Future Level-2 menu description:

                                <c:if test="${not empty nodeL2.description}">
                                  <span class="mega-menu-nav__text">
                                    <c:out value="${nodeL2.description}" />
                                  </span>
                                </c:if>
                              --%>
                            </span>

                            <span
                              class="has-icon icon-chevron-right icon-flip-rtl mega-menu-nav__arrow"
                              aria-hidden="true"
                            ></span>
                          </button>
                        </c:if>
                      </c:forEach>
                    </div>
                  </div>

                  <%-- ==========================================================
                       Level 2 content panels
                       ========================================================== --%>

                  <div class="mega-menu__content">
                    <c:forEach
                      items="${wp.navigationModel.children[node]}"
                      var="nodeL2"
                      varStatus="level2Status"
                    >
                      <c:set
                        var="hidePageFromNavL2"
                        value="${nodeL2.metadata['navVisibility']}"
                      />

                      <c:if test="${hidePageFromNavL2 != 'hide'}">
                        <c:set
                          var="level2TabId"
                          value="mega-tab-${level1Status.index}-${level2Status.index}"
                        />

                        <c:set
                          var="level2PanelId"
                          value="mega-panel-${level1Status.index}-${level2Status.index}"
                        />

                        <section
                          class="mega-menu-panel${level2Status.first ? ' is-active' : ''}"
                          id="${level2PanelId}"
                          role="tabpanel"
                          aria-labelledby="${level2TabId}"
                          aria-hidden="${level2Status.first ? 'false' : 'true'}"
                          data-mega-menu-panel
                          <c:if test="${not level2Status.first}">hidden</c:if>
                        >
                          <%--
                            Future panel title:

                            <h2 class="mega-menu-panel__title">
                              <c:out value="${nodeL2.title}" />
                            </h2>
                          --%>

                          <div class="mega-menu-panel__layout">
                            <%-- ==================================================
                                 Level 3 links: six visible entries per column
                                 ================================================== --%>

                            <c:set
                              var="visibleLevel3Counter"
                              value="0"
                              scope="page"
                            />

                            <c:forEach
                              items="${wp.navigationModel.children[nodeL2]}"
                              var="nodeL3"
                            >
                              <c:set
                                var="hidePageFromNavL3"
                                value="${nodeL3.metadata['navVisibility']}"
                              />

                              <c:if test="${hidePageFromNavL3 != 'hide'}">
                                <%-- Open a new column before entries 1, 7, 13... --%>

                                <c:if test="${visibleLevel3Counter mod 6 == 0}">
                                  <div class="mega-menu-panel__column">
                                </c:if>

                                <c:set
                                  var="hasVisibleL4"
                                  value="false"
                                  scope="page"
                                />

                                <c:if
                                  test="${wp.navigationModel.hasChildren[nodeL3]}"
                                >
                                  <c:forEach
                                    items="${wp.navigationModel.children[nodeL3]}"
                                    var="nodeL4VisibilityCheck"
                                  >
                                    <c:if
                                      test="${nodeL4VisibilityCheck.metadata['navVisibility'] != 'hide'}"
                                    >
                                      <c:set
                                        var="hasVisibleL4"
                                        value="true"
                                        scope="page"
                                      />
                                    </c:if>
                                  </c:forEach>
                                </c:if>

                                <c:choose>
                                  <%-- Level 3 with visible Level-4 children. --%>

                                  <c:when test="${hasVisibleL4}">
                                    <div class="mega-menu-flyout">
                                      <button
                                        class="mega-menu-flyout__trigger"
                                        type="button"
                                        aria-expanded="false"
                                        data-mega-menu-flyout-trigger
                                      >
                                        <span class="mega-menu-flyout__text">
                                          <c:out value="${nodeL3.title}" />
                                        </span>

                                        <span
                                          class="has-icon icon-chevron-right icon-flip-rtl mega-menu-flyout__icon"
                                          aria-hidden="true"
                                        ></span>
                                      </button>

                                      <div
                                        class="mega-menu-flyout__menu"
                                        data-mega-menu-flyout-menu
                                      >
                                        <%-- Optional Level-3 landing-page link.
                                             Kept without an icon, matching static. --%>

                                        <portal-navigation:urlGeneration
                                          contentNode="${wp.identification[nodeL3]}"
                                          keepNavigationalState="false"
                                        >
                                          <a
                                            class="mega-menu-flyout__link mega-menu-flyout__link--overview"
                                            href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
                                          >
                                            <c:out value="${nodeL3.title}" />
                                          </a>
                                        </portal-navigation:urlGeneration>

                                        <c:forEach
                                          items="${wp.navigationModel.children[nodeL3]}"
                                          var="nodeL4"
                                        >
                                          <c:set
                                            var="hidePageFromNavL4"
                                            value="${nodeL4.metadata['navVisibility']}"
                                          />

                                          <c:if
                                            test="${hidePageFromNavL4 != 'hide'}"
                                          >
                                            <portal-navigation:urlGeneration
                                              contentNode="${wp.identification[nodeL4]}"
                                              keepNavigationalState="false"
                                            >
                                              <a
                                                class="mega-menu-flyout__link"
                                                href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
                                              >
                                                <c:out value="${nodeL4.title}" />
                                              </a>
                                            </portal-navigation:urlGeneration>
                                          </c:if>
                                        </c:forEach>
                                      </div>
                                    </div>
                                  </c:when>

                                  <%-- Level 3 without visible Level-4 children. --%>

                                  <c:otherwise>
                                    <portal-navigation:urlGeneration
                                      contentNode="${wp.identification[nodeL3]}"
                                      keepNavigationalState="false"
                                    >
                                      <a
                                        class="mega-menu-panel__link"
                                        href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
                                      >
                                        <c:out value="${nodeL3.title}" />
                                      </a>
                                    </portal-navigation:urlGeneration>
                                  </c:otherwise>
                                </c:choose>

                                <c:set
                                  var="visibleLevel3Counter"
                                  value="${visibleLevel3Counter + 1}"
                                  scope="page"
                                />

                                <%-- Close columns after entries 6, 12, 18... --%>

                                <c:if test="${visibleLevel3Counter mod 6 == 0}">
                                  </div>
                                </c:if>
                              </c:if>
                            </c:forEach>

                            <%-- Close the final partially filled column. --%>

                            <c:if test="${visibleLevel3Counter mod 6 != 0}">
                              </div>
                            </c:if>

                            <%-- Careers link remains available for the relevant
                                 About section. It has no added chevron icon. --%>

                            <c:if
                              test="${nodeL2.objectID.uniqueName == 'com.tadawul.about.exchange.aboutus.v3'}"
                            >
                              <div class="mega-menu-panel__column">
                                <c:url
                                  var="careersUrl"
                                  value="https://careers.tadawulgroup.sa/"
                                >
                                  <c:param
                                    name="lang"
                                    value="${pageContext.request.locale.language == 'ar' ? 'ar' : 'en'}"
                                  />
                                </c:url>

                                <a
                                  class="mega-menu-panel__link mega-menu-panel__link--external"
                                  href="${careersUrl}"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <fmt:message key="theme.subMenue.career" />
                                </a>
                              </div>
                            </c:if>

                            <%-- ==================================================
                                 Conditional featured content from legacy header
                                 ================================================== --%>

                            <c:set
                              var="hasMegaMenuFeature"
                              value="${
                                node.objectID.uniqueName == 'com.tadawul.saudiexchange.ourmarkets.v3'
                                or node.objectID.uniqueName == 'com.tadawul.listing.v3'
                                or node.objectID.uniqueName == 'com.tadawul.listing.v3_update'
                                or node.objectID.uniqueName == 'com.tadawul.trading.v3'
                                or node.objectID.uniqueName == 'com.tadawul.trading.v3_update'
                                or node.objectID.uniqueName == 'com.tadawul.newsandreports.v3'
                                or node.objectID.uniqueName == 'com.tadawul.newsandreports.v3_update'
                                or node.objectID.uniqueName == 'com.tadawul.v3.rules.and.guidance'
                                or node.objectID.uniqueName == 'com.tadawul.aboutsaudiexchange.v3'
                                or node.objectID.uniqueName == 'com.tadawul.aboutsaudiexchange.v3_update'
                              }"
                            />

                            <c:if test="${hasMegaMenuFeature}">
                              <div class="mega-menu-panel__feature">
                                <c:choose>
                                  <%-- Our Market --%>

                                  <c:when
                                    test="${node.objectID.uniqueName == 'com.tadawul.saudiexchange.ourmarkets.v3'}"
                                  >
                                    <wcm:setExplicitContext
                                      path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Our market"
                                    />

                                    <wcm:content
                                      pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"
                                    />
                                  </c:when>

                                  <%-- Listing: retain legacy custom 400-listed box. --%>

                                  <c:when
                                    test="${
                                      node.objectID.uniqueName == 'com.tadawul.listing.v3'
                                      or node.objectID.uniqueName == 'com.tadawul.listing.v3_update'
                                    }"
                                  >
                                    <div class="menubondBox">
                                      <div class="menubondHdng">
                                        <fmt:message
                                          key="theme.menu.listing.right.400.info"
                                        />
                                      </div>

                                      <div class="menubondCont">
                                        <p>
                                          <fmt:message
                                            key="theme.menu.listing.right.400.desc"
                                          />
                                        </p>

                                        <c:choose>
                                          <c:when
                                            test="${fn:contains(pageContext.request.locale.language, 'ar')}"
                                          >
                                            <a
                                              class="visitBtn"
                                              href="https://www.saudiexchange.sa/Resources/400ListedSecurities/ar.html"
                                              target="_blank"
                                              rel="noopener noreferrer"
                                            >
                                              <fmt:message
                                                key="theme.menu.listing.right.cta"
                                              />
                                            </a>
                                          </c:when>

                                          <c:otherwise>
                                            <a
                                              class="visitBtn"
                                              href="https://www.saudiexchange.sa/Resources/400ListedSecurities/"
                                              target="_blank"
                                              rel="noopener noreferrer"
                                            >
                                              <fmt:message
                                                key="theme.menu.listing.right.cta"
                                              />
                                            </a>
                                          </c:otherwise>
                                        </c:choose>
                                      </div>
                                    </div>
                                  </c:when>

                                  <%-- Trading --%>

                                  <c:when
                                    test="${
                                      node.objectID.uniqueName == 'com.tadawul.trading.v3'
                                      or node.objectID.uniqueName == 'com.tadawul.trading.v3_update'
                                    }"
                                  >
                                    <wcm:setExplicitContext
                                      path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Trading"
                                    />

                                    <wcm:content
                                      pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"
                                    />
                                  </c:when>

                                  <%-- News and Reports --%>

                                  <c:when
                                    test="${
                                      node.objectID.uniqueName == 'com.tadawul.newsandreports.v3'
                                      or node.objectID.uniqueName == 'com.tadawul.newsandreports.v3_update'
                                    }"
                                  >
                                    <wcm:setExplicitContext
                                      path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/market news"
                                    />

                                    <wcm:content
                                      pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"
                                    />
                                  </c:when>

                                  <%-- Rules and Guidance --%>

                                  <c:when
                                    test="${node.objectID.uniqueName == 'com.tadawul.v3.rules.and.guidance'}"
                                  >
                                    <wcm:setExplicitContext
                                      path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Rules and Guidance"
                                    />

                                    <wcm:content
                                      pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"
                                    />
                                  </c:when>

                                  <%-- About Saudi Exchange --%>

                                  <c:when
                                    test="${
                                      node.objectID.uniqueName == 'com.tadawul.aboutsaudiexchange.v3'
                                      or node.objectID.uniqueName == 'com.tadawul.aboutsaudiexchange.v3_update'
                                    }"
                                  >
                                    <wcm:setExplicitContext
                                      path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/About Saudi Exchange"
                                    />

                                    <wcm:content
                                      pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"
                                    />
                                  </c:when>
                                </c:choose>
                              </div>
                            </c:if>
                          </div>
                        </section>
                      </c:if>
                    </c:forEach>
                  </div>
                </div>
              </div>
            </li>
          </c:if>
        </c:forEach>
      </ul>
    </nav>

    <%-- ======================================================================
         Header actions
         ====================================================================== --%>

    <div class="site-header__actions header-actions">
      <div class="header-actions__desktop">
        <c:choose>
          <c:when
            test="${fn:contains(pageContext.request.locale.language, 'ar')}"
          >
            <a
              class="header-lang-switch"
              href='<portal-navigation:url command="ChangeLanguage"><portal-navigation:urlParam name="locale" value="${localeSwitch}" /></portal-navigation:url>'
              aria-label="Switch to English"
              hreflang="en"
            >
              <span class="header-lang-switch__current">
                <fmt:message key="theme.header.lang.arabic" />
              </span>

              <span
                class="has-icon icon-globe icon-accent mobile-nav__language-icon"
                aria-hidden="true"
              ></span>
            </a>
          </c:when>

          <c:otherwise>
            <a
              class="header-lang-switch"
              href='<portal-navigation:url command="ChangeLanguage"><portal-navigation:urlParam name="locale" value="${localeSwitch}" /></portal-navigation:url>'
              aria-label="Switch to Arabic"
              hreflang="ar"
            >
              <span class="header-lang-switch__current">EN</span>

              <span
                class="has-icon icon-globe icon-accent mobile-nav__language-icon"
                aria-hidden="true"
              ></span>
            </a>
          </c:otherwise>
        </c:choose>
      </div>
<%--
  ============================================================================
  Saudi Exchange — Mobile Navigation
  ----------------------------------------------------------------------------
  Place this block immediately after </header>.

  Matches the static structure:
    - mobile-nav-overlay
    - mobile-nav
    - mobile-nav__layout
    - mobile-nav__body
    - mobile-nav__menu
    - nested mobile-nav__submenu blocks

  Behavior:
    - Parent items with children render only as expand/collapse buttons.
    - Opening a parent shows its children directly.
    - No repeated "Our Market > Our Market" overview link.
    - Featured content is rendered conditionally using the legacy rules.
    - Theme controls are removed.
  ============================================================================
--%>

<div
  class="mobile-nav-overlay"
  data-mobile-nav-overlay
  aria-hidden="true"
></div>

<aside
  class="mobile-nav"
  id="mobile-nav"
  data-mobile-nav
  aria-hidden="true"
  aria-label="Mobile navigation"
>
  <div class="mobile-nav__layout">
    <%-- ======================================================================
         Mobile header
         ====================================================================== --%>

    <header class="mobile-nav__header">
      <div class="mobile-nav__brand">
        <c:choose>
          <c:when
            test="${fn:contains(pageContext.request.locale.language, 'ar')}"
          >
            <wcm:initworkspace />

            <%
              Workspace mobileWorkspace =
                (Workspace) pageContext.getAttribute(Workspace.WCM_ERROR_KEY);

              RenderingContext mobileRenderingContext =
                (RenderingContext) request.getAttribute(
                  Workspace.WCM_RENDERINGCONTEXT_KEY
                );
            %>

            <wcm:setExplicitContext
              path="tadawulv2_ar/sa-tadawul/sa-home/sa-logo/logo"
            />

            <wcm:content
              pageDesign="TadawulV2_Design/LOGO/LOGO-PT_v3"
            />
          </c:when>

          <c:otherwise>
            <wcm:initworkspace />

            <%
              Workspace mobileWorkspace =
                (Workspace) pageContext.getAttribute(Workspace.WCM_ERROR_KEY);

              RenderingContext mobileRenderingContext =
                (RenderingContext) request.getAttribute(
                  Workspace.WCM_RENDERINGCONTEXT_KEY
                );
            %>

            <wcm:setExplicitContext
              path="tadawulv2_en/sa-tadawul/sa-home/sa-logo/logo"
            />

            <wcm:content
              pageDesign="TadawulV2_Design/LOGO/LOGO-PT_v3"
            />
          </c:otherwise>
        </c:choose>
      </div>

      <button
        class="mobile-nav__close has-icon icon-close-x"
        type="button"
        data-mobile-nav-close
        aria-label="Close menu"
      ></button>
    </header>

    <%-- ======================================================================
         Language control
         ====================================================================== --%>

    <div class="mobile-nav__controls">
      <c:choose>
        <c:when
          test="${fn:contains(pageContext.request.locale.language, 'ar')}"
        >
          <a
            class="mobile-nav__language"
            href='<portal-navigation:url command="ChangeLanguage"><portal-navigation:urlParam name="locale" value="${localeSwitch}" /></portal-navigation:url>'
            aria-label="Switch to English"
            hreflang="en"
          >
            <span
              class="has-icon icon-globe icon-accent mobile-nav__language-icon"
              aria-hidden="true"
            ></span>

            <span class="mobile-nav__language-text">English</span>
          </a>
        </c:when>

        <c:otherwise>
          <a
            class="mobile-nav__language"
            href='<portal-navigation:url command="ChangeLanguage"><portal-navigation:urlParam name="locale" value="${localeSwitch}" /></portal-navigation:url>'
            aria-label="Switch to Arabic"
            hreflang="ar"
          >
            <span
              class="has-icon icon-globe icon-accent mobile-nav__language-icon"
              aria-hidden="true"
            ></span>

            <span class="mobile-nav__language-text">
              <fmt:message key="theme.header.lang.arabic" />
            </span>
          </a>
        </c:otherwise>
      </c:choose>
    </div>

    <%-- ======================================================================
         Mobile navigation body
         ====================================================================== --%>

    <nav class="mobile-nav__body" aria-label="Mobile main navigation">
      <ul class="mobile-nav__menu">
        <c:set
          var="mobileNavigationRoot"
          value="${wp.selectionModel.selectionPath[1]}"
        />

        <c:forEach
          items="${wp.navigationModel.children[mobileNavigationRoot]}"
          var="nodeL1"
          varStatus="mobileLevel1Status"
        >
          <c:set
            var="hidePageFromMobileNavL1"
            value="${nodeL1.metadata['navVisibility']}"
          />

          <c:set
            var="isExcludedMobileLevel1Node"
            value="${
              nodeL1.objectID.uniqueName == 'com.tadawul.home'
              or nodeL1.objectID.uniqueName == 'com.tadawul.hiddenpage'
              or nodeL1.objectID.uniqueName == 'com.tadawul.home.v3'
              or nodeL1.objectID.uniqueName == 'com.tadawul.saudiexchange.home.v3'
              or nodeL1.objectID.uniqueName == 'com.tadawul.footer.v3'
            }"
          />

          <c:if
            test="${hidePageFromMobileNavL1 != 'hide' and not isExcludedMobileLevel1Node}"
          >
            <c:set
              var="mobileLevel1Id"
              value="mobile-menu-l1-${mobileLevel1Status.index}"
            />

            <li
              class="mobile-nav__item${wp.navigationModel.hasChildren[nodeL1] ? ' has-submenu' : ''}"
            >
              <c:choose>
                <%-- ==========================================================
                     Level 1 with children
                     ========================================================== --%>

                <c:when test="${wp.navigationModel.hasChildren[nodeL1]}">
                  <button
                    class="mobile-nav__trigger"
                    type="button"
                    data-mobile-submenu-trigger
                    aria-expanded="false"
                    aria-controls="${mobileLevel1Id}"
                  >
                    <span class="mobile-nav__trigger-text">
                      <c:out value="${nodeL1.title}" />
                    </span>

                    <span
                      class="has-icon icon-chevron-down mobile-nav__trigger-icon"
                      aria-hidden="true"
                    ></span>
                  </button>

                  <div
                    class="mobile-nav__submenu"
                    id="${mobileLevel1Id}"
                    data-mobile-submenu
                    aria-hidden="true"
                    hidden
                  >
                    <ul class="mobile-nav__submenu-list">
                      <c:forEach
                        items="${wp.navigationModel.children[nodeL1]}"
                        var="nodeL2"
                        varStatus="mobileLevel2Status"
                      >
                        <c:set
                          var="hidePageFromMobileNavL2"
                          value="${nodeL2.metadata['navVisibility']}"
                        />

                        <c:if test="${hidePageFromMobileNavL2 != 'hide'}">
                          <c:set
                            var="mobileLevel2Id"
                            value="mobile-menu-l2-${mobileLevel1Status.index}-${mobileLevel2Status.index}"
                          />

                          <li
                            class="mobile-nav__submenu-item${wp.navigationModel.hasChildren[nodeL2] ? ' has-submenu' : ''}"
                          >
                            <c:choose>
                              <%-- ==============================================
                                   Level 2 with children
                                   ============================================== --%>

                              <c:when
                                test="${wp.navigationModel.hasChildren[nodeL2]}"
                              >
                                <button
                                  class="mobile-nav__subtrigger"
                                  type="button"
                                  data-mobile-submenu-trigger
                                  aria-expanded="false"
                                  aria-controls="${mobileLevel2Id}"
                                >
                                  <span class="mobile-nav__subtrigger-text">
                                    <c:out value="${nodeL2.title}" />
                                  </span>

                                  <span
                                    class="has-icon icon-chevron-down mobile-nav__subtrigger-icon"
                                    aria-hidden="true"
                                  ></span>
                                </button>

                                <div
                                  class="mobile-nav__submenu mobile-nav__submenu--nested"
                                  id="${mobileLevel2Id}"
                                  data-mobile-submenu
                                  aria-hidden="true"
                                  hidden
                                >
                                  <ul class="mobile-nav__submenu-list">
                                    <c:forEach
                                      items="${wp.navigationModel.children[nodeL2]}"
                                      var="nodeL3"
                                      varStatus="mobileLevel3Status"
                                    >
                                      <c:set
                                        var="hidePageFromMobileNavL3"
                                        value="${nodeL3.metadata['navVisibility']}"
                                      />

                                      <c:if
                                        test="${hidePageFromMobileNavL3 != 'hide'}"
                                      >
                                        <c:set
                                          var="hasVisibleMobileL4"
                                          value="false"
                                          scope="page"
                                        />

                                        <c:if
                                          test="${wp.navigationModel.hasChildren[nodeL3]}"
                                        >
                                          <c:forEach
                                            items="${wp.navigationModel.children[nodeL3]}"
                                            var="nodeL4VisibilityCheck"
                                          >
                                            <c:if
                                              test="${nodeL4VisibilityCheck.metadata['navVisibility'] != 'hide'}"
                                            >
                                              <c:set
                                                var="hasVisibleMobileL4"
                                                value="true"
                                                scope="page"
                                              />
                                            </c:if>
                                          </c:forEach>
                                        </c:if>

                                        <c:set
                                          var="mobileLevel3Id"
                                          value="mobile-menu-l3-${mobileLevel1Status.index}-${mobileLevel2Status.index}-${mobileLevel3Status.index}"
                                        />

                                        <li
                                          class="mobile-nav__submenu-item${hasVisibleMobileL4 ? ' has-submenu' : ''}"
                                        >
                                          <c:choose>
                                            <%-- ==================================
                                                 Level 3 with visible Level 4
                                                 ================================== --%>

                                            <c:when test="${hasVisibleMobileL4}">
                                              <button
                                                class="mobile-nav__subtrigger"
                                                type="button"
                                                data-mobile-submenu-trigger
                                                aria-expanded="false"
                                                aria-controls="${mobileLevel3Id}"
                                              >
                                                <span
                                                  class="mobile-nav__subtrigger-text"
                                                >
                                                  <c:out value="${nodeL3.title}" />
                                                </span>

                                                <span
                                                  class="has-icon icon-chevron-down mobile-nav__subtrigger-icon"
                                                  aria-hidden="true"
                                                ></span>
                                              </button>

                                              <div
                                                class="mobile-nav__submenu mobile-nav__submenu--nested"
                                                id="${mobileLevel3Id}"
                                                data-mobile-submenu
                                                aria-hidden="true"
                                                hidden
                                              >
                                                <ul
                                                  class="mobile-nav__submenu-list"
                                                >
                                                  <c:forEach
                                                    items="${wp.navigationModel.children[nodeL3]}"
                                                    var="nodeL4"
                                                  >
                                                    <c:set
                                                      var="hidePageFromMobileNavL4"
                                                      value="${nodeL4.metadata['navVisibility']}"
                                                    />

                                                    <c:if
                                                      test="${hidePageFromMobileNavL4 != 'hide'}"
                                                    >
                                                      <li
                                                        class="mobile-nav__submenu-item"
                                                      >
                                                        <portal-navigation:urlGeneration
                                                          contentNode="${wp.identification[nodeL4]}"
                                                          keepNavigationalState="false"
                                                        >
                                                          <a
                                                            class="mobile-nav__link"
                                                            href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
                                                          >
                                                            <c:out
                                                              value="${nodeL4.title}"
                                                            />
                                                          </a>
                                                        </portal-navigation:urlGeneration>
                                                      </li>
                                                    </c:if>
                                                  </c:forEach>
                                                </ul>
                                              </div>
                                            </c:when>

                                            <%-- ==================================
                                                 Level 3 direct link
                                                 ================================== --%>

                                            <c:otherwise>
                                              <portal-navigation:urlGeneration
                                                contentNode="${wp.identification[nodeL3]}"
                                                keepNavigationalState="false"
                                              >
                                                <a
                                                  class="mobile-nav__link"
                                                  href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
                                                >
                                                  <c:out value="${nodeL3.title}" />
                                                </a>
                                              </portal-navigation:urlGeneration>
                                            </c:otherwise>
                                          </c:choose>
                                        </li>
                                      </c:if>
                                    </c:forEach>

                                    <%-- Careers link --%>

                                    <c:if
                                      test="${nodeL2.objectID.uniqueName == 'com.tadawul.about.exchange.aboutus.v3'}"
                                    >
                                      <li class="mobile-nav__submenu-item">
                                        <c:url
                                          var="mobileCareersUrl"
                                          value="https://careers.tadawulgroup.sa/"
                                        >
                                          <c:param
                                            name="lang"
                                            value="${pageContext.request.locale.language == 'ar' ? 'ar' : 'en'}"
                                          />
                                        </c:url>

                                        <a
                                          class="mobile-nav__link mobile-nav__link--external"
                                          href="${mobileCareersUrl}"
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          <fmt:message
                                            key="theme.subMenue.career"
                                          />
                                        </a>
                                      </li>
                                    </c:if>
                                  </ul>

                                  <%-- ==========================================
                                       Featured content for this Level-2 section
                                       ========================================== --%>

                                  <c:set
                                    var="hasMobileFeature"
                                    value="${
                                      nodeL1.objectID.uniqueName == 'com.tadawul.saudiexchange.ourmarkets.v3'
                                      or nodeL1.objectID.uniqueName == 'com.tadawul.listing.v3'
                                      or nodeL1.objectID.uniqueName == 'com.tadawul.listing.v3_update'
                                      or nodeL1.objectID.uniqueName == 'com.tadawul.trading.v3'
                                      or nodeL1.objectID.uniqueName == 'com.tadawul.trading.v3_update'
                                      or nodeL1.objectID.uniqueName == 'com.tadawul.newsandreports.v3'
                                      or nodeL1.objectID.uniqueName == 'com.tadawul.newsandreports.v3_update'
                                      or nodeL1.objectID.uniqueName == 'com.tadawul.v3.rules.and.guidance'
                                      or nodeL1.objectID.uniqueName == 'com.tadawul.aboutsaudiexchange.v3'
                                      or nodeL1.objectID.uniqueName == 'com.tadawul.aboutsaudiexchange.v3_update'
                                    }"
                                  />

                                  <c:if test="${hasMobileFeature}">
                                    <div class="mobile-nav__feature">
                                      <c:choose>
                                        <c:when
                                          test="${nodeL1.objectID.uniqueName == 'com.tadawul.saudiexchange.ourmarkets.v3'}"
                                        >
                                          <wcm:setExplicitContext
                                            path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Our market"
                                          />

                                          <wcm:content
                                            pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"
                                          />
                                        </c:when>

                                        <c:when
                                          test="${
                                            nodeL1.objectID.uniqueName == 'com.tadawul.listing.v3'
                                            or nodeL1.objectID.uniqueName == 'com.tadawul.listing.v3_update'
                                          }"
                                        >
                                          <div class="menubondBox">
                                            <div class="menubondHdng">
                                              <fmt:message
                                                key="theme.menu.listing.right.400.info"
                                              />
                                            </div>

                                            <div class="menubondCont">
                                              <p>
                                                <fmt:message
                                                  key="theme.menu.listing.right.400.desc"
                                                />
                                              </p>

                                              <c:choose>
                                                <c:when
                                                  test="${fn:contains(pageContext.request.locale.language, 'ar')}"
                                                >
                                                  <a
                                                    class="visitBtn"
                                                    href="https://www.saudiexchange.sa/Resources/400ListedSecurities/ar.html"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                  >
                                                    <fmt:message
                                                      key="theme.menu.listing.right.cta"
                                                    />
                                                  </a>
                                                </c:when>

                                                <c:otherwise>
                                                  <a
                                                    class="visitBtn"
                                                    href="https://www.saudiexchange.sa/Resources/400ListedSecurities/"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                  >
                                                    <fmt:message
                                                      key="theme.menu.listing.right.cta"
                                                    />
                                                  </a>
                                                </c:otherwise>
                                              </c:choose>
                                            </div>
                                          </div>
                                        </c:when>

                                        <c:when
                                          test="${
                                            nodeL1.objectID.uniqueName == 'com.tadawul.trading.v3'
                                            or nodeL1.objectID.uniqueName == 'com.tadawul.trading.v3_update'
                                          }"
                                        >
                                          <wcm:setExplicitContext
                                            path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Trading"
                                          />

                                          <wcm:content
                                            pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"
                                          />
                                        </c:when>

                                        <c:when
                                          test="${
                                            nodeL1.objectID.uniqueName == 'com.tadawul.newsandreports.v3'
                                            or nodeL1.objectID.uniqueName == 'com.tadawul.newsandreports.v3_update'
                                          }"
                                        >
                                          <wcm:setExplicitContext
                                            path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/market news"
                                          />

                                          <wcm:content
                                            pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"
                                          />
                                        </c:when>

                                        <c:when
                                          test="${nodeL1.objectID.uniqueName == 'com.tadawul.v3.rules.and.guidance'}"
                                        >
                                          <wcm:setExplicitContext
                                            path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Rules and Guidance"
                                          />

                                          <wcm:content
                                            pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"
                                          />
                                        </c:when>

                                        <c:when
                                          test="${
                                            nodeL1.objectID.uniqueName == 'com.tadawul.aboutsaudiexchange.v3'
                                            or nodeL1.objectID.uniqueName == 'com.tadawul.aboutsaudiexchange.v3_update'
                                          }"
                                        >
                                          <wcm:setExplicitContext
                                            path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/About Saudi Exchange"
                                          />

                                          <wcm:content
                                            pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"
                                          />
                                        </c:when>
                                      </c:choose>
                                    </div>
                                  </c:if>
                                </div>
                              </c:when>

                              <%-- ==============================================
                                   Level 2 direct link
                                   ============================================== --%>

                              <c:otherwise>
                                <portal-navigation:urlGeneration
                                  contentNode="${wp.identification[nodeL2]}"
                                  keepNavigationalState="false"
                                >
                                  <a
                                    class="mobile-nav__link"
                                    href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
                                  >
                                    <c:out value="${nodeL2.title}" />
                                  </a>
                                </portal-navigation:urlGeneration>
                              </c:otherwise>
                            </c:choose>
                          </li>
                        </c:if>
                      </c:forEach>
                    </ul>
                  </div>
                </c:when>

                <%-- ==========================================================
                     Level 1 direct link
                     ========================================================== --%>

                <c:otherwise>
                  <portal-navigation:urlGeneration
                    contentNode="${wp.identification[nodeL1]}"
                    keepNavigationalState="false"
                  >
                    <a
                      class="mobile-nav__link mobile-nav__link--primary"
                      href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
                    >
                      <c:out value="${nodeL1.title}" />
                    </a>
                  </portal-navigation:urlGeneration>
                </c:otherwise>
              </c:choose>
            </li>
          </c:if>
        </c:forEach>
      </ul>
    </nav>

    <%-- ======================================================================
         Mobile footer
         ====================================================================== --%>

    <footer class="mobile-nav__footer">
      <%--
        Replace these placeholders with the final portal-generated nodes
        when their unique names are confirmed.
      --%>

      <a class="mobile-nav__footer-link" href="#">
        <fmt:message key="theme.footer.contactUs" />
      </a>

      <a class="mobile-nav__footer-link" href="#">
        <fmt:message key="theme.footer.helpCenter" />
      </a>
    </footer>
  </div>
</aside>
      <div class="header-actions__mobile">
        <button
          class="header-burger"
          type="button"
          data-mobile-nav-open
          aria-label="Open menu"
          aria-expanded="false"
          aria-controls="mobile-nav"
        >
          <span class="header-burger__line"></span>
          <span class="header-burger__line"></span>
          <span class="header-burger__line"></span>
        </button>
      </div>
    </div>
  </div>
</header>


<portal-logic:if loggedIn="Yes">
	<div class="watchlist-tab">
		<button type="button" class="">
			<span class="star"><svg class="icon lang-toggle__icon"
					height="18" width="18" aria-hidden="true">
                    <use xlink:href="#custom-star-icon"></use>
                  </svg></span>
		</button>
		<ul>

			<li class="watchlist-text"><a
				href="/wps/portal/saudiexchange_v3/hidden/my-watchlist"
				class="text-decoration-none"> <fmt:message
						key="theme.my.watchlist" /></li>

			<li class="watchlist-text"><a
				href='<portal:url command="LogoutUser"/>'
				class="text-decoration-none"> <fmt:message
						key="theme.nav.my.portfolio.logout.title" />
			</a></li>



		</ul>
	</div>
</portal-logic:if>

<portal-logic:if loggedIn="No">
	<div class="watchlist-tab">
		<button type="button" class="">
			<span class="star"><svg class="icon lang-toggle__icon"
					height="18" width="18" aria-hidden="true">
                    <use xlink:href="#custom-star-icon"></use>
                  </svg></span>
		</button>
		<ul>
			<li class="watchlist-text" data-bs-toggle="modal"
				data-bs-target="#loginModal" aria-controls="loginModal"
				aria-expanded="false"><fmt:message key="theme.my.watchlist" /></li>
		</ul>
	</div>
</portal-logic:if>

<div
	class="modal fade app-modal app-modal--login app-modal--lg app-modal--no-header app-modal--no-footer"
	id="loginModal" tabindex="-1" aria-labelledby="loginTitle"
	aria-hidden="true" data-modal-height="md">
	<div class="modal-dialog modal-dialog-centered">
		<div class="modal-content">
			<button type="button" class="app-modal__close"
				data-bs-dismiss="modal" aria-label="Close"></button>

			<div class="modal-body">
				<portal-logic:if loggedIn="No">
					<section class="login-modal" aria-labelledby="loginTitle">
						<h2 id="loginTitle" class="login-modal__title">
							<fmt:message key="theme.nav.my.portfolio.login" />
						</h2>

						<portal-navigation:urlGeneration
							contentNode="com.tadawul.home.login.v3" portletMode="view"
							portletParameterType="action"
							layoutNode="com.tadawul.home.login.v3.node"
							keepNavigationalState="false">
							<form action="<%wpsURL.write(out);%>" method="POST"
								class="login-modal__form" novalidate>
								<div class="login-modal__field">
									<label class="login-modal__label" for="loginUserId"> <fmt:message
											key="theme.nav.my.portfolio.login.username" />
									</label> <input type="text" id="loginUserId" name="userid"
										class="login-modal__input"
										placeholder='<fmt:message key="theme.nav.my.portfolio.login.username"/>'
										autocomplete="username" />
								</div>

								<div class="login-modal__field">
									<label class="login-modal__label" for="loginPassword">
										<fmt:message key="theme.nav.my.portfolio.login.password" />
									</label> <input type="password" id="loginPassword" name="password"
										class="login-modal__input"
										placeholder='<fmt:message key="theme.nav.my.portfolio.login.password"/>'
										autocomplete="current-password" />
								</div>


								<c:if test="${captchaEnabled eq 'true'}">
<div class="form-field mb-3">
<label class="form-label">
<fmt:message key="label.verification"/> *
</label>
<div id="tadawulRecaptcha1"></div>
<span id="captchaErrorMsg"
              style="display:none;color:red;margin-top:10px;">
<fmt:message key="subscribe.newsletter.captcha.text"/>
</span>
</div>
</c:if>











								<div class="login-modal__password-row">
									<portal-navigation:urlGeneration
										contentNode="com.tadawul.home.forgot.password.v3"
										portletMode="view" keepNavigationalState="false">
										<a href="<%wpsURL.write(out);%>" class="login-modal__link">
											<fmt:message key="theme.nav.forgotPassword" />
										</a>
									</portal-navigation:urlGeneration>
								</div>

								<input type="hidden" name="selectedTooltipLink"
									id="selectedTooltipLink" value="" /> <input
									type="hidden" name="formName" value="SignInForm" />

								<div class="login-modal__actions">
									<button type="submit" class="login-modal__submit">
										<span><fmt:message
												key="theme.nav.my.portfolio.login.title" /></span> <span
											class="login-modal__submit-icon" aria-hidden="true"></span>
									</button>
								</div>
							</form>
						</portal-navigation:urlGeneration>

						<p class="login-modal__register">
							<fmt:message key="theme.nav.signup" />
							<portal-navigation:urlGeneration
								contentNode="com.tadawul.home.register.v3" portletMode="view"
								keepNavigationalState="false">
								<a href="<%wpsURL.write(out);%>" class="login-modal__link">
									<fmt:message key="theme.nav.signup.title" />
								</a>
							</portal-navigation:urlGeneration>
						</p>
					</section>
				</portal-logic:if>
			</div>
		</div>
	</div>
</div>
<c:if test="${displayFeedbackButton == 'true' }">

	<c:if test="${fn:contains(pageContext.request.locale.language,'en')}">
	
	<script>
	
		// Function to open the modal
		function openModal(modalId, buttonId) {
		    const modal = document.getElementById(modalId);
		    modal.style.display = 'flex';
		    document.getElementById(buttonId).style.display = 'none';
		
		    // Create iframe dynamically with a specific ID
		    const iframe = document.createElement('iframe');
		    iframe.id = 'survey-iframe'; // Assign a unique ID for the iframe
		    iframe.src = "https://survey.tadawulgroup.sa/cs/Pop-up-Survey-";
		    modal.querySelector('.modal-content').appendChild(iframe);
		
		    // Create close button dynamically
		    const closeButton = document.createElement('button');
		    closeButton.classList.add('close-btn');
		    closeButton.textContent = 'Close';
		    closeButton.onclick = function () {
		        closeModal(modalId, buttonId);
		    };
		    modal.querySelector('.modal-content').appendChild(closeButton);
		}
		
		// Function to close the modal
		function closeModal(modalId, buttonId) {
		    const modal = document.getElementById(modalId);
		    modal.style.display = 'none';
		    document.getElementById(buttonId).style.display = 'block';
		
		    // Remove iframe with specific ID
		    const iframe = modal.querySelector('#survey-iframe');
		    if (iframe) iframe.remove();
		
		    // Remove the dynamically created close button
		    const closeButton = modal.querySelector('.close-btn');
		    if (closeButton) closeButton.remove();
		}
		
		// Function to close modal and remove iframe on clicking outside of modal content
		function closeOnOutsideClick(event, modalId, buttonId) {
		    const modalContent = document.querySelector(`#${modalId} .modal-content`);
		    if (!modalContent.contains(event.target)) {
		        // Remove iframe and close modal
		        closeModal(modalId, buttonId);
		    }
		}
		
		// Show feedback button
		function showFeedbackButton() {
		    document.getElementById('englishFeedback').style.display = 'block';
		}
		
		// Initialize feedback button visibility
		showFeedbackButton();
		
		// Event listeners for feedback buttons
		document.getElementById('englishFeedback').addEventListener('click', function () {
		    openModal('englishModal', 'englishFeedback');
		});
		
		// Add event listener for clicking outside the modal
		document.getElementById('englishModal').addEventListener('click', function (event) {
		    closeOnOutsideClick(event, 'englishModal', 'englishFeedback');
		});
	
	</script>
	
		<!-- Feedback buttons 123 -->
		<div class="feedback-btn right" id="englishFeedback">
			<h6>
				<fmt:message key="feedback.button.text" />
			</h6>
		</div>

		<!-- Modal for English Survey 123-->
		<div class="modal" id="englishModal"
			onclick="closeOnOutsideClick(event, 'englishModal', 'englishFeedback')">
			<div class="modal-content" dir="ltr">
				<!-- X Close Button -->
				<button class="x-btn" id="closeBtnEnglish"
					onclick="closeModal('englishModal', 'englishFeedback')">X</button>
				<!-- Iframe will be dynamically created here -->
			</div>
		</div>
	</c:if>

	<c:if test="${fn:contains(pageContext.request.locale.language,'ar')}">
	
	<script>
	
		// Function to open the modal
		function openModal(modalId, buttonId) {
		    const modal = document.getElementById(modalId);
		    modal.style.display = 'flex';
		    document.getElementById(buttonId).style.display = 'none';
		
		    // Create iframe dynamically with a specific ID
		    const iframe = document.createElement('iframe');
		    iframe.id = 'survey-iframe'; // Assign a unique ID for the iframe
		    iframe.src = "https://survey.tadawulgroup.sa/cs/Pop-up-Survey-";
		    modal.querySelector('.modal-content').appendChild(iframe);
		
		    // Create close button dynamically
		    const closeButton = document.createElement('button');
		    closeButton.classList.add('close-btn');
		    closeButton.textContent = 'Close';
		    closeButton.onclick = function () {
		        closeModal(modalId, buttonId);
		    };
		    modal.querySelector('.modal-content').appendChild(closeButton);
		}
		
		// Function to close the modal
		function closeModal(modalId, buttonId) {
		    const modal = document.getElementById(modalId);
		    modal.style.display = 'none';
		    document.getElementById(buttonId).style.display = 'block';
		
		    // Remove iframe with specific ID
		    const iframe = modal.querySelector('#survey-iframe');
		    if (iframe) iframe.remove();
		
		    // Remove the dynamically created close button
		    const closeButton = modal.querySelector('.close-btn');
		    if (closeButton) closeButton.remove();
		}
		
		// Function to close modal and remove iframe on clicking outside of modal content
		function closeOnOutsideClick(event, modalId, buttonId) {
		    const modalContent = document.querySelector(`#${modalId} .modal-content`);
		    if (!modalContent.contains(event.target)) {
		        // Remove iframe and close modal
		        closeModal(modalId, buttonId);
		    }
		}
		
		// Show feedback button
		function showFeedbackButton() {
		    document.getElementById('englishFeedback').style.display = 'block';
		}
		
		// Initialize feedback button visibility
		showFeedbackButton();
		
		// Event listeners for feedback buttons
		document.getElementById('englishFeedback').addEventListener('click', function () {
		    openModal('englishModal', 'englishFeedback');
		});
		
		// Add event listener for clicking outside the modal
		document.getElementById('englishModal').addEventListener('click', function (event) {
		    closeOnOutsideClick(event, 'englishModal', 'englishFeedback');
		});
	
	</script>
	
		<div class="feedback-btn left" id="arabicFeedback">
			<h6>
				<fmt:message key="feedback.button.text" />
			</h6>
		</div>

		<!-- Modal for Arabic Survey -->
		<div class="modal" id="arabicModal"
			onclick="closeOnOutsideClick(event, 'arabicModal', 'arabicFeedback')">
			<div class="modal-content" dir="rtl">
				<!-- X Close Button at the Top -->
				<button class="x-btn" id="closeBtnArabic"
					onclick="closeModal('arabicModal', 'arabicFeedback')">X</button>
				<!-- Iframe will be dynamically created here -->
			</div>
		</div>
	</c:if>

</c:if>

<c:if test="${captchaEnabled eq 'true'}">
<script src="https://www.google.com/recaptcha/api.js?onload=onloadRecaptchaCallback&render=explicit"
            async defer></script>
</c:if>

<script>

$(document).ready(function() {
    
    var currentURL = window.location.href;

    if (currentURL.includes("issuer-announcements-details")) {
        if (currentURL.includes("locale=en")) {
            var newURLString = removeLocaleParam(currentURL, 'locale');
            newURLString = newURLString + "&locale=ar";
            $('#changeLanguageLink').attr('href', newURLString);
            $('#changeLanguageLinkMobile').attr('href', newURLString);
            $('#ogURL').attr('content', newURLString);
            $('#bookmarkLink').attr('href', newURLString);
        } else {
            var newURLString = removeLocaleParam(currentURL, 'locale');
            newURLString = newURLString + "&locale=en";
            $('#changeLanguageLink').attr('href', newURLString);
            $('#changeLanguageLinkMobile').attr('href', newURLString);
            $('#ogURL').attr('content', newURLString);
            $('#bookmarkLink').attr('href', newURLString);
        }
    } else {
        console.log("URL does not contain 'issuer-announcements-details'");
    }
    
    if (currentURL.includes("news-detail-wcm")) {
        if (currentURL.includes("locale=en")) {
            var newURLString = removeLocaleParam(currentURL, 'locale');
            newURLString = newURLString + "&locale=ar";
            $('#changeLanguageLink').attr('href', newURLString);
            $('#changeLanguageLinkMobile').attr('href', newURLString);
            $('#ogURL').attr('content', newURLString);
            $('#bookmarkLink').attr('href', newURLString);
        } else {
            var newURLString = removeLocaleParam(currentURL, 'locale');
            newURLString = newURLString + "&locale=en";
            $('#changeLanguageLink').attr('href', newURLString);
            $('#changeLanguageLinkMobile').attr('href', newURLString);
            $('#ogURL').attr('content', newURLString);
            $('#bookmarkLink').attr('href', newURLString);
        }
    } else {
        console.log("URL does not contain 'news-detail-wcm'");
    }
    

    
    
});




var captchaEnabled = '${captchaEnabled}';
var widgetId = null;
function onloadRecaptchaCallback() {
    if (captchaEnabled !== 'true') {
        return;
    }
    if ($('#tadawulRecaptcha1').length > 0) {
        var currentLang = document.getElementsByTagName("html")[0]
                .getAttribute("lang") || "en";
        widgetId = grecaptcha.render('tadawulRecaptcha1', {
            'sitekey' : '6LeCMd4sAAAAAEesg8Gcxfy4fLFLg5Uq4Jz_DVKX',
            'hl' : currentLang,
            'callback' : function(response) {
                $("#captchaErrorMsg").text("").hide();
            }
        });
    }
}
function validateCaptcha() {
    if (captchaEnabled !== 'true') {
        return true;
    }
    var response = grecaptcha.getResponse(widgetId);
    if (!response || response.length === 0) {
        $("#captchaErrorMsg").show();
        return false;
    }
    $("#captchaErrorMsg").hide();
    return true;
}
$(document).ready(function() {
    if (captchaEnabled !== 'true') {
        $("#captchaErrorMsg").hide();
    }
    if (captchaEnabled === 'true'
&& typeof grecaptcha !== 'undefined'
&& typeof grecaptcha.render === 'function'
&& widgetId === null) {
        onloadRecaptchaCallback();
    }
});	
 
</script>
<script type="text/javascript">
function normalizeDigits(s) {
	return s.replace(/[\u0660-\u0669\u06f0-\u06f9]/g,    // Detect all Persian/Arabic Digit in range of their Unicode with a global RegEx character set
			function(a) { return a.charCodeAt(0) & 0xf }     // Remove the Unicode base(2) range that not match
	)
}
function submitMobileSearch(){

	var symbol = normalizeDigits($("#mobileSearchQuery").val());
	var layoutNodeTag='';
	var layoutNodeDerivativeTag='';
	var layoutNodeETFTag='';
	var layoutNodeMutualFundTag='';
	<portal-navigation:urlGeneration contentNode="com.tadawul.search.v3" portletMode="view" portletParameterType="render" layoutNode="com.tadawul.search.v3.node" keepNavigationalState="false">
		var searchPageURL = '<%wpsURL.write(out);%>';
	</portal-navigation:urlGeneration>
	layoutNodeTag = searchPageURL.substring(searchPageURL.lastIndexOf("/")+1,searchPageURL.length);
	searchPageURL = searchPageURL.substring(0, searchPageURL.lastIndexOf("/")+1);
	var searchResultLink = searchPageURL+'?query='+$("#mobileSearchQuery").val()+layoutNodeTag;
	
	<portal-navigation:urlGeneration contentNode="com.tadawul.hidden.company.profile.v3" portletMode="view" portletParameterType="render" layoutNode="com.tadawul.v3.company.profile.node.v3" keepNavigationalState="false">
		var companyDetailsURL = '<%wpsURL.write(out);%>';
	</portal-navigation:urlGeneration>
	layoutNodeTag = companyDetailsURL.substring(companyDetailsURL.lastIndexOf("/")+1,companyDetailsURL.length);
	companyDetailsURL = companyDetailsURL.substring(0, companyDetailsURL.lastIndexOf("/")+1);
		//Added for SME
	<portal-navigation:urlGeneration contentNode="com.tadawul.hidden.company.profile.nomu.v3" portletParameterType="render" layoutNode="com.tadawul.v3.company.profile.nomu.node.v3" keepNavigationalState="false">
		var companyDetailsSMEURL = '<%wpsURL.write(out);%>';
	</portal-navigation:urlGeneration>
	layoutNodeSMETag = companyDetailsSMEURL.substring(companyDetailsSMEURL.lastIndexOf("/")+1,companyDetailsSMEURL.length);
	companyDetailsSMEURL = companyDetailsSMEURL.substring(0, companyDetailsSMEURL.lastIndexOf("/")+1);
	//Added for Govt Bonds - Corporate Bonds
	<portal-navigation:urlGeneration contentNode="com.tadawul.v3.sukukmaret.company.profile.sukuk.v3" portletParameterType="render" layoutNode="com.tadawul.v3.sukukmaret.company.profile.sukuk.v3.node" keepNavigationalState="false">
		var sukukURL = '<%wpsURL.write(out);%>';
	</portal-navigation:urlGeneration>
	layoutNodeSukukTag = sukukURL.substring(sukukURL.lastIndexOf("/")+1,sukukURL.length);
	sukukURL = sukukURL.substring(0, sukukURL.lastIndexOf("/")+1);
	//Added for Govt Bonds - Govt Bonds
	<portal-navigation:urlGeneration contentNode="com.tadawul.v3.sukukmaret.company.profile.sukuk.v3" portletParameterType="render" layoutNode="com.tadawul.v3.sukukmaret.company.profile.sukuk.v3.node" keepNavigationalState="false">
		var sukukGovtURL = '<%wpsURL.write(out);%>';
	</portal-navigation:urlGeneration>
	layoutNodeSukukGovtTag = sukukGovtURL.substring(sukukGovtURL.lastIndexOf("/")+1,sukukGovtURL.length);
	sukukGovtURL = sukukGovtURL.substring(0, sukukGovtURL.lastIndexOf("/")+1);
	
		//Added for ETF
	<portal-navigation:urlGeneration contentNode="com.tadawul.hidden.company.etf.v3" portletParameterType="render" layoutNode="com.tadawul.hidden.company.etf.v3.node" keepNavigationalState="false">
		var companyDetailsETFURL = '<%wpsURL.write(out);%>';
	</portal-navigation:urlGeneration>
	layoutNodeETFTag = companyDetailsETFURL.substring(companyDetailsETFURL.lastIndexOf("/")+1,companyDetailsETFURL.length);
	companyDetailsETFURL = companyDetailsETFURL.substring(0, companyDetailsETFURL.lastIndexOf("/")+1);
	
		//Added for MutualFunds
	<portal-navigation:urlGeneration contentNode="com.tadawul.hidden.company.mutualfund.v3" portletParameterType="render" layoutNode="com.tadawul.hidden.company.mutualfund.v3.node" keepNavigationalState="false">
		var mutualFundsURL = '<%wpsURL.write(out);%>';
	</portal-navigation:urlGeneration>
	layoutNodeMutualFundTag = mutualFundsURL.substring(mutualFundsURL.lastIndexOf("/")+1,mutualFundsURL.length);
	mutualFundsURL = mutualFundsURL.substring(0, mutualFundsURL.lastIndexOf("/")+1);
		
	<%-- //Added for Derivatives
	<portal-navigation:urlGeneration contentNode="com.tadawul.hidden.derivatives.v3" portletParameterType="render" layoutNode="com.tadawul.hidden.derivatives.v3.node" keepNavigationalState="false">
		var contractDetailsURL = '<%wpsURL.write(out);%>
	';
		</portal-navigation:urlGeneration>
		layoutNodeDerivativeTag = contractDetailsURL.substring(
				contractDetailsURL.lastIndexOf("/") + 1,
				contractDetailsURL.length);
		contractDetailsURL = contractDetailsURL.substring(0, contractDetailsURL
				.lastIndexOf("/") + 1); --%>
				
       //Added for Derivatives
		<portal-navigation:urlGeneration contentNode="com.tadawul.hidden.derivatives.v3" portletParameterType="render" layoutNode="com.tadawul.hidden.derivatives.v3.node" keepNavigationalState="false">
		    var contractDetailsURL = '<%wpsURL.write(out);%>';
		</portal-navigation:urlGeneration>
		
		// Safely extract the layout node tag even if state parameters (!ut) exist
		var cleanPath = contractDetailsURL.split('/!ut/')[0]; 
		layoutNodeDerivativeTag = cleanPath.substring(cleanPath.lastIndexOf("/") + 1);
		
		// Keep the base URL leading up to that node
		contractDetailsURL = cleanPath.substring(0, cleanPath.lastIndexOf("/") + 1);

		var found = false;
		var isMain = false;
		var isSMECompany = false;
		var isSukukCorporate = false;
		var isSukukGovt = false;
		var isDerivative = false;
		var isETF = false;
		var isMutualFunds = false;

		for (var i = 0; i < window.searchableSymbols.length; i++) {
			if (symbol == window.searchableSymbols[i].symbol) {
				found = true;
				if (null != window.searchableSymbols[i].market_type
						&& window.searchableSymbols[i].market_type == 'S') {
					isSMECompany = true;
				} else if (null != window.searchableSymbols[i].market_type
						&& window.searchableSymbols[i].market_type == 'E') {
					isETF = true;
				} else if (null != window.searchableSymbols[i].market_type
						&& (window.searchableSymbols[i].market_type == 'B' || window.searchableSymbols[i].market_type == 'O')) {
					if (null != window.searchableSymbols[i].bond_type
							&& window.searchableSymbols[i].bond_type == 'S') {
						isSukukCorporate = true;
					} else if (null != window.searchableSymbols[i].bond_type
							&& window.searchableSymbols[i].bond_type == 'G') {
						isSukukGovt = true;
					}
				} else if (null != window.searchableSymbols[i].market_type
						&& window.searchableSymbols[i].market_type == 'F') {
					isMutualFunds = true;
				} else if (null != window.searchableSymbols[i].market_type
						&& window.searchableSymbols[i].market_type == 'D') {
					isDerivative = true;
				} else {
					isMain = true;
				}
				break;
			}
		}

		if (found && isMain) {
			//symbol = symbol.substring(0,symbol.indexOf('-')-1);
			var dtLink = companyDetailsURL + '?companySymbol=' + symbol
					+ layoutNodeTag;
			$('#mobileNavSearchForm').attr('action', dtLink);
		} else if (found && isSMECompany) {
			var dtLink = companyDetailsSMEURL + '?companySymbol=' + symbol
					+ layoutNodeSMETag;
			$('#mobileNavSearchForm').attr('action', dtLink);
		} else if (found && isSukukCorporate) {
			var dtLink = sukukURL + '?SukukBondsSymbol=' + symbol
					+ '&BOND_TYPE=S&companySymbol=' + symbol
					+ layoutNodeSukukTag;
			$('#mobileNavSearchForm').attr('action', dtLink);
		} else if (found && isSukukGovt) {
			var dtLink = sukukGovtURL + '?SukukBondsSymbol=' + symbol
					+ '&BOND_TYPE=G&companySymbol=' + symbol
					+ layoutNodeSukukGovtTag;
			$('#mobileNavSearchForm').attr('action', dtLink);
		} else if (found && isETF) {
			var dtLink = companyDetailsETFURL + '?etfSymbolParameter=' + symbol
					+ '&companySymbol=' + symbol + layoutNodeETFTag;
			$('#mobileNavSearchForm').attr('action', dtLink);
		} else if (found && isMutualFunds) {
			var dtLink = mutualFundsURL + '?selectedFund=' + symbol
					+ '&tabIndex=1' + layoutNodeMutualFundTag;
			$('#mobileNavSearchForm').attr('action', dtLink);
		} else if (found && isDerivative) {
			var dtLink = contractDetailsURL + '?contractSymbol=' + symbol
					+ '&companySymbol=' + symbol + layoutNodeDerivativeTag;
			$('#mobileNavSearchForm').attr('action', dtLink);
		} else
			$('#mobileNavSearchForm').attr('action', searchResultLink);

		$('#mobileNavSearchForm').submit();
	};

	$(document)
			.ready(
					function() {
						var newModules = [];
						var updatedModules = [];

						$
								.ajax({
									url : "/tadawul.eportal.theme.helper/getModuleStatus",
									type : 'GET',
									dataType : 'json',
									success : function(response) {
										if (Array.isArray(response.newModules)
												&& Array
														.isArray(response.updatedModules)) {
											newModules = response.newModules;
											updatedModules = response.updatedModules;
										} else {
											console
													.error("Expected arrays not found in response.");
										}
										updateMenuLabels();

										$(document).on(
												'drawer:opened',
												function() {
													setTimeout(
															updateMenuLabels,
															50); // Small delay to ensure DOM is ready
												});
									},
									error : function(xhr, status, error) {
										console.error("Error fetching data:",
												error);
									}
								});

						function updateMenuLabels() {
							//console.clear();
							const userLang = "${pageContext.request.locale.language}";

							// Select all anchor tags that have data-unique-name attribute
							$('a[data-unique-name]')
									.each(
											function() {
												var $this = $(this);
												// console.log($this);
												var uniqueName = $this
														.data('unique-name');

												// Remove any existing labels first to avoid duplicates
												$this.find('.moduleLabel')
														.remove();
												//console.log(newModules);
												if (newModules
														.includes(uniqueName)) {
													if (userLang.includes('ar')) {
														// console.log('inside newModules.includes(uniqueName) ar');
														$this
																.append(' <span class="moduleLabel newModule ar"><fmt:message key="theme.header.option.label.new"/></span>');
													} else {
														//console.log('inside newModules.includes(uniqueName) en');
														$this
																.append(' <span class="moduleLabel newModule en"><fmt:message key="theme.header.option.label.new"/></span>');
													}
												} else if (updatedModules
														.includes(uniqueName)) {
													if (userLang.includes('ar')) {
														// console.log('inside updatedModules.includes(uniqueName) ar');
														$this
																.append(' <span class="moduleLabel updateModule ar"><fmt:message key="theme.header.option.label.updated"/></span>');
													} else {
														// console.log('inside updatedModules.includes(uniqueName) en');
														$this
																.append(' <span class="moduleLabel updateModule en"><fmt:message key="theme.header.option.label.updated"/></span>');
													}
												}
											});
						}

						$(document).on('click', '.drawer__submenu-toggle',
								function() {
									setTimeout(updateMenuLabels, 100);
								});
					});
</script>

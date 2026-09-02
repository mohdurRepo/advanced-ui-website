<%@page session="false" contentType="text/html"
	pageEncoding="ISO-8859-1"
	import="java.util.*,javax.portlet.*,sa.com.tadawul.eportal.theoretical.marketwatch.v2.portlet.*"%>
<%@ taglib uri="http://java.sun.com/portlet_2_0" prefix="portlet"%>
<%@taglib
	uri="http://www.ibm.com/xmlns/prod/websphere/portal/v6.1/portlet-client-model"
	prefix="portlet-client-model"%>
<%@taglib uri="http://java.sun.com/jsp/jstl/core" prefix="c"%>
<%@taglib uri="http://java.sun.com/jsp/jstl/fmt" prefix="fmt"%>
<%@taglib uri="/WEB-INF/tld/portal.tld" prefix="wps"%>
<script src="${pageContext.request.contextPath}/js/datatables.js"></script>
<script
	src="${pageContext.request.contextPath}/js/datatables-fixedheader.js"></script>
<script
	src="${pageContext.request.contextPath}/js/datatables-rowgroup.js"></script>


<portlet:defineObjects />
<portlet-client-model:init>
	<portlet-client-model:require module="ibm.portal.xml.*" />
	<portlet-client-model:require module="ibm.portal.portlet.*" />
</portlet-client-model:init>


<head>

<fmt:setBundle
	basename="sa.com.tadawul.eportal.theoretical.marketwatch.v2.nl.TheoreticalOpeningPortletV2PortletResource" />
<!-- ==========================================================================
     Nomu Theoretical Opening Hero
     ========================================================================== -->

<section
  class="hero-section market-summary-section"
  aria-labelledby="nomu-theoretical-opening-title"
>
  <div
    class="hero-section__background"
    aria-hidden="true"
  ></div>

  <div class="container hero-section__content">
    <div class="market-summary market-summary--hero">
      <header class="market-summary__header">
        <div class="market-summary__brand">
          <span
            class="market-summary__brand-icon has-icon icon-tadawul"
            aria-hidden="true"
          ></span>

          <h1
            id="nomu-theoretical-opening-title"
            class="market-summary__title"
          >
            <fmt:message key="theoretical.title" />
          </h1>
        </div>
      </header>
    </div>
  </div>
</section>

<!-- ==========================================================================
     Nomu Theoretical Opening Filters
     ========================================================================== -->

<section
  class="section nomu-theoretical-opening-filters pb-0"
  aria-labelledby="nomu-theoretical-opening-filters-title"
>
  <div class="container">
    <h2
      id="nomu-theoretical-opening-filters-title"
      class="visually-hidden"
    >
      <fmt:message key="selectSectorLabel" />
    </h2>

    <form
      class="filter-bar filter-bar--connected"
      aria-labelledby="nomu-theoretical-opening-filters-title"
      data-nomu-theoretical-opening-filters
    >
      <div class="filter-bar__fields">
        <div class="form-field">
          <label
            class="form-label"
            for="nomu-theoretical-opening-sector"
          >
            <fmt:message key="selectSectorLabel" />
          </label>

          <div
            class="custom-select"
            data-custom-select
          >
            <div class="form-select-wrap custom-select__fallback">
              <select
                id="nomu-theoretical-opening-sector"
                class="form-select custom-select__native"
                name="sectorParameter"
                data-nomu-theoretical-opening-sector
              >
                <option
                  value="All"
                  <c:if test="${empty requestScope.selectedSector or requestScope.selectedSector eq 'All'}">
                    selected
                  </c:if>
                >
                  <fmt:message key="showAll" />
                </option>

                <c:forEach
                  var="sectorItem"
                  items="${requestScope.sectorList}"
                >
                  <option
                    value="<c:out value='${sectorItem.modifiedId}' />"
                    <c:if test="${requestScope.selectedSector eq sectorItem.modifiedId}">
                      selected
                    </c:if>
                  >
                    <c:out value="${sectorItem.modifiedName}" />
                  </option>
                </c:forEach>
              </select>

              <span
                class="form-select-icon has-icon icon-chevron-down"
                aria-hidden="true"
              ></span>
            </div>
          </div>
        </div>
      </div>
    </form>
  </div>
</section>

<!-- ==========================================================================
     Nomu Theoretical Opening Results
     ========================================================================== -->

<section
  class="section nomu-theoretical-opening-results pt-0"
  aria-labelledby="nomu-theoretical-opening-results-title"
>
  <div class="container">
    <h2
      id="nomu-theoretical-opening-results-title"
      class="visually-hidden"
    >
      <fmt:message key="theoretical.title" />
    </h2>

    <div
      class="data-view data-view--connected"
      data-nomu-theoretical-opening-data-view
    >
      <div class="data-view__workspace">

        <!-- ==================================================================
             Toolbar
             ================================================================== -->

        <div class="data-view__toolbar">
          <div class="data-view__toolbar-start">
            <p class="data-view__result-count">
              <strong data-nomu-theoretical-opening-result-count>
                0
              </strong>

              <span>
                <fmt:message key="results" />
              </span>
            </p>
          </div>
        </div>

        <!-- ==================================================================
             Desktop Table
             ================================================================== -->

        <div class="data-view__table">
          <div
            class="table-shell"
            data-table-shell
          >
            <section
              class="table-responsive custom-scrollbar"
              tabindex="0"
              role="region"
              aria-label="<fmt:message key='theoretical.title' />"
            >
              <table
                class="table table-market table-hover table-nowrap"
                data-nomu-theoretical-opening-table
                aria-busy="true"
              >
                <caption class="visually-hidden">
                  <fmt:message key="theoretical.title" />
                </caption>

                <thead>
                  <tr>
                    <th
                      class="table-market__security"
                      scope="col"
                    >
                      <fmt:message key="companyNameCol" />
                    </th>

                    <th
                      class="numeric text-center"
                      scope="col"
                    >
                      <fmt:message key="company.Previous.Close" />
                    </th>

                    <th
                      class="numeric text-center"
                      scope="col"
                    >
                      <fmt:message key="company.top" />
                    </th>

                    <th
                      class="numeric text-center"
                      scope="col"
                    >
                      <fmt:message key="company.tov" />
                    </th>
                  </tr>
                </thead>

                <tbody></tbody>
              </table>
            </section>
          </div>
        </div>

        <!-- ==================================================================
             Mobile Cards
             ================================================================== -->

        <div
          class="data-view__cards"
          aria-label="<fmt:message key='theoretical.title' />"
        >
          <div
            class="data-view__cards-inner"
            data-nomu-theoretical-opening-cards
            aria-busy="true"
          ></div>
        </div>

      </div>
    </div>

    <!-- ======================================================================
         Notes
         ====================================================================== -->

    <div class="notes">
      <ul>
        <c:if test="${pageContext.request.locale.language eq 'en'}">
          <li>
            <fmt:message key="top.note1" />
          </li>
        </c:if>

        <li>
          <fmt:message key="top.note2" />
        </li>

        <li>
          <fmt:message key="top.note3" />
        </li>

        <li>
          <fmt:message key="top.market.watch.prices.delayed" />
        </li>
      </ul>
    </div>
  </div>
</section>

<!-- ==========================================================================
     Nomu Theoretical Opening Configuration
     ========================================================================== -->

<script>
  window.NomuTheoreticalOpeningConfig = {
    endpoint:
      "<portlet:resourceURL id='getNomukTheoreticalOpeningDetails' />",

    locale:
      "<c:out value='${pageContext.request.locale.language}' />",

    /* ======================================================================
       Company Identity Assets
       ====================================================================== */

    assets: {
      companyLogoUrlTemplate:
        "https://www.tadawulgroup.sa/Resources/SEMOBILELOGOS/{companyCode}.png",

      companyLogoFallbackUrl:
        "https://www.tadawulgroup.sa/Resources/SEMOBILELOGOS/default.png",
    },

    /* ======================================================================
       Initial State
       ====================================================================== */

    initialState: {
      sector:
        "<c:out value='${empty requestScope.selectedSector ? "All" : requestScope.selectedSector}' />",
    },

    /* ======================================================================
       Labels
       ====================================================================== */

    labels: {
      loading:
        "<fmt:message key='loading' />",

      noData:
        "<fmt:message key='noDataAvailable' />",

      results:
        "<fmt:message key='results' />",

      mobile: {
        showDetails:
          "Show details",

        hideDetails:
          "Hide details",

        symbolCompany:
          "<fmt:message key='companyNameCol' />",

        priceVolume:
          "<fmt:message key='company.top' /> / <fmt:message key='company.tov' />",
      },

      table: {
        companyName:
          "<fmt:message key='companyNameCol' />",

        previousClose:
          "<fmt:message key='company.Previous.Close' />",

        top:
          "<fmt:message key='company.top' />",

        tov:
          "<fmt:message key='company.tov' />",
      },
    },

    /* ======================================================================
       Page-specific table overrides
       ====================================================================== */

    table: {
      ordering: false,
      searching: false,
      paging: false,
      info: false,
      autoWidth: false,
    },
  };
</script>

<!-- ==========================================================================
     Page Module
     ========================================================================== -->

<script
  type="module"
  src="${pageContext.request.contextPath}/js/pages/theoretical-opening/nomu-theoretical-opening.js"
></script>
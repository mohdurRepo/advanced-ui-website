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
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core"%>
<%@ taglib prefix="fmt" uri="http://java.sun.com/jsp/jstl/fmt"%>
<%@ taglib prefix="portlet" uri="http://java.sun.com/portlet_2_0"%>
<script>
  var marketStatus = '${requestScope.marketStatusID}';
</script>

<c:set
  var="openCloseAuction"
  value="false"
/>

<c:if
  test="${requestScope.marketStatusID == 6
    or requestScope.marketStatusID == 1}"
>
  <c:set
    var="openCloseAuction"
    value="true"
  />
</c:if>


<%-- =========================================================================
     Nomu Theoretical Opening Hero
     ========================================================================= --%>

<section
  class="hero-section surface-hero"
  aria-labelledby="theoretical-opening-title"
  aria-describedby="theoretical-opening-description"
>
  <div
    class="hero-section__background"
    aria-hidden="true"
  ></div>

  <div class="container hero-section__content">

    <header class="hero-intro">

      <div class="hero-intro__header">

        <div class="hero-intro__brand">

          <span
            class="hero-intro__icon has-icon icon-tadawul"
            aria-hidden="true"
          ></span>

          <h1
            id="theoretical-opening-title"
            class="hero-intro__title"
          >
            <fmt:message key="theoretical.title" />
          </h1>

        </div>


        <p
          id="theoretical-opening-description"
          class="hero-intro__description"
        >
          <fmt:message key="trading.calendar.description" />
        </p>

      </div>

    </header>

  </div>
</section>


<%-- =========================================================================
     Nomu Theoretical Opening Filters
     ========================================================================= --%>

<section
  class="section theoretical-opening-filters pb-0"
  aria-labelledby="theoretical-opening-filters-title"
>
  <div class="container">

    <form
      class="filter-bar filter-bar--connected"
      aria-labelledby="theoretical-opening-filters-title"
      data-theoretical-opening-filters
    >

      <h2
        id="theoretical-opening-filters-title"
        class="visually-hidden"
      >
        <fmt:message key="theoretical.title" />
      </h2>


      <%-- ===================================================================
           Primary Controls
           =================================================================== --%>

      <div class="filter-bar__inner">

        <div class="filter-bar__fields grid-3">


          <%-- ===============================================================
               Sector
               =============================================================== --%>

          <div class="filter-bar__field">

            <label
              class="form-label"
              for="theoretical-opening-sector"
            >
              <fmt:message key="trading.calendar.label.sector" />
            </label>


            <div
              class="custom-select"
              data-custom-select
              data-searchable
            >

              <div
                class="form-select-wrap custom-select__fallback"
              >

                <select
                  id="theoretical-opening-sector"
                  class="form-select custom-select__native"
                  name="sectorParameter"
                  data-theoretical-opening-sector
                >

                  <option
                    value="All"
                    <c:if
                      test="${empty requestScope.selectedSector
                        or requestScope.selectedSector eq 'All'}"
                    >
                      selected
                    </c:if>
                  >
                    <fmt:message
                      key="trading.calendar.label.all.sectors"
                    />
                  </option>


                  <c:forEach
                    items="${requestScope.sectorList}"
                    var="sectorItem"
                  >

                    <option
                      value="<c:out value='${sectorItem.modifiedId}' />"
                      <c:if
                        test="${requestScope.selectedSector eq sectorItem.modifiedId}"
                      >
                        selected
                      </c:if>
                    >
                      <c:out
                        value="${sectorItem.modifiedName}"
                      />
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

      </div>

    </form>

  </div>
</section>


<%-- =========================================================================
     Nomu Theoretical Opening Data View
     ========================================================================= --%>

<section
  class="section theoretical-opening-results pt-0"
  aria-labelledby="theoretical-opening-results-title"
>
  <div class="container">

    <h2
      id="theoretical-opening-results-title"
      class="visually-hidden"
    >
      <fmt:message key="theoretical.title" />
    </h2>


    <div
      class="data-view data-view--connected"
      data-theoretical-opening-data-view
    >


      <%-- ===================================================================
           Workspace
           =================================================================== --%>

      <div class="data-view__workspace">


        <%-- =================================================================
             Results Toolbar
             ================================================================= --%>

        <div class="data-view__toolbar">

          <div class="data-view__toolbar-start">

            <p class="data-view__result-count">

              <strong
                data-theoretical-opening-result-count
              >
                0
              </strong>

              <span>
                <fmt:message key="results" />
              </span>

            </p>

          </div>

        </div>


        <%-- =================================================================
             Desktop Table
             ================================================================= --%>

        <div class="data-view__table">

          <div class="data-view__table-block">

            <table
              id="theoreticalTableId"
              class="table table-market theoretical-opening-table"
              data-theoretical-opening-table
            >

              <thead>

                <tr>


                  <%-- =======================================================
                       Company
                       ======================================================= --%>

                  <th scope="col">
                    <fmt:message
                      key="theoretical.nomutable.column.header.company.name"
                    />
                  </th>


                  <%-- =======================================================
                       Previous Close
                       ======================================================= --%>

                  <th
                    scope="col"
                    class="table-market__number"
                  >
                    <fmt:message
                      key="theoretical.nomutable.column.header.company.Previous.Close"
                    />
                  </th>


                  <%-- =======================================================
                       TOP
                       ======================================================= --%>

                  <th
                    scope="col"
                    class="table-market__number"
                  >
                    <fmt:message
                      key="theoretical.nomutable.column.header.company.top"
                    />
                  </th>


                  <%-- =======================================================
                       TOV
                       ======================================================= --%>

                  <th
                    scope="col"
                    class="table-market__number"
                  >
                    <fmt:message
                      key="theoretical.nomutable.column.header.company.tov"
                    />
                  </th>

                </tr>

              </thead>

              <tbody></tbody>

            </table>

          </div>

        </div>


        <%-- =================================================================
             Mobile Cards
             ================================================================= --%>

        <div
          id="theoreticalMobileView"
          class="data-view__cards"
          data-theoretical-opening-mobile-cards
        ></div>


      </div>

    </div>


    <%-- =====================================================================
         Footnotes
         ===================================================================== --%>

    <div class="notes">

      <ul>

        <c:if
          test="${pageContext.request.locale.language eq 'en'}"
        >
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
          <fmt:message
            key="top.market.watch.prices.delayed"
          />
        </li>

      </ul>

    </div>

  </div>
</section>
<%-- =========================================================================
     Nomu Theoretical Opening Configuration
     ========================================================================= --%>

<script>
  window.NomuTheoreticalOpeningConfig = {

    /* ======================================================================
       Endpoint
       ====================================================================== */

    endpoint:
      "<portlet:resourceURL id='getNomukTheoreticalOpeningDetails' />",


    /* ======================================================================
       Locale
       ====================================================================== */

    locale:
      "<c:out value='${pageContext.request.locale.language}' />",


    /* ======================================================================
       Initial State
       ====================================================================== */

    initialState: {
      sector:
        "<c:out value='${empty requestScope.selectedSector ? "All" : requestScope.selectedSector}' />",
    },


    /* ======================================================================
       Table
       ====================================================================== */

    table: {
      autoWidth: false,

      paging: false,
      searching: false,
      ordering: false,
      info: false,
      lengthChange: false,

      serverSide: false,
      processing: false,

      scrollX: true,
      scrollCollapse: true,

      fixedHeader: true,
      fixedColumns: 1,
    },


    /* ======================================================================
       Labels
       ====================================================================== */

    labels: {

      loading:
        "<fmt:message key='loading' />",

      noData:
        "<fmt:message key='no.data.available' />",

      results:
        "<fmt:message key='results' />",

      loadError:
        "<fmt:message key='no.data.available' />",


      /* --------------------------------------------------------------------
         Mobile
         -------------------------------------------------------------------- */

      mobile: {

        symbolCompany:
          "<fmt:message key='theoretical.nomutable.column.header.company.name' />",

        priceVolume:
          "<fmt:message key='theoretical.nomutable.column.header.company.top' /> / <fmt:message key='theoretical.nomutable.column.header.company.tov' />",

      },


      /* --------------------------------------------------------------------
         Table / Card Fields
         -------------------------------------------------------------------- */

      table: {

        company:
          "<fmt:message key='theoretical.nomutable.column.header.company.name' />",

        previousClose:
          "<fmt:message key='theoretical.nomutable.column.header.company.Previous.Close' />",

        top:
          "<fmt:message key='theoretical.nomutable.column.header.company.top' />",

        tov:
          "<fmt:message key='theoretical.nomutable.column.header.company.tov' />",

      },

    },

  };
</script>


<%-- =========================================================================
     Nomu Theoretical Opening Entry Module
     ========================================================================= --%>

<script
  type="module"
  src="${pageContext.request.contextPath}/js/pages/theoretical-opening/nomu-theoretical-opening.js"
></script>
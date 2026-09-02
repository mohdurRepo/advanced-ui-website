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

<c:set var="openCloseAuction" value="false" />

<c:if
	test="${requestScope.marketStatusID == 6 or requestScope.marketStatusID ==1   }">
	<c:set var="openCloseAuction" value="true" />
</c:if>

<%-- =========================================================================
     Sukuk & Bonds Hero
     ========================================================================= --%>

<section class="hero-section surface-hero"
	aria-labelledby="nomu-page-title"
	aria-describedby="nomu-page-description">
	<div class="hero-section__background" aria-hidden="true"></div>

	<div class="container hero-section__content">
		<header class="hero-intro">
			<div class="hero-intro__header">
				<div class="hero-intro__brand">
					<span class="hero-intro__icon has-icon icon-tadawul"
						aria-hidden="true"></span>

					<h2 id="nomu-page-title" class="hero-intro__title">
						<fmt:message key="theoretical.title" />
					</h2>
				</div>

				<p id="nomu-page-description" class="hero-intro__description">
					<fmt:message key="trading.calendar.description" />
				</p>
				</p>
			</div>
		</header>
	</div>
</section>

<%-- =========================================================================
     Sukuk & Bonds Filters
     ========================================================================= --%>

<section class="section sukuk-market-watch-filters pb-0"
	aria-labelledby="sukuk-market-watch-filters-title">
	<div class="container">

		<form class="filter-bar filter-bar--connected"
			aria-labelledby="sukuk-market-watch-filters-title" data-sukuk-filters>
			<h2 class="visually-hidden" id="sukuk-market-watch-filters-title">
				<fmt:message key="sukukAndBonds.marketwatch.title" />
			</h2>

			<%-- ===================================================================
           Primary Controls
           =================================================================== --%>



			<div class="filter-bar__inner">
				<!-- ================================================================
             Filter Fields
             ================================================================ -->

				<div class="filter-bar__fields grid-3">
					<!-- Industry Group -->

					<div class="filter-bar__field">
						<label class="form-label" for="sukuk-bond-type"> <fmt:message
								key="trading.calendar.label.sector" />
						</label>

						<div class="custom-select" data-custom-select data-searchable>
							<div class="form-select-wrap custom-select__fallback">
								<select class="form-select custom-select__native"
									id="sukuk-bond-type" name="industry"
									data-sukuk-bond-type>
									<option value="all"
										<c:if test="${empty requestScope.selectedSector or requestScope.selectedSector eq 'all'}">selected</c:if>>
										<fmt:message key="trading.calendar.label.all.sectors" />
									</option>

									<c:forEach items="${requestScope.sectorList}" var="sectorItem">
										<option value="<c:out value='${sectorItem.modifiedId}' />"
											<c:if test="${requestScope.selectedSector eq sectorItem.modifiedId}">selected</c:if>>
											<c:out value="${sectorItem.modifiedName}" />
										</option>
									</c:forEach>
								</select> <span class="form-select-icon has-icon icon-chevron-down"
									aria-hidden="true"></span>
							</div>
						</div>
					</div>

					<%-- =================================================================
               Visible Columns
               ================================================================= --%>

					<div class="filter-bar__field">

						<span class="form-label-static" id="sukuk-columns-label"> <fmt:message
								key="show.hide.column" />
						</span>

						<button class="btn btn-outline-primary filter-bar__columns"
							type="button" aria-labelledby="sukuk-columns-label"
							aria-haspopup="menu" aria-expanded="false"
							aria-controls="sukuk-columns-menu" data-sukuk-columns>
							<span class="filter-bar__columns-label" data-sukuk-columns-label>
								<fmt:message key="show.hide.all" />
							</span> <span
								class="filter-bar__columns-icon has-icon icon-chevron-down"
								aria-hidden="true"></span>
						</button>

						<div class="filter-bar__columns-menu" id="sukuk-columns-menu"
							aria-label="<fmt:message key='show.hide.column' />"
							data-sukuk-columns-menu hidden>

							<%-- =============================================================
                   Column Actions
                   ============================================================= --%>

							<div class="filter-bar__columns-actions">

								<button type="button" class="filter-bar__columns-action"
									data-sukuk-columns-action="select-all">
									<fmt:message key="select.all" />
								</button>

								<button type="button" class="filter-bar__columns-action"
									data-sukuk-columns-action="clear-all">
									<fmt:message key="clear.all" />
								</button>

							</div>

							<%-- =============================================================
                   Previous Close
                   ============================================================= --%>

							<label class="filter-bar__columns-option"> <input
								type="checkbox" checked data-sukuk-column="prev-close" /> <span>
									<fmt:message key="company.Previous.Close" />
							</span>
							</label>

							<%-- =============================================================
                   TOP
                   ============================================================= --%>

							<label class="filter-bar__columns-option"> <input
								type="checkbox" checked data-sukuk-column="top" /> <span>
									<fmt:message key="company.top" />
							</span>
							</label>

							<%-- =============================================================
                   TOV
                   ============================================================= --%>

							<label class="filter-bar__columns-option"> <input
								type="checkbox" checked data-sukuk-column="tov" /> <span>
									<fmt:message key="company.tov" />
							</span>
							</label>




						</div>
					</div>

				</div>
			</div>

		</form>

	</div>
</section>

<%-- =========================================================================
     Sukuk & Bonds Data View
     ========================================================================= --%>

<section class="section sukuk-market-watch-results pt-0"
	aria-labelledby="sukuk-market-watch-results-title">
	<div class="container">

		<h2 class="visually-hidden" id="sukuk-market-watch-results-title">
			<fmt:message key="sukukAndBonds.marketwatch.title" />
		</h2>

		<div class="data-view data-view--connected" data-sukuk-data-view>

			<%-- ===================================================================
           Workspace
           =================================================================== --%>

			<div class="data-view__workspace">



				<%-- =================================================================
             Desktop Table
             ================================================================= --%>

				<div class="data-view__table">
					<div class="data-view__table-block">

						<table class="table table-market sukuk-market-table"
							data-sukuk-table>
							<thead>

								<tr>

									<%-- Instrument --%>
									<th scope="col"><fmt:message key="companyNameCol" /></th>

									<%-- Previous Close --%>
									<th scope="col"><fmt:message key="company.Previous.Close" />
									</th>

									<%-- TOP --%>
									<th scope="col"><fmt:message key="company.top" /></th>

									<%-- TOV --%>
									<th scope="col"><fmt:message key="company.tov" /></th>




								</tr>

							</thead>

							<tbody></tbody>
						</table>

					</div>
				</div>

				<%-- =================================================================
             Mobile Cards
             ================================================================= --%>

				<div class="data-view__cards" data-sukuk-mobile-cards></div>

			</div>

		</div>
	</div>
</section>

<%-- =========================================================================
     Sukuk Configuration
     ========================================================================= --%>

<script>
  window.SukukConfig = {
    /* ======================================================================
       Endpoint
       ====================================================================== */

    endpoint:
  "<portlet:resourceURL id='getNomukTheoreticalOpeningDetails' />",

    locale:
      "<c:out value='${pageContext.request.locale.language}' />",

    /* ======================================================================
       Initial State
       ====================================================================== */

    initialState: {
      industry:
        "<c:out value='${empty requestScope.selectedSector ? "all" : requestScope.selectedSector}' />",

      tableView:
        "<c:out value='${empty requestScope.selectedTableView ? "1" : requestScope.selectedTableView}' />",

      visibleGroups: [
        "prev-close",
        "top",
        "tov",
        ],
    },

    /* ======================================================================
       Table
       ====================================================================== */

    table: {
    destroy:true,
    retrieve:true,
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

      /* --------------------------------------------------------------------
         Column Picker
         -------------------------------------------------------------------- */

      showAll:
        "<fmt:message key='show.hide.all' />",

      noColumns:
        "<fmt:message key='show.hide.no.columns' />",

      selectedSuffix:
        "<fmt:message key='selected' />",

      selectAll:
        "<fmt:message key='select.all' />",

      clearAll:
        "<fmt:message key='clear.all' />",

      /* --------------------------------------------------------------------
         Table / Card Fields
         -------------------------------------------------------------------- */

      table: {
        companyName:
          "<fmt:message key='theoretical.nomutable.column.header.company.name' />",

        prev_close:
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
     Sukuk Entry Module
     ========================================================================= --%>

<script type="module"
	src="${pageContext.request.contextPath}/js/pages/sukuk/sukuk.js"></script>
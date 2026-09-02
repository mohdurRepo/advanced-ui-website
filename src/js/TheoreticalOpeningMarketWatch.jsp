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




<fmt:setBundle
	basename="sa.com.tadawul.eportal.theoretical.marketwatch.v2.nl.TheoreticalOpeningPortletV2PortletResource" />

<%-- =========================================================================
     Theoretical Opening Hero
     ========================================================================= --%>

<section
    class="hero-section market-summary-section"
    aria-labelledby="theoretical-opening-title"
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
                        id="theoretical-opening-title"
                        class="market-summary__title"
                    >
                        <fmt:message key="theoretical.title" />
                    </h1>

                </div>
            </header>

        </div>
    </div>
</section>

<%-- =========================================================================
     Theoretical Opening Filters
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

            <div class="filter-bar__inner">

                <div class="filter-bar__fields grid-3">

                    <%-- =====================================================
                         Sector
                         ===================================================== --%>

                    <div class="filter-bar__field">

                        <label
                            class="form-label"
                            for="theoretical-opening-sector"
                        >
                            <fmt:message key="selectSectorLabel" />
                        </label>

                        <div
                            class="custom-select"
                            data-custom-select
                        >
                            <div
                                class="form-select-wrap custom-select__fallback"
                            >
                                <select
                                    class="form-select custom-select__native"
                                    id="theoretical-opening-sector"
                                    name="sectorParameter"
                                    data-theoretical-opening-sector
                                >
                                    <option
                                        value="All"
                                        <c:if test="${empty requestScope.selectedSector or requestScope.selectedSector eq 'All'}">
                                            selected
                                        </c:if>
                                    >
                                        <fmt:message key="allMarketCombo" />
                                    </option>

                                    <c:forEach
                                        items="${requestScope.sectorList}"
                                        var="sectorItem"
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

            </div>
        </form>

    </div>
</section>

<%-- =========================================================================
     Theoretical Opening Data View
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

            <div class="data-view__workspace">

                <%-- =========================================================
                     Desktop Table
                     ========================================================= --%>

                <div class="data-view__table">
                    <div class="data-view__table-block">

                        <table
                            class="table table-market"
                            data-theoretical-opening-table
                            aria-busy="true"
                        >
                            <caption class="visually-hidden">
                                <fmt:message key="theoretical.title" />
                            </caption>

                            <thead>
                                <tr>

                                    <th scope="col">
                                        <fmt:message key="companyNameCol" />
                                    </th>

                                    <th
                                        scope="col"
                                        class="text-center"
                                    >
                                        <fmt:message
                                            key="company.Previous.Close"
                                        />
                                    </th>

                                    <th
                                        scope="col"
                                        class="text-center"
                                    >
                                        <fmt:message key="company.top" />
                                    </th>

                                    <th
                                        scope="col"
                                        class="text-center"
                                    >
                                        <fmt:message key="company.tov" />
                                    </th>

                                </tr>
                            </thead>

                            <tbody></tbody>
                        </table>

                    </div>
                </div>

                <%-- =========================================================
                     Mobile Cards
                     ========================================================= --%>

                <div
                    class="data-view__cards"
                    data-theoretical-opening-cards
                ></div>

            </div>

        </div>

        <%-- =================================================================
             Notes
             ================================================================= --%>

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
                    <fmt:message
                        key="top.market.watch.prices.delayed"
                    />
                </li>

            </ul>
        </div>

    </div>
</section>

<%-- =========================================================================
     Theoretical Opening Configuration
     ========================================================================= --%>

<%-- =========================================================================
     Theoretical Opening Configuration
     ========================================================================= --%>

<script>
    window.TheoreticalOpeningConfig = {
        endpoint:
            "<portlet:resourceURL id='getTheoreticalOpeningDetails' />",

        locale:
            "<c:out value='${pageContext.request.locale.language}' />",

        initialState: {
            sector:
                "<c:out value='${empty requestScope.selectedSector ? "All" : requestScope.selectedSector}' />"
        },

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
            fixedColumns: 1
        },

        labels: {
            loading:
                "<fmt:message key='loading' />",

            noData:
                "<fmt:message key='noDataAvailable' />",

            table: {
                companyName:
                    "<fmt:message key='companyNameCol' />",

                previousClose:
                    "<fmt:message key='company.Previous.Close' />",

                top:
                    "<fmt:message key='company.top' />",

                tov:
                    "<fmt:message key='company.tov' />"
            }
        }
    };
</script>

<%-- =========================================================================
     Theoretical Opening Module
     ========================================================================= --%>

<script
    type="module"
    src="${pageContext.request.contextPath}/js/theoretical-opening/theoretical-opening.js"
></script>
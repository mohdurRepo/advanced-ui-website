<%@page session="false" contentType="text/html"
	pageEncoding="ISO-8859-1"
	import="java.util.*,javax.portlet.*,sa.com.tadawul.eportal.market.performance.v2.*"%>
<%@ page
	import="sa.com.tadawul.eportal.market.performance.v2.constants.MarketPerformanceConstants"%>
<%@ taglib uri="http://java.sun.com/portlet_2_0" prefix="portlet"%>
<%@taglib
	uri="http://www.ibm.com/xmlns/prod/websphere/portal/v6.1/portlet-client-model"
	prefix="portlet-client-model"%>

<%@taglib uri="http://java.sun.com/jsp/jstl/core" prefix="c"%>
<%@taglib uri="http://java.sun.com/jsp/jstl/fmt" prefix="fmt"%>
<%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions"%>

<portlet:defineObjects />
<portlet-client-model:init>
	<portlet-client-model:require module="ibm.portal.xml.*" />
	<portlet-client-model:require module="ibm.portal.portlet.*" />
</portlet-client-model:init>

<fmt:setBundle
	basename="sa.com.tadawul.eportal.market.performance.v2.nl.MarketPerformanceV2PortletResource" />

<script src="${pageContext.request.contextPath}/js/datatables.js"></script>
<script src="${pageContext.request.contextPath}/js/datatables-fixedheader.js"></script>
<script src="${pageContext.request.contextPath}/js/datatables-rowgroup.js"></script>

<portlet:renderURL var="getMarketPerformance">
</portlet:renderURL>

<style>
	.card-view-content
	{
		display: none;
	}
</style>



<section class="app-container hero-banner-section">
	<div class="intro-background">
		<div class="intro-gradient top-left"></div>
		<div class="intro-gradient bottom-right"></div>
		<div class="intro-image-layer"></div>
	</div>
	<input type="hidden" id="requestLocale" name="requestLocale"
		value="${pageContext.request.locale.language}" />
	<div class="profile-banner animate__animated animate__fadeIn">
		<div class="profile-banner--pattern">
			<form action="<%=getMarketPerformance%>" id="MarketPerformance">
				<input type="hidden" name="reportFilter" value="active" /> <input
					type="hidden" name="sectorFilter" value="viewAllMarket" /> <input
					type="hidden" name="timeFrameFilter" value="1 Years" /> <input
					type="hidden" name="isNonAdjusted" value="0" /> <input
					type="hidden" id="requestLocale" name="requestLocale"
					value="${pageContext.request.locale.language}" />

			</form>

			<form action="<%=getMarketPerformance%>" id="TimeKSA">
				<input type="hidden" name="reportFilter" value="active" /> <input
					type="hidden" name="sectorFilter" value="viewAllMarket" /> <input
					type="hidden" name="timeFrameFilter" value="1 Years" /> <input
					type="hidden" name="isNonAdjusted" value="1" /> <input
					type="hidden" id="requestLocaleKsa" name="requestLocaleKsa"
					value="${pageContext.request.locale.language}" />

			</form>
			<div class="row">
				<div class="col-12">
					<h2>
						<svg class="pc-icon pr-3 link-icon me-3" width="40" height="40"
							style="color: rgb(255, 255, 255); fill: rgb(255, 255, 255)">
                    <use xlink:href="#tadawul-arrow-icon"></use>
                  </svg>
						<label style="color: #FFFFFF"><fmt:message
								key="marketperformance.marketPerformance" /></label>
					</h2>
				</div>



				<div class="col-12 col-md-4 col-sm-6 col-xm-12">
					<div class="form-field">
						<label class="form-label" for="tableViewParameter"> <fmt:message
								key="marketperformance.selectReport" />
						</label>

						<div class="form-control-shell is-select" tabindex="0" data-select
							data-field="report" data-action="fetchData">

							<!-- Visible value -->
							<div class="form-select-value is-placeholder" id="tableViewValue">
								<fmt:message key="marketperformance.filter1" />
							</div>

							<!-- Hidden input -->
							<input type="hidden"
								name="<%=MarketPerformanceConstants.PARAMETER_REPORT_Filter%>"
								id="reportList" />

							<!-- Arrow -->
							<span class="form-suffix form-select-arrow" aria-hidden="true"></span>

							<!-- Dropdown -->
							<div class="form-popover">
								<div class="form-select-panel">
									<div class="form-select-list">
										<div class="form-select-option"
											data-value="<%=MarketPerformanceConstants.PARAMETER_Filter_MOST_ACTIVE_by_VOLUME%>"
											data-selected="true">
											<fmt:message key="marketperformance.filter1" />
										</div>
										<div class="form-select-option"
											data-value="<%=MarketPerformanceConstants.PARAMETER_Filter_GAINERS_LOSER_VALUE%>">
											<fmt:message key="marketperformance.filter3" />
										</div>
										<div class="form-select-option"
											data-value="<%=MarketPerformanceConstants.PARAMETER_Filter_GAINERS_LOSER_PRE%>">
											<fmt:message key="marketperformance.filter4" />
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>



				<div class="col-12 col-md-4 col-sm-6 col-xm-12">
					<div class="form-field">
						<label class="form-label" for="tableViewParameter"> <fmt:message
								key="marketperformance.selectPeriod" />
						</label>

						<div class="form-control-shell is-select" tabindex="0" data-select
							data-field="period" data-action="fetchData">

							<!-- Visible value -->
							<div class="form-select-value is-placeholder" id="tableViewValue">
								<fmt:message
									key="marketwatch.todaywatch.v2.label.tableview.default" />
							</div>

							<!-- Hidden input -->
							<input type="hidden"
								name="<%=MarketPerformanceConstants.PARAMETER_TIME_FRAME_Filter%>"
								id="periodList" />

							<!-- Arrow -->
							<span class="form-suffix form-select-arrow" aria-hidden="true"></span>

							<!-- Dropdown -->
							<div class="form-popover">
								<div class="form-select-panel">
									<div class="form-select-list">
										<div class="form-select-option" data-value="7 Days"
											<c:if test="${'7 Days' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											 data-selected="true"
						                   </c:if>>
											<fmt:message key="marketperformance.6days" />
										</div>

										<div class="form-select-option" data-value="14 Days"
											<c:if test="${'14 Days' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											 data-selected="true"
						                   </c:if>>
											<fmt:message key="marketperformance.2weeks" />
										</div>

										<div class="form-select-option" data-value="1 Months"
											<c:if test="${'1 Months' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											 data-selected="true"
						                   </c:if>>
											<fmt:message key="marketperformance.1month" />
										</div>

										<div class="form-select-option" data-value="3 Months"
											<c:if test="${'3 Months' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											 data-selected="true"
						                   </c:if>>
											<fmt:message key="marketperformance.3months" />
										</div>

										<div class="form-select-option" data-value="6 Months"
											<c:if test="${'6 Months' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											 data-selected="true"
						                   </c:if>>
											<fmt:message key="marketperformance.6months" />
										</div>

										<div class="form-select-option" data-value="9 Months"
											<c:if test="${'9 Months' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											 data-selected="true"
						                   </c:if>>
											<fmt:message key="marketperformance.9months" />
										</div>

										<div class="form-select-option" data-value="1 Years"
											<c:if test="${'1 Years' eq requestScope.viewMarketPerformance.previousTimeFrameFilter ||
																		 empty requestScope.viewMarketPerformance.previousTimeFrameFilter}">
																		  data-selected="true"
						                   </c:if>>
											<fmt:message key="marketperformance.1year" />
										</div>

										<div class="form-select-option" data-value="2 Years"
											<c:if test="${'2 Years' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											 data-selected="true"
						                   </c:if>>
											<fmt:message key="marketperformance.2year" />
										</div>

										<div class="form-select-option" data-value="3 Years"
											<c:if test="${'3 Years' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
						                     data-selected="true"
						                   </c:if>>
											<fmt:message key="marketperformance.3year" />
										</div>

										<div class="form-select-option" data-value="5 Years"
											<c:if test="${'5 Years' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
						                     data-selected="true"
						                   </c:if>>
											<fmt:message key="marketperformance.5year" />
										</div>

									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="col-12 col-md-4 col-sm-6 col-xm-12">
					<div class="form-field">
						<label for="sectorParameter" class="form-label"> <fmt:message
								key="marketperformance.sector" />
						</label>

						<div class="form-control-shell is-select is-search" tabindex="0"
							data-select data-field="sector" data-action="fetchData">

							<!-- Visible value -->
							<div class="form-select-value is-placeholder" id="sectorValue">
								<fmt:message key="marketperformance.allMarket" />
							</div>

							<!-- Hidden input -->
							<input type="hidden"
								name="<%=MarketPerformanceConstants.PARAMETER_SECTOR_Filter%>"
								id="sectorList" required data-label="Sector" />

							<!-- Arrow -->
							<span class="form-suffix form-select-arrow" aria-hidden="true"></span>

							<!-- Dropdown -->
							<div class="form-popover">
								<div class="form-select-panel">

									<!-- Search -->
									<div class="form-select-search-wrap">
										<input type="text" class="form-select-search"
											placeholder="<fmt:message key='marketperformance.reload' />" />
									</div>

									<!-- Options -->
									<div class="form-select-list">

										<div class="form-select-option"
											data-value="<%=MarketPerformanceConstants.FORM_ACTION_VIEW_ALL_MARKET%>"
											data-selected="true">
											<fmt:message key="marketperformance.allMarket" />
										</div>
										<c:forEach
											items="${requestScope.viewMarketPerformance.allSectors}"
											var="sectors" varStatus="sectorsCount">

											<div class="form-select-option"
												data-value="${sectors.pk_rf_sector}"
												<c:if test="${fn:contains(requestScope.viewMarketPerformance.previousSectorFilter, sectors.pk_rf_sector)} "> data-selected="true"</c:if>>
												${sectors.name}</div>
										</c:forEach>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="app-container row">
		<div class=" mt-0">
			<!-- Nav tabs -->
			<div class="tabs-for-mobile market-perfomence-tab">
				<ul class="nav nav-tabs mainTabs" id="mainTabs" role="tablist">
					<li class="nav-item" role="presentation" id="tab1"
						onclick="<portlet:namespace/>switchTab('tab1');">
						<button class="nav-link active" data-bs-toggle="tab"
							id="Market Performance-tab"
							data-bs-target="#MarketPerformanceinside" type="button"
							role="tab">
							<fmt:message key="marketperformance.Adjusted.tabtext" />
						</button>
					</li>
					<li class="nav-item" role="presentation" id="tab2"
						onclick="<portlet:namespace/>switchTab('tab2');">
						<button class="nav-link" id="TimeKSA-tab" data-bs-toggle="tab"
							data-bs-target="#TimeKSAinside" type="button" role="tab">
							<fmt:message key="marketperformance.NonAdjusted" />
						</button>
					</li>
				</ul>
			</div>


			<!-- Tab content -->
			<div class="tab-content mt-3">

				<div class="tab-pane fade show active" id="MarketPerformanceinside"
					role="tabpanel">
					

					<div class="list-view-content">


						<table id="marketPerformanceTable1"
							class="display table">
							<thead class="cf">
								<tr class="hdngTr parentHeading"
									>
									<td colspan="9"><fmt:message
											key="marketperformance.gainersTitle" /></td>
								</tr>
								<tr>
									<th class="text-center"><fmt:message key="marketperformance.company" /></th>
									<th class="text-center"><fmt:message key="marketperformance.beginprice" /></th>
									<th class="text-center"><fmt:message key="marketperformance.high" /></th>
									<th class="text-center"><fmt:message key="marketperformance.low" /></th>
									<th class="text-center"><fmt:message key="marketperformance.endprice" /></th>
									<th class="text-center"><fmt:message key="marketperformance.change" /></th>
									<th class="text-center"><fmt:message key="marketperformance.changePer" /></th>
									<th class="text-center"><fmt:message key="marketperformance.totalvolume" /></th>
									<th class="text-center"><fmt:message key="marketperformance.value" />&nbsp;(<span
										class="sar-symbol"><svg class="pc-icon pr-3 link-icon"
												width="15" height="15">
<use xlink:href="#custom-riyal-icon"></use>
</svg></span>)</th>
								</tr>
							</thead>
							<tbody>
							</tbody>
						</table>
						<table id="marketPerformanceTable2"
							class="display table">
							<thead class="cf">
								<tr class="hdngTr parentHeading"
									>
									<td colspan="9"><fmt:message
											key="marketperformance.gainersTitle" /></td>
								</tr>

								<tr>
									<th class="text-center"><fmt:message key="marketperformance.company" /></th>
									<th class="text-center"><fmt:message key="marketperformance.beginprice" /></th>
									<th class="text-center"><fmt:message key="marketperformance.high" /></th>
									<th class="text-center"><fmt:message key="marketperformance.low" /></th>
									<th class="text-center"><fmt:message key="marketperformance.endprice" /></th>
									<th class="text-center"><fmt:message key="marketperformance.change" /></th>
									<th class="text-center"><fmt:message key="marketperformance.changePer" /></th>
									<th class="text-center"><fmt:message key="marketperformance.totalvolume" /></th>
									<th class="text-center"><fmt:message key="marketperformance.value" />&nbsp;(<span
										class="sar-symbol"><svg class="pc-icon pr-3 link-icon"
												width="15" height="15">
<use xlink:href="#custom-riyal-icon"></use>
</svg></span>)</th>
								</tr>
							</thead>
							<tbody>
							</tbody>
						</table>
						<table id="marketPerformanceTable3"
							class="display table">
							<thead class="cf">
								<tr class="hdngTr parentHeading"
									>
									<td colspan="9"><fmt:message
											key="marketperformance.losersTitle" /></td>
								</tr>
								<tr>

									<th class="text-center"><fmt:message key="marketperformance.company" /></th>
									<th class="text-center"><fmt:message key="marketperformance.beginprice" /></th>
									<th class="text-center"><fmt:message key="marketperformance.high" /></th>
									<th class="text-center"><fmt:message key="marketperformance.low" /></th>
									<th class="text-center"><fmt:message key="marketperformance.endprice" /></th>
									<th class="text-center"><fmt:message key="marketperformance.change" /></th>
									<th class="text-center"><fmt:message key="marketperformance.changePer" /></th>
									<th class="text-center"><fmt:message key="marketperformance.totalvolume" /></th>
									<th class="text-center"><fmt:message key="marketperformance.value" />&nbsp;(<span
										class="sar-symbol"><svg class="pc-icon pr-3 link-icon"
												width="15" height="15">
<use xlink:href="#custom-riyal-icon"></use>
</svg></span>)</th>
								</tr>
							</thead>
							<tbody>
							</tbody>
						</table>


					</div>


					<div class="card-view-content">
						<div class="Performance-card-section" id="cardContainer"></div>

					</div>

				</div>

				<div class="tab-pane fade" id="TimeKSAinside" role="tabpanel">

					


					<div class="list-view-content">
						<table id="marketPerformanceTable4"
							class="col-md-12 table-bordered table-striped table-condensed cf setable">
							<thead class="cf">
								<tr class="hdngTr parentHeading"
									>
									<td colspan="9"><fmt:message
											key="marketperformance.gainersTitle" /></td>
								</tr>
								<tr>
									<th class="text-center"><fmt:message key="marketperformance.company" /></th>
									<th class="text-center"><fmt:message key="marketperformance.beginprice" /></th>
									<th class="text-center"><fmt:message key="marketperformance.high" /></th>
									<th class="text-center"><fmt:message key="marketperformance.low" /></th>
									<th class="text-center"><fmt:message key="marketperformance.endprice" /></th>
									<th class="text-center"><fmt:message key="marketperformance.change" /></th>
									<th class="text-center"><fmt:message key="marketperformance.changePer" /></th>
									<th class="text-center"><fmt:message key="marketperformance.totalvolume" /></th>
									<th class="text-center"><fmt:message key="marketperformance.value" />&nbsp;(<span
										class="sar-symbol"><svg class="pc-icon pr-3 link-icon"
												width="15" height="15">
<use xlink:href="#custom-riyal-icon"></use>
</svg></span>)</th>
								</tr>
							</thead>
							<tbody>
							</tbody>
						</table>




						<table id="marketPerformanceTable5"
							class="col-md-12 table-bordered table-striped table-condensed cf setable">
							<thead class="cf">
								<tr class="hdngTr parentHeading"
									>
									<td colspan="9"><fmt:message
											key="marketperformance.gainersTitle" /></td>
								</tr>
								<tr>
									<th class="text-center"><fmt:message key="marketperformance.company" /></th>
									<th class="text-center"><fmt:message key="marketperformance.beginprice" /></th>
									<th class="text-center"><fmt:message key="marketperformance.high" /></th>
									<th class="text-center"><fmt:message key="marketperformance.low" /></th>
									<th class="text-center"><fmt:message key="marketperformance.endprice" /></th>
									<th class="text-center"><fmt:message key="marketperformance.change" /></th>
									<th class="text-center"><fmt:message key="marketperformance.changePer" /></th>
									<th class="text-center"><fmt:message key="marketperformance.totalvolume" /></th>
									<th class="text-center"><fmt:message key="marketperformance.value" />&nbsp;(<span
										class="sar-symbol"><svg class="pc-icon pr-3 link-icon"
												width="15" height="15">
<use xlink:href="#custom-riyal-icon"></use>
</svg></span>)</th>
								</tr>
							</thead>
							<tbody>
							</tbody>
						</table>




						<table id="marketPerformanceTable6"
							class="display table">
							<thead class="cf">
								<tr class="hdngTr parentHeading"
									>
									<td colspan="9"><fmt:message
											key="marketperformance.losersTitle" /></td>
								</tr>
								<tr>
									<th class="text-center"><fmt:message key="marketperformance.company" /></th>
									<th class="text-center"><fmt:message key="marketperformance.beginprice" /></th>
									<th class="text-center"><fmt:message key="marketperformance.high" /></th>
									<th class="text-center"><fmt:message key="marketperformance.low" /></th>
									<th class="text-center"><fmt:message key="marketperformance.endprice" /></th>
									<th class="text-center"><fmt:message key="marketperformance.change" /></th>
									<th class="text-center"><fmt:message key="marketperformance.changePer" /></th>
									<th class="text-center"><fmt:message key="marketperformance.totalvolume" /></th>
									<th class="text-center"><fmt:message key="marketperformance.value" />&nbsp;(<span
										class="sar-symbol"><svg class="pc-icon pr-3 link-icon"
												width="15" height="15"> <use
													xlink:href="#custom-riyal-icon"></use> </svg></span>)</th>
								</tr>
							</thead>
							<tbody>
							</tbody>
						</table>
					</div>
					<div class="card-view-content">
						<div class="Performance-card-section" id="cardContainer-ksa">

						</div>


					</div>







				</div>

			</div>
		</div>
	</div>
</section>



<script type="text/javascript">


  var <portlet:namespace/>NO_DATA_MESSAGE = "<fmt:message key='market.perfomance.no.data'/>";
 var <portlet:namespace/>LOAD_MESSAGE = "<fmt:message key='data.loading.market.performance'/>";


function fetchData(){
<portlet:namespace/>submitAjaxForm();
}
var selectedTab = 'tab1';
$(document).ready(function() {
	<portlet:namespace/>submitAjaxForm();
});
 
 
 
function <portlet:namespace/>submitPerformanceForm(){
	$('#MarketPerformance').submit();
}


function <portlet:namespace/>submitPerformanceFormKsa(){
	$('#TimeKSA').submit();
}


function <portlet:namespace/>switchTab(tab){
console.log("switchTab clicked >> "+tab);
	if(tab == 'tab2'){
		selectedTab = 'tab2';
		
	}else{
		selectedTab = 'tab1';
	}
	<portlet:namespace/>submitAjaxForm();
}
	


function <portlet:namespace/>resetFormDetails(){
    
  	$("#reportList :selected").val('active');
    $("#sectorList :selected").val('viewAllmarket');
 	$("#periodList :selected").val('1 Years');
 	$("#periodList :selected").innerHtml("<select id='periodList' name='timeFrameFilter' onchange='<portlet:namespace/>submitAjaxForm();'>"
											+"<option value='7 Days'>6 Days</option>"
											+"<option value='1 Years' selected>1 Year</option>"
											+"</select>");
					 	
     
      <portlet:namespace/>submitAjaxForm();
      
}




 
var LABEL_OPEN   = '<fmt:message key="marketperformance.beginprice"/>';
var LABEL_HIGH   = '<fmt:message key="marketperformance.high"/>';
var LABEL_LOW    = '<fmt:message key="marketperformance.low"/>';
var LABEL_CLOSE  = '<fmt:message key="marketperformance.endprice"/>';
var LABEL_VOLUME = '<fmt:message key="marketperformance.totalvolume"/>';
var LABEL_VALUE  = '<fmt:message key="marketperformance.value"/>';
var LABEL_CHANGE = '<fmt:message key="marketperformance.change"/>';
 
 
 

function buildCardView(dataList) {
 
 console.log(dataList);
 
    var container = document.getElementById("cardContainer");
  
  if(!container) return;
  
    container.innerHTML = "";
 
    dataList.forEach(function(row) {
 
        var cardHtml =
          '<div id="cardParentHeading" >'+
  
'</div>'+
            '<div class="Performance-card">' +
 
                '<div class="Performance-card-company-name">' +
                    '<div class="comany-name-value">' +
                        '<label class="stock-number">' + row.companyRef + '</label>' +
                        '<label class="stock-name">' + row.acrynomName + '</label>' +
                    '</div>' +
 
                    '<label class="price-up">' +
                        formatMoneyhtml(row.changeValue) + ' (' + formatMoneyhtml(row.ChangePrecent) + '%)' +
                    '</label>' +
                '</div>' +
 
                '<div class="market-performence-values">' +
 
                    '<div class="stock-performence-values">' +
                        '<span>' + LABEL_OPEN + '</span>' +
                        '<span>' + formatMoneyhtml(row.beginPrice) + '</span>' +
                    '</div>' +
 
                    '<div class="stock-performence-values">' +
                        '<span>' + LABEL_HIGH + '</span>' +
                        '<span>' + row.highPrice + '</span>' +
                    '</div>' +
 
                    '<div class="stock-performence-values">' +
                        '<span>' + LABEL_LOW + '</span>' +
                        '<span>' + row.lowPrice + '</span>' +
                    '</div>' +
 
                    '<div class="stock-performence-values">' +
                        '<span>' + LABEL_CLOSE + '</span>' +
                        '<span>' + row.endPrice + '</span>' +
                    '</div>' +
 
                '</div>' +
 
                '<div class="market-performence-two-columns-vlues">' +
 
                    '<div class="stock-performence-values">' +
                        '<span>' + LABEL_VOLUME + '</span>' +
                        '<span>' + formatQuantityhtml(row.volumeTraded) + '</span>' +
                    '</div>' +
 
                    '<div class="stock-performence-values">' +
                        '<span>' + LABEL_VALUE + '</span>' +
                        '<span>' + formatMoneyhtml(row.value) + '</span>' +
                    '</div>' +
 
                '</div>' +
 
            '</div>';
 
        container.innerHTML += cardHtml;
    });
}


 

function buildCardViewksa(dataList) {
 
 console.log(dataList);
 
    var container = document.getElementById("cardContainer-ksa");
    if(!container) return;
    container.innerHTML = "";
 
    dataList.forEach(function(row) {
    
 
        var cardHtml =
            '<div class="Performance-card">' +
 
                '<div class="Performance-card-company-name">' +
                    '<div class="comany-name-value">' +
                        '<label class="stock-number">' + row.companyRef + '</label>' +
                        '<label class="stock-name">' + row.acrynomName + '</label>' +
                    '</div>' +
 
                    '<label class="price-up">' +
                        formatMoneyhtml(row.changeValue) + ' (' + formatMoneyhtml(row.ChangePrecent) + '%)' +
                    '</label>' +
                '</div>' +
 
                '<div class="market-performence-values">' +
 
                    '<div class="stock-performence-values">' +
                        '<span>' + LABEL_OPEN + '</span>' +
                        '<span>' + row.beginPrice + '</span>' +
                    '</div>' +
 
                    '<div class="stock-performence-values">' +
                        '<span>' + LABEL_HIGH + '</span>' +
                        '<span>' + row.highPrice + '</span>' +
                    '</div>' +
 
                    '<div class="stock-performence-values">' +
                        '<span>' + LABEL_LOW + '</span>' +
                        '<span>' + row.lowPrice + '</span>' +
                    '</div>' +
 
                    '<div class="stock-performence-values">' +
                        '<span>' + LABEL_CLOSE + '</span>' +
                        '<span>' + row.endPrice + '</span>' +
                    '</div>' +
 
                '</div>' +
 
                '<div class="market-performence-two-columns-vlues">' +
 
                    '<div class="stock-performence-values">' +
                        '<span>' + LABEL_VOLUME + '</span>' +
                        '<span>' + formatQuantityhtml(row.volumeTraded) + '</span>' +
                    '</div>' +
 
                    '<div class="stock-performence-values">' +
                        '<span>' + LABEL_VALUE + '</span>' +
                        '<span>' + formatMoneyhtml(row.value) + '</span>' +
                    '</div>' +
 
                '</div>' +
 
            '</div>';
 
        container.innerHTML += cardHtml;
    });
}






function <portlet:namespace/>submitAjaxForm(){
    
    var reportFilterVal=$("#reportList").val();
    var sectorFilterVal=$("#sectorList").val();
    var timeFrameFilterVal=$("#periodList").val();

 console.log(reportFilterVal, reportFilterVal, reportFilterVal);
 
    console.log("selectedTab >> "+selectedTab);
    console.log("sectorFilterVal:"+sectorFilterVal+" , reportFilterVal:"+reportFilterVal+" , timeFrameFilterVal :"+timeFrameFilterVal);
	if(selectedTab == 'tab1'){
	
		console.log("tab1 table is constructing now..");
		if(reportFilterVal == 'active'){
		$('.parentHeading').hide();
		console.log("active table, one table to show");
		//	$('#marketPerformanceTable1').dataTable().fnClearTable();
		$('#marketPerformanceTable1').DataTable().clear().draw();
			
		//	$('#marketPerformanceTable1').dataTable().fnDestroy();
			$('#marketPerformanceTable1').DataTable().destroy();
			$('#marketPerformanceTable1_wrapper').show();
	   		$('#marketPerformanceTable1').show(); 
	   		<portlet:namespace />populateTable1();
	   		
	   		$('#marketPerformanceTable2').DataTable().clear().draw();
			$('#marketPerformanceTable2').DataTable().destroy();
	   	    $('#marketPerformanceTable2_wrapper').hide();
	   		$('#marketPerformanceTable2').hide(); 
	   		
	   		$('#marketPerformanceTable3').DataTable().clear().draw();
			$('#marketPerformanceTable3').DataTable().destroy();
	   		$('#marketPerformanceTable3_wrapper').hide();
	   		$('#marketPerformanceTable3').hide(); 
	   		
	   		
	   		$('#marketPerformanceTable4').DataTable().clear().draw();
			$('#marketPerformanceTable4').DataTable().destroy();
	   		$('#marketPerformanceTable4_wrapper').hide();
	   		$('#marketPerformanceTable4').hide(); 
	   		
	   		
	   		$('#marketPerformanceTable5').DataTable().clear().draw();
			$('#marketPerformanceTable5').DataTable().destroy();
	   		$('#marketPerformanceTable5_wrapper').hide();
	   		$('#marketPerformanceTable5').hide(); 
	   		
	   		
	   		$('#marketPerformanceTable6').DataTable().clear().draw();
			$('#marketPerformanceTable6').DataTable().destroy();
	   		$('#marketPerformanceTable6_wrapper').hide();
	   		$('#marketPerformanceTable6').hide(); 
	   			$($.fn.dataTable.tables(true)).DataTable().columns.adjust()
	   		
	   		
		}else{
		console.log("gainers/losers 2 tables to show");
		$('.parentHeading').show();
		$('#marketPerformanceTable1').DataTable().clear().draw();
		$('#marketPerformanceTable1').DataTable().destroy();
		$('#marketPerformanceTable1_wrapper').hide();
	   	$('#marketPerformanceTable1').hide(); 
	   		
		$('#marketPerformanceTable2').DataTable().clear().draw();
		$('#marketPerformanceTable2').DataTable().destroy();
		$('#marketPerformanceTable2_wrapper').show();
	   	$('#marketPerformanceTable2').show(); 
	   		<portlet:namespace />populateTable2();
	   		
		$('#marketPerformanceTable3').DataTable().clear().draw();
		$('#marketPerformanceTable3').DataTable().destroy();
   		$('#marketPerformanceTable3_wrapper').show();
   		$('#marketPerformanceTable3').show(); 
	   		<portlet:namespace />populateTable3();
	   		
	   		
	   		$('#marketPerformanceTable4').DataTable().clear().draw();
			$('#marketPerformanceTable4').DataTable().destroy();
	   		$('#marketPerformanceTable4_wrapper').hide();
	   		$('#marketPerformanceTable4').hide(); 
	   		
	   		
	   		$('#marketPerformanceTable5').DataTable().clear().draw();
			$('#marketPerformanceTable5').DataTable().destroy();
	   		$('#marketPerformanceTable5_wrapper').hide();
	   		$('#marketPerformanceTable5').hide(); 
	   		
	   		
	   		$('#marketPerformanceTable6').DataTable().clear().draw();
			$('#marketPerformanceTable6').DataTable().destroy();
	   		$('#marketPerformanceTable6_wrapper').hide();
	   		$('#marketPerformanceTable6').hide(); 
	   		
	   			$($.fn.dataTable.tables(true)).DataTable().columns.adjust()
		}
			 $('#cardContainer').show();
	$('#cardContainer-ksa').hide();
	  }else if(selectedTab == 'tab2'){
		console.log("tab2 table is constructing now..");
		if(reportFilterVal == 'active'){
		$('.parentHeading').hide();
		console.log("active table, one table to show");
		
			$('#marketPerformanceTable1').DataTable().clear().draw();
			$('#marketPerformanceTable1').DataTable().destroy();
			$('#marketPerformanceTable1_wrapper').hide();
	   		$('#marketPerformanceTable1').hide(); 
	   		
	   		$('#marketPerformanceTable2').DataTable().clear().draw();
			$('#marketPerformanceTable2').DataTable().destroy();
	   	    $('#marketPerformanceTable2_wrapper').hide();
	   		$('#marketPerformanceTable2').hide(); 
	   		
	   		$('#marketPerformanceTable3').DataTable().clear().draw();
			$('#marketPerformanceTable3').DataTable().destroy();
	   		$('#marketPerformanceTable3_wrapper').hide();
	   		$('#marketPerformanceTable3').hide();  
	   		
			$('#marketPerformanceTable4').DataTable().clear().draw();
			$('#marketPerformanceTable4').DataTable().destroy();
			$('#marketPerformanceTable4_wrapper').show();
	   		$('#marketPerformanceTable4').show(); 
	   		<portlet:namespace />populateTable4();
	   		
	   		$('#marketPerformanceTable5').DataTable().clear().draw();
			$('#marketPerformanceTable5').DataTable().destroy();
	   	    $('#marketPerformanceTable5_wrapper').hide();
	   		$('#marketPerformanceTable5').hide(); 
	   		
	   		$('#marketPerformanceTable6').DataTable().clear().draw();
			$('#marketPerformanceTable6').DataTable().destroy();
	   		$('#marketPerformanceTable6_wrapper').hide();
	   		$('#marketPerformanceTable6').hide(); 
	   		
	   		$($.fn.dataTable.tables(true)).DataTable().columns.adjust()
	   		
		}else{
		$('.parentHeading').show();
		console.log("gainers/losers 2 tables to show");
		
		$('#marketPerformanceTable1').DataTable().clear().draw();
		$('#marketPerformanceTable1').DataTable().destroy();
		$('#marketPerformanceTable1_wrapper').hide();
   		$('#marketPerformanceTable1').hide(); 
   		
   		$('#marketPerformanceTable2').DataTable().clear().draw();
		$('#marketPerformanceTable2').DataTable().destroy();
   	    $('#marketPerformanceTable2_wrapper').hide();
   		$('#marketPerformanceTable2').hide(); 
   		
   		$('#marketPerformanceTable3').DataTable().clear().draw();
		$('#marketPerformanceTable3').DataTable().destroy();
   		$('#marketPerformanceTable3_wrapper').hide();
   		$('#marketPerformanceTable3').hide(); 
	   		
		$('#marketPerformanceTable4').DataTable().clear().draw();
		$('#marketPerformanceTable4').DataTable().destroy();
		$('#marketPerformanceTable4_wrapper').hide();
	   	$('#marketPerformanceTable4').hide();
	   		
		$('#marketPerformanceTable5').DataTable().clear().draw();
		$('#marketPerformanceTable5').DataTable().destroy();
		$('#marketPerformanceTable5_wrapper').show();
	   	$('#marketPerformanceTable5').show(); 
	   		<portlet:namespace />populateTable5();
	   		
		$('#marketPerformanceTable6').DataTable().clear().draw();
		$('#marketPerformanceTable6').DataTable().destroy();
   		$('#marketPerformanceTable6_wrapper').show();
   		$('#marketPerformanceTable6').show(); 
	   		<portlet:namespace />populateTable6();
	   		
	   		
	   		$($.fn.dataTable.tables(true)).DataTable().columns.adjust()
		}
		
		
		$('#cardContainer').hide();
	$('#cardContainer-ksa').show();
	  }//tab2
	}
	
	function <portlet:namespace />populateTable1(){
	var requestLocale =$("#requestLocale").val();
		$('#marketPerformanceTable1').dataTable({
		responsive: true,
		//"sPaginationType": "combobox",
		ajax:{
			url: '<portlet:resourceURL id="getNomucMarketPerformanceDetails"></portlet:resourceURL>',
			type: 'GET',
			/* data:{
				reportFilter:reportFilterVal,
				sectorFilter:sectorFilterVal,
				timeFrameFilter:timeFrameFilterVal
			} */
			data:{
			reportFilter:$("#reportList").val(),
			sectorFilter:$("#sectorList").val(),
			timeFrameFilter:$("#periodList").val(),
			isNonAdjusted:"0",
			requestLocale:requestLocale
			},
			dataSrc:function(response){
			buildCardView(response.data);
			return response.data;
			}
		},
		
		columns: [
              {"data":"acrynomName",},
              {"data":"beginPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"highPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"lowPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"endPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"changeValue",  "num-fmt": "-99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"ChangePrecent",  "num-fmt": "-99.99%", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"volumeTraded",  "num-fmt": "9,999,999,999", "mRender": function (data, type, full) {
              			return parseFloat(data).formatQuantity();
              }},
              {"data":"value",  "num-fmt": "999,999,999.99", "mRender": function (data, type, full) {
              			return parseFloat(data).formatMoney();
              }}
        ],
       
        fixedHeader: true,
        paging:   false,
        scrollX: true,
        scrollCollapse: true,
        ordering: true,
        order:[],
        info:     false,
        searching: false,
         responsive: true,
          language: {
            emptyTable:  <portlet:namespace/>NO_DATA_MESSAGE,
            zeroRecords: <portlet:namespace/>NO_DATA_MESSAGE,
            infoEmpty:   <portlet:namespace/>NO_DATA_MESSAGE, 
            loadingRecords: <portlet:namespace/>LOAD_MESSAGE, 
            processing:    <portlet:namespace/>LOAD_MESSAGE
        },
         oLanguage: {
       		sLengthMenu: "_MENU_"
    	 },
    	 
    	 
    	 fnRowCallback: function( nRow, aData, iIndex ) {
    	
    	 var cUrl = aData.companyURL;
         if ( typeof(cUrl) != "undefined" && cUrl != null){
			  $('td:eq(0)', nRow).html('<a class="ellipsis" href="'+cUrl+'">'+aData.acrynomName+'</a>');
		 }else{
			$('td:eq(0)', nRow).html('<a class="ellipsis" href="#">'+aData.acrynomName+'</a>');
		 }
		 
		 if(aData.changeValue > 0){
           $('td:eq(5)', nRow).html('<div class="price-up"><i></i>'+aData.changeValue+'</div>');
           $('td:eq(6)', nRow).html('<div class="price-up"><i></i>'+ '<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20">'
    + '<use xlink:href="#custom-arrow-up-right"></use>'
    + '</svg>'+parseFloat(aData.ChangePrecent).toFixed(2)+'</div>');
         }
         if(aData.changeValue < 0){
            $('td:eq(5)', nRow).html('<div class="price-down"><i></i>'+aData.changeValue+'</div>');
           $('td:eq(6)', nRow).html('<div class="price-down"><i></i>'+ '<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20">'
    + '<use xlink:href="#custom-arrow-down-right"></use>'
    + '</svg>'+parseFloat(aData.ChangePrecent).toFixed(2)+'</div>');
         }
         if(aData.changeValue == 0){
            $('td:eq(5)', nRow).html('<div class="priceEqual"><i></i>'+aData.changeValue+'</div>');
           $('td:eq(6)', nRow).html('<div class="priceEqual"><i></i>'+parseFloat(aData.ChangePrecent).toFixed(2)+'</div>');
         }
	       $('td',nRow).addClass('text-center');
         return nRow;
        },
        "initComplete": function(settings, json) {
        } 
	});
 }
 
 function <portlet:namespace />populateTable2(){
 var requestLocale =$("#requestLocale").val();
		$('#marketPerformanceTable2').dataTable({
		responsive: true,
		//"sPaginationType": "combobox",
		ajax:{
			url: '<portlet:resourceURL id="getNomucMarketPerformanceDetails"></portlet:resourceURL>',
			type: 'GET',
			/* data:{
				reportFilter:reportFilterVal,
				sectorFilter:sectorFilterVal,
				timeFrameFilter:timeFrameFilterVal
			} */
			data:{
			reportFilter:$("#reportList").val(),
			sectorFilter:$("#sectorList").val(),
			timeFrameFilter:$("#periodList").val(),
			isNonAdjusted:"0",
			requestLocale:requestLocale
			},
			dataSrc:function(response){
			buildCardView(response.data);
			return response.data;
			}
		},
		
		columns: [
              {"data":"acrynomName",},
              {"data":"beginPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"highPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"lowPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"endPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"changeValue",  "num-fmt": "-99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"ChangePrecent",  "num-fmt": "-99.99%", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
               {"data":"volumeTraded",  "num-fmt": "9,999,999,999", "mRender": function (data, type, full) {
              			return parseFloat(data).formatQuantity();
              }},
              {"data":"value",  "num-fmt": "999,999,999.99", "mRender": function (data, type, full) {
              			return parseFloat(data).formatMoney();
              }}
        ],
       
        fixedHeader: true,
        paging:   false,
        scrollX: true,
        scrollCollapse: true,
        ordering: true,
         order:[],
        info:     false,
        searching: false,
         responsive: true,
          language: {
            emptyTable:  <portlet:namespace/>NO_DATA_MESSAGE,
            zeroRecords: <portlet:namespace/>NO_DATA_MESSAGE,
            infoEmpty:   <portlet:namespace/>NO_DATA_MESSAGE, 
            loadingRecords: <portlet:namespace/>LOAD_MESSAGE, 
            processing:    <portlet:namespace/>LOAD_MESSAGE
        },
         oLanguage: {
       		sLengthMenu: "_MENU_"
    	 },
    	 
    	 fnRowCallback: function( nRow, aData, iIndex ) {
    	
    	 var cUrl = aData.companyURL;
         if ( typeof(cUrl) != "undefined" && cUrl != null){
			  $('td:eq(0)', nRow).html('<a class="ellipsis" href="'+cUrl+'">'+aData.acrynomName+'</a>');
		 }else{
			$('td:eq(0)', nRow).html('<a class="ellipsis" href="#">'+aData.acrynomName+'</a>');
		 }
		 
		 if(aData.changeValue > 0){
           $('td:eq(5)', nRow).html('<div class="price-up">'+aData.changeValue+'<i></i></div>');
           $('td:eq(6)', nRow).html('<div class="price-up">'+ '<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20">'
    + '<use xlink:href="#custom-arrow-up-right"></use>'
    + '</svg>'+parseFloat(aData.ChangePrecent).toFixed(2)+'<i></i></div>');
         }
         if(aData.changeValue < 0){
            $('td:eq(5)', nRow).html('<div class="price-down">'+aData.changeValue+'<i></i></div>');
           $('td:eq(6)', nRow).html('<div class="price-down">'+ '<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20">'
    + '<use xlink:href="#custom-arrow-down-right"></use>'
    + '</svg>'+parseFloat(aData.ChangePrecent).toFixed(2)+'<i></i></div>');
         }
         if(aData.changeValue == 0){
            $('td:eq(5)', nRow).html('<div class="priceEqual">'+aData.changeValue+'<i></i></div>');
           $('td:eq(6)', nRow).html('<div class="priceEqual">'+parseFloat(aData.ChangePrecent).toFixed(2)+'<i></i></div>');
         }
	       $('td',nRow).addClass('text-center');
         return nRow;
        },
        "initComplete": function(settings, json) {
        } 
	});
 }
 
 function <portlet:namespace />populateTable3(){
 var requestLocale =$("#requestLocale").val();
		$('#marketPerformanceTable3').dataTable({
		responsive: true,
		//"sPaginationType": "combobox",
		ajax:{
			url: '<portlet:resourceURL id="getNomucMarketPerformanceLosersDetails"></portlet:resourceURL>',
			type: 'GET',
			/* data:{
				reportFilter:reportFilterVal,
				sectorFilter:sectorFilterVal,
				timeFrameFilter:timeFrameFilterVal
			} */
			data:{
			reportFilter:$("#reportList").val(),
			sectorFilter:$("#sectorList").val(),
			timeFrameFilter:$("#periodList").val(),
			isNonAdjusted:"0",
			requestLocale:requestLocale
			},
			dataSrc:function(response){
			buildCardView(response.data);
			return response.data;
			}
		},
		
		columns: [
              {"data":"acrynomName",},
              {"data":"beginPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"highPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"lowPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"endPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"changeValue",  "num-fmt": "-99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"ChangePrecent",  "num-fmt": "-99.99%", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
             {"data":"volumeTraded",  "num-fmt": "9,999,999,999", "mRender": function (data, type, full) {
              			return parseFloat(data).formatQuantity();
              }},
              {"data":"value",  "num-fmt": "999,999,999.99", "mRender": function (data, type, full) {
              			return parseFloat(data).formatMoney();
              }}
        ],
       
        fixedHeader: true,
        paging:   false,
        scrollX: true,
        scrollCollapse: true,
        ordering: true,
         order:[],
        info:     false,
        searching: false,
         responsive: true,
          language: {
            emptyTable:  <portlet:namespace/>NO_DATA_MESSAGE,
            zeroRecords: <portlet:namespace/>NO_DATA_MESSAGE,
            infoEmpty:   <portlet:namespace/>NO_DATA_MESSAGE, 
            loadingRecords: <portlet:namespace/>LOAD_MESSAGE, 
            processing:    <portlet:namespace/>LOAD_MESSAGE
        },
         oLanguage: {
       		sLengthMenu: "_MENU_"
    	 },
    	 
    	 fnRowCallback: function( nRow, aData, iIndex ) {
    	 var cUrl = aData.companyURL;
         if ( typeof(cUrl) != "undefined" && cUrl != null){
			  $('td:eq(0)', nRow).html('<a class="ellipsis" href="'+cUrl+'">'+aData.acrynomName+'</a>');
		 }else{
			$('td:eq(0)', nRow).html('<a class="ellipsis" href="#">'+aData.acrynomName+'</a>');
		 }
		 
		 if(aData.changeValue > 0){
           $('td:eq(5)', nRow).html('<div class="price-up">'+aData.changeValue+'<i></i></div>');
           $('td:eq(6)', nRow).html('<div class="price-up">'+ '<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20">'
    + '<use xlink:href="#custom-arrow-up-right"></use>'
    + '</svg>'+parseFloat(aData.ChangePrecent).toFixed(2)+'<i></i></div>');
         }
         if(aData.changeValue < 0){
            $('td:eq(5)', nRow).html('<div class="price-down">'+aData.changeValue+'<i></i></div>');
           $('td:eq(6)', nRow).html('<div class="price-down">'+ '<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20">'
    + '<use xlink:href="#custom-arrow-down-right"></use>'
    + '</svg>'+parseFloat(aData.ChangePrecent).toFixed(2)+'<i></i></div>');
         }
         if(aData.changeValue == 0){
            $('td:eq(5)', nRow).html('<div class="priceEqual">'+aData.changeValue+'<i></i></div>');
           $('td:eq(6)', nRow).html('<div class="priceEqual">'+parseFloat(aData.ChangePrecent).toFixed(2)+'<i></i></div>');
         }
	       $('td',nRow).addClass('text-center');
         return nRow;
        },
        "initComplete": function(settings, json) {
        } 
	});
 }
 
 function <portlet:namespace />populateTable4(){
  var requestLocale =$("#requestLocaleKsa").val();
		$('#marketPerformanceTable4').dataTable({
		responsive: true,
		//"sPaginationType": "combobox",
		ajax:{
			url: '<portlet:resourceURL id="getNomucMarketPerformanceDetails"></portlet:resourceURL>',
			type: 'GET',
			/* data:{
				reportFilter:reportFilterVal,
				sectorFilter:sectorFilterVal,
				timeFrameFilter:timeFrameFilterVal
			} */
			data:{
			reportFilter:$("#reportList").val(),
			sectorFilter:$("#sectorList").val(),
			timeFrameFilter:$("#periodList").val(),
			isNonAdjusted:"1",
			requestLocale:requestLocale
			},
			dataSrc:function(response){
			buildCardViewksa(response.data);
			return response.data;
			}
		},
		
		columns: [
              {"data":"acrynomName",},
              {"data":"beginPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"highPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"lowPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"endPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"changeValue",  "num-fmt": "-99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"ChangePrecent",  "num-fmt": "-99.99%", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
             {"data":"volumeTraded",  "num-fmt": "9,999,999,999", "mRender": function (data, type, full) {
              			return parseFloat(data).formatQuantity();
              }},
              {"data":"value",  "num-fmt": "999,999,999.99", "mRender": function (data, type, full) {
              			return parseFloat(data).formatMoney();
              }}
        ],
       
       fixedHeader: true,
        paging:   false,
        scrollX: true,
        scrollCollapse: true,
        ordering: true,
         order:[],
        info:     false,
        searching: false,
         responsive: true,
          language: {
            emptyTable:  <portlet:namespace/>NO_DATA_MESSAGE,
            zeroRecords: <portlet:namespace/>NO_DATA_MESSAGE,
            infoEmpty:   <portlet:namespace/>NO_DATA_MESSAGE, 
            loadingRecords: <portlet:namespace/>LOAD_MESSAGE, 
            processing:    <portlet:namespace/>LOAD_MESSAGE
        },
         oLanguage: {
       		sLengthMenu: "_MENU_"
    	 },
    	 
    	 fnRowCallback: function( nRow, aData, iIndex ) {
    	
    	 var cUrl = aData.companyURL;
         if ( typeof(cUrl) != "undefined" && cUrl != null){
			  $('td:eq(0)', nRow).html('<a class="ellipsis" href="'+cUrl+'">'+aData.acrynomName+'</a>');
		 }else{
			$('td:eq(0)', nRow).html('<a class="ellipsis" href="#">'+aData.acrynomName+'</a>');
		 }
		 
		 if(aData.changeValue > 0){
           $('td:eq(5)', nRow).html('<div class="price-up">'+aData.changeValue+'<i></i></div>');
           $('td:eq(6)', nRow).html('<div class="price-up">'+ '<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20">'
    + '<use xlink:href="#custom-arrow-up-right"></use>'
    + '</svg>'+parseFloat(aData.ChangePrecent).toFixed(2)+'<i></i></div>');
         }
         if(aData.changeValue < 0){
            $('td:eq(5)', nRow).html('<div class="price-down">'+aData.changeValue+'<i></i></div>');
           $('td:eq(6)', nRow).html('<div class="price-down">'+ '<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20">'
    + '<use xlink:href="#custom-arrow-down-right"></use>'
    + '</svg>'+parseFloat(aData.ChangePrecent).toFixed(2)+'<i></i></div>');
         }
         if(aData.changeValue == 0){
            $('td:eq(5)', nRow).html('<div class="priceEqual">'+aData.changeValue+'<i></i></div>');
           $('td:eq(6)', nRow).html('<div class="priceEqual">'+parseFloat(aData.ChangePrecent).toFixed(2)+'<i></i></div>');
         }
	       $('td',nRow).addClass('text-center');
         return nRow;
        },
        "initComplete": function(settings, json) {
        } 
	});
 }
	
	function <portlet:namespace />populateTable5(){
	 var requestLocale =$("#requestLocaleKsa").val();
		$('#marketPerformanceTable5').dataTable({
		responsive: true,
		//"sPaginationType": "combobox",
		ajax:{
			url: '<portlet:resourceURL id="getNomucMarketPerformanceDetails"></portlet:resourceURL>',
			type: 'GET',
			/* data:{
				reportFilter:reportFilterVal,
				sectorFilter:sectorFilterVal,
				timeFrameFilter:timeFrameFilterVal
			} */
			data:{
			reportFilter:$("#reportList").val(),
			sectorFilter:$("#sectorList").val(),
			timeFrameFilter:$("#periodList").val(),
			isNonAdjusted:"1",
			requestLocale:requestLocale
			},
			dataSrc:function(response){
			buildCardViewksa(response.data);
			return response.data;
			}
		},
		
		columns: [
              {"data":"acrynomName",},
              {"data":"beginPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"highPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"lowPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"endPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"changeValue",  "num-fmt": "-99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"ChangePrecent",  "num-fmt": "-99.99%", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
            {"data":"volumeTraded",  "num-fmt": "9,999,999,999", "mRender": function (data, type, full) {
              			return parseFloat(data).formatQuantity();
              }},
              {"data":"value",  "num-fmt": "999,999,999.99", "mRender": function (data, type, full) {
              			return parseFloat(data).formatMoney();
              }}
        ],
       
        fixedHeader: true,
        paging:   false,
        scrollX: true,
        scrollCollapse: true,
        ordering: true,
         order:[],
        info:     false,
        searching: false,
         responsive: true,
          language: {
            emptyTable:  <portlet:namespace/>NO_DATA_MESSAGE,
            zeroRecords: <portlet:namespace/>NO_DATA_MESSAGE,
            infoEmpty:   <portlet:namespace/>NO_DATA_MESSAGE, 
            loadingRecords: <portlet:namespace/>LOAD_MESSAGE, 
            processing:    <portlet:namespace/>LOAD_MESSAGE
        },
         oLanguage: {
       		sLengthMenu: "_MENU_"
    	 },
    	 
    	 fnRowCallback: function( nRow, aData, iIndex ) {
    	
    	 var cUrl = aData.companyURL;
         if ( typeof(cUrl) != "undefined" && cUrl != null){
			  $('td:eq(0)', nRow).html('<a class="ellipsis" href="'+cUrl+'">'+aData.acrynomName+'</a>');
		 }else{
			$('td:eq(0)', nRow).html('<a class="ellipsis" href="#">'+aData.acrynomName+'</a>');
		 }
		 
		 if(aData.changeValue > 0){
           $('td:eq(5)', nRow).html('<div class="price-up">'+aData.changeValue+'<i></i></div>');
           $('td:eq(6)', nRow).html('<div class="price-up">'+ '<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20">'
    + '<use xlink:href="#custom-arrow-up-right"></use>'
    + '</svg>'+parseFloat(aData.ChangePrecent).toFixed(2)+'<i></i></div>');
         }
         if(aData.changeValue < 0){
            $('td:eq(5)', nRow).html('<div class="price-down">'+aData.changeValue+'<i></i></div>');
           $('td:eq(6)', nRow).html('<div class="price-down">'+ '<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20">'
    + '<use xlink:href="#custom-arrow-down-right"></use>'
    + '</svg>'+parseFloat(aData.ChangePrecent).toFixed(2)+'<i></i></div>');
         }
         if(aData.changeValue == 0){
            $('td:eq(5)', nRow).html('<div class="priceEqual">'+aData.changeValue+'<i></i></div>');
           $('td:eq(6)', nRow).html('<div class="priceEqual">'+parseFloat(aData.ChangePrecent).toFixed(2)+'<i></i></div>');
         }
	       $('td',nRow).addClass('text-center');
         return nRow;
        },
        "initComplete": function(settings, json) {
        } 
	});
 }
 
 function <portlet:namespace />populateTable6(){
 var requestLocale =$("#requestLocaleKsa").val();
		$('#marketPerformanceTable6').dataTable({
		responsive: true,
		//"sPaginationType": "combobox",
		ajax:{
			url: '<portlet:resourceURL id="getNomucMarketPerformanceLosersDetails"></portlet:resourceURL>',
			type: 'GET',
			/* data:{
				reportFilter:reportFilterVal,
				sectorFilter:sectorFilterVal,
				timeFrameFilter:timeFrameFilterVal
			} */
			data:{
			reportFilter:$("#reportList").val(),
			sectorFilter:$("#sectorList").val(),
			timeFrameFilter:$("#periodList").val(),
			isNonAdjusted:"1",
			requestLocale:requestLocale
			},
			dataSrc:function(response){
			buildCardViewksa(response.data);
			return response.data;
			}
		},
		
		columns: [
              {"data":"acrynomName",},
              {"data":"beginPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"highPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"lowPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"endPrice",  "num-fmt": "99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"changeValue",  "num-fmt": "-99.99", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
              {"data":"ChangePrecent",  "num-fmt": "-99.99%", "mRender": function (data, type, full) {
             			 return parseFloat(data).formatMoney();
             			 }},
             {"data":"volumeTraded",  "num-fmt": "9,999,999,999", "mRender": function (data, type, full) {
              			return parseFloat(data).formatQuantity();
              }},
              {"data":"value",  "num-fmt": "999,999,999.99", "mRender": function (data, type, full) {
              			return parseFloat(data).formatMoney();
              }}
        ],
       
        fixedHeader: true,
        paging:   false,
        scrollX: true,
        scrollCollapse: true,
        ordering: true,
         order:[],
        info:     false,
        searching: false,
         responsive: true,
          language: {
            emptyTable:  <portlet:namespace/>NO_DATA_MESSAGE,
            zeroRecords: <portlet:namespace/>NO_DATA_MESSAGE,
            infoEmpty:   <portlet:namespace/>NO_DATA_MESSAGE, 
            loadingRecords: <portlet:namespace/>LOAD_MESSAGE, 
            processing:    <portlet:namespace/>LOAD_MESSAGE
        },
         oLanguage: {
       		sLengthMenu: "_MENU_"
    	 },
    	 
    	 fnRowCallback: function( nRow, aData, iIndex ) {
    	
    	 var cUrl = aData.companyURL;
         if ( typeof(cUrl) != "undefined" && cUrl != null){
			  $('td:eq(0)', nRow).html('<a class="ellipsis" href="'+cUrl+'">'+aData.acrynomName+'</a>');
		 }else{
			$('td:eq(0)', nRow).html('<a class="ellipsis" href="#">'+aData.acrynomName+'</a>');
		 }
		 
		 if(aData.changeValue > 0){
           $('td:eq(5)', nRow).html('<div class="price-up">'+aData.changeValue+'<i></i></div>');
           $('td:eq(6)', nRow).html('<div class="price-up">'+ '<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20">'
    + '<use xlink:href="#custom-arrow-up-right"></use>'
    + '</svg>'+parseFloat(aData.ChangePrecent).toFixed(2)+'<i></i></div>');
         }
         if(aData.changeValue < 0){
            $('td:eq(5)', nRow).html('<div class="price-down">'+aData.changeValue+'<i></i></div>');
           $('td:eq(6)', nRow).html('<div class="price-down">'+ '<svg class="pc-icon pr-3 link-icon ml-2" width="20" height="20">'
    + '<use xlink:href="#custom-arrow-down-right"></use>'
    + '</svg>'+parseFloat(aData.ChangePrecent).toFixed(2)+'<i></i></div>');
         }
         if(aData.changeValue == 0){
            $('td:eq(5)', nRow).html('<div class="priceEqual">'+aData.changeValue+'<i></i></div>');
           $('td:eq(6)', nRow).html('<div class="priceEqual">'+parseFloat(aData.ChangePrecent).toFixed(2)+'<i></i></div>');
         }
	       $('td',nRow).addClass('text-center');
         return nRow;
        },
        "initComplete": function(settings, json) {
        } 
	});
 }
 
 function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatAllNumericalValues(){
	$('table:visible').find('td').each(function() {
		var divLen = $(this).find('div').length;
		var val = $(this).text().replace(/\,/g, '');
		if (divLen < 1) {
			if (val && !isNaN(val)) {
				$(this).text(numberWithCommas(parseFloat(val).toFixed(2)));
			}
		} else {
			if (val && !isNaN(val)) {
				$(this).find('div:first').html(parseFloat(val).toFixed(2)+'<i></i>');
			}
		}
	});
}



function formatQuantityhtml(val) {
if (val === null || val === undefined || val === "") return "0";
return parseFloat(val).formatQuantity();
}


function formatMoneyhtml(val) {
    if (val === null || val === undefined || val === "") return "0.00";
    return parseFloat(val).formatMoney();
}
</script>
<%-- =========================================================================
     Market Performance Hero
     ========================================================================= --%>

<section class="hero-section surface-hero"
	aria-labelledby="market-performance-page-title">
	<div class="hero-section__background" aria-hidden="true"></div>

	<div class="container hero-section__content">
		<header class="hero-intro">
			<div class="hero-intro__header">
				<div class="hero-intro__brand">
					<span class="hero-intro__icon has-icon icon-tadawul"
						aria-hidden="true"></span>

					<h1 class="hero-intro__title"
						id="market-performance-page-title">
						<fmt:message key="marketperformance.marketPerformance" />
					</h1>
				</div>
			</div>
		</header>
	</div>
</section>


<%-- =========================================================================
     Market Performance
     ========================================================================= --%>

<section class="section market-performance"
	aria-labelledby="market-performance-page-title"
	data-market-performance>
	<div class="container">

		<%-- =====================================================================
		     Filters
		     ===================================================================== --%>

		<form class="filter-bar"
			aria-labelledby="market-performance-page-title"
			data-market-performance-filters
			novalidate>
			<div class="filter-bar__inner">
				<div class="filter-bar__fields grid-3">

					<%-- =========================================================
					     Report
					     ========================================================= --%>

					<div class="filter-bar__field">
						<label class="form-label"
							for="market-performance-report">
							<fmt:message key="marketperformance.selectReport" />
						</label>

						<div class="custom-select" data-custom-select>
							<div class="form-select-wrap custom-select__fallback">
								<select class="form-select custom-select__native"
									id="market-performance-report"
									name="<%=MarketPerformanceConstants.PARAMETER_REPORT_Filter%>"
									data-market-performance-report>
									<option
										value="<%=MarketPerformanceConstants.PARAMETER_Filter_MOST_ACTIVE_by_VOLUME%>"
										selected>
										<fmt:message key="marketperformance.filter1" />
									</option>

									<option
										value="<%=MarketPerformanceConstants.PARAMETER_Filter_GAINERS_LOSER_VALUE%>">
										<fmt:message key="marketperformance.filter3" />
									</option>

									<option
										value="<%=MarketPerformanceConstants.PARAMETER_Filter_GAINERS_LOSER_PRE%>">
										<fmt:message key="marketperformance.filter4" />
									</option>
								</select>

								<span
									class="form-select-icon has-icon icon-chevron-down"
									aria-hidden="true"></span>
							</div>
						</div>
					</div>


					<%-- =========================================================
					     Period
					     ========================================================= --%>

					<div class="filter-bar__field">
						<label class="form-label"
							for="market-performance-period">
							<fmt:message key="marketperformance.selectPeriod" />
						</label>

						<div class="custom-select" data-custom-select>
							<div class="form-select-wrap custom-select__fallback">
								<select class="form-select custom-select__native"
									id="market-performance-period"
									name="<%=MarketPerformanceConstants.PARAMETER_TIME_FRAME_Filter%>"
									data-market-performance-period>

									<option value="7 Days"
										<c:if test="${'7 Days' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											selected
										</c:if>>
										<fmt:message key="marketperformance.6days" />
									</option>

									<option value="14 Days"
										<c:if test="${'14 Days' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											selected
										</c:if>>
										<fmt:message key="marketperformance.2weeks" />
									</option>

									<option value="1 Months"
										<c:if test="${'1 Months' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											selected
										</c:if>>
										<fmt:message key="marketperformance.1month" />
									</option>

									<option value="3 Months"
										<c:if test="${'3 Months' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											selected
										</c:if>>
										<fmt:message key="marketperformance.3months" />
									</option>

									<option value="6 Months"
										<c:if test="${'6 Months' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											selected
										</c:if>>
										<fmt:message key="marketperformance.6months" />
									</option>

									<option value="9 Months"
										<c:if test="${'9 Months' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											selected
										</c:if>>
										<fmt:message key="marketperformance.9months" />
									</option>

									<option value="1 Years"
										<c:if test="${'1 Years' eq requestScope.viewMarketPerformance.previousTimeFrameFilter
											or empty requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											selected
										</c:if>>
										<fmt:message key="marketperformance.1year" />
									</option>

									<option value="2 Years"
										<c:if test="${'2 Years' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											selected
										</c:if>>
										<fmt:message key="marketperformance.2year" />
									</option>

									<option value="3 Years"
										<c:if test="${'3 Years' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											selected
										</c:if>>
										<fmt:message key="marketperformance.3year" />
									</option>

									<option value="5 Years"
										<c:if test="${'5 Years' eq requestScope.viewMarketPerformance.previousTimeFrameFilter}">
											selected
										</c:if>>
										<fmt:message key="marketperformance.5year" />
									</option>
								</select>

								<span
									class="form-select-icon has-icon icon-chevron-down"
									aria-hidden="true"></span>
							</div>
						</div>
					</div>


					<%-- =========================================================
					     Sector
					     ========================================================= --%>

					<div class="filter-bar__field">
						<label class="form-label"
							for="market-performance-sector">
							<fmt:message key="marketperformance.sector" />
						</label>

						<div class="custom-select"
							data-custom-select
							data-searchable>
							<div class="form-select-wrap custom-select__fallback">
								<select class="form-select custom-select__native"
									id="market-performance-sector"
									name="<%=MarketPerformanceConstants.PARAMETER_SECTOR_Filter%>"
									data-market-performance-sector>

									<option
										value="<%=MarketPerformanceConstants.FORM_ACTION_VIEW_ALL_MARKET%>"
										<c:if test="${empty requestScope.viewMarketPerformance.previousSectorFilter}">
											selected
										</c:if>>
										<fmt:message key="marketperformance.allMarket" />
									</option>

									<c:forEach
										items="${requestScope.viewMarketPerformance.allSectors}"
										var="sector">
										<option
											value="<c:out value='${sector.pk_rf_sector}' />"
											<c:if test="${requestScope.viewMarketPerformance.previousSectorFilter eq sector.pk_rf_sector}">
												selected
											</c:if>>
											<c:out value="${sector.name}" />
										</option>
									</c:forEach>
								</select>

								<span
									class="form-select-icon has-icon icon-chevron-down"
									aria-hidden="true"></span>
							</div>
						</div>
					</div>

				</div>
			</div>
		</form>


		<%-- =====================================================================
		     Adjusted / Non-Adjusted Tabs
		     ===================================================================== --%>

		<div class="tabs market-performance__tabs"
			data-tabs
			data-market-performance-tabs>

			<%-- =================================================================
			     Tab Navigation
			     ================================================================= --%>

			<div class="tabs-nav"
				role="tablist"
				aria-labelledby="market-performance-page-title">

				<button class="tab-link active"
					type="button"
					id="market-performance-tab-adjusted"
					role="tab"
					aria-selected="true"
					aria-controls="market-performance-panel-adjusted"
					data-tab-target="market-performance-panel-adjusted"
					data-market-performance-mode="adjusted">
					<fmt:message key="marketperformance.Adjusted.tabtext" />
				</button>

				<button class="tab-link"
					type="button"
					id="market-performance-tab-non-adjusted"
					role="tab"
					aria-selected="false"
					aria-controls="market-performance-panel-non-adjusted"
					data-tab-target="market-performance-panel-non-adjusted"
					data-market-performance-mode="non-adjusted">
					<fmt:message key="marketperformance.NonAdjusted" />
				</button>

			</div>


			<%-- =================================================================
			     Tab Content
			     ================================================================= --%>

			<div class="tabs-content">

				<%-- =============================================================
				     Adjusted
				     ============================================================= --%>

				<section class="tab-pane active"
					id="market-performance-panel-adjusted"
					role="tabpanel"
					aria-labelledby="market-performance-tab-adjusted">

					<div data-market-performance-feature="adjusted">

						<section class="data-view data-view--connected"
							aria-labelledby="market-performance-tab-adjusted"
							aria-busy="false"
							data-market-performance-view>

							<div class="data-view__workspace">

								<%-- =================================================
								     Desktop / Tablet Results
								     ================================================= --%>

								<div class="data-view__table">
									<div class="data-view__table-block">

										<div class="data-view__toolbar">
											<div class="data-view__toolbar-start">
												<p class="data-view__result-count"
													aria-live="polite">
													<span data-market-performance-result-count
														data-result-count-value>
														0
													</span>
												</p>
											</div>
										</div>

										<p class="visually-hidden"
											role="status"
											aria-live="polite"
											aria-atomic="true"
											data-market-performance-status></p>

										<div class="table-shell"
											data-table-shell>

											<div class="table-responsive custom-scrollbar"
												role="region"
												aria-labelledby="market-performance-tab-adjusted"
												tabindex="0">

												<table class="table"
													data-market-performance-table>
													<thead>
														<tr>
															<th scope="col">
																<fmt:message key="marketperformance.company" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.beginprice" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.high" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.low" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.endprice" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.change" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.changePer" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.totalvolume" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.value" />

																<span class="sar-symbol"
																	aria-hidden="true">
																	<svg class="pc-icon"
																		width="15"
																		height="15">
																		<use xlink:href="#custom-riyal-icon"></use>
																	</svg>
																</span>
															</th>
														</tr>
													</thead>

													<tbody>
														<%-- JavaScript owns all rows and result states. --%>
													</tbody>
												</table>

											</div>
										</div>
									</div>
								</div>


								<%-- =================================================
								     Mobile Cards
								     ================================================= --%>

								<div class="data-view__cards"
									data-market-performance-mobile>

									<div class="data-card-list"
										data-market-performance-cards>
										<%-- JavaScript owns all cards and result states. --%>
									</div>

								</div>

							</div>
						</section>

					</div>
				</section>


				<%-- =============================================================
				     Non-Adjusted
				     ============================================================= --%>

				<section class="tab-pane"
					id="market-performance-panel-non-adjusted"
					role="tabpanel"
					aria-labelledby="market-performance-tab-non-adjusted">

					<div data-market-performance-feature="non-adjusted">

						<section class="data-view data-view--connected"
							aria-labelledby="market-performance-tab-non-adjusted"
							aria-busy="false"
							data-market-performance-view>

							<div class="data-view__workspace">

								<%-- =================================================
								     Desktop / Tablet Results
								     ================================================= --%>

								<div class="data-view__table">
									<div class="data-view__table-block">

										<div class="data-view__toolbar">
											<div class="data-view__toolbar-start">
												<p class="data-view__result-count"
													aria-live="polite">
													<span data-market-performance-result-count
														data-result-count-value>
														0
													</span>
												</p>
											</div>
										</div>

										<p class="visually-hidden"
											role="status"
											aria-live="polite"
											aria-atomic="true"
											data-market-performance-status></p>

										<div class="table-shell"
											data-table-shell>

											<div class="table-responsive custom-scrollbar"
												role="region"
												aria-labelledby="market-performance-tab-non-adjusted"
												tabindex="0">

												<table class="table"
													data-market-performance-table>
													<thead>
														<tr>
															<th scope="col">
																<fmt:message key="marketperformance.company" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.beginprice" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.high" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.low" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.endprice" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.change" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.changePer" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.totalvolume" />
															</th>

															<th class="text-end" scope="col">
																<fmt:message key="marketperformance.value" />

																<span class="sar-symbol"
																	aria-hidden="true">
																	<svg class="pc-icon"
																		width="15"
																		height="15">
																		<use xlink:href="#custom-riyal-icon"></use>
																	</svg>
																</span>
															</th>
														</tr>
													</thead>

													<tbody>
														<%-- JavaScript owns all rows and result states. --%>
													</tbody>
												</table>

											</div>
										</div>
									</div>
								</div>


								<%-- =================================================
								     Mobile Cards
								     ================================================= --%>

								<div class="data-view__cards"
									data-market-performance-mobile>

									<div class="data-card-list"
										data-market-performance-cards>
										<%-- JavaScript owns all cards and result states. --%>
									</div>

								</div>

							</div>
						</section>

					</div>
				</section>

			</div>
		</div>

	</div>
</section>
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


<header class="header app-container">

	<div class="header__wrapper ">

		<!-- Reading Logo from WCM Dynamically - START -->

		<c:if test="${fn:contains(pageContext.request.locale.language,'en')}">
			<wcm:initworkspace></wcm:initworkspace>
			<%
				Workspace workspace = (Workspace) pageContext.getAttribute(Workspace.WCM_ERROR_KEY);
					RenderingContext renderingContext = (RenderingContext) request
							.getAttribute(Workspace.WCM_RENDERINGCONTEXT_KEY);
			%>

			<wcm:setExplicitContext
				path="tadawulv2_en/sa-tadawul/sa-home/sa-logo/logo"></wcm:setExplicitContext>
			<wcm:content pageDesign="TadawulV2_Design/LOGO/LOGO-PT_v3"></wcm:content>
		</c:if>
		<c:if test="${fn:contains(pageContext.request.locale.language,'ar')}">
			<wcm:initworkspace></wcm:initworkspace>
			<%
				Workspace workspace = (Workspace) pageContext.getAttribute(Workspace.WCM_ERROR_KEY);
					RenderingContext renderingContext = (RenderingContext) request
							.getAttribute(Workspace.WCM_RENDERINGCONTEXT_KEY);
			%>

			<wcm:setExplicitContext
				path="tadawulv2_ar/sa-tadawul/sa-home/sa-logo/logo"></wcm:setExplicitContext>
			<wcm:content pageDesign="TadawulV2_Design/LOGO/LOGO-PT_v3"></wcm:content>
		</c:if>

		<nav class="header__navigation-wrapper" aria-label="Main Navigation">


			<ul class="header__list">

				<c:set var="root" value="${wp.selectionModel.selectionPath[1]}" />
				<c:forEach items="${wp.navigationModel.children[root]}" var="node"
					varStatus="status">
					<c:set var="careerLinkPrinted" value="false" scope="page" />
					<c:set var="curLevel" value="${(status.count-1)}" />
					<c:set var="hidePageFromNavL1"
						value="${node.metadata['navVisibility']}" />
					<c:if
						test="${(hidePageFromNavL1 != 'hide') && (node.objectID.uniqueName != 'com.tadawul.home') && (node.objectID.uniqueName != 'com.tadawul.hiddenpage') && (node.objectID.uniqueName != 'com.tadawul.home.v3') && (node.objectID.uniqueName != 'com.tadawul.footer.v3')}">
						<li class="header__list-item has-submenu ps-2 pe-2">
							<!-- Menu-Level-1 --> <a href="javascript:void(0)"
							style="text-decoration: none;"> <span><c:out
										value="${node.title}" /></span> <svg
									class="pc-icon pr-3 link-icon ml-2" width="12" height="12">
			                  <use xlink:href="#custom-arrow-down-2"></use>
			                </svg>

						</a>


							<div class="submenu-wrapper">
								<div class="submenu-list__wrapper">

									<!-- Menu-Level-2 -->
									<ul class="submenu-list">
										<c:forEach items="${wp.navigationModel.children[node]}"
											var="nodeL2" varStatus="status">
											<c:set var="hidePageFromNavL2"
												value="${nodeL2.metadata['navVisibility']}" />
											<c:set var="isIssuerNewsPageL2"
												value="${nodeL2.metadata['isIssuerNewsPage']}" />
											<c:if test='${hidePageFromNavL2 != "hide"}'>
												<!-- line 184 -->
												<li class="submenu-list__item has-submenu"><c:choose>
														<c:when test="${isIssuerNewsPageL2 == 'yes' }">


															<div class="submenu-list__item-wrapper">
																<div class="submenu-list__item-icon">
																	<svg class="pc-icon pr-3 link-icon ml-2" width="18"
																		height="18">
					                            <use xlink:href="#tadawul-arrow-icon"></use>
					                          </svg>
																</div>
																<c:choose>
																	<c:when
																		test="${node.objectID.uniqueName == 'com.tadawul.newsandreports.v3_update' }">
																		<portal-navigation:urlGeneration
																			contentNode="${wp.identification[nodeL2]}"
																			keepNavigationalState="false">
																			<a
																				href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
																				class="submenu-list__item-link"
																				style="text-decoration: none;"> <span
																				class="submenu-list__item-title">${nodeL2.title}</span>
																			</a>
																		</portal-navigation:urlGeneration>
																	</c:when>

																	<c:otherwise>
																		<portal-navigation:urlGeneration
																			contentNode="${wp.identification[nodeL2]}"
																			keepNavigationalState="false">
																			<a
																				href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
																				class="submenu-list__item-link"
																				style="text-decoration: none;"> <span
																				class="submenu-list__item-title">${nodeL2.title}</span>
																			</a>
																		</portal-navigation:urlGeneration>
																	</c:otherwise>
																</c:choose>
																<!-- line 204 -->
																<c:if test="${wp.navigationModel.hasChildren[nodeL2]}">
																	<svg class="pc-icon pr-3 link-icon ml-2" width="18"
																		height="18">
								                 <c:if
																			test="${fn:contains(pageContext.request.locale.language,'ar')}">
								                 <use xlink:href="#custom-arrow-left"></use>
								                 </c:if>
								                 <c:if
																			test="${fn:contains(pageContext.request.locale.language,'en')}">
						                          <use xlink:href="#custom-arrow-right"></use>
						                          </c:if>
						                        </svg>
																</c:if>
															</div>

															<c:if test="${wp.navigationModel.hasChildren[nodeL2]}">
																<!-- line 222 -->
																<div class="submenu-content">
																	<ul
																		class="submenu-content__list submenu-content__list--split">
																		<!-- line 224 -->
																		<c:forEach
																			items="${wp.navigationModel.children[nodeL2]}"
																			var="nodeL3">
																			<c:set var="hidePageFromNavL3"
																				value="${nodeL3.metadata['navVisibility']}" />
																			<c:if test="${hidePageFromNavL3 != 'hide'}">
																				<!-- line 228 -->
																				<li
																					class="submenu-content__list-item submenu-content__list-item--menu">

																					<c:choose>
																						<c:when
																							test="${wp.navigationModel.hasChildren[nodeL3]}">

																							<!-- check if nodeL3 has any visible L4 -->
																							<c:set var="hasVisibleL4" value="false" />
																							<c:forEach
																								items="${wp.navigationModel.children[nodeL3]}"
																								var="nodeL4">
																								<c:set var="hidePageFromNavL4"
																									value="${nodeL4.metadata['navVisibility']}" />
																								<c:if test="${hidePageFromNavL4 != 'hide'}">
																									<c:set var="hasVisibleL4" value="true" />
																								</c:if>
																							</c:forEach>

																							<div class="sub-sub-menu-container">
																								<!-- line 244 -->
																								<portal-navigation:urlGeneration
																									contentNode="${wp.identification[nodeL3]}"
																									keepNavigationalState="false">
																									<a
																										href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
																										class="submenu-content__menu-link ${hasVisibleL4 ? 'has-sub-sub-menu' : ''}"
																										style="text-decoration: none;">
																										${nodeL3.title} <c:if test="${hasVisibleL4}">
																											<svg class="pc-icon pr-3 link-icon ml-2"
																												width="12" height="12">
											                        <c:if
																													test="${fn:contains(pageContext.request.locale.language,'ar')}">
													                  <use xlink:href="#icon-mini-arrow-left"></use>
													                 </c:if>
													                 <c:if
																													test="${fn:contains(pageContext.request.locale.language,'en')}">
											                           <use
																														xlink:href="#icon-mini-arrow-right"></use>
											                          </c:if>
											                          
											                        </svg>
																										</c:if>
																									</a>
																								</portal-navigation:urlGeneration>

																								<c:if test="${hasVisibleL4}">
																									<ul class="sub-sub-menu">
																										<!-- line 248 -->
																										<c:forEach
																											items="${wp.navigationModel.children[nodeL3]}"
																											var="nodeL4">
																											<c:set var="hidePageFromNavL4"
																												value="${nodeL4.metadata['navVisibility']}" />
																											<c:if test="${hidePageFromNavL4 != 'hide'}">
																												<div class="sub-sub-menu-wrapper">
																													<!-- line 252 -->
																													<li><portal-navigation:urlGeneration
																															contentNode="${wp.identification[nodeL4]}"
																															keepNavigationalState="false">
																															<a
																																href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
																																class="sub-sub-menu-link"
																																style="text-decoration: none;">
																																${nodeL4.title} </a>
																														</portal-navigation:urlGeneration></li>
																												</div>
																											</c:if>
																										</c:forEach>
																									</ul>
																								</c:if>
																							</div>
																						</c:when>

																						<c:otherwise>
																							<c:choose>
																								<c:when
																									test="${node.objectID.uniqueName == 'com.tadawul.newsandreports.v3_update'}">
																									<portal-navigation:urlGeneration
																										contentNode="${wp.identification[nodeL3]}"
																										keepNavigationalState="false">
																										<a
																											href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
																											class="submenu-content__menu-link"
																											style="text-decoration: none;">
																											${nodeL3.title} </a>
																									</portal-navigation:urlGeneration>
																								</c:when>

																								<c:otherwise>
																									<portal-navigation:urlGeneration
																										contentNode="${wp.identification[nodeL3]}"
																										keepNavigationalState="false">
																										<a
																											href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
																											class="submenu-content__menu-link"
																											style="text-decoration: none;">
																											${nodeL3.title} </a>
																									</portal-navigation:urlGeneration>
																								</c:otherwise>
																							</c:choose>
																						</c:otherwise>
																					</c:choose>
																				</li>
																			</c:if>
																		</c:forEach>


																		<c:if
																			test="${ node.objectID.uniqueName == 'com.tadawul.newsandreports.v3_update'}">

																			<li
																				class="submenu-content__list-item submenu-content__list-item--featured">
																				<!-- TODO Enable for Image Later --> <!-- <div class="submenu-feature-box">
																				<wcm:setExplicitContext path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/market news"></wcm:setExplicitContext>
																				<wcm:content pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
																			</div> -->
																			</li>
																		</c:if>



																	</ul>
																</div>
															</c:if>

														</c:when>
														<c:otherwise>

															<div class="submenu-list__item-wrapper">
																<div class="submenu-list__item-icon">
																	<svg class="pc-icon pr-3 link-icon ml-2" width="18"
																		height="18">
					                            <use xlink:href="#tadawul-arrow-icon"></use>
					                          </svg>
																</div>
																<portal-navigation:urlGeneration
																	contentNode="${wp.identification[nodeL2]}"
																	keepNavigationalState="false">
																	<a
																		href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
																		class="submenu-list__item-link"
																		style="text-decoration: none;"> <span
																		class="submenu-list__item-title">${nodeL2.title}</span>
																	</a>
																	<!-- line 330 -->
																	<c:if test="${wp.navigationModel.hasChildren[nodeL2]}">
																		<svg class="pc-icon pr-3 link-icon ml-2" width="18"
																			height="18">
							                          <c:if
																				test="${fn:contains(pageContext.request.locale.language,'ar')}">
										                 <use xlink:href="#custom-arrow-left"></use>
										              </c:if>
										              <c:if
																				test="${fn:contains(pageContext.request.locale.language,'en')}">
								                          <use xlink:href="#custom-arrow-right"></use>
								                      </c:if>
							                        </svg>
																	</c:if>
																</portal-navigation:urlGeneration>
															</div>

															<c:if test="${wp.navigationModel.hasChildren[nodeL2]}">
																<div class="submenu-content">
																	<ul
																		class="submenu-content__list submenu-content__list--split">

																		<!-- Only add wrapper <li> if NOT guidance CMO v2 -->
																		<c:if
																			test="${nodeL2.objectID.uniqueName != 'com.tadawul.rules.and.guidance.cmo.v3'}">
																			<li
																				class="submenu-content__list-item submenu-content__list-item--menu">
																				<!-- line 325 -->
																		</c:if>

																		<c:set var="linkCounter" value="0" scope="page" />
																		<c:set var="rowStarted" value="false" scope="page" />

																		<c:forEach
																			items="${wp.navigationModel.children[nodeL2]}"
																			var="nodeL3">
																			<c:set var="hidePageFromNavL3"
																				value="${nodeL3.metadata['navVisibility']}" />
																			<c:if test="${hidePageFromNavL3 != 'hide'}">
																				<c:choose>


																					<c:when
																						test="${wp.navigationModel.hasChildren[nodeL3]}">
																						<div class="sub-sub-menu-container">
																							<!-- line 342 -->
																							<c:set var="hasVisibleL4" value="false"
																								scope="page" />
																							<c:forEach
																								items="${wp.navigationModel.children[nodeL3]}"
																								var="nodeL4">
																								<c:set var="hidePageFromNavL4"
																									value="${nodeL4.metadata['navVisibility']}" />
																								<c:if test="${hidePageFromNavL4 != 'hide'}">
																									<c:set var="hasVisibleL4" value="true"
																										scope="page" />
																								</c:if>
																							</c:forEach>
																							<portal-navigation:urlGeneration
																								contentNode="${wp.identification[nodeL3]}"
																								keepNavigationalState="false">
																								<a
																									href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
																									class="submenu-content__menu-link ${hasVisibleL4 ? 'has-sub-sub-menu' : ''}"
																									style="text-decoration: none;">
																									${nodeL3.title} <c:if test="${hasVisibleL4}">
																										<svg class="pc-icon pr-3 link-icon ml-2"
																											width="12" height="12">
								                
								                
								                					<c:if
																												test="${fn:contains(pageContext.request.locale.language,'ar')}">
													                  <use xlink:href="#icon-mini-arrow-left"></use>
													                 </c:if>
													                 <c:if
																												test="${fn:contains(pageContext.request.locale.language,'en')}">
											                           <use
																													xlink:href="#icon-mini-arrow-right"></use>
											                          </c:if>
								                
								            </svg>
																									</c:if>
																								</a>
																							</portal-navigation:urlGeneration>
																							<c:if test="${hasVisibleL4}">
																								<div class="sub-sub-menu-wrapper">
																									<ul class="sub-sub-menu">
																										<c:forEach
																											items="${wp.navigationModel.children[nodeL3]}"
																											var="nodeL4">
																											<c:set var="hidePageFromNavL4"
																												value="${nodeL4.metadata['navVisibility']}" />
																											<c:if test="${hidePageFromNavL4 != 'hide'}">

																												<li><portal-navigation:urlGeneration
																														contentNode="${wp.identification[nodeL4]}"
																														keepNavigationalState="false">
																														<a
																															href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
																															class="sub-sub-menu-link"
																															style="text-decoration: none;">
																															${nodeL4.title} </a>
																													</portal-navigation:urlGeneration></li>
																											</c:if>
																										</c:forEach>
																									</ul>
																								</div>
																							</c:if>
																						</div>
																					</c:when>


																					<c:otherwise>


																						<c:if
																							test="${nodeL2.objectID.uniqueName == 'com.tadawul.rules.and.guidance.cmo.v3'}">
																							<c:choose>
																								<c:when test="${linkCounter == 0}">

																									<li>
																								</c:when>
																								<c:when test="${linkCounter == 5}"></li>

												<li></c:when> </c:choose> <portal-navigation:urlGeneration
														contentNode="${wp.identification[nodeL3]}"
														keepNavigationalState="false">
														<a
															href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
															class="submenu-content__menu-link"
															style="text-decoration: none;"> ${nodeL3.title} </a>
													</portal-navigation:urlGeneration> <c:if test="${linkCounter == 9}"></li>
												<c:set var="linkCounter" value="-1" />
											</c:if>

											<c:set var="linkCounter" value="${linkCounter + 1}" />
					</c:if>


					<c:if
						test="${nodeL2.objectID.uniqueName != 'com.tadawul.rules.and.guidance.cmo.v3'}">
						<portal-navigation:urlGeneration
							contentNode="${wp.identification[nodeL3]}"
							keepNavigationalState="false">
							<a
								href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
								class="submenu-content__menu-link"
								style="text-decoration: none;"> ${nodeL3.title} </a>
						</portal-navigation:urlGeneration>
					</c:if>

					</c:otherwise>
					</c:choose>
					</c:if>
				</c:forEach>











				<%-- Career link logic --%>
				<c:if
					test="${!careerLinkPrinted and (nodeL2.objectID.uniqueName == 'com.tadawul.about.exchange.aboutus.v3')}">
					<c:choose>
						<c:when test="${pageContext.request.locale.language == 'ar'}">
							<a href="https://careers.tadawulgroup.sa/?lang=ar"
								target="_blank" style="text-decoration: none;"
								class="submenu-content__menu-link"> <fmt:message
									key="theme.subMenue.career"></fmt:message>
							</a>
						</c:when>
						<c:otherwise>
							<a href="https://careers.tadawulgroup.sa/?lang=en"
								target="_blank" style="text-decoration: none;"
								class="submenu-content__menu-link"> <fmt:message
									key="theme.subMenue.career"></fmt:message>
							</a>
						</c:otherwise>
					</c:choose>
					<c:set var="careerLinkPrinted" value="true" scope="page" />
				</c:if>
				</li>

				<li
					class="submenu-content__list-item submenu-content__list-item--featured">
					<div class="submenu-feature-box">
						<!-- TODO Enable for Image Later -->
						<!-- 
                 
							<c:if test="${ node.objectID.uniqueName == 'com.tadawul.saudiexchange.ourmarkets.v3'}">
							
                            
                              
                               <wcm:setExplicitContext path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Our market"></wcm:setExplicitContext>
           					   <wcm:content pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
                              
							  </c:if>
							  
							  
							  <c:if test="${ node.objectID.uniqueName == 'com.tadawul.listing.v3_update'}">
							
                              <wcm:setExplicitContext path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Listing"></wcm:setExplicitContext>
            				  <wcm:content pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
							  </c:if>
							  
							  <c:if test="${ node.objectID.uniqueName == 'com.tadawul.trading.v3_update'}">
							
                              <wcm:setExplicitContext path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Trading"></wcm:setExplicitContext>
            				  <wcm:content pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
							  </c:if>
							  
							  <c:if test="${ node.objectID.uniqueName == 'com.tadawul.newsandreports.v3_update'}">
							
                              <wcm:setExplicitContext path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/market news"></wcm:setExplicitContext>
            				  <wcm:content pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
							  </c:if>
							  
							  <c:if test="${ node.objectID.uniqueName == 'com.tadawul.v3.rules.and.guidance'}">
							
                              <wcm:setExplicitContext path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Rules and Guidance"></wcm:setExplicitContext>
            				  <wcm:content pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
							  </c:if>
							  
							  <c:if test="${ node.objectID.uniqueName == 'com.tadawul.aboutsaudiexchange.v3_update'}">
							
                              <wcm:setExplicitContext path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/About Saudi Exchange"></wcm:setExplicitContext>
            				  <wcm:content pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
							  </c:if>
							  
							   -->

					</div>

				</li>

			</ul>
	</div>
	</c:if>
	</c:otherwise>
	</c:choose>
	</li>
	</c:if>

	</c:forEach>
	</ul>
	</div>
	</div>
	</li>
	</c:if>
	</c:forEach>
	</ul>
	</nav>





	<!-- Actions -->
	<div class="header__actions">
		<!-- Desktop actions (visible ≥ lg) -->
		<div class="d-none d-lg-flex align-items-center gap-3">
			<!-- Language (desktop) -->
			<c:if test="${fn:contains(pageContext.request.locale.language,'en')}">
				<div class="lang-toggle-wrapper" id="lang-toggle" data-lang="en">
					<span class="lang-toggle-label lang-toggle-label--en">EN</span> <a
						href='<portal-navigation:url command="ChangeLanguage"><portal-navigation:urlParam name="locale" value="${localeSwitch}"/></portal-navigation:url>'>
						<button class="lang-toggle-switch" aria-label="Toggle language">
							<svg class="icon lang-toggle__icon" height="24" width="24">
		                <use xlink:href="#custom-globe"></use>
		              </svg>
						</button>
					</a> <span class="lang-toggle-label lang-toggle-label--ar"><fmt:message
							key="theme.header.lang.arabic" /></span>
				</div>
			</c:if>

			<c:if test="${fn:contains(pageContext.request.locale.language,'ar')}">
				<div class="lang-toggle-wrapper" id="lang-toggle" data-lang="en">
					<span class="lang-toggle-label lang-toggle-label--ar"><fmt:message
							key="theme.header.lang.arabic" /></span> <a
						href='<portal-navigation:url command="ChangeLanguage"><portal-navigation:urlParam name="locale" value="${localeSwitch}"/></portal-navigation:url>'>
						<button class="lang-toggle-switch" aria-label="Toggle language">
							<svg class="icon lang-toggle__icon" height="24" width="24">
		                <use xlink:href="#custom-globe"></use>
		              </svg>
						</button>
					</a> <span class="lang-toggle-label lang-toggle-label--en">EN</span>

				</div>
			</c:if>

			<!-- Theme (desktop) -->
			<button class="theme-toggle" type="button" data-theme-toggle
				aria-label="Toggle light and dark mode">
				<svg class="icon theme-toggle__icon theme-toggle__icon--light"
					height="28" width="28">
        <use xlink:href="#custom-light"></use>
      </svg>
				<svg class="icon theme-toggle__icon theme-toggle__icon--dark"
					height="28" width="28">
        <use xlink:href="#custom-dark"></use>
      </svg>
			</button>
		</div>

		<!-- Mobile burger (visible < lg) -->
		<div class="d-lg-none">
			<button class="header__burger" type="button" aria-label="Open menu"
				aria-expanded="false" aria-controls="mobile-drawer"
				data-drawer="open" data-drawer-target="mobile-drawer">
				<span class="burger-line"></span> <span class="burger-line"></span>
				<span class="burger-line"></span>
			</button>
		</div>

		<!-- Overlay -->
		<div class="drawer__overlay" tabindex="-1" aria-hidden="true"
			data-drawer="overlay"></div>

		<!-- Mobile Drawer -->
		<aside class="drawer header__drawer" id="mobile-drawer" role="dialog"
			aria-modal="true" aria-hidden="true" data-drawer="panel">
			<div class="drawer__content">
				<!-- ===================== -->
				<!-- LEVEL 1 ROOT PANEL   -->
				<!-- ===================== -->
				<nav class="drawer__panel drawer__panel--active"
					id="drawer__menu--level-1" aria-hidden="false">
					<!-- Header -->
					<div class="drawer__panel-header drawer__panel-header--main">
						<span class="drawer__logo-link" aria-label="Homepage"> <img
							src="<r:url uri='${themeWebDAVBaseURI}assets/images/favicon.png' keepNavigationalState='false' lateBinding='false' protected='false'/>"
							alt="Site Logo" class="drawer__logo-mobile" />
						</span>

						<button class="drawer__close-button drawer__close-button--header"
							type="button" aria-label="Close menu" data-drawer="close"
							data-drawer-target="mobile-drawer">
							<svg class="drawer__close-icon" viewBox="0 0 24 24" fill="none"
								aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor"
									stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
						</button>
					</div>

					<%-- Quick Actions (Theme + Language) --%>
					<div class="drawer__actions" role="group"
						aria-label="Quick settings">
						<%-- Theme toggle (keep original logic) --%>
						<button class="theme-toggle chip" type="button"
							data-theme-toggle="" aria-label="Toggle light and dark mode"
							aria-pressed="true">
							<svg
								class="icon theme-toggle__icon theme-toggle__icon--light is-hidden"
								height="22" width="22" aria-hidden="true">
            <use xlink:href="#custom-light"></use>
          </svg>
							<svg
								class="icon theme-toggle__icon theme-toggle__icon--dark is-active"
								height="22" width="22" aria-hidden="true">
            <use xlink:href="#custom-dark"></use>
          </svg>
						</button>

						<%-- Language toggle (keep exact EN/AR logic) --%>
						<c:if
							test="${fn:contains(pageContext.request.locale.language,'en')}">
							<div class="lang-toggle-wrapper chip" data-lang="en">
								<span class="lang-toggle-label lang-toggle-label--en is-active">EN</span>
								<a
									href='<portal-navigation:url command="ChangeLanguage"><portal-navigation:urlParam name="locale" value="${localeSwitch}"/></portal-navigation:url>'>
									<button class="lang-toggle-switch" type="button"
										data-lang-toggle="" aria-label="Switch to Arabic">
										<svg class="icon lang-toggle__icon" height="18" width="18"
											aria-hidden="true">
                  <use xlink:href="#custom-globe"></use>
                </svg>
									</button>
								</a> <span class="lang-toggle-label lang-toggle-label--ar"> <fmt:message
										key="theme.header.lang.arabic" />
								</span>
							</div>
						</c:if>

						<c:if
							test="${fn:contains(pageContext.request.locale.language,'ar')}">
							<div class="lang-toggle-wrapper chip" data-lang="ar" role="group"
								aria-label="Toggle language">
								<span class="lang-toggle-label lang-toggle-label--ar is-active">
									<fmt:message key="theme.header.lang.arabic" />
								</span> <a
									href='<portal-navigation:url command="ChangeLanguage"><portal-navigation:urlParam name="locale" value="${localeSwitch}"/></portal-navigation:url>'>
									<button class="lang-toggle-switch" type="button"
										data-lang-toggle aria-label="Switch to English">
										<svg class="icon lang-toggle__icon" height="18" width="18"
											aria-hidden="true">
                  <use xlink:href="#custom-globe"></use>
                </svg>
									</button>
								</a> <span class="lang-toggle-label lang-toggle-label--en">EN</span>
							</div>
						</c:if>
					</div>

					<%-- Level-1 menu items (with hiding rules) --%>
					<ul class="drawer__menu" role="menu">
						<c:set var="root" value="${wp.selectionModel.selectionPath[1]}" />

						<c:forEach items="${wp.navigationModel.children[root]}"
							var="nodeL1">
							<c:set var="hidePageFromNavL1"
								value="${nodeL1.metadata['navVisibility']}" />

							<c:if
								test="${(hidePageFromNavL1 != 'hide')
                       && (nodeL1.objectID.uniqueName != 'com.tadawul.home')
                       && (nodeL1.objectID.uniqueName != 'com.tadawul.hiddenpage')
                       && (nodeL1.objectID.uniqueName != 'com.tadawul.saudiexchange.home.v3')
                       && (nodeL1.objectID.uniqueName != 'com.tadawul.footer.v3')}">

								<%-- Sanitize ID for DOM / CSS selector safety --%>
								<c:set var="safeL1" value="${nodeL1.objectID.uniqueName}" />
								<c:set var="safeL1" value="${fn:replace(safeL1, '.', '-')}" />
								<c:set var="safeL1" value="${fn:replace(safeL1, ':', '-')}" />
								<c:set var="safeL1" value="${fn:replace(safeL1, '/', '-')}" />
								<c:set var="safeL1" value="${fn:replace(safeL1, ' ', '-')}" />

								<li class="drawer__menu-item" role="none"><c:choose>
										<c:when test="${wp.navigationModel.hasChildren[nodeL1]}">
											<button class="drawer__submenu-toggle" type="button"
												role="menuitem" aria-expanded="false"
												aria-controls="drawer__menu--${safeL1}"
												data-target="drawer__menu--${safeL1}">
												${nodeL1.title}
												<svg class="drawer__arrow-icon" viewBox="0 0 8 14"
													fill="none" aria-hidden="true">
                      <path d="M1 13L7 7L1 1" stroke="currentColor"
														stroke-width="2" stroke-linecap="round"
														stroke-linejoin="round" />
                    </svg>
											</button>
										</c:when>

										<c:otherwise>
											<portal-navigation:urlGeneration
												contentNode="${wp.identification[nodeL1]}"
												keepNavigationalState="false">
												<a role="menuitem"
													href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
													data-unique-name="${nodeL1.objectID.uniqueName}">
													${nodeL1.title} </a>
											</portal-navigation:urlGeneration>
										</c:otherwise>
									</c:choose></li>
							</c:if>
						</c:forEach>
					</ul>
				</nav>

				<!-- ==================== -->
				<!-- LEVELS 2 – 4 PANELS -->
				<!-- ==================== -->

				<c:set var="root" value="${wp.selectionModel.selectionPath[1]}" />

				<c:forEach items="${wp.navigationModel.children[root]}" var="nodeL1">
					<c:if test="${wp.navigationModel.hasChildren[nodeL1]}">

						<%-- sanitize L1 id again for panels --%>
						<c:set var="safeL1" value="${nodeL1.objectID.uniqueName}" />
						<c:set var="safeL1" value="${fn:replace(safeL1, '.', '-')}" />
						<c:set var="safeL1" value="${fn:replace(safeL1, ':', '-')}" />
						<c:set var="safeL1" value="${fn:replace(safeL1, '/', '-')}" />
						<c:set var="safeL1" value="${fn:replace(safeL1, ' ', '-')}" />

						<!-- ================= -->
						<!-- LEVEL 2 PANEL     -->
						<!-- ================= -->
						<section id="drawer__menu--${safeL1}" class="drawer__panel"
							aria-hidden="true">
							<div class="drawer__panel-header drawer__panel-header--with-back">
								<button class="drawer__back-button" type="button"
									aria-label="Back to Main Menu"
									data-back-to="drawer__menu--level-1">
									<svg class="drawer__back-icon" viewBox="0 0 8 14" fill="none"
										aria-hidden="true">
                <path d="M7 13L1 7L7 1" stroke="currentColor"
											stroke-width="2" stroke-linecap="round"
											stroke-linejoin="round" />
              </svg>
									<fmt:message key="theme.back" />
								</button>

								<span class="drawer__panel-title">${nodeL1.title}</span>
							</div>

							<%-- Repeat Quick Actions (theme + language) --%>
							<div class="drawer__actions" role="group"
								aria-label="Quick settings">
								<button class="theme-toggle chip" type="button"
									data-theme-toggle="" aria-label="Toggle light and dark mode"
									aria-pressed="true">
									<svg
										class="icon theme-toggle__icon theme-toggle__icon--light is-hidden"
										height="22" width="22" aria-hidden="true">
                <use xlink:href="#custom-light"></use>
              </svg>
									<svg
										class="icon theme-toggle__icon theme-toggle__icon--dark is-active"
										height="22" width="22" aria-hidden="true">
                <use xlink:href="#custom-dark"></use>
              </svg>
								</button>

								<c:if
									test="${fn:contains(pageContext.request.locale.language,'en')}">
									<div class="lang-toggle-wrapper chip" data-lang="en">
										<span
											class="lang-toggle-label lang-toggle-label--en is-active">EN</span>
										<a
											href='<portal-navigation:url command="ChangeLanguage"><portal-navigation:urlParam name="locale" value="${localeSwitch}"/></portal-navigation:url>'>
											<button class="lang-toggle-switch" type="button"
												data-lang-toggle="" aria-label="Switch to Arabic">
												<svg class="icon lang-toggle__icon" height="18" width="18"
													aria-hidden="true">
                      <use xlink:href="#custom-globe"></use>
                    </svg>
											</button>
										</a> <span class="lang-toggle-label lang-toggle-label--ar">
											<fmt:message key="theme.header.lang.arabic" />
										</span>
									</div>
								</c:if>

								<c:if
									test="${fn:contains(pageContext.request.locale.language,'ar')}">
									<div class="lang-toggle-wrapper chip" data-lang="ar"
										role="group" aria-label="Toggle language">
										<span
											class="lang-toggle-label lang-toggle-label--ar is-active">
											<fmt:message key="theme.header.lang.arabic" />
										</span> <a
											href='<portal-navigation:url command="ChangeLanguage"><portal-navigation:urlParam name="locale" value="${localeSwitch}"/></portal-navigation:url>'>
											<button class="lang-toggle-switch" type="button"
												data-lang-toggle aria-label="Switch to English">
												<svg class="icon lang-toggle__icon" height="18" width="18"
													aria-hidden="true">
                      <use xlink:href="#custom-globe"></use>
                    </svg>
											</button>
										</a> <span class="lang-toggle-label lang-toggle-label--en">EN</span>
									</div>
								</c:if>
							</div>

							<ul class="drawer__menu" role="menu">
								<c:forEach items="${wp.navigationModel.children[nodeL1]}"
									var="nodeL2">
									<c:set var="hidePageFromNavL2"
										value="${nodeL2.metadata['navVisibility']}" />

									<c:if test="${hidePageFromNavL2 != 'hide'}">
										<%-- sanitize L2 id --%>
										<c:set var="safeL2" value="${nodeL2.objectID.uniqueName}" />
										<c:set var="safeL2" value="${fn:replace(safeL2, '.', '-')}" />
										<c:set var="safeL2" value="${fn:replace(safeL2, ':', '-')}" />
										<c:set var="safeL2" value="${fn:replace(safeL2, '/', '-')}" />
										<c:set var="safeL2" value="${fn:replace(safeL2, ' ', '-')}" />

										<li class="drawer__menu-item" role="none"><c:choose>
												<c:when test="${wp.navigationModel.hasChildren[nodeL2]}">
													<button class="drawer__submenu-toggle" type="button"
														role="menuitem" aria-expanded="false"
														aria-controls="drawer__menu--${safeL2}"
														data-target="drawer__menu--${safeL2}">
														${nodeL2.title}
														<svg class="drawer__arrow-icon" viewBox="0 0 8 14"
															fill="none" aria-hidden="true">
                          <path d="M1 13L7 7L1 1" stroke="currentColor"
																stroke-width="2" stroke-linecap="round"
																stroke-linejoin="round" />
                        </svg>
													</button>
												</c:when>

												<c:otherwise>
													<portal-navigation:urlGeneration
														contentNode="${wp.identification[nodeL2]}"
														keepNavigationalState="false">
														<a role="menuitem"
															href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
															data-unique-name="${nodeL2.objectID.uniqueName}">
															${nodeL2.title} </a>
													</portal-navigation:urlGeneration>
												</c:otherwise>
											</c:choose></li>
									</c:if>
								</c:forEach>


								<c:if
									test="${nodeL1.objectID.uniqueName == 'com.tadawul.saudiexchange.ourmarkets.v3'}">

									<li
										class="submenu-content__list-item submenu-content__list-item--featured">
										<div class="d-flex justify-content-center m-5">
											<wcm:setExplicitContext
												path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Our market"></wcm:setExplicitContext>
											<wcm:content
												pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
										</div>
									</li>
								</c:if>
								<c:if
									test="${nodeL1.objectID.uniqueName == 'com.tadawul.listing.v3'}">

									<li
										class="submenu-content__list-item submenu-content__list-item--featured">
										<div class="d-flex justify-content-center m-5">
											<div class="menubondBox">
												<div class="menubondHdng">
													<fmt:message key="theme.menu.listing.right.400.info" />
												</div>
												<div class="menubondCont">
													<p>
														<fmt:message key="theme.menu.listing.right.400.desc" />
													</p>
													<c:if
														test="${fn:contains(pageContext.request.locale.language,'en')}">
														<a target="_blank"
															href="https://www.saudiexchange.sa/Resources/400ListedSecurities/"
															class="visitBtn"
															data-unique-name="${node.objectID.uniqueName}"><fmt:message
																key="theme.menu.listing.right.cta" /> </a>
													</c:if>
													<c:if
														test="${fn:contains(pageContext.request.locale.language,'ar')}">
														<a target="_blank"
															href="https://www.saudiexchange.sa/Resources/400ListedSecurities/ar.html"
															class="visitBtn"
															data-unique-name="${node.objectID.uniqueName}"><fmt:message
																key="theme.menu.listing.right.cta" /> </a>
													</c:if>
												</div>
											</div>
										</div>
									</li>
								</c:if>
								<c:if
									test="${nodeL1.objectID.uniqueName == 'com.tadawul.trading.v3'}">

									<li
										class="submenu-content__list-item submenu-content__list-item--featured">
										<div class="d-flex justify-content-center m-5">
											<wcm:setExplicitContext
												path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Trading"></wcm:setExplicitContext>
											<wcm:content
												pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
										</div>
									</li>
								</c:if>
								<c:if
									test="${nodeL1.objectID.uniqueName == 'com.tadawul.newsandreports.v3'}">

									<li
										class="submenu-content__list-item submenu-content__list-item--featured">
										<div class="d-flex justify-content-center m-5">
											<wcm:setExplicitContext
												path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/market news"></wcm:setExplicitContext>
											<wcm:content
												pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
										</div>
									</li>
								</c:if>
								<c:if
									test="${nodeL1.objectID.uniqueName == 'com.tadawul.v3.rules.and.guidance'}">

									<li
										class="submenu-content__list-item submenu-content__list-item--featured">
										<div class="d-flex justify-content-center m-5">
											<wcm:setExplicitContext
												path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Rules and Guidance"></wcm:setExplicitContext>
											<wcm:content
												pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
										</div>
									</li>
								</c:if>
								<c:if
									test="${nodeL1.objectID.uniqueName == 'com.tadawul.aboutsaudiexchange.v3'}">

									<li
										class="submenu-content__list-item submenu-content__list-item--featured">
										<div class="d-flex justify-content-center m-5">
											<wcm:setExplicitContext
												path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/About Saudi Exchange"></wcm:setExplicitContext>
											<wcm:content
												pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
										</div>
									</li>
								</c:if>

							</ul>
						</section>

						<!-- ================= -->
						<!-- LEVEL 3 PANELS    -->
						<!-- ================= -->
						<c:forEach items="${wp.navigationModel.children[nodeL1]}"
							var="nodeL2">
							<c:if test="${wp.navigationModel.hasChildren[nodeL2]}">

								<%-- sanitize L2 for panel id --%>
								<c:set var="safeL2" value="${nodeL2.objectID.uniqueName}" />
								<c:set var="safeL2" value="${fn:replace(safeL2, '.', '-')}" />
								<c:set var="safeL2" value="${fn:replace(safeL2, ':', '-')}" />
								<c:set var="safeL2" value="${fn:replace(safeL2, '/', '-')}" />
								<c:set var="safeL2" value="${fn:replace(safeL2, ' ', '-')}" />

								<section id="drawer__menu--${safeL2}" class="drawer__panel"
									aria-hidden="true">
									<div
										class="drawer__panel-header drawer__panel-header--with-back">
										<button class="drawer__back-button" type="button"
											data-back-to="drawer__menu--${safeL1}">
											<svg class="drawer__back-icon" viewBox="0 0 8 14" fill="none"
												aria-hidden="true">
                    <path d="M7 13L1 7L7 1" stroke="currentColor"
													stroke-width="2" stroke-linecap="round"
													stroke-linejoin="round" />
                  </svg>
											<fmt:message key="theme.back" />
										</button>

										<span class="drawer__panel-title">${nodeL2.title}</span>
									</div>

									<%-- Quick actions again --%>
									<div class="drawer__actions" role="group"
										aria-label="Quick settings">
										<button class="theme-toggle chip" type="button"
											data-theme-toggle="" aria-label="Toggle light and dark mode"
											aria-pressed="true">
											<svg
												class="icon theme-toggle__icon theme-toggle__icon--light is-hidden"
												height="22" width="22" aria-hidden="true">
							                    <use xlink:href="#custom-light"></use>
							                  </svg>
											<svg
												class="icon theme-toggle__icon theme-toggle__icon--dark is-active"
												height="22" width="22" aria-hidden="true">
						                    <use xlink:href="#custom-dark"></use>
						                  </svg>
										</button>

										<c:if
											test="${fn:contains(pageContext.request.locale.language,'en')}">
											<div class="lang-toggle-wrapper chip" data-lang="en">
												<span
													class="lang-toggle-label lang-toggle-label--en is-active">EN</span>
												<a
													href='<portal-navigation:url command="ChangeLanguage"><portal-navigation:urlParam name="locale" value="${localeSwitch}"/></portal-navigation:url>'>
													<button class="lang-toggle-switch" type="button"
														data-lang-toggle="" aria-label="Switch to Arabic">
														<svg class="icon lang-toggle__icon" height="18" width="18"
															aria-hidden="true">
								                          <use xlink:href="#custom-globe"></use>
								                        </svg>
													</button>
												</a> <span class="lang-toggle-label lang-toggle-label--ar">
													<fmt:message key="theme.header.lang.arabic" />
												</span>
											</div>
										</c:if>

										<c:if
											test="${fn:contains(pageContext.request.locale.language,'ar')}">
											<div class="lang-toggle-wrapper chip" data-lang="ar"
												role="group" aria-label="Toggle language">
												<span
													class="lang-toggle-label lang-toggle-label--ar is-active">
													<fmt:message key="theme.header.lang.arabic" />
												</span> <a
													href='<portal-navigation:url command="ChangeLanguage"><portal-navigation:urlParam name="locale" value="${localeSwitch}"/></portal-navigation:url>'>
													<button class="lang-toggle-switch" type="button"
														data-lang-toggle aria-label="Switch to English">
														<svg class="icon lang-toggle__icon" height="18" width="18"
															aria-hidden="true">
                          <use xlink:href="#custom-globe"></use>
                        </svg>
													</button>
												</a> <span class="lang-toggle-label lang-toggle-label--en">EN</span>
											</div>
										</c:if>
									</div>

									<ul class="drawer__menu" role="menu">
										<c:forEach items="${wp.navigationModel.children[nodeL2]}"
											var="nodeL3">
											<c:set var="hidePageFromNavL3"
												value="${nodeL3.metadata['navVisibility']}" />

											<c:if test="${hidePageFromNavL3 != 'hide'}">
												<%-- sanitize L3 id --%>
												<c:set var="safeL3" value="${nodeL3.objectID.uniqueName}" />
												<c:set var="safeL3" value="${fn:replace(safeL3, '.', '-')}" />
												<c:set var="safeL3" value="${fn:replace(safeL3, ':', '-')}" />
												<c:set var="safeL3" value="${fn:replace(safeL3, '/', '-')}" />
												<c:set var="safeL3" value="${fn:replace(safeL3, ' ', '-')}" />

												<%-- Count visible L4 sub-children --%>
												<c:set var="visibleChildCount" value="0" />
												<c:if var="hasChildrenL3"
													test="${wp.navigationModel.hasChildren[nodeL3]}">
													<c:forEach items="${wp.navigationModel.children[nodeL3]}"
														var="nodeL4">
														<c:if test="${nodeL4.metadata['navVisibility'] != 'hide'}">
															<c:set var="visibleChildCount"
																value="${visibleChildCount + 1}" />
														</c:if>
													</c:forEach>
												</c:if>

												<li class="drawer__menu-item" role="none"><c:choose>
														<c:when test="${hasChildrenL3 && visibleChildCount > 0}">
															<button class="drawer__submenu-toggle" type="button"
																role="menuitem" aria-expanded="false"
																aria-controls="drawer__menu--${safeL3}"
																data-target="drawer__menu--${safeL3}">
																${nodeL3.title}
																<svg class="drawer__arrow-icon" viewBox="0 0 8 14"
																	fill="none" aria-hidden="true">
                              <path d="M1 13L7 7L1 1"
																		stroke="currentColor" stroke-width="2"
																		stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
															</button>
														</c:when>

														<c:otherwise>

															<portal-navigation:urlGeneration
																contentNode="${wp.identification[nodeL3]}"
																keepNavigationalState="false">
																<a role="menuitem"
																	href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
																	data-unique-name="${nodeL3.objectID.uniqueName}">
																	${nodeL3.title} </a>
															</portal-navigation:urlGeneration>
														</c:otherwise>
													</c:choose></li>
											</c:if>
										</c:forEach>
										<c:if
											test="${nodeL1.objectID.uniqueName == 'com.tadawul.saudiexchange.ourmarkets.v3'}">

											<li
												class="submenu-content__list-item submenu-content__list-item--featured">
												<div class="d-flex justify-content-center m-5">
													<wcm:setExplicitContext
														path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Our market"></wcm:setExplicitContext>
													<wcm:content
														pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
												</div>
											</li>
										</c:if>
										<c:if
											test="${nodeL1.objectID.uniqueName == 'com.tadawul.listing.v3'}">

											<li
												class="submenu-content__list-item submenu-content__list-item--featured">
												<div class="d-flex justify-content-center m-5">
													<div class="menubondBox">
														<div class="menubondHdng">
															<fmt:message key="theme.menu.listing.right.400.info" />
														</div>
														<div class="menubondCont">
															<p>
																<fmt:message key="theme.menu.listing.right.400.desc" />
															</p>
															<c:if
																test="${fn:contains(pageContext.request.locale.language,'en')}">
																<a target="_blank"
																	href="https://www.saudiexchange.sa/Resources/400ListedSecurities/"
																	class="visitBtn"
																	data-unique-name="${node.objectID.uniqueName}"><fmt:message
																		key="theme.menu.listing.right.cta" /> </a>
															</c:if>
															<c:if
																test="${fn:contains(pageContext.request.locale.language,'ar')}">
																<a target="_blank"
																	href="https://www.saudiexchange.sa/Resources/400ListedSecurities/ar.html"
																	class="visitBtn"
																	data-unique-name="${node.objectID.uniqueName}"><fmt:message
																		key="theme.menu.listing.right.cta" /> </a>
															</c:if>
														</div>
													</div>
												</div>
											</li>
										</c:if>
										<c:if
											test="${nodeL1.objectID.uniqueName == 'com.tadawul.trading.v3'}">

											<li
												class="submenu-content__list-item submenu-content__list-item--featured">
												<div class="d-flex justify-content-center m-5">
													<wcm:setExplicitContext
														path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Trading"></wcm:setExplicitContext>
													<wcm:content
														pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
												</div>
											</li>
										</c:if>
										<c:if
											test="${nodeL1.objectID.uniqueName == 'com.tadawul.newsandreports.v3'}">

											<li
												class="submenu-content__list-item submenu-content__list-item--featured">
												<div class="d-flex justify-content-center m-5">
													<wcm:setExplicitContext
														path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/market news"></wcm:setExplicitContext>
													<wcm:content
														pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
												</div>
											</li>
										</c:if>
										<c:if
											test="${nodeL1.objectID.uniqueName == 'com.tadawul.v3.rules.and.guidance'}">

											<li
												class="submenu-content__list-item submenu-content__list-item--featured">
												<div class="d-flex justify-content-center m-5">
													<wcm:setExplicitContext
														path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Rules and Guidance"></wcm:setExplicitContext>
													<wcm:content
														pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
												</div>
											</li>
										</c:if>
										<c:if
											test="${nodeL1.objectID.uniqueName == 'com.tadawul.aboutsaudiexchange.v3'}">

											<li
												class="submenu-content__list-item submenu-content__list-item--featured">
												<div class="d-flex justify-content-center m-5">
													<wcm:setExplicitContext
														path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/About Saudi Exchange"></wcm:setExplicitContext>
													<wcm:content
														pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
												</div>
											</li>
										</c:if>
									</ul>
								</section>

								<!-- ================= -->
								<!-- LEVEL 4 PANELS    -->
								<!-- ================= -->
								<c:forEach items="${wp.navigationModel.children[nodeL2]}"
									var="nodeL3">
									<c:if test="${wp.navigationModel.hasChildren[nodeL3]}">

										<%-- sanitize L3 id again for panel id --%>
										<c:set var="safeL3" value="${nodeL3.objectID.uniqueName}" />
										<c:set var="safeL3" value="${fn:replace(safeL3, '.', '-')}" />
										<c:set var="safeL3" value="${fn:replace(safeL3, ':', '-')}" />
										<c:set var="safeL3" value="${fn:replace(safeL3, '/', '-')}" />
										<c:set var="safeL3" value="${fn:replace(safeL3, ' ', '-')}" />

										<section id="drawer__menu--${safeL3}" class="drawer__panel"
											aria-hidden="true">
											<div
												class="drawer__panel-header drawer__panel-header--with-back">
												<button class="drawer__back-button" type="button"
													data-back-to="drawer__menu--${safeL2}">
													<svg class="drawer__back-icon" viewBox="0 0 8 14"
														fill="none" aria-hidden="true">
                        <path d="M7 13L1 7L7 1" stroke="currentColor"
															stroke-width="2" stroke-linecap="round"
															stroke-linejoin="round" />
                      </svg>
													<fmt:message key="theme.back" />
												</button>

												<span class="drawer__panel-title">${nodeL3.title}</span>
											</div>

											<%-- Quick actions again --%>
											<div class="drawer__actions" role="group"
												aria-label="Quick settings">
												<button class="theme-toggle chip" type="button"
													data-theme-toggle=""
													aria-label="Toggle light and dark mode" aria-pressed="true">
													<svg
														class="icon theme-toggle__icon theme-toggle__icon--light is-hidden"
														height="22" width="22" aria-hidden="true">
                        <use xlink:href="#custom-light"></use>
                      </svg>
													<svg
														class="icon theme-toggle__icon theme-toggle__icon--dark is-active"
														height="22" width="22" aria-hidden="true">
                        <use xlink:href="#custom-dark"></use>
                      </svg>
												</button>

												<c:if
													test="${fn:contains(pageContext.request.locale.language,'en')}">
													<div class="lang-toggle-wrapper chip" data-lang="en">
														<span
															class="lang-toggle-label lang-toggle-label--en is-active">EN</span>
														<a
															href='<portal-navigation:url command="ChangeLanguage"><portal-navigation:urlParam name="locale" value="${localeSwitch}"/></portal-navigation:url>'>
															<button class="lang-toggle-switch" type="button"
																data-lang-toggle="" aria-label="Switch to Arabic">
																<svg class="icon lang-toggle__icon" height="18"
																	width="18" aria-hidden="true">
                              <use xlink:href="#custom-globe"></use>
                            </svg>
															</button>
														</a> <span class="lang-toggle-label lang-toggle-label--ar">
															<fmt:message key="theme.header.lang.arabic" />
														</span>
													</div>
												</c:if>

												<c:if
													test="${fn:contains(pageContext.request.locale.language,'ar')}">
													<div class="lang-toggle-wrapper chip" data-lang="ar"
														role="group" aria-label="Toggle language">
														<span
															class="lang-toggle-label lang-toggle-label--ar is-active">
															<fmt:message key="theme.header.lang.arabic" />
														</span> <a
															href='<portal-navigation:url command="ChangeLanguage"><portal-navigation:urlParam name="locale" value="${localeSwitch}"/></portal-navigation:url>'>
															<button class="lang-toggle-switch" type="button"
																data-lang-toggle aria-label="Switch to English">
																<svg class="icon lang-toggle__icon" height="18"
																	width="18" aria-hidden="true">
                              <use xlink:href="#custom-globe"></use>
                            </svg>
															</button>
														</a> <span class="lang-toggle-label lang-toggle-label--en">EN</span>
													</div>
												</c:if>
											</div>

											<ul class="drawer__menu" role="menu">
												<c:forEach items="${wp.navigationModel.children[nodeL3]}"
													var="nodeL4">
													<c:set var="hidePageFromNavL4"
														value="${nodeL4.metadata['navVisibility']}" />

													<c:if test="${hidePageFromNavL4 != 'hide'}">
														<portal-navigation:urlGeneration
															contentNode="${wp.identification[nodeL4]}"
															keepNavigationalState="false">
															<li class="drawer__menu-item" role="none"><a
																role="menuitem"
																href="<%wpsURL.write(out);%>?locale=${pageContext.response.locale}"
																data-unique-name="${nodeL4.objectID.uniqueName}">
																	${nodeL4.title} </a></li>
														</portal-navigation:urlGeneration>
													</c:if>
												</c:forEach>
												<c:if
													test="${nodeL1.objectID.uniqueName == 'com.tadawul.saudiexchange.ourmarkets.v3'}">

													<li
														class="submenu-content__list-item submenu-content__list-item--featured">
														<div class="d-flex justify-content-center m-5">
															<wcm:setExplicitContext
																path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Our market"></wcm:setExplicitContext>
															<wcm:content
																pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
														</div>
													</li>
												</c:if>
												<c:if
													test="${nodeL1.objectID.uniqueName == 'com.tadawul.listing.v3'}">

													<li
														class="submenu-content__list-item submenu-content__list-item--featured">
														<div class="d-flex justify-content-center m-5">
															<div class="menubondBox">
																<div class="menubondHdng">
																	<fmt:message key="theme.menu.listing.right.400.info" />
																</div>
																<div class="menubondCont">
																	<p>
																		<fmt:message key="theme.menu.listing.right.400.desc" />
																	</p>
																	<c:if
																		test="${fn:contains(pageContext.request.locale.language,'en')}">
																		<a target="_blank"
																			href="https://www.saudiexchange.sa/Resources/400ListedSecurities/"
																			class="visitBtn"
																			data-unique-name="${node.objectID.uniqueName}"><fmt:message
																				key="theme.menu.listing.right.cta" /> </a>
																	</c:if>
																	<c:if
																		test="${fn:contains(pageContext.request.locale.language,'ar')}">
																		<a target="_blank"
																			href="https://www.saudiexchange.sa/Resources/400ListedSecurities/ar.html"
																			class="visitBtn"
																			data-unique-name="${node.objectID.uniqueName}"><fmt:message
																				key="theme.menu.listing.right.cta" /> </a>
																	</c:if>
																</div>
															</div>
														</div>
													</li>
												</c:if>
												<c:if
													test="${nodeL1.objectID.uniqueName == 'com.tadawul.trading.v3'}">

													<li
														class="submenu-content__list-item submenu-content__list-item--featured">
														<div class="d-flex justify-content-center m-5">
															<wcm:setExplicitContext
																path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Trading"></wcm:setExplicitContext>
															<wcm:content
																pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
														</div>
													</li>
												</c:if>
												<c:if
													test="${nodeL1.objectID.uniqueName == 'com.tadawul.newsandreports.v3'}">

													<li
														class="submenu-content__list-item submenu-content__list-item--featured">
														<div class="d-flex justify-content-center m-5">
															<wcm:setExplicitContext
																path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/market news"></wcm:setExplicitContext>
															<wcm:content
																pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
														</div>
													</li>
												</c:if>
												<c:if
													test="${nodeL1.objectID.uniqueName == 'com.tadawul.v3.rules.and.guidance'}">

													<li
														class="submenu-content__list-item submenu-content__list-item--featured">
														<div class="d-flex justify-content-center m-5">
															<wcm:setExplicitContext
																path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/Rules and Guidance"></wcm:setExplicitContext>
															<wcm:content
																pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
														</div>
													</li>
												</c:if>
												<c:if
													test="${nodeL1.objectID.uniqueName == 'com.tadawul.aboutsaudiexchange.v3'}">

													<li
														class="submenu-content__list-item submenu-content__list-item--featured">
														<div class="d-flex justify-content-center m-5">
															<wcm:setExplicitContext
																path="tadawulv2_en/sa-tadawul/SA-Home/Featured-Menu-V3/About Saudi Exchange"></wcm:setExplicitContext>
															<wcm:content
																pageDesign="TadawulV2_Design/PT-Featured-Menu-V3"></wcm:content>
														</div>
													</li>
												</c:if>
											</ul>
										</section>
									</c:if>
								</c:forEach>
							</c:if>
						</c:forEach>
					</c:if>
				</c:forEach>
			</div>
		</aside>
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

(function(window, document, $, DataTableCore) {
	"use strict";

	if (!$) {
		throw new Error("PageViewManager requires jQuery.");
	}

	if (!DataTableCore) {
		throw new Error("PageViewManager requires DataTableCore.");
	}

	if (!window.SelectUtils) {
		throw new Error("PageViewManager requires SelectUtils.");
	}

	var SelectUtils = window.SelectUtils;

	function resolvedPromise() {
		return $.Deferred().resolve().promise();
	}

	function raf(callback) {
		if (window.requestAnimationFrame) {
			return window.requestAnimationFrame(callback);
		}

		return window.setTimeout(callback, 16);
	}

	function createManager(options) {
		options = options || {};

		var config = options.config || {};
		var renderers = options.renderers || {};

		var liveRefreshTimer = null;
		var previousRowsMap = {};

		var state = {
			rows : [],
			activeView : config.initialView || "1",
			isMobile : false,
			isLoading : false,
			isTransitioning : false,
			isLiveRefreshing : false,
			loadedViews : {},
			columnVisibility : Object.assign({}, config.columnVisibility || {})
		};

		var els = {};
		var controllers = {};

		var timers = {
			resize : null,
			columnVisibility : null
		};

		var handlers = {
			resize : null,
			viewInputChange : null,
			mobileClick : null
		};

		var manager = {
			init : function() {
				this.cacheDom();
				this.initState();
				this.bindEvents();
				this.syncColumnSelectorUi();
				this.reload();
				this.startLiveRefresh();

				return this;
			},

			cacheDom : function() {
				var selectors = config.selectors || {};

				els.viewInput = document.querySelector(selectors.viewInput);
				els.columnVisibilityInput = document
						.querySelector(selectors.columnVisibilityInput);

				els.desktopView = document.querySelector(selectors.desktopView);
				els.mobileView = document.querySelector(selectors.mobileView);
				els.mobileContainer = document
						.querySelector(selectors.mobileContainer);

				els.columnFieldShell = selectors.columnField ? document
						.querySelector(selectors.columnField) : document
						.querySelector('[data-field="columnVisibility"]');

				els.columnFieldValue = els.columnFieldShell ? els.columnFieldShell
						.querySelector(".form-select-value")
						: null;

				if (els.desktopView) {
					els.desktopView.classList.add("page-view-container");
				}

				if (els.mobileView) {
					els.mobileView.classList.add("page-view-container");
				}

				if (typeof renderers.cacheDom === "function") {
					renderers.cacheDom.call(this, els, state, config);
				}
			},

			initState : function() {
				if (typeof config.getInitialView === "function") {
					state.activeView = config.getInitialView()
							|| state.activeView;
				}

				state.isMobile = this.computeIsMobile();

				if (!Object.keys(state.columnVisibility).length
						&& config.defaultColumnVisibility) {
					state.columnVisibility = Object.assign({},
							config.defaultColumnVisibility);
				}
			},

			bindEvents : function() {
				this.bindViewInput();
				this.bindColumnVisibility();
				this.bindMobileDelegates();
				this.bindResize();

				if (typeof renderers.bindEvents === "function") {
					renderers.bindEvents.call(this, els, state, config);
				}
			},

			bindViewInput : function() {
				if (!els.viewInput)
					return;

				handlers.viewInputChange = function() {
					var value = els.viewInput.value || "1";

					if (state.activeView === value)
						return;

					state.activeView = value;

					if (typeof config.onViewChange === "function") {
						config.onViewChange.call(manager, state.activeView,
								state);
					}

					manager.render();
				};

				els.viewInput.addEventListener("change",
						handlers.viewInputChange);
			},

			bindColumnVisibility : function() {
				if (!els.columnFieldShell)
					return;

				controllers.columnVisibility = SelectUtils
						.createMultiSelectController({
							shell : els.columnFieldShell,
							valueEl : els.columnFieldValue,
							input : els.columnVisibilityInput,
							stateMap : state.columnVisibility,
							labels : {
								showAll : config.labels
										&& config.labels.showAll,
								noColumns : config.labels
										&& config.labels.noColumns,
								selectedSuffix : config.labels
										&& config.labels.selectedSuffix
							},
							onChange : function() {
								if (state.isMobile) {
									manager.renderMobile();
									return;
								}

								manager.scheduleColumnVisibility();
							}
						});
			},

			bindMobileDelegates : function() {
				if (!els.mobileContainer)
					return;

				handlers.mobileClick = function(event) {
					if (typeof renderers.onMobileClick === "function") {
						renderers.onMobileClick.call(manager, event, els,
								state, config);
					}
				};

				els.mobileContainer.addEventListener("click",
						handlers.mobileClick);
			},

			bindResize : function() {
				handlers.resize = function() {
					clearTimeout(timers.resize);

					timers.resize = setTimeout(function() {
						manager.handleResize();
					}, config.resizeDelay || 200);
				};

				window.addEventListener("resize", handlers.resize);
			},

			handleResize : function() {
				var wasMobile = state.isMobile;
				var nowMobile = this.computeIsMobile();

				if (wasMobile === nowMobile) {
					if (!nowMobile) {
						this.scheduleAdjust();
					}

					return;
				}

				this.beforeHeavyRender({
					reason : "responsive-switch",
					fromMobile : wasMobile,
					toMobile : nowMobile
				});

				this.setTransitioning(true);

				state.isMobile = nowMobile;

				raf(function() {
					manager.syncResponsiveMode();

					if (nowMobile) {
						manager.renderMobile();

						raf(function() {
							manager.setTransitioning(false);

							manager.afterHeavyRender({
								reason : "responsive-switch",
								mode : "mobile"
							});
						});

						return;
					}

					manager.renderDesktop();

					raf(function() {
						manager.adjustActiveTable();

						raf(function() {
							manager.setTransitioning(false);

							manager.afterHeavyRender({
								reason : "responsive-switch",
								mode : "desktop"
							});
						});
					});
				});
			},

			getBreakpoint : function() {
				return Number(config.mobileMaxWidth || 767.98);
			},

			computeIsMobile : function() {
				return window.innerWidth <= this.getBreakpoint();
			},

			getActiveView : function() {
				return state.activeView;
			},

			getActiveTableSelector : function() {
				var targets = config.viewTargets || {};
				return targets[state.activeView] || targets["1"];
			},

			getActiveTableInstance : function() {
				return DataTableCore.getInstance(this.getActiveTableSelector());
			},

			syncViewPanels : function() {
				var panelSelector = config.selectors
						&& config.selectors.viewPanel;
				if (!panelSelector)
					return;

				document
						.querySelectorAll(panelSelector)
						.forEach(
								function(panel) {
									var isActive = panel
											.getAttribute("data-table-view") === state.activeView;

									panel.hidden = !isActive;
									panel.classList.toggle("is-active",
											isActive);
								});
			},

			syncResponsiveMode : function() {
				if (els.desktopView) {
					els.desktopView.hidden = state.isMobile;
				}

				if (els.mobileView) {
					els.mobileView.hidden = !state.isMobile;
				}

				this.syncViewPanels();
			},

			setLoading : function(isLoading) {
				state.isLoading = isLoading;
				this.toggleViewClass("page-view-loading", isLoading);

				if (typeof renderers.setLoading === "function") {
					renderers.setLoading.call(this, isLoading, els, state,
							config);
				}
			},

			setTransitioning : function(isTransitioning) {
				state.isTransitioning = isTransitioning;
				this
						.toggleViewClass("page-view-transitioning",
								isTransitioning);
			},

			toggleViewClass : function(className, enabled) {
				var method = enabled ? "add" : "remove";

				if (els.desktopView) {
					els.desktopView.classList[method](className);
				}

				if (els.mobileView) {
					els.mobileView.classList[method](className);
				}
			},

			beforeHeavyRender : function(meta) {
				if (typeof config.onBeforeHeavyRender === "function") {
					config.onBeforeHeavyRender.call(this, state, els, config,
							meta || {});
				}

				if (typeof renderers.beforeHeavyRender === "function") {
					renderers.beforeHeavyRender.call(this, state, els, config,
							meta || {});
				}
			},

			afterHeavyRender : function(meta) {
				if (typeof config.onAfterHeavyRender === "function") {
					config.onAfterHeavyRender.call(this, state, els, config,
							meta || {});
				}

				if (typeof renderers.afterHeavyRender === "function") {
					renderers.afterHeavyRender.call(this, state, els, config,
							meta || {});
				}
			},

			normalizeResponse : function(response) {
				if (!response)
					return [];

				if (typeof response === "string") {
					try {
						return this.normalizeResponse(JSON.parse(response));
					} catch (error) {
						console.error(
								"[PageViewManager] Failed to parse response:",
								error);
						return [];
					}
				}

				if (Array.isArray(response))
					return response;
				if (Array.isArray(response.data))
					return response.data;

				if (typeof config.normalizeResponse === "function") {
					return config.normalizeResponse.call(this, response);
				}

				return [];
			},

			buildAjax : function() {
				return {
					url : config.endpoint,
					type : config.ajaxMethod || "GET",

					data : function() {
						if (typeof config.getRequestData === "function") {
							return config.getRequestData.call(manager, state,
									els, config);
						}

						return {};
					},

					dataSrc : function(response) {
						var rows = manager.normalizeResponse(response);

						state.rows = rows;
						state.loadedViews[state.activeView] = true;
						previousRowsMap = manager.buildRowsMap(rows);

						return rows;
					}
				};
			},

			fetchRows : function() {
				return $
						.ajax(
								{
									url : config.endpoint,
									type : config.ajaxMethod || "GET",
									data : typeof config.getRequestData === "function" ? config.getRequestData
											.call(this, state, els, config)
											: {}
								}).then(function(response) {
							return manager.normalizeResponse(response);
						});
			},

			getTableColumns : function() {
				if (typeof renderers.getTableColumns !== "function") {
					throw new Error(
							"PageViewManager requires renderers.getTableColumns(view, state, config).");
				}

				return renderers.getTableColumns.call(this, state.activeView,
						state, config);
			},

			getTableOptions : function() {
				var baseOptions = {
					processing : false,
					paging : false,
					searching : false,
					ordering : false,
					info : false,
					scrollX : true,
					scrollCollapse : true,
					autoWidth : false,
					deferRender : true,
					dom : "rt"
				};

				if (typeof renderers.getTableOptions === "function") {
					return $.extend(true, {}, baseOptions,
							renderers.getTableOptions.call(this,
									state.activeView, state, config));
				}

				return baseOptions;
			},

			renderDesktop : function() {
				var target = this.getActiveTableSelector();
				var existing = DataTableCore.getInstance(target);

				this.syncViewPanels();

				if (existing) {
					this.applyColumnVisibility({
						silent : true
					});
					this.scheduleAdjust();
					return;
				}

				DataTableCore
						.render({
							target : target,
							columns : this.getTableColumns(),
							ajax : this.buildAjax(),
							dtOptions : this.getTableOptions(),
							features : $.extend(true, {
								fixedHeader : true,
								loader : true
							}, config.features || {}),
							lifecycle : {
								onInit : function() {
									manager.scheduleColumnVisibility();

									if (typeof renderers.afterTableInit === "function") {
										renderers.afterTableInit.call(manager,
												target, els, state, config);
									}
								},

								onRefresh : function() {
									manager.scheduleColumnVisibility();

									if (typeof renderers.afterTableRefresh === "function") {
										renderers.afterTableRefresh.call(
												manager, target, els, state,
												config);
									}
								}
							}
						});

				this.scheduleAdjust();
			},

			renderMobile : function() {
				if (!els.mobileContainer)
					return;

				if (typeof renderers.renderMobile !== "function") {
					els.mobileContainer.innerHTML = "";
					return;
				}

				els.mobileContainer.innerHTML = renderers.renderMobile.call(
						this, state.rows, state, config);

				if (typeof renderers.afterMobileRender === "function") {
					renderers.afterMobileRender.call(this, els.mobileContainer,
							els, state, config);
				}
			},

			render : function() {
				state.isMobile = this.computeIsMobile();
				this.syncResponsiveMode();

				if (state.isMobile) {
					if (state.rows.length) {
						this.renderMobile();
					} else {
						this.reload();
					}

					return;
				}

				this.renderDesktop();
			},

			reload : function() {
				if (state.isLoading) {
					return resolvedPromise();
				}

				state.isMobile = this.computeIsMobile();
				this.syncResponsiveMode();

				if (state.isMobile) {
					this.setLoading(true);

					return this
							.fetchRows()
							.then(function(rows) {
								state.rows = rows;
								previousRowsMap = manager.buildRowsMap(rows);
								manager.renderMobile();
							})
							.fail(
									function(error) {
										console
												.error(
														"[PageViewManager] Failed to load rows:",
														error);

										state.rows = [];
										previousRowsMap = {};
										manager.renderMobile();
									}).always(function() {
								manager.setLoading(false);
							});
				}

				this.renderDesktop();
				return resolvedPromise();
			},

			refresh : function() {
				if (state.isMobile) {
					return this.reload();
				}

				var target = this.getActiveTableSelector();
				var instance = DataTableCore.getInstance(target);

				if (instance) {
					DataTableCore.refresh(target);
					return resolvedPromise();
				}

				this.renderDesktop();
				return resolvedPromise();
			},

			/*
			 * =============================== Live refresh
			 * ===============================
			 */

			getLiveRefreshConfig : function() {
				return config.liveRefresh || {};
			},

			isLiveRefreshEnabled : function() {
				var liveConfig = this.getLiveRefreshConfig();

				return !!(liveConfig.enabled && liveConfig.interval && liveConfig.rowKey);
			},

			buildRowsMap : function(rows) {
				var liveConfig = this.getLiveRefreshConfig();
				var rowKey = liveConfig.rowKey;
				var map = {};

				(rows || []).forEach(function(row) {
					if (!row || row[rowKey] == null)
						return;

					map[row[rowKey]] = row;
				});

				return map;
			},

			startLiveRefresh : function() {
				if (!this.isLiveRefreshEnabled())
					return;

				this.stopLiveRefresh();

				liveRefreshTimer = window.setInterval(function() {
					manager.refreshLiveRows();
				}, this.getLiveRefreshConfig().interval);
			},

			stopLiveRefresh : function() {
				if (liveRefreshTimer) {
					window.clearInterval(liveRefreshTimer);
					liveRefreshTimer = null;
				}
			},

			refreshLiveRows : function() {
				if (state.isLoading || state.isTransitioning
						|| state.isLiveRefreshing) {
					return resolvedPromise();
				}

				state.isLiveRefreshing = true;

				return this.fetchRows().then(function(rows) {
					if (state.isMobile) {
						state.rows = rows;
						previousRowsMap = manager.buildRowsMap(rows);
						manager.renderMobile();
						return;
					}

					manager.applyLiveRows(rows);
				}).fail(
						function(error) {
							console.error(
									"[PageViewManager] Live refresh failed:",
									error);
						}).always(function() {
					state.isLiveRefreshing = false;
				});
			},

			applyLiveRows : function(rows) {
				var instance = this.getActiveTableInstance();

				if (!instance) {
					state.rows = rows;
					previousRowsMap = this.buildRowsMap(rows);
					return;
				}

				var oldRowsMap = previousRowsMap;
				var newRowsMap = this.buildRowsMap(rows);
				var rowKey = this.getLiveRefreshConfig().rowKey;
				var hasStructureChange = false;

				if (Object.keys(oldRowsMap).length !== Object.keys(newRowsMap).length) {
					hasStructureChange = true;
				}

				(rows || []).forEach(function(newRow) {
					var key = newRow && newRow[rowKey];

					if (key == null || !oldRowsMap[key]) {
						hasStructureChange = true;
					}
				});

				if (hasStructureChange) {
					state.rows = rows;
					previousRowsMap = newRowsMap;

					instance.clear();
					instance.rows.add(rows);
					instance.draw(false);

					manager.scheduleColumnVisibility();
					manager.scheduleAdjust();
					return;
				}

				var pendingFlashes = [];

				(rows || []).forEach(function(newRow) {
					pendingFlashes = pendingFlashes.concat(manager
							.applyLiveRowUpdate(instance, newRow, oldRowsMap));
				});

				state.rows = rows;
				previousRowsMap = newRowsMap;

				instance.draw(false);

				raf(function() {
					pendingFlashes.forEach(function(flash) {
						manager.flashLiveCell(flash.rowIndex,
								flash.columnIndex, flash.flashClass);
					});

					manager.scheduleAdjust();
				});
			},

			applyLiveRowUpdate : function(instance, newRow, oldRowsMap) {
				var rowKey = this.getLiveRefreshConfig().rowKey;
				var key = newRow && newRow[rowKey];
				var oldRow = key != null ? oldRowsMap[key] : null;
				var flashes = [];

				if (!oldRow)
					return flashes;

				var rowIndex = this
						.findDataTableRowIndex(instance, rowKey, key);

				if (rowIndex < 0)
					return flashes;

				var changedFields = this.getChangedLiveFields(oldRow, newRow);

				instance.row(rowIndex).data(newRow).invalidate();

				changedFields.forEach(function(change) {
					var columnIndex = manager
							.getColumnIndexByDataField(change.field);
					var flashClass = manager.getLiveFlashClass(change);

					if (columnIndex >= 0 && flashClass) {
						flashes.push({
							rowIndex : rowIndex,
							columnIndex : columnIndex,
							flashClass : flashClass
						});
					}
				});

				return flashes;
			},

			findDataTableRowIndex : function(instance, rowKey, key) {
				var foundIndex = -1;

				instance.rows().every(function(index) {
					if (foundIndex !== -1)
						return;

					var rowData = this.data();

					if (rowData && rowData[rowKey] === key) {
						foundIndex = index;
					}
				});

				return foundIndex;
			},

			getLiveFields : function() {
				var liveConfig = this.getLiveRefreshConfig();
				return liveConfig.fields || {};
			},

			normalizeLiveValue : function(value, compareAs) {
				if (value == null || value === "")
					return null;

				if (compareAs === "number") {
					var num = Number(String(value).replace(/,/g, ""));

					return Number.isNaN(num) ? null : num;
				}

				return String(value);
			},

			getChangedLiveFields : function(oldRow, newRow) {
				var fields = this.getLiveFields();
				var changed = [];

				Object.keys(fields).forEach(
						function(field) {
							var fieldConfig = fields[field];

							if (!fieldConfig || !fieldConfig.enabled)
								return;

							var oldValue = manager.normalizeLiveValue(oldRow
									&& oldRow[field], fieldConfig.compareAs);

							var newValue = manager.normalizeLiveValue(newRow
									&& newRow[field], fieldConfig.compareAs);

							if (oldValue === newValue)
								return;

							changed.push({
								field : field,
								oldValue : oldValue,
								newValue : newValue
							});
						});

				return changed;
			},

			getColumnIndexByDataField : function(fieldName) {
				var columns = this.getTableColumns();
				var foundIndex = -1;

				columns.forEach(function(column, index) {
					if (foundIndex !== -1)
						return;

					if (column.data === fieldName) {
						foundIndex = index;
					}
				});

				return foundIndex;
			},

			getLiveFlashClass : function(change) {
				var liveConfig = this.getLiveRefreshConfig();
				var flash = liveConfig.flash || {};

				if (!flash.enabled)
					return "";

				if (typeof change.oldValue === "number"
						&& typeof change.newValue === "number") {
					if (change.newValue > change.oldValue) {
						return flash.upClass || "td-flash-up";
					}

					if (change.newValue < change.oldValue) {
						return flash.downClass || "td-flash-down";
					}
				}

				return flash.equalClass || "td-flash-equal";
			},

			flashLiveCell : function(rowIndex, columnIndex, flashClass) {
				var instance = this.getActiveTableInstance();

				if (!instance || rowIndex < 0 || columnIndex < 0 || !flashClass) {
					return;
				}

				var liveConfig = this.getLiveRefreshConfig();
				var flash = liveConfig.flash || {};
				var duration = flash.duration || 1200;
				var cellNode = instance.cell(rowIndex, columnIndex).node();

				if (!cellNode)
					return;

				cellNode.classList.remove(flash.upClass || "td-flash-up",
						flash.downClass || "td-flash-down", flash.equalClass
								|| "td-flash-equal");

				void cellNode.offsetWidth;

				cellNode.classList.add(flashClass);

				window.setTimeout(function() {
					cellNode.classList.remove(flashClass);
				}, duration);
			},

			/*
			 * =============================== Column visibility
			 * ===============================
			 */

			scheduleColumnVisibility : function() {
				clearTimeout(timers.columnVisibility);

				timers.columnVisibility = setTimeout(function() {
					manager.applyColumnVisibility();
				}, config.columnVisibilityDelay || 40);
			},

			applyColumnVisibility : function(options) {
				var instance = this.getActiveTableInstance();
				if (!instance)
					return;

				var opts = options || {};
				var silent = !!opts.silent;

				var groupMap = config.columnGroupsByView ? config.columnGroupsByView[state.activeView]
						|| {}
						: {};

				if (!silent) {
					this.beforeHeavyRender({
						reason : "column-visibility",
						view : state.activeView
					});

					this.setTransitioning(true);
				}

				Object.keys(groupMap).forEach(function(groupKey) {
					var visible = !!state.columnVisibility[groupKey];
					var indexes = groupMap[groupKey] || [];

					indexes.forEach(function(index) {
						var column = instance.column(index);

						if (column.visible() !== visible) {
							column.visible(visible, false);
						}
					});
				});

				this.updateGroupedHeaderVisibility();

				raf(function() {
					instance.columns.adjust().draw(false);

					manager.adjustActiveTable({
						skipRenderers : true
					});

					raf(function() {
						if (typeof renderers.afterAdjust === "function") {
							renderers.afterAdjust.call(manager, instance, els,
									state, config);
						}

						if (!silent) {
							manager.setTransitioning(false);

							manager.afterHeavyRender({
								reason : "column-visibility",
								view : state.activeView
							});
						}
					});
				});
			},

			updateGroupedHeaderVisibility : function() {
				var table = document.querySelector(this
						.getActiveTableSelector());
				if (!table)
					return;

				table
						.querySelectorAll(
								"[data-column-group-head], [data-column-group]")
						.forEach(
								function(cell) {
									var key = cell
											.getAttribute("data-column-group-head")
											|| cell
													.getAttribute("data-column-group");

									if (!key
											|| !(key in state.columnVisibility))
										return;

									cell.style.display = state.columnVisibility[key] ? ""
											: "none";
								});
			},

			scheduleAdjust : function() {
				raf(function() {
					manager.adjustActiveTable();
				});
			},

			adjustActiveTable : function(options) {
				var instance = this.getActiveTableInstance();
				if (!instance)
					return;

				var opts = options || {};

				instance.columns.adjust();

				if (instance.fixedHeader && instance.fixedHeader.adjust) {
					instance.fixedHeader.adjust();
				}

				if (!opts.skipRenderers
						&& typeof renderers.afterAdjust === "function") {
					renderers.afterAdjust.call(this, instance, els, state,
							config);
				}
			},

			syncColumnSelectorUi : function() {
				if (controllers.columnVisibility
						&& controllers.columnVisibility.sync) {
					controllers.columnVisibility.sync();
					return;
				}

				SelectUtils.syncOptionsFromState(els.columnFieldShell,
						state.columnVisibility);

				SelectUtils.updateValueLabel(els.columnFieldValue,
						state.columnVisibility, {
							showAll : config.labels && config.labels.showAll,
							noColumns : config.labels
									&& config.labels.noColumns,
							selectedSuffix : config.labels
									&& config.labels.selectedSuffix
						});

				SelectUtils.syncHiddenInput(els.columnVisibilityInput,
						state.columnVisibility);
			},

			getState : function() {
				return state;
			},

			getElements : function() {
				return els;
			},

			destroy : function() {
				this.stopLiveRefresh();

				clearTimeout(timers.resize);
				clearTimeout(timers.columnVisibility);

				previousRowsMap = {};

				if (els.viewInput && handlers.viewInputChange) {
					els.viewInput.removeEventListener("change",
							handlers.viewInputChange);
				}

				if (els.mobileContainer && handlers.mobileClick) {
					els.mobileContainer.removeEventListener("click",
							handlers.mobileClick);
				}

				if (handlers.resize) {
					window.removeEventListener("resize", handlers.resize);
				}

				if (controllers.columnVisibility
						&& controllers.columnVisibility.destroy) {
					controllers.columnVisibility.destroy();
				}

				if (typeof renderers.destroy === "function") {
					renderers.destroy.call(this, els, state, config);
				}

				handlers.resize = null;
				handlers.viewInputChange = null;
				handlers.mobileClick = null;

				controllers = {};
			}
		};

		return manager;
	}

	window.PageViewManager = {
		create : createManager
	};
})(window, document, window.jQuery, window.DataTableCore);

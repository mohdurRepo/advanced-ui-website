(function (window, document, $) {
	  "use strict";
	 
	  const LIMIT = 5;
	 
	  let selectedPeerCodes = [];
	  let activePeerTab = "table";
	 
	  const U = window.PeerComparisonUtils;
	  const Table = window.PeerComparisonTable;
	  const Graph = window.PeerComparisonGraph;
	 
	  document.addEventListener("click", function (event) {
	    const trigger = event.target.closest("[data-peer-open]");
	    if (!trigger || typeof window.openAppModal !== "function") return;
	 
	    openPeerModal();
	  });
	 
	  function openPeerModal() {
	    const source = document.getElementById("peerModalContent");
	    if (!source) return;
	 
	    const body = source.querySelector("[data-peer-body]");
	    const footer = source.querySelector("[data-peer-footer]");
	    if (!body || !footer) return;
	 
	    window.openAppModal({
	      title: `${U.getLabels().peerCompare || "Compare"}`,
	      size: "lg",
	      height: "md",
	      showHeader: true,
	      showFooter: true,
	      body: body.innerHTML,
	      footer: footer.innerHTML
	    });
	 
	    setTimeout(initPeerSelection, 0);
	  }
	 
	  function initPeerSelection() {
	    const modal = document.querySelector("[data-app-modal]");
	    const root = modal && modal.querySelector("[data-peer-selection]");
	    if (!root) return;
	 
	    restoreSelectedCompanies(root);
	    updateCount(root);
	    bindSelection(root);
	    bindSearch(root);
	    bindSubmit(root, modal);
	  }
	 
	  function restoreSelectedCompanies(root) {
	    root.querySelectorAll("[data-peer-checkbox]").forEach(function (checkbox) {
	      checkbox.checked = selectedPeerCodes.includes(checkbox.value);
	    });
	  }
	 
	  function bindSelection(root) {
	    root.addEventListener("change", function (event) {
	      const checkbox = event.target.closest("[data-peer-checkbox]");
	      if (!checkbox) return;
	 
	      const checked = root.querySelectorAll("[data-peer-checkbox]:checked");
	      const error = root.querySelector("[data-peer-error]");
	 
	      if (checked.length > LIMIT) {
	        checkbox.checked = false;
	        if (error) error.hidden = false;
	        return;
	      }
	 
	      if (error) error.hidden = true;
	      updateCount(root);
	    });
	  }
	 
	  function updateCount(root) {
	    const count = root.querySelector("[data-peer-count]");
	    if (!count) return;
	 
	    const total = root.querySelectorAll("[data-peer-checkbox]:checked").length;
	    count.textContent = `${total} ${window.peer_of} ${LIMIT} ${window.peer_selected}`;
	  }
	 
	  function bindSearch(root) {
	    const input = root.querySelector("[data-peer-search]");
	    if (!input) return;
	 
	    input.addEventListener("input", function () {
	      const query = input.value.trim().toLowerCase();
	      const options = root.querySelectorAll("[data-peer-option]");
	      const empty = root.querySelector("[data-peer-empty]");
	      let visibleCount = 0;
	 
	      options.forEach(function (option) {
	        const text = option.innerText.toLowerCase();
	        const isVisible = text.includes(query);
	 
	        option.hidden = !isVisible;
	        if (isVisible) visibleCount++;
	      });
	 
	      if (empty) {
	        empty.hidden = visibleCount !== 0;
	      }
	    });
	  }
	 
	  function bindSubmit(root, modal) {
	    const submit = modal.querySelector("[data-peer-submit]");
	    if (!submit) return;
	 
	    submit.addEventListener("click", function () {
	      const selected = getSelectedCompaniesFromModal(root);
	 
	      selectedPeerCodes = selected.map(function (company) {
	        return company.code;
	      });
	 
	      renderPeerResult(selected);
	 
	      if (typeof window.closeAppModal === "function") {
	        window.closeAppModal();
	      }
	    });
	  }
	 
	  function getSelectedCompaniesFromModal(root) {
	    return Array.from(root.querySelectorAll("[data-peer-checkbox]:checked")).map(function (checkbox) {
	      const option = checkbox.closest("[data-peer-option]");
	 
	      return {
	        code: checkbox.value,
	        name: option.querySelector(".peer-option__name")
	          ? option.querySelector(".peer-option__name").textContent.trim()
	          : checkbox.value
	      };
	    });
	  }
	 
	function getSelectedCompaniesFromTemplate() {
	    const source = document.getElementById("peerModalContent");
	    if (!source) return [];
	 
	    return selectedPeerCodes
	      .map(function (code) {
	        const checkbox = source.querySelector(`[data-peer-checkbox][value="${code}"]`);
	        if (!checkbox) return null;
	 
	        const option = checkbox.closest("[data-peer-option]");
	 
	        return {
	          code: checkbox.value,
	          name: option.querySelector(".peer-option__name")
	            ? option.querySelector(".peer-option__name").textContent.trim()
	            : checkbox.value
	        };
	      })
	      .filter(Boolean);
	  }
	 
	  function fetchPeerComparisonData(companies) {
	    const config = U.getConfig();
	 
	    const symbols = companies
	      .map(function (company) {
	        return company.code;
	      })
	      .join(",");
	 
	    return $.ajax({
	      url: config.endpoint || config.apiUrl,
	      type: config.ajaxMethod || "GET",
	      dataType: "json",
	      data: {
	        companySymbol: config.companySymbol || "",
	        peerID: symbols
	      }
	    });
	  }
	 
	  function renderPeerResult(companies) {
	    const result = document.querySelector("[data-peer-result]");
	    const inner = document.querySelector("[data-peer-result-inner]");
	 
	    if (!result || !inner) return;
	 
	    if (!companies.length) {
	      result.classList.remove("is-expanded");
	      inner.innerHTML = "";
	      activePeerTab = "table";
	      return;
	    }
	 
	    inner.innerHTML = getResultShell(companies);
	 
	    result.classList.add("is-expanded");
	 
	    initPeerTabs(result);
	    bindPeerRemove(result);
	    bindPeerClose(result);
	    setLoadingState(companies);
	 
	    fetchPeerComparisonData(companies)
	      .done(function (response) {
	        const rows = normalizePeerResponse(response);
	 
	        Table.renderSummaryHeader(rows, companies);
	        Table.renderSummaryTable(rows, companies);
	 
	        Graph.renderChart(rows, companies);
	 
	        bindPeerRemove(result);
	      })
	      .fail(function () {
	        Table.renderTableError(companies);
	        Graph.renderGraphError();
	      });
	  }
	 
	  function getResultShell(companies) {
	    return `
	      <div class="peer-comparison-box app-container intro-section">
	 
	        <div class="peer-comparison-box__header mt-4">
		        <div class="peer-comparison-box__actions">
				  <div class="peer-tabs" role="tablist" aria-label="Peer comparison view"><button type="button" class="peer-tabs__item" role="tab" aria-selected="false" data-peer-tab="table">${U.getLabels().table || "All"}</button><button type="button" class="peer-tabs__item" role="tab" aria-selected="false" data-peer-tab="graph">${U.getLabels().graph || "All"}</button></div>
				  <button type="button" class="btn btn-primary" data-peer-open>
				    ${U.getLabels().addCompany || "All"}
				  </button>
				</div>
				<button
				  type="button"
				  class="peer-close-btn"
				  data-peer-close
				  aria-label="${U.getLabels().close || "Close"}"
				  title="${U.getLabels().close || "Close"}"
				>
				  ×
				</button>     
	        </div>
	        
	 
	        <div class="peer-panel" data-peer-panel="table">
	          <div class="table-responsive">
	            <table class="table">
	              <thead data-peer-summary-head>
	                <tr>
	                  <th>${U.getLabels().metric || "All"}</th>
	                  <th>${U.getLabels().loading || "All"}...</th>
	                </tr>
	              </thead>
	 
	              <tbody data-peer-summary-body>
	                <tr>
	                  <td colspan="${companies.length + 2}">
	                    ${U.getLabels().loading || "All"}
	                  </td>
	                </tr>
	              </tbody>
	            </table>
	          </div>
	        </div>
	 
	        <div class="peer-panel" data-peer-panel="graph" hidden>
	          <div class="mt-4">
	 
	            <div class="performance-panel performance-panel--chart">
	              <section
					  class="chart-container"
					  data-peer-chart
					  data-chart-page-name="${U.getConfig().pageName || ''}"
					  data-chart-token="${U.getConfig().getTokenUrl || ''}"
					  aria-label="Time series chart"
					>
					  <header class="chart-toolbar chart-toolbar--stacked">
					 
					    <div class="chart-toolbar__top">
					      <h2 class="chart-toolbar__title">
					        <svg
					          class="pc-icon pr-3 link-icon ms-3 me-3"
					          width="40"
					          height="40"
					          style="color: blue; fill: blue"
					        >
					          <use xlink:href="#tadawul-arrow-icon"></use>
					        </svg>
					 
					        ${U.getLabels().peerCompare || "Compare"}
					      </h2>
					    </div>
					 
					    <div class="chart-toolbar__bottom">
					 
					      <div
					        class="chart-toolbar__ranges"
					        role="tablist"
					        aria-label="Chart range selector"
					      >
					        <button type="button" class="chart-range" data-range="1D" role="tab">
					          ${U.getLabels().range1D || "1D"}
					        </button>
					 
					        <button type="button" class="chart-range is-active" data-range="1W" role="tab">
					          ${U.getLabels().range1W || "1W"}
					        </button>
					 
					        <button type="button" class="chart-range" data-range="1M" role="tab">
					          ${U.getLabels().range1M || "1M"}
					        </button>
					 
					        <button type="button" class="chart-range" data-range="3M" role="tab">
					          ${U.getLabels().range3M || "3M"}
					        </button>
					 
					        <button type="button" class="chart-range" data-range="1Y" role="tab">
					          ${U.getLabels().range1Y || "1Y"}
					        </button>
					 
					        <button type="button" class="chart-range" data-range="ALL" role="tab">
					          ${U.getLabels().rangeAll || "All"}
					        </button>
					 
					        <span class="chart-range-indicator" aria-hidden="true"></span>
					      </div>
					 
					    </div>
					 
					  </header>
					 
					  <div class="chart-surface">
					    <div
					      id="peerComparisonChart"
					      class="chart-canvas"
					      data-peer-chart-canvas
					      role="img"
					      aria-label="Chart visualization"
					    ></div>
					  </div>
					  
					  <div class="peer-chart-legend" data-peer-chart-legend></div>
					 
					  
					</section>
	            </div>
	          </div>
	        </div>
	      </div>
	    `;
	  }
	  
	  function bindPeerClose(scope) {
		  const button = scope.querySelector("[data-peer-close]");
		  if (!button) return;
		 
		  button.addEventListener("click", function () {
		    selectedPeerCodes = [];
		    activePeerTab = "table";
		 
		    const result = document.querySelector("[data-peer-result]");
		    const inner = document.querySelector("[data-peer-result-inner]");
		 
		    if (result) {
		      result.classList.remove("is-expanded");
		    }
		 
		    if (inner) {
		      inner.innerHTML = "";
		    }
		  });
		}
	 
	function setLoadingState(companies) {
	    const head = document.querySelector("[data-peer-summary-head]");
	    const body = document.querySelector("[data-peer-summary-body]");
	    const graphBody = document.querySelector("[data-peer-graph-table-body]");
	 
	    if (head) {
	      head.innerHTML = `
	        <tr>
	          <th>Metric</th>
	          <th>Loading...</th>
	        </tr>
	      `;
	    }
	 
	    if (body) {
	      body.innerHTML = `
	        <tr>
	          <td colspan="${companies.length + 2}">
	            Loading...
	          </td>
	        </tr>
	      `;
	    }
	 
	    if (graphBody) {
	      graphBody.innerHTML = `
	        <tr>
	          <td colspan="4">
	            Loading...
	          </td>
	        </tr>
	      `;
	    }
	  }
	 
	  function normalizePeerResponse(response) {
	    if (!response) return [];
	 
	    if (Array.isArray(response)) {
	      return response;
	    }
	 
	    if (Array.isArray(response.data)) {
	      return response.data;
	    }
	 
	    return [];
	  }
	 
	  function bindPeerRemove(scope) {
	    if (!scope) return;
	 
	    const buttons = scope.querySelectorAll("[data-peer-remove]");
	 
	    buttons.forEach(function (button) {
	      button.addEventListener("click", function () {
	        const code = button.dataset.peerRemove;
	 
	        selectedPeerCodes = selectedPeerCodes.filter(function (item) {
	          return String(item) !== String(code);
	        });
	 
	        const remainingCompanies = getSelectedCompaniesFromTemplate();
	        renderPeerResult(remainingCompanies);
	      });
	    });
	  }
	 
	  function initPeerTabs(scope) {
	    const tabs = scope.querySelectorAll("[data-peer-tab]");
	 
	    setPeerActiveTab(scope, activePeerTab);
	 
	    tabs.forEach(function (tab) {
	      tab.addEventListener("click", function (event) {
	        event.preventDefault();
	 
	        activePeerTab = tab.dataset.peerTab;
	        setPeerActiveTab(scope, activePeerTab);
	      });
	    });
	  }
	 
	  function setPeerActiveTab(scope, tabKey) {
	    const tabs = scope.querySelectorAll("[data-peer-tab]");
	    const panels = scope.querySelectorAll("[data-peer-panel]");
	 
	    tabs.forEach(function (item) {
	      const isActive = item.dataset.peerTab === tabKey;
	 
	      item.classList.toggle("is-active", isActive);
	      item.setAttribute("aria-selected", isActive ? "true" : "false");
	    });
	 
	    panels.forEach(function (panel) {
	      const isActive = panel.dataset.peerPanel === tabKey;
	 
	      panel.classList.toggle("is-active", isActive);
	 
	      if (isActive) {
	        panel.removeAttribute("hidden");
	      } else {
	        panel.setAttribute("hidden", "");
	      }
	    });
	  }
	})(window, document, jQuery);
	 
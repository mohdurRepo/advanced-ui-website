<%@ taglib uri="http://java.sun.com/jsp/jstl/core" prefix="c" %>
<c:set
  var="currentPageUniqueName"
  value="${wp.selectionModel.selected.objectID.uniqueName}"
/>

<c:set
  var="isHomePage"
  value="${
        currentPageUniqueName == 'com.tadawul.home'
        or currentPageUniqueName == 'com.tadawul.home.v3'
        or currentPageUniqueName == 'com.tadawul.saudiexchange.home.v3'
    }"
/>

<c:set var="marketOverviewMode" value="${isHomePage ? 'home' : 'inner'}" />

<c:set
  var="marketDetailsMode"
  value="${isHomePage ? 'always' : 'collapsible'}"
/>

<section
  class="market-overview market-overview--${marketOverviewMode}"
  aria-label="Market overview"
  data-market-overview
  data-page-mode="${marketOverviewMode}"
  data-market-details-mode="${marketDetailsMode}"
>
  <!-- =======================================================================
       Market Summary
  ======================================================================== -->

  <section
    class="market-summary"
    aria-labelledby="market-summary-title"
    data-market-summary
  >
    <h2 id="market-summary-title" class="visually-hidden">Market summary</h2>

    <!-- =========================================================================
     Market Summary
============================================================================ -->

    <div class="market-summary__container">
      <!-- =====================================================================
         Market Clock
    ====================================================================== -->

      <section
        class="market-summary__clock"
        aria-label="Saudi Arabia market time"
        data-market-clock
      >
        <!-- Decorative analog clock -->

        <div class="clock-face" aria-hidden="true">
          <div class="clock-ticks" data-clock-ticks></div>

          <div class="clock-brand">
            <span
              class="clock-brand__icon has-icon icon-tadawul"
              aria-hidden="true"
            ></span>
          </div>

          <span
            class="clock-number clock-number--12"
            style="--clock-angle: 0deg"
          >
            12
          </span>

          <span
            class="clock-number clock-number--3"
            style="--clock-angle: 90deg"
          >
            3
          </span>

          <span
            class="clock-number clock-number--6"
            style="--clock-angle: 180deg"
          >
            6
          </span>

          <span
            class="clock-number clock-number--9"
            style="--clock-angle: 270deg"
          >
            9
          </span>

          <span class="clock-hand clock-hand--hour" data-clock-hour-hand></span>

          <span
            class="clock-hand clock-hand--minute"
            data-clock-minute-hand
          ></span>

          <span
            class="clock-hand clock-hand--second"
            data-clock-second-hand
          ></span>

          <span class="clock-center"></span>
        </div>

        <!-- Accessible digital time -->

        <div class="clock-info">
          <div class="clock-info__time-group">
            <div class="market-summary__location">
              <span
                class="market-summary__location-icon has-icon icon-location-pin"
                aria-hidden="true"
              ></span>

              <span
                class="market-summary__location-text"
                data-market-clock-location
              >
                Riyadh, Saudi Arabia
              </span>
            </div>

            <time
              class="market-summary__time"
              data-market-clock-time
              datetime=""
            >
              --:--:--
            </time>
          </div>

          <div class="clock-info__date-group">
            <span class="market-summary__day" data-market-clock-day> — </span>

            <time
              class="market-summary__date"
              data-market-clock-date
              datetime=""
            >
              —
            </time>
          </div>
        </div>
      </section>

      <!-- =====================================================================
         Market Selection
    ====================================================================== -->

      <div class="market-summary__cards-wrap">
        <div
          class="market-summary__cards"
          role="tablist"
          aria-label="Markets"
          aria-orientation="horizontal"
          data-market-tabs
        >
          <!-- ===============================================================
             Main Market
        ================================================================ -->

          <button
            class="market-card is-active"
            id="market-tab-tasi"
            type="button"
            role="tab"
            aria-selected="true"
            aria-controls="market-panel-tasi"
            tabindex="0"
            data-market-card
            data-market="M"
          >
            <span class="market-card__top">
              <span
                class="market-status market-status--open"
                aria-hidden="true"
              ></span>

              <span class="market-card__market"> Main Market </span>
            </span>

            <span class="market-card__body">
              <span class="market-card__main">
                <span class="market-card__title"> TASI </span>

                <span class="market-card__status"> Open </span>
              </span>

              <span class="market-card__divider" aria-hidden="true"></span>

              <span class="market-card__metrics">
                <data class="market-card__value" value="12430.18">
                  12,430.18
                </data>

                <span
                  class="market-card__change market-change market-change--up"
                >
                  +84.22 (+0.68%)
                </span>
              </span>
            </span>

            <time
              class="market-card__timer"
              datetime="PT2H14M32S"
              data-market-countdown
            >
              Closes in 02:14:32
            </time>
          </button>

          <!-- ===============================================================
             Parallel Market
        ================================================================ -->

          <button
            class="market-card"
            id="market-tab-nomu"
            type="button"
            role="tab"
            aria-selected="false"
            aria-controls="market-panel-nomu"
            tabindex="-1"
            data-market-card
            data-market="N"
          >
            <span class="market-card__top">
              <span
                class="market-status market-status--auction"
                aria-hidden="true"
              ></span>

              <span class="market-card__market"> Parallel Market </span>
            </span>

            <span class="market-card__body">
              <span class="market-card__main">
                <span class="market-card__title"> NomuC </span>

                <span class="market-card__status"> Auction </span>
              </span>

              <span class="market-card__divider" aria-hidden="true"></span>

              <span class="market-card__metrics">
                <data class="market-card__value" value="27918.44">
                  27,918.44
                </data>

                <span
                  class="market-card__change market-change market-change--down"
                >
                  −41.10 (−0.15%)
                </span>
              </span>
            </span>

            <time
              class="market-card__timer"
              datetime="PT8M45S"
              data-market-countdown
            >
              Auction ends in 00:08:45
            </time>
          </button>

          <!-- ===============================================================
             Sukuk and Bonds
        ================================================================ -->

          <button
            class="market-card"
            id="market-tab-sukuk"
            type="button"
            role="tab"
            aria-selected="false"
            aria-controls="market-panel-sukuk"
            tabindex="-1"
            data-market-card
            data-market="S"
          >
            <span class="market-card__top">
              <span
                class="market-status market-status--halted"
                aria-hidden="true"
              ></span>

              <span class="market-card__market"> Sukuk &amp; Bonds </span>
            </span>

            <span class="market-card__body">
              <span class="market-card__main">
                <span class="market-card__title"> Sukuk </span>

                <span class="market-card__status"> Halted </span>
              </span>

              <span class="market-card__divider" aria-hidden="true"></span>

              <span class="market-card__metrics">
                <data class="market-card__value" value="982.34"> 982.34 </data>

                <span
                  class="market-card__change market-change market-change--neutral"
                >
                  0.00 (0.00%)
                </span>
              </span>
            </span>

            <span class="market-card__timer" data-market-countdown>
              Awaiting update
            </span>
          </button>

          <!-- ===============================================================
             Funds
        ================================================================ -->

          <button
            class="market-card"
            id="market-tab-funds"
            type="button"
            role="tab"
            aria-selected="false"
            aria-controls="market-panel-funds"
            tabindex="-1"
            data-market-card
            data-market="F"
          >
            <span class="market-card__top">
              <span
                class="market-status market-status--closed"
                aria-hidden="true"
              ></span>

              <span class="market-card__market"> Funds </span>
            </span>

            <span class="market-card__body">
              <span class="market-card__main">
                <span class="market-card__title"> Funds </span>

                <span class="market-card__status"> Closed </span>
              </span>

              <span class="market-card__divider" aria-hidden="true"></span>

              <span class="market-card__metrics">
                <data class="market-card__value" value="1204.76">
                  1,204.76
                </data>

                <span
                  class="market-card__change market-change market-change--up"
                >
                  +3.20 (+0.27%)
                </span>
              </span>
            </span>

            <span class="market-card__timer" data-market-countdown>
              Opens tomorrow
            </span>
          </button>

          <!-- ===============================================================
             Derivatives
        ================================================================ -->

          <button
            class="market-card market-card--compact"
            id="market-tab-derivatives"
            type="button"
            role="tab"
            aria-selected="false"
            aria-controls="market-panel-derivatives"
            tabindex="-1"
            data-market-card
            data-market="D"
          >
            <span class="market-card__top">
              <span
                class="market-status market-status--pre-open"
                aria-hidden="true"
              ></span>

              <span class="market-card__market"> Derivatives </span>
            </span>

            <span class="market-card__body">
              <span class="market-card__main">
                <span class="market-card__title"> MT30 </span>

                <span class="market-card__status"> Pre-open </span>
              </span>
            </span>

            <time
              class="market-card__timer"
              datetime="PT22M10S"
              data-market-countdown
            >
              Opens in 00:22:10
            </time>
          </button>
        </div>

        <!-- =================================================================
           Return to Selected Market
      ================================================================== -->

        <button
          class="market-summary__selected-market tooltip-context"
          type="button"
          data-selected-market
          data-tooltip="Return to selected market"
          data-tooltip-placement="top"
          aria-label="Return to selected market"
          hidden
        >
          <span
            class="market-summary__selected-market-icon has-icon icon-chart-line"
            aria-hidden="true"
          ></span>

          <strong
            class="market-summary__selected-market-name"
            data-selected-market-name
          >
            TASI
          </strong>
        </button>
      </div>
    </div>
  </section>

  <!-- =======================================================================
       Market Details Disclosure
  ======================================================================== -->

  <details
    class="market-overview__disclosure"
    data-market-details-disclosure
    <c:if test="${isHomePage}">open</c:if>
>
    <!-- =====================================================================
         Native Disclosure Control
    ====================================================================== -->

    <summary
    class="market-overview__summary"
    data-market-overview-toggle
    aria-expanded="${isHomePage ? 'true' : 'false'}"
    <c:if test="${isHomePage}">hidden</c:if>
>
      <span
        class="market-overview__summary-icon has-icon icon-chevron-up"
        aria-hidden="true"
      ></span>

      <span class="visually-hidden" data-market-overview-toggle-label>
        Hide market details
      </span>
    </summary>

    <!-- =====================================================================
         Disclosure Content
    ====================================================================== -->

    <div
    class="market-overview__details-content"
    data-market-overview-details
    aria-hidden="${isHomePage ? 'false' : 'true'}"
>
      <!-- ===================================================================
           Market Bridge
      ==================================================================== -->

      <div class="market-bridge" aria-hidden="true" data-market-bridge>
        <div class="market-bridge__inner">
          <div class="market-bridge__bar" data-market-bridge-bar></div>
        </div>
      </div>

      <!-- ===================================================================
           Market Details
      ==================================================================== -->

      <section class="market-details" aria-labelledby="market-details-title">
        <h2 id="market-details-title" class="visually-hidden">
          Market details
        </h2>

        <div class="container market-details__container">
          <!-- =========================================================================
     Main Market — TASI
============================================================================ -->

          <section
  class="market-details-panel market-details-panel--overview is-active"
  id="market-panel-tasi"
  role="tabpanel"
  aria-labelledby="market-tab-tasi"
  aria-hidden="false"
  data-market-detail-panel
  data-market="M"
>
            <div class="market-details-panel__grid">
              <!-- =====================================================================
         Chart
    ====================================================================== -->

              <div class="market-details-panel__main">
                <div
                  class="market-details-panel__chart market-chart"
                  id="tasi-chart"
                  data-chart-id="tasi"
                  role="img"
                  aria-label="TASI market performance chart"
                ></div>
              </div>

              <!-- =====================================================================
         Mobile Summary
    ====================================================================== -->

              <div
                class="market-details-panel__mobile-summary"
                aria-label="TASI trading summary"
              >
                <div class="market-details-panel__mobile-metric">
                  <span class="market-details-panel__mobile-metric-label">
                    <span
                      class="market-details-panel__mobile-metric-icon has-icon icon-riyal"
                      aria-hidden="true"
                    ></span>

                    <span>Value traded</span>
                  </span>

                  <data
                    class="market-details-panel__mobile-metric-value"
                    value="1830365570.67"
                  >
                    1,830,365,570.67
                  </data>
                </div>

                <div class="market-details-panel__mobile-metric">
                  <span class="market-details-panel__mobile-metric-label">
                    Volume traded
                  </span>

                  <data
                    class="market-details-panel__mobile-metric-value"
                    value="74704803"
                  >
                    74,704,803
                  </data>
                </div>
              </div>

              <!-- =====================================================================
         Internal Mobile Disclosure
    ====================================================================== -->

              <div class="market-details-panel__toggle-wrap">
                <button
                  class="market-details-panel__toggle btn btn-outline-primary btn-sm has-icon icon-chevron-down icon-end"
                  type="button"
                  data-market-details-toggle
                  aria-expanded="false"
                  aria-controls="tasi-market-details"
                >
                  <span data-market-details-toggle-text>
                    Show market details
                  </span>
                </button>
              </div>

              <!-- =====================================================================
         Collapsible Details
    ====================================================================== -->

              <div
  class="market-details-panel__collapsible"
  id="tasi-market-details"
  data-market-details-collapsible
  aria-hidden="false"
>
                <!-- ===================================================================
           Market Movers
      ==================================================================== -->

                <div class="market-details-panel__insights">
                  <div class="market-movers" data-market-movers>
                    <div
                      class="market-movers__tabs"
                      role="tablist"
                      aria-label="TASI market movers"
                      aria-orientation="horizontal"
                    >
                      <button
                        class="market-movers__tab is-active"
                        id="tasi-tab-gainers"
                        type="button"
                        role="tab"
                        aria-selected="true"
                        aria-controls="tasi-gainers"
                        tabindex="0"
                        data-market-movers-tab
                      >
                        Gainers
                      </button>

                      <button
                        class="market-movers__tab"
                        id="tasi-tab-losers"
                        type="button"
                        role="tab"
                        aria-selected="false"
                        aria-controls="tasi-losers"
                        tabindex="-1"
                        data-market-movers-tab
                      >
                        Losers
                      </button>

                      <button
                        class="market-movers__tab"
                        id="tasi-tab-volume"
                        type="button"
                        role="tab"
                        aria-selected="false"
                        aria-controls="tasi-volume"
                        tabindex="-1"
                        data-market-movers-tab
                      >
                        Volume
                      </button>

                      <button
                        class="market-movers__tab"
                        id="tasi-tab-value"
                        type="button"
                        role="tab"
                        aria-selected="false"
                        aria-controls="tasi-value"
                        tabindex="-1"
                        data-market-movers-tab
                      >
                        Value
                      </button>
                    </div>

                    <!-- ===============================================================
               Gainers
          ================================================================ -->

                    <div
                      class="market-movers__panel is-active"
                      id="tasi-gainers"
                      role="tabpanel"
                      aria-labelledby="tasi-tab-gainers"
                      
                      data-market-movers-panel
                    >
                      <ul class="market-movers__list">
                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>MARAFIQ</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--success"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market">
                              Main Market
                            </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="49.40">
                              49.40
                            </data>

                            <span
                              class="market-movers__change market-change market-change--up"
                            >
                              <span
                                class="market-change__icon has-icon icon-arrow-up"
                                aria-hidden="true"
                              ></span>

                              <span>3.10 (6.70%)</span>
                            </span>
                          </div>
                        </li>

                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>SHL</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--warning"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market">
                              Main Market
                            </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="17.32">
                              17.32
                            </data>

                            <span
                              class="market-movers__change market-change market-change--up"
                            >
                              <span
                                class="market-change__icon has-icon icon-arrow-up"
                                aria-hidden="true"
                              ></span>

                              <span>0.66 (3.96%)</span>
                            </span>
                          </div>
                        </li>

                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>ADVANCED</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--caution"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market">
                              Main Market
                            </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="26.75">
                              26.75
                            </data>

                            <span
                              class="market-movers__change market-change market-change--up"
                            >
                              <span
                                class="market-change__icon has-icon icon-arrow-up"
                                aria-hidden="true"
                              ></span>

                              <span>0.75 (2.88%)</span>
                            </span>
                          </div>
                        </li>
                      </ul>
                    </div>

                    <!-- ===============================================================
               Losers
          ================================================================ -->

                    <div
                      class="market-movers__panel"
                      id="tasi-losers"
                      role="tabpanel"
                      aria-labelledby="tasi-tab-losers"
                      aria-hidden="true"
                      data-market-movers-panel
                      hidden
                    >
                      <ul class="market-movers__list">
                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>ALUJAIN</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--danger"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market">
                              Main Market
                            </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="41.15">
                              41.15
                            </data>

                            <span
                              class="market-movers__change market-change market-change--down"
                            >
                              <span
                                class="market-change__icon has-icon icon-arrow-down"
                                aria-hidden="true"
                              ></span>

                              <span>−2.10 (−4.86%)</span>
                            </span>
                          </div>
                        </li>

                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>SAUDI CABLE</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--warning"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market">
                              Main Market
                            </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="83.20">
                              83.20
                            </data>

                            <span
                              class="market-movers__change market-change market-change--down"
                            >
                              <span
                                class="market-change__icon has-icon icon-arrow-down"
                                aria-hidden="true"
                              ></span>

                              <span>−3.20 (−3.70%)</span>
                            </span>
                          </div>
                        </li>
                      </ul>
                    </div>

                    <!-- ===============================================================
               Most Active by Volume
          ================================================================ -->

                    <div
                      class="market-movers__panel"
                      id="tasi-volume"
                      role="tabpanel"
                      aria-labelledby="tasi-tab-volume"
                      aria-hidden="true"
                      data-market-movers-panel
                      hidden
                    >
                      <ul class="market-movers__list">
                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>ARAMCO</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--success"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market">
                              Main Market
                            </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="28.90">
                              28.90
                            </data>

                            <data
                              class="market-movers__change"
                              value="18450000"
                            >
                              18,450,000
                            </data>
                          </div>
                        </li>

                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>AL RAJHI</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--caution"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market">
                              Main Market
                            </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="96.10">
                              96.10
                            </data>

                            <data
                              class="market-movers__change"
                              value="12320000"
                            >
                              12,320,000
                            </data>
                          </div>
                        </li>
                      </ul>
                    </div>

                    <!-- ===============================================================
               Most Active by Value
          ================================================================ -->

                    <div
                      class="market-movers__panel"
                      id="tasi-value"
                      role="tabpanel"
                      aria-labelledby="tasi-tab-value"
                      aria-hidden="true"
                      data-market-movers-panel
                      hidden
                    >
                      <ul class="market-movers__list">
                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>SABIC</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--warning"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market">
                              Main Market
                            </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="74.80">
                              74.80
                            </data>

                            <span class="market-movers__change">
                              <span
                                class="market-change__icon has-icon icon-riyal"
                                aria-hidden="true"
                              ></span>

                              <span>420.5M</span>
                            </span>
                          </div>
                        </li>

                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>SNB</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--danger"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market">
                              Main Market
                            </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="37.20">
                              37.20
                            </data>

                            <span class="market-movers__change">
                              <span
                                class="market-change__icon has-icon icon-riyal"
                                aria-hidden="true"
                              ></span>

                              <span>385.2M</span>
                            </span>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <!-- ===================================================================
           Market Statistics
      ==================================================================== -->

                <div class="market-details-panel__stats">
                  <dl class="market-stats">
                    <div
                      class="market-stats__item market-stats__item--mobile-summary"
                    >
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Value traded
                        </span>

                        <span
                          class="market-stats__icon has-icon icon-riyal"
                          aria-hidden="true"
                        ></span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="1830365570.67"> 1,830,365,570.67 </data>
                      </dd>
                    </div>

                    <div
                      class="market-stats__item market-stats__item--mobile-summary"
                    >
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Volume traded
                        </span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="74704803"> 74,704,803 </data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Market capitalization
                        </span>

                        <span
                          class="market-stats__icon has-icon icon-riyal"
                          aria-hidden="true"
                        ></span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="9205843.73"> 9,205,843.73 </data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Listed symbols
                        </span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="254">254</data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label market-stats__label--down">
                        <span class="market-stats__label-text">
                          Symbols down
                        </span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="41">41</data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label market-stats__label--up">
                        <span class="market-stats__label-text">
                          Symbols up
                        </span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="202">202</data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Daily index change
                        </span>
                      </dt>

                      <dd
                        class="market-stats__value market-change market-change--up"
                      >
                        <span
                          class="market-change__icon has-icon icon-arrow-up"
                          aria-hidden="true"
                        ></span>

                        <data value="125.42">125.42</data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Change percentage
                        </span>
                      </dt>

                      <dd
                        class="market-stats__value market-change market-change--up"
                      >
                        <span
                          class="market-change__icon has-icon icon-arrow-up"
                          aria-hidden="true"
                        ></span>

                        <data value="1.14">1.14%</data>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </section>

          <!-- =========================================================================
     Parallel Market — Nomu
============================================================================ -->

          <section
            class="market-details-panel market-details-panel--overview"
            id="market-panel-nomu"
            role="tabpanel"
            aria-labelledby="market-tab-nomu"
            aria-hidden="true"
            data-market-detail-panel
            data-market="N"
            hidden
          >
            <div class="market-details-panel__grid">
              <!-- =====================================================================
         Chart
    ====================================================================== -->

              <div class="market-details-panel__main">
                <div
                  class="market-details-panel__chart market-chart"
                  id="nomu-chart"
                  data-chart-id="nomu"
                  role="img"
                  aria-label="Nomu Parallel Market performance chart"
                ></div>
              </div>

              <!-- =====================================================================
         Mobile Summary
    ====================================================================== -->

              <div
                class="market-details-panel__mobile-summary"
                aria-label="Nomu trading summary"
              >
                <div class="market-details-panel__mobile-metric">
                  <span class="market-details-panel__mobile-metric-label">
                    <span
                      class="market-details-panel__mobile-metric-icon has-icon icon-riyal"
                      aria-hidden="true"
                    ></span>

                    <span>Value traded</span>
                  </span>

                  <data
                    class="market-details-panel__mobile-metric-value"
                    value="1600000000"
                  >
                    1,600,000,000.00
                  </data>
                </div>

                <div class="market-details-panel__mobile-metric">
                  <span class="market-details-panel__mobile-metric-label">
                    Volume traded
                  </span>

                  <data
                    class="market-details-panel__mobile-metric-value"
                    value="88000000"
                  >
                    88,000,000
                  </data>
                </div>
              </div>

              <!-- =====================================================================
         Internal Mobile Disclosure
    ====================================================================== -->

              <div class="market-details-panel__toggle-wrap">
                <button
                  class="market-details-panel__toggle btn btn-outline-primary btn-sm has-icon icon-chevron-down icon-end"
                  type="button"
                  data-market-details-toggle
                  aria-expanded="false"
                  aria-controls="nomu-market-details"
                >
                  <span data-market-details-toggle-text>
                    Show market details
                  </span>
                </button>
              </div>

              <!-- =====================================================================
         Collapsible Details
    ====================================================================== -->

              <div
                class="market-details-panel__collapsible"
                id="nomu-market-details"
                data-market-details-collapsible
                aria-hidden="false"
              >
                <!-- ===================================================================
           Market Movers
      ==================================================================== -->

                <div class="market-details-panel__insights">
                  <div class="market-movers" data-market-movers>
                    <div
                      class="market-movers__tabs"
                      role="tablist"
                      aria-label="Nomu market movers"
                      aria-orientation="horizontal"
                    >
                      <button
                        class="market-movers__tab is-active"
                        id="nomu-tab-gainers"
                        type="button"
                        role="tab"
                        aria-selected="true"
                        aria-controls="nomu-gainers"
                        tabindex="0"
                        data-market-movers-tab
                      >
                        Gainers
                      </button>

                      <button
                        class="market-movers__tab"
                        id="nomu-tab-losers"
                        type="button"
                        role="tab"
                        aria-selected="false"
                        aria-controls="nomu-losers"
                        tabindex="-1"
                        data-market-movers-tab
                      >
                        Losers
                      </button>

                      <button
                        class="market-movers__tab"
                        id="nomu-tab-volume"
                        type="button"
                        role="tab"
                        aria-selected="false"
                        aria-controls="nomu-volume"
                        tabindex="-1"
                        data-market-movers-tab
                      >
                        Volume
                      </button>

                      <button
                        class="market-movers__tab"
                        id="nomu-tab-value"
                        type="button"
                        role="tab"
                        aria-selected="false"
                        aria-controls="nomu-value"
                        tabindex="-1"
                        data-market-movers-tab
                      >
                        Value
                      </button>
                    </div>

                    <!-- ===============================================================
               Gainers
          ================================================================ -->

                    <div
                      class="market-movers__panel is-active"
                      id="nomu-gainers"
                      role="tabpanel"
                      aria-labelledby="nomu-tab-gainers"
                      aria-hidden="false"
                      data-market-movers-panel
                    >
                      <ul class="market-movers__list">
                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>NABA ALSAHA</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--success"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market"> Nomu </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="42.10">
                              42.10
                            </data>

                            <span
                              class="market-movers__change market-change market-change--up"
                            >
                              <span
                                class="market-change__icon has-icon icon-arrow-up"
                                aria-hidden="true"
                              ></span>

                              <span>1.20 (2.93%)</span>
                            </span>
                          </div>
                        </li>

                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>ALWASAIL</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--warning"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market"> Nomu </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="18.70">
                              18.70
                            </data>

                            <span
                              class="market-movers__change market-change market-change--up"
                            >
                              <span
                                class="market-change__icon has-icon icon-arrow-up"
                                aria-hidden="true"
                              ></span>

                              <span>0.55 (3.03%)</span>
                            </span>
                          </div>
                        </li>
                      </ul>
                    </div>

                    <!-- ===============================================================
               Losers
          ================================================================ -->

                    <div
                      class="market-movers__panel"
                      id="nomu-losers"
                      role="tabpanel"
                      aria-labelledby="nomu-tab-losers"
                      aria-hidden="true"
                      data-market-movers-panel
                      hidden
                    >
                      <ul class="market-movers__list">
                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>VIEW UNITED</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--danger"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market"> Nomu </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="63.00">
                              63.00
                            </data>

                            <span
                              class="market-movers__change market-change market-change--down"
                            >
                              <span
                                class="market-change__icon has-icon icon-arrow-down"
                                aria-hidden="true"
                              ></span>

                              <span>−2.40 (−3.67%)</span>
                            </span>
                          </div>
                        </li>

                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>MULKIA</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--warning"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market"> Nomu </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="31.80">
                              31.80
                            </data>

                            <span
                              class="market-movers__change market-change market-change--down"
                            >
                              <span
                                class="market-change__icon has-icon icon-arrow-down"
                                aria-hidden="true"
                              ></span>

                              <span>−1.05 (−3.20%)</span>
                            </span>
                          </div>
                        </li>
                      </ul>
                    </div>

                    <!-- ===============================================================
               Most Active by Volume
          ================================================================ -->

                    <div
                      class="market-movers__panel"
                      id="nomu-volume"
                      role="tabpanel"
                      aria-labelledby="nomu-tab-volume"
                      aria-hidden="true"
                      data-market-movers-panel
                      hidden
                    >
                      <ul class="market-movers__list">
                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>LEEN ALKHAIR</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--caution"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market"> Nomu </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="21.50">
                              21.50
                            </data>

                            <data class="market-movers__change" value="2450000">
                              2,450,000
                            </data>
                          </div>
                        </li>
                      </ul>
                    </div>

                    <!-- ===============================================================
               Most Active by Value
          ================================================================ -->

                    <div
                      class="market-movers__panel"
                      id="nomu-value"
                      role="tabpanel"
                      aria-labelledby="nomu-tab-value"
                      aria-hidden="true"
                      data-market-movers-panel
                      hidden
                    >
                      <ul class="market-movers__list">
                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>SUMOU</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--warning"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market"> Nomu </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="44.60">
                              44.60
                            </data>

                            <span class="market-movers__change">
                              <span
                                class="market-change__icon has-icon icon-riyal"
                                aria-hidden="true"
                              ></span>

                              <span>92.7M</span>
                            </span>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <!-- ===================================================================
           Market Statistics
      ==================================================================== -->

                <div class="market-details-panel__stats">
                  <dl class="market-stats">
                    <div
                      class="market-stats__item market-stats__item--mobile-summary"
                    >
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Value traded
                        </span>

                        <span
                          class="market-stats__icon has-icon icon-riyal"
                          aria-hidden="true"
                        ></span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="1600000000"> 1,600,000,000.00 </data>
                      </dd>
                    </div>

                    <div
                      class="market-stats__item market-stats__item--mobile-summary"
                    >
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Volume traded
                        </span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="88000000"> 88,000,000 </data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Market capitalization
                        </span>

                        <span
                          class="market-stats__icon has-icon icon-riyal"
                          aria-hidden="true"
                        ></span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="4200000"> 4,200,000.00 </data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Listed symbols
                        </span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="120">120</data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label market-stats__label--down">
                        <span class="market-stats__label-text">
                          Symbols down
                        </span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="30">30</data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label market-stats__label--up">
                        <span class="market-stats__label-text">
                          Symbols up
                        </span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="75">75</data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Daily index change
                        </span>
                      </dt>

                      <dd
                        class="market-stats__value market-change market-change--down"
                      >
                        <span
                          class="market-change__icon has-icon icon-arrow-down"
                          aria-hidden="true"
                        ></span>

                        <data value="-42.35">−42.35</data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Change percentage
                        </span>
                      </dt>

                      <dd
                        class="market-stats__value market-change market-change--down"
                      >
                        <span
                          class="market-change__icon has-icon icon-arrow-down"
                          aria-hidden="true"
                        ></span>

                        <data value="-0.48">−0.48%</data>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </section>

          <!-- =========================================================================
     Sukuk & Bonds Details
============================================================================ -->

          <section
            class="market-details-panel market-details-panel--overview"
            id="market-panel-sukuk"
            role="tabpanel"
            aria-labelledby="market-tab-sukuk"
            aria-hidden="true"
            data-market-detail-panel
            data-market="S"
            hidden
          >
            <div class="market-details-panel__grid">
              <!-- =====================================================================
         Market Chart
    ====================================================================== -->

              <div class="market-details-panel__main">
                <div
                  class="market-details-panel__chart market-chart"
                  id="sukuk-chart"
                  data-chart-id="sukuk"
                  role="img"
                  aria-label="Sukuk and Bonds market chart"
                ></div>
              </div>

              <!-- =====================================================================
         Mobile Market Summary
    ====================================================================== -->

              <div
                class="market-details-panel__mobile-summary"
                aria-label="Sukuk and Bonds trading summary"
              >
                <div class="market-details-panel__mobile-metric">
                  <span class="market-details-panel__mobile-metric-label">
                    <span
                      class="has-icon icon-riyal market-details-panel__mobile-metric-icon"
                      aria-hidden="true"
                    ></span>

                    <span>Value Traded</span>
                  </span>

                  <data
                    class="market-details-panel__mobile-metric-value"
                    value="1600000000"
                  >
                    1,600,000,000.00
                  </data>
                </div>

                <div class="market-details-panel__mobile-metric">
                  <span class="market-details-panel__mobile-metric-label">
                    Volume Traded
                  </span>

                  <data
                    class="market-details-panel__mobile-metric-value"
                    value="88000000"
                  >
                    88,000,000
                  </data>
                </div>
              </div>

              <!-- =====================================================================
         Mobile Details Toggle
    ====================================================================== -->

              <div class="market-details-panel__toggle-wrap">
                <button
                  class="market-details-panel__toggle btn btn-outline-primary btn-sm has-icon icon-chevron-down icon-end"
                  type="button"
                  data-market-details-toggle
                  aria-expanded="false"
                  aria-controls="sukuk-market-details"
                >
                  <span data-market-details-toggle-text>
                    Show market details
                  </span>
                </button>
              </div>

              <!-- =====================================================================
         Collapsible Market Details
    ====================================================================== -->

              <div
                class="market-details-panel__collapsible"
                id="sukuk-market-details"
                data-market-details-collapsible
                aria-hidden="false"
              >
                <!-- ===================================================================
           Market Movers
      ==================================================================== -->

                <div class="market-details-panel__insights">
                  <div class="market-movers" data-market-movers>
                    <!-- Movers Navigation -->

                    <div
                      class="market-movers__tabs"
                      role="tablist"
                      aria-label="Sukuk and Bonds market movers"
                      aria-orientation="horizontal"
                    >
                      <button
                        class="market-movers__tab is-active"
                        id="sukuk-tab-gainers"
                        type="button"
                        role="tab"
                        aria-selected="true"
                        aria-controls="sukuk-gainers"
                        tabindex="0"
                        data-market-movers-tab
                      >
                        Gainers
                      </button>

                      <button
                        class="market-movers__tab"
                        id="sukuk-tab-losers"
                        type="button"
                        role="tab"
                        aria-selected="false"
                        aria-controls="sukuk-losers"
                        tabindex="-1"
                        data-market-movers-tab
                      >
                        Losers
                      </button>

                      <button
                        class="market-movers__tab"
                        id="sukuk-tab-volume"
                        type="button"
                        role="tab"
                        aria-selected="false"
                        aria-controls="sukuk-volume"
                        tabindex="-1"
                        data-market-movers-tab
                      >
                        Volume
                      </button>

                      <button
                        class="market-movers__tab"
                        id="sukuk-tab-value"
                        type="button"
                        role="tab"
                        aria-selected="false"
                        aria-controls="sukuk-value"
                        tabindex="-1"
                        data-market-movers-tab
                      >
                        Value
                      </button>
                    </div>

                    <!-- ===============================================================
               Gainers
          ================================================================ -->

                    <div
                      class="market-movers__panel is-active"
                      id="sukuk-gainers"
                      role="tabpanel"
                      aria-labelledby="sukuk-tab-gainers"
                      aria-hidden="false"
                      data-market-movers-panel
                    >
                      <ul class="market-movers__list" role="list">
                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>Saudi Sukuk 2030</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--success"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market"> Bond </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="101.32">
                              101.32
                            </data>

                            <data
                              class="market-movers__change market-change market-change--up"
                              value="0.12"
                            >
                              <span
                                class="has-icon icon-arrow-up market-change__icon"
                                aria-hidden="true"
                              ></span>

                              <span>0.12%</span>
                            </data>
                          </div>
                        </li>

                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>KSA Bond 2029</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--caution"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market"> Bond </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="99.84">
                              99.84
                            </data>

                            <data
                              class="market-movers__change market-change market-change--up"
                              value="0.08"
                            >
                              <span
                                class="has-icon icon-arrow-up market-change__icon"
                                aria-hidden="true"
                              ></span>

                              <span>0.08%</span>
                            </data>
                          </div>
                        </li>
                      </ul>
                    </div>

                    <!-- ===============================================================
               Losers
          ================================================================ -->

                    <div
                      class="market-movers__panel"
                      id="sukuk-losers"
                      role="tabpanel"
                      aria-labelledby="sukuk-tab-losers"
                      aria-hidden="true"
                      data-market-movers-panel
                      hidden
                    >
                      <ul class="market-movers__list" role="list">
                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>Sukuk 2028</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--danger"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market"> Sukuk </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="97.45">
                              97.45
                            </data>

                            <data
                              class="market-movers__change market-change market-change--down"
                              value="-0.22"
                            >
                              <span
                                class="has-icon icon-arrow-down market-change__icon"
                                aria-hidden="true"
                              ></span>

                              <span>−0.22%</span>
                            </data>
                          </div>
                        </li>

                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>Government Bond 2032</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--warning"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market"> Bond </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="103.10">
                              103.10
                            </data>

                            <data
                              class="market-movers__change market-change market-change--down"
                              value="-0.14"
                            >
                              <span
                                class="has-icon icon-arrow-down market-change__icon"
                                aria-hidden="true"
                              ></span>

                              <span>−0.14%</span>
                            </data>
                          </div>
                        </li>
                      </ul>
                    </div>

                    <!-- ===============================================================
               Most Active by Volume
          ================================================================ -->

                    <div
                      class="market-movers__panel"
                      id="sukuk-volume"
                      role="tabpanel"
                      aria-labelledby="sukuk-tab-volume"
                      aria-hidden="true"
                      data-market-movers-panel
                      hidden
                    >
                      <ul class="market-movers__list" role="list">
                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>Saudi Sukuk 2030</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--success"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market"> Bond </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="101.32">
                              101.32
                            </data>

                            <data class="market-movers__change" value="2840000">
                              2,840,000
                            </data>
                          </div>
                        </li>
                      </ul>
                    </div>

                    <!-- ===============================================================
               Most Active by Value
          ================================================================ -->

                    <div
                      class="market-movers__panel"
                      id="sukuk-value"
                      role="tabpanel"
                      aria-labelledby="sukuk-tab-value"
                      aria-hidden="true"
                      data-market-movers-panel
                      hidden
                    >
                      <ul class="market-movers__list" role="list">
                        <li class="market-movers__row">
                          <div class="market-movers__info">
                            <a class="market-movers__name" href="#">
                              <span>KSA Bond 2029</span>

                              <span
                                class="market-movers__indicator market-movers__indicator--caution"
                                aria-hidden="true"
                              ></span>
                            </a>

                            <span class="market-movers__market"> Bond </span>
                          </div>

                          <div class="market-movers__numbers">
                            <data class="market-movers__price" value="99.84">
                              99.84
                            </data>

                            <data
                              class="market-movers__change"
                              value="185600000"
                            >
                              <span
                                class="has-icon icon-riyal market-change__icon"
                                aria-hidden="true"
                              ></span>

                              <span>185.6M</span>
                            </data>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <!-- ===================================================================
           Market Statistics
      ==================================================================== -->

                <div class="market-details-panel__stats">
                  <dl class="market-stats">
                    <div
                      class="market-stats__item market-stats__item--mobile-summary"
                    >
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Value Traded
                        </span>

                        <span
                          class="has-icon icon-riyal market-stats__icon"
                          aria-hidden="true"
                        ></span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="1600000000"> 1,600,000,000.00 </data>
                      </dd>
                    </div>

                    <div
                      class="market-stats__item market-stats__item--mobile-summary"
                    >
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Volume Traded
                        </span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="88000000"> 88,000,000 </data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Market Cap
                        </span>

                        <span
                          class="has-icon icon-riyal market-stats__icon"
                          aria-hidden="true"
                        ></span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="3850000"> 3,850,000.00 </data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Issues Listed
                        </span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="150"> 150 </data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label market-stats__label--down">
                        <span class="market-stats__label-text">
                          Issues Down
                        </span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="20"> 20 </data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label market-stats__label--up">
                        <span class="market-stats__label-text">
                          Issues Up
                        </span>
                      </dt>

                      <dd class="market-stats__value">
                        <data value="90"> 90 </data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Daily Index Change
                        </span>
                      </dt>

                      <dd
                        class="market-stats__value market-change market-change--up"
                      >
                        <span
                          class="has-icon icon-arrow-up market-change__icon"
                          aria-hidden="true"
                        ></span>

                        <data value="7.84"> 7.84 </data>
                      </dd>
                    </div>

                    <div class="market-stats__item">
                      <dt class="market-stats__label">
                        <span class="market-stats__label-text">
                          Change Percentage
                        </span>
                      </dt>

                      <dd
                        class="market-stats__value market-change market-change--up"
                      >
                        <span
                          class="has-icon icon-arrow-up market-change__icon"
                          aria-hidden="true"
                        ></span>

                        <data value="0.18"> 0.18% </data>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </section>

          <!-- =========================================================================
     Funds Details
============================================================================ -->

          <section
            class="market-details-panel"
            id="market-panel-funds"
            role="tabpanel"
            aria-labelledby="market-tab-funds"
            aria-hidden="true"
            data-market-detail-panel
            data-market="F"
            hidden
          >
            <!-- =======================================================================
       Fund Category Navigation
  ======================================================================== -->

            <div class="market-views">
              <div
                class="market-views__list"
                role="tablist"
                aria-label="Fund categories"
                aria-orientation="horizontal"
              >
                <button
                  class="market-views__tab is-active"
                  id="funds-tab-reits"
                  type="button"
                  role="tab"
                  aria-selected="true"
                  aria-controls="funds-reits"
                  tabindex="0"
                  data-market-view-tab
                >
                  REITs
                </button>

                <button
                  class="market-views__tab"
                  id="funds-tab-etfs"
                  type="button"
                  role="tab"
                  aria-selected="false"
                  aria-controls="funds-etfs"
                  tabindex="-1"
                  data-market-view-tab
                >
                  ETFs
                </button>

                <button
                  class="market-views__tab"
                  id="funds-tab-cefs"
                  type="button"
                  role="tab"
                  aria-selected="false"
                  aria-controls="funds-cefs"
                  tabindex="-1"
                  data-market-view-tab
                >
                  CEFs
                </button>
              </div>
            </div>

            <!-- =========================================================================
       REITs View
  ========================================================================== -->

            <div
              class="market-view-panel market-details-panel--overview is-active"
              id="funds-reits"
              role="tabpanel"
              aria-labelledby="funds-tab-reits"
              aria-hidden="false"
              data-market-view-panel
            >
              <div class="market-details-panel__grid">
                <!-- REITs Chart -->

                <div class="market-details-panel__main">
                  <div
                    class="market-details-panel__chart market-chart"
                    id="reits-chart"
                    data-chart-id="reits"
                    role="img"
                    aria-label="REITs market chart"
                  ></div>
                </div>

                <!-- REITs Mobile Summary -->

                <div
                  class="market-details-panel__mobile-summary"
                  aria-label="REITs trading summary"
                >
                  <div class="market-details-panel__mobile-metric">
                    <span class="market-details-panel__mobile-metric-label">
                      <span
                        class="has-icon icon-riyal market-details-panel__mobile-metric-icon"
                        aria-hidden="true"
                      ></span>

                      <span>Value Traded</span>
                    </span>

                    <data
                      class="market-details-panel__mobile-metric-value"
                      value="1100000000"
                    >
                      1,100,000,000.00
                    </data>
                  </div>

                  <div class="market-details-panel__mobile-metric">
                    <span class="market-details-panel__mobile-metric-label">
                      Volume Traded
                    </span>

                    <data
                      class="market-details-panel__mobile-metric-value"
                      value="65000000"
                    >
                      65,000,000
                    </data>
                  </div>
                </div>

                <!-- REITs Mobile Toggle -->

                <div class="market-details-panel__toggle-wrap">
                  <button
                    class="market-details-panel__toggle btn btn-outline-primary btn-sm has-icon icon-chevron-down icon-end"
                    type="button"
                    data-market-details-toggle
                    aria-expanded="false"
                    aria-controls="reits-market-details"
                  >
                    <span data-market-details-toggle-text>
                      Show market details
                    </span>
                  </button>
                </div>

                <!-- REITs Collapsible Details -->

                <div
                  class="market-details-panel__collapsible"
                  id="reits-market-details"
                  data-market-details-collapsible
                  aria-hidden="false"
                >
                  <!-- REITs Movers -->

                  <div class="market-details-panel__insights">
                    <div class="market-movers" data-market-movers>
                      <div
                        class="market-movers__tabs"
                        role="tablist"
                        aria-label="REITs market movers"
                        aria-orientation="horizontal"
                      >
                        <button
                          class="market-movers__tab is-active"
                          id="reits-tab-gainers"
                          type="button"
                          role="tab"
                          aria-selected="true"
                          aria-controls="reits-gainers"
                          tabindex="0"
                          data-market-movers-tab
                        >
                          Gainers
                        </button>

                        <button
                          class="market-movers__tab"
                          id="reits-tab-losers"
                          type="button"
                          role="tab"
                          aria-selected="false"
                          aria-controls="reits-losers"
                          tabindex="-1"
                          data-market-movers-tab
                        >
                          Losers
                        </button>

                        <button
                          class="market-movers__tab"
                          id="reits-tab-volume"
                          type="button"
                          role="tab"
                          aria-selected="false"
                          aria-controls="reits-volume"
                          tabindex="-1"
                          data-market-movers-tab
                        >
                          Volume
                        </button>

                        <button
                          class="market-movers__tab"
                          id="reits-tab-value"
                          type="button"
                          role="tab"
                          aria-selected="false"
                          aria-controls="reits-value"
                          tabindex="-1"
                          data-market-movers-tab
                        >
                          Value
                        </button>
                      </div>

                      <!-- REITs Gainers -->

                      <div
                        class="market-movers__panel is-active"
                        id="reits-gainers"
                        role="tabpanel"
                        aria-labelledby="reits-tab-gainers"
                        aria-hidden="false"
                        data-market-movers-panel
                      >
                        <ul class="market-movers__list" role="list">
                          <li class="market-movers__row">
                            <div class="market-movers__info">
                              <a class="market-movers__name" href="#">
                                <span>Riyad REIT</span>

                                <span
                                  class="market-movers__indicator market-movers__indicator--success"
                                  aria-hidden="true"
                                ></span>
                              </a>

                              <span class="market-movers__market"> REITs </span>
                            </div>

                            <div class="market-movers__numbers">
                              <data class="market-movers__price" value="12.30">
                                12.30
                              </data>

                              <data
                                class="market-movers__change market-change market-change--up"
                                value="1.65"
                              >
                                <span
                                  class="has-icon icon-arrow-up market-change__icon"
                                  aria-hidden="true"
                                ></span>

                                <span>0.20 (1.65%)</span>
                              </data>
                            </div>
                          </li>

                          <li class="market-movers__row">
                            <div class="market-movers__info">
                              <a class="market-movers__name" href="#">
                                <span>Jadwa REIT</span>

                                <span
                                  class="market-movers__indicator market-movers__indicator--caution"
                                  aria-hidden="true"
                                ></span>
                              </a>

                              <span class="market-movers__market"> REITs </span>
                            </div>

                            <div class="market-movers__numbers">
                              <data class="market-movers__price" value="9.85">
                                9.85
                              </data>

                              <data
                                class="market-movers__change market-change market-change--up"
                                value="1.02"
                              >
                                <span
                                  class="has-icon icon-arrow-up market-change__icon"
                                  aria-hidden="true"
                                ></span>

                                <span>0.10 (1.02%)</span>
                              </data>
                            </div>
                          </li>
                        </ul>
                      </div>

                      <!-- REITs Losers -->

                      <div
                        class="market-movers__panel"
                        id="reits-losers"
                        role="tabpanel"
                        aria-labelledby="reits-tab-losers"
                        aria-hidden="true"
                        data-market-movers-panel
                        hidden
                      >
                        <ul class="market-movers__list" role="list">
                          <li class="market-movers__row">
                            <div class="market-movers__info">
                              <a class="market-movers__name" href="#">
                                <span>Alinma Retail REIT</span>

                                <span
                                  class="market-movers__indicator market-movers__indicator--danger"
                                  aria-hidden="true"
                                ></span>
                              </a>

                              <span class="market-movers__market"> REITs </span>
                            </div>

                            <div class="market-movers__numbers">
                              <data class="market-movers__price" value="7.42">
                                7.42
                              </data>

                              <data
                                class="market-movers__change market-change market-change--down"
                                value="-1.59"
                              >
                                <span
                                  class="has-icon icon-arrow-down market-change__icon"
                                  aria-hidden="true"
                                ></span>

                                <span>−0.12 (−1.59%)</span>
                              </data>
                            </div>
                          </li>
                        </ul>
                      </div>

                      <!-- REITs Most Active by Volume -->

                      <div
                        class="market-movers__panel"
                        id="reits-volume"
                        role="tabpanel"
                        aria-labelledby="reits-tab-volume"
                        aria-hidden="true"
                        data-market-movers-panel
                        hidden
                      >
                        <ul class="market-movers__list" role="list">
                          <li class="market-movers__row">
                            <div class="market-movers__info">
                              <a class="market-movers__name" href="#">
                                <span>SEDCO Capital REIT</span>

                                <span
                                  class="market-movers__indicator market-movers__indicator--warning"
                                  aria-hidden="true"
                                ></span>
                              </a>

                              <span class="market-movers__market"> REITs </span>
                            </div>

                            <div class="market-movers__numbers">
                              <data class="market-movers__price" value="8.92">
                                8.92
                              </data>

                              <data
                                class="market-movers__change"
                                value="3240000"
                              >
                                3,240,000
                              </data>
                            </div>
                          </li>
                        </ul>
                      </div>

                      <!-- REITs Most Active by Value -->

                      <div
                        class="market-movers__panel"
                        id="reits-value"
                        role="tabpanel"
                        aria-labelledby="reits-tab-value"
                        aria-hidden="true"
                        data-market-movers-panel
                        hidden
                      >
                        <ul class="market-movers__list" role="list">
                          <li class="market-movers__row">
                            <div class="market-movers__info">
                              <a class="market-movers__name" href="#">
                                <span>Musharaka REIT</span>

                                <span
                                  class="market-movers__indicator market-movers__indicator--caution"
                                  aria-hidden="true"
                                ></span>
                              </a>

                              <span class="market-movers__market"> REITs </span>
                            </div>

                            <div class="market-movers__numbers">
                              <data class="market-movers__price" value="6.88">
                                6.88
                              </data>

                              <data
                                class="market-movers__change"
                                value="68400000"
                              >
                                <span
                                  class="has-icon icon-riyal market-change__icon"
                                  aria-hidden="true"
                                ></span>

                                <span>68.4M</span>
                              </data>
                            </div>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <!-- REITs Statistics -->

                  <div class="market-details-panel__stats">
                    <dl class="market-stats">
                      <div
                        class="market-stats__item market-stats__item--mobile-summary"
                      >
                        <dt class="market-stats__label">
                          <span class="market-stats__label-text">
                            Value Traded
                          </span>

                          <span
                            class="has-icon icon-riyal market-stats__icon"
                            aria-hidden="true"
                          ></span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="1100000000"> 1,100,000,000.00 </data>
                        </dd>
                      </div>

                      <div
                        class="market-stats__item market-stats__item--mobile-summary"
                      >
                        <dt class="market-stats__label">
                          <span class="market-stats__label-text">
                            Volume Traded
                          </span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="65000000"> 65,000,000 </data>
                        </dd>
                      </div>

                      <div class="market-stats__item">
                        <dt class="market-stats__label">
                          <span class="market-stats__label-text">
                            Funds Listed
                          </span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="90">90</data>
                        </dd>
                      </div>

                      <div class="market-stats__item">
                        <dt class="market-stats__label">
                          <span class="market-stats__label-text">
                            Funds Traded
                          </span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="72">72</data>
                        </dd>
                      </div>

                      <div class="market-stats__item">
                        <dt
                          class="market-stats__label market-stats__label--down"
                        >
                          <span class="market-stats__label-text">
                            Funds Down
                          </span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="25">25</data>
                        </dd>
                      </div>

                      <div class="market-stats__item">
                        <dt class="market-stats__label market-stats__label--up">
                          <span class="market-stats__label-text">
                            Funds Up
                          </span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="60">60</data>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <!-- =========================================================================
       ETFs View
  ========================================================================== -->

            <div
              class="market-view-panel market-details-panel--overview"
              id="funds-etfs"
              role="tabpanel"
              aria-labelledby="funds-tab-etfs"
              aria-hidden="true"
              data-market-view-panel
              hidden
            >
              <div class="market-details-panel__grid">
                <!-- ETFs Table -->

                <div class="market-details-panel__main">
                  <div class="market-panel">
                    <div class="market-details-panel__table table-responsive">
                      <table class="table table-compact">
                        <caption class="visually-hidden">
                          Exchange-traded fund market activity
                        </caption>

                        <thead>
                          <tr>
                            <th scope="col">Fund</th>
                            <th scope="col" class="numeric">Price</th>
                            <th scope="col" class="numeric">Change</th>
                            <th scope="col" class="numeric">Value</th>
                          </tr>
                        </thead>

                        <tbody>
                          <tr>
                            <th scope="row">
                              <a href="#">Falcom Saudi ETF</a>
                            </th>

                            <td class="numeric">
                              <data value="31.20">31.20</data>
                            </td>

                            <td class="numeric market-change market-change--up">
                              <span
                                class="has-icon icon-arrow-up market-change__icon"
                                aria-hidden="true"
                              ></span>

                              <data value="0.42">0.42%</data>
                            </td>

                            <td class="numeric">
                              <span
                                class="has-icon icon-riyal market-change__icon"
                                aria-hidden="true"
                              ></span>

                              <data value="22400000">22.4M</data>
                            </td>
                          </tr>

                          <tr>
                            <th scope="row">
                              <a href="#">HSBC Saudi 20 ETF</a>
                            </th>

                            <td class="numeric">
                              <data value="42.85">42.85</data>
                            </td>

                            <td
                              class="numeric market-change market-change--down"
                            >
                              <span
                                class="has-icon icon-arrow-down market-change__icon"
                                aria-hidden="true"
                              ></span>

                              <data value="-0.18">−0.18%</data>
                            </td>

                            <td class="numeric">
                              <span
                                class="has-icon icon-riyal market-change__icon"
                                aria-hidden="true"
                              ></span>

                              <data value="18700000">18.7M</data>
                            </td>
                          </tr>

                          <tr>
                            <th scope="row">
                              <a href="#">Saudi ETF 30</a>
                            </th>

                            <td class="numeric">
                              <data value="28.40">28.40</data>
                            </td>

                            <td class="numeric market-change market-change--up">
                              <span
                                class="has-icon icon-arrow-up market-change__icon"
                                aria-hidden="true"
                              ></span>

                              <data value="0.21">0.21%</data>
                            </td>

                            <td class="numeric">
                              <span
                                class="has-icon icon-riyal market-change__icon"
                                aria-hidden="true"
                              ></span>

                              <data value="31200000">31.2M</data>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <!-- ETFs Mobile Summary -->

                <div
                  class="market-details-panel__mobile-summary"
                  aria-label="ETFs trading summary"
                >
                  <div class="market-details-panel__mobile-metric">
                    <span class="market-details-panel__mobile-metric-label">
                      <span
                        class="has-icon icon-riyal market-details-panel__mobile-metric-icon"
                        aria-hidden="true"
                      ></span>

                      <span>Value Traded</span>
                    </span>

                    <data
                      class="market-details-panel__mobile-metric-value"
                      value="320000000"
                    >
                      320,000,000.00
                    </data>
                  </div>

                  <div class="market-details-panel__mobile-metric">
                    <span class="market-details-panel__mobile-metric-label">
                      Volume Traded
                    </span>

                    <data
                      class="market-details-panel__mobile-metric-value"
                      value="14200000"
                    >
                      14,200,000
                    </data>
                  </div>
                </div>

                <!-- ETFs Mobile Toggle -->

                <div class="market-details-panel__toggle-wrap">
                  <button
                    class="market-details-panel__toggle btn btn-outline-primary btn-sm has-icon icon-chevron-down icon-end"
                    type="button"
                    data-market-details-toggle
                    aria-expanded="false"
                    aria-controls="etfs-market-details"
                  >
                    <span data-market-details-toggle-text>
                      Show market details
                    </span>
                  </button>
                </div>

                <!-- ETFs Collapsible Details -->

                <div
                  class="market-details-panel__collapsible"
                  id="etfs-market-details"
                  data-market-details-collapsible
                  aria-hidden="false"
                >
                  <!-- ETFs Movers -->

                  <div class="market-details-panel__insights">
                    <div class="market-movers" data-market-movers>
                      <div
                        class="market-movers__tabs"
                        role="tablist"
                        aria-label="ETFs market movers"
                        aria-orientation="horizontal"
                      >
                        <button
                          class="market-movers__tab is-active"
                          id="etfs-tab-gainers"
                          type="button"
                          role="tab"
                          aria-selected="true"
                          aria-controls="etfs-gainers"
                          tabindex="0"
                          data-market-movers-tab
                        >
                          Gainers
                        </button>

                        <button
                          class="market-movers__tab"
                          id="etfs-tab-losers"
                          type="button"
                          role="tab"
                          aria-selected="false"
                          aria-controls="etfs-losers"
                          tabindex="-1"
                          data-market-movers-tab
                        >
                          Losers
                        </button>

                        <button
                          class="market-movers__tab"
                          id="etfs-tab-volume"
                          type="button"
                          role="tab"
                          aria-selected="false"
                          aria-controls="etfs-volume"
                          tabindex="-1"
                          data-market-movers-tab
                        >
                          Volume
                        </button>

                        <button
                          class="market-movers__tab"
                          id="etfs-tab-value"
                          type="button"
                          role="tab"
                          aria-selected="false"
                          aria-controls="etfs-value"
                          tabindex="-1"
                          data-market-movers-tab
                        >
                          Value
                        </button>
                      </div>

                      <!-- ETFs Gainers -->

                      <div
                        class="market-movers__panel is-active"
                        id="etfs-gainers"
                        role="tabpanel"
                        aria-labelledby="etfs-tab-gainers"
                        aria-hidden="false"
                        data-market-movers-panel
                      >
                        <ul class="market-movers__list" role="list">
                          <li class="market-movers__row">
                            <div class="market-movers__info">
                              <a class="market-movers__name" href="#">
                                <span>Falcom Saudi ETF</span>

                                <span
                                  class="market-movers__indicator market-movers__indicator--success"
                                  aria-hidden="true"
                                ></span>
                              </a>

                              <span class="market-movers__market"> ETFs </span>
                            </div>

                            <div class="market-movers__numbers">
                              <data class="market-movers__price" value="31.20">
                                31.20
                              </data>

                              <data
                                class="market-movers__change market-change market-change--up"
                                value="0.42"
                              >
                                <span
                                  class="has-icon icon-arrow-up market-change__icon"
                                  aria-hidden="true"
                                ></span>

                                <span>0.42%</span>
                              </data>
                            </div>
                          </li>
                        </ul>
                      </div>

                      <!-- ETFs Losers -->

                      <div
                        class="market-movers__panel"
                        id="etfs-losers"
                        role="tabpanel"
                        aria-labelledby="etfs-tab-losers"
                        aria-hidden="true"
                        data-market-movers-panel
                        hidden
                      >
                        <ul class="market-movers__list" role="list">
                          <li class="market-movers__row">
                            <div class="market-movers__info">
                              <a class="market-movers__name" href="#">
                                <span>HSBC Saudi 20 ETF</span>

                                <span
                                  class="market-movers__indicator market-movers__indicator--danger"
                                  aria-hidden="true"
                                ></span>
                              </a>

                              <span class="market-movers__market"> ETFs </span>
                            </div>

                            <div class="market-movers__numbers">
                              <data class="market-movers__price" value="42.85">
                                42.85
                              </data>

                              <data
                                class="market-movers__change market-change market-change--down"
                                value="-0.18"
                              >
                                <span
                                  class="has-icon icon-arrow-down market-change__icon"
                                  aria-hidden="true"
                                ></span>

                                <span>−0.18%</span>
                              </data>
                            </div>
                          </li>
                        </ul>
                      </div>

                      <!-- ETFs Volume Empty State -->

                      <div
                        class="market-movers__panel"
                        id="etfs-volume"
                        role="tabpanel"
                        aria-labelledby="etfs-tab-volume"
                        aria-hidden="true"
                        data-market-movers-panel
                        hidden
                      >
                        <p class="market-movers__empty">
                          Volume data is currently unavailable.
                        </p>
                      </div>

                      <!-- ETFs Value Empty State -->

                      <div
                        class="market-movers__panel"
                        id="etfs-value"
                        role="tabpanel"
                        aria-labelledby="etfs-tab-value"
                        aria-hidden="true"
                        data-market-movers-panel
                        hidden
                      >
                        <p class="market-movers__empty">
                          Value data is currently unavailable.
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- ETFs Statistics -->

                  <div class="market-details-panel__stats">
                    <dl class="market-stats">
                      <div
                        class="market-stats__item market-stats__item--mobile-summary"
                      >
                        <dt class="market-stats__label">
                          <span class="market-stats__label-text">
                            Value Traded
                          </span>

                          <span
                            class="has-icon icon-riyal market-stats__icon"
                            aria-hidden="true"
                          ></span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="320000000"> 320,000,000.00 </data>
                        </dd>
                      </div>

                      <div
                        class="market-stats__item market-stats__item--mobile-summary"
                      >
                        <dt class="market-stats__label">
                          <span class="market-stats__label-text">
                            Volume Traded
                          </span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="14200000"> 14,200,000 </data>
                        </dd>
                      </div>

                      <div class="market-stats__item">
                        <dt class="market-stats__label">
                          <span class="market-stats__label-text">
                            Funds Listed
                          </span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="12">12</data>
                        </dd>
                      </div>

                      <div class="market-stats__item">
                        <dt class="market-stats__label market-stats__label--up">
                          <span class="market-stats__label-text">
                            Funds Up
                          </span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="7">7</data>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <!-- =========================================================================
       CEFs View
  ========================================================================== -->

            <div
              class="market-view-panel market-details-panel--analytics"
              id="funds-cefs"
              role="tabpanel"
              aria-labelledby="funds-tab-cefs"
              aria-hidden="true"
              data-market-view-panel
              hidden
            >
              <div class="market-details-panel__grid">
                <!-- CEFs Table -->

                <div class="market-details-panel__main">
                  <div class="market-panel">
                    <div class="market-details-panel__table table-responsive">
                      <table class="table table-compact">
                        <caption class="visually-hidden">
                          Closed-end fund market activity
                        </caption>

                        <thead>
                          <tr>
                            <th scope="col">Fund</th>
                            <th scope="col" class="numeric">Price</th>
                            <th scope="col" class="numeric">Change</th>
                            <th scope="col" class="numeric">Value</th>
                            <th scope="col" class="numeric">Volume</th>
                          </tr>
                        </thead>

                        <tbody>
                          <tr>
                            <th scope="row">
                              <a href="#">Alkhabeer Growth Fund</a>
                            </th>

                            <td class="numeric">
                              <data value="13.40">13.40</data>
                            </td>

                            <td
                              class="numeric market-change market-change--down"
                            >
                              <span
                                class="has-icon icon-arrow-down market-change__icon"
                                aria-hidden="true"
                              ></span>

                              <data value="-0.22">−0.22%</data>
                            </td>

                            <td class="numeric">
                              <span
                                class="has-icon icon-riyal market-change__icon"
                                aria-hidden="true"
                              ></span>

                              <data value="98000000">98M</data>
                            </td>

                            <td class="numeric">
                              <data value="6300000">6.3M</data>
                            </td>
                          </tr>

                          <tr>
                            <th scope="row">
                              <a href="#">Derayah Income Fund</a>
                            </th>

                            <td class="numeric">
                              <data value="10.95">10.95</data>
                            </td>

                            <td class="numeric market-change market-change--up">
                              <span
                                class="has-icon icon-arrow-up market-change__icon"
                                aria-hidden="true"
                              ></span>

                              <data value="0.36">0.36%</data>
                            </td>

                            <td class="numeric">
                              <span
                                class="has-icon icon-riyal market-change__icon"
                                aria-hidden="true"
                              ></span>

                              <data value="76000000">76M</data>
                            </td>

                            <td class="numeric">
                              <data value="4800000">4.8M</data>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <!-- CEFs Mobile Summary -->

                <div
                  class="market-details-panel__mobile-summary"
                  aria-label="CEFs trading summary"
                >
                  <div class="market-details-panel__mobile-metric">
                    <span class="market-details-panel__mobile-metric-label">
                      <span
                        class="has-icon icon-riyal market-details-panel__mobile-metric-icon"
                        aria-hidden="true"
                      ></span>

                      <span>Value Traded</span>
                    </span>

                    <data
                      class="market-details-panel__mobile-metric-value"
                      value="210000000"
                    >
                      210,000,000.00
                    </data>
                  </div>

                  <div class="market-details-panel__mobile-metric">
                    <span class="market-details-panel__mobile-metric-label">
                      Volume Traded
                    </span>

                    <data
                      class="market-details-panel__mobile-metric-value"
                      value="9400000"
                    >
                      9,400,000
                    </data>
                  </div>
                </div>

                <!-- CEFs Mobile Toggle -->

                <div class="market-details-panel__toggle-wrap">
                  <button
                    class="market-details-panel__toggle btn btn-outline-primary btn-sm has-icon icon-chevron-down icon-end"
                    type="button"
                    data-market-details-toggle
                    aria-expanded="false"
                    aria-controls="cefs-market-details"
                  >
                    <span data-market-details-toggle-text>
                      Show market details
                    </span>
                  </button>
                </div>

                <!-- CEFs Collapsible Details -->

                <div
                  class="market-details-panel__collapsible"
                  id="cefs-market-details"
                  data-market-details-collapsible
                  aria-hidden="false"
                >
                  <div class="market-details-panel__stats">
                    <dl class="market-stats">
                      <div
                        class="market-stats__item market-stats__item--mobile-summary"
                      >
                        <dt class="market-stats__label">
                          <span class="market-stats__label-text">
                            Value Traded
                          </span>

                          <span
                            class="has-icon icon-riyal market-stats__icon"
                            aria-hidden="true"
                          ></span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="210000000"> 210,000,000.00 </data>
                        </dd>
                      </div>

                      <div
                        class="market-stats__item market-stats__item--mobile-summary"
                      >
                        <dt class="market-stats__label">
                          <span class="market-stats__label-text">
                            Volume Traded
                          </span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="9400000"> 9,400,000 </data>
                        </dd>
                      </div>

                      <div class="market-stats__item">
                        <dt class="market-stats__label">
                          <span class="market-stats__label-text">
                            Funds Listed
                          </span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="18">18</data>
                        </dd>
                      </div>

                      <div class="market-stats__item">
                        <dt
                          class="market-stats__label market-stats__label--down"
                        >
                          <span class="market-stats__label-text">
                            Funds Down
                          </span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="5">5</data>
                        </dd>
                      </div>

                      <div class="market-stats__item">
                        <dt class="market-stats__label market-stats__label--up">
                          <span class="market-stats__label-text">
                            Funds Up
                          </span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="11">11</data>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- =========================================================================
     Derivatives Details
============================================================================ -->

          <section
            class="market-details-panel"
            id="market-panel-derivatives"
            role="tabpanel"
            aria-labelledby="market-tab-derivatives"
            aria-hidden="true"
            data-market-detail-panel
            data-market="D"
            hidden
          >
            <!-- =======================================================================
       Derivatives View Navigation
  ======================================================================== -->

            <div class="market-views">
              <div
                class="market-views__list"
                role="tablist"
                aria-label="Derivatives views"
                aria-orientation="horizontal"
              >
                <button
                  class="market-views__tab is-active"
                  id="derivatives-tab-mt30"
                  type="button"
                  role="tab"
                  aria-selected="true"
                  aria-controls="derivatives-mt30"
                  tabindex="0"
                  data-market-view-tab
                >
                  MT30
                </button>

                <button
                  class="market-views__tab"
                  id="derivatives-tab-summary"
                  type="button"
                  role="tab"
                  aria-selected="false"
                  aria-controls="derivatives-summary"
                  tabindex="-1"
                  data-market-view-tab
                >
                  Derivatives
                </button>
              </div>
            </div>

            <!-- =========================================================================
       MT30 View
  ========================================================================== -->

            <div
              class="market-view-panel market-details-panel--analytics is-active"
              id="derivatives-mt30"
              role="tabpanel"
              aria-labelledby="derivatives-tab-mt30"
              
              data-market-view-panel
            >
              <div class="market-details-panel__grid">
                <!-- MT30 Chart -->

                <div class="market-details-panel__main">
                  <div
                    class="market-details-panel__chart market-chart"
                    id="mt30-chart"
                    data-chart-id="mt30"
                    role="img"
                    aria-label="MT30 index chart"
                  ></div>
                </div>

                <!-- MT30 Mobile Summary -->

                <div
                  class="market-details-panel__mobile-summary"
                  aria-label="MT30 market summary"
                >
                  <div class="market-details-panel__mobile-metric">
                    <span class="market-details-panel__mobile-metric-label">
                      Open
                    </span>

                    <data
                      class="market-details-panel__mobile-metric-value"
                      value="1582.25"
                    >
                      1,582.25
                    </data>
                  </div>

                  <div class="market-details-panel__mobile-metric">
                    <span class="market-details-panel__mobile-metric-label">
                      Close
                    </span>

                    <data
                      class="market-details-panel__mobile-metric-value"
                      value="1575.80"
                    >
                      1,575.80
                    </data>
                  </div>
                </div>

                <!-- MT30 Mobile Toggle -->

                <div class="market-details-panel__toggle-wrap">
                  <button
                    class="market-details-panel__toggle btn btn-outline-primary btn-sm has-icon icon-chevron-down icon-end"
                    type="button"
                    data-market-details-toggle
                    aria-expanded="false"
                    aria-controls="mt30-market-details"
                  >
                    <span data-market-details-toggle-text>
                      Show market details
                    </span>
                  </button>
                </div>

                <!-- MT30 Collapsible Statistics -->

                <div
                  class="market-details-panel__collapsible"
                  id="mt30-market-details"
                  data-market-details-collapsible
                  
                >
                  <div class="market-details-panel__stats">
                    <dl class="market-stats">
                      <div
                        class="market-stats__item market-stats__item--mobile-summary"
                      >
                        <dt class="market-stats__label">
                          <span class="market-stats__label-text"> Open </span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="1582.25"> 1,582.25 </data>
                        </dd>
                      </div>

                      <div
                        class="market-stats__item market-stats__item--mobile-summary"
                      >
                        <dt class="market-stats__label">
                          <span class="market-stats__label-text"> Close </span>
                        </dt>

                        <dd class="market-stats__value">
                          <data value="1575.80"> 1,575.80 </data>
                        </dd>
                      </div>

                      <div class="market-stats__item">
                        <dt class="market-stats__label">
                          <span class="market-stats__label-text">
                            Daily Change
                          </span>
                        </dt>

                        <dd
                          class="market-stats__value market-change market-change--up"
                        >
                          <span
                            class="has-icon icon-arrow-up market-change__icon"
                            aria-hidden="true"
                          ></span>

                          <data value="6.45"> 6.45 </data>
                        </dd>
                      </div>

                      <div class="market-stats__item">
                        <dt class="market-stats__label">
                          <span class="market-stats__label-text">
                            Change Percentage
                          </span>
                        </dt>

                        <dd
                          class="market-stats__value market-change market-change--up"
                        >
                          <span
                            class="has-icon icon-arrow-up market-change__icon"
                            aria-hidden="true"
                          ></span>

                          <data value="0.41"> 0.41% </data>
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <!-- =========================================================================
       Derivatives Dashboard View
  ========================================================================== -->

            <div
              class="market-view-panel market-details-panel--dashboard"
              id="derivatives-summary"
              role="tabpanel"
              aria-labelledby="derivatives-tab-summary"
              aria-hidden="true"
              data-market-view-panel
              hidden
            >
              <div class="derivatives-dashboard">
                <!-- ===================================================================
           Derivative Market
      ==================================================================== -->

                <article
                  class="derivatives-dashboard__card"
                  aria-labelledby="derivative-market-title"
                >
                  <header class="derivatives-dashboard__header">
                    <h3
                      class="derivatives-dashboard__title"
                      id="derivative-market-title"
                    >
                      Derivative Market
                    </h3>
                  </header>

                  <div class="table-responsive custom-scrollbar">
                    <table class="table table-compact">
                      <caption class="visually-hidden">
                        Derivative market trading activity
                      </caption>

                      <thead>
                        <tr>
                          <th scope="col">Instrument Type</th>
                          <th scope="col" class="numeric">Volume Traded</th>
                          <th scope="col" class="numeric">Open Interest</th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <th scope="row">
                            <a href="#">Index Futures</a>
                          </th>

                          <td class="numeric">
                            <data value="12450">12,450</data>
                          </td>

                          <td class="numeric">
                            <data value="34120">34,120</data>
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            <a href="#">Single Stock Futures</a>
                          </th>

                          <td class="numeric">
                            <data value="8920">8,920</data>
                          </td>

                          <td class="numeric">
                            <data value="21840">21,840</data>
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            <a href="#">Single Stock Options</a>
                          </th>

                          <td class="numeric">
                            <data value="4310">4,310</data>
                          </td>

                          <td class="numeric">
                            <data value="15760">15,760</data>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </article>

                <!-- ===================================================================
           Index Futures
      ==================================================================== -->

                <article
                  class="derivatives-dashboard__card"
                  aria-labelledby="index-futures-title"
                >
                  <header class="derivatives-dashboard__header">
                    <h3
                      class="derivatives-dashboard__title"
                      id="index-futures-title"
                    >
                      Index Futures
                    </h3>
                  </header>

                  <div class="table-responsive custom-scrollbar">
                    <table class="table table-compact">
                      <caption class="visually-hidden">
                        Index futures trading activity
                      </caption>

                      <thead>
                        <tr>
                          <th scope="col">Underlying</th>
                          <th scope="col" class="numeric">Volume Traded</th>
                          <th scope="col" class="numeric">Open Interest</th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <th scope="row">
                            <a href="#">MT30 Index Futures</a>
                          </th>

                          <td class="numeric">
                            <data value="7280">7,280.00</data>
                          </td>

                          <td class="numeric">
                            <data value="18450">18,450</data>
                          </td>
                        </tr>

                        <tr>
                          <th scope="row">
                            <a href="#">MT30 Weekly Futures</a>
                          </th>

                          <td class="numeric">
                            <data value="3620">3,620.00</data>
                          </td>

                          <td class="numeric">
                            <data value="9875">9,875</data>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </article>

                <!-- ===================================================================
           Mobile Additional Tables Toggle
      ==================================================================== -->

                <div class="derivatives-dashboard__toggle">
                  <button
                    class="market-details-panel__toggle btn btn-outline-primary btn-sm has-icon icon-chevron-down icon-end"
                    type="button"
                    data-market-details-toggle
                    data-market-details-label-show="Show more tables"
                    data-market-details-label-hide="Hide additional tables"
                    aria-expanded="false"
                    aria-controls="derivatives-more-tables"
                  >
                    <span data-market-details-toggle-text>
                      Show more tables
                    </span>
                  </button>
                </div>

                <!-- ===================================================================
           Additional Derivative Tables
      ==================================================================== -->

                <div
                  class="derivatives-dashboard__more"
                  id="derivatives-more-tables"
                  data-market-details-collapsible
                  
                >
                  <!-- ===============================================================
             Single Stock Futures
        ================================================================ -->

                  <article
                    class="derivatives-dashboard__card"
                    aria-labelledby="single-stock-futures-title"
                  >
                    <header class="derivatives-dashboard__header">
                      <h3
                        class="derivatives-dashboard__title"
                        id="single-stock-futures-title"
                      >
                        Single Stock Futures
                      </h3>
                    </header>

                    <div class="table-responsive custom-scrollbar">
                      <table class="table table-compact">
                        <caption class="visually-hidden">
                          Single stock futures trading activity
                        </caption>

                        <thead>
                          <tr>
                            <th scope="col">Underlying</th>
                            <th scope="col" class="numeric">Volume Traded</th>
                            <th scope="col" class="numeric">Open Interest</th>
                          </tr>
                        </thead>

                        <tbody>
                          <tr>
                            <th scope="row">
                              <a href="#">Aramco Futures</a>
                            </th>

                            <td class="numeric">
                              <data value="2840">2,840.00</data>
                            </td>

                            <td class="numeric">
                              <data value="7520">7,520</data>
                            </td>
                          </tr>

                          <tr>
                            <th scope="row">
                              <a href="#">Al Rajhi Futures</a>
                            </th>

                            <td class="numeric">
                              <data value="1965">1,965.00</data>
                            </td>

                            <td class="numeric">
                              <data value="5330">5,330</data>
                            </td>
                          </tr>

                          <tr>
                            <th scope="row">
                              <a href="#">SABIC Futures</a>
                            </th>

                            <td class="numeric">
                              <data value="1420">1,420.00</data>
                            </td>

                            <td class="numeric">
                              <data value="4870">4,870</data>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <!-- ===============================================================
             Single Stock Options
        ================================================================ -->

                  <article
                    class="derivatives-dashboard__card"
                    aria-labelledby="single-stock-options-title"
                  >
                    <header class="derivatives-dashboard__header">
                      <h3
                        class="derivatives-dashboard__title"
                        id="single-stock-options-title"
                      >
                        Single Stock Options
                      </h3>
                    </header>

                    <div class="table-responsive custom-scrollbar">
                      <table class="table table-compact">
                        <caption class="visually-hidden">
                          Single stock options trading activity
                        </caption>

                        <thead>
                          <tr>
                            <th scope="col">Contract Name</th>
                            <th scope="col" class="numeric">Volume Traded</th>
                            <th scope="col" class="numeric">Open Interest</th>
                          </tr>
                        </thead>

                        <tbody>
                          <tr>
                            <th scope="row">
                              <a href="#">Aramco Call Options</a>
                            </th>

                            <td class="numeric">
                              <data value="1260">1,260.00</data>
                            </td>

                            <td class="numeric">
                              <data value="3780">3,780</data>
                            </td>
                          </tr>

                          <tr>
                            <th scope="row">
                              <a href="#">Al Rajhi Put Options</a>
                            </th>

                            <td class="numeric">
                              <data value="940">940.00</data>
                            </td>

                            <td class="numeric">
                              <data value="2615">2,615</data>
                            </td>
                          </tr>

                          <tr>
                            <th scope="row">
                              <a href="#">SNB Call Options</a>
                            </th>

                            <td class="numeric">
                              <data value="725">725.00</data>
                            </td>

                            <td class="numeric">
                              <data value="1980">1,980</data>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  </details>
</section>

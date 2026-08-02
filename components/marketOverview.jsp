<section
  class="market-overview market-overview--home"
  aria-label="Market overview"
  data-market-overview
  data-page-mode="home"
  data-market-details-mode="always"
>
  <section
    class="market-summary"
    aria-labelledby="market-summary-title"
    data-market-summary
  >
    <h2 id="market-summary-title" class="visually-hidden">Market summary</h2>

    <div class="market-summary__container">
      <section
        class="market-summary__clock"
        aria-label="Saudi Arabia market time"
        data-market-clock
      >
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

      <%--
      ========================================================================
      Market Selection
      ========================================================================
      --%>

      <div class="market-summary__cards-wrap">
        <div
          class="market-summary__cards"
          role="tablist"
          aria-label="Markets"
          aria-orientation="horizontal"
          data-market-tabs
        >
          <%-- Main Market --%>

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

          <%-- Parallel Market --%>

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

          <%-- Sukuk and Bonds --%>

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

          <%-- Funds --%>

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

          <%-- Derivatives --%>

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

        <%-- Return to selected market --%>

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

      <div class="market-summary__cards-wrap">
        <p>Market cards placeholder</p>
      </div>
    </div>
  </section>
</section>

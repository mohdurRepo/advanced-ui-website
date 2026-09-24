<section class="hero-section surface-hero" aria-labelledby="main-market-title" aria-describedby="main-market-description">
  <div class="hero-section__background" aria-hidden="true"></div>

  <div class="container hero-section__content">
    <div class="hero-intro">
      <!-- ====================================================================
           Market Identity
           ==================================================================== -->

      <header class="hero-intro__header">
        <div class="hero-intro__brand">
          <span class="hero-intro__icon has-icon icon-tadawul" aria-hidden="true"></span>

          <h1 id="main-market-title" class="hero-intro__title">
            Market Summary
          </h1>
        </div>

        <p id="main-market-description" class="hero-intro__description">
          An overview of activity across Saudi Exchange's Main Market.
        </p>
      </header>

      <!-- ====================================================================
           Market Index and Actions
           ==================================================================== -->

      <footer class="hero-intro__footer">
        <!-- ==================================================================
             TASI Index
             ================================================================== -->

        <div class="instrument-price" dir="ltr" aria-busy="false" aria-label="TASI Index: 10,680.61 points. Decreased by 1.21 points, or 0.01 percent." data-market-index="">
          <!-- ================================================================
               Index Label
               ================================================================ -->

          <p class="instrument-price__label">
            TASI Index
            <span>(TASI)</span>
          </p>

          <!-- ================================================================
               Current Index Value
               ================================================================ -->

          <div class="instrument-price__current">
            <!-- Initial Loading -->

            <span class="skeleton skeleton--market-value" aria-hidden="true" data-market-index-loading="" hidden=""></span>

            <!-- Loaded / Live Value -->

            <data id="indexPrice" class="instrument-price__value market-live-update" value="10680.61" data-market-index-value="" data-market-index-live="">10,680.61</data>
          </div>

          <!-- ================================================================
               Index Change
               ================================================================ -->

          <div class="instrument-price__change price-down" data-market-index-change-state="">
            <!-- Initial Loading -->

            <span class="skeleton skeleton--market-change" aria-hidden="true" data-market-index-loading="" hidden=""></span>

            <span class="skeleton skeleton--market-percent" aria-hidden="true" data-market-index-loading="" hidden=""></span>

            <!-- Direction Icon -->

            <span class="instrument-price__change-icon has-icon icon-triangle-up" aria-hidden="true" data-market-index-change-icon="" data-market-index-live="" style="transform: rotate(180deg);"></span>

            <!-- Net Change -->

            <data id="indexNetChange" class="instrument-price__change-value" value="-1.21" data-market-index-change="" data-market-index-live="">-1.21</data>

            <!-- Percentage Change -->

            <span id="indexPercentChange" class="instrument-price__change-percentage" data-market-index-change-percent="" data-market-index-live="">(-0.01%)</span>
          </div>
        </div>

        <!-- ==================================================================
             Main Market Actions
             ================================================================== -->

        <nav class="hero-intro__actions" aria-label="Main Market actions">
          <a class="btn btn-light btn-arrow" href="#">
            <span>Invest Now</span>

            <span class="has-icon icon-chevron-right icon-flip-rtl icon-end" aria-hidden="true"></span>
          </a>

          <a class="btn btn-outline-light btn-arrow" href="#">
            <span>Compare</span>

            <span class="has-icon icon-chevron-right icon-flip-rtl" aria-hidden="true"></span>
          </a>
        </nav>
      </footer>
    </div>
  </div>
</section>
/* ==========================================================================
   Home Event Slider
   ========================================================================== */

import { Swiper, Navigation, Pagination, Autoplay } from "../../vendors/swiper";

const SELECTORS = {
  root: "[data-home-event-slider]",
  slide: ".home-event-slider__slide",
  previous: ".home-event-slider__navigation--previous",
  next: ".home-event-slider__navigation--next",
  pagination: ".home-event-slider__pagination",
};

const AUTOPLAY_DELAY = 5000;
const TRANSITION_SPEED = 700;

/* ==========================================================================
   Preferences
   ========================================================================== */

function prefersReducedMotion() {
  return (
    document.documentElement.dataset.motion === "reduce" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ==========================================================================
   Active Slide
   ========================================================================== */

function synchronizeActiveSlide(swiper) {
  const activeSlide = swiper.slides?.[swiper.activeIndex] || null;

  swiper.slides.forEach((slide, index) => {
    const active = slide === activeSlide;

    slide.setAttribute("aria-hidden", String(!active));

    slide.setAttribute("aria-label", `${index + 1} of ${swiper.slides.length}`);

    if ("inert" in slide) {
      slide.inert = !active;
    }
  });
}

/* ==========================================================================
   Autoplay
   ========================================================================== */

function shouldPauseAutoplay(root) {
  return (
    prefersReducedMotion() ||
    document.hidden ||
    root.matches(":hover") ||
    root.contains(document.activeElement)
  );
}

function synchronizeAutoplay(swiper, root) {
  if (!swiper.autoplay) return;

  if (shouldPauseAutoplay(root)) {
    swiper.autoplay.stop();
    return;
  }

  swiper.autoplay.start();
}

function initializeAutoplayEvents(swiper, root) {
  root.addEventListener("mouseenter", () => {
    synchronizeAutoplay(swiper, root);
  });

  root.addEventListener("mouseleave", () => {
    synchronizeAutoplay(swiper, root);
  });

  root.addEventListener("focusin", () => {
    synchronizeAutoplay(swiper, root);
  });

  root.addEventListener("focusout", () => {
    window.requestAnimationFrame(() => {
      synchronizeAutoplay(swiper, root);
    });
  });

  document.addEventListener("visibilitychange", () => {
    synchronizeAutoplay(swiper, root);
  });

  document.addEventListener("preferencechange", (event) => {
    if (event.detail?.name === "motion") {
      synchronizeAutoplay(swiper, root);
    }
  });

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  motionQuery.addEventListener("change", () => {
    synchronizeAutoplay(swiper, root);
  });
}

/* ==========================================================================
   Pagination
   ========================================================================== */

function renderPaginationBullet(index, className) {
  return `
    <button
      class="${className}"
      type="button"
      aria-label="Go to featured event ${index + 1}"
    ></button>
  `;
}

/* ==========================================================================
   Initialization
   ========================================================================== */

function initializeEventSlider(root) {
  if (root.swiper) return;

  const slides = root.querySelectorAll(SELECTORS.slide);

  if (!slides.length) return;

  const previous = root.querySelector(SELECTORS.previous);

  const next = root.querySelector(SELECTORS.next);

  const pagination = root.querySelector(SELECTORS.pagination);

  const hasMultipleSlides = slides.length > 1;

  const swiper = new Swiper(root, {
    modules: [Navigation, Pagination, Autoplay],

    slidesPerView: 1,
    spaceBetween: 0,

    /*
     * Rewind avoids cloned slides and duplicate accessible content while
     * still returning to the first slide after the final slide.
     */

    loop: false,
    rewind: hasMultipleSlides,

    speed: prefersReducedMotion() ? 0 : TRANSITION_SPEED,

    watchOverflow: true,
    observer: true,
    observeParents: true,

    autoplay: hasMultipleSlides
      ? {
          delay: AUTOPLAY_DELAY,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }
      : false,

    navigation:
      previous && next
        ? {
            prevEl: previous,
            nextEl: next,
          }
        : undefined,

    pagination: pagination
      ? {
          el: pagination,
          clickable: true,
          renderBullet: renderPaginationBullet,
        }
      : undefined,

    on: {
      init(instance) {
        synchronizeActiveSlide(instance);
      },

      slideChange(instance) {
        synchronizeActiveSlide(instance);
      },
    },
  });

  initializeAutoplayEvents(swiper, root);
  synchronizeAutoplay(swiper, root);
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initHomeEventSlider() {
  document.querySelectorAll(SELECTORS.root).forEach(initializeEventSlider);
}

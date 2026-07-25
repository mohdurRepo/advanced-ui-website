/* ==========================================================================
   Home Upcoming Activities
   ========================================================================== */

import { Swiper, Pagination, Autoplay } from "../../vendors/swiper";

const SELECTORS = {
  root: "[data-home-activities-slider]",
  slide: ".home-upcoming-activities__slide",
  body: ".home-upcoming-activities__body",
  pagination: ".home-upcoming-activities__pagination",
};

const VARIANTS = [
  {
    className: "home-upcoming-activities__body--listing",
    accent: "var(--color-success)",
  },
  {
    className: "home-upcoming-activities__body--cmf",
    accent: "var(--color-warning)",
  },
  {
    className: "home-upcoming-activities__body--ipo",
    accent: "var(--color-primary)",
  },
];

const AUTOPLAY_DELAY = 6000;
const TRANSITION_SPEED = 600;

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

function getActiveSlide(swiper) {
  return swiper.slides?.[swiper.activeIndex] || null;
}

function getSlideAccent(slide) {
  const body = slide?.querySelector(SELECTORS.body);

  if (!body) {
    return "var(--color-primary)";
  }

  const variant = VARIANTS.find(({ className }) =>
    body.classList.contains(className),
  );

  return variant?.accent || "var(--color-primary)";
}

function synchronizeActiveSlide(swiper, root) {
  const activeSlide = getActiveSlide(swiper);

  root.style.setProperty(
    "--home-activities-accent",
    getSlideAccent(activeSlide),
  );

  swiper.slides.forEach((slide) => {
    const active = slide === activeSlide;

    slide.setAttribute("aria-hidden", String(!active));
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
   Initialization
   ========================================================================== */

function initializeActivitiesSlider(root) {
  if (root.swiper) return;

  const slides = root.querySelectorAll(SELECTORS.slide);

  if (!slides.length) return;

  const pagination = root.querySelector(SELECTORS.pagination);

  const swiper = new Swiper(root, {
    modules: [Pagination, Autoplay],

    slidesPerView: 1,
    spaceBetween: 0,

    loop: slides.length > 1,
    speed: prefersReducedMotion() ? 0 : TRANSITION_SPEED,

    watchOverflow: true,
    observer: true,
    observeParents: true,

    autoplay: {
      delay: AUTOPLAY_DELAY,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
    },

    pagination: pagination
      ? {
          el: pagination,
          clickable: true,
        }
      : undefined,

    on: {
      init(instance) {
        synchronizeActiveSlide(instance, root);
      },

      slideChange(instance) {
        synchronizeActiveSlide(instance, root);
      },
    },
  });

  initializeAutoplayEvents(swiper, root);
  synchronizeAutoplay(swiper, root);
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initHomeUpcomingActivities() {
  document.querySelectorAll(SELECTORS.root).forEach(initializeActivitiesSlider);
}

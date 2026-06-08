import { Swiper, Pagination, Autoplay } from "../../vendors/swiper";

export function initHomeCountdownSlider() {
  const sliders = document.querySelectorAll("[data-home-countdown-slider]");

  sliders.forEach((slider) => {
    if (slider.swiper) return;

    new Swiper(slider, {
      modules: [Pagination, Autoplay],
      slidesPerView: 1,
      loop: true,
      speed: 600,
      watchOverflow: true,

      autoplay: {
        delay: 6000,
        disableOnInteraction: false,
      },

      pagination: {
        el: slider.querySelector(".swiper-pagination"),
        clickable: true,
      },
    });
  });
}

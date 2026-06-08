import { Swiper, Navigation, Pagination, Autoplay } from "../../vendors/swiper";

export function initHomeEventSlider() {
  const sliders = document.querySelectorAll("[data-home-event-slider]");

  sliders.forEach((slider) => {
    if (slider.swiper) return;

    new Swiper(slider, {
      modules: [Navigation, Pagination, Autoplay],
      slidesPerView: 1,
      loop: true,
      speed: 700,
      watchOverflow: true,

      autoplay: {
        delay: 5000,
        disableOnInteraction: false,
      },

      pagination: {
        el: slider.querySelector(".swiper-pagination"),
        clickable: true,
      },

      navigation: {
        nextEl: slider.querySelector(".swiper-button-next"),
        prevEl: slider.querySelector(".swiper-button-prev"),
      },
    });
  });
}

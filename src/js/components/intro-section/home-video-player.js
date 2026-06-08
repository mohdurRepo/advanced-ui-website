export function initHomeVideoPlayer() {
  const videoCards = document.querySelectorAll("[data-home-video]");

  videoCards.forEach((card) => {
    const videoUrl = card.dataset.videoUrl;
    const playButton = card.querySelector("[data-home-video-play]");

    if (!videoUrl || !playButton) return;

    playButton.addEventListener("click", () => {
      card.innerHTML = `
        <video class="home-video-card__video" controls autoplay playsinline>
          <source src="${videoUrl}" type="video/mp4" />
        </video>
      `;
    });
  });
}

/* ==========================================================================
   Home Video Player
   ========================================================================== */

const SELECTORS = {
  root: "[data-home-video-card]",
  wrapper: "[data-home-video]",
  video: "[data-home-video-media]",
  thumbnail: "[data-home-video-thumbnail]",
  play: "[data-home-video-play]",
};

const CLASSES = {
  playing: "is-playing",
  loading: "is-loading",
  error: "has-error",
};

const LABELS = {
  en: {
    play: "Play featured market video",
    replay: "Replay featured market video",
    unavailable: "Featured market video is unavailable",
  },

  ar: {
    play: "تشغيل فيديو السوق المميز",
    replay: "إعادة تشغيل فيديو السوق المميز",
    unavailable: "فيديو السوق المميز غير متاح",
  },
};

const initializedCards = new WeakSet();

/* ==========================================================================
   Language
   ========================================================================== */

function getLanguage() {
  return document.documentElement.lang?.startsWith("ar") ? "ar" : "en";
}

function getLabels() {
  return LABELS[getLanguage()];
}

/* ==========================================================================
   Elements
   ========================================================================== */

function getVideoElements(root) {
  const elements = {
    root,
    wrapper: root.querySelector(SELECTORS.wrapper),
    video: root.querySelector(SELECTORS.video),
    thumbnail: root.querySelector(SELECTORS.thumbnail),
    play: root.querySelector(SELECTORS.play),
  };

  if (!elements.wrapper || !elements.video || !elements.play) {
    return null;
  }

  return elements;
}

/* ==========================================================================
   Media Source
   ========================================================================== */

function hasVideoSource(video) {
  if (video.currentSrc || video.src) {
    return true;
  }

  return Boolean(video.querySelector("source[src]"));
}

/* ==========================================================================
   Labels
   ========================================================================== */

function updatePlayLabel(
  elements,
  { replay = false, unavailable = false } = {},
) {
  const labels = getLabels();

  let label = labels.play;

  if (replay) {
    label = labels.replay;
  }

  if (unavailable) {
    label = labels.unavailable;
  }

  elements.play.setAttribute("aria-label", label);
}

/* ==========================================================================
   Poster
   ========================================================================== */

function synchronizePoster(elements) {
  const { video, thumbnail } = elements;

  if (!thumbnail || video.poster) return;

  const thumbnailSource = thumbnail.currentSrc || thumbnail.getAttribute("src");

  if (thumbnailSource) {
    video.poster = thumbnailSource;
  }
}

/* ==========================================================================
   State
   ========================================================================== */

function setLoading(elements, loading) {
  elements.root.classList.toggle(CLASSES.loading, loading);

  elements.wrapper.setAttribute("aria-busy", String(loading));
}

function setPlaying(elements, playing) {
  elements.root.classList.toggle(CLASSES.playing, playing);

  elements.play.setAttribute("aria-expanded", String(playing));
}

function setError(elements, error) {
  elements.root.classList.toggle(CLASSES.error, error);

  elements.play.disabled = error;

  updatePlayLabel(elements, {
    unavailable: error,
  });
}

/* ==========================================================================
   Reset
   ========================================================================== */

function resetVideo(elements, { replay = false, restoreFocus = false } = {}) {
  const { video, play, wrapper } = elements;

  video.pause();

  if (Number.isFinite(video.duration)) {
    try {
      video.currentTime = 0;
    } catch {
      // Some browsers prevent seeking before metadata is ready.
    }
  }

  video.hidden = true;

  setLoading(elements, false);
  setPlaying(elements, false);

  wrapper.setAttribute("aria-busy", "false");

  updatePlayLabel(elements, {
    replay,
  });

  if (restoreFocus) {
    play.focus({
      preventScroll: true,
    });
  }
}

/* ==========================================================================
   Playback
   ========================================================================== */

async function playVideo(elements) {
  const { root, video, play } = elements;

  if (!hasVideoSource(video)) {
    setError(elements, true);
    return;
  }

  root.classList.remove(CLASSES.error);

  play.disabled = false;
  video.hidden = false;

  setLoading(elements, video.readyState < 3);

  try {
    const playRequest = video.play();

    if (playRequest instanceof Promise) {
      await playRequest;
    }
  } catch {
    video.hidden = true;

    setLoading(elements, false);
    setPlaying(elements, false);
    setError(elements, true);
  }
}

/* ==========================================================================
   Media Events
   ========================================================================== */

function initializeMediaEvents(elements) {
  const { video } = elements;

  video.addEventListener("loadstart", () => {
    if (!video.hidden) {
      setLoading(elements, true);
    }
  });

  video.addEventListener("waiting", () => {
    if (!video.hidden) {
      setLoading(elements, true);
    }
  });

  video.addEventListener("canplay", () => {
    setLoading(elements, false);
  });

  video.addEventListener("playing", () => {
    setLoading(elements, false);
    setPlaying(elements, true);
  });

  video.addEventListener("ended", () => {
    resetVideo(elements, {
      replay: true,
    });
  });

  video.addEventListener("error", () => {
    resetVideo(elements);

    setError(elements, true);
  });
}

/* ==========================================================================
   Interaction
   ========================================================================== */

function initializeInteractionEvents(elements) {
  const { root, play, video } = elements;

  play.addEventListener("click", () => {
    playVideo(elements);
  });

  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !root.classList.contains(CLASSES.playing)) {
      return;
    }

    event.preventDefault();

    resetVideo(elements, {
      replay: true,
      restoreFocus: true,
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !video.hidden && !video.paused) {
      video.pause();
      setLoading(elements, false);
    }
  });
}

/* ==========================================================================
   Language Updates
   ========================================================================== */

function initializeLanguageEvents(elements) {
  function refreshLabel() {
    updatePlayLabel(elements, {
      replay: elements.video.ended || elements.video.currentTime > 0,

      unavailable: elements.root.classList.contains(CLASSES.error),
    });
  }

  document.addEventListener("languagechange", refreshLabel);

  document.addEventListener("preferencechange", (event) => {
    if (event.detail?.name === "lang") {
      refreshLabel();
    }
  });
}

/* ==========================================================================
   Initialization
   ========================================================================== */

function initializeVideoCard(root) {
  if (initializedCards.has(root)) return;

  const elements = getVideoElements(root);

  if (!elements) return;

  initializedCards.add(root);

  synchronizePoster(elements);

  elements.video.hidden = true;

  elements.play.setAttribute("aria-expanded", "false");

  elements.wrapper.setAttribute("aria-busy", "false");

  updatePlayLabel(elements);

  initializeMediaEvents(elements);
  initializeInteractionEvents(elements);
  initializeLanguageEvents(elements);
}

/* ==========================================================================
   Public Initializer
   ========================================================================== */

export function initHomeVideoPlayer() {
  document.querySelectorAll(SELECTORS.root).forEach(initializeVideoCard);
}

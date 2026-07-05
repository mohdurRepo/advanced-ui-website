function animateCounter(element) {
  const target = Number(element.dataset.countTo || 0);
  const decimals = Number(element.dataset.countDecimals || 0);
  const duration = Number(element.dataset.countDuration || 2400);
  const start = performance.now();

  function update(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    const value = target * eased;

    element.textContent = value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = target.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
  }

  requestAnimationFrame(update);
}

export function initFeatureOverview() {
  const counters = document.querySelectorAll("[data-count-up]");

  if (!counters.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        animateCounter(entry.target);

        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.35,
    },
  );

  counters.forEach((counter) => observer.observe(counter));
}

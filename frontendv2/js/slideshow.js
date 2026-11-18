const carousel = document.querySelector(".gallery-carousel");

if (carousel) {
  // Capture the carousel controls and start from the slide marked active in the HTML.
  const slides = Array.from(carousel.querySelectorAll(".gallery-slide"));
  const dots = Array.from(carousel.querySelectorAll(".gallery-dot"));
  const previousButton = carousel.querySelector(".gallery-control-previous");
  const nextButton = carousel.querySelector(".gallery-control-next");
  let activeIndex = slides.findIndex((slide) => slide.classList.contains("is-active"));

  // Keep the slide visibility and accessible pagination state in sync.
  function showSlide(index) {
    activeIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeIndex;
      slide.setAttribute("aria-hidden", String(!isActive));
      slide.classList.toggle("is-active", isActive);
      dots[slideIndex].setAttribute("aria-current", String(isActive));
    });
  }

  // Wrap navigation at either end so every slide remains reachable.
  previousButton.addEventListener("click", () => showSlide(activeIndex - 1));
  nextButton.addEventListener("click", () => showSlide(activeIndex + 1));

  // Let visitors jump directly to a slide using its pagination dot.
  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => showSlide(index));
  });

  // Normalize the initial state, including when no slide is marked active in the HTML.
  showSlide(activeIndex < 0 ? 0 : activeIndex);
}

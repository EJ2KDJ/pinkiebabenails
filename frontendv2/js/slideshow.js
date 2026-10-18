const carousel = document.querySelector(".gallery-carousel");

if (carousel) {
  const slides = Array.from(carousel.querySelectorAll(".gallery-slide"));
  const dots = Array.from(carousel.querySelectorAll(".gallery-dot"));
  const previousButton = carousel.querySelector(".gallery-control-previous");
  const nextButton = carousel.querySelector(".gallery-control-next");
  let activeIndex = slides.findIndex((slide) => slide.classList.contains("is-active"));

  function showSlide(index) {
    activeIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeIndex;
      slide.setAttribute("aria-hidden", String(!isActive));
      slide.classList.toggle("is-active", isActive);
      dots[slideIndex].setAttribute("aria-current", String(isActive));
    });
  }

  previousButton.addEventListener("click", () => showSlide(activeIndex - 1));
  nextButton.addEventListener("click", () => showSlide(activeIndex + 1));

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => showSlide(index));
  });

  showSlide(activeIndex < 0 ? 0 : activeIndex);
}

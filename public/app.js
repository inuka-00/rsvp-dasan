document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // 1. High-Performance IntersectionObserver for Scroll Animations (Zero Jitter)
  // ==========================================================================
  const scrollElements = document.querySelectorAll('.scroll-reveal');

  if ('IntersectionObserver' in window) {
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.08
    };

    const scrollObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          observer.unobserve(entry.target); // Unobserve once revealed to save resources
        }
      });
    }, observerOptions);

    scrollElements.forEach((el) => scrollObserver.observe(el));
  } else {
    // Fallback for non-supporting browsers
    scrollElements.forEach((el) => el.classList.add('active'));
  }

  // ==========================================================================
  // 2. Invitation Card Lightbox Zoom
  // ==========================================================================
  const invitationContainer = document.querySelector('.invitation-card-container');
  const lightbox = document.getElementById('invitation-lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.querySelector('.lightbox-close');

  if (invitationContainer && lightbox && lightboxImg) {
    invitationContainer.addEventListener('click', () => {
      const cardImg = invitationContainer.querySelector('.invitation-image');
      lightbox.style.display = 'flex';
      lightboxImg.src = cardImg.src;
      document.body.style.overflow = 'hidden'; // Stop scrolling background
    });

    const closeLightbox = () => {
      lightbox.style.display = 'none';
      document.body.style.overflow = 'auto'; // Re-enable scroll
    };

    if (lightboxClose) {
      lightboxClose.addEventListener('click', closeLightbox);
    }
    
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.style.display === 'flex') {
        closeLightbox();
      }
    });
  }
});

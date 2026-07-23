document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // 1. Scroll Reveal Animations
  // ==========================================================================
  const scrollElements = document.querySelectorAll('.scroll-reveal');

  const elementInView = (el, dividend = 1) => {
    const elementTop = el.getBoundingClientRect().top;
    return (
      elementTop <= (window.innerHeight || document.documentElement.clientHeight) / dividend
    );
  };

  const displayScrollElement = (element) => {
    element.classList.add('active');
  };

  const handleScrollAnimation = () => {
    scrollElements.forEach((el) => {
      if (elementInView(el, 1.15)) {
        displayScrollElement(el);
      }
    });
  };

  // Add scroll listener and run once at start
  window.addEventListener('scroll', () => {
    handleScrollAnimation();
  });
  handleScrollAnimation(); // Trigger initially for elements in view on load

  // Active state for elements already in viewport
  setTimeout(() => {
    const heroElements = document.querySelectorAll('.hero-section .fade-in');
    heroElements.forEach(el => el.style.opacity = '1');
  }, 100);

  // ==========================================================================
  // 2. Audio Player Toggle
  // ==========================================================================
  const audio = document.getElementById('wedding-music');
  const audioBtn = document.getElementById('audio-btn');
  const playIcon = audioBtn.querySelector('.play-icon');
  const pauseIcon = audioBtn.querySelector('.pause-icon');

  // Reduce volume to a pleasant background level
  audio.volume = 0.35;

  audioBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        audioBtn.classList.add('playing');
      }).catch(err => {
        console.log("Audio autoplay prevented by browser:", err);
      });
    } else {
      audio.pause();
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
      audioBtn.classList.remove('playing');
    }
  });

  // Try to start music on first user click anywhere if they haven't explicitly paused it
  let firstInteraction = true;
  document.body.addEventListener('click', () => {
    if (firstInteraction && audio.paused && !audioBtn.classList.contains('manually-paused')) {
      // Don't autoplay unless they clicked something else, but we don't force it to avoid annoyance
      firstInteraction = false;
    }
  }, { once: true });

  // ==========================================================================
  // 3. Invitation Card Lightbox Zoom
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

    lightboxClose.addEventListener('click', closeLightbox);
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

  // ==========================================================================
  // 4. RSVP Form Submission
  // ==========================================================================
  const rsvpForm = document.getElementById('rsvp-form');
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const spinner = submitBtn.querySelector('.spinner');
  const successCard = document.getElementById('rsvp-success');
  const successMsg = document.getElementById('success-message');
  const whatsappBtn = document.getElementById('whatsapp-btn');

  rsvpForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const guestNameInput = document.getElementById('guest_name');
    const guestName = guestNameInput.value.trim();
    
    // Get checked status radio button value
    const statusRadio = rsvpForm.querySelector('input[name="status"]:checked');
    const status = statusRadio ? statusRadio.value : 'Accepted';

    if (!guestName) {
      alert('Please enter your name.');
      return;
    }

    // Show loading spinner
    submitBtn.disabled = true;
    btnText.style.opacity = '0.5';
    spinner.classList.remove('hidden');

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ guest_name: guestName, status })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Form submission success
        rsvpForm.classList.add('hidden');
        successCard.classList.remove('hidden');

        // Set tailored success message
        if (status === 'Accepted') {
          successMsg.textContent = `Thank you, ${guestName}! We are thrilled that you'll be celebrating with us.`;
        } else {
          successMsg.textContent = `Thank you, ${guestName}. We are sorry you won't be able to make it, but we appreciate you letting us know.`;
        }

        // WhatsApp integration
        let waMessage = '';
        if (status === 'Accepted') {
          waMessage = `Hi! This is ${guestName}. I'm happy to confirm that I'll be attending your wedding. Looking forward to celebrating with you!`;
        } else {
          waMessage = `Hi! This is ${guestName}. Unfortunately, I won't be able to attend your wedding. Wishing you both a wonderful celebration and a lifetime of happiness.`;
        }

        const cleanPhone = result.groomPhone ? result.groomPhone.replace(/\D/g, '') : '';
        const encodedText = encodeURIComponent(waMessage);
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

        whatsappBtn.href = whatsappUrl;

        // Auto-redirect if mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile && cleanPhone) {
          setTimeout(() => {
            window.location.href = whatsappUrl;
          }, 1500); // 1.5 seconds delay so they read the submission success message
        }
      } else {
        throw new Error(result.error || 'Server error saving RSVP');
      }
    } catch (error) {
      console.error('RSVP submission error:', error);
      alert(error.message || 'An error occurred while submitting your RSVP. Please try again.');
    } finally {
      // Re-enable button state
      submitBtn.disabled = false;
      btnText.style.opacity = '1';
      spinner.classList.add('hidden');
    }
  });
});

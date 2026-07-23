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

  // ==========================================================================
  // 3. RSVP Form Submission
  // ==========================================================================
  const rsvpForm = document.getElementById('rsvp-form');
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn ? submitBtn.querySelector('.btn-text') : null;
  const spinner = submitBtn ? submitBtn.querySelector('.spinner') : null;
  const successCard = document.getElementById('rsvp-success');
  const successMsg = document.getElementById('success-message');
  const whatsappBtn = document.getElementById('whatsapp-btn');

  if (rsvpForm) {
    rsvpForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const guestNameInput = document.getElementById('guest_name');
      const guestName = guestNameInput ? guestNameInput.value.trim() : '';

      const commentInput = document.getElementById('comment');
      const comment = commentInput ? commentInput.value.trim() : '';
      
      // Get checked status radio button value
      const statusRadio = rsvpForm.querySelector('input[name="status"]:checked');
      const status = statusRadio ? statusRadio.value : 'Accepted';

      if (!guestName) {
        alert('Please enter your name.');
        return;
      }

      // Show loading spinner
      if (submitBtn) submitBtn.disabled = true;
      if (btnText) btnText.style.opacity = '0.5';
      if (spinner) spinner.classList.remove('hidden');

      try {
        const response = await fetch('/api/rsvp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ guest_name: guestName, status, comment })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Form submission success
          rsvpForm.classList.add('hidden');
          if (successCard) successCard.classList.remove('hidden');

          // Smoothly scroll to center the success card in the viewport
          if (successCard) {
            successCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }

          // Set tailored success message
          if (successMsg) {
            if (status === 'Accepted') {
              successMsg.textContent = `Thank you, ${guestName}! We are thrilled that you'll be celebrating with us.`;
            } else {
              successMsg.textContent = `Thank you, ${guestName}. We are sorry you won't be able to make it, but we appreciate you letting us know.`;
            }
          }

          // Store RSVP submission data for dynamic WhatsApp link building
          const bridePhone = result.bridePhone || result.groomPhone || '';
          const groomPhone = result.groomPhone || '';
          const brideName = result.brideName || 'Sharmila';
          const groomName = result.groomName || 'Dasan';

          const updateWhatsAppLink = () => {
            if (!whatsappBtn) return;
            const recipientRadio = document.querySelector('input[name="wa_recipient"]:checked');
            const targetRecipient = recipientRadio ? recipientRadio.value : 'groom';

            const targetPhone = targetRecipient === 'bride' ? bridePhone : groomPhone;
            const targetName = targetRecipient === 'bride' ? brideName : groomName;
            const cleanPhone = targetPhone ? targetPhone.replace(/\D/g, '') : '';

            let waMessage = '';
            if (status === 'Accepted') {
              waMessage = `Hi ${targetName}! This is ${guestName}. I'm happy to confirm that I'll be attending your wedding. Looking forward to celebrating with you!`;
            } else {
              waMessage = `Hi ${targetName}! This is ${guestName}. Unfortunately, I won't be able to attend your wedding. Wishing you both a wonderful celebration and a lifetime of happiness.`;
            }

            if (comment) {
              waMessage += `\n\nMessage: "${comment}"`;
            }

            const encodedText = encodeURIComponent(waMessage);
            const whatsappUrl = cleanPhone 
              ? `https://wa.me/${cleanPhone}?text=${encodedText}`
              : `https://wa.me/?text=${encodedText}`;

            whatsappBtn.href = whatsappUrl;
          };

          // Initial link setup
          updateWhatsAppLink();

          // Update link whenever guest toggles between Groom and Bride
          const recipientRadios = document.querySelectorAll('input[name="wa_recipient"]');
          recipientRadios.forEach(radio => {
            radio.addEventListener('change', updateWhatsAppLink);
          });
        } else {
          throw new Error(result.error || 'Server error saving RSVP');
        }
      } catch (error) {
        console.error('RSVP submission error:', error);
        alert(error.message || 'An error occurred while submitting your RSVP. Please try again.');
      } finally {
        // Re-enable button state
        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.style.opacity = '1';
        if (spinner) spinner.classList.add('hidden');
      }
    });
  }
});

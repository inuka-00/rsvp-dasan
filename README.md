# Sharmila & Dasan's Wedding Invitation Website

A modern, elegant, single-page wedding invitation website featuring a custom RSVP portal, an interactive location finder, and a secure password-protected administrator dashboard.

Optimized first and foremost for mobile clients to ensure a seamless experience when guests open the invite from mobile messaging apps (WhatsApp, SMS, Email).

---

## 🌟 Key Features

1. **Hero Section**: Responsive fullscreen landing with smooth animation, elegant typography, overlay, and scroll down anchor.
2. **Invitation Section**: Interactive image display containing the official high-resolution invitation card. Click/tap opens an immersive, sleek lightbox modal for full-size inspection.
3. **RSVP Section**: Beautiful custom styled input form with options for "Joyfully Accept" and "Regretfully Decline" including instant validation and interactive animations.
4. **WhatsApp Deep-Link Integration**: After successful RSVP submission, mobile clients are automatically redirected to WhatsApp with a pre-filled, customized RSVP confirmation message addressed to the groom. Desktop/manual triggers are also provided.
5. **Location Section**: Immersive Google Map embed of the venue, along with address copy and a button to open coordinates directly in Google Maps.
6. **Background Melodies**: Floating audio player to toggle ambient wedding music.
7. **Admin Dashboard**: Secured via a password-protected admin portal (`/admin`) utilizing HttpOnly JWT token verification. Shows analytics (attending vs declining stats), full search and multi-filtering on names/responses, live multi-column sorting, and direct CSV exporting.
8. **Robust Database Layer**: Persisted locally via a lightweight, concurrent SQLite schema.

---

## 🎨 Design Theme & Aesthetics

* **Color Palette**: Classic wedding palette utilizing Whites, Creams (`#FDFBF7`), Beige textures, and Blush Pinks (`#F7EBE1`), highlighted with Metallic Gold accents (`#C5A880`).
* **Typography**:
  * Headings: Elegant Serif headings via **Playfair Display**.
  * Body: Clean, highly-readable Sans-Serif via **Montserrat**.
  * Signatures & Highlights: Fluid, organic cursive via **Great Vibes**.
* **Micro-interactions**: Subtle hover scaling on interactive items, color transitions, card-glow gradients, fade-in loading animations, and lazy loading assets to protect cellular data limits.

---

## 📁 Project Structure

```text
├── db.js              # Database connection and table schema definition
├── package.json       # Dependencies and npm script runner configuration
├── server.js          # Express app server, JWT middleware, CSV-writer, and routes
├── wedding.db         # SQLite database file (created automatically on startup)
├── .env               # Configuration variables (ports, passwords, and phone numbers)
└── public/            # Static assets
    ├── admin.html     # Secure dashboard template
    ├── admin.js       # Search, filter, sort logic, and token validation
    ├── app.js         # Animation observer, audio logic, form-to-whatsapp flow
    ├── index.html     # Main wedding invitation page
    ├── style.css      # Core Vanilla CSS layout rules, animations, and design tokens
    └── images/        # Media assets
        ├── hero-bg.jpg    # Generated watercolor couple photo background
        └── invitation.jpg # Generated premium invitation card card image
```

---

## 🛠️ Installation & Setup

### 1. Prerequisites
Ensure you have **Node.js (v18+)** and **npm** installed on your machine.

### 2. Environment Configurations
Create or open the `.env` file in the root folder. You can configure:
```ini
PORT=3000
ADMIN_PASSWORD=loveisintheair2026            # Used to unlock the admin dashboard
JWT_SECRET=sharmila_dasan_wedding_jwt_secret    # Signed key for dashboard cookie verification
GROOM_PHONE=15550199                         # Groom's WhatsApp phone number (with country code, no space/signs)
```

### 3. Launching the App
In the terminal, run:
```bash
npm start
```
The server will boot and open a database instance. Access the app locally:
* **Guests Page**: [http://localhost:3000](http://localhost:3000)
* **Admin Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🔒 Security Practices

1. **Password Authentication**: Checks against hashed variables in state, validating with signed JSON Web Tokens (JWT).
2. **HttpOnly Cookies**: The authentication token cookie is flagged as `HttpOnly`, protecting it against Cross-Site Scripting (XSS) token theft.
3. **Data Protection**: All RSVP read (`/api/admin/rsvps`) and write-to-disk CSV export (`/api/admin/export`) routes check the cookie token before fetching SQL data.
4. **XSS Protection**: Guest names input during RSVPs are fully HTML escaped before being rendered inside the admin panel.

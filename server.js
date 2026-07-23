require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { insertRsvp, getRsvps, getRsvpStats } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Helper function to serve HTML with environmental variables dynamically injected
function serveHtmlWithEnv(filePath, res) {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading HTML file:', err);
      return res.status(500).send('Error loading page');
    }
    const bride = process.env.BRIDE_NAME || 'Sharmila';
    const groom = process.env.GROOM_NAME || 'Dasan';
    
    const modified = data
      .replace(/{{BRIDE_NAME}}/g, bride)
      .replace(/{{GROOM_NAME}}/g, groom);
      
    res.setHeader('Content-Type', 'text/html');
    res.send(modified);
  });
}

// Routes to serve main pages dynamically with env variables
app.get(['/', '/index.html'], (req, res) => {
  serveHtmlWithEnv(path.join(__dirname, 'public', 'index.html'), res);
});

app.get(['/admin', '/admin.html'], (req, res) => {
  serveHtmlWithEnv(path.join(__dirname, 'public', 'admin.html'), res);
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Middleware
function authenticateAdmin(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.isAdmin) {
      req.admin = true;
      next();
    } else {
      res.status(403).json({ success: false, error: 'Forbidden: Invalid role' });
    }
  } catch (err) {
    res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
}

// Check admin authentication status (useful for frontend checks)
app.get('/api/admin/check', (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.json({ authenticated: false });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ authenticated: !!decoded.isAdmin });
  } catch (err) {
    return res.json({ authenticated: false });
  }
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, error: 'Password is required' });
  }

  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ isAdmin: true }, JWT_SECRET, { expiresIn: '1d' });
    // Set token as HttpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    return res.json({ success: true, message: 'Logged in successfully' });
  } else {
    return res.status(401).json({ success: false, error: 'Incorrect password' });
  }
});

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Submit RSVP
app.post('/api/rsvp', async (req, res) => {
  const { guest_name, status, comment } = req.body;

  // Validation
  if (!guest_name || typeof guest_name !== 'string' || guest_name.trim() === '') {
    return res.status(400).json({ success: false, error: 'Guest name is required.' });
  }

  const normalizedStatus = status === 'Accepted' || status === 'Declined' ? status : null;
  if (!normalizedStatus) {
    return res.status(400).json({ success: false, error: "Response must be 'Accepted' or 'Declined'." });
  }

  const cleanComment = typeof comment === 'string' ? comment.trim() : '';

  try {
    await insertRsvp(guest_name.trim(), normalizedStatus, cleanComment);

    res.json({ 
      success: true, 
      message: 'RSVP saved successfully!',
      groomPhone: process.env.GROOM_PHONE || ''
    });
  } catch (err) {
    console.error('Error saving RSVP:', err);
    res.status(500).json({ success: false, error: 'An error occurred while saving your response. Please try again.' });
  }
});

// Get RSVP List and Statistics (Admin)
app.get('/api/admin/rsvps', authenticateAdmin, async (req, res) => {
  try {
    const stats = await getRsvpStats();
    const rsvps = await getRsvps();

    res.json({
      success: true,
      stats,
      rsvps
    });
  } catch (err) {
    console.error('Error fetching RSVPs:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve RSVPs' });
  }
});

// Export RSVPs to CSV (Admin)
app.get('/api/admin/export', authenticateAdmin, async (req, res) => {
  try {
    const rsvps = await getRsvps();

    let csvContent = 'Guest Name,RSVP Status,Message / Comment,Submission Date & Time\n';
    
    rsvps.forEach(row => {
      // Escape quotes in guest name and comment
      const nameEscaped = `"${row.guest_name.replace(/"/g, '""')}"`;
      const commentEscaped = `"${(row.comment || '').replace(/"/g, '""')}"`;
      csvContent += `${nameEscaped},${row.status},${commentEscaped},${row.created_at}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=wedding_rsvps.csv');
    res.send(csvContent);
  } catch (err) {
    console.error('Error exporting CSV:', err);
    res.status(500).send('Failed to export RSVP data');
  }
});

// Fallback to index.html for undefined frontend routes
app.use((req, res) => {
  serveHtmlWithEnv(path.join(__dirname, 'public', 'index.html'), res);
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Wedding invitation server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

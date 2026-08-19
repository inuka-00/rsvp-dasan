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

// Enable Cross-Origin Resource Sharing (CORS) for external frontend / Supabase clients
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, apikey');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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

app.get(['/seats', '/seats.html'], (req, res) => {
  serveHtmlWithEnv(path.join(__dirname, 'public', 'seats.html'), res);
});

app.get(['/admin', '/admin.html'], (req, res) => {
  serveHtmlWithEnv(path.join(__dirname, 'public', 'admin.html'), res);
});

// API endpoint to serve seating arrangement data parsed from seats.csv
app.get('/api/seats', (req, res) => {
  try {
    const csvPath = path.join(__dirname, 'public', 'docs', 'seats.csv');
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ success: false, error: 'Seats file not found' });
    }
    const csvString = fs.readFileSync(csvPath, 'utf8');
    const lines = csvString.split(/\r?\n/);
    const tablesMap = new Map();

    lines.forEach(line => {
      if (!line.trim()) return;

      const parts = [];
      let currentPart = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(currentPart);
          currentPart = '';
        } else {
          currentPart += char;
        }
      }
      parts.push(currentPart);

      if (parts.length < 2) return;

      const rawTableNo = parts[0] ? parts[0].trim() : '';
      const rawName = parts[1] ? parts[1].trim() : '';
      const rawCount = parts[2] ? parts[2].trim() : '';

      if (!rawTableNo || rawTableNo.toLowerCase() === 'table no' || !rawName) {
        return;
      }

      const tableNoKey = rawTableNo;

      if (!tablesMap.has(tableNoKey)) {
        tablesMap.set(tableNoKey, {
          tableNo: tableNoKey,
          capacity: null,
          guests: []
        });
      }

      const tableData = tablesMap.get(tableNoKey);
      tableData.guests.push(rawName);

      if (rawCount && !tableData.capacity) {
        const parsedCount = parseInt(rawCount, 10);
        if (!isNaN(parsedCount)) {
          tableData.capacity = parsedCount;
        }
      }
    });

    const tables = Array.from(tablesMap.values()).sort((a, b) => {
      const numA = parseInt(a.tableNo, 10) || 999;
      const numB = parseInt(b.tableNo, 10) || 999;
      return numA - numB;
    });

    res.json({ success: true, tables });
  } catch (err) {
    console.error('Error serving seating data:', err);
    res.status(500).json({ success: false, error: 'Failed to load seating arrangements' });
  }
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
      groomPhone: process.env.GROOM_PHONE || '',
      bridePhone: process.env.BRIDE_PHONE || process.env.GROOM_PHONE || '',
      groomName: process.env.GROOM_NAME || 'Dasan',
      brideName: process.env.BRIDE_NAME || 'Sharmila'
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

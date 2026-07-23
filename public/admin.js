document.addEventListener('DOMContentLoaded', () => {
  // State variables
  let allRSVPs = [];

  // DOM Elements - Login
  const loginContainer = document.getElementById('login-container');
  const loginForm = document.getElementById('login-form');
  const adminPassword = document.getElementById('admin-password');
  const loginError = document.getElementById('login-error');
  const loginBtn = document.getElementById('login-btn');
  const loginBtnText = loginBtn.querySelector('.btn-text');
  const loginSpinner = loginBtn.querySelector('.spinner');

  // DOM Elements - Dashboard
  const dashboardContainer = document.getElementById('dashboard-container');
  const logoutBtn = document.getElementById('logout-btn');
  const statTotal = document.getElementById('stat-total');
  const statAttending = document.getElementById('stat-attending');
  const statDeclining = document.getElementById('stat-declining');

  // DOM Elements - Controls & Table
  const searchInput = document.getElementById('search-input');
  const filterStatus = document.getElementById('filter-status');
  const sortBy = document.getElementById('sort-by');
  const tableBody = document.getElementById('table-body');
  const noResults = document.getElementById('no-results');
  const rsvpsTable = document.getElementById('rsvps-table');

  // ==========================================================================
  // 1. Authentication Checks & Login / Logout Flow
  // ==========================================================================
  
  // Check if session is already authenticated on load
  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/check');
      const result = await response.json();
      
      if (result.authenticated) {
        showDashboard();
      } else {
        showLogin();
      }
    } catch (err) {
      console.error('Error checking auth:', err);
      showLogin();
    }
  };

  const showLogin = () => {
    loginContainer.classList.remove('hidden');
    dashboardContainer.classList.add('hidden');
    adminPassword.focus();
  };

  const showDashboard = () => {
    loginContainer.classList.add('hidden');
    dashboardContainer.classList.remove('hidden');
    fetchRSVPs();
  };

  // Login handler
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = adminPassword.value;
    
    // UI Loading state
    loginError.classList.add('hidden');
    loginBtn.disabled = true;
    loginBtnText.style.opacity = '0.5';
    loginSpinner.classList.remove('hidden');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        adminPassword.value = '';
        showDashboard();
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      loginError.textContent = err.message || 'Incorrect password. Please try again.';
      loginError.classList.remove('hidden');
      adminPassword.focus();
    } finally {
      loginBtn.disabled = false;
      loginBtnText.style.opacity = '1';
      loginSpinner.classList.add('hidden');
    }
  });

  // Logout handler
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      // Reset state and show login
      allRSVPs = [];
      showLogin();
    } catch (err) {
      console.error('Logout error:', err);
      // Hard reload as fallback
      window.location.reload();
    }
  });

  // ==========================================================================
  // 2. Fetch and Cache RSVP Data
  // ==========================================================================
  const fetchRSVPs = async () => {
    try {
      const response = await fetch('/api/admin/rsvps');
      
      if (response.status === 401 || response.status === 403) {
        showLogin();
        return;
      }
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Cache the list of RSVPs
        allRSVPs = result.rsvps || [];
        
        // Update stats widgets
        updateStats(result.stats);
        
        // Apply controls (search, filters, sorting) and render
        applyControlsAndRender();
      } else {
        throw new Error(result.error || 'Failed to fetch RSVPs');
      }
    } catch (err) {
      console.error('Error fetching RSVPs:', err);
      tableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4" style="color:var(--color-danger);">Error fetching RSVPs: ${err.message}</td></tr>`;
    }
  };

  const updateStats = (stats) => {
    statTotal.textContent = stats.total;
    statAttending.textContent = stats.attending;
    statDeclining.textContent = stats.declining;
  };

  // ==========================================================================
  // 3. Search, Filter, Sort and Render Table
  // ==========================================================================
  
  const applyControlsAndRender = () => {
    const searchVal = searchInput.value.toLowerCase().trim();
    const filterVal = filterStatus.value;
    const sortVal = sortBy.value;

    // A. Filter by Search Query & Status
    let filteredData = allRSVPs.filter(item => {
      const matchesSearch = item.guest_name.toLowerCase().includes(searchVal);
      const matchesStatus = filterVal === 'all' || item.status === filterVal;
      return matchesSearch && matchesStatus;
    });

    // B. Sort
    filteredData.sort((a, b) => {
      if (sortVal === 'date-desc') {
        return new Date(b.created_at) - new Date(a.created_at);
      } else if (sortVal === 'date-asc') {
        return new Date(a.created_at) - new Date(b.created_at);
      } else if (sortVal === 'name-asc') {
        return a.guest_name.localeCompare(b.guest_name);
      } else if (sortVal === 'name-desc') {
        return b.guest_name.localeCompare(a.guest_name);
      }
      return 0;
    });

    // C. Render to table
    renderTable(filteredData);
  };

  const renderTable = (data) => {
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
      rsvpsTable.style.display = 'none';
      noResults.classList.remove('hidden');
      return;
    }

    rsvpsTable.style.display = 'table';
    noResults.classList.add('hidden');

    data.forEach(row => {
      const tr = document.createElement('tr');
      
      // Formatting date-time nicely
      const rawDate = new Date(row.created_at);
      let formattedDate = 'Invalid Date';
      if (!isNaN(rawDate)) {
        formattedDate = rawDate.toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short'
        });
      }

      // Safe HTML escaping for user guest name
      const safeName = escapeHTML(row.guest_name);
      
      // Status styling class
      const badgeClass = row.status === 'Accepted' ? 'badge-accepted' : 'badge-declined';
      const badgeText = row.status === 'Accepted' ? 'Attending' : 'Declining';

      tr.innerHTML = `
        <td style="font-weight: 500;">${safeName}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td style="color: var(--text-secondary); font-size: 0.9rem;">${formattedDate}</td>
      `;
      
      tableBody.appendChild(tr);
    });
  };

  // Helper function to escape HTML to prevent XSS in admin panel
  const escapeHTML = (str) => {
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  };

  // ==========================================================================
  // 4. Attach Event Listeners
  // ==========================================================================
  searchInput.addEventListener('input', applyControlsAndRender);
  filterStatus.addEventListener('change', applyControlsAndRender);
  sortBy.addEventListener('change', applyControlsAndRender);

  // Initialize
  checkAuth();
});

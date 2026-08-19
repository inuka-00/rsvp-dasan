document.addEventListener('DOMContentLoaded', () => {
  let allTablesData = [];
  let selectedTableFilter = 'all';

  const searchInput = document.getElementById('seat-search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  const statusEl = document.getElementById('search-status');
  const loadingEl = document.getElementById('seats-loading');
  const noResultsEl = document.getElementById('no-results');
  const noResultsMsg = document.getElementById('no-results-msg');
  const searchedTermEl = document.getElementById('searched-term');
  const resetBtn = document.getElementById('reset-search-btn');
  const tablesContainer = document.getElementById('tables-container');
  const pillsContainer = document.getElementById('table-pills-container');

  // Load Seating Data
  async function loadSeatingData() {
    try {
      const response = await fetch('/api/seats');
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.tables)) {
          allTablesData = data.tables;
          initPage();
          return;
        }
      }
      // Fallback to reading CSV directly if API fails
      await loadFromCsvFallback();
    } catch (err) {
      console.warn('API fetch error, trying CSV fallback:', err);
      await loadFromCsvFallback();
    }
  }

  async function loadFromCsvFallback() {
    try {
      const response = await fetch('/docs/seats.csv');
      if (!response.ok) throw new Error('Failed to load CSV file');
      const csvText = await response.text();
      allTablesData = parseCsvString(csvText);
      initPage();
    } catch (err) {
      console.error('Error loading seating CSV:', err);
      if (loadingEl) loadingEl.classList.add('hidden');
      if (statusEl) statusEl.innerHTML = '<span class="status-error">Error loading seating arrangements. Please try again later.</span>';
    }
  }

  function parseCsvString(csvString) {
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

      if (!rawTableNo || rawTableNo.toLowerCase() === 'table no' || !rawName) return;

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
        if (!isNaN(parsedCount)) tableData.capacity = parsedCount;
      }
    });

    return Array.from(tablesMap.values()).sort((a, b) => {
      const numA = parseInt(a.tableNo, 10) || 999;
      const numB = parseInt(b.tableNo, 10) || 999;
      return numA - numB;
    });
  }

  function initPage() {
    if (loadingEl) loadingEl.classList.add('hidden');
    renderTablePills();
    renderTables();
  }

  // Render Horizontal Filter Pills
  function renderTablePills() {
    if (!pillsContainer) return;
    pillsContainer.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `table-pill ${selectedTableFilter === 'all' ? 'active' : ''}`;
    allBtn.textContent = 'All Tables';
    allBtn.dataset.table = 'all';
    allBtn.addEventListener('click', () => selectFilter('all'));
    pillsContainer.appendChild(allBtn);

    allTablesData.forEach(tbl => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `table-pill ${selectedTableFilter === String(tbl.tableNo) ? 'active' : ''}`;
      pill.textContent = `Table ${tbl.tableNo}`;
      pill.dataset.table = String(tbl.tableNo);
      pill.addEventListener('click', () => selectFilter(String(tbl.tableNo)));
      pillsContainer.appendChild(pill);
    });
  }

  function selectFilter(tableNoStr) {
    selectedTableFilter = tableNoStr;
    document.querySelectorAll('.table-pill').forEach(pill => {
      if (pill.dataset.table === tableNoStr) {
        pill.classList.add('active');
        pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } else {
        pill.classList.remove('active');
      }
    });
    // Clear search input if pill manually clicked
    if (tableNoStr !== 'all' && searchInput) {
      searchInput.value = '';
      if (clearBtn) clearBtn.classList.add('hidden');
    }
    renderTables();
  }

  // Helper function to test if guest name matches search query
  function isMatch(guestName, query) {
    if (!query) return false;
    const cleanGuest = guestName.toLowerCase();
    const cleanQuery = query.toLowerCase().trim();

    // Direct substring match
    if (cleanGuest.includes(cleanQuery)) return true;

    // Check individual search terms (e.g., "kasuni wijeratne")
    const terms = cleanQuery.split(/\s+/).filter(t => t.length > 0);
    if (terms.length > 1) {
      return terms.every(t => cleanGuest.includes(t));
    }

    return false;
  }

  // Render Tables based on Search & Pill Filters
  function renderTables() {
    const rawQuery = searchInput ? searchInput.value.trim() : '';
    const isSearchActive = rawQuery.length > 0;

    if (clearBtn) {
      if (isSearchActive) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }

    let filteredTables = [];
    let totalMatchedGuests = 0;

    allTablesData.forEach(tbl => {
      const tableNoStr = String(tbl.tableNo);

      // Check if user selected a pill filter
      if (selectedTableFilter !== 'all' && selectedTableFilter !== tableNoStr) {
        return;
      }

      if (!isSearchActive) {
        filteredTables.push({
          ...tbl,
          matchedGuests: []
        });
      } else {
        // Search query logic
        const queryLower = rawQuery.toLowerCase();
        const isTableNumMatch = queryLower === tableNoStr || 
                                queryLower === `table ${tableNoStr}` || 
                                queryLower === `t${tableNoStr}` ||
                                queryLower === `t ${tableNoStr}`;

        const matchedGuestIndices = [];
        tbl.guests.forEach((g, idx) => {
          if (isMatch(g, rawQuery) || isTableNumMatch) {
            matchedGuestIndices.push(idx);
          }
        });

        if (matchedGuestIndices.length > 0 || isTableNumMatch) {
          totalMatchedGuests += matchedGuestIndices.length;
          filteredTables.push({
            ...tbl,
            matchedGuestIndices
          });
        }
      }
    });

    // Update Status Bar
    if (statusEl) {
      if (isSearchActive) {
        if (filteredTables.length > 0) {
          statusEl.innerHTML = `<span class="status-highlight">Found ${filteredTables.length} table${filteredTables.length > 1 ? 's' : ''} matching "${rawQuery}"</span>`;
        } else {
          statusEl.innerHTML = `<span>No matches found for "${rawQuery}"</span>`;
        }
      } else if (selectedTableFilter !== 'all') {
        const targetTbl = allTablesData.find(t => String(t.tableNo) === selectedTableFilter);
        const guestCount = targetTbl ? targetTbl.guests.length : 0;
        statusEl.innerHTML = `<span>Showing <strong>Table ${selectedTableFilter}</strong> (${guestCount} guest entries)</span>`;
      } else {
        const totalGuests = allTablesData.reduce((acc, t) => acc + t.guests.length, 0);
        statusEl.innerHTML = `<span>Showing all <strong>${allTablesData.length} tables</strong> (${totalGuests} guest entries)</span>`;
      }
    }

    // Handle Empty Search Results
    if (isSearchActive && filteredTables.length === 0) {
      tablesContainer.innerHTML = '';
      if (noResultsEl) {
        noResultsEl.classList.remove('hidden');
        if (searchedTermEl) searchedTermEl.textContent = rawQuery;
      }
      return;
    }

    if (noResultsEl) noResultsEl.classList.add('hidden');

    // Render Table Cards
    let html = '';
    filteredTables.forEach(tbl => {
      const hasMatch = isSearchActive && tbl.matchedGuestIndices && tbl.matchedGuestIndices.length > 0;
      const cardClass = hasMatch ? 'seat-table-card card-glow has-matched-guest' : 'seat-table-card card-glow';
      const guestCount = tbl.guests.length;

      html += `
        <div class="${cardClass}" id="table-card-${tbl.tableNo}">
          <div class="table-card-header">
            <div class="table-badge">
              <span class="table-badge-prefix">TABLE</span>
              <span class="table-badge-num">${tbl.tableNo}</span>
            </div>
            <div class="table-info">
              <h2 class="table-name">Table ${tbl.tableNo}</h2>
              <span class="table-capacity">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                ${tbl.capacity ? `${tbl.capacity} Seats (${guestCount} Entries)` : `${guestCount} Guest Entries`}
              </span>
            </div>
          </div>
          
          <div class="table-card-divider"></div>
          
          <div class="seated-guests-header">
            <span class="seated-title">Seated Guests (${guestCount}):</span>
          </div>

          <div class="seat-guest-list">
      `;

      tbl.guests.forEach((guestName, idx) => {
        const isThisGuestMatched = isSearchActive && tbl.matchedGuestIndices && tbl.matchedGuestIndices.includes(idx);
        const itemClass = isThisGuestMatched ? 'seat-guest-item is-matched' : 'seat-guest-item';

        html += `
          <div class="${itemClass}">
            <div class="guest-avatar ${isThisGuestMatched ? 'avatar-matched' : ''}">
              ${isThisGuestMatched ? '&#10003;' : (idx + 1)}
            </div>
            <div class="guest-details">
              <div class="guest-name-text">${escapeHtml(guestName)}</div>
              ${isThisGuestMatched ? '<span class="matched-tag">&#10024; Matched Guest</span>' : ''}
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    tablesContainer.innerHTML = html;

    // Scroll to first match if user searched
    if (isSearchActive && filteredTables.length > 0) {
      const firstMatchedCard = document.querySelector('.has-matched-guest');
      if (firstMatchedCard) {
        firstMatchedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Event Listeners for Search & Reset
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (selectedTableFilter !== 'all') {
        selectedTableFilter = 'all';
        document.querySelectorAll('.table-pill').forEach(p => {
          if (p.dataset.table === 'all') p.classList.add('active');
          else p.classList.remove('active');
        });
      }
      renderTables();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      clearBtn.classList.add('hidden');
      renderTables();
      if (searchInput) searchInput.focus();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      selectedTableFilter = 'all';
      renderTablePills();
      renderTables();
    });
  }

  // Initialize
  loadSeatingData();
});

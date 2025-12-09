

window.Search = (function () {
    const API_INIT = '/api/search/init';   
    const API_LIVE = '/api/search/live';     
    const MIN_QUERY = 3;
    const DEBOUNCE_MS = 300;
    const RECENT_COOKIE = 'recentlyViewedV1';
    const RECENT_LIMIT = 12;
  
    // local state
    let filters = { category: new Set(), brand: new Set() };
    let initDone = false;
    let debounceTimer = null;
    let modalEl = null;
  
    function getCookie(name) {
      const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
      return v ? decodeURIComponent(v.pop()) : null;
    }
    function setCookie(name, value, days = 365) {
      const expires = new Date(Date.now() + days*864e5).toUTCString();
      document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
    }
  
    function readRecentlyViewed() {
      const raw = getCookie(RECENT_COOKIE);
      try {
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.slice(0, RECENT_LIMIT) : [];
      } catch (e) {
        return [];
      }
    }
    function pushRecentlyViewed(product) {
   
      if (!product || !product._id) return;
      const arr = readRecentlyViewed();

      const filtered = arr.filter(p => p._id !== product._id);
      filtered.unshift(product);
      setCookie(RECENT_COOKIE, JSON.stringify(filtered.slice(0, RECENT_LIMIT)));
    }
  

    function $id(id) { return document.getElementById(id); }
    function createChip(text, value, type) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-outline-secondary search-filter-chip';
      btn.textContent = text;
      btn.dataset.filter = type;
      btn.dataset.value = value;
      btn.onclick = () => toggleFilter(btn);
      return btn;
    }
  

    function renderFilters(payload) {
      const categoryContainer = $id('searchCategoryContainer');
      const brandContainer = $id('searchBrandContainer');
      if (!categoryContainer || !brandContainer) return;
  
      categoryContainer.innerHTML = '';
      brandContainer.innerHTML = '';
  
  
      (payload.categories || []).forEach(c => {
        const chip = createChip(c.name, c._id || c.slug || c.name, 'category');
        categoryContainer.appendChild(chip);
      });
  
      (payload.brands || []).forEach(b => {
        const chip = createChip(b, b, 'brand');
        brandContainer.appendChild(chip);
      });
  

      renderRecentlyViewed(payload.recentlyViewed || []);
    }
  
    function renderRecentlyViewed(items) {
      const wrap = $id('searchRecentlyViewed');
      if (!wrap) return;
      wrap.innerHTML = '';
      const arr = items.length ? items : readRecentlyViewed();
  
      arr.forEach(p => {
        const a = document.createElement('a');
        a.href = `/productDetails/${p.slug}`;
        a.className = 'badge bg-light text-dark p-2';
        a.style.maxWidth = '180px';
        a.style.display = 'inline-flex';
        a.style.alignItems = 'center';
        a.style.gap = '8px';
        a.innerHTML = `<img src="${(p.images && p.images[0]) || '/images/no-image.png'}" style="width:38px;height:38px;object-fit:cover;border-radius:6px;"> <span style="font-size:0.9rem">${p.title}</span>`;
  
        a.addEventListener('click', () => {
          try { pushRecentlyViewed({ _id:p._id, slug:p.slug, title:p.title, images:p.images }); } catch(e) {}
        });
        wrap.appendChild(a);
      });
    }
  
    function renderSuggestions(text) {
      const sug = $id('searchSuggestions');
      if (!sug) return;
      sug.textContent = text;
    }
  
    function renderResults(payload) {
      const container = $id('searchResultsContainer');
      container.innerHTML = '';
  
      if (!payload || (!payload.products || payload.products.length === 0) && (!payload.categories || payload.categories.length === 0)) {
        container.innerHTML = '<div class="text-muted small">No results</div>';
        return;
      }
  

      if ((payload.categories || []).length || (payload.subcategories || []).length || (payload.childcategories || []).length) {
        const header = document.createElement('div');
        header.className = 'mb-2';
        header.innerHTML = '<strong>Categories</strong>';
        container.appendChild(header);
  
        const catWrap = document.createElement('div');
        catWrap.className = 'd-flex flex-wrap gap-2 mb-3';
        [...(payload.categories||[]), ...(payload.subcategories||[]), ...(payload.childcategories||[])].forEach(c => {
          const a = document.createElement('a');
          a.href = `/products?category=${c.slug || c._id}`;
          a.className = 'badge bg-light text-dark p-2';
          a.textContent = c.name;
          catWrap.appendChild(a);
        });
        container.appendChild(catWrap);
      }
  

      if (payload.products && payload.products.length) {
        const header = document.createElement('div');
        header.className = 'mb-2';
        header.innerHTML = '<strong>Products</strong>';
        container.appendChild(header);
  
        payload.products.forEach(p => {
          const item = document.createElement('a');
          item.href = `/product/${p.slug}`;
          item.className = 'list-group-item list-group-item-action d-flex align-items-center gap-3';
          const img = (p.images && p.images[0]) ? p.images[0] : '/images/no-image.png';
          const price = p.salePrice || p.basePrice || '';
          item.innerHTML = `
            <img src="${img}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;">
            <div class="flex-grow-1">
              <div style="font-weight:600">${p.title}</div>
              <div class="small text-muted">${p.brand || ''}</div>
            </div>
            <div style="min-width:90px;text-align:right;">
              <div style="font-weight:700">₹${price}</div>
            </div>
          `;
   
          item.addEventListener('click', () => {
            pushRecentlyViewed({ _id:p._id, slug:p.slug, title:p.title, images:p.images || [] });
          });
          container.appendChild(item);
        });
      }
    }
  
    // Filters control
    function toggleFilter(el) {
      const type = el.dataset.filter;
      const value = el.dataset.value;
      if (!type || !value) return;
      if (el.classList.contains('active')) {
        el.classList.remove('active');
        filters[type].delete(value);
      } else {
        el.classList.add('active');
        filters[type].add(value);
      }
      updateFilterBadge();

      const q = $id('searchInput').value.trim();
      if (q.length >= MIN_QUERY) scheduleLiveSearch(q);
    }
  
    function updateFilterBadge() {
      const count = filters.category.size + filters.brand.size;
      const badge = $id('searchFilterCount');
      const clearBtn = $id('searchClearFiltersBtn');
      if (count > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = count;
        clearBtn.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
        clearBtn.style.display = 'none';
      }
    }
  
    function clearAllFilters() {
      filters = { category: new Set(), brand: new Set() };
      document.querySelectorAll('.search-filter-chip.active').forEach(el => el.classList.remove('active'));
      updateFilterBadge();

      const q = $id('searchInput').value.trim();
      if (q.length >= MIN_QUERY) scheduleLiveSearch(q);
    }
  
    function scheduleLiveSearch(q) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => doLiveSearch(q), DEBOUNCE_MS);
    }
  
    async function doLiveSearch(q) {
      if (!q || q.length < MIN_QUERY) {
        renderSuggestions('Type at least 3 characters');
        $id('searchResultsContainer').innerHTML = '';
        return;
      }
      renderSuggestions('Searching...');
  
      const categoryList = Array.from(filters.category).join(',');
      const brandList = Array.from(filters.brand).join(',');
  
      const url = `${API_LIVE}?q=${encodeURIComponent(q)}&category=${encodeURIComponent(categoryList)}&brand=${encodeURIComponent(brandList)}`;
      try {
        const res = await fetch(url);
        const payload = await res.json();
        if (payload && payload.success) {
          renderSuggestions('');
          renderResults(payload);
        } else {
          renderSuggestions('No results');
          $id('searchResultsContainer').innerHTML = '';
        }
      } catch (err) {
        console.error('Search error', err);
        renderSuggestions('Search failed');
      }
    }
  
    async function onModalOpen() {
      if (initDone) return;

      $id('searchFilterSection').style.display = 'block';
      renderFilters({ categories: [], brands: [], recentlyViewed: readRecentlyViewed() });
      try {
        const res = await fetch(API_INIT);
        const payload = await res.json();
        if (payload && payload.success) {
          renderFilters(payload);
        }
      } catch (err) {
        console.error('search init error', err);
      } finally {
        initDone = true;
      }
    }
  
    // Attach events
    function attachEvents() {
      if (!modalEl) modalEl = document.getElementById('search');
      if (!modalEl) return;
  
      modalEl.addEventListener('shown.bs.modal', () => {
        onModalOpen();
        const input = $id('searchInput');
        input && input.focus();
      });
  

      const input = $id('searchInput');
      input && input.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        if (q.length >= MIN_QUERY) scheduleLiveSearch(q);
        else {
  
          if ($id('searchResultsContainer')) $id('searchResultsContainer').innerHTML = '';
          renderSuggestions('Type at least 3 characters');
        }
      });
  

      const form = $id('searchForm');
      form && form.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = $id('searchInput').value.trim();
        if (q.length >= MIN_QUERY) doLiveSearch(q);
      });
    }
  
    return {
      init: function () {

        attachEvents();
      },
      toggleFilterSection: function () {
        const el = $id('searchFilterSection');
        if (!el) return;
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
      },
      clearAllFilters: clearAllFilters
    };
  })();
  

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof Search !== 'undefined') Search.init();
  });
  
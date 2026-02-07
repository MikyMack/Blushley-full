

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
          item.href = `/productDetails/${p.slug}`;
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

      // $id('searchFilterSection').style.display = 'block';
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
        const toggleBtn = $id('searchFilterToggleBtn');
        if (!el) return;
        
        const isHidden = el.style.display === 'none' || !el.style.display;
        
        if (isHidden) {
   
          el.style.display = 'block';
      
          toggleBtn.classList.add('active');
        } else {
       
          el.style.display = 'none';
          toggleBtn.classList.remove('active');
        }
      },
      clearAllFilters: clearAllFilters
    };
  })();
  
// Add this script to your page or include in a separate JS file
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('categorySearch');
  const searchResults = document.getElementById('searchResults');
  const categoriesGrid = document.getElementById('categoriesGrid');
  const categories = document.querySelectorAll('.mega-category');
  
  // Toggle subcategories
  categories.forEach(category => {
      const toggleBtn = category.querySelector('.toggle-subcategories');
      const subWrapper = category.querySelector('.subcategories-wrapper');
      
      if (toggleBtn && subWrapper) {
          toggleBtn.addEventListener('click', () => {
              subWrapper.classList.toggle('expanded');
              toggleBtn.classList.toggle('active');
              toggleBtn.textContent = subWrapper.classList.contains('expanded') ? '−' : '+';
          });
      }
  });
  
  // Search functionality
  if (searchInput) {
      searchInput.addEventListener('input', debounce(handleSearch, 300));
      searchInput.addEventListener('focus', showAllResults);
      document.addEventListener('click', closeResultsOnClickOutside);
  }
  
  function handleSearch(e) {
      const searchTerm = e.target.value.toLowerCase().trim();
      
      if (searchTerm === '') {
          hideSearchResults();
          showAllCategories();
          return;
      }
      
      // Filter categories
      let hasResults = false;
      categories.forEach(category => {
          const categoryName = category.getAttribute('data-category-name') || '';
          const categoryTitle = category.querySelector('.mega-category-title a');
          const subcategories = category.querySelectorAll('.mega-subcategory');
          
          // Check category name
          const categoryMatch = categoryName.includes(searchTerm);
          
          // Check subcategories
          let subMatches = [];
          subcategories.forEach(sub => {
              const subName = sub.querySelector('.mega-subcategory-title a').textContent.toLowerCase();
              if (subName.includes(searchTerm)) {
                  subMatches.push(sub);
              }
          });
          
          if (categoryMatch || subMatches.length > 0) {
              category.style.display = 'block';
              // Expand if it has matching subcategories
              if (subMatches.length > 0) {
                  const wrapper = category.querySelector('.subcategories-wrapper');
                  const toggle = category.querySelector('.toggle-subcategories');
                  if (wrapper && toggle) {
                      wrapper.classList.add('expanded');
                      toggle.classList.add('active');
                      toggle.textContent = '−';
                  }
              }
              hasResults = true;
          } else {
              category.style.display = 'none';
          }
      });
      
      // Show/hide search results dropdown
      if (hasResults) {
          hideSearchResults();
      } else {
          showSearchResults(searchTerm);
      }
  }
  
  function showAllCategories() {
      categories.forEach(category => {
          category.style.display = 'block';
      });
  }
  
  function showSearchResults(searchTerm) {
      // This would typically make an AJAX call to your server
      // For now, we'll just show a "no results" message
      searchResults.innerHTML = `
          <div class="search-result-item">
              <div>No categories found for "${searchTerm}"</div>
              <div class="result-path">Try different keywords</div>
          </div>
      `;
      searchResults.style.display = 'block';
  }
  
  function showAllResults() {
      if (searchInput.value === '') {
          searchResults.innerHTML = `
              <div class="search-result-item">
                  <div>Start typing to search categories</div>
                  <div class="result-path">You can search by category or subcategory names</div>
              </div>
          `;
          searchResults.style.display = 'block';
      }
  }
  
  function hideSearchResults() {
      searchResults.style.display = 'none';
  }
  
  function closeResultsOnClickOutside(e) {
      if (!searchResults.contains(e.target) && e.target !== searchInput) {
          hideSearchResults();
      }
  }
  

});
// Mobile Menu Functionality
document.addEventListener('DOMContentLoaded', function() {
  const mobileSearchInput = document.getElementById('mobileCategorySearch');
  const mobileSearchResults = document.getElementById('mobileSearchResults');
  const shopMenuItem = document.querySelector('.dropdown-mb .mb-menu-link');
  const mobileCategoriesPanel = document.getElementById('mobileCategoriesPanel');
  const mobileCategoriesBack = document.querySelector('.mobile-categories-back');
  
  // Toggle mobile categories panel
  if (shopMenuItem) {
      shopMenuItem.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          mobileCategoriesPanel.classList.add('active');
          document.body.style.overflow = 'hidden';
      });
  }
  
  // Close categories panel with back button
  if (mobileCategoriesBack) {
      mobileCategoriesBack.addEventListener('click', function(e) {
          e.stopPropagation();
          mobileCategoriesPanel.classList.remove('active');
          document.body.style.overflow = '';
          
          // Close any open subcategory panels
          document.querySelectorAll('.mobile-subcategories-panel.active, .mobile-childcategories-panel.active')
              .forEach(panel => panel.classList.remove('active'));
      });
  }
  
  // Handle category clicks (for subcategories)
  document.querySelectorAll('.mobile-category-item').forEach(item => {
      const categoryLink = item.querySelector('.mobile-category-link');
      const subcategoryPanel = item.querySelector('.mobile-subcategories-panel');
      const subcategoryBack = item.querySelector('.mobile-subcategories-back');
      
      if (categoryLink && subcategoryPanel) {
          categoryLink.addEventListener('click', function(e) {
              const arrow = this.querySelector('.category-arrow');
              if (arrow) {
                  e.preventDefault();
                  e.stopPropagation();
                  subcategoryPanel.classList.add('active');
              }
          });
      }
      
      if (subcategoryBack) {
          subcategoryBack.addEventListener('click', function(e) {
              e.stopPropagation();
              subcategoryPanel.classList.remove('active');
              
              // Close any open child category panels
              const childPanel = subcategoryPanel.querySelector('.mobile-childcategories-panel.active');
              if (childPanel) {
                  childPanel.classList.remove('active');
              }
          });
      }
      
      // Handle subcategory clicks (for child categories)
      const subcategoryItems = item.querySelectorAll('.mobile-subcategory-item');
      subcategoryItems.forEach(subItem => {
          const subcategoryLink = subItem.querySelector('.mobile-subcategory-link');
          const childPanel = subItem.querySelector('.mobile-childcategories-panel');
          const childBack = subItem.querySelector('.mobile-childcategories-back');
          
          if (subcategoryLink && childPanel) {
              subcategoryLink.addEventListener('click', function(e) {
                  const arrow = this.querySelector('.subcategory-arrow');
                  if (arrow) {
                      e.preventDefault();
                      e.stopPropagation();
                      childPanel.classList.add('active');
                  }
              });
          }
          
          if (childBack) {
              childBack.addEventListener('click', function(e) {
                  e.stopPropagation();
                  childPanel.classList.remove('active');
              });
          }
      });
  });
  
  // Mobile search functionality
  if (mobileSearchInput) {
      mobileSearchInput.addEventListener('input', debounce(handleMobileSearch, 300));
      mobileSearchInput.addEventListener('focus', showMobileAllResults);
      document.addEventListener('click', closeMobileResultsOnClickOutside);
      
      // Add clear button functionality
      mobileSearchInput.addEventListener('input', function() {
          if (this.value) {
              // Show clear button (you can add one if needed)
          }
      });
  }
  
  // Function to navigate to search result
  function navigateToResult(url) {
      window.location.href = url;
  }
  
  function handleMobileSearch(e) {
      const searchTerm = e.target.value.toLowerCase().trim();
      
      if (searchTerm === '') {
          hideMobileSearchResults();
          return;
      }
      
      // Collect all searchable items
      const searchItems = [];
      
      // Categories
      const categories = document.querySelectorAll('.mobile-category-item');
      categories.forEach(category => {
          const categoryName = category.getAttribute('data-category-name') || '';
          const categoryLink = category.querySelector('.mobile-category-link');
          const categoryTitle = categoryLink ? categoryLink.textContent.toLowerCase() : '';
          
          if (categoryName.includes(searchTerm) || categoryTitle.includes(searchTerm)) {
              searchItems.push({
                  title: categoryLink ? categoryLink.textContent.trim() : '',
                  url: categoryLink ? categoryLink.getAttribute('href') : '#',
                  type: 'Category'
              });
          }
          
          // Subcategories
          const subcategories = category.querySelectorAll('.mobile-subcategory-link');
          subcategories.forEach(subLink => {
              const subTitle = subLink.textContent.toLowerCase();
              
              if (subTitle.includes(searchTerm)) {
                  const parentCategory = category.querySelector('.mobile-category-link');
                  const categoryTitle = parentCategory ? parentCategory.textContent.trim() : '';
                  
                  searchItems.push({
                      title: subLink.textContent.trim(),
                      url: subLink.getAttribute('href'),
                      path: categoryTitle,
                      type: 'Subcategory'
                  });
              }
          });
          
          // Child categories
          const childCategories = category.querySelectorAll('.mobile-childcategory-link');
          childCategories.forEach(childLink => {
              const childTitle = childLink.textContent.toLowerCase();
              
              if (childTitle.includes(searchTerm)) {
                  searchItems.push({
                      title: childLink.textContent.trim(),
                      url: childLink.getAttribute('href'),
                      type: 'Product'
                  });
              }
          });
      });
      
      // Display search results
      if (searchItems.length > 0) {
          showMobileSearchResults(searchItems);
      } else {
          showMobileNoResults(searchTerm);
      }
  }
  
  function showMobileSearchResults(items) {
      let html = '';
      items.forEach(item => {
          html += `
              <div class="mobile-search-result-item" data-url="${item.url}">
                  <div class="result-title">${item.title}</div>
                  ${item.path ? `<div class="result-path">${item.type} in ${item.path}</div>` : 
                    item.type ? `<div class="result-path">${item.type}</div>` : ''}
              </div>
          `;
      });
      
      mobileSearchResults.innerHTML = html;
      mobileSearchResults.style.display = 'block';
      
      // Add click handlers to results
      const resultItems = mobileSearchResults.querySelectorAll('.mobile-search-result-item');
      resultItems.forEach(item => {
          item.addEventListener('click', function() {
              const url = this.getAttribute('data-url');
              if (url && url !== '#') {
                  navigateToResult(url);
              }
          });
      });
  }
  
  function showMobileNoResults(searchTerm) {
      mobileSearchResults.innerHTML = `
          <div class="mobile-search-result-item no-results">
              <div class="result-title">No results found</div>
              <div class="result-path">Try different keywords</div>
          </div>
      `;
      mobileSearchResults.style.display = 'block';
  }
  
  function showMobileAllResults() {
      if (mobileSearchInput.value === '') {
          mobileSearchResults.innerHTML = `
              <div class="mobile-search-result-item">
                  <div class="result-title">Search categories</div>
                  <div class="result-path">Type to search products and categories</div>
              </div>
          `;
          mobileSearchResults.style.display = 'block';
      }
  }
  
  function hideMobileSearchResults() {
      mobileSearchResults.style.display = 'none';
  }
  
  function closeMobileResultsOnClickOutside(e) {
      if (!mobileSearchResults.contains(e.target) && e.target !== mobileSearchInput) {
          hideMobileSearchResults();
      }
  }
  
  // Close mobile menu when clicking outside
  document.addEventListener('click', function(e) {
      const mobileMenu = document.getElementById('mobileMenu');
      const isMenuOpen = mobileMenu.classList.contains('show');
      
      if (isMenuOpen && !mobileMenu.contains(e.target) && !e.target.closest('[data-bs-target="#mobileMenu"]')) {
          // Close all panels
          closeAllPanels();
      }
  });
  
  // Close all panels function
  function closeAllPanels() {
      document.querySelectorAll('.mobile-categories-panel.active, .mobile-subcategories-panel.active, .mobile-childcategories-panel.active')
          .forEach(panel => panel.classList.remove('active'));
      
      document.body.style.overflow = '';
      
      // Clear search
      if (mobileSearchInput) {
          mobileSearchInput.value = '';
          hideMobileSearchResults();
      }
  }
  
  // Close all panels when offcanvas closes
  const offcanvas = document.getElementById('mobileMenu');
  if (offcanvas) {
      offcanvas.addEventListener('hidden.bs.offcanvas', function() {
          closeAllPanels();
      });
  }
  
  // Debounce function
  function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
          const later = () => {
              clearTimeout(timeout);
              func(...args);
          };
          clearTimeout(timeout);
          timeout = setTimeout(later, wait);
      };
  }
  
  // Keyboard navigation support
  document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
          // Close search results
          hideMobileSearchResults();
          
          // Close open panels in reverse order
          const activePanels = document.querySelectorAll('.mobile-childcategories-panel.active, .mobile-subcategories-panel.active, .mobile-categories-panel.active');
          if (activePanels.length > 0) {
              activePanels[activePanels.length - 1].classList.remove('active');
              e.preventDefault();
          }
      }
  });
});

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof Search !== 'undefined') Search.init();
  });
  
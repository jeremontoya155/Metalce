// ============================================================
// cart.js — Metalce Catálogo: filtros, categorías, ordenamiento
// ============================================================
(function() {
    'use strict';

    // ============= MODAL ANTIGUO (opcional) =============
    var modal = document.querySelector('.filters-modal');
    var modalButtons = document.querySelectorAll('.filters-modal-btn-sidebar, .filters-modal-btn-phone, .search-fab-mobile');

    if (modal) {
        modalButtons.forEach(function(button) {
            button.addEventListener('click', function() { modal.classList.toggle('active'); });
        });
        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.classList.remove('active');
        });
    }

    // ============= JERARQUÍA / CATEGORÍAS =============
    var activeFamilia = null;
    var activeLinea = null;
    var activeCategoryId = null;

    window.toggleHierarchy = function() {
        var panel = document.getElementById('hierarchy-panel');
        var btn = document.getElementById('toggle-hierarchy');
        if (!panel) return;
        var isOpen = panel.style.display !== 'none';
        panel.style.display = isOpen ? 'none' : 'block';
        if (btn) btn.classList.toggle('active', !isOpen);
    };

    window.toggleFamilia = function(btn) {
        var li = btn.closest('.hie-familia');
        if (!li) return;
        var subPanel = li.querySelector('.hie-lineas');
        var isOpen = subPanel && subPanel.style.display !== 'none';
        document.querySelectorAll('.hie-familia .hie-lineas').forEach(function(el) { el.style.display = 'none'; });
        document.querySelectorAll('.hie-familia-btn').forEach(function(b) { b.classList.remove('open'); });
        if (!isOpen && subPanel) {
            subPanel.style.display = 'flex';
            btn.classList.add('open');
        }
    };

    window.toggleLinea = function(btn) {
        var group = btn.closest('.hie-linea-group');
        if (!group) return;
        var subPanel = group.querySelector('.hie-cats');
        var isOpen = subPanel && subPanel.style.display !== 'none';
        document.querySelectorAll('.hie-linea-group .hie-cats').forEach(function(el) { el.style.display = 'none'; });
        document.querySelectorAll('.hie-linea-btn').forEach(function(b) { b.classList.remove('open'); });
        if (!isOpen && subPanel) {
            subPanel.style.display = 'flex';
            btn.classList.add('open');
        }
    };

    window.selectHierarchyCat = function(btn) {
        document.querySelectorAll('.hie-cat-btn').forEach(function(b) { b.classList.remove('active'); });
        document.querySelectorAll('.hie-familia-btn').forEach(function(b) { b.classList.remove('active'); });
        var allBtn = document.getElementById('btn-all-cats');
        if (allBtn) allBtn.classList.remove('active');
        btn.classList.add('active');
        activeCategoryId = btn.getAttribute('data-cat-id');
        activeFamilia = null;
        activeLinea = null;
        applyQuickFilters();
    };

    window.showAllCats = function() {
        document.querySelectorAll('.hie-cat-btn, .hie-familia-btn').forEach(function(b) { b.classList.remove('active'); });
        var allBtn = document.getElementById('btn-all-cats');
        if (allBtn) allBtn.classList.add('active');
        activeCategoryId = null;
        activeFamilia = null;
        activeLinea = null;
        applyQuickFilters();
    };

    window.selectFamiliaFilter = function(btn) {
        document.querySelectorAll('.hie-cat-btn, .hie-familia-btn').forEach(function(b) { b.classList.remove('active'); });
        var allBtn = document.getElementById('btn-all-cats');
        if (allBtn) allBtn.classList.remove('active');
        btn.classList.add('active');
        activeFamilia = btn.getAttribute('data-familia');
        activeCategoryId = null;
        activeLinea = null;
        applyQuickFilters();
    };

    // ============= FILTRO EN TIEMPO REAL =============
    var quickSearch = document.getElementById('quick-search');
    var priceSort = document.getElementById('price-sort');
    var resetFiltersBtn = document.getElementById('reset-filters');

    function applyQuickFilters() {
        var searchValue = quickSearch ? quickSearch.value.toLowerCase() : '';
        var sortValue = priceSort ? priceSort.value : '';
        var container = document.getElementById('cart-items') || document.querySelector('.row');
        var products = Array.from(document.querySelectorAll('.product-card'));
        var visibleCount = 0;

        products.forEach(function(product) {
            var productName = (product.getAttribute('data-model') || '').toLowerCase();
            var productCategory = (product.getAttribute('data-category') || '').trim();
            var productFamilia = (product.getAttribute('data-familia') || '').trim();
            var productCodigo = (product.getAttribute('data-codigo') || '').toLowerCase();

            var searchMatch = !searchValue || productName.includes(searchValue) || productCodigo.includes(searchValue);

            var hierarchyMatch = true;
            if (activeCategoryId) {
                hierarchyMatch = productCategory === String(activeCategoryId);
            } else if (activeFamilia) {
                hierarchyMatch = productFamilia === activeFamilia;
            }

            if (searchMatch && hierarchyMatch) {
                product.style.display = '';
                visibleCount++;
            } else {
                product.style.display = 'none';
            }
        });

        // Ordenar por precio
        if (sortValue && container) {
            var visibleProducts = products.filter(function(p) { return p.style.display !== 'none'; });
            visibleProducts.sort(function(a, b) {
                var priceA = parseFloat(a.getAttribute('data-price')) || 0;
                var priceB = parseFloat(b.getAttribute('data-price')) || 0;
                return sortValue === 'asc' ? priceA - priceB : priceB - priceA;
            });
            visibleProducts.forEach(function(product) { container.appendChild(product); });
        }

        updateNoResultsMessage(visibleCount);
    }
    // Exponer globalmente para los onclick del HTML
    window.applyQuickFilters = applyQuickFilters;

    function updateNoResultsMessage(count) {
        var noResultsDiv = document.getElementById('no-results-message');
        if (!noResultsDiv) return;
        noResultsDiv.style.display = count === 0 ? 'block' : 'none';
    }

    // Listeners
    if (quickSearch) quickSearch.addEventListener('input', applyQuickFilters);
    if (priceSort) priceSort.addEventListener('change', applyQuickFilters);

    // ============= CHIPS DE ESTADO =============
    var estadoChips = document.querySelectorAll('.estado-chip');
    var activeEstados = new Set();

    estadoChips.forEach(function(chip) {
        chip.addEventListener('click', function() {
            var estado = this.getAttribute('data-estado');
            this.classList.toggle('active');
            if (this.classList.contains('active')) {
                activeEstados.add(estado);
            } else {
                activeEstados.delete(estado);
            }
            filterByEstadoChips();
        });
    });

    function filterByEstadoChips() {
        var products = document.querySelectorAll('.product-card');
        var anyVisible = false;
        if (activeEstados.size === 0) {
            products.forEach(function(p) { p.style.display = ''; });
            var nr = document.getElementById('no-results-message');
            if (nr) nr.style.display = 'none';
            return;
        }
        products.forEach(function(product) {
            var pe = (product.getAttribute('data-estado') || '').toUpperCase();
            if (activeEstados.has(pe)) {
                product.style.display = '';
                anyVisible = true;
            } else {
                product.style.display = 'none';
            }
        });
        var nr2 = document.getElementById('no-results-message');
        if (nr2) nr2.style.display = anyVisible ? 'none' : 'block';
    }

    // ============= RESET GENERAL =============
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', function() {
            if (quickSearch) quickSearch.value = '';
            if (priceSort) priceSort.value = '';
            activeCategoryId = null;
            activeFamilia = null;
            activeLinea = null;
            document.querySelectorAll('.hie-cat-btn, .hie-familia-btn').forEach(function(b) { b.classList.remove('active'); });
            var allBtn = document.getElementById('btn-all-cats');
            if (allBtn) allBtn.classList.add('active');
            // Cerrar panel categorías
            var panel = document.getElementById('hierarchy-panel');
            if (panel) panel.style.display = 'none';
            var toggleBtn = document.getElementById('toggle-hierarchy');
            if (toggleBtn) toggleBtn.classList.remove('active');
            // Chips estado
            estadoChips.forEach(function(c) { c.classList.remove('active'); });
            activeEstados.clear();
            // Chips orden
            document.querySelectorAll('.orden-chip.active').forEach(function(c) { c.classList.remove('active'); });
            // Mostrar todo
            document.querySelectorAll('.product-card').forEach(function(p) { p.style.display = ''; });
            updateNoResultsMessage(document.querySelectorAll('.product-card').length);
            // Restaurar orden original
            restoreOriginalOrder();
        });
    }

    // ============= MODAL ANTIGUO: FILTROS =============
    var filterButton = document.getElementById('filter-button');
    var resetButton = document.getElementById('reset-button');

    if (filterButton) {
        filterButton.addEventListener('click', function() {
            var estado = document.getElementById('estado-filter') ? document.getElementById('estado-filter').value.toUpperCase() : '';
            var storage = document.getElementById('storage-filter') ? parseInt(document.getElementById('storage-filter').value) : NaN;
            var battery = document.getElementById('battery-filter') ? parseInt(document.getElementById('battery-filter').value) : NaN;
            var modelVal = document.getElementById('model-filter') ? document.getElementById('model-filter').value.toLowerCase() : '';
            var searchQuery = document.getElementById('search-input') ? document.getElementById('search-input').value.toLowerCase() : '';

            var products = document.querySelectorAll('.product-card');
            var anyVisible = false;

            products.forEach(function(product) {
                var productEstado = (product.getAttribute('data-estado') || '').toUpperCase();
                var productStorage = parseInt(product.getAttribute('data-storage'));
                var productBattery = parseInt(product.getAttribute('data-battery'));
                var productModel = (product.getAttribute('data-model') || '').toLowerCase();

                var estadoMatch = !estado || productEstado === estado;
                var storageMatch = isNaN(storage) || productStorage >= storage;
                var batteryMatch = isNaN(battery) || productBattery >= battery;
                var modelMatch = !modelVal || productModel === modelVal;
                var searchMatch = !searchQuery || productModel.includes(searchQuery);

                if (estadoMatch && storageMatch && batteryMatch && modelMatch && searchMatch) {
                    product.style.display = '';
                    anyVisible = true;
                } else {
                    product.style.display = 'none';
                }
            });

            var nr = document.getElementById('no-results-message');
            if (nr) nr.style.display = anyVisible ? 'none' : 'block';
            if (modal) modal.classList.remove('active');
        });
    }

    if (resetButton) {
        resetButton.addEventListener('click', function() {
            ['estado-filter', 'storage-filter', 'battery-filter', 'model-filter', 'search-input'].forEach(function(id) {
                var el = document.getElementById(id);
                if (el) el.value = '';
            });
            document.querySelectorAll('.product-card').forEach(function(p) { p.style.display = ''; });
            var nr = document.getElementById('no-results-message');
            if (nr) nr.style.display = 'none';
            // Chips
            estadoChips.forEach(function(c) { c.classList.remove('active'); });
            activeEstados.clear();
            document.querySelectorAll('.orden-chip.active').forEach(function(c) { c.classList.remove('active'); });
            restoreOriginalOrder();
        });
    }

    // ============= CHIPS DE ORDENAMIENTO =============
    var ordenChips = document.querySelectorAll('.orden-chip');
    var mainContainer = document.getElementById('cart-items');
    var originalOrder = Array.from(document.querySelectorAll('.product-card'));

    ordenChips.forEach(function(chip) {
        chip.addEventListener('click', function() {
            var orden = this.getAttribute('data-orden');
            if (this.classList.contains('active')) {
                this.classList.remove('active');
                restoreOriginalOrder();
                return;
            }
            ordenChips.forEach(function(c) { c.classList.remove('active'); });
            this.classList.add('active');
            sortProductsChip(orden);
        });
    });

    function sortProductsChip(orden) {
        if (!mainContainer) return;
        var products = Array.from(document.querySelectorAll('.product-card'));
        products.sort(function(a, b) {
            var priceA = parseFloat(a.getAttribute('data-price')) || 0;
            var priceB = parseFloat(b.getAttribute('data-price')) || 0;
            return orden === 'asc' ? priceA - priceB : priceB - priceA;
        });
        products.forEach(function(p) { mainContainer.appendChild(p); });
    }

    function restoreOriginalOrder() {
        if (!mainContainer) return;
        originalOrder.forEach(function(p) { mainContainer.appendChild(p); });
    }

})();


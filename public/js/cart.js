// Seleccionar elementos
const modal = document.querySelector('.filters-modal');
const modalButtons = document.querySelectorAll('.filters-modal-btn-sidebar, .filters-modal-btn-phone, .search-fab-mobile');
const closeButton = document.querySelector('.filters-modal-content');

// Función para abrir/cerrar el modal
const toggleModal = () => {
    modal.classList.toggle('active');
};

// Abrir el modal al hacer clic en los botones
modalButtons.forEach(button => {
    button.addEventListener('click', toggleModal);
});

// Cerrar el modal al hacer clic fuera del contenido
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('active');
    }
});

// ============= FILTRO EN TIEMPO REAL =============
const quickSearch = document.getElementById('quick-search');
const categoryFilter = document.getElementById('category-filter');
const priceSort = document.getElementById('price-sort');
const resetFiltersBtn = document.getElementById('reset-filters');

function applyQuickFilters() {
    const searchValue = quickSearch.value.toLowerCase();
    const categoryValue = categoryFilter.value;
    const sortValue = priceSort.value;
    const productsContainer = document.querySelector('.row');
    const products = Array.from(document.querySelectorAll('.product-card'));
    let visibleCount = 0;

    // Filtrar productos
    products.forEach(product => {
        const productName = product.getAttribute('data-model').toLowerCase();
        const productCategory = product.getAttribute('data-category');
        
        const searchMatch = !searchValue || productName.includes(searchValue);
        const categoryMatch = !categoryValue || productCategory === categoryValue;

        if (searchMatch && categoryMatch) {
            product.style.display = 'block';
            visibleCount++;
        } else {
            product.style.display = 'none';
        }
    });

    // Ordenar productos visibles por precio
    if (sortValue) {
        const visibleProducts = products.filter(p => p.style.display !== 'none');
        
        visibleProducts.sort((a, b) => {
            const priceA = parseFloat(a.getAttribute('data-price')) || 0;
            const priceB = parseFloat(b.getAttribute('data-price')) || 0;
            
            if (sortValue === 'asc') {
                return priceA - priceB; // Menor a mayor
            } else if (sortValue === 'desc') {
                return priceB - priceA; // Mayor a menor
            }
            return 0;
        });

        // Reordenar en el DOM
        visibleProducts.forEach(product => {
            productsContainer.appendChild(product);
        });
    }

    // Añadir animación suave
    products.forEach(product => {
        if (product.style.display === 'block') {
            product.style.animation = 'fadeIn 0.3s ease';
        }
    });

    // Mostrar mensaje si no hay resultados
    updateNoResultsMessage(visibleCount);
}

function updateNoResultsMessage(count) {
    let noResultsDiv = document.getElementById('no-results-message');
    
    if (count === 0) {
        if (!noResultsDiv) {
            noResultsDiv = document.createElement('div');
            noResultsDiv.id = 'no-results-message';
            noResultsDiv.className = 'no-results-message';
            noResultsDiv.innerHTML = `
                <div class="no-results-content">
                    <span class="no-results-icon">🔍</span>
                    <h3>No se encontraron productos</h3>
                    <p>Intenta con otros filtros o términos de búsqueda</p>
                </div>
            `;
            document.querySelector('.row').appendChild(noResultsDiv);
        }
    } else {
        if (noResultsDiv) {
            noResultsDiv.remove();
        }
    }
}

// Event listeners para filtrado en tiempo real
quickSearch.addEventListener('input', applyQuickFilters);
categoryFilter.addEventListener('change', applyQuickFilters);
priceSort.addEventListener('change', applyQuickFilters);

resetFiltersBtn.addEventListener('click', () => {
    quickSearch.value = '';
    categoryFilter.value = '';
    priceSort.value = '';
    applyQuickFilters();
});

// ============= FIN FILTRO EN TIEMPO REAL =============

// Aplicar filtros (modal antiguo)
function applyFilters() {
    const estado = document.getElementById('estado-filter') ? document.getElementById('estado-filter').value.toUpperCase() : '';
    const storage = document.getElementById('storage-filter') ? parseInt(document.getElementById('storage-filter').value) : NaN;
    const battery = document.getElementById('battery-filter') ? parseInt(document.getElementById('battery-filter').value) : NaN;
    const model = document.getElementById('model-filter') ? document.getElementById('model-filter').value.toLowerCase() : '';
    const searchQuery = document.getElementById('search-input') ? document.getElementById('search-input').value.toLowerCase() : '';

    const products = document.querySelectorAll('.product-card');
    let anyVisible = false;

    products.forEach(product => {
        const productEstado = product.getAttribute('data-estado') ? product.getAttribute('data-estado').toUpperCase() : '';
        const productStorage = parseInt(product.getAttribute('data-storage'));
        const productBattery = parseInt(product.getAttribute('data-battery'));
        const productModel = product.getAttribute('data-model').toLowerCase();
        const productName = productModel;

        let estadoMatch = !estado || productEstado === estado;
        let storageMatch = isNaN(storage) || productStorage >= storage;
        let batteryMatch = isNaN(battery) || productBattery >= battery;
        let modelMatch = !model || productModel === model;
        let searchMatch = !searchQuery || productName.includes(searchQuery);

        if (estadoMatch && storageMatch && batteryMatch && modelMatch && searchMatch) {
            product.style.display = 'block';
            anyVisible = true;
        } else {
            product.style.display = 'none';
        }
    });

    document.getElementById('no-results-message').style.display = anyVisible ? 'none' : 'block';
    modal.classList.remove('active');
}

// Botones de acción
document.getElementById('filter-button').addEventListener('click', applyFilters);

document.getElementById('reset-button').addEventListener('click', () => {
    document.getElementById('estado-filter').value = "";
    document.getElementById('storage-filter').value = "";
    document.getElementById('battery-filter').value = "";
    document.getElementById('model-filter').value = "";
    document.getElementById('search-input').value = "";

    document.querySelectorAll('.product-card').forEach(product => {
        product.style.display = 'block';
    });

    document.getElementById('no-results-message').style.display = 'none';
});

// Funcionalidad para los chips de estado
const estadoChips = document.querySelectorAll('.estado-chip');
let activeEstados = new Set();

estadoChips.forEach(chip => {
    chip.addEventListener('click', function() {
        const estado = this.getAttribute('data-estado');
        
        // Toggle active class
        this.classList.toggle('active');
        
        // Actualizar el set de estados activos
        if (this.classList.contains('active')) {
            activeEstados.add(estado);
        } else {
            activeEstados.delete(estado);
        }
        
        // Aplicar filtro
        filterByEstadoChips();
    });
});

function filterByEstadoChips() {
    const products = document.querySelectorAll('.product-card');
    let anyVisible = false;
    
    // Si no hay chips activos, mostrar todos
    if (activeEstados.size === 0) {
        products.forEach(product => {
            product.style.display = 'block';
        });
        document.getElementById('no-results-message').style.display = 'none';
        return;
    }
    
    // Filtrar productos según estados activos
    products.forEach(product => {
        const productEstado = product.getAttribute('data-estado').toUpperCase();
        
        if (activeEstados.has(productEstado)) {
            product.style.display = 'block';
            anyVisible = true;
        } else {
            product.style.display = 'none';
        }
    });
    
    document.getElementById('no-results-message').style.display = anyVisible ? 'none' : 'block';
}

// Actualizar la función de reset para incluir los chips
const originalResetButton = document.getElementById('reset-button');
originalResetButton.addEventListener('click', () => {
    // Desactivar todos los chips
    estadoChips.forEach(chip => chip.classList.remove('active'));
    activeEstados.clear();
    
    // Desactivar chips de ordenamiento
    ordenChips.forEach(chip => chip.classList.remove('active'));
    currentOrder = null;
    
    // Restaurar orden original
    restoreOriginalOrder();
});

// Funcionalidad para los chips de ordenamiento
const ordenChips = document.querySelectorAll('.orden-chip');
let currentOrder = null;
const productsContainer = document.getElementById('cart-items');
const originalOrder = Array.from(document.querySelectorAll('.product-card'));

ordenChips.forEach(chip => {
    chip.addEventListener('click', function() {
        const orden = this.getAttribute('data-orden');
        
        // Si se hace click en el mismo chip activo, desactivar ordenamiento
        if (this.classList.contains('active')) {
            this.classList.remove('active');
            currentOrder = null;
            restoreOriginalOrder();
            return;
        }
        
        // Desactivar otros chips de orden
        ordenChips.forEach(c => c.classList.remove('active'));
        
        // Activar el chip actual
        this.classList.add('active');
        currentOrder = orden;
        
        // Ordenar productos
        sortProducts(orden);
    });
});

function sortProducts(orden) {
    const products = Array.from(document.querySelectorAll('.product-card'));
    
    products.sort((a, b) => {
        const priceA = parseFloat(a.getAttribute('data-price'));
        const priceB = parseFloat(b.getAttribute('data-price'));
        
        if (orden === 'asc') {
            return priceA - priceB; // Menor a mayor
        } else {
            return priceB - priceA; // Mayor a menor
        }
    });
    
    // Reordenar en el DOM manteniendo la visibilidad
    products.forEach(product => {
        productsContainer.appendChild(product);
    });
}

function restoreOriginalOrder() {
    originalOrder.forEach(product => {
        productsContainer.appendChild(product);
    });
}

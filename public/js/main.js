// Filtros, ordenamiento y exportación de la tabla de administración.
const adminTableBody = document.getElementById('products-table');
const searchInput = document.getElementById('search-input');
const adminCategoryFilter = document.getElementById('admin-category-filter');
const adminStatusFilter = document.getElementById('admin-status-filter');
const adminSortFilter = document.getElementById('admin-sort-filter');
const adminClearFilters = document.getElementById('admin-clear-filters');
const adminProductsCount = document.getElementById('admin-products-count');
const adminRows = adminTableBody ? Array.from(adminTableBody.querySelectorAll('tr')) : [];

adminRows.forEach((row, index) => {
    row.dataset.originalIndex = String(index);
});

function normalizeAdminText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function getAdminRowSearchText(row) {
    return normalizeAdminText([
        row.dataset.name,
        row.dataset.code,
        row.dataset.description,
        row.dataset.categoryName,
        row.dataset.status
    ].join(' '));
}

function getAdminRowNumber(row, key) {
    const value = String(row.dataset[key] || '0').replace(',', '.');
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function sortAdminRows() {
    if (!adminTableBody) return;

    const sortValue = adminSortFilter ? adminSortFilter.value : '';
    const rows = [...adminRows];

    rows.sort((a, b) => {
        if (!sortValue) {
            return Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex);
        }

        if (sortValue === 'name-asc' || sortValue === 'name-desc') {
            const result = normalizeAdminText(a.dataset.name).localeCompare(normalizeAdminText(b.dataset.name), 'es');
            return sortValue === 'name-asc' ? result : -result;
        }

        if (sortValue === 'price-asc' || sortValue === 'price-desc') {
            const result = getAdminRowNumber(a, 'price') - getAdminRowNumber(b, 'price');
            return sortValue === 'price-asc' ? result : -result;
        }

        if (sortValue === 'stock-asc' || sortValue === 'stock-desc') {
            const result = getAdminRowNumber(a, 'stock') - getAdminRowNumber(b, 'stock');
            return sortValue === 'stock-asc' ? result : -result;
        }

        return Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex);
    });

    rows.forEach(row => adminTableBody.appendChild(row));
}

function updateAdminProductTable() {
    if (!adminTableBody) return;

    const searchValue = normalizeAdminText(searchInput ? searchInput.value : '');
    const categoryValue = adminCategoryFilter ? adminCategoryFilter.value : '';
    const statusValue = adminStatusFilter ? adminStatusFilter.value : '';
    let visibleCount = 0;

    sortAdminRows();

    adminRows.forEach(row => {
        const matchesSearch = !searchValue || getAdminRowSearchText(row).includes(searchValue);
        const matchesCategory = !categoryValue || row.dataset.categoryId === categoryValue;
        const matchesStatus = !statusValue || row.dataset.status === statusValue;
        const isVisible = matchesSearch && matchesCategory && matchesStatus;

        row.style.display = isVisible ? '' : 'none';
        if (isVisible) visibleCount += 1;
    });

    if (adminProductsCount) {
        adminProductsCount.textContent = `${visibleCount} de ${adminRows.length} productos visibles`;
    }
}

if (adminTableBody) {
    [searchInput, adminCategoryFilter, adminStatusFilter, adminSortFilter].forEach(control => {
        if (control) control.addEventListener('input', updateAdminProductTable);
        if (control) control.addEventListener('change', updateAdminProductTable);
    });

    if (adminClearFilters) {
        adminClearFilters.addEventListener('click', function () {
            if (searchInput) searchInput.value = '';
            if (adminCategoryFilter) adminCategoryFilter.value = '';
            if (adminStatusFilter) adminStatusFilter.value = '';
            if (adminSortFilter) adminSortFilter.value = '';
            updateAdminProductTable();
        });
    }

    updateAdminProductTable();
}

$(document).ready(function () {
    $(document).on('hidden.bs.modal', function () {
        $('.modal-backdrop').remove(); // Elimina backdrop persistente
        $('body').removeClass('modal-open'); // Previene bloqueo del fondo
    });
});
function getAdminCellText(row, index) {
    const cell = row.querySelectorAll('td')[index];
    return cell ? cell.textContent.replace(/\s+/g, ' ').trim() : '';
}

// Función para descargar los productos visibles en un archivo Excel
const downloadBtn = document.getElementById('download-btn');
if (downloadBtn) downloadBtn.addEventListener('click', function() {
    const rows = adminTableBody
        ? Array.from(adminTableBody.querySelectorAll('tr')).filter(row => row.style.display !== 'none')
        : Array.from(document.querySelectorAll('#products-table tr'));
    const data = [];

    // Cabeceras
    data.push(['Imagen', 'Código', 'Nombre', 'Descripción', 'Categoría', 'Estado', 'Precio', 'Stock']);

    // Filas
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const imgElement = cells[0] ? cells[0].querySelector('img') : null;
        const img = imgElement ? imgElement.src : '';
        const code = getAdminCellText(row, 1);
        const name = getAdminCellText(row, 2);
        const description = getAdminCellText(row, 3);
        const category = getAdminCellText(row, 4);
        const status = getAdminCellText(row, 5);
        const price = getAdminCellText(row, 6);
        const stock = getAdminCellText(row, 7);

        data.push([img, code, name, description, category, status, price, stock]);
    });

    // Crear la hoja de Excel
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');

    // Descargar el archivo Excel
    XLSX.writeFile(workbook, 'productos.xlsx');
});

$(document).ready(function () {
    $('.modal').on('show.bs.modal', function () {
        $('.modal-backdrop').remove();
    });
});

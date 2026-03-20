// Función para filtrar la tabla
document.getElementById('search-input').addEventListener('keyup', function() {
    const searchValue = this.value.toLowerCase();
    const rows = document.querySelectorAll('#products-table tr');

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let match = false;

        cells.forEach(cell => {
            if (cell.textContent.toLowerCase().includes(searchValue)) {
                match = true;
            }
        });

        if (match) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
});
$(document).ready(function () {
    $(document).on('hidden.bs.modal', function () {
        $('.modal-backdrop').remove(); // Elimina backdrop persistente
        $('body').removeClass('modal-open'); // Previene bloqueo del fondo
    });
});
// Función para descargar los productos en un archivo Excel
document.getElementById('download-btn').addEventListener('click', function() {
    const rows = document.querySelectorAll('#products-table tr');
    const data = [];

    // Cabeceras
    data.push(['Imagen', 'Nombre', 'Descripción', 'Precio', 'Stock']);

    // Filas
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const img = cells[0].querySelector('img').src;
        const name = cells[1].textContent;
        const description = cells[2].textContent;
        const price = cells[3].textContent;
        const stock = cells[4].textContent;

        data.push([img, name, description, price, stock]);
    });

    // Crear la hoja de Excel
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');

    // Descargar el archivo Excel
    XLSX.writeFile(workbook, 'productos.xlsx');
});

document.getElementById('.menu-toggle').addEventListener('click', function () {
    console.log("boton");
    this.classList.toggle('active');
    document.getElementById('.custom-navbar').classList.toggle('active');
});


// Filtro batería mínima en tiempo real
document.getElementById('battery-filter').addEventListener('input', function () {
    const batteryFilterValue = parseInt(this.value, 10); // Convertir el valor del filtro a número entero
    const items = document.querySelectorAll('.product-card');

    items.forEach(item => {
        const productBattery = parseInt(item.querySelector('.bateria-num').textContent, 10); // Obtener el porcentaje de batería como número entero

        if (isNaN(batteryFilterValue) || productBattery >= batteryFilterValue) {
            // Mostrar productos con batería igual o mayor al valor del filtro, o si el filtro está vacío
            item.style.display = '';
        } else {
            // Ocultar productos con batería menor al valor del filtro
            item.style.display = 'none';
        }
    });
});

$(document).ready(function () {
    $('.modal').on('show.bs.modal', function () {
        $('.modal-backdrop').remove();
    });
});

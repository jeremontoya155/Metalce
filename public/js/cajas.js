// Sistema de Cajas - JavaScript
class CajasSystem {
    constructor() {
        this.cart = [];
        this.products = [];
        this.init();
    }

    init() {
        this.loadProducts();
        this.setupEventListeners();
        this.updateCartDisplay();
    }

    setupEventListeners() {
        // Formulario de checkout
        const checkoutForm = document.getElementById('checkoutForm');
        if (checkoutForm) {
            checkoutForm.addEventListener('submit', this.procesarVenta.bind(this));
        }

        // Búsqueda de productos
        const searchInput = document.getElementById('searchProduct');
        if (searchInput) {
            searchInput.addEventListener('input', this.filterProducts.bind(this));
        }

        // Eventos de teclado
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
    }

    loadProducts() {
        // Los productos ya están cargados en el HTML via EJS
        // Aquí podríamos hacer una llamada AJAX si fuera necesario
        this.updateProductsDisplay();
    }

    addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            this.showMessage('Producto no encontrado', 'error');
            return;
        }

        const existingItem = this.cart.find(item => item.product_id === productId);
        
        if (existingItem) {
            if (existingItem.cantidad < product.stock) {
                existingItem.cantidad++;
                this.showMessage(`${product.name} agregado al carrito`, 'success');
            } else {
                this.showMessage('Stock insuficiente', 'warning');
                return;
            }
        } else {
            if (product.stock > 0) {
                this.cart.push({
                    product_id: productId,
                    name: product.name,
                    price: product.price,
                    cantidad: 1
                });
                this.showMessage(`${product.name} agregado al carrito`, 'success');
            } else {
                this.showMessage('Producto sin stock', 'warning');
                return;
            }
        }

        this.updateCartDisplay();
        this.updateCheckoutButton();
    }

    removeFromCart(productId, removeAll = false) {
        const itemIndex = this.cart.findIndex(item => item.product_id === productId);
        
        if (itemIndex > -1) {
            if (removeAll || this.cart[itemIndex].cantidad <= 1) {
                const productName = this.cart[itemIndex].name;
                this.cart.splice(itemIndex, 1);
                this.showMessage(`${productName} removido del carrito`, 'warning');
            } else {
                this.cart[itemIndex].cantidad--;
                this.showMessage('Cantidad reducida', 'warning');
            }
        }

        this.updateCartDisplay();
        this.updateCheckoutButton();
    }

    updateCartDisplay() {
        const cartContainer = document.getElementById('cartItems');
        const subtotalElement = document.getElementById('subtotal');
        const impuestosElement = document.getElementById('impuestos');
        const totalElement = document.getElementById('total');

        if (!cartContainer) return;

        if (this.cart.length === 0) {
            cartContainer.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-cart"></i>
                    <p>El carrito está vacío</p>
                    <small>Agrega productos para comenzar</small>
                </div>
            `;
        } else {
            cartContainer.innerHTML = this.cart.map(item => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-price">$${item.price} c/u</div>
                    </div>
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="cajasSystem.removeFromCart(${item.product_id})">−</button>
                        <span class="quantity-display">${item.cantidad}</span>
                        <button class="quantity-btn" onclick="cajasSystem.addToCart(${item.product_id})">+</button>
                        <button class="remove-item-btn" onclick="cajasSystem.removeFromCart(${item.product_id}, true)">×</button>
                    </div>
                </div>
            `).join('');
        }

        // Actualizar totales
        const subtotal = this.calculateSubtotal();
        const impuestos = this.calculateTaxes(subtotal);
        const total = subtotal + impuestos;

        if (subtotalElement) subtotalElement.textContent = `$${subtotal.toFixed(2)}`;
        if (impuestosElement) impuestosElement.textContent = `$${impuestos.toFixed(2)}`;
        if (totalElement) totalElement.textContent = `$${total.toFixed(2)}`;
    }

    calculateSubtotal() {
        return this.cart.reduce((sum, item) => sum + (item.price * item.cantidad), 0);
    }

    calculateTaxes(subtotal) {
        return subtotal * 0; // 0% de impuestos por ahora
    }

    updateCheckoutButton() {
        const checkoutBtn = document.getElementById('procesarVenta');
        if (checkoutBtn) {
            checkoutBtn.disabled = this.cart.length === 0;
        }
    }

    clearCart() {
        if (this.cart.length === 0) {
            this.showMessage('El carrito ya está vacío', 'warning');
            return;
        }

        if (confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
            this.cart = [];
            this.updateCartDisplay();
            this.updateCheckoutButton();
            this.showMessage('Carrito vaciado', 'warning');
        }
    }

    async procesarVenta(event) {
        event.preventDefault();

        if (this.cart.length === 0) {
            this.showMessage('El carrito está vacío', 'error');
            return;
        }

        const formData = this.getFormData();
        if (!formData) return;

        const submitBtn = document.getElementById('procesarVenta');
        const originalText = submitBtn.textContent;
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner"></span> Procesando...';

            const response = await fetch('/cajas/procesar-venta', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(`Venta procesada: ${result.numeroFactura}`, 'success');
                
                if (confirm('¿Deseas descargar la factura en PDF?')) {
                    window.open(`/factura/${result.facturaId}/pdf`, '_blank');
                }

                // Limpiar todo
                this.cart = [];
                this.updateCartDisplay();
                this.updateCheckoutButton();
                document.getElementById('checkoutForm').reset();

                // Recargar productos para actualizar stock
                setTimeout(() => location.reload(), 2000);

            } else {
                this.showMessage(`Error: ${result.message}`, 'error');
            }

        } catch (error) {
            console.error('Error procesando venta:', error);
            this.showMessage('Error al procesar la venta', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    getFormData() {
        const clienteNombre = document.getElementById('clienteNombre').value.trim();
        
        if (!clienteNombre) {
            this.showMessage('El nombre del cliente es requerido', 'error');
            return null;
        }

        return {
            cliente_nombre: clienteNombre,
            cliente_telefono: document.getElementById('clienteTelefono').value.trim(),
            cliente_email: document.getElementById('clienteEmail').value.trim(),
            metodo_pago: document.getElementById('metodoPago').value,
            notas: document.getElementById('notas').value.trim(),
            afectar_stock: document.getElementById('afectarStock')?.checked === true, // Solo true si está marcado explícitamente
            items: this.cart,
            subtotal: this.calculateSubtotal(),
            impuestos: this.calculateTaxes(this.calculateSubtotal()),
            total: this.calculateSubtotal() + this.calculateTaxes(this.calculateSubtotal())
        };
    }

    filterProducts(event) {
        const searchTerm = event.target.value.toLowerCase();
        const productCards = document.querySelectorAll('.product-card');

        productCards.forEach(card => {
            const productData = JSON.parse(card.getAttribute('data-product'));
            const productName = productData.name.toLowerCase();
            const productDescription = (productData.description || '').toLowerCase();

            if (productName.includes(searchTerm) || 
                productDescription.includes(searchTerm) ||
                searchTerm === '') {
                card.style.display = 'block';
                card.classList.add('fade-in');
            } else {
                card.style.display = 'none';
                card.classList.remove('fade-in');
            }
        });
    }

    handleKeyboardShortcuts(event) {
        // F1 - Limpiar carrito
        if (event.key === 'F1') {
            event.preventDefault();
            this.clearCart();
        }
        
        // F2 - Procesar venta (si hay items en el carrito)
        if (event.key === 'F2' && this.cart.length > 0) {
            event.preventDefault();
            const clienteNombre = document.getElementById('clienteNombre');
            if (clienteNombre && !clienteNombre.value.trim()) {
                clienteNombre.focus();
            } else {
                document.getElementById('procesarVenta').click();
            }
        }
        
        // Escape - Enfocar búsqueda
        if (event.key === 'Escape') {
            const searchInput = document.getElementById('searchProduct');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }
    }

    showMessage(text, type = 'success') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-popup ${type}`;
        messageDiv.textContent = text;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 300);
        }, 3000);
    }

    updateProductsDisplay() {
        // Actualizar la visualización de productos si es necesario
        const productCards = document.querySelectorAll('.product-card');
        productCards.forEach(card => {
            const addButton = card.querySelector('.btn-add-cart');
            if (addButton) {
                addButton.addEventListener('click', () => {
                    const productData = JSON.parse(card.getAttribute('data-product'));
                    this.addToCart(productData.id);
                });
            }
        });
    }

    // Métodos para estadísticas y reportes
    getCartStats() {
        return {
            totalItems: this.cart.reduce((sum, item) => sum + item.cantidad, 0),
            totalProducts: this.cart.length,
            subtotal: this.calculateSubtotal(),
            total: this.calculateSubtotal() + this.calculateTaxes(this.calculateSubtotal())
        };
    }

    exportCartData() {
        const data = {
            cart: this.cart,
            stats: this.getCartStats(),
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `carrito_${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Inicializar el sistema cuando se carga la página
let cajasSystem;

document.addEventListener('DOMContentLoaded', function() {
    cajasSystem = new CajasSystem();
    
    // Funciones globales para compatibilidad con onclick en HTML
    window.addToCart = (productId) => cajasSystem.addToCart(productId);
    window.clearCart = () => cajasSystem.clearCart();
    window.removeFromCart = (productId, removeAll) => cajasSystem.removeFromCart(productId, removeAll);
});

// Función de utilidad para formato de moneda
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Función para validar datos del cliente
function validateCustomerData(data) {
    const errors = [];
    
    if (!data.cliente_nombre || data.cliente_nombre.trim().length < 2) {
        errors.push('El nombre del cliente es requerido (mínimo 2 caracteres)');
    }
    
    if (data.cliente_email && !isValidEmail(data.cliente_email)) {
        errors.push('El formato del email no es válido');
    }
    
    if (data.cliente_telefono && !isValidPhone(data.cliente_telefono)) {
        errors.push('El formato del teléfono no es válido');
    }
    
    return errors;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 8;
}

// Sistema de carrito flotante
class CarritoManager {
    constructor() {
        this.carrito = null;
        this.init();
    }

    async init() {
        await this.cargarCarrito();
        this.crearWidgetFlotante();
        this.actualizarBadge();
    }

    async cargarCarrito() {
        try {
            const response = await fetch('/api/cart');
            const data = await response.json();
            if (data.exito) {
                this.carrito = data.carrito;
            }
        } catch (error) {
            console.error('Error al cargar carrito:', error);
        }
    }

    crearWidgetFlotante() {
        // Crear botón flotante del carrito
        const cartButton = document.createElement('button');
        cartButton.id = 'cart-float-btn';
        cartButton.className = 'cart-float-btn';
        cartButton.innerHTML = `
            <i class="fas fa-shopping-cart"></i>
            <span class="cart-badge" id="cart-badge">0</span>
        `;
        cartButton.onclick = () => window.location.href = '/checkout';
        
        // Agregar estilos
        const style = document.createElement('style');
        style.textContent = `
            .cart-float-btn {
                position: fixed;
                bottom: 30px;
                right: 30px;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(135deg, #0052A3 0%, #00B4D8 100%);
                color: white;
                border: none;
                box-shadow: 0 4px 15px rgba(0, 82, 163, 0.4);
                cursor: pointer;
                z-index: 1000;
                font-size: 24px;
                transition: transform 0.3s, box-shadow 0.3s;
            }
            .cart-float-btn:hover {
                transform: translateY(-5px);
                box-shadow: 0 6px 20px rgba(0, 82, 163, 0.6);
            }
            .cart-badge {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #ff4444;
                color: white;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
            }
            @keyframes cartPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
            .cart-float-btn.pulse {
                animation: cartPulse 0.3s ease;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(cartButton);
    }

    actualizarBadge() {
        const badge = document.getElementById('cart-badge');
        if (badge && this.carrito) {
            const cantidad = this.carrito.cantidadTotal || 0;
            badge.textContent = cantidad;
            badge.style.display = cantidad > 0 ? 'flex' : 'none';
        }
    }

    async agregarProducto(productId, cantidad = 1) {
        try {
            const response = await fetch('/api/cart/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ productId, cantidad })
            });

            const data = await response.json();

            if (data.exito) {
                this.carrito = data.carrito;
                this.actualizarBadge();
                
                // Animación del botón
                const btn = document.getElementById('cart-float-btn');
                if (btn) {
                    btn.classList.add('pulse');
                    setTimeout(() => btn.classList.remove('pulse'), 300);
                }

                // Mostrar notificación
                this.mostrarNotificacion('Producto agregado al carrito', 'success');
                return true;
            } else {
                this.mostrarNotificacion(data.mensaje, 'error');
                return false;
            }
        } catch (error) {
            console.error('Error al agregar producto:', error);
            this.mostrarNotificacion('Error al agregar el producto', 'error');
            return false;
        }
    }

    mostrarNotificacion(mensaje, tipo = 'success') {
        // Crear notificación toast
        const toast = document.createElement('div');
        toast.className = `cart-toast cart-toast-${tipo}`;
        toast.innerHTML = `
            <i class="fas fa-${tipo === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${mensaje}</span>
        `;
        
        // Estilos para toast
        if (!document.getElementById('cart-toast-styles')) {
            const style = document.createElement('style');
            style.id = 'cart-toast-styles';
            style.textContent = `
                .cart-toast {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    padding: 15px 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    animation: slideIn 0.3s ease;
                }
                .cart-toast-success {
                    border-left: 4px solid #28a745;
                }
                .cart-toast-error {
                    border-left: 4px solid #dc3545;
                }
                .cart-toast i {
                    font-size: 20px;
                }
                .cart-toast-success i {
                    color: #28a745;
                }
                .cart-toast-error i {
                    color: #dc3545;
                }
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Inicializar carrito cuando el DOM esté listo
let carritoManager;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        carritoManager = new CarritoManager();
    });
} else {
    carritoManager = new CarritoManager();
}

// Función global para agregar al carrito (desde botones)
window.agregarAlCarrito = async function(productId, cantidad = 1) {
    if (carritoManager) {
        return await carritoManager.agregarProducto(productId, cantidad);
    }
    return false;
};

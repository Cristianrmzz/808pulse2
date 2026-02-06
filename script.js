document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN DE LA API ---
    const API_BASE_URL = 'http://localhost:3002/api';
    
    // --- DATOS DE LOS EVENTOS (Ahora se cargan desde la API) ---
    let eventsData = [];

    // --- VARIABLES Y ELEMENTOS DEL DOM ---
    const eventCardsContainer = document.getElementById('event-cards-container');
    const modal = document.getElementById('ticket-modal');
    const closeModalBtn = document.querySelector('.close-modal-btn');
    const confirmAddToCartBtn = document.getElementById('confirm-add-to-cart-btn');
    const ticketQuantityInput = document.getElementById('ticket-quantity');
    const decreaseQtyBtn = document.getElementById('decrease-quantity');
    const increaseQtyBtn = document.getElementById('increase-quantity');
    const cartIcon = document.querySelector('.nav-cart-icon');
    const cartSidebar = document.getElementById('cart-sidebar');
    const closeCartBtn = document.querySelector('.close-cart-btn');
    const cartCount = document.getElementById('cart-count');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartTotalSpan = document.getElementById('cart-total');
    const confirmPurchaseBtn = document.getElementById('confirm-purchase-btn');

    let cart = [];
    let currentEventId = null;
    
    // --- DATOS DE RESPALDO ---
    const fallbackEvents = [
        {
            id: 1,
            name: "Neon Dreams Fest",
            date: "25 Oct 2025",
            location: "Centro de Eventos Metropolitano",
            price: 150000,
            image: "https://images.unsplash.com/photo-1582711012103-60a6539455f8?q=80&w=1974&auto=format&fit=crop"
        },
        {
            id: 2,
            name: "Techno Odyssey",
            date: "15 Nov 2025",
            location: "Bodega Industrial 55",
            price: 120000,
            image: "https://images.unsplash.com/photo-1557766133-5415b3c3287a?q=80&w=2070&auto=format&fit=crop"
        },
        {
            id: 3,
            name: "Pulse Warehouse Rave",
            date: "06 Dic 2025",
            location: "Lugar Secreto (se revela 24h antes)",
            price: 180000,
            image: "https://images.unsplash.com/photo-1543306979-041433994a32?q=80&w=2070&auto=format&fit=crop"
        }
    ];

    // --- FUNCIONES DE API ---
    async function fetchEvents() {
        try {
            console.log('Intentando cargar eventos desde:', `${API_BASE_URL}/events`);
            
            const response = await fetch(`${API_BASE_URL}/events`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const events = await response.json();
            console.log('Eventos cargados desde API:', events);
            
            // Guardar fecha original y preparar fecha formateada para mostrar
            eventsData = events.map(event => {
                const d = new Date(event.date);
                const displayDate = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                return {
                    ...event,
                    rawDate: event.date,
                    date: displayDate
                };
            });
            
            renderEvents();
            console.log('Eventos renderizados exitosamente');
            
        } catch (error) {
            console.error('Error cargando eventos desde API:', error);
            console.log('Usando datos de respaldo...');
            
            // Usar datos de respaldo si la API falla
            eventsData = fallbackEvents;
            renderEvents();
            
            // Mostrar mensaje de advertencia
            const warningDiv = document.createElement('div');
            warningDiv.style.cssText = 'background: #fff3cd; color: #856404; padding: 10px; margin: 10px 0; border-radius: 5px; text-align: center;';
            warningDiv.innerHTML = '⚠️ Mostrando eventos en modo offline. Algunos datos pueden no estar actualizados.';
            eventCardsContainer.parentNode.insertBefore(warningDiv, eventCardsContainer);
        }
    }
    
    // --- LÓGICA PARA RENDERIZAR EVENTOS ---
    function renderEvents() {
        eventCardsContainer.innerHTML = '';
        const isAdmin = !!localStorage.getItem('adminToken');
        eventsData.forEach(event => {
            const card = document.createElement('div');
            card.className = 'event-card';
            card.innerHTML = `
                <div class="event-card-grid">
                    <div class="event-flyer">
                        <div class="flyer-frame">
                            <img src="${event.image}" alt="Flyer ${event.name}">
                        </div>
                        <div class="flyer-label">Flyer</div>
                    </div>
                    <div class="event-card-content">
                        <h3>${event.name}</h3>
                        <p><i class="fas fa-calendar-alt"></i> ${event.date}</p>
                        <p><i class="fas fa-map-marker-alt"></i> ${event.location}</p>
                        ${event.description ? `<p class="event-desc">${event.description}</p>` : ''}
                        <div class="event-meta">
                            <span><strong>Precio:</strong> $${Number(event.price).toLocaleString('es-CO')}</span>
                            <span><strong>Cupo:</strong> ${event.capacity ?? '-'} personas</span>
                        </div>
                        <div class="event-actions">
                            <button class="cta-button buy-ticket-btn" data-id="${event.id}">Comprar Entrada</button>
                            ${isAdmin ? `<button class="btn-edit-event" data-edit-id="${event.id}"><i class="fas fa-pen"></i> Editar evento</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
            eventCardsContainer.appendChild(card);
        });
    }

    // --- LÓGICA DEL MODAL ---
    function openModal(eventId) {
        currentEventId = eventId;
        const event = eventsData.find(e => e.id === eventId);
        document.getElementById('modal-event-title').textContent = `Comprar entradas para: ${event.name}`;
        ticketQuantityInput.value = 1;
        modal.style.display = 'flex';
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    eventCardsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('buy-ticket-btn')) {
            const eventId = parseInt(e.target.dataset.id);
            openModal(eventId);
        } else if (e.target.closest('.btn-edit-event')) {
            const btn = e.target.closest('.btn-edit-event');
            const id = parseInt(btn.dataset.editId);
            if (!isNaN(id)) openEditEventModal(id);
        }
    });

    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    decreaseQtyBtn.addEventListener('click', () => {
        let currentValue = parseInt(ticketQuantityInput.value);
        if (currentValue > 1) ticketQuantityInput.value = currentValue - 1;
    });

    increaseQtyBtn.addEventListener('click', () => {
        let currentValue = parseInt(ticketQuantityInput.value);
        ticketQuantityInput.value = currentValue + 1;
    });

    // --- LÓGICA DEL CARRITO ---
    function addToCart() {
        const quantity = parseInt(ticketQuantityInput.value);
        const event = eventsData.find(e => e.id === currentEventId);

        const existingItem = cart.find(item => item.id === currentEventId);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({
                id: currentEventId,
                name: event.name,
                price: event.price,
                quantity: quantity
            });
        }
        closeModal();
        updateCart();
    }

    // --- MODAL DE EDICIÓN DE EVENTO (Admin) ---
    const editModal = document.getElementById('edit-event-modal');
    const closeEditBtn = document.querySelector('.close-edit-event');
    const editForm = document.getElementById('edit-event-form');

    function openEditEventModal(eventId) {
        const ev = eventsData.find(e => e.id === eventId);
        if (!ev) return;
        document.getElementById('edit-event-id').value = ev.id;
        document.getElementById('edit-name').value = ev.name || '';
        // datetime-local expects YYYY-MM-DDTHH:MM
        const iso = new Date(ev.rawDate || ev.date).toISOString();
        document.getElementById('edit-date').value = iso.slice(0,16);
        document.getElementById('edit-location').value = ev.location || '';
        document.getElementById('edit-price').value = Number(ev.price || 0);
        document.getElementById('edit-image').value = ev.image || '';
        document.getElementById('edit-description').value = ev.description || '';
        document.getElementById('edit-capacity').value = Number(ev.capacity || 0);
        document.getElementById('edit-isActive').checked = ev.isActive !== false;
        editModal.style.display = 'flex';
    }

    function closeEditEventModal() {
        editModal.style.display = 'none';
    }

    if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditEventModal);
    window.addEventListener('click', (e) => { if (e.target === editModal) closeEditEventModal(); });

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const adminToken = localStorage.getItem('adminToken');
            if (!adminToken) { alert('Acceso restringido. Inicia sesión como admin.'); return; }
            const id = document.getElementById('edit-event-id').value;
            const payload = {
                name: document.getElementById('edit-name').value.trim(),
                date: new Date(document.getElementById('edit-date').value).toISOString(),
                location: document.getElementById('edit-location').value.trim(),
                price: Number(document.getElementById('edit-price').value),
                image: document.getElementById('edit-image').value.trim(),
                description: document.getElementById('edit-description').value.trim(),
                capacity: Number(document.getElementById('edit-capacity').value),
                isActive: document.getElementById('edit-isActive').checked
            };
            try {
                const resp = await fetch(`${API_BASE_URL}/events/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
                    body: JSON.stringify(payload)
                });
                if (!resp.ok) {
                    const err = await resp.json().catch(()=>({}));
                    throw new Error(err.message || 'No se pudo actualizar el evento');
                }
                // Refrescar lista de eventos
                closeEditEventModal();
                await fetchEvents();
                alert('Evento actualizado correctamente');
            } catch (error) {
                console.error('Error actualizando evento:', error);
                alert('Error actualizando evento');
            }
        });
    }
    
    function updateCart() {
        cartItemsContainer.innerHTML = '';
        let total = 0;
        let totalItems = 0;

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p>Tu carrito está vacío.</p>';
        } else {
            cart.forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.className = 'cart-item';
                itemElement.innerHTML = `
                    <div class="cart-item-info">
                        <p class="item-name">${item.name}</p>
                        <p>${item.quantity} x $${item.price.toLocaleString('es-CO')}</p>
                    </div>
                    <div class="cart-item-actions">
                        <p>$${(item.quantity * item.price).toLocaleString('es-CO')}</p>
                        <button class="remove-item-btn" data-id="${item.id}" aria-label="Eliminar del carrito">
                            <i class="fas fa-trash"></i>
                            <span>Eliminar</span>
                        </button>
                    </div>
                `;
                cartItemsContainer.appendChild(itemElement);
                total += item.quantity * item.price;
                totalItems += item.quantity;
            });
        }
        
        cartTotalSpan.textContent = total.toLocaleString('es-CO');
        cartCount.textContent = totalItems;
    }

    function removeFromCart(id) {
        cart = cart.filter(item => item.id !== id);
        updateCart();
    }
    
    function openCart() {
        cartSidebar.classList.add('open');
    }
    
    function closeCart() {
        cartSidebar.classList.remove('open');
    }

    confirmAddToCartBtn.addEventListener('click', addToCart);
    cartIcon.addEventListener('click', openCart);
    closeCartBtn.addEventListener('click', closeCart);
    cartItemsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-item-btn');
        if (btn) {
            const id = parseInt(btn.dataset.id);
            if (!isNaN(id)) removeFromCart(id);
        }
    });

    // --- LÓGICA DE CONFIRMACIÓN DE COMPRA (WhatsApp) ---
    confirmPurchaseBtn.addEventListener('click', async () => {
        if (cart.length === 0) {
            alert("Tu carrito está vacío.");
            return;
        }

        // 1. Crear la orden en el backend
        const payload = {
            items: cart.map(item => ({
                eventId: item.id,
                quantity: item.quantity
            }))
            // customerInfo: { name, phone, email } // opcional si luego añades un formulario
        };

        let createdOrder = null;
        try {
            const resp = await fetch(`${API_BASE_URL}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.message || `Error creando la orden (${resp.status})`);
            }
            createdOrder = await resp.json();
            console.log('Orden creada:', createdOrder);
        } catch (e) {
            console.error('No se pudo crear la orden:', e);
            alert('Hubo un problema creando tu orden. Intenta nuevamente.');
            return;
        }

        // 2. Mensaje para el usuario
        let userMessage = "Hola! Quiero comprar estas entradas:\n\n";
        cart.forEach(item => {
            userMessage += `Evento: ${item.name}\n`;
            userMessage += `Cantidad: ${item.quantity}\n`;
            userMessage += `*Subtotal:* $${(item.quantity * item.price).toLocaleString('es-CO')}\n\n`;
        });
        const total = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        userMessage += `TOTAL A PAGAR: $${total.toLocaleString('es-CO')}`;

        // 3. Información para administrador (orden real creada)
        const adminLink = `http://localhost:3001/api/orders/${createdOrder.orderId}`;

        // 4. Mensaje completo para WhatsApp
        const fullMessage = `${userMessage}\n\n`;
        const adminInternalMessage = `\n\n`;
        
        const whatsAppMessage = encodeURIComponent(fullMessage + adminInternalMessage);
        
        // REEMPLAZA "573001234567" con tu número de WhatsApp de negocio
        const whatsappUrl = `https://wa.me/573150167613?text=${whatsAppMessage}`;

        window.open(whatsappUrl, '_blank');
    });

    // --- INICIALIZACIÓN ---
    fetchEvents(); // Cargar eventos desde la API
    updateCart();
});
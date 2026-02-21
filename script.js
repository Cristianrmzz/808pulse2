document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN DE LA API ---
    const API_BASE_URL = 'http://localhost:3002/api';

    // --- DATOS DE LOS EVENTOS (Ahora se cargan desde la API) ---
    let eventsData = [];

    // --- VARIABLES Y ELEMENTOS DEL DOM ---
    // --- VARIABLES Y ELEMENTOS DEL DOM ---
    const eventCardsContainer = document.getElementById('event-cards-container');
    const eventSearchInput = document.getElementById('event-search');
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

    let cart = JSON.parse(localStorage.getItem('808pulse_cart')) || [];
    let currentEventId = null;
    let filteredEvents = [];

    // --- DATOS DE RESPALDO ---
    const fallbackEvents = [
        {
            id: 1,
            name: "Neon Dreams Fest",
            date: "25 Oct 2025",
            location: "Centro de Eventos Metropolitano",
            price: 150000,
            image: "https://images.unsplash.com/photo-1582711012103-60a6539455f8?q=80&w=1974&auto=format&fit=crop",
            description: "Una noche inmersiva con los mejores exponentes del techno melódico."
        },
        {
            id: 2,
            name: "Techno Odyssey",
            date: "15 Nov 2025",
            location: "Bodega Industrial 55",
            price: 120000,
            image: "https://images.unsplash.com/photo-1557766133-5415b3c3287a?q=80&w=2070&auto=format&fit=crop",
            description: "Energía pura y ritmos industriales en el corazón de la ciudad."
        },
        {
            id: 3,
            name: "Pulse Warehouse Rave",
            date: "06 Dic 2025",
            location: "Lugar Secreto (se revela 24h antes)",
            price: 180000,
            image: "https://images.unsplash.com/photo-1543306979-041433994a32?q=80&w=2070&auto=format&fit=crop",
            description: "Nuestra reunión anual más exclusiva. El cierre perfecto para el 2025."
        }
    ];

    // --- FUNCIONES DE API ---
    async function fetchEvents() {
        try {
            console.log('Intentando cargar eventos desde:', `${API_BASE_URL}/events`);

            const response = await fetch(`${API_BASE_URL}/events`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const events = await response.json();
            console.log('Eventos cargados desde API:', events);

            eventsData = events.map(event => {
                const d = new Date(event.date);
                const displayDate = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                return {
                    ...event,
                    rawDate: event.date,
                    date: displayDate
                };
            });

            filteredEvents = [...eventsData];
            renderEvents();

        } catch (error) {
            console.error('Error cargando eventos desde API:', error);
            eventsData = fallbackEvents;
            filteredEvents = [...eventsData];
            renderEvents();

            const warningDiv = document.createElement('div');
            warningDiv.className = 'offline-warning';
            warningDiv.innerHTML = '⚠️ Modo offline. Los eventos mostrados son de respaldo.';
            eventCardsContainer.parentNode.insertBefore(warningDiv, eventCardsContainer);
        }
    }

    // --- LÓGICA PARA RENDERIZAR EVENTOS ---
    function renderEvents() {
        eventCardsContainer.innerHTML = '';
        const isAdmin = !!sessionStorage.getItem('adminToken');

        if (filteredEvents.length === 0) {
            eventCardsContainer.innerHTML = '<p class="no-results">No se encontraron eventos con ese nombre.</p>';
            return;
        }

        filteredEvents.forEach(event => {
            const card = document.createElement('div');
            card.className = 'event-card';
            card.innerHTML = `
                <div class="event-card-grid">
                    <div class="event-flyer">
                        <div class="flyer-frame">
                            <img src="${event.image}" alt="Flyer ${event.name}">
                        </div>
                    </div>
                    <div class="event-card-content">
                        <h3>${event.name}</h3>
                        <p><i class="fas fa-calendar-alt"></i> ${event.date}</p>
                        <p><i class="fas fa-map-marker-alt"></i> ${event.location}</p>
                        ${event.description ? `<p class="event-desc">${event.description}</p>` : ''}
                        <div class="event-meta">
                            <span><strong>Precio:</strong> $${Number(event.price).toLocaleString('es-CO')}</span>
                        </div>
                        <div class="event-actions">
                            <button class="cta-button buy-ticket-btn" data-id="${event.id}">Comprar Entrada</button>
                            ${isAdmin ? `<button class="btn-edit-event" data-edit-id="${event.id}"><i class="fas fa-pen"></i></button>` : ''}
                        </div>
                    </div>
                </div>
            `;
            eventCardsContainer.appendChild(card);
        });
    }

    // --- BUSCADOR ---
    if (eventSearchInput) {
        eventSearchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            filteredEvents = eventsData.filter(event =>
                event.name.toLowerCase().includes(term) ||
                event.location.toLowerCase().includes(term)
            );
            renderEvents();
        });
    }

    // --- LÓGICA DEL MODAL ---
    function openModal(eventId) {
        currentEventId = eventId;
        const event = eventsData.find(e => Number(e.id) === Number(eventId));
        if (!event) return;
        document.getElementById('modal-event-title').textContent = event.name;
        ticketQuantityInput.value = 1;
        modal.style.display = 'flex';
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    eventCardsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('buy-ticket-btn')) {
            const eventId = e.target.dataset.id;
            openModal(eventId);
        } else if (e.target.closest('.btn-edit-event')) {
            const btn = e.target.closest('.btn-edit-event');
            const id = btn.dataset.editId;
            openEditEventModal(id);
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
        const event = eventsData.find(e => Number(e.id) === Number(currentEventId));

        const existingItem = cart.find(item => Number(item.id) === Number(currentEventId));
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
        saveCart();
        closeModal();
        updateCart();
        openCart();
    }

    function changeQuantity(id, delta) {
        const item = cart.find(item => Number(item.id) === Number(id));
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) {
                removeFromCart(id);
            } else {
                saveCart();
                updateCart();
            }
        }
    }

    function removeFromCart(id) {
        cart = cart.filter(item => Number(item.id) !== Number(id));
        saveCart();
        updateCart();
    }

    function saveCart() {
        localStorage.setItem('808pulse_cart', JSON.stringify(cart));
    }

    function updateCart() {
        cartItemsContainer.innerHTML = '';
        let total = 0;
        let totalItems = 0;

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<div class="empty-cart-msg"><i class="fas fa-shopping-basket"></i><p>Tu carrito está vacío</p></div>';
        } else {
            cart.forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.className = 'cart-item';
                itemElement.innerHTML = `
                    <div class="cart-item-info">
                        <p class="item-name">${item.name}</p>
                        <p class="item-price">$${item.price.toLocaleString('es-CO')}</p>
                    </div>
                    <div class="cart-item-controls">
                        <div class="qty-btn-group">
                            <button class="qty-minus" data-id="${item.id}">-</button>
                            <span class="qty-val">${item.quantity}</span>
                            <button class="qty-plus" data-id="${item.id}">+</button>
                        </div>
                        <p class="item-subtotal">$${(item.quantity * item.price).toLocaleString('es-CO')}</p>
                        <button class="remove-item-btn" data-id="${item.id}" title="Eliminar">
                            <i class="fas fa-times"></i>
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

    function openCart() {
        cartSidebar.classList.add('open');
    }

    function closeCart() {
        cartSidebar.classList.remove('open');
    }

    // MODAL DE EDICIÓN DE EVENTO (Admin)
    const editModal = document.getElementById('edit-event-modal');
    const closeEditBtn = document.querySelector('.close-edit-event');
    const editForm = document.getElementById('edit-event-form');

    function openEditEventModal(eventId) {
        const ev = eventsData.find(e => Number(e.id) === Number(eventId));
        if (!ev) return;
        document.getElementById('edit-event-id').value = ev.id;
        document.getElementById('edit-name').value = ev.name || '';
        const iso = new Date(ev.rawDate || ev.date).toISOString();
        document.getElementById('edit-date').value = iso.slice(0, 16);
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

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const adminToken = sessionStorage.getItem('adminToken');
            const id = document.getElementById('edit-event-id').value;
            const payload = {
                name: document.getElementById('edit-name').value,
                date: new Date(document.getElementById('edit-date').value).toISOString(),
                location: document.getElementById('edit-location').value,
                price: Number(document.getElementById('edit-price').value),
                image: document.getElementById('edit-image').value,
                description: document.getElementById('edit-description').value,
                capacity: Number(document.getElementById('edit-capacity').value),
                isActive: document.getElementById('edit-isActive').checked
            };
            try {
                const resp = await fetch(`${API_BASE_URL}/events/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
                    body: JSON.stringify(payload)
                });
                if (resp.ok) {
                    closeEditEventModal();
                    fetchEvents();
                }
            } catch (error) { console.error(error); }
        });
    }

    confirmAddToCartBtn.addEventListener('click', addToCart);
    cartIcon.addEventListener('click', openCart);
    closeCartBtn.addEventListener('click', closeCart);

    cartItemsContainer.addEventListener('click', (e) => {
        const id = e.target.closest('[data-id]')?.dataset.id;
        if (!id) return;

        if (e.target.closest('.qty-minus')) {
            changeQuantity(id, -1);
        } else if (e.target.closest('.qty-plus')) {
            changeQuantity(id, 1);
        } else if (e.target.closest('.remove-item-btn')) {
            removeFromCart(id);
        }
    });

    // --- CONFIRMACIÓN DE COMPRA ---
    confirmPurchaseBtn.addEventListener('click', async () => {
        if (cart.length === 0) return;

        let orderItems = cart.map(item => `- ${item.name} (${item.quantity}x)`).join('%0A');
        const total = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);

        const message = `¡Hola 808 Pulse! 🔥%0A%0AQuiero realizar el siguiente pedido:%0A${orderItems}%0A%0A*Total: $${total.toLocaleString('es-CO')}*%0A%0A¿Cómo puedo proceder con el pago?`;
        window.open(`https://wa.me/573212490163?text=${message}`, '_blank');

        // Opcional: Limpiar carrito tras compra
        // cart = []; saveCart(); updateCart();
    });

    // --- INICIALIZACIÓN ---
    fetchEvents();
    updateCart();
});
document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN DE LA API ---
    // En producción, cambia esta URL por la de tu backend real (ej: 'https://api.808pulse.com')
    const PROD_API_URL = 'https://tudominio-backend.com/api';
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const API_BASE_URL = isLocalhost
        ? `http://${window.location.hostname}:3002/api`
        : PROD_API_URL;

    console.log(`Conectado a la API en: ${API_BASE_URL}`);

    // --- DATOS DE LOS EVENTOS (Ahora se cargan desde la API) ---
    let eventsData = [];

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
            name: "Lourdes",
            date: "15 Jun 2024",
            location: "Lourdes Music Hall",
            price: 80000,
            image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop",
            description: "Una experiencia musical única en el corazón de la ciudad."
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
            const dateValue = document.getElementById('edit-date').value;
            if (!dateValue) {
                alert('Por favor selecciona una fecha válida');
                return;
            }

            const payload = {
                name: document.getElementById('edit-name').value,
                date: new Date(dateValue).toISOString(),
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
                    alert('✅ Evento actualizado con éxito');
                    closeEditEventModal();
                    fetchEvents();
                } else {
                    const errData = await resp.json();
                    alert('❌ Error al guardar: ' + (errData.message || 'Error desconocido'));
                }
            } catch (error) {
                console.error(error);
                alert('❌ Error de conexión con el servidor');
            }
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

    // --- LÓGICA DE VISTAS DEL CARRITO ---
    const cartItemsView = document.getElementById('cart-items-view');
    const checkoutView = document.getElementById('checkout-view');
    const goToCheckoutBtn = document.getElementById('go-to-checkout-btn');
    const backToCartBtn = document.getElementById('back-to-cart-btn');
    const checkoutForm = document.getElementById('checkout-form');
    const checkoutTotalSpan = document.getElementById('checkout-total');

    if (goToCheckoutBtn) {
        goToCheckoutBtn.addEventListener('click', () => {
            if (cart.length === 0) return;
            cartItemsView.style.display = 'none';
            checkoutView.style.display = 'flex';

            let totalItems = 0;
            let total = 0;
            cart.forEach(item => {
                totalItems += item.quantity;
                total += (item.quantity * item.price);
            });

            checkoutTotalSpan.textContent = total.toLocaleString('es-CO');

            const attendeesContainer = document.getElementById('attendees-container');
            if (attendeesContainer) {
                attendeesContainer.innerHTML = ''; // Limpiar campos previos

                if (totalItems >= 2) {
                    const notice = document.createElement('p');
                    notice.style.fontSize = '14px';
                    notice.style.color = '#00ffff';
                    notice.style.marginBottom = '15px';
                    notice.innerText = 'Por favor, ingresa los datos de cada asistente. Cada entrada será personalizada.';
                    attendeesContainer.appendChild(notice);

                    let ticketCounter = 1;

                    cart.forEach(item => {
                        for (let i = 0; i < item.quantity; i++) {
                            const groupDiv = document.createElement('div');
                            groupDiv.style.background = 'rgba(255, 255, 255, 0.05)';
                            groupDiv.style.padding = '15px';
                            groupDiv.style.borderRadius = '8px';
                            groupDiv.style.marginBottom = '15px';
                            groupDiv.style.border = '1px solid rgba(0, 255, 255, 0.1)';

                            groupDiv.innerHTML = `
                                <h4 style="margin-top: 0; color: #eafcff; font-size: 15px; margin-bottom: 15px;">Entrada ${ticketCounter} - ${item.name}</h4>
                                <div class="form-group" style="margin-bottom: 10px;">
                                    <label for="att-name-${item.id}-${i}" style="font-size: 13px;">Nombre del Asistente</label>
                                    <input type="text" id="att-name-${item.id}-${i}" class="attendee-name-input" data-event-id="${item.id}" data-index="${i}" required placeholder="Ej: Maria Lopez" pattern="^[a-zA-ZáéíóúÁÉÍÓÚñÑ\\s]+$" title="Solo letras">
                                </div>
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label for="att-doc-${item.id}-${i}" style="font-size: 13px;">Cédula o Documento</label>
                                    <input type="text" id="att-doc-${item.id}-${i}" class="attendee-doc-input" data-event-id="${item.id}" data-index="${i}" required placeholder="Ej: 1000123456" minlength="5" maxlength="12" pattern="^[0-9]{5,12}$" title="Debe tener entre 5 y 12 números">
                                </div>
                            `;
                            attendeesContainer.appendChild(groupDiv);
                            ticketCounter++;
                        }
                    });

                    // Añadir lógica en tiempo real para quitar letras de la cédula y números del nombre
                    document.querySelectorAll('.attendee-name-input').forEach(input => {
                        input.addEventListener('input', (e) => e.target.value = e.target.value.replace(/[0-9]/g, ''));
                    });
                    document.querySelectorAll('.attendee-doc-input').forEach(input => {
                        input.addEventListener('input', (e) => e.target.value = e.target.value.replace(/\\D/g, '').slice(0, 12));
                    });
                }
            }
        });
    }

    if (backToCartBtn) {
        backToCartBtn.addEventListener('click', () => {
            checkoutView.style.display = 'none';
            cartItemsView.style.display = 'block';
        });
    }

    // --- VALIDACIONES DE FORMULARIO ---
    const nameInput = document.getElementById('customer-name');
    const docInput = document.getElementById('customer-doc');
    const phoneInput = document.getElementById('customer-phone');

    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            // Eliminar cualquier número del nombre en tiempo real
            e.target.value = e.target.value.replace(/[0-9]/g, '');

            // Si existen asistentes múltiples, sincronizar el primero con el nombre del comprador
            const firstAttendeeNameInput = document.querySelector('.attendee-name-input');
            if (firstAttendeeNameInput) {
                firstAttendeeNameInput.value = e.target.value;
            }
        });
    }

    if (docInput) {
        docInput.addEventListener('input', (e) => {
            // Permitir solo números
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);

            // Sincronizar la cédula de la primera entrada con el documento proporcionado aquí
            const firstAttendeeDocInput = document.querySelector('.attendee-doc-input');
            if (firstAttendeeDocInput) {
                firstAttendeeDocInput.value = e.target.value;
            }
        });
    }

    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            // Permitir solo números y máximo 10 caracteres
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
        });
    }

    // --- CONFIRMACIÓN DE COMPRA (BACKEND + WHATSAPP) ---
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (cart.length === 0) return;

            const name = document.getElementById('customer-name').value.trim();
            const doc = document.getElementById('customer-doc').value.trim();
            const email = document.getElementById('customer-email').value.trim();
            const phone = document.getElementById('customer-phone').value.trim();

            // Validaciones Explícitas
            if (/\d/.test(name)) {
                alert('El nombre no puede contener números.');
                return;
            }

            if (!email.includes('@')) {
                alert('Por favor, ingresa un correo electrónico válido.');
                return;
            }

            if (phone.length !== 10) {
                alert('El teléfono debe tener exactamente 10 dígitos.');
                return;
            }

            const confirmBtn = document.getElementById('confirm-purchase-btn');
            const originalBtnText = confirmBtn.textContent;

            try {
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Procesando...';

                const customerInfo = { name, cedula: doc, email, phone };

                // Recolectar asistentes
                const totalTickets = cart.reduce((sum, item) => sum + item.quantity, 0);
                const orderItemsPayload = cart.map(item => {
                    const attendees = [];
                    if (totalTickets >= 2) {
                        for (let i = 0; i < item.quantity; i++) {
                            const attNameInput = document.getElementById(`att-name-${item.id}-${i}`);
                            const attDocInput = document.getElementById(`att-doc-${item.id}-${i}`);
                            if (attNameInput && attDocInput) {
                                attendees.push({
                                    name: attNameInput.value.trim(),
                                    cedula: attDocInput.value.trim()
                                });
                            }
                        }
                    }
                    return {
                        eventId: item.id,
                        quantity: item.quantity,
                        attendees: attendees
                    };
                });

                const orderPayload = {
                    items: orderItemsPayload,
                    customerInfo
                };

                console.log('Enviando orden al backend:', orderPayload);

                const response = await fetch(`${API_BASE_URL}/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderPayload)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Error al crear la orden');
                }

                const savedOrder = await response.json();
                console.log('Orden creada exitosamente:', savedOrder);

                // Preparar mensaje para WhatsApp
                const orderItemsText = cart.map(item => `- ${item.name} (${item.quantity}x)`).join('\n');
                const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);

                const rawMessage = `¡Hola 808 Pulse! 👋\n\nAcabo de realizar un pedido en la web (Orden #${savedOrder.orderId}).\n\n*Detalles de mi pedido:*\n${orderItemsText}\n\n*Total a pagar: $${totalAmount.toLocaleString('es-CO')}*\n\nMe gustaría saber cuáles son los *métodos de pago disponibles* para confirmar mi entrada. 🎫\n\n*Mis Datos:*\n- Nombre: ${customerInfo.name}\n- Email: ${customerInfo.email}\n- Tel: ${customerInfo.phone}`;

                const encodedMessage = encodeURIComponent(rawMessage);

                // Limpiar carrito
                cart = [];
                saveCart();
                updateCart();

                // Reset vista
                checkoutView.style.display = 'none';
                cartItemsView.style.display = 'block';
                closeCart();

                // Abrir WhatsApp solo cuando el usuario haga clic en "Entendido"
                const whatsappUrl = `https://wa.me/573150167613?text=${encodedMessage}`;

                const successModal = document.getElementById('success-modal');
                const successBtn = document.getElementById('success-modal-btn');

                successModal.style.display = 'flex';

                successBtn.onclick = () => {
                    successModal.style.display = 'none';
                    // Intentar abrir en nueva pestaña, si falla (bloqueador), abrir en la misma
                    const newWin = window.open(whatsappUrl, '_blank');
                    if (!newWin || newWin.closed || typeof newWin.closed == 'undefined') {
                        window.location.href = whatsappUrl;
                    }
                };

            } catch (error) {
                console.error('Error en el checkout:', error);
                alert('Hubo un error al procesar tu pedido: ' + error.message);
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.textContent = originalBtnText;
            }
        });
    }

    // --- INICIALIZACIÓN ---
    fetchEvents();
    updateCart();

    // --- ANIMACIONES DE REVELACIÓN (Scroll) ---
    const revealOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, revealOptions);

    // Observar elementos estáticos
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    // Observar cambios en el contenedor de eventos para animar cards dinámicas
    const containerForEvents = document.getElementById('event-cards-container');
    if (containerForEvents) {
        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList.contains('event-card')) {
                        node.classList.add('reveal');
                        setTimeout(() => revealObserver.observe(node), 10);
                    }
                });
            });
        });
        mutationObserver.observe(containerForEvents, { childList: true });
    }
});
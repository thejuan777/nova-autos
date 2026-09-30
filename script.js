import { configured } from './js/supabase-client.js';
import { listVehicles } from './js/vehicles.js';
import { el, link, photo, title, money, kilometers, statuses, whatsapp, setupMenu, notice } from './js/ui.js';

setupMenu();
const grid = document.querySelector('.vehicles-grid');
const message = el('p', 'notice');
message.setAttribute('role', 'status');
grid.before(message);
if (configured) {
    grid.replaceChildren();
    notice(message, 'Cargando vehículos…');
    load();
} else {
    notice(message, 'Stock de demostración. Consultá disponibilidad por WhatsApp.');
    grid.querySelectorAll('img').forEach(img => {
        const fallback = () => { img.src = 'img/placeholder.svg'; };
        img.addEventListener('error', fallback, { once: true });
        if (img.complete && !img.naturalWidth) fallback();
    });
}
async function load() {
    try {
        const vehicles = await listVehicles();
        notice(message, vehicles.length ? '' : 'Todavía no hay vehículos publicados. Consultanos para conocer las próximas novedades.');
        for (const v of vehicles) {
            const card = el('article', 'vehicle-card');
            const image = el('div', 'vehicle-image');
            image.append(photo(v.images[0]?.url, title(v)));
            const info = el('div', 'vehicle-info');
            const data = el('div', 'vehicle-data');
            [v.year, kilometers(v.mileage), v.condition, v.transmission || 'Transmisión a consultar'].forEach(text => data.append(el('span', '', text)));
            info.append(el('p', 'vehicle-brand', v.brand.toUpperCase()), el('h3', '', title(v)), el('span', `badge ${v.status}`, statuses[v.status]), data,
                el('p', 'vehicle-price', money(v.price)), link('Ver vehículo', `vehiculo.html?id=${v.id}`, 'vehicle-button'), link('Consultar por WhatsApp', whatsapp(v), 'whatsapp-link'));
            card.append(image, info);
            grid.append(card);
        }
    } catch {
        notice(message, 'No pudimos cargar el stock. Intentá nuevamente en unos minutos o consultanos por WhatsApp.', true);
    }
}

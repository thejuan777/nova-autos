import { getVehicle } from './js/vehicles.js';
import { configured } from './js/supabase-client.js';
import { el, link, photo, title, money, kilometers, statuses, whatsapp, notice, button } from './js/ui.js';
const message = document.querySelector('#detail-message');
const detail = document.querySelector('#vehicle-detail');
const id = new URLSearchParams(location.search).get('id');
if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notice(message, 'No encontramos ese vehículo. Volvé al stock para ver los disponibles.', true);
} else if (!configured) {
    notice(message, 'Las fichas estarán disponibles cuando se habilite el catálogo. Por ahora consultanos por WhatsApp.');
} else {
    try {
        const v = await getVehicle(id);
        if (!v) { notice(message, 'Este vehículo ya no está publicado. Volvé al stock para ver los disponibles.'); }
        else {
            document.title = `${title(v)} ${v.year} | NOVA AUTOS`;
            const gallery = el('section', 'gallery');
            gallery.setAttribute('aria-label', 'Fotografías del vehículo');
            const large = photo(v.images[0]?.url, title(v), 'detail-main-image');
            large.loading = 'eager';
            const thumbs = el('div', 'thumbnails');
            v.images.forEach((image, index) => {
                const thumb = button('', () => {
                    const replacement = photo(image.url, `${title(v)} · foto ${index + 1}`, 'detail-main-image');
                    gallery.querySelector('.detail-main-image').replaceWith(replacement);
                    thumbs.querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed', String(node === thumb)));
                }, 'thumbnail');
                thumb.setAttribute('aria-label', `Ver foto ${index + 1}`);
                thumb.setAttribute('aria-pressed', String(index === 0));
                thumb.append(photo(image.url, '')); thumbs.append(thumb);
            });
            gallery.append(large, thumbs);
            const info = el('section', 'detail-info');
            info.append(el('p', 'vehicle-brand', v.brand.toUpperCase()), el('h1', '', title(v)), el('span', `badge ${v.status}`, statuses[v.status]), el('p', 'vehicle-price', money(v.price)));
            const specs = el('dl', 'specs');
            for (const [label, value] of [['Año', v.year], ['Kilometraje', kilometers(v.mileage)], ['Condición', v.condition], ['Combustible', v.fuel], ['Transmisión', v.transmission], ['Color', v.color], ['Puertas', v.doors], ['Motor', v.engine], ['Ubicación', v.location]]) {
                const spec = el('div', 'spec');
                spec.append(el('dt', '', label), el('dd', '', value || 'A consultar')); specs.append(spec);
            }
            info.append(specs);
            if (v.status === 'sold') info.append(el('p', 'notice', 'Este vehículo ya fue vendido. Consultanos por opciones similares.'));
            info.append(link('Consultar por WhatsApp', whatsapp(v), 'vehicle-button'), el('p', 'description', v.description || 'Consultanos para conocer más detalles de este vehículo.'));
            detail.append(gallery, info); detail.hidden = false; notice(message, '');
        }
    } catch { notice(message, 'No pudimos cargar el vehículo. Intentá nuevamente o consultanos por WhatsApp.', true); }
}

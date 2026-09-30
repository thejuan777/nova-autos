import { WHATSAPP_NUMBER } from '../supabase-config.js';
export const statuses = { available: 'DISPONIBLE', reserved: 'RESERVADO', sold: 'VENDIDO' };
export const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
export const kilometers = value => value == null ? 'Kilometraje a consultar' : `${Number(value).toLocaleString('es-AR')} km`;
export const title = v => [v.brand, v.model, v.version].filter(Boolean).join(' ');
export const whatsapp = v => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hola NOVA AUTOS, quiero consultar por el ${title(v)} ${v.year}.`)}`;
export function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}
export function link(text, href, className = '') {
    const node = el('a', className, text);
    node.href = href;
    if (href.startsWith('https://wa.me/')) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
    return node;
}
export function photo(url, alt, className = '') {
    const image = el('img', className);
    image.alt = alt;
    image.loading = 'lazy';
    image.src = url || 'img/placeholder.svg';
    image.addEventListener('error', () => { image.src = 'img/placeholder.svg'; }, { once: true });
    return image;
}
export function notice(node, text, error = false) {
    node.textContent = text;
    node.classList.toggle('error', error);
    node.hidden = !text;
}
export function button(text, action, className = 'action') {
    const node = el('button', className, text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
}
export function setupMenu() {
    const trigger = document.querySelector('.menu-button');
    const nav = document.querySelector('.nav');
    if (!trigger || !nav) return;
    nav.id = 'main-navigation';
    trigger.setAttribute('aria-controls', nav.id);
    const close = () => { nav.classList.remove('is-open'); trigger.setAttribute('aria-expanded', 'false'); };
    close();
    trigger.addEventListener('click', () => {
        const open = nav.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', String(open));
        trigger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });
    nav.addEventListener('click', close);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
}

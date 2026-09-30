import { configured, getClient } from './js/supabase-client.js';
import { notice } from './js/ui.js';
const form = document.querySelector('#login-form');
const message = document.querySelector('#login-message');
const submit = form.querySelector('button');
const reason = new URLSearchParams(location.search).get('reason');
if (!configured) { notice(message, 'Falta configurar la conexión con Supabase. Consultá el README del proyecto.', true); submit.disabled = true; }
else if (reason) notice(message, reason === 'unauthorized' ? 'Esta cuenta no tiene permiso para administrar vehículos.' : 'Tu sesión terminó. Ingresá nuevamente.', true);
form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    submit.textContent = 'Ingresando…';
    notice(message, '');
    try {
        const client = await getClient();
        const { error } = await client.auth.signInWithPassword({ email: form.elements.email.value.trim(), password: form.elements.password.value });
        form.elements.password.value = '';
        if (error) {
            notice(message, error.status === 429 ? 'Demasiados intentos. Esperá unos minutos antes de volver a intentar.' : 'No pudimos iniciar sesión. Revisá el email y la contraseña, o intentá nuevamente.', true);
            return;
        }
        const allowed = await client.rpc('is_admin');
        if (allowed.error) throw allowed.error;
        if (!allowed.data) { await client.auth.signOut(); notice(message, 'Esta cuenta no tiene permiso para administrar vehículos.', true); return; }
        location.replace('admin.html');
    } catch { notice(message, 'No pudimos conectar con el servicio. Revisá tu conexión y la configuración de Supabase.', true); }
    finally { submit.disabled = false; submit.textContent = 'Iniciar sesión'; }
});

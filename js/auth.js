import { getClient } from './supabase-client.js';
export async function requireAdmin() {
    const client = await getClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) { location.replace('login.html'); return null; }
    const allowed = await client.rpc('is_admin');
    if (allowed.error) throw allowed.error;
    if (!allowed.data) { await client.auth.signOut(); location.replace('login.html?reason=unauthorized'); return null; }
    client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) location.replace('login.html?reason=expired');
    });
    return client;
}

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase-config.js';

export const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
let clientPromise;
export function getClient() {
    if (!configured) throw new Error('Primero configurá Supabase en supabase-config.js.');
    clientPromise ??= import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm')
        .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
    return clientPromise;
}

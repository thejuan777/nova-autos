import { getClient } from './supabase-client.js';
export const BUCKET = 'vehicle-photos';
export const MAX_IMAGES = 10;
export const MAX_BYTES = 5 * 1024 * 1024;
export const imageTypes = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export function validateImages(files, existingCount = 0) {
    if (existingCount + files.length > MAX_IMAGES) throw new Error('Podés guardar hasta 10 fotos por vehículo.');
    for (const file of files) {
        if (!imageTypes[file.type]) throw new Error('Usá imágenes JPG, PNG o WebP.');
        if (!file.size || file.size > MAX_BYTES) throw new Error('Cada foto debe pesar entre 1 byte y 5 MB.');
    }
}
export async function listVehicles(admin = false) {
    const client = await getClient();
    // Paginación para no truncar silenciosamente catálogos de más de 1000 registros.
    const result = [];
    for (let from = 0; ; from += 500) {
        let query = client.from('vehicles').select('*, vehicle_images(*)').order('created_at', { ascending: false }).order('id').range(from, from + 499);
        if (!admin) query = query.neq('status', 'sold');
        const { data, error } = await query;
        if (error) throw error;
        result.push(...data);
        if (data.length < 500) break;
    }
    return hydrate(client, result);
}
export async function getVehicle(id) {
    const client = await getClient();
    const { data, error } = await client.from('vehicles').select('*, vehicle_images(*)').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? hydrate(client, [data])[0] : null;
}
function hydrate(client, vehicles) {
    return vehicles.map(v => ({ ...v, images: (v.vehicle_images || [])
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position)
        .map(image => ({ ...image, url: client.storage.from(BUCKET).getPublicUrl(image.storage_path).data.publicUrl })) }));
}
export async function cleanupStorage() {
    const client = await getClient();
    const { data, error } = await client.from('storage_cleanup').select('storage_path').lte('not_before', new Date().toISOString()).limit(100);
    if (error) return false;
    for (const item of data) {
        const removed = await client.storage.from(BUCKET).remove([item.storage_path]);
        if (removed.error) return false;
        const deleted = await client.from('storage_cleanup').delete().eq('storage_path', item.storage_path);
        if (deleted.error) return false;
    }
    return true;
}
export async function saveVehicle(vehicle, images, expectedUpdatedAt) {
    const client = await getClient();
    const paths = [];
    try {
        for (const item of images) {
            if (!item.file) { paths.push(item.storage_path); continue; }
            const path = `${vehicle.id}/${crypto.randomUUID()}.${imageTypes[item.file.type]}`;
            // Registrar antes de subir: una pestaña cerrada no pierde la referencia al archivo huérfano.
            const queued = await client.from('storage_cleanup').insert({ storage_path: path, not_before: new Date(Date.now() + 86400000).toISOString() });
            if (queued.error) throw queued.error;
            const uploaded = await client.storage.from(BUCKET).upload(path, item.file, { contentType: item.file.type, upsert: false });
            if (uploaded.error) throw uploaded.error;
            paths.push(path);
        }
        const { data, error } = await client.rpc('save_vehicle', { payload: vehicle, image_paths: paths, expected_updated_at: expectedUpdatedAt || null });
        if (error) throw error;
        return data;
    } catch (error) {
        // Ante una respuesta de red ambigua no borrar fotos: la transacción podría haberse confirmado.
        // El SQL retira de la cola sólo los archivos que quedaron asociados al vehículo.
        throw error;
    }
}

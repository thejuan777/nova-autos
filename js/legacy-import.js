import { getVehicle } from './vehicles.js';
import { title, notice, el } from './ui.js';
export async function setupLegacyImport(editor, message) {
    const select = document.querySelector('#legacy-vehicle');
    const trigger = document.querySelector('#import-legacy');
    try {
        const response = await fetch('supabase/legacy-stock.json');
        if (!response.ok) throw new Error();
        const stock = await response.json();
        for (const v of stock) { const option = el('option', '', `${title(v)} ${v.year}`); option.value = v.id; select.append(option); }
        trigger.disabled = false;
        trigger.addEventListener('click', async () => {
            trigger.disabled = true;
            try {
                const v = stock.find(item => item.id === select.value);
                const existing = await getVehicle(v.id);
                if (existing) { editor.open(existing); return; }
                const response = await fetch(v.photo);
                if (!response.ok) throw new Error();
                const bitmap = await createImageBitmap(await response.blob());
                // Hay originales AVIF/WebP con extensión .jpg. Normalizar una copia sin alterar img/.
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width; canvas.height = bitmap.height;
                canvas.getContext('2d').drawImage(bitmap, 0, 0); bitmap.close();
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .92));
                if (!blob) throw new Error();
                editor.openDraft({ ...v, location: 'San Juan', status: 'available' }, new File([blob], 'foto-original.jpg', { type: 'image/jpeg' }));
            } catch { notice(message, 'No pudimos preparar el vehículo anterior. Intentá nuevamente o cargalo con Agregar vehículo.', true); }
            finally { trigger.disabled = false; }
        });
    } catch { notice(message, 'No pudimos cargar la lista anterior para migrar. Podés agregar vehículos con el formulario.', true); }
}

import { validateImages, saveVehicle } from './vehicles.js';
import { el, photo, button, notice } from './ui.js';

export function createVehicleEditor(onSaved, onFailure) {
    const dialog = document.querySelector('#vehicle-dialog');
    const form = document.querySelector('#vehicle-form');
    const message = document.querySelector('#form-message');
    const previews = document.querySelector('#image-previews');
    const fileInput = document.querySelector('#image-files');
    const save = document.querySelector('#save-vehicle');
    let images = [], current = null, vehicleId, saving = false, decoding = false;

    function release() { images.forEach(image => { if (image.file) URL.revokeObjectURL(image.url); }); }
    function close() { if (!saving && !decoding) dialog.close(); }
    dialog.addEventListener('close', release);
    dialog.addEventListener('cancel', event => { if (saving || decoding) event.preventDefault(); });
    document.querySelector('#close-form').addEventListener('click', close);
    document.querySelector('#cancel-form').addEventListener('click', close);
    window.addEventListener('beforeunload', event => {
        if (saving) { event.preventDefault(); event.returnValue = ''; }
    });
    function renderImages() {
        previews.replaceChildren();
        images.forEach((image, index) => {
            const preview = el('div', 'image-preview');
            preview.append(photo(image.url, `Foto ${index + 1}`), el('p', 'help', index === 0 ? 'Foto principal' : `Foto ${index + 1}`));
            if (index) preview.append(button('Usar como principal', () => { images.unshift(...images.splice(index, 1)); renderImages(); }));
            preview.append(button('Quitar foto', () => {
                if (image.file) URL.revokeObjectURL(image.url);
                images.splice(index, 1); renderImages();
            }));
            previews.append(preview);
        });
    }
    fileInput.addEventListener('change', async () => {
        if (saving || decoding) return;
        decoding = true; save.disabled = true; fileInput.disabled = true;
        const files = Array.from(fileInput.files);
        try {
            validateImages(files, images.length);
            // Decodificar además de validar el MIME: un archivo renombrado no es una fotografía.
            for (const file of files) {
                const bitmap = await createImageBitmap(file);
                const tooLarge = bitmap.width * bitmap.height > 40000000;
                bitmap.close();
                if (tooLarge) throw new Error('Usá fotos de hasta 40 megapíxeles.');
            }
            images.push(...files.map(file => ({ file, url: URL.createObjectURL(file) })));
            renderImages();
            notice(message, `${images.length} fotos listas. Se subirán al guardar el vehículo.`);
        } catch (error) {
            notice(message, error instanceof DOMException ? 'Una de las fotos no es una imagen válida. Elegí otro archivo.' : error.message, true);
        } finally { fileInput.value = ''; decoding = false; save.disabled = false; fileInput.disabled = false; }
    });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (saving || decoding || !form.reportValidity()) return;
        if (!images.length) { notice(message, 'Agregá al menos una fotografía antes de guardar.', true); return; }
        const values = Object.fromEntries(new FormData(form));
        for (const key of Object.keys(values)) values[key] = values[key].trim();
        if (!values.brand || !values.model || !values.location) { notice(message, 'Completá marca, modelo y ubicación.', true); return; }
        for (const name of ['year', 'mileage', 'price', 'doors']) values[name] = values[name] === '' ? null : Number(values[name]);
        values.id = vehicleId;
        saving = true;
        document.querySelector('#vehicle-fields').disabled = true;
        dialog.querySelectorAll('button').forEach(node => { node.disabled = true; });
        notice(message, 'Subiendo fotografías y guardando vehículo. Esperá sin cerrar esta ventana…');
        save.textContent = 'Guardando…';
        try {
            await saveVehicle(values, images, current?.updated_at);
            dialog.close();
            await onSaved(Boolean(current));
        } catch (error) {
            if (error?.code === '40001') notice(message, 'El vehículo cambió en otra sesión. Cerrá este formulario y recargá el panel antes de editarlo.', true);
            else if (error?.status === 401 || error?.code === '42501') await onFailure(error, message);
            else notice(message, 'No pudimos confirmar el guardado. Revisá tu conexión. Si se interrumpió la respuesta, recargá el panel para comprobar si ya se publicó antes de reintentar.', true);
        } finally {
            saving = false;
            document.querySelector('#vehicle-fields').disabled = false;
            dialog.querySelectorAll('button').forEach(node => { node.disabled = false; });
            save.textContent = current ? 'Guardar cambios' : 'Publicar vehículo';
        }
    });
    function open(vehicle = null) {
            release(); form.reset(); current = vehicle;
            vehicleId = vehicle?.id || crypto.randomUUID();
            images = vehicle ? vehicle.images.map(image => ({ ...image })) : [];
            if (vehicle) for (const control of form.elements) {
                if (control.name && Object.hasOwn(vehicle, control.name)) control.value = vehicle[control.name] ?? '';
            }
            document.querySelector('#form-title').textContent = vehicle ? 'Editar vehículo' : 'Agregar vehículo';
            save.textContent = vehicle ? 'Guardar cambios' : 'Publicar vehículo';
            notice(message, ''); renderImages(); dialog.showModal();
    }
    return {
        open,
        openDraft(vehicle, file) {
            validateImages([file]);
            open();
            vehicleId = vehicle.id;
            for (const control of form.elements) {
                if (control.name && Object.hasOwn(vehicle, control.name)) control.value = vehicle[control.name] ?? '';
            }
            images = [{ file, url: URL.createObjectURL(file) }];
            renderImages();
            notice(message, 'Datos recuperados de la web anterior. Confirmá condición, combustible, transmisión y kilometraje antes de publicar.');
        }
    };
}

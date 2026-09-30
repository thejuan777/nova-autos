import { mkdir, copyFile, cp } from 'node:fs/promises';
// Sólo archivos públicos; SQL, pruebas y documentación no se publican.
await mkdir('dist/supabase', { recursive: true });
for (const file of ['index.html', 'style.css', 'script.js', 'login.html', 'login.js', 'admin.html', 'admin.js', 'admin.css', 'vehiculo.html', 'vehiculo.js', 'supabase-config.js', '_headers']) {
    await copyFile(file, `dist/${file}`);
}
await cp('js', 'dist/js', { recursive: true });
await cp('img', 'dist/img', { recursive: true });
await copyFile('supabase/legacy-stock.json', 'dist/supabase/legacy-stock.json');
console.log('Sitio preparado en dist/');

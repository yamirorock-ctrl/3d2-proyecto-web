import fs from 'fs';
import path from 'path';

const envPath = '.env.local';
const keyPath = 'privada.key';

try {
    const newKey = fs.readFileSync(keyPath, 'utf8').trim();
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Buscamos la línea de la clave privada y la reemplazamos
    const regex = /^AFIP_PRIVATE_KEY=.*$/m;
    
    // El formato será el mismo que tenías: con las comillas y \n para mantener consistencia
    // aunque mi blindaje en la API maneja ambos casos.
    const escapedKey = newKey.replace(/\r?\n/g, '\\n');
    const newLine = `AFIP_PRIVATE_KEY="${escapedKey}"`;

    if (regex.test(envContent)) {
        envContent = envContent.replace(regex, newLine);
    } else {
        envContent += `\n${newLine}`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env.local actualizado con la nueva clave privada de forma segura.');
} catch (error) {
    console.error('❌ Error al actualizar .env.local:', error.message);
}

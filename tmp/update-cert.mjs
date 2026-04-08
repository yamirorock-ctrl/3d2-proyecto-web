import fs from 'fs';
import path from 'path';

const envPath = '.env.local';
const certPath = '3D2Store_1b73c1ea40df162.crt';

try {
    const newCert = fs.readFileSync(certPath, 'utf8').trim();
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Buscamos la línea del certificado y la reemplazamos
    const regex = /^AFIP_CERTIFICATE=.*$/m;
    
    // Lo formateamos con \n literales
    const escapedCert = newCert.replace(/\r?\n/g, '\\n');
    const newLine = `AFIP_CERTIFICATE="${escapedCert}"`;

    if (regex.test(envContent)) {
        envContent = envContent.replace(regex, newLine);
    } else {
        envContent += `\n${newLine}`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env.local actualizado con el NUVEO CERTIFICADO de forma segura.');
} catch (error) {
    console.error('❌ Error al actualizar .env.local:', error.message);
}

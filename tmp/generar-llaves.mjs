import forge from 'node-forge';
import fs from 'fs';
import dotenv from 'dotenv';

// Cargamos el CUIT del .env
dotenv.config({ path: '.env.local' });
const cuit = (process.env.VITE_AFIP_CUIT || process.env.AFIP_CUIT || '').replace(/[-"'\s]/g, '');

if (!cuit) {
    console.error('❌ Error: No se encontró el CUIT en el archivo .env.local');
    process.exit(1);
}

console.log('--- GENERADOR DE CREDENCIALES AFIP ---');
console.log('Generando para CUIT:', cuit);

// 1. Generar par de llaves
console.log('Generando par de llaves RSA (2048 bits)...');
const keys = forge.pki.rsa.generateKeyPair(2048);

// 2. Crear pedido de certificado (CSR)
console.log('Creando pedido de certificado (CSR)...');
const csr = forge.pki.createCertificationRequest();
csr.publicKey = keys.publicKey;
csr.setSubject([
  { name: 'commonName', value: '3d2store' },
  { name: 'serialNumber', value: `CUIT ${cuit}` }
]);

// Firmar el CSR con la clave privada
csr.sign(keys.privateKey);

// 3. Exportar archivos
const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
const csrPem = forge.pki.certificationRequestToPem(csr);

fs.writeFileSync('privada.key', privateKeyPem);
fs.writeFileSync('pedido.csr', csrPem);

console.log('\n✅ ¡ÉXITO!');
console.log('-------------------------------------------');
console.log('1. Subí el archivo "pedido.csr" a AFIP.');
console.log('2. Copiá el contenido de "privada.key" a tu .env.local y Vercel.');
console.log('-------------------------------------------');

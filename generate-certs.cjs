const forge = require('node-forge');
const fs = require('fs');

console.log('🔄 Generando credenciales para 3D2 (AFIP)...');

// 1. Generar par de llaves (2048 bits como pide AFIP)
const keys = forge.pki.rsa.generateKeyPair(2048);
const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

// 2. Crear pedido de certificación (CSR)
const csr = forge.pki.createCertificationRequest();
csr.publicKey = keys.publicKey;
csr.setSubject([
    { name: 'commonName', value: '3D2 - Facturacion Web' },
    { name: 'organizationName', value: '3D2' },
    { name: 'organizationalUnitName', value: 'IT Dept' },
    { name: 'countryName', value: 'AR' }
]);

// Firmar el CSR con la llave privada
csr.sign(keys.privateKey);

const csrPem = forge.pki.certificationRequestToPem(csr);

// 3. Guardar archivos
fs.writeFileSync('3d2-private.key', privateKeyPem);
fs.writeFileSync('3d2-afip.csr', csrPem);

console.log('✅ EXITO: Archivos creados correctamente.');
console.log('📄 3d2-private.key (¡NO COMPARTIR!)');
console.log('📄 3d2-afip.csr (Subir este a la web de AFIP)');

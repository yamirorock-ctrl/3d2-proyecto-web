import fs from 'fs';
import forge from 'node-forge';

try {
    const cert = fs.readFileSync('3D2Store_1b73c1ea40df162.crt', 'utf8');
    const key = fs.readFileSync('privada.key', 'utf8');

    console.log('1. Archivos leídos');
    console.log('   Cert: ', cert.substring(0, 50), '...');
    console.log('   Key:  ', key.substring(0, 50), '...');

    const certificate = forge.pki.certificateFromPem(cert);
    console.log('2. Certificado parseado');
    console.log('   Subject:', certificate.subject.getField('CN').value);

    const privateKey = forge.pki.privateKeyFromPem(key);
    console.log('3. Clave privada parseada');

    console.log('4. Intentando firma de prueba...');
    const md = forge.md.sha256.create();
    md.update('test', 'utf8');
    const signature = privateKey.sign(md);
    console.log('5. Firma exitosa. Longitud:', signature.length);

} catch (err) {
    console.error('❌ ERROR EN CHEQUEO:', err.message);
}

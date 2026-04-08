import dotenv from 'dotenv';
import forge from 'node-forge';
import soap from 'soap';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

// Cargamos archivos directos para no fallar
const AFIP_CERT = fs.readFileSync('3D2Store_1b73c1ea40df162.crt', 'utf8');
const AFIP_KEY = fs.readFileSync('privada.key', 'utf8');

const URL_WSAA_PROD = "https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl";

async function run() {
    console.log("🚀 Iniciando Conector Nativo 3D2 (Producción)...");
    
    try {
        // Generamos el XML de pedido de ticket (Restamos 10 min para prevenir clock drift)
        const now = new Date();
        const genTime = new Date(now.getTime() - 600000); // 10 min antes
        const expTime = new Date(now.getTime() + 600000); // 10 min después
        
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <loginTicketRequest version="1.0">
          <header>
            <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
            <generationTime>${genTime.toISOString().split('.')[0] + '-03:00'}</generationTime>
            <expirationTime>${expTime.toISOString().split('.')[0] + '-03:00'}</expirationTime>
          </header>
          <service>wsfe</service>
        </loginTicketRequest>`;

        console.log("📝 Firmando CMS...");
        const p7 = forge.pkcs7.createSignedData();
        p7.content = forge.util.createBuffer(xml, 'utf8');
        p7.addCertificate(AFIP_CERT);
        p7.addSigner({
            key: forge.pki.privateKeyOf(forge.pki.privateKeyFromPem(AFIP_KEY)),
            certificate: forge.pki.certificateFromPem(AFIP_CERT),
            digestAlgorithm: forge.oids.sha256,
            authenticatedAttributes: [
                {
                    name: 'contentType',
                    type: forge.pki.oids.data,
                    value: forge.pki.oids.data
                },
                {
                    name: 'messageDigest',
                    type: forge.pki.oids.messageDigest
                },
                {
                    name: 'signingTime',
                    type: forge.pki.oids.signingTime,
                    value: new Date()
                }
            ]
        });
        
        p7.sign({ detached: false });
        const cms = forge.pkcs7.messageToPem(p7)
            .replace('-----BEGIN PKCS7-----', '')
            .replace('-----END PKCS7-----', '')
            .replace(/\s/g, '');

        console.log("📡 Conectando con WSAA Producción...");
        const client = await soap.createClientAsync(URL_WSAA_PROD);
        const [result] = await client.loginCmsAsync({ in0: cms });
        
        console.log("\n✅ ¡LO LOGRAMOS!");
        console.log("🎫 AFIP aceptó la firma. Token recibido con éxito.");
        console.log("Resumen del token:", result.loginCmsReturn.substring(0, 50) + "...");

    } catch (err) {
        console.error("\n❌ ERROR DE AFIP:");
        console.error("Mensaje:", err.message);
        if (err.root && err.root.Envelope) {
            console.error("Detalle del servidor:", JSON.stringify(err.root.Envelope.Body.Fault, null, 2));
        }
    }
}

run();

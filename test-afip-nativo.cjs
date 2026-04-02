require('dotenv').config({ path: '.env.local' });
const forge = require('node-forge');
const soap = require('soap');
const { parseStringPromise } = require('xml2js');

const AFIP_CUIT = process.env.VITE_AFIP_CUIT;
const AFIP_CERT = process.env.VITE_AFIP_CERT;
const AFIP_KEY = process.env.VITE_AFIP_KEY;

// URLs de los WebServices (Homo)
const URL_WSAA = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms?wsdl";

async function run() {
    console.log("🔄 Iniciando Conexion Nativa (SOAP Directa)...");
    
    try {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <loginTicketRequest version="1.0">
          <header>
            <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
            <generationTime>${new Date(Date.now() - 3600000).toISOString()}</generationTime>
            <expirationTime>${new Date(Date.now() + 3600000).toISOString()}</expirationTime>
          </header>
          <service>wsfe</service>
        </loginTicketRequest>`;

        // Esta vez vamos a firmar el CMS de forma MAS SIMPLE (AFIP aceptará!)
        const p7 = forge.pkcs7.createSignedData();
        p7.content = forge.util.createBuffer(xml, 'utf8');
        p7.addCertificate(AFIP_CERT);
        p7.addSigner({
            key: forge.pki.privateKeyFromPem(AFIP_KEY),
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
                    // Forge llenará este automáticamente al firmar
                },
                {
                    name: 'signingTime',
                    type: forge.pki.oids.signingTime,
                    value: new Date()
                }
            ]
        });
        
        // Firma y convierte a PEM (Base64)
        p7.sign({ detached: false });
        const cms = forge.pkcs7.messageToPem(p7)
            .replace('-----BEGIN PKCS7-----', '')
            .replace('-----END PKCS7-----', '')
            .replace(/\s/g, ''); // AFIP lo quiere sin encabezados ni espacios

        console.log("🔑 Pidiendo Token y Sign a la AFIP (WSAA)...");
        const client = await soap.createClientAsync(URL_WSAA);
        const [result] = await client.loginCmsAsync({ in0: cms });
        
        console.log("✅ ¡EXITO TOTAL! AFIP nos dio autorizacion.");
        console.log("🎫 Login Return:", result.loginCmsReturn.substring(0, 100) + "...");

    } catch (err) {
        console.error("❌ ERROR AFIP:", err.message || err);
        if (err.root && err.root.Envelope && err.root.Envelope.Body) {
             console.error("🔥 Detalle del Servidor:", JSON.stringify(err.root.Envelope.Body.Fault, null, 2));
        }
    }
}

run();

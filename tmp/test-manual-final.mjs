import dotenv from 'dotenv';
import forge from 'node-forge';
import soap from 'soap';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const AFIP_CERT = fs.readFileSync('3D2Store_1b73c1ea40df162.crt', 'utf8');
const AFIP_KEY = fs.readFileSync('privada.key', 'utf8');

const URL_WSAA_PROD = "https://wsaa.afip.gov.ar/ws/services/LoginCms?wsdl";

async function run() {
    console.log("🚀 Iniciando Conector Nativo Simplificado...");
    
    try {
        const now = new Date();
        const genTime = new Date(now.getTime() - 300000).toISOString().split('.')[0] + '-03:00';
        const expTime = new Date(now.getTime() + 300000).toISOString().split('.')[0] + '-03:00';
        
        const xml = `<loginTicketRequest version="1.0"><header><uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId><generationTime>${genTime}</generationTime><expirationTime>${expTime}</expirationTime></header><service>wsfe</service></loginTicketRequest>`;

        console.log("📝 Firmando con Forge...");
        const p7 = forge.pkcs7.createSignedData();
        p7.content = forge.util.createBuffer(xml, 'utf8');
        p7.addCertificate(AFIP_CERT);
        
        const privateKey = forge.pki.privateKeyFromPem(AFIP_KEY);
        const certificate = forge.pki.certificateFromPem(AFIP_CERT);

        p7.addSigner({
            key: privateKey,
            certificate: certificate,
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
            .replace(/-----(BEGIN|END) PKCS7-----/g, '')
            .replace(/\s/g, '');

        console.log("📡 Enviando a AFIP...");
        const client = await soap.createClientAsync(URL_WSAA_PROD);
        const [result] = await client.loginCmsAsync({ in0: cms });
        
        console.log("\n✅ ¡POR FIN!");
        console.log("🎫 LoginCmsReturn:", result.loginCmsReturn.substring(0, 50));

    } catch (err) {
        console.error("\n❌ ERROR:");
        console.error(err.message || err);
        if (err.root) console.error("Detalle:", JSON.stringify(err.root, null, 2));
    }
}

run();

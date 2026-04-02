const forge = require('node-forge');
const axios = require('axios');

export default async function handler(req, res) {
  try {
    const certRaw = process.env.AFIP_CERTIFICATE || '';
    const keyRaw = process.env.AFIP_PRIVATE_KEY || '';

    if (!certRaw || !keyRaw) {
      return res.status(200).json({ online: false, message: 'CRÍTICO: No detecto tus variables de entorno en Vercel.' });
    }

    // 1. Limpieza Robusta (Single Line to Multi Line)
    const formatPEM = (raw, type) => {
      let cleaned = raw.trim().replace(/\\n/g, '\n');
      if (!cleaned.includes('-----BEGIN')) {
        const header = `-----BEGIN ${type}-----`;
        const footer = `-----END ${type}-----`;
        cleaned = `${header}\n${cleaned}\n${footer}`;
      }
      return cleaned;
    };

    const cert = formatPEM(certRaw, 'CERTIFICATE');
    const key = formatPEM(keyRaw, 'RSA PRIVATE KEY');

    // 2. Diagnóstico de FIRMA (Vercel Test)
    let cms;
    try {
      const tra = `<?xml version="1.0" encoding="UTF-8"?>
      <loginTicketRequest version="1.0">
        <header>
          <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
          <generationTime>${new Date().toISOString()}</generationTime>
          <expirationTime>${new Date(Date.now() + 600000).toISOString()}</expirationTime>
        </header>
        <service>wsfe</service>
      </loginTicketRequest>`;

      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(tra, 'utf8');
      p7.addCertificate(cert);
      p7.addSigner({
        key: forge.pki.privateKeyFromPem(key),
        certificate: forge.pki.certificateFromPem(cert),
        digestAlgorithm: forge.oids.sha256,
        authenticatedAttributes: [
          { type: forge.oids.contentType, value: forge.oids.data },
          { type: forge.oids.messageDigest },
          { type: forge.oids.signingTime }
        ]
      });
      p7.sign();
      cms = forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
      console.log('--- 🛡️ DIAGNÓSTICO: FIRMA CMS EXITOSA ---');
    } catch (err) {
      return res.status(200).json({ 
        online: false, 
        message: 'ERROR DE CARGA: Vercel deforma tus secretos al leerlos.',
        detail: `Fallo en el servidor al intentar firmar: ${err.message}` 
      });
    }

    // 3. Consulta a AFIP (Preguntarle qué problema tiene)
    const soapMsg = `<?xml version="1.0" encoding="UTF-8"?>
    <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://wsaa.afip.gov.ar/ws/services/LoginCms">
      <SOAP-ENV:Body><ns1:loginCms><ns1:in0>${cms}</ns1:in0></ns1:loginCms></SOAP-ENV:Body>
    </SOAP-ENV:Envelope>`;

    try {
      const response = await axios.post('https://wsaa.afip.gov.ar/ws/services/LoginCms', soapMsg, {
        headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
        timeout: 10000
      });

      if (response.data.includes('token')) {
        return res.status(200).json({ 
          online: true, 
          message: '¡CONEXIÓN EXITOSA! AFIP Reconoció tus credenciales.' 
        });
      } else {
        // Extraer el error real de AFIP del XML
        const errorDetail = response.data.match(/<faultstring>(.*?)<\/faultstring>/)?.[1] || 'AFIP Rechazó tus llaves';
        return res.status(200).json({ 
          online: false, 
          message: 'AFIP RECHAZÓ EL PERMISO',
          detail: `Respuesta Real de AFIP: "${errorDetail}"`
        });
      }
    } catch (err) {
      if (err.response) {
         return res.status(200).json({ 
           online: false, 
           message: 'AFIP NO ESTA AUTORIZANDO TU CUIT',
           detail: `AFIP nos contestó un error de permiso: ${err.response.status}.`
         });
      }
      throw err;
    }

  } catch (err) {
    return res.status(200).json({ 
      online: false, 
      message: 'Mantenimiento en AFIP o Timeout',
      detail: err.message
    });
  }
}

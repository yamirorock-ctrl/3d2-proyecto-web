const forge = require('node-forge');
const axios = require('axios');

export default async function handler(req, res) {
  try {
    const certRaw = process.env.AFIP_CERTIFICATE || '';
    const keyRaw = process.env.AFIP_PRIVATE_KEY || '';

    if (!certRaw || !keyRaw) {
      return res.status(401).json({ online: false, message: 'Faltan credenciales PEM en Vercel Env Vars' });
    }

    // Formateo PEM Robusto (Asegurar que AFIP vea un bloque de texto)
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

    // 1. Generar CMS
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
      authenticatedAttributes: [{ type: forge.oids.contentType, value: forge.oids.data }, { type: forge.oids.messageDigest }, { type: forge.oids.signingTime }]
    });
    p7.sign();
    const cms = forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());

    // 2. Comunicar con AFIP WSAA
    const soapMsg = `<?xml version="1.0" encoding="UTF-8"?>
    <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://wsaa.afip.gov.ar/ws/services/LoginCms">
      <SOAP-ENV:Body><ns1:loginCms><ns1:in0>${cms}</ns1:in0></ns1:loginCms></SOAP-ENV:Body>
    </SOAP-ENV:Envelope>`;

    const response = await axios.post('https://wsaahomo.afip.gov.ar/ws/services/LoginCms', soapMsg, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 10000
    });

    if (response.data.includes('token')) {
      return res.status(200).json({ online: true, message: '¡Handshake Exitoso!' });
    } else {
      return res.status(403).json({ online: false, message: 'AFIP rechazó credenciales (Error 403)' });
    }

  } catch (err) {
    return res.status(500).json({ 
      online: false, 
      message: `Error de Conexión: ${err.message}`,
      hint: 'Revisá si cargaste el CERTIFICADO DE HOMOLOGACIÓN y no el de producción'
    });
  }
}

export default async function handler(req, res) {
  const cert = process.env.AFIP_CERTIFICATE || 'VACIO';
  const key = process.env.AFIP_PRIVATE_KEY || 'VACIO';
  const cuit = process.env.VITE_AFIP_CUIT || process.env.AFIP_CUIT || 'VACIO';

  res.status(200).json({
    diagnostico: {
      cert_status: cert === 'VACIO' ? '❌ No detectado' : '✅ Detectado (' + cert.substring(0, 30) + '...)',
      key_status: key === 'VACIO' ? '❌ No detectado' : '✅ Detectado (' + key.substring(0, 30) + '...)',
      cuit_status: cuit === 'VACIO' ? '❌ No detectado' : `✅ Detectado (${cuit})`,
      formato_cert: cert.includes('\\n') ? '✅ Blindado (Vercel-Safe)' : cert.includes('\n') ? '⚠️ Saltos reales' : '❓ Una sola línea sin escapes',
      longitud_key: key.length
    }
  });
}

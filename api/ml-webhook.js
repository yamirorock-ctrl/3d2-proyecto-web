// Vercel serverless function: Handle MercadoLibre notifications (orders, shipments)
export default async function handler(req, res) {
  try {
    const topic = req.query?.topic || req.query?.type; // ML sends topic param
    const resource = req.query?.resource;

    // ML sends a GET ping first; respond 200 quickly
    if (req.method === 'GET') {
      res.status(200).json({ ok: true, received: { topic, resource } });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    // TODO: verify signatures if provided, then fetch resource details via ML API using stored tokens
    console.log('[ML webhook] topic=', topic, 'resource=', resource, 'body.keys=', Object.keys(body || {}));

    // Acknowledge
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

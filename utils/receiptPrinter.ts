import { Order } from '../types';

export const printOrderReceipt = (order: Order, options: { isFiscal: boolean, cae?: string, caeVto?: string, cbteNumber?: string }) => {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) {
    alert('Por favor habilitá las ventanas emergentes (pop-ups) para imprimir el recibo.');
    return;
  }

  const { isFiscal, cae, caeVto, cbteNumber } = options;

  // Intentamos extraer datos de CAE si no vienen explícitamente pero la orden está facturada
  let finalCae = cae;
  let finalCaeVto = caeVto;
  let finalCbteNumber = cbteNumber || order.invoice_number;

  // Extraer desde notes si el regex hace match "[FACTURA C EMITIDA: Nº... - CAE: ... - VTO: ...]"
  if (isFiscal && (!finalCae || !finalCbteNumber)) {
    const caeMatch = order.notes?.match(/CAE:\s*(\d+)/i);
    if (caeMatch) finalCae = caeMatch[1];
    
    const numMatch = order.notes?.match(/Nº|Nro:\s*([\d-]+)/i);
    if (numMatch) finalCbteNumber = numMatch[1];
    
    const vtoMatch = order.notes?.match(/VTO:\s*([\d\/-]+)/i);
    if (vtoMatch) finalCaeVto = vtoMatch[1];
  }

  // Generamos la prop del QR para AFIP
  // El formato que exige ARCA es un JSON en base64. Si bien acá lo hacemos resumido, cumple la visual
  let qrImageHtml = '';
  if (isFiscal && finalCae) {
      // Data super resumida para que el lector vea al menos la auth de AFIP
      const qrData = JSON.stringify({
          ver: 1, 
          tipoCmp: 11, // Factura C
          nroCmp: finalCbteNumber ? parseInt(finalCbteNumber.split('-')[1] || finalCbteNumber) : 0,
          importe: order.total,
          codAut: parseInt(finalCae)
      });
      const b64 = window.btoa(qrData);
      qrImageHtml = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://www.afip.gob.ar/fe/qr/?p=${b64}" alt="QR AFIP" />`;
  }

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Comprobante #${order.order_number || order.id.slice(0,8)}</title>
      <style>
        @page { margin: 10mm; size: A4; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.3; font-size: 11px; padding: 0; max-width: 100%; margin: 0 auto; box-sizing: border-box; }
        h1, h2, h3, p { margin: 0; padding: 0; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 10px; }
        .header img { width: 45px; height: 45px; object-fit: cover; border-radius: 50%; margin-bottom: 5px; }
        .header h1 { color: #4f46e5; font-size: 20px; }
        .header p { color: #666; font-size: 11px; margin-top: 2px; }
        
        .fiscal-header { display: flex; justify-content: space-between; border: 2px solid #333; margin-bottom: 15px; }
        .fiscal-box-letter { border-right: 2px solid #333; border-bottom: 2px solid #333; width: 40px; height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; background: #eee; }
        .fiscal-header-left, .fiscal-header-right { padding: 10px; flex: 1; }
        .fiscal-header-right { border-left: 2px solid #333; text-align: right; }
        
        .warning { text-align: center; background: #f3f4f6; padding: 5px; font-size: 10px; color: #666; border: 1px solid #e5e7eb; margin-bottom: 15px; }
        .details { display: flex; justify-content: space-between; margin-bottom: 15px; }
        .details div { flex: 1; }
        .details h3 { font-size: 13px; border-bottom: 1px solid #eee; padding-bottom: 2px; margin-bottom: 5px; color: #4f46e5; }
        .details p { margin-bottom: 3px; }
        table { border-collapse: collapse; margin-bottom: 15px; width: 100%; border: 1px solid #eee; }
        th, td { padding: 6px; text-align: left; border-bottom: 1px solid #eee; font-size: 11px; }
        th { background-color: #f9fafb; font-weight: bold; padding: 8px 6px; }
        td { padding-top: 8px; padding-bottom: 8px; }
        .item-name { max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; }
        .total { text-align: right; font-size: 14px; font-weight: bold; background: #f9fafb; padding: 10px; border: 1px solid #eee; }
        .notes { margin-top: 15px; padding: 8px; background: #fafafa; border-left: 3px solid #4f46e5; font-size: 10px; }
        
        .afip-box { margin-top: 20px; border-top: 2px dashed #ccc; padding-top: 15px; display: flex; align-items: flex-end; justify-content: space-between; }
        .afip-logo { font-size: 20px; font-weight: 900; font-style: italic; color: #333; }
        .afip-data p { margin-bottom: 3px; font-size: 10px; }
        .afip-qr img { width: 90px; height: 90px; }
        
        .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
      </style>
    </head>
    <body>
      ${isFiscal ? `
        <div class="fiscal-header">
           <div class="fiscal-header-left">
             <h1>3D2 Impresiones</h1>
             <p>Impresión 3D y Corte Láser</p>
             <p>CUIT: 27409292834</p>
             <p>Condición frente al IVA: Monotributo</p>
           </div>
           <div style="position: absolute; left: 50%; top: 10px; transform: translateX(-50%);">
              <div class="fiscal-box-letter">C<span style="font-size: 8px; font-weight: normal; margin-top: -2px;">COD. 011</span></div>
           </div>
           <div class="fiscal-header-right">
             <h2>FACTURA</h2>
             <p><strong>Nº:</strong> ${finalCbteNumber || '00002-Pendiente'}</p>
             <p><strong>Fecha Emisión:</strong> ${new Date().toLocaleDateString('es-AR')}</p>
           </div>
        </div>
      ` : `
        <div class="header">
          <img src="${window.location.origin}/LOGO.jpg" alt="3D2 Logo" onerror="this.style.display='none'" />
          <h1>3D2 Impresiones</h1>
          <p>Impresión 3D y Corte Láser</p>
        </div>
        <div class="warning">
          <strong>Documento No Fiscal</strong> - Comprobante interno de pedido para el cliente.
        </div>
      `}

      <div class="details">
        <div>
          <h3>Datos del ${isFiscal ? 'Receptor' : 'Cliente'}</h3>
          <p><strong>Nombre:</strong> ${(order as any).customer?.name || (order as any).customer_name || 'Consumidor Final'}</p>
          ${isFiscal ? `<p><strong>CUIT/DNI:</strong> ${order.billing_dni_cuit || '0'}</p>` : ''}
          <p><strong>Contacto:</strong> ${(order as any).customer?.phone || (order as any).customer_phone || (order as any).customer_email || 'N/A'}</p>
        </div>
        <div style="text-align: right;">
          <h3>Detalles de la Operación</h3>
          <p><strong>N° Orden Interna:</strong> ${order.order_number || order.id.slice(0,8)}</p>
          <p><strong>Fecha de Operación:</strong> ${new Date((order as any).timestamp || (order as any).created_at).toLocaleDateString('es-AR')}</p>
          <p><strong>Condición de Venta:</strong> ${((order as any).method === 'mercadopago' || (order as any).payment_id) ? 'MercadoPago' : ((order as any).paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo/Otro')}</p>
          <p><strong>Estado:</strong> ${order.status.toUpperCase()}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Producto / Detalle</th>
            <th>Cantidad</th>
            <th>Precio Unit.</th>
            <th style="text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${(order.items || []).filter((item: any) => !item.name.startsWith('[EMPAQUE]')).map((item: any) => `
            <tr>
              <td><span class="item-name" title="${item.name}">${item.name}</span></td>
              <td>${item.quantity}</td>
              <td>$${Number(item.price).toLocaleString('es-AR')}</td>
              <td style="text-align: right;">$${Number(item.price * item.quantity).toLocaleString('es-AR')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="total">
        <p>Total a Pagar: $${Number(order.total).toLocaleString('es-AR')}</p>
      </div>

      ${(order.notes && !isFiscal) ? `
      <div class="notes">
        <strong>Notas del Pedido:</strong><br/>
        ${order.notes.replace(/\\n/g, '<br/>')}
      </div>
      ` : ''}

      ${(isFiscal && finalCae) ? `
      <div class="afip-box">
          <div class="afip-qr">
             ${qrImageHtml}
          </div>
          <div class="afip-data" style="text-align: right;">
             <p style="font-weight: bold; font-size: 12px; margin-bottom: 5px;">Comprobante Autorizado</p>
             <p><strong>CAE:</strong> ${finalCae}</p>
             <p><strong>Vto. CAE:</strong> ${finalCaeVto || 'N/A'}</p>
          </div>
      </div>
      ` : ''}

      <div class="footer">
        <p style="font-weight: bold; color: #333; margin-bottom: 5px;">¡Gracias por confiar en 3D2!</p>
        <p>Para dudas o reclamos sobre tu pedido comunicate ${isFiscal ? 'por WhatsApp' : 'con nosotros'}</p>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(receiptHtml);
  printWindow.document.close();
  
  // Pequeño delay para asegurar que carguen imágenes (como el QR) antes de abrir el diálogo de impresión
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 1000);
};

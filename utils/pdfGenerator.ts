import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const loadLogo = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return '';
  }
};

export const generateAFIPInvoiceBase64 = async (order: any, cae: string, nro: string, vto: string): Promise<string> => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const marginX = 15;
  const contentWidth = 180;
  let cursorY = 20;

  // Cargar Logo (se asume que la URL raiz tiene el logo)
  const logoBase64 = await loadLogo(window.location.origin + '/LOGO.jpg');
  
  if (logoBase64) {
    // Dibujar el logo centrado (aprox 20x20 mm)
    doc.addImage(logoBase64, 'JPEG', 95, cursorY, 20, 20);
    cursorY += 28;
  }

  // Título Principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(79, 70, 229); // #4f46e5 (Azul/Índigo)
  doc.text('3D2 Impresiones', 105, cursorY, { align: 'center' });
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  cursorY += 6;
  doc.text('Impresión 3D y Corte Láser', 105, cursorY, { align: 'center' });
  
  cursorY += 5;
  doc.setFontSize(9);
  doc.text('CUIT: 20332866266 | Condición: Monotributo', 105, cursorY, { align: 'center' });
  
  cursorY += 8;
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.5);
  doc.line(marginX, cursorY, marginX + contentWidth, cursorY);
  
  // Banner gris
  cursorY += 2;
  doc.setFillColor(245, 245, 245);
  doc.rect(marginX, cursorY, contentWidth, 8, 'F');
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text('Factura Electrónica (C) - Comprobante de Venta', 105, cursorY + 5.5, { align: 'center' });
  
  // Headers Azules
  cursorY += 15;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(12);
  doc.text('Datos del Cliente', marginX, cursorY);
  doc.text('Detalles del Pedido', marginX + contentWidth, cursorY, { align: 'right' });
  
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  cursorY += 2;
  doc.line(marginX, cursorY, marginX + contentWidth, cursorY);
  
  // Datos
  cursorY += 6;
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Nombre:', marginX, cursorY);
  doc.setFont('helvetica', 'normal');
  doc.text(order.customer_name || 'Consumidor Final', marginX + 16, cursorY);
  
  doc.setFont('helvetica', 'bold');
  doc.text('N° de Comprobante:', marginX + 100, cursorY);
  doc.setFont('helvetica', 'normal');
  doc.text(String(nro), marginX + 180, cursorY, { align: 'right' });
  
  cursorY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('CUIT/DNI:', marginX, cursorY);
  doc.setFont('helvetica', 'normal');
  // Extraer DNI del cliente si está en `notes` (ej: [DNI/CUIT: 31930845])
  let clientDoc = order.customer_dni || order.billing_dni_cuit || 'Consumidor Final';
  if (!clientDoc || clientDoc === 'Consumidor Final') {
    const dniMatch = order.notes?.match(/DNI\/CUIT:\s*([\d]+)/i);
    if (dniMatch) {
      clientDoc = dniMatch[1];
    }
  }

  doc.text(String(clientDoc), marginX + 22, cursorY);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', marginX + 100, cursorY);
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(order.created_at || new Date()), 'dd/MM/yyyy'), marginX + 180, cursorY, { align: 'right' });

  cursorY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Contacto:', marginX, cursorY);
  doc.setFont('helvetica', 'normal');
  doc.text(order.customer_email || order.customer_phone || 'N/A', marginX + 18, cursorY);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Estado:', marginX + 100, cursorY);
  doc.setFont('helvetica', 'normal');
  doc.text('PAGADO', marginX + 180, cursorY, { align: 'right' });

  // Tabla
  cursorY += 15;
  doc.setFillColor(249, 250, 251);
  doc.rect(marginX, cursorY, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text('Producto', marginX + 2, cursorY + 5.5);
  doc.text('Cantidad', marginX + 90, cursorY + 5.5);
  doc.text('Precio Unit.', marginX + 130, cursorY + 5.5);
  doc.text('Subtotal', marginX + 178, cursorY + 5.5, { align: 'right' });
  
  cursorY += 8;
  doc.setLineWidth(0.2);
  doc.setFont('helvetica', 'normal');
  
  if (order.items && order.items.length > 0) {
    const validItems = order.items.filter((item: any) => !item.name?.startsWith?.('[EMPAQUE]'));
    validItems.forEach((item: any) => {
       cursorY += 6;
       doc.text(String(item.title || item.name || item.product_id).substring(0, 45), marginX + 2, cursorY);
       doc.text(String(item.quantity), marginX + 95, cursorY);
       doc.text(`$${Number(item.price).toLocaleString('es-AR')}`, marginX + 130, cursorY);
       doc.text(`$${(Number(item.price) * Number(item.quantity)).toLocaleString('es-AR')}`, marginX + 178, cursorY, { align: 'right' });
       
       cursorY += 4;
       doc.setDrawColor(240, 240, 240);
       doc.line(marginX, cursorY, marginX + contentWidth, cursorY);
    });
  } else {
    cursorY += 6;
    doc.text('Productos 3D2', marginX + 2, cursorY);
    doc.text('1', marginX + 95, cursorY);
    doc.text(`$${Number(order.total).toLocaleString('es-AR')}`, marginX + 130, cursorY);
    doc.text(`$${Number(order.total).toLocaleString('es-AR')}`, marginX + 178, cursorY, { align: 'right' });
    cursorY += 4;
    doc.setDrawColor(240, 240, 240);
    doc.line(marginX, cursorY, marginX + contentWidth, cursorY);
  }

  // Costo de envio (si existe)
  if (order.shipping_cost && Number(order.shipping_cost) > 0) {
    cursorY += 6;
    doc.text('Costo de Envío', marginX + 2, cursorY);
    doc.text('1', marginX + 95, cursorY);
    doc.text(`$${Number(order.shipping_cost).toLocaleString('es-AR')}`, marginX + 130, cursorY);
    doc.text(`$${Number(order.shipping_cost).toLocaleString('es-AR')}`, marginX + 178, cursorY, { align: 'right' });
    cursorY += 4;
    doc.line(marginX, cursorY, marginX + contentWidth, cursorY);
  }

  // Totales
  cursorY += 10;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(230, 230, 230);
  doc.rect(marginX, cursorY, contentWidth, 12, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total a Pagar:', marginX + 130, cursorY + 8);
  doc.text(`$${Number(order.total).toLocaleString('es-AR')}`, marginX + 178, cursorY + 8, { align: 'right' });
  
  // Notas
  if (order.notes) {
    cursorY += 20;
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(1);
    doc.line(marginX, cursorY, marginX, cursorY + 15);
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'bold');
    doc.text('Notas del Pedido:', marginX + 4, cursorY + 4);
    doc.setFont('helvetica', 'normal');
    
    // Split notes to avoid overflow
    const splitNotes = doc.splitTextToSize(order.notes, contentWidth - 10);
    doc.text(splitNotes, marginX + 4, cursorY + 9);
    cursorY += splitNotes.length * 4;
  }
  
  // Modulo AFIP
  cursorY = Math.max(cursorY + 30, 220); // Empujar al fondo 
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(marginX, cursorY, marginX + contentWidth, cursorY);
  doc.setLineDashPattern([], 0);
  
  cursorY += 15;
  
  // Generar QR
  const afipJson = {
      ver: 1,
      fecha: format(new Date(), 'yyyy-MM-dd'),
      cuit: 20332866266,
      ptoVta: 2,
      tipoCmp: 11, // Factura C
      nroCmp: Number(nro),
      importe: Number(order.total),
      moneda: "PES",
      ctz: 1,
      tipoDocRec: clientDoc !== 'Consumidor Final' ? 96 : 99,
      nroDocRec: clientDoc !== 'Consumidor Final' ? Number(clientDoc) : 0,
      tipoCodAut: "E", 
      codAut: Number(cae)
  };

  const qrDataUrl = `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify(afipJson))}`;
  
  try {
      const qrImage = await QRCode.toDataURL(qrDataUrl, { margin: 0, width: 90 });
      doc.addImage(qrImage, 'PNG', marginX, cursorY - 10, 30, 30);
  } catch(e) {
      console.error(e);
  }

  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.text('Comprobante Autorizado', marginX + 178, cursorY, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.text(`CAE: ${cae}`, marginX + 178, cursorY + 6, { align: 'right' });
  doc.text(`Vto. CAE: ${vto}`, marginX + 178, cursorY + 12, { align: 'right' });
  
  // Return base64
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
};

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const generateAFIPInvoiceBase64 = async (order: any, cae: string, nro: string, vto: string): Promise<string> => {
  // Crear documento PDF
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Constantes
  const marginX = 15;
  let cursorY = 20;

  // Header / Logo area
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA', 105, cursorY, { align: 'center' });
  
  doc.rect(98, cursorY - 12, 14, 14, 'S');
  doc.setFontSize(28);
  doc.text('C', 105, cursorY - 2, { align: 'center' });

  // Datos Comerciales
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  cursorY += 15;
  doc.text('Creart 3D2', marginX, cursorY);
  doc.text(`Nro de Comprobante: 0002-${nro.padStart(8, '0')}`, 120, cursorY);
  cursorY += 6;
  doc.text('Impresión 3D y Corte Láser', marginX, cursorY);
  doc.text(`Fecha de Emisión: ${format(new Date(order.created_at || new Date()), 'dd/MM/yyyy')}`, 120, cursorY);
  cursorY += 6;
  doc.text('CUIT: 20319308451', marginX, cursorY);
  cursorY += 6;
  doc.text('Condición frente al IVA: Responsable Monotributo', marginX, cursorY);
  
  // Separator
  cursorY += 10;
  doc.setLineWidth(0.5);
  doc.line(marginX, cursorY, 195, cursorY);
  
  // Datos Cliente
  cursorY += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Datos del Cliente:', marginX, cursorY);
  doc.setFont('helvetica', 'normal');
  cursorY += 6;
  doc.text(`Nombre/Razón Social: ${order.customer_name || 'Consumidor Final'}`, marginX, cursorY);
  cursorY += 6;
  doc.text(`DNI/CUIT: ${order.customer_dni || 'No especificado'}`, marginX, cursorY);
  
  // Separator
  cursorY += 10;
  doc.line(marginX, cursorY, 195, cursorY);

  // Table Header
  cursorY += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Descripción', marginX, cursorY);
  doc.text('Cant.', 110, cursorY, { align: 'center' });
  doc.text('P. Unit', 140, cursorY, { align: 'right' });
  doc.text('Subtotal', 195, cursorY, { align: 'right' });
  
  doc.setLineWidth(0.2);
  cursorY += 3;
  doc.line(marginX, cursorY, 195, cursorY);
  
  // Table Body (Items or generic concept if manual)
  doc.setFont('helvetica', 'normal');
  cursorY += 8;
  if (order.items && order.items.length > 0) {
    order.items.forEach((item: any) => {
       doc.text(String(item.title || item.product_id).substring(0, 40), marginX, cursorY);
       doc.text(String(item.quantity), 110, cursorY, { align: 'center' });
       doc.text(`$${item.price}`, 140, cursorY, { align: 'right' });
       doc.text(`$${Number(item.price) * Number(item.quantity)}`, 195, cursorY, { align: 'right' });
       cursorY += 8;
    });
  } else {
    // Venta Manual Genérica
    doc.text('Productos Personalizados 3D2', marginX, cursorY);
    doc.text('1', 110, cursorY, { align: 'center' });
    doc.text(`$${order.total}`, 140, cursorY, { align: 'right' });
    doc.text(`$${order.total}`, 195, cursorY, { align: 'right' });
    cursorY += 8;
  }

  // Tarifa Envio
  if (order.shipping_cost && Number(order.shipping_cost) > 0) {
    doc.text('Costo de Envío', marginX, cursorY);
    doc.text('1', 110, cursorY, { align: 'center' });
    doc.text(`$${order.shipping_cost}`, 140, cursorY, { align: 'right' });
    doc.text(`$${order.shipping_cost}`, 195, cursorY, { align: 'right' });
    cursorY += 8;
  }

  // Footer Totales
  doc.line(marginX, cursorY, 195, cursorY);
  cursorY += 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Importe Total:', 140, cursorY);
  doc.text(`$${order.total}`, 195, cursorY, { align: 'right' });
  
  // AFIP QR y CAE
  cursorY += 20;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Comprobante Autorizado por AFIP', marginX, cursorY);
  
  doc.setFont('helvetica', 'normal');
  cursorY += 6;
  doc.text(`CAE: ${cae}`, marginX, cursorY);
  cursorY += 6;
  doc.text(`Fecha Vto. CAE: ${vto}`, marginX, cursorY);

  // Generar QR de AFIP
  const afipJson = {
      ver: 1,
      fecha: format(new Date(), 'yyyy-MM-dd'),
      cuit: 20319308451,
      ptoVta: 2,
      tipoCmp: 11, // Factura C es 11
      nroCmp: Number(nro),
      importe: Number(order.total),
      moneda: "PES",
      ctz: 1,
      tipoDocRec: order.customer_dni ? 96 : 99,
      nroDocRec: order.customer_dni || 0,
      tipoCodAut: "E", // CAE
      codAut: Number(cae)
  };

  const qrDataUrl = `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify(afipJson))}`;
  
  try {
      const qrImage = await QRCode.toDataURL(qrDataUrl, { margin: 1, width: 100 });
      doc.addImage(qrImage, 'PNG', 140, cursorY - 20, 35, 35);
  } catch(e) {
      console.error("Error generating QR", e);
  }

  // Return base64 string WITHOUT data:application/pdf;base64,
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
};

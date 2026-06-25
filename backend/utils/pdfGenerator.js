const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const CompanySettingsService = require('../services/CompanySettingsService');
const { convertNumberToWords } = require('./numberToWords');

async function generateBarcodeBuffer(text) {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer({
      bcid: 'code128',
      text: text,
      scale: 2,
      height: 10,
      includetext: true,
      textxalign: 'center',
    }, function (err, png) {
      if (err) reject(err);
      else resolve(png);
    });
  });
}

async function generateInvoicePDF(invoice, stream) {
  const companySettings = await CompanySettingsService.getSettings();
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(stream);

  // Formats date helper
  const formatDate = (d) => {
    if (!d) return 'N/A';
    const date = new Date(d);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()}-${months[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
  };

  // Determine GST Taxes Type
  const companyState = (companySettings.stateName || '').toLowerCase().trim();
  const buyerState = (invoice.buyerState || invoice.customer?.state || '').toLowerCase().trim();
  
  // gstType choice: CGST, IGST, Total GST
  const gstType = invoice.gstType || (companyState === buyerState ? 'CGST' : 'IGST');
  const isCGST = gstType === 'CGST';
  const isIGST = gstType === 'IGST';

  // Generate and draw Barcode at top right (outside grid, y=18)
  try {
    const barcodeBuffer = await generateBarcodeBuffer(invoice.invoiceNumber);
    doc.image(barcodeBuffer, 430, 15, { width: 120, height: 22 });
  } catch (error) {
    console.error('Error drawing barcode on PDF:', error);
  }

  // Draw main heading text
  doc.font('Helvetica-Bold').fontSize(11).text('Tax Invoice', 270, 25);

  // Main Outer Box coordinates
  const startX = 40;
  const startY = 40;
  const width = 515;
  const height = 750;

  // 1. Draw Outer Border
  doc.lineWidth(0.8).rect(startX, startY, width, height).strokeColor('#000000').stroke();

  // Draw vertical split line between left (Billing/Company info) and right (Logistics details)
  doc.moveTo(290, startY).lineTo(290, startY + 250).stroke();

  // --- SELLER COMPANY BOX ---
  // Coordinates: x: 40-290, y: 40-120
  doc.font('Helvetica-Bold').fontSize(9).text(companySettings.companyName, startX + 5, startY + 5);
  doc.font('Helvetica').fontSize(7.5);
  doc.text(companySettings.address, startX + 5, startY + 18, { width: 240 });
  doc.text(`GSTIN/UIN: ${companySettings.gstin}`, startX + 5, startY + 48);
  doc.text(`State Name: ${companySettings.stateName}, Code: ${companySettings.stateCode}`, startX + 5, startY + 60);

  // Line separating Seller Box from Consignee Box
  doc.moveTo(startX, startY + 75).lineTo(290, startY + 75).stroke();

  // --- CONSIGNEE BOX ---
  // Coordinates: x: 40-290, y: 115-185
  const consigneeY = startY + 75;
  doc.font('Helvetica-Bold').fontSize(7.5).text('Consignee (Ship to)', startX + 5, consigneeY + 4);
  
  const consigneeNameVal = invoice.consigneeName || invoice.customer?.customerName || '';
  const consigneeAddrVal = invoice.consigneeAddress || (invoice.customer ? `${invoice.customer.address || ''}, ${invoice.customer.city || ''}` : '');
  const consigneeGstinVal = invoice.consigneeGSTIN || invoice.customer?.gstNumber || 'N/A';
  const consigneeStateVal = invoice.consigneeState || invoice.customer?.state || 'N/A';
  const consigneeStateCodeVal = invoice.consigneeStateCode || (invoice.consigneeGSTIN ? invoice.consigneeGSTIN.slice(0, 2) : '') || (invoice.customer?.gstNumber ? invoice.customer.gstNumber.slice(0, 2) : '') || 'N/A';

  if (consigneeNameVal) {
    doc.font('Helvetica-Bold').text(consigneeNameVal, startX + 5, consigneeY + 15);
    doc.font('Helvetica');
    doc.text(consigneeAddrVal, startX + 5, consigneeY + 25, { width: 240 });
    doc.text(`GSTIN/UIN: ${consigneeGstinVal}`, startX + 5, consigneeY + 48);
    doc.text(`State Name: ${consigneeStateVal}, Code: ${consigneeStateCodeVal}`, startX + 5, consigneeY + 58);
  }

  // Line separating Consignee Box from Buyer Box
  doc.moveTo(startX, consigneeY + 70).lineTo(290, consigneeY + 70).stroke();

  // --- BUYER BOX ---
  // Coordinates: x: 40-290, y: 185-255
  const buyerY = consigneeY + 70;
  doc.font('Helvetica-Bold').fontSize(7.5).text('Buyer (Bill to)', startX + 5, buyerY + 4);

  const buyerNameVal = invoice.buyerName || invoice.customer?.customerName || '';
  const buyerAddrVal = invoice.buyerAddress || (invoice.customer ? `${invoice.customer.address || ''}, ${invoice.customer.city || ''}` : '');
  const buyerGstinVal = invoice.buyerGSTIN || invoice.customer?.gstNumber || 'N/A';
  const buyerStateVal = invoice.buyerState || invoice.customer?.state || 'N/A';
  const buyerStateCodeVal = invoice.buyerStateCode || (invoice.buyerGSTIN ? invoice.buyerGSTIN.slice(0, 2) : '') || (invoice.customer?.gstNumber ? invoice.customer.gstNumber.slice(0, 2) : '') || 'N/A';

  if (buyerNameVal) {
    doc.font('Helvetica-Bold').text(buyerNameVal, startX + 5, buyerY + 15);
    doc.font('Helvetica');
    doc.text(buyerAddrVal, startX + 5, buyerY + 25, { width: 240 });
    doc.text(`GSTIN/UIN: ${buyerGstinVal}`, startX + 5, buyerY + 48);
    doc.text(`State Name: ${buyerStateVal}, Code: ${buyerStateCodeVal}`, startX + 5, buyerY + 58);
  }

  // --- LOGISTICS TABLE (RIGHT BOX) ---
  // Horizontal lines split right side into 8 rows
  const rightX = 290;
  const colWidth = 265;
  const colHalf = 132.5;

  const rowsY = [
    startY,               // 40
    startY + 25,          // 65
    startY + 50,          // 90
    startY + 75,          // 115
    startY + 100,         // 140
    startY + 125,         // 165
    startY + 150,         // 190
    startY + 180,         // 220
    startY + 210          // 250
  ];

  // Draw horizontal splits
  for (let i = 1; i < rowsY.length; i++) {
    doc.moveTo(rightX, rowsY[i]).lineTo(startX + width, rowsY[i]).stroke();
  }

  // Draw vertical split for right side cells (half width)
  for (let i = 0; i < 7; i++) {
    doc.moveTo(rightX + colHalf, rowsY[i]).lineTo(rightX + colHalf, rowsY[i + 1]).stroke();
  }

  doc.font('Helvetica').fontSize(6.5);

  // Row 1: Invoice No & Dated
  doc.text('Invoice No.', rightX + 5, rowsY[0] + 3).font('Helvetica-Bold').fontSize(8.5).text(invoice.invoiceNumber, rightX + 5, rowsY[0] + 12);
  doc.font('Helvetica').fontSize(6.5).text('Dated', rightX + colHalf + 5, rowsY[0] + 3).font('Helvetica-Bold').fontSize(8).text(formatDate(invoice.invoiceDate), rightX + colHalf + 5, rowsY[0] + 12);

  // Row 2: Delivery Note & Payment Mode
  doc.font('Helvetica').fontSize(6.5).text('Delivery Note', rightX + 5, rowsY[1] + 3).font('Helvetica-Bold').fontSize(7.5).text(invoice.dispatchNumber || 'N/A', rightX + 5, rowsY[1] + 12);
  doc.font('Helvetica').fontSize(6.5).text('Mode/Terms of Payment', rightX + colHalf + 5, rowsY[1] + 3).font('Helvetica-Bold').fontSize(7.5).text(invoice.termsOfDelivery || 'N/A', rightX + colHalf + 5, rowsY[1] + 12);

  // Row 3: Reference No. & Date & Other References
  doc.font('Helvetica').fontSize(6.5).text('Reference No. & Date', rightX + 5, rowsY[2] + 3).font('Helvetica-Bold').fontSize(7.5).text(invoice.referenceNumber || 'N/A', rightX + 5, rowsY[2] + 12);
  doc.font('Helvetica').fontSize(6.5).text('Other References', rightX + colHalf + 5, rowsY[2] + 3).font('Helvetica-Bold').fontSize(7.5).text('N/A', rightX + colHalf + 5, rowsY[2] + 12);

  // Row 4: Buyer's Order No & Dated
  doc.font('Helvetica').fontSize(6.5).text("Buyer's Order No.", rightX + 5, rowsY[3] + 3).font('Helvetica-Bold').fontSize(7.5).text(invoice.buyerOrderNumber || 'N/A', rightX + 5, rowsY[3] + 12);
  doc.font('Helvetica').fontSize(6.5).text('Dated', rightX + colHalf + 5, rowsY[3] + 3).font('Helvetica-Bold').fontSize(7.5).text(formatDate(invoice.invoiceDate), rightX + colHalf + 5, rowsY[3] + 12);

  // Row 5: Dispatch Doc No & Delivery Date
  doc.font('Helvetica').fontSize(6.5).text('Dispatch Doc No.', rightX + 5, rowsY[4] + 3).font('Helvetica-Bold').fontSize(7.5).text(invoice.dispatchNumber || 'N/A', rightX + 5, rowsY[4] + 12);
  doc.font('Helvetica').fontSize(6.5).text('Delivery Note Date', rightX + colHalf + 5, rowsY[4] + 3).font('Helvetica-Bold').fontSize(7.5).text(formatDate(invoice.invoiceDate), rightX + colHalf + 5, rowsY[4] + 12);

  // Row 6: Dispatched through & Destination
  doc.font('Helvetica').fontSize(6.5).text('Dispatched through', rightX + 5, rowsY[5] + 3).font('Helvetica-Bold').fontSize(7.5).text(invoice.dispatchThrough || 'By Road', rightX + 5, rowsY[5] + 12);
  doc.font('Helvetica').fontSize(6.5).text('Destination', rightX + colHalf + 5, rowsY[5] + 3).font('Helvetica-Bold').fontSize(7.5).text(invoice.destination || 'N/A', rightX + colHalf + 5, rowsY[5] + 12);

  // Row 7: Bill of Lading / Motor Vehicle No
  doc.font('Helvetica').fontSize(6.5).text('Bill of Lading/LR-RR No.', rightX + 5, rowsY[6] + 3).font('Helvetica-Bold').fontSize(7.5).text(invoice.referenceNumber || 'N/A', rightX + 5, rowsY[6] + 12);
  doc.font('Helvetica').fontSize(6.5).text('Motor Vehicle No.', rightX + colHalf + 5, rowsY[6] + 3).font('Helvetica-Bold').fontSize(7.5).text(invoice.vehicleNumber || 'N/A', rightX + colHalf + 5, rowsY[6] + 12);

  // Row 8: Terms of Delivery
  doc.font('Helvetica').fontSize(6.5).text('Terms of Delivery', rightX + 5, rowsY[7] + 3).font('Helvetica-Bold').fontSize(7).text(invoice.termsOfDelivery || 'Delivered to Buyer site.', rightX + 5, rowsY[7] + 10, { width: 250 });

  // --- PRODUCT TABLE ---
  // Table Starts at y = 290
  const tableY = startY + 250;
  
  // Table columns X coordinates
  const colX = [
    startX,        // Sl No (40)
    startX + 25,   // Description (65)
    startX + 265,  // HSN (305)
    startX + 325,  // Quantity (365)
    startX + 385,  // Rate (425)
    startX + 435,  // per (475)
    startX + 465,  // Amount (505)
    startX + width // End (555)
  ];

  // Draw table header line
  doc.moveTo(startX, tableY + 16).lineTo(startX + width, tableY + 16).stroke();

  // Column titles
  doc.font('Helvetica-Bold').fontSize(7.5);
  doc.text('Sl', colX[0] + 2, tableY + 5);
  doc.text('No.', colX[0] + 2, tableY + 11);
  doc.text('Description of Goods', colX[1] + 10, tableY + 5);
  doc.text('HSN/SAC', colX[2] + 5, tableY + 5);
  doc.text('Quantity', colX[3] + 5, tableY + 5);
  doc.text('Rate', colX[4] + 10, tableY + 5);
  doc.text('per', colX[5] + 5, tableY + 5);
  doc.text('Amount', colX[6] + 15, tableY + 5);

  // Render products, dispatches, and tax lines
  let currentY = tableY + 22;
  let totalQtySum = 0;

  invoice.products.forEach((item, index) => {
    doc.font('Helvetica').fontSize(8.5);
    doc.text(String(index + 1), colX[0] + 8, currentY);
    
    const prod = item.productId || {};
    totalQtySum += item.quantity;

    doc.font('Helvetica-Bold').text(prod.productName || 'N/A', colX[1] + 5, currentY);
    doc.font('Helvetica').fontSize(7.5);
    
    // Specifications list
    const specs = `Specs: ${prod.capacity || ''} - ${prod.materialType || ''}`;
    doc.text(specs, colX[1] + 5, currentY + 10, { width: 190 });

    // Render multi-plant dispatches info in small text if applicable
    if (invoice.dispatchType === 'Multi') {
      const dispInfo = (item.dispatches || []).map(d => `${d.plantId?.plantCode || 'Plant'}: ${d.quantity}`).join(', ');
      doc.fontSize(6.5).fillColor('#555555').text(`Dispatched splits: ${dispInfo}`, colX[1] + 5, currentY + 20);
      doc.fontSize(7.5).fillColor('#000000');
    }

    doc.fontSize(8.5);
    doc.text(prod.hsnCode || '72042590', colX[2] + 5, currentY);
    doc.text(`${item.quantity} ${prod.unit || 'Nos'}`, colX[3] + 5, currentY);
    doc.text(Number(item.rate).toFixed(2), colX[4] + 5, currentY, { width: 45, align: 'right' });
    doc.text(prod.unit || 'Nos', colX[5] + 3, currentY);
    doc.text(Number(item.amount).toFixed(2), colX[6] + 5, currentY, { width: 45, align: 'right' });

    currentY += 35;
  });

  // Calculate and draw GST tax rows inside Description area
  const taxY = currentY + 5;
  doc.font('Helvetica-Bold').fontSize(8.5);

  if (isCGST) {
    // Local: CGST @ 9% & SGST @ 9%
    const cgstAmt = Math.round(invoice.subtotal * 0.09 * 100) / 100;
    const sgstAmt = Math.round(invoice.subtotal * 0.09 * 100) / 100;

    doc.text('Output CGST @ 9%', colX[1] + 100, taxY);
    doc.text('9 %', colX[4] + 10, taxY);
    doc.text(cgstAmt.toFixed(2), colX[6] + 5, taxY, { width: 45, align: 'right' });

    doc.text('Output SGST @ 9%', colX[1] + 100, taxY + 15);
    doc.text('9 %', colX[4] + 10, taxY + 15);
    doc.text(sgstAmt.toFixed(2), colX[6] + 5, taxY + 15, { width: 45, align: 'right' });
  } else if (isIGST) {
    // Inter-state: IGST @ 18%
    const igstAmt = invoice.gstAmount;

    doc.text('Output IGST @ 18%', colX[1] + 100, taxY);
    doc.text('18 %', colX[4] + 10, taxY);
    doc.text(igstAmt.toFixed(2), colX[6] + 5, taxY, { width: 45, align: 'right' });
  } else {
    // Total GST @ 18%
    const totalGstAmt = invoice.gstAmount;

    doc.text('Output GST @ 18%', colX[1] + 100, taxY);
    doc.text('18 %', colX[4] + 10, taxY);
    doc.text(totalGstAmt.toFixed(2), colX[6] + 5, taxY, { width: 45, align: 'right' });
  }

  // Draw Vertical lines for columns inside table area (height = 250)
  const tableBottomY = tableY + 230;
  for (let i = 1; i < colX.length - 1; i++) {
    doc.moveTo(colX[i], tableY).lineTo(colX[i], tableBottomY).stroke();
  }

  // Draw table bottom horizontal border
  doc.moveTo(startX, tableBottomY).lineTo(startX + width, tableBottomY).stroke();

  // --- TABLE TOTAL ROW ---
  doc.font('Helvetica-Bold').fontSize(8.5);
  doc.text('Total', colX[1] + 100, tableBottomY + 4);
  doc.text(`${totalQtySum} ${invoice.products[0]?.productId?.unit || 'Nos'}`, colX[3] + 2, tableBottomY + 4);
  doc.text(`₹ ${Number(invoice.grandTotal).toFixed(2)}`, colX[6] + 2, tableBottomY + 4, { width: 48, align: 'right' });

  // Draw bottom line of Total Row
  const totalRowBottom = tableBottomY + 15;
  doc.moveTo(startX, totalRowBottom).lineTo(startX + width, totalRowBottom).stroke();

  // --- AMOUNT IN WORDS BOX ---
  const wordsY = totalRowBottom;
  doc.font('Helvetica').fontSize(6.5).text('Amount Chargeable (in words)', startX + 5, wordsY + 3);
  doc.font('Helvetica-Bold').fontSize(8.5).text(convertNumberToWords(invoice.grandTotal), startX + 5, wordsY + 11);
  doc.font('Helvetica').fontSize(8.5).text('E. & O.E', startX + width - 50, wordsY + 5);

  const wordsBottom = wordsY + 25;
  doc.moveTo(startX, wordsBottom).lineTo(startX + width, wordsBottom).stroke();

  // --- HSN TAX SUMMARY TABLE ---
  const hsnY = wordsBottom;
  doc.font('Helvetica-Bold').fontSize(7.5);
  
  // Choose coordinates and columns for HSN summary based on local vs inter-state
  // If Local (CGST/SGST), we need 7 columns
  // If Inter-state (IGST) or Total GST, we need 5 columns
  const hsnColX = isCGST 
    ? [startX, startX + 80, startX + 160, startX + 220, startX + 300, startX + 360, startX + 440, startX + width] 
    : [startX, startX + 110, startX + 220, startX + 310, startX + 420, startX + width];

  // Draw HSN title bar
  doc.moveTo(startX, hsnY + 12).lineTo(startX + width, hsnY + 12).stroke();
  doc.moveTo(startX, hsnY + 24).lineTo(startX + width, hsnY + 24).stroke();

  // Draw HSN Vertical lines
  const hsnBottomY = hsnY + 50;
  for (let i = 1; i < hsnColX.length - 1; i++) {
    doc.moveTo(hsnColX[i], hsnY).lineTo(hsnColX[i], hsnBottomY).stroke();
  }

  // Titles
  if (isCGST) {
    doc.text('HSN/SAC', hsnColX[0] + 5, hsnY + 3);
    doc.text('Taxable Value', hsnColX[1] + 5, hsnY + 3);
    
    // Central Tax header spans 2 columns
    doc.text('Central Tax', hsnColX[2] + 25, hsnY + 3);
    doc.moveTo(hsnColX[2], hsnY + 12).lineTo(hsnColX[4], hsnY + 12).stroke();
    doc.text('Rate', hsnColX[2] + 15, hsnY + 15);
    doc.text('Amount', hsnColX[3] + 25, hsnY + 15);

    // State Tax header spans 2 columns
    doc.text('State Tax', hsnColX[4] + 25, hsnY + 3);
    doc.moveTo(hsnColX[4], hsnY + 12).lineTo(hsnColX[6], hsnY + 12).stroke();
    doc.text('Rate', hsnColX[4] + 15, hsnY + 15);
    doc.text('Amount', hsnColX[5] + 25, hsnY + 15);

    doc.text('Total Tax', hsnColX[6] + 20, hsnY + 3);
    doc.text('Amount', hsnColX[6] + 20, hsnY + 15);
  } else {
    doc.text('HSN/SAC', hsnColX[0] + 5, hsnY + 3);
    doc.text('Taxable Value', hsnColX[1] + 5, hsnY + 3);

    // Integrated Tax or Total GST header
    const taxLabel = isIGST ? 'Integrated Tax' : 'Total GST';
    doc.text(taxLabel, hsnColX[2] + 25, hsnY + 3);
    doc.moveTo(hsnColX[2], hsnY + 12).lineTo(hsnColX[4], hsnY + 12).stroke();
    doc.text('Rate', hsnColX[2] + 20, hsnY + 15);
    doc.text('Amount', hsnColX[3] + 30, hsnY + 15);

    doc.text('Total Tax Amount', hsnColX[4] + 15, hsnY + 6);
  }

  // Populate HSN row values (grouping by hsn code)
  const hsnGroups = {};
  invoice.products.forEach(item => {
    const code = item.productId?.hsnCode || '72042590';
    if (!hsnGroups[code]) {
      hsnGroups[code] = { taxable: 0, tax: 0 };
    }
    hsnGroups[code].taxable += item.amount;
  });

  let hsnRowY = hsnY + 26;
  doc.font('Helvetica').fontSize(8);
  
  Object.keys(hsnGroups).forEach(code => {
    const data = hsnGroups[code];
    const itemTax = Math.round(data.taxable * 0.18 * 100) / 100;
    
    if (isCGST) {
      const halfTax = Math.round(itemTax * 0.5 * 100) / 100;
      doc.text(code, hsnColX[0] + 5, hsnRowY);
      doc.text(data.taxable.toFixed(2), hsnColX[1] + 5, hsnRowY, { width: 70, align: 'right' });
      doc.text('9%', hsnColX[2] + 15, hsnRowY);
      doc.text(halfTax.toFixed(2), hsnColX[3] + 5, hsnRowY, { width: 70, align: 'right' });
      doc.text('9%', hsnColX[4] + 15, hsnRowY);
      doc.text(halfTax.toFixed(2), hsnColX[5] + 5, hsnRowY, { width: 70, align: 'right' });
      doc.text(itemTax.toFixed(2), hsnColX[6] + 5, hsnRowY, { width: 70, align: 'right' });
    } else {
      doc.text(code, hsnColX[0] + 5, hsnRowY);
      doc.text(data.taxable.toFixed(2), hsnColX[1] + 5, hsnRowY, { width: 100, align: 'right' });
      doc.text('18%', hsnColX[2] + 20, hsnRowY);
      doc.text(itemTax.toFixed(2), hsnColX[3] + 5, hsnRowY, { width: 100, align: 'right' });
      doc.text(itemTax.toFixed(2), hsnColX[4] + 5, hsnRowY, { width: 100, align: 'right' });
    }
    hsnRowY += 12;
  });

  // HSN summary total row border
  doc.moveTo(startX, hsnBottomY).lineTo(startX + width, hsnBottomY).stroke();

  // HSN total row text
  doc.font('Helvetica-Bold').fontSize(7.5);
  doc.text('Total', hsnColX[0] + 5, hsnBottomY + 3);
  doc.text(invoice.subtotal.toFixed(2), hsnColX[1] + 5, hsnBottomY + 3, { width: isCGST ? 70 : 100, align: 'right' });
  
  if (isCGST) {
    const halfGst = Math.round(invoice.gstAmount * 0.5 * 100) / 100;
    doc.text(halfGst.toFixed(2), hsnColX[3] + 5, hsnBottomY + 3, { width: 70, align: 'right' });
    doc.text(halfGst.toFixed(2), hsnColX[5] + 5, hsnBottomY + 3, { width: 70, align: 'right' });
  } else {
    doc.text(invoice.gstAmount.toFixed(2), hsnColX[3] + 5, hsnBottomY + 3, { width: 100, align: 'right' });
  }
  doc.text(invoice.gstAmount.toFixed(2), hsnColX[hsnColX.length - 2] + 5, hsnBottomY + 3, { width: isCGST ? 70 : 100, align: 'right' });

  const hsnTotalBottom = hsnBottomY + 12;
  doc.moveTo(startX, hsnTotalBottom).lineTo(startX + width, hsnTotalBottom).stroke();

  // --- TAX AMOUNT IN WORDS BOX ---
  const taxWordsY = hsnTotalBottom;
  doc.font('Helvetica').fontSize(7.5).text('Tax Amount (in words) : ', startX + 5, taxWordsY + 3);
  doc.font('Helvetica-Bold').text(convertNumberToWords(invoice.gstAmount), startX + 95, taxWordsY + 3);

  const taxWordsBottom = taxWordsY + 12;
  doc.moveTo(startX, taxWordsBottom).lineTo(startX + width, taxWordsBottom).stroke();

  // --- DECLARATION AND SIGNATURE BOTTOM ---
  const bottomY = taxWordsBottom;
  // Draw vertical split at x = 320 for declaration vs signatory
  doc.moveTo(320, bottomY).lineTo(320, startY + height).stroke();

  // Declaration left
  doc.font('Helvetica').fontSize(6.5).text('Declaration:', startX + 5, bottomY + 3);
  doc.text(companySettings.declaration, startX + 5, bottomY + 12, { width: 270 });

  // Signatory right
  const signatoryX = 320;
  doc.font('Helvetica').fontSize(6.5).text('for M.A. Oil', signatoryX + 5, bottomY + 3, { align: 'right', width: 220 });
  
  // Custom printed signatory signature block
  doc.fontSize(7.5).font('Helvetica-Bold');
  doc.text('MOHAMMAD TAUSHIF AHMAD', signatoryX + 5, bottomY + 45, { align: 'center', width: 220 });
  doc.fontSize(6).font('Helvetica').fillColor('#666666');
  doc.text('Digitally signed by MOHAMMAD TAUSHIF AHMAD\nDate: ' + new Date().toISOString().slice(0,10), signatoryX + 5, bottomY + 54, { align: 'center', width: 220 });
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7.5).text('Authorized Signatory', signatoryX + 5, bottomY + 68, { align: 'center', width: 220 });

  // --- FOOTER ---
  doc.font('Helvetica').fontSize(7.5).fillColor('#666666');
  doc.text('This is a Computer Generated Invoice', 50, 792, { align: 'center' });

  doc.end();
}

module.exports = {
  generateInvoicePDF,
  generateBarcodeBuffer
};

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

// Constant VPA from user
const UPI_VPA = 'Dummy@okbizaxis';
const MERCHANT_NAME = 'Company Name'; 
const FONT_STYLE = 'calibri';

// Number to words conversion for Indian currency
const numberToWords = (num: number): string => {
  if (num === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  const convertLessThanThousand = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' And ' + convertLessThanThousand(n % 100) : '');
  };

  let integerPart = Math.floor(num);
  const decimalPart = Math.round((num - Math.floor(num)) * 100);

  let words = '';

  if (integerPart >= 10000000) {
    const crores = Math.floor(integerPart / 10000000);
    words += convertLessThanThousand(crores) + ' Crore ';
    integerPart %= 10000000;
  }

  if (integerPart >= 100000) {
    const lakhs = Math.floor(integerPart / 100000);
    words += convertLessThanThousand(lakhs) + ' Lakh ';
    integerPart %= 100000;
  }

  if (integerPart >= 1000) {
    const thousands = Math.floor(integerPart / 1000);
    words += convertLessThanThousand(thousands) + ' Thousand ';
    integerPart %= 1000;
  }

  if (integerPart > 0) {
    words += convertLessThanThousand(integerPart);
  }

  words = words.trim() + ' Rupees';

  if (decimalPart > 0) {
    words += ' And ' + convertLessThanThousand(decimalPart) + ' Paise';
  }

  return words.trim() + ' Only';
};

// Format date to dd/mm/yyyy
const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Format datetime to dd/mm/yyyy, hh:mm:ss AM/PM
const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = formatDate(d);
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${dateStr}, ${hour12}:${minutes}:${seconds} ${ampm}`;
};

export interface InvoiceData {
  invoiceNumber: string; // Formatted invoice number (e.g., "#00001")
  customerTitle: string;
  customerName: string;
  customerCompanyName: string;
  customerAddress: string;
  customerGstNo: string;
  driverName: string;
  vehicleNo: string;
  vehicleType: string;
  tripStartLocation: string;
  tripEndLocation: string;
  startKm: number;
  endKm: number;
  startTime: string;
  endTime: string;
  rentType: 'fixed' | 'hour' | 'day' | 'km';
  fixedAmount: number;
  hours: number;
  ratePerHour: number;
  days: number;
  ratePerDay: number;
  fuelLitres?: number;
  ratePerLitre?: number;
  totalKm: number;
  freeKm: number;
  chargeableKm: number;
  ratePerKm: number;
  chargePerKmFixed: number;
  chargePerKmHour: number;
  fuelChargePerKm: number;
  additionalCosts: { label: string; amount: number }[];
  enableDriverBeta: boolean;
  driverBetaDays: number;
  driverBetaAmountPerDay: number;
  enableNightHalt: boolean;
  nightHaltDays: number;
  nightHaltAmountPerDay: number;
  enableDiscount: boolean;
  discountAmount: number;
  enableGst: boolean;
  gstPercentage: number;
  gstAmount: number;
  enableIgst: boolean;
  igstPercentage: number;
  igstAmount: number;
  advance: number;
  grandTotal: number;
}

export const generateInvoicePDF = async (data: InvoiceData): Promise<{ blob: Blob; fileName: string }> => {
  const doc = new jsPDF();


  // Current date for invoice date display
  const now = new Date();

  // Use the invoice number from Firestore (already formatted as #00001)
  const billNo = data.invoiceNumber.replace('#', 'INV-'); // INV-00001 for filename

  // Sanitize customer name for filename
  const cleanCustomerName = data.customerName ? data.customerName.replace(/[^a-z0-9]/gi, '_') : 'Customer';
  const fileName = `${billNo}_${cleanCustomerName}.pdf`;

  // --- Header ---
  // Top info bar - GSTN, PAN, State
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60); // Dark gray
  doc.text('GSTIN : ', 15, 15);
  doc.text('PAN No. : ', 70, 15);
  doc.text('State Name : TAMIL NADU', 125, 15);
  doc.text('Code : 33', 180, 15);

  doc.setFontSize(20);
  doc.setFont(FONT_STYLE, 'bold');
  doc.setTextColor(139, 0, 0); // Dark red/maroon color
  doc.text('Your Company Name', 105, 25, { align: 'center' });

  // Company Address and Contact Details
  doc.setFontSize(9);
  doc.setFont(FONT_STYLE, 'normal');
  doc.setTextColor(0, 0, 0); // Black
  doc.text('No.5, Sai Sruthi Complex, Ramar Kovil Street, Ram Nagar, Coimbatore - 641 009.', 105, 32, { align: 'center' });
  doc.setFontSize(8);

  // Phone numbers in blue and bold
  doc.setFont(FONT_STYLE, 'bold');
  doc.setTextColor(41, 128, 185); // Blue color
  doc.text('Cell : 98425 48549, 94436 82900, 70102 99197', 105, 37, { align: 'center' });

  doc.setFont(FONT_STYLE, 'normal');
  doc.setTextColor(0, 0, 0); // Back to black
  doc.text('E-mail : example@gmail.com', 105, 42, { align: 'center' });

  // Availability message in dark red/brown
  doc.setFontSize(8);
  doc.setFont(FONT_STYLE, 'bold');
  doc.setTextColor(139, 0, 0); // Dark red/maroon color like company name
  doc.text('AVAILABLE IN ALL TYPES OF TOURIST CAB OPERATORS', 105, 48, { align: 'center' });
  doc.setTextColor(0, 0, 0); // Reset to black

  // Divider Line
  doc.setFont(FONT_STYLE, 'normal');
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0); // Black border
  doc.line(15, 51, 195, 51);

  // TAX INVOICE Heading
  doc.setFontSize(14);
  doc.setFont(FONT_STYLE, 'bold');
  doc.setTextColor(0, 0, 0); // Black color
  doc.text('TAX INVOICE', 105, 58, { align: 'center' });

  // --- Invoice Info ---
  doc.setFontSize(10);
  doc.setTextColor(0);

  // Left Side: Bill To
  doc.setFont(FONT_STYLE, 'bold');
  doc.setTextColor(41, 128, 185); // Blue color for heading
  doc.text('Bill To:', 15, 66);
  doc.setFont(FONT_STYLE, 'normal');
  doc.setTextColor(0, 0, 0); // Black color for content

  let currentY = 72;
  const lineHeight = 4;
  const labelX = 15;
  const colonX = 55; // Position where all colons align
  const valueX = 58; // Position where values start (after colon and space)

  const fullCustomerName = data.customerTitle ? `${data.customerTitle}. ${data.customerName}` : data.customerName;
  doc.text('Customer Name', labelX, currentY);
  doc.text(':', colonX, currentY);
  doc.text(fullCustomerName || '-', valueX, currentY);
  currentY += lineHeight;

  if (data.customerCompanyName) {
    doc.text('Company', labelX, currentY);
    doc.text(':', colonX, currentY);
    doc.text(data.customerCompanyName, valueX, currentY);
    currentY += lineHeight;
  }

  if (data.customerAddress) {
    doc.text('Address', labelX, currentY);
    doc.text(':', colonX, currentY);
    // Split address into lines if too long - extend to right column boundary
    const addressLines = doc.splitTextToSize(data.customerAddress, 70);
    doc.text(addressLines, valueX, currentY);
    currentY += (lineHeight * addressLines.length);
  }

  if (data.customerGstNo) {
    doc.text('GST No', labelX, currentY);
    doc.text(':', colonX, currentY);
    doc.text(data.customerGstNo, valueX, currentY);
    currentY += lineHeight;
  }



  // Right Side: Invoice Details
  const rightColX = 130;
  const rightColonX = 155; // Position where colons align
  const rightValueX = 158; // Position  where values start

  doc.setFont(FONT_STYLE, 'bold');
  doc.setTextColor(41, 128, 185); // Blue color for heading
  doc.text('Invoice Details:', rightColX, 66);
  doc.setFont(FONT_STYLE, 'normal');
  doc.setTextColor(0, 0, 0); // Black color for content

  let rightY = 72;
  doc.text('Invoice No', rightColX, rightY);
  doc.text(':', rightColonX, rightY);
  doc.text(data.invoiceNumber, rightValueX, rightY); // Display formatted number (#00001)
  rightY += lineHeight;

  doc.text('Date', rightColX, rightY);
  doc.text(':', rightColonX, rightY);
  doc.text(formatDate(now), rightValueX, rightY);
  rightY += lineHeight;

  doc.text('Vehicle No', rightColX, rightY);
  doc.text(':', rightColonX, rightY);
  doc.text(data.vehicleNo || '-', rightValueX, rightY);
  rightY += lineHeight;

  if (data.vehicleType) {
    doc.text('Vehicle Type', rightColX, rightY);
    doc.text(':', rightColonX, rightY);
    doc.text(data.vehicleType, rightValueX, rightY);
    rightY += lineHeight;
  }

  doc.text('Driver Name', rightColX, rightY);
  doc.text(':', rightColonX, rightY);
  doc.text(data.driverName || '-', rightValueX, rightY);
  rightY += lineHeight;

  // --- Trip Details Section ---
  const tripDetailsY = Math.max(currentY + 5, rightY + 5, 85);

  // Trip Details heading in blue
  doc.setFont(FONT_STYLE, 'bold');
  doc.setTextColor(41, 128, 185); // Blue color for heading
  doc.text('Trip Details:', 15, tripDetailsY);
  doc.setFont(FONT_STYLE, 'normal');
  doc.setTextColor(0, 0, 0);

  let tripY = tripDetailsY + 5;
  const leftColX = 15;
  const leftColonX = 55;
  const leftValueX = 58;
  const rightTripColX = 130;
  const rightTripColonX = 155;
  const rightTripValueX = 158;

  // Row 1: From | Trip Start
  doc.text('From', leftColX, tripY);
  doc.text(':', leftColonX, tripY);
  doc.text(data.tripStartLocation || '-', leftValueX, tripY);

  doc.text('Trip Start', rightTripColX, tripY);
  doc.text(':', rightTripColonX, tripY);
  const startTimeText = data.startTime ? formatDateTime(data.startTime) : '-';
  doc.text(startTimeText, rightTripValueX, tripY);
  tripY += lineHeight;

  // Row 2: To | Trip End
  doc.text('To', leftColX, tripY);
  doc.text(':', leftColonX, tripY);
  doc.text(data.tripEndLocation || '-', leftValueX, tripY);

  doc.text('Trip End', rightTripColX, tripY);
  doc.text(':', rightTripColonX, tripY);
  const endTimeText = data.endTime ? formatDateTime(data.endTime) : '-';
  doc.text(endTimeText, rightTripValueX, tripY);
  tripY += lineHeight;

  // Row 3: Start KM | End KM
  doc.text('Start KM', leftColX, tripY);
  doc.text(':', leftColonX, tripY);
  doc.text(`${data.startKm} km`, leftValueX, tripY);

  doc.text('End KM', rightTripColX, tripY);
  doc.text(':', rightTripColonX, tripY);
  doc.text(`${data.endKm} km`, rightTripValueX, tripY);
  tripY += lineHeight;

  // Row 4: Total KM | Free KM
  doc.text('Total KM', leftColX, tripY);
  doc.text(':', leftColonX, tripY);
  doc.text(`${data.totalKm} km`, leftValueX, tripY);

  if (data.freeKm > 0) {
    doc.text('Free KM', rightTripColX, tripY);
    doc.text(':', rightTripColonX, tripY);
    doc.text(`${data.freeKm} km`, rightTripValueX, tripY);
    tripY += lineHeight;

    // Row 5: Chargeable KM (highlighted, bold)
    doc.setFont(FONT_STYLE, 'bold');
    doc.text('Chargeable KM', leftColX, tripY);
    doc.text(':', leftColonX, tripY);
    doc.text(`${data.chargeableKm} km`, leftValueX, tripY);
    doc.setFont(FONT_STYLE, 'normal');
    tripY += lineHeight;
  } else {
    tripY += lineHeight;
  }


  // --- Items Table ---
  const tableBody = [];

  // 1. Rent Item
  let rentDescription = '';
  let rentAmount = 0;

  switch (data.rentType) {
    case 'fixed':
      // Fixed Amount + Chargeable KM * Charge per KM
      if (data.fixedAmount > 0) {
        tableBody.push(['Vehicle Rent (Fixed Amount)', data.fixedAmount.toFixed(2)]);
      }
      if (data.chargeableKm > 0 && data.chargePerKmFixed > 0) {
        const kmCharge = data.chargeableKm * data.chargePerKmFixed;
        tableBody.push([`KM Charges (${data.chargeableKm} km @ Rs${data.chargePerKmFixed}/km)`, kmCharge.toFixed(2)]);
      }
      rentAmount = 0; // Already added individual items
      break;
    case 'hour':
      // Hours * Rate per Hour + Chargeable KM * Charge per KM
      if (data.hours > 0 && data.ratePerHour > 0) {
        const hourCharge = data.hours * data.ratePerHour;
        tableBody.push([`Vehicle Rent (${data.hours} hrs @ Rs${data.ratePerHour}/hr)`, hourCharge.toFixed(2)]);
      }
      if (data.chargeableKm > 0 && data.chargePerKmHour > 0) {
        const kmCharge = data.chargeableKm * data.chargePerKmHour;
        tableBody.push([`KM Charges (${data.chargeableKm} km @ Rs${data.chargePerKmHour}/km)`, kmCharge.toFixed(2)]);
      }
      rentAmount = 0; // Already added individual items
      break;
    case 'day':
      // Days * Rate per Day + Chargeable KM * Fuel Charge per KM
      if (data.days > 0 && data.ratePerDay > 0) {
        const dayCharge = data.days * data.ratePerDay;
        tableBody.push([`Vehicle Rent (${data.days} days @ Rs${data.ratePerDay}/day)`, dayCharge.toFixed(2)]);
      }
      if (data.chargeableKm > 0 && data.fuelChargePerKm > 0) {
        const fuelCharge = data.chargeableKm * data.fuelChargePerKm;
        tableBody.push([`Fuel Charges (${data.chargeableKm} km @ Rs${data.fuelChargePerKm}/km)`, fuelCharge.toFixed(2)]);
      }
      rentAmount = 0; // Already added individual items
      break;
    case 'km':
      // Chargeable KM * Rate per KM
      {
        const billableKm = data.chargeableKm;
        if (data.freeKm > 0) {
          rentDescription = `Vehicle Rent (${data.totalKm} km - ${data.freeKm} free km = ${billableKm} km @ Rs${data.ratePerKm}/km)`;
        } else {
          rentDescription = `Vehicle Rent (${billableKm} km @ Rs${data.ratePerKm}/km)`;
        }
        rentAmount = billableKm * data.ratePerKm;
        break;
      }
  }

  if (rentAmount > 0) {
    tableBody.push([rentDescription, rentAmount.toFixed(2)]);
  }

  // 2. Additional Costs (NON-TAXABLE)
  data.additionalCosts.forEach(cost => {
    tableBody.push([cost.label, cost.amount.toFixed(2)]);
  });

  // 3. Driver Beta (NON-TAXABLE)
  if (data.enableDriverBeta) {
    const driverBetaTotal = data.driverBetaDays * data.driverBetaAmountPerDay;
    tableBody.push([`Driver Beta (${data.driverBetaDays} days @ Rs${data.driverBetaAmountPerDay}/day)`, driverBetaTotal.toFixed(2)]);
  }

  // 4. Night Halt (NON-TAXABLE)
  if (data.enableNightHalt) {
    const nightHaltTotal = data.nightHaltDays * data.nightHaltAmountPerDay;
    tableBody.push([`Night Halt (${data.nightHaltDays} days @ Rs${data.nightHaltAmountPerDay}/day)`, nightHaltTotal.toFixed(2)]);
  }

  autoTable(doc, {
    startY: tripY + 5,  // Start after trip details (reduced from 10)
    head: [['Description', 'Amount (Rs)']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 10,
      lineWidth: 0.5,
      lineColor: [0, 0, 0]
    },
    styles: {
      fontSize: 9,
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' }, // Description
      1: { cellWidth: 45, halign: 'right' } // Amount
    },
    bodyStyles: {
      lineWidth: 0.1,
      lineColor: [220, 220, 220]
    }
  });

  // --- Totals Section ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalY = (doc as any).lastAutoTable.finalY + 10;

  // Check if we need a new page for totals
  if (finalY > 200) {
    doc.addPage();
    finalY = 20;
  }

  // Calculate TAXABLE amount (only rent items, excluding additional costs)
  let taxableSubTotal = 0;
  if (rentAmount > 0) {
    taxableSubTotal += rentAmount;
  }
  // For fixed/hour/day types, the charges were already added to tableBody individually
  // We need to sum them excluding additional costs
  const numberOfRentItems = tableBody.length - data.additionalCosts.length;
  for (let i = 0; i < numberOfRentItems; i++) {
    taxableSubTotal += parseFloat(tableBody[i][1] as string);
  }
  // Subtract the rentAmount we already added if it was counted
  if (rentAmount > 0) {
    taxableSubTotal -= rentAmount;
  }

  // Actually, let's recalculate cleanly
  taxableSubTotal = 0;
  for (let i = 0; i < numberOfRentItems; i++) {
    taxableSubTotal += parseFloat(tableBody[i][1] as string);
  }

  // Calculate NON-TAXABLE amount (additional costs + driver beta + night halt)
  let nonTaxableSubTotal = 0;

  // Additional costs
  data.additionalCosts.forEach(cost => {
    nonTaxableSubTotal += cost.amount;
  });

  // Driver Beta
  if (data.enableDriverBeta) {
    nonTaxableSubTotal += data.driverBetaDays * data.driverBetaAmountPerDay;
  }

  // Night Halt
  if (data.enableNightHalt) {
    nonTaxableSubTotal += data.nightHaltDays * data.nightHaltAmountPerDay;
  }

  // DON'T subtract discount here - it will be shown as a separate line
  // Calculate total before round-off: taxable + GST/IGST + non-taxable - discount - advance
  // Use IGST if enabled, otherwise use regular GST
  const gstOrIgstAmount = data.enableIgst ? data.igstAmount : (data.enableGst ? data.gstAmount : 0);
  const totalBeforeRoundOff = taxableSubTotal + gstOrIgstAmount + nonTaxableSubTotal - (data.enableDiscount ? data.discountAmount : 0) - data.advance;
  const roundedTotal = Math.round(totalBeforeRoundOff);
  const roundOff = roundedTotal - totalBeforeRoundOff;
  const finalTotal = roundedTotal;

  // Layout: Bank Details (Left) | Totals (Right)
  const bankDetailsY = finalY;

  // --- Bank Details Section (Left Side) ---
  doc.setFontSize(9);
  doc.setFont(FONT_STYLE, 'bold');
  doc.setTextColor(41, 128, 185); // Blue color
  doc.text('Bank Details :', 15, bankDetailsY);
  doc.setTextColor(0, 0, 0);

  let currentBankY = bankDetailsY + 6;
  doc.setFont(FONT_STYLE, 'bold');
  doc.setFontSize(8);

  doc.text('Name : Karur Vysya Bank', 15, currentBankY);
  currentBankY += 5;
  doc.text('A/c. No. : 1121280000000810', 15, currentBankY);
  currentBankY += 5;
  doc.text('Branch : Nanjappa Road', 15, currentBankY);
  currentBankY += 5;
  doc.text('IFSC Code : KVBL0001121', 15, currentBankY);
  currentBankY += 5;

  // UPI ID below IFSC
  const upiVpa = import.meta.env.VITE_UPI_VPA || 'your-upi@bank';
  doc.text(`UPI ID : ${upiVpa}`, 15, currentBankY);
  currentBankY += 5;

  // CHEQUES/DD line (below UPI ID)
  doc.setFontSize(9);
  doc.setFont(FONT_STYLE, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('CHEQUES / DD Favouring "Your Company" Only', 15, currentBankY);
  currentBankY += 7; // Extra space before QR

  // --- UPI QR Code (Below CHEQUES line) ---
  const qrSize = 30;
  const qrX = 15; // Left-aligned with Bank Details
  const qrY = currentBankY; // Position below CHEQUES

  try {
    // Generate UPI URI
    const upiUri = `upi://pay?pa=${UPI_VPA}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${finalTotal.toFixed(2)}&cu=INR`;

    // Generate QR Data URL
    const qrDataUrl = await QRCode.toDataURL(upiUri, { errorCorrectionLevel: 'H' });

    // Add QR Image below CHEQUES line
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // Make QR Clickable (Hyperlink)
    doc.link(qrX, qrY, qrSize, qrSize, { url: upiUri });

  } catch (err) {
    console.error('Error generating QR code:', err);
  }

  // Scan instruction below QR (centered to QR)
  currentBankY = qrY + qrSize + 2;
  doc.setFontSize(7);
  doc.setFont(FONT_STYLE, 'italic');
  doc.setTextColor(100);
  const qrCenterX = qrX + (qrSize / 2); // Center of QR code
  doc.text('Scan this QR code to pay', qrCenterX, currentBankY, { align: 'center' });
  currentBankY += 5;


  // --- Totals Section (Right Side) ---
  const totalsXLabel = 115;
  const totalsXValue = 190;
  let currentTotalsY = finalY;

  doc.setFontSize(9);
  doc.setFont(FONT_STYLE, 'normal');

  // Taxable Sub Total
  doc.text('Sub Total', totalsXLabel, currentTotalsY);
  doc.text(taxableSubTotal.toFixed(2), totalsXValue, currentTotalsY, { align: 'right' });
  currentTotalsY += 6;

  // CGST and SGST (regular GST)
  if (data.enableGst) {
    const halfGstPercentage = data.gstPercentage / 2;
    const halfGstAmount = data.gstAmount / 2;

    doc.text(`CGST ${halfGstPercentage}%`, totalsXLabel, currentTotalsY);
    doc.text(halfGstAmount.toFixed(2), totalsXValue, currentTotalsY, { align: 'right' });
    currentTotalsY += 6;

    doc.text(`SGST ${halfGstPercentage}%`, totalsXLabel, currentTotalsY);
    doc.text(halfGstAmount.toFixed(2), totalsXValue, currentTotalsY, { align: 'right' });
    currentTotalsY += 6;

    // Grand Sub Total (after adding GST)
    const subTotalWithGst = taxableSubTotal + data.gstAmount;
    doc.text('Taxable Sub Total', totalsXLabel, currentTotalsY);
    doc.text(subTotalWithGst.toFixed(2), totalsXValue, currentTotalsY, { align: 'right' });
    currentTotalsY += 6;
  }

  // IGST (other state GST) - mutually exclusive with regular GST
  if (data.enableIgst) {
    doc.text(`IGST ${data.igstPercentage}%`, totalsXLabel, currentTotalsY);
    doc.text(data.igstAmount.toFixed(2), totalsXValue, currentTotalsY, { align: 'right' });
    currentTotalsY += 6;

    // Grand Sub Total (after adding IGST)
    const subTotalWithIgst = taxableSubTotal + data.igstAmount;
    doc.text('Taxable Sub Total', totalsXLabel, currentTotalsY);
    doc.text(subTotalWithIgst.toFixed(2), totalsXValue, currentTotalsY, { align: 'right' });
    currentTotalsY += 6;
  }

  // Non-Taxable Sub Total (if any)
  if (nonTaxableSubTotal > 0) {
    doc.text('Non Taxable Sub Total', totalsXLabel, currentTotalsY);
    doc.text(nonTaxableSubTotal.toFixed(2), totalsXValue, currentTotalsY, { align: 'right' });
    currentTotalsY += 6;
  }

  // Discount (if any)
  if (data.enableDiscount && data.discountAmount > 0) {
    doc.text('Discount', totalsXLabel, currentTotalsY);
    doc.text(`-${data.discountAmount.toFixed(2)}`, totalsXValue, currentTotalsY, { align: 'right' });
    currentTotalsY += 6;
  }

  // Advance (if any)
  if (data.advance > 0) {
    doc.text('Advance', totalsXLabel, currentTotalsY);
    doc.text(`-${data.advance.toFixed(2)}`, totalsXValue, currentTotalsY, { align: 'right' });
    currentTotalsY += 6;
  }

  // Round Off
  doc.text('Round Off', totalsXLabel, currentTotalsY);
  doc.text(roundOff.toFixed(2), totalsXValue, currentTotalsY, { align: 'right' });
  currentTotalsY += 8;

  // Bottom Line Y = Max of bank block or totals block + padding
  let bottomLineY = Math.max(currentBankY, currentTotalsY) + 7;

  // Divider line before bottom row
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);
  doc.line(15, bottomLineY - 3, 195, bottomLineY - 3);

  // --- Bottom Row: In Words (Left) | Grand Total (Right) ---
  const amountInWords = numberToWords(finalTotal);
  doc.setFont(FONT_STYLE, 'italic');
  doc.setFontSize(8);
  doc.text('In words:', 15, bottomLineY + 2);
  doc.setFont(FONT_STYLE, 'bold');

  const wordsLines = doc.splitTextToSize(amountInWords, 90);
  doc.text(wordsLines, 28, bottomLineY + 2);

  // GRAND TOTAL (Right side)
  doc.setFontSize(12);
  doc.text('GRAND TOTAL', totalsXLabel, bottomLineY + 2);
  doc.text(`Rs. ${finalTotal.toFixed(2)}`, totalsXValue, bottomLineY + 2, { align: 'right' });

  finalY = bottomLineY + 8 + (wordsLines.length * 4);

  // Divider line after bottom row (closer spacing)
  doc.setLineWidth(0.5);
  doc.line(15, finalY - 7, 195, finalY - 7);


  // Footer messages at the very bottom
  doc.setFontSize(6);
  doc.setFont(FONT_STYLE, 'italic');
  doc.setTextColor(100);
  const pageHeight = doc.internal.pageSize.height;
  doc.text('Compute only, valid without signature. Thank you for travelling with us!', 105, pageHeight - 10, { align: 'center' });

  return { blob: doc.output('blob'), fileName };
};

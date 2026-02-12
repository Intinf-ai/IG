import { generateInvoicePDF } from './src/services/pdfGeneration';
import * as fs from 'fs';

// Test data with all new fields
const testInvoiceData = {
    customerTitle: 'Mr.',
    customerName: 'Test Customer',
    customerCompanyName: 'Test Company Ltd',
    customerAddress: 'No 123, Test Street, Chennai, Tamil Nadu - 600001',
    customerGstNo: '33ABCDE1234F1Z5',
    driverName: 'John Driver',
    vehicleNo: 'TN 01 AB 1234',
    vehicleType: 'SUV',
    tripStartLocation: 'Chennai',
    tripEndLocation: 'Ooty',
    startKm: 1000,
    endKm: 1350,
    startTime: '2026-02-03T10:00:00',
    endTime: '2026-02-04T18:00:00',
    rentType: 'hour' as const,
    fixedAmount: 0,
    hours: 15,
    ratePerHour: 475,
    days: 0,
    ratePerDay: 0,
    totalKm: 350,
    freeKm: 50,
    chargeableKm: 300,
    ratePerKm: 0,
    chargePerKmFixed: 0,
    chargePerKmHour: 18,
    fuelChargePerKm: 0,
    additionalCosts: [
        { label: 'Toll', amount: 500 },
        { label: 'Parking', amount: 200 }
    ],
    enableDriverBeta: true,
    driverBetaDays: 2,
    driverBetaAmountPerDay: 400,
    enableNightHalt: true,
    nightHaltDays: 1,
    nightHaltAmountPerDay: 300,
    enableDiscount: true,
    discountAmount: 1000,
    enableGst: true,
    gstPercentage: 5,
    gstAmount: 475.88, // 5% of (7125 + 2700)
    enableIgst: false,
    igstPercentage: 5,
    igstAmount: 0,
    advance: 2000,
    grandTotal: 0 // Will be calculated
};

async function testPDFGeneration() {
    console.log('Generating test invoice PDF...');

    try {
        const { blob, fileName } = await generateInvoicePDF(testInvoiceData);

        // Convert blob to buffer for Node.js
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Save to file
        const outputPath = `./${fileName}`;
        fs.writeFileSync(outputPath, buffer);

        console.log(`✅ PDF generated successfully: ${outputPath}`);
        console.log('\nTest invoice details:');
        console.log('- Vehicle Rent: 15 hrs @ Rs 475/hr = Rs 7,125');
        console.log('- KM Charges: 300 km @ Rs 18/km = Rs 5,400');
        console.log('- Driver Beta: 2 days @ Rs 400/day = Rs 800');
        console.log('- Night Halt: 1 day @ Rs 300/day = Rs 300');
        console.log('- Additional Costs: Rs 700 (Toll + Parking)');
        console.log('- GST: 5% on taxable items');
        console.log('- Discount: Rs 1,000');
        console.log('- Advance: Rs 2,000');

    } catch (error) {
        console.error('❌ Error generating PDF:', error);
    }
}

// Run the test
testPDFGeneration();

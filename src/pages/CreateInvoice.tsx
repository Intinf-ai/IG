import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Printer, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { calculateSubtotal, type AdditionalCost, type RentType } from '../lib/calculator';
import { useDrive } from '../services/useDrive';
import { generateInvoicePDF } from '../services/pdfGeneration';
import { getFormattedInvoiceNumber } from '../services/firestore';

export default function CreateInvoice() {
  const navigate = useNavigate();
  const { isSignedIn, signIn, uploadFile, loading: driveLoading } = useDrive();

  // Customer & Trip Details
  const [customerTitle, setCustomerTitle] = useState('Mr');
  const [customerName, setCustomerName] = useState('');
  const [customerCompanyName, setCustomerCompanyName] = useState('M/S ');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGstNo, setCustomerGstNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [tripStartLocation, setTripStartLocation] = useState('');
  const [tripEndLocation, setTripEndLocation] = useState('');
  const [startKm, setStartKm] = useState(0);
  const [endKm, setEndKm] = useState(0);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Rent Calculation
  const [rentType, setRentType] = useState<RentType>('fixed');
  const [fixedAmount, setFixedAmount] = useState(0);
  const [hours, setHours] = useState(0);
  const [ratePerHour, setRatePerHour] = useState(0);
  const [days, setDays] = useState(0);
  const [ratePerDay, setRatePerDay] = useState(0);
  const [fuelChargePerKm, setFuelChargePerKm] = useState(0);
  const [freeKm, setFreeKm] = useState(0);
  const [ratePerKm, setRatePerKm] = useState(0);
  const [chargePerKmFixed, setChargePerKmFixed] = useState(0);
  const [chargePerKmHour, setChargePerKmHour] = useState(0);

  // Additional Costs
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>([]);
  const [newCostLabel, setNewCostLabel] = useState('');
  const [newCostAmount, setNewCostAmount] = useState('');

  // Driver Beta & Night Halt
  const [enableDriverBeta, setEnableDriverBeta] = useState(false);
  const [driverBetaDays, setDriverBetaDays] = useState(0);
  const [driverBetaAmountPerDay, setDriverBetaAmountPerDay] = useState(0);
  const [enableNightHalt, setEnableNightHalt] = useState(false);
  const [nightHaltDays, setNightHaltDays] = useState(0);
  const [nightHaltAmountPerDay, setNightHaltAmountPerDay] = useState(0);

  // Upload State
  const [uploading, setUploading] = useState(false);


  // Totals
  const [enableDiscount, setEnableDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [enableGst, setEnableGst] = useState(false);
  const [gstPercentage, setGstPercentage] = useState(5);
  const [enableIgst, setEnableIgst] = useState(false);
  const [igstPercentage, setIgstPercentage] = useState(5);
  const [advance, setAdvance] = useState(0);

  // Computed Values - Auto-calculate from Start/End KM
  const totalKm = Math.max(0, endKm - startKm);
  const chargeableKm = Math.max(0, totalKm - freeKm);

  const rentTotal = (() => {
    switch (rentType) {
      case 'fixed':
        return fixedAmount + (chargeableKm * chargePerKmFixed);
      case 'hour':
        return (hours * ratePerHour) + (chargeableKm * chargePerKmHour);
      case 'day':
        return (days * ratePerDay) + (chargeableKm * fuelChargePerKm);
      case 'km':
        return chargeableKm * ratePerKm;
      default:
        return 0;
    }
  })();

  // Calculate Driver Beta and Night Halt totals
  const driverBetaTotal = enableDriverBeta ? driverBetaDays * driverBetaAmountPerDay : 0;
  const nightHaltTotal = enableNightHalt ? nightHaltDays * nightHaltAmountPerDay : 0;

  // Base subtotal (rent + additional costs)
  const baseSubtotal = calculateSubtotal(rentTotal, additionalCosts);

  // Add Driver Beta and Night Halt to get full subtotal
  const subtotal = baseSubtotal + driverBetaTotal + nightHaltTotal;

  // Calculate GST or IGST (mutually exclusive)
  let gstAmount = 0;
  let igstAmount = 0;
  let grandTotal = subtotal;

  // Apply discount first
  if (enableDiscount) {
    grandTotal -= discountAmount;
  }

  // Apply GST or IGST
  if (enableGst) {
    gstAmount = grandTotal * (gstPercentage / 100);
    grandTotal += gstAmount;
  } else if (enableIgst) {
    igstAmount = grandTotal * (igstPercentage / 100);
    grandTotal += igstAmount;
  }

  const addCost = () => {
    if (!newCostLabel || !newCostAmount) return;
    setAdditionalCosts([
      ...additionalCosts,
      { id: crypto.randomUUID(), label: newCostLabel, amount: Number(newCostAmount) }
    ]);
    setNewCostLabel('');
    setNewCostAmount('');
  };

  const removeCost = (id: string) => {
    setAdditionalCosts(additionalCosts.filter(c => c.id !== id));
  };

  const handleGenerateInvoice = async () => {
    try {


      // Validation
      if (!customerName.trim()) {
        toast.error('Please enter customer name');
        return;
      }

      if (startKm < 0 || endKm < 0) {
        toast.error('KM readings cannot be negative');
        return;
      }

      if (endKm < startKm) {
        toast.error('End KM cannot be less than Start KM');
        return;
      }

      if (startTime && endTime) {
        if (new Date(endTime) < new Date(startTime)) {
          toast.error('End Time cannot be before Start Time');
          return;
        }
      }

      setUploading(true);

      // Check if signed in, if not, trigger sign-in
      if (!isSignedIn) {
        await signIn();
      }


      // 1. Get Next Invoice Number from Firestore
      const loadingToast = toast.loading('Generating invoice number...');
      let invoiceNumber: string;
      try {
        invoiceNumber = await getFormattedInvoiceNumber();
        toast.success(`Invoice ${invoiceNumber} created`, { id: loadingToast });
      } catch (error) {
        toast.error('Failed to generate invoice number', { id: loadingToast });
        setUploading(false);
        return;
      }

      // 2. Prepare Invoice Data
      const invoiceData = {
        invoiceNumber,
        customerTitle,
        customerName,
        customerCompanyName,
        customerAddress,
        customerGstNo,
        driverName,
        vehicleNo,
        vehicleType,
        tripStartLocation,
        tripEndLocation,
        startKm,
        endKm,
        startTime,
        endTime,
        rentType,
        fixedAmount,
        hours,
        ratePerHour,
        days,
        ratePerDay,
        fuelChargePerKm,
        totalKm,
        freeKm,
        chargeableKm,
        ratePerKm,
        chargePerKmFixed,
        chargePerKmHour,
        additionalCosts,
        enableDriverBeta,
        driverBetaDays,
        driverBetaAmountPerDay,
        enableNightHalt,
        nightHaltDays,
        nightHaltAmountPerDay,
        enableDiscount,
        discountAmount,
        enableGst,
        gstPercentage,
        gstAmount,
        enableIgst,
        igstPercentage,
        igstAmount,
        advance,
        grandTotal
      };

      // 3. Generate PDF Blob
      const { blob, fileName } = await generateInvoicePDF(invoiceData);

      // 4. Create File object
      const pdfFile = new File([blob], fileName, { type: 'application/pdf' });

      // 4. Upload to Google Drive
      const toastId = toast.loading('Uploading invoice...');
      const result = await uploadFile(pdfFile, fileName);

      toast.success(`Invoice uploaded successfully!`, {
        id: toastId,
        duration: 4000
      });
      console.log('Upload successful:', result);

      // Navigate back to invoice list
      navigate('/');
    } catch (error) {
      console.error('Upload error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to upload invoice';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Invoices
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Create New Invoice</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Area */}
          <div className="lg:col-span-2 space-y-6">

            {/* 1. Trip Details */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold mb-4 text-slate-800">Customer & Trip Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
                  <div className="flex gap-2">
                    <select
                      className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      value={customerTitle}
                      onChange={e => setCustomerTitle(e.target.value)}
                    >
                      <option value="Mr">Mr</option>
                      <option value="Mrs">Mrs</option>
                      <option value="Ms">Ms</option>
                      <option value="Dr">Dr</option>
                      <option value="M/S">M/S</option>
                    </select>
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Enter customer name"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                  <div className="flex items-center border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
                    <span className="px-3 py-2 bg-slate-100 text-slate-700 font-medium border-r border-slate-300">M/S</span>
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 outline-none rounded-r-lg"
                      placeholder="Enter company name"
                      value={customerCompanyName.replace(/^M\/S\s*/, '')}
                      onChange={e => setCustomerCompanyName('M/S ' + e.target.value)}
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Customer Address</label>
                  <textarea
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter customer address"
                    rows={2}
                    value={customerAddress}
                    onChange={e => setCustomerAddress(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Customer GST No</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. 22AAAAA0000A1Z5"
                    value={customerGstNo}
                    onChange={e => setCustomerGstNo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Driver Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter driver name"
                    value={driverName}
                    onChange={e => setDriverName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle No</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="TN 01 AB 1234"
                    value={vehicleNo}
                    onChange={e => setVehicleNo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Type</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Sedan, SUV, Bus"
                    value={vehicleType}
                    onChange={e => setVehicleType(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Trip Start Location</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Starting point"
                    value={tripStartLocation}
                    onChange={e => setTripStartLocation(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Trip End Location</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Destination"
                    value={tripEndLocation}
                    onChange={e => setTripEndLocation(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 border-t pt-4 border-slate-100">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Start KM</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    value={startKm || ''}
                    onChange={e => setStartKm(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">End KM</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    value={endKm || ''}
                    onChange={e => setEndKm(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Free KM</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="e.g. 50"
                    value={freeKm || ''}
                    onChange={e => setFreeKm(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Chargeable KM</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-100"
                    value={chargeableKm}
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* 2. Rent Calculation */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold mb-4 text-slate-800">Rent Calculation</h2>
              <div className="flex bg-slate-100 rounded-lg p-1 mb-4 w-fit flex-wrap gap-1">
                <button
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${rentType === 'fixed' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setRentType('fixed')}
                >
                  Fixed
                </button>
                <button
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${rentType === 'hour' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setRentType('hour')}
                >
                  Hour
                </button>
                <button
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${rentType === 'day' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setRentType('day')}
                >
                  Day Rent
                </button>
                <button
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${rentType === 'km' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={() => setRentType('km')}
                >
                  KM
                </button>
              </div>

              {rentType === 'fixed' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Total Fixed Amount (₹)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-medium"
                      placeholder="0.00"
                      value={fixedAmount || ''}
                      onChange={e => setFixedAmount(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Charge per KM (₹)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="0.00"
                      value={chargePerKmFixed || ''}
                      onChange={e => setChargePerKmFixed(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Chargeable KM</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100"
                      value={chargeableKm}
                      disabled
                    />
                  </div>
                </div>
              )}

              {rentType === 'hour' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Total Hours</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="e.g. 8"
                      value={hours || ''}
                      onChange={e => setHours(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rate per Hour (₹)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="0.00"
                      value={ratePerHour || ''}
                      onChange={e => setRatePerHour(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Charge per KM (₹)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="0.00"
                      value={chargePerKmHour || ''}
                      onChange={e => setChargePerKmHour(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Chargeable KM</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100"
                      value={chargeableKm}
                      disabled
                    />
                  </div>
                </div>
              )}

              {rentType === 'day' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">No of Days</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        placeholder="e.g. 3"
                        value={days || ''}
                        onChange={e => setDays(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Amount per Day (₹)</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        placeholder="0.00"
                        value={ratePerDay || ''}
                        onChange={e => setRatePerDay(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Chargeable KM</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100"
                        value={chargeableKm}
                        disabled
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Fuel Charge per KM (₹)</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        placeholder="0.00"
                        value={fuelChargePerKm || ''}
                        onChange={e => setFuelChargePerKm(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {rentType === 'km' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Chargeable KM</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100"
                      value={chargeableKm}
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount per KM (₹)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="0.00"
                      value={ratePerKm || ''}
                      onChange={e => setRatePerKm(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Driver Beta & Night Halt */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-6 flex items-center bg-gray-300 rounded-full p-1 cursor-pointer transition-colors ${enableDriverBeta ? 'bg-blue-600' : ''}`} onClick={() => setEnableDriverBeta(!enableDriverBeta)}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${enableDriverBeta ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Driver Beta</span>
                </div>
                {enableDriverBeta && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Days"
                      className="w-20 px-3 py-1 border border-slate-300 rounded-lg text-sm"
                      value={driverBetaDays || ''}
                      onChange={e => setDriverBetaDays(Number(e.target.value))}
                    />
                    <input
                      type="number"
                      placeholder="₹/day"
                      className="w-24 px-3 py-1 border border-slate-300 rounded-lg text-sm"
                      value={driverBetaAmountPerDay || ''}
                      onChange={e => setDriverBetaAmountPerDay(Number(e.target.value))}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-6 flex items-center bg-gray-300 rounded-full p-1 cursor-pointer transition-colors ${enableNightHalt ? 'bg-blue-600' : ''}`} onClick={() => setEnableNightHalt(!enableNightHalt)}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${enableNightHalt ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Night Halt</span>
                </div>
                {enableNightHalt && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Days"
                      className="w-20 px-3 py-1 border border-slate-300 rounded-lg text-sm"
                      value={nightHaltDays || ''}
                      onChange={e => setNightHaltDays(Number(e.target.value))}
                    />
                    <input
                      type="number"
                      placeholder="₹/day"
                      className="w-24 px-3 py-1 border border-slate-300 rounded-lg text-sm"
                      value={nightHaltAmountPerDay || ''}
                      onChange={e => setNightHaltAmountPerDay(Number(e.target.value))}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 4. Additional Costs */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold mb-4 text-slate-800">Additional Costs</h2>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Details (e.g. Toll, Parking)"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={newCostLabel}
                  onChange={e => setNewCostLabel(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Amount"
                  className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={newCostAmount}
                  onChange={e => setNewCostAmount(e.target.value)}
                />
                <button
                  onClick={addCost}
                  className="bg-slate-900 hover:bg-slate-800 text-white p-2 rounded-lg transition-colors"
                >
                  <Plus size={20} />
                </button>
              </div>

              {additionalCosts.length > 0 ? (
                <ul className="space-y-2">
                  {additionalCosts.map(cost => (
                    <li key={cost.id} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg text-sm">
                      <span className="text-slate-700">{cost.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">₹{cost.amount}</span>
                        <button onClick={() => removeCost(cost.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400 italic">No additional costs added.</p>
              )}
            </div>

            {/* 4. Controls */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-6 flex items-center bg-gray-300 rounded-full p-1 cursor-pointer transition-colors ${enableDiscount ? 'bg-blue-600' : ''}`} onClick={() => setEnableDiscount(!enableDiscount)}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${enableDiscount ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Apply Discount</span>
                </div>
                {enableDiscount && (
                  <input
                    type="number"
                    placeholder="Amount"
                    className="w-32 px-3 py-1 border border-slate-300 rounded-lg text-sm"
                    value={discountAmount || ''}
                    onChange={e => setDiscountAmount(Number(e.target.value))}
                  />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-6 flex items-center bg-gray-300 rounded-full p-1 cursor-pointer transition-colors ${enableGst ? 'bg-blue-600' : ''}`} onClick={() => { setEnableGst(!enableGst); if (!enableGst) setEnableIgst(false); }}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${enableGst ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Add GST</span>
                </div>
                {enableGst && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="%"
                      className="w-20 px-3 py-1 border border-slate-300 rounded-lg text-sm"
                      value={gstPercentage || ''}
                      onChange={e => setGstPercentage(Number(e.target.value))}
                      min="0"
                      max="100"
                    />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-6 flex items-center bg-gray-300 rounded-full p-1 cursor-pointer transition-colors ${enableIgst ? 'bg-blue-600' : ''}`} onClick={() => { setEnableIgst(!enableIgst); if (!enableIgst) setEnableGst(false); }}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${enableIgst ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Other State GST (IGST)</span>
                </div>
                {enableIgst && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="%"
                      className="w-20 px-3 py-1 border border-slate-300 rounded-lg text-sm"
                      value={igstPercentage || ''}
                      onChange={e => setIgstPercentage(Number(e.target.value))}
                      min="0"
                      max="100"
                    />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Advance Amount</label>
                <input
                  type="number"
                  placeholder="Amount"
                  className="w-32 px-3 py-1 border border-slate-300 rounded-lg text-sm"
                  value={advance || ''}
                  onChange={e => setAdvance(Number(e.target.value))}
                />
              </div>

            </div>

          </div>

          {/* Preview / Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg sticky top-6">
              <h3 className="text-lg font-semibold mb-6">Bill Summary</h3>

              <div className="space-y-3 text-sm border-b border-slate-700 pb-4 mb-4">
                <div className="flex justify-between text-slate-300">
                  <span>Rent</span>
                  <span>₹{rentTotal.toFixed(2)}</span>
                </div>
                {additionalCosts.map(cost => (
                  <div key={cost.id} className="flex justify-between text-slate-400">
                    <span>{cost.label}</span>
                    <span>₹{cost.amount.toFixed(2)}</span>
                  </div>
                ))}
                {enableDriverBeta && driverBetaTotal > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Driver Beta ({driverBetaDays}d)</span>
                    <span>₹{driverBetaTotal.toFixed(2)}</span>
                  </div>
                )}
                {enableNightHalt && nightHaltTotal > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Night Halt ({nightHaltDays}d)</span>
                    <span>₹{nightHaltTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium pt-2 text-white">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                {enableDiscount && (
                  <div className="flex justify-between text-green-400">
                    <span>Discount</span>
                    <span>-₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 pb-6">
                {enableGst && (
                  <div className="flex justify-between text-slate-300 text-sm">
                    <span>GST ({gstPercentage}%)</span>
                    <span>₹{gstAmount.toFixed(2)}</span>
                  </div>
                )}
                {enableIgst && (
                  <div className="flex justify-between text-slate-300 text-sm">
                    <span>IGST ({igstPercentage}%)</span>
                    <span>₹{igstAmount.toFixed(2)}</span>
                  </div>
                )}
                {advance > 0 && (
                  <div className="flex justify-between text-amber-400 text-sm">
                    <span>Advance</span>
                    <span>-₹{advance.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-2xl font-bold">
                  <span>Total</span>
                  <span>₹{(grandTotal - advance).toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleGenerateInvoice}
                disabled={uploading || driveLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {uploading || driveLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    {isSignedIn ? 'Uploading Invoice...' : 'Signing in...'}
                  </>
                ) : (
                  <>
                    <Printer size={20} />
                    Generate Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

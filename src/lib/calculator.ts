export type RentType = 'fixed' | 'hour' | 'day' | 'km';

export interface AdditionalCost {
  id: string;
  label: string;
  amount: number;
}

export const calculateRent = (
  type: RentType,
  value: number, // Fixed amount OR Input Hours
  ratePerHour: number = 0 // Only used if type is 'day-wise'
): number => {
  if (type === 'fixed') {
    return value;
  }
  return value * ratePerHour;
};

export const calculateSubtotal = (
  rentAmount: number,
  additionalCosts: AdditionalCost[]
): number => {
  const costsTotal = additionalCosts.reduce((sum, item) => sum + item.amount, 0);
  return rentAmount + costsTotal;
};

export const calculateGrandTotal = (
  subtotal: number,
  discount: number,
  enableGst: boolean,
  gstRate: number = 0.18
): { totalBeforeTax: number; gstAmount: number; grandTotal: number } => {
  const totalBeforeTax = Math.max(0, subtotal - discount);
  const gstAmount = enableGst ? totalBeforeTax * gstRate : 0;
  const grandTotal = totalBeforeTax + gstAmount;

  return {
    totalBeforeTax,
    gstAmount,
    grandTotal,
  };
};

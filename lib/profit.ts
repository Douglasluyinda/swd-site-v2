// Contribution-margin / profit engine.
//
// Expected contribution = selling price + customer shipping
//                          - supplier cost - supplier shipping
//                          - payment fees - advertising cost
//                          - refund/return reserve
//
// All inputs are per-unit or per-order figures the caller supplies;
// this module just does the arithmetic and formatting consistently
// so the admin dashboard and any future reporting agree with each other.

export type ProfitInputs = {
  sellingPrice: number;
  customerShipping: number;
  supplierCost: number;
  supplierShipping: number;
  paymentFeeRate?: number; // e.g. 0.029 for ~2.9%
  advertisingCostPerOrder?: number; // estimated CAC allocation
  refundReserveRate?: number; // e.g. 0.03 for a 3% reserve
};

export type ProfitBreakdown = {
  revenue: number;
  grossMargin: number; // revenue - supplier cost - supplier shipping
  grossMarginRate: number;
  paymentFees: number;
  advertisingCost: number;
  refundReserve: number;
  contributionMargin: number; // gross margin - fees - ads - reserve
  contributionMarginRate: number;
};

export function calculateProfit(inputs: ProfitInputs): ProfitBreakdown {
  const {
    sellingPrice,
    customerShipping,
    supplierCost,
    supplierShipping,
    paymentFeeRate = 0.029,
    advertisingCostPerOrder = 0,
    refundReserveRate = 0.03,
  } = inputs;

  const revenue = sellingPrice + customerShipping;
  const grossMargin = revenue - supplierCost - supplierShipping;
  const paymentFees = revenue * paymentFeeRate;
  const refundReserve = revenue * refundReserveRate;
  const contributionMargin =
    grossMargin - paymentFees - advertisingCostPerOrder - refundReserve;

  return {
    revenue,
    grossMargin,
    grossMarginRate: revenue > 0 ? grossMargin / revenue : 0,
    paymentFees,
    advertisingCost: advertisingCostPerOrder,
    refundReserve,
    contributionMargin,
    contributionMarginRate: revenue > 0 ? contributionMargin / revenue : 0,
  };
}

import Decimal from 'decimal.js';

export type ProfitInput = {
  salePrice: number | string; acquisitionCost: number | string; percentageFee: number | string;
  fixedFee?: number | string; sellerShipping?: number | string; packaging?: number | string;
  taxPercent?: number | string; advertising?: number | string; discount?: number | string; otherCosts?: number | string;
};
const d = (v: number | string | undefined) => new Decimal(v ?? 0);
const money = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export function calculateProfit(input: ProfitInput) {
  const price = d(input.salePrice);
  if (!price.isFinite() || price.lte(0)) throw new Error('O preço de venda deve ser maior que zero.');
  const costInputs = [input.acquisitionCost, input.fixedFee, input.sellerShipping, input.packaging, input.advertising, input.otherCosts, input.discount, input.percentageFee, input.taxPercent].map(d);
  if (costInputs.some((value) => !value.isFinite() || value.isNegative())) throw new Error('Custos, descontos e taxas não podem ser negativos ou inválidos.');
  const percent = d(input.percentageFee).plus(d(input.taxPercent)).div(100);
  if (percent.lt(0) || percent.gte(1)) throw new Error('A soma das taxas percentuais deve ser entre 0% e 100%.');
  const discount = d(input.discount);
  if (discount.lt(0) || discount.gt(price)) throw new Error('O desconto deve estar entre zero e o preço de venda.');
  const fixed = d(input.fixedFee).plus(d(input.sellerShipping)).plus(d(input.advertising));
  const variableFees = price.minus(discount).mul(percent);
  const revenue = price.minus(discount);
  const netRevenue = revenue.minus(variableFees).minus(fixed);
  const operatingCosts = d(input.acquisitionCost).plus(d(input.packaging)).plus(d(input.otherCosts));
  const totalCost = operatingCosts.plus(fixed).plus(variableFees);
  const profit = netRevenue.minus(operatingCosts);
  const margin = profit.div(price).mul(100);
  const roi = totalCost.isZero() ? null : profit.div(totalCost).mul(100);
  const fixedCost = operatingCosts.plus(fixed);
  const breakEven = fixedCost.div(new Decimal(1).minus(percent));
  return { grossRevenue: money(price), discount: money(discount), percentageFees: money(variableFees), fixedExpenses: money(fixed), netRevenue: money(netRevenue), operatingCosts: money(operatingCosts), totalCost: money(totalCost), profit: money(profit), marginPercent: money(margin), roiPercent: roi === null ? null : money(roi), breakEvenPrice: money(breakEven), isLoss: profit.lt(0) };
}

export function priceForTargetMargin(input: Omit<ProfitInput, 'salePrice' | 'discount'>, targetMarginPercent: number | string) {
  const target = d(targetMarginPercent).div(100);
  const feeRate = d(input.percentageFee).plus(d(input.taxPercent)).div(100);
  const costs = [input.acquisitionCost, input.fixedFee, input.sellerShipping, input.packaging, input.advertising, input.otherCosts].map(d);
  if (costs.some((value) => !value.isFinite() || value.isNegative()) || !target.isFinite() || !feeRate.isFinite() || target.lt(0) || target.gte(1) || feeRate.lt(0) || feeRate.gte(1) || target.plus(feeRate).gte(1)) throw new Error('Meta de margem incompatível com as taxas informadas.');
  const fixed = d(input.fixedFee).plus(d(input.sellerShipping)).plus(d(input.advertising));
  const variableCosts = d(input.acquisitionCost).plus(d(input.packaging)).plus(d(input.otherCosts)).plus(fixed);
  return money(variableCosts.div(new Decimal(1).minus(feeRate).minus(target)));
}

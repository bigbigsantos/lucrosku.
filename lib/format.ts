export function parseBrazilianNumber(value: FormDataEntryValue | string | null | undefined): number {
  const raw = String(value ?? '').trim().replace(/\s/g, '').replace(/^R\$/i, '');
  if (!raw) return Number.NaN;
  let normalized = raw;
  if (raw.includes(',')) normalized = raw.replace(/\./g, '').replace(',', '.');
  else if ((raw.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(raw)) normalized = raw.replace(/\./g, '');
  return Number(normalized);
}
export function brl(value: number | string | null | undefined): string {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

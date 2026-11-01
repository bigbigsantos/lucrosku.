import { describe, expect, it } from 'vitest';
import { parseBrazilianNumber } from '../lib/format';
describe('entrada numérica brasileira',()=>{it('lê decimais com vírgula e separador de milhar',()=>{expect(parseBrazilianNumber('R$ 1.234,56')).toBe(1234.56);});it('lê valores sem separador de milhar',()=>{expect(parseBrazilianNumber('42,90')).toBe(42.9);});it('lê valor inteiro com separador de milhar',()=>{expect(parseBrazilianNumber('1.234')).toBe(1234);});it('rejeita campo vazio',()=>{expect(Number.isNaN(parseBrazilianNumber(''))).toBe(true);});});

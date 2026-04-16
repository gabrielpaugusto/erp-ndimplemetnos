import { Injectable } from '@nestjs/common';
import { ClassificacaoFiscal, ContextoOperacao } from './classificador.service';

export interface ResultadoValidacao {
  valido: boolean;
  erros: string[];
  avisos: string[];
}

// CFOP de saída → prefixo 5 (intraestadual) ou 6 (interestadual) ou 7 (exportação)
// CFOP de entrada → prefixo 1 (intraestadual) ou 2 (interestadual) ou 3 (exterior)
const CFOP_SAIDA_PREFIXOS = ['5', '6', '7'];
const CFOP_ENTRADA_PREFIXOS = ['1', '2', '3'];

// CST ICMS que implicam tributação normal (débito de ICMS)
const CST_TRIBUTADO = ['00', '10', '20', '51', '70', '90'];
const CSOSN_TRIBUTADO = ['101', '201', '900'];

// CST ICMS que NÃO geram débito (isento, não tributado, suspensão, imune, ST)
const CST_SEM_DEBITO_ICMS = ['40', '41', '50', '60'];
// CSOSN sem débito
const CSOSN_SEM_DEBITO = ['102', '103', '300', '400', '500', '102'];

// CST ICMS que exigem campos de ST preenchidos
const CST_EXIGE_ST = ['10', '30', '60', '70', '150', '151'];

// UFs com alíquota interestadual reduzida (7% recebendo de SP/RS/etc.)
const UF_ALIQUOTA_7 = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'PA', 'PB', 'PE', 'PI', 'RN', 'RO', 'RR', 'SE', 'TO'];
// UFs que ENVIAM à alíquota 7% para as regiões acima
const UF_RICAS = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC'];

// Mapa CFOP saída → natureza esperada (prefixo 4 dígitos → tipo)
const CFOP_SAIDA_NATUREZA: Record<string, string> = {
  '5101': 'Venda intraestadual produção própria',
  '5102': 'Venda intraestadual mercadoria adquirida',
  '5110': 'Venda intraestadual para zona franca/ALC',
  '5405': 'Venda intraestadual com ST retida anteriormente',
  '5551': 'Venda ativo imobilizado intraestadual',
  '5556': 'Venda ativo imobilizado interestadual',
  '6101': 'Venda interestadual produção própria',
  '6102': 'Venda interestadual mercadoria adquirida',
  '6108': 'Venda interestadual para zona franca/ALC',
  '6405': 'Venda interestadual com ST retida anteriormente',
  '7101': 'Exportação direta',
  '7102': 'Exportação mercadoria adquirida',
};

@Injectable()
export class ValidadorService {
  validar(
    classificacao: ClassificacaoFiscal,
    ctx: ContextoOperacao,
  ): ResultadoValidacao {
    const erros: string[] = [];
    const avisos: string[] = [];

    // 1. Direção do CFOP coerente com tipo de operação
    const cfopPrefixo = classificacao.cfop?.charAt(0);
    if (ctx.tipoOperacao === 'SAIDA' && !CFOP_SAIDA_PREFIXOS.includes(cfopPrefixo)) {
      erros.push(`CFOP ${classificacao.cfop} tem prefixo de entrada mas a operação é de SAÍDA.`);
    }
    if (ctx.tipoOperacao === 'ENTRADA' && !CFOP_ENTRADA_PREFIXOS.includes(cfopPrefixo)) {
      erros.push(`CFOP ${classificacao.cfop} tem prefixo de saída mas a operação é de ENTRADA.`);
    }

    // 2. Interestadual → prefixo 6 ou 2
    const isInterestadual = ctx.ufEmitente !== ctx.ufDestinatario;
    if (isInterestadual && ctx.tipoOperacao === 'SAIDA' && cfopPrefixo !== '6' && cfopPrefixo !== '7') {
      erros.push(`Operação interestadual de SAÍDA deve ter CFOP com prefixo 6 (ou 7 para exportação), não ${cfopPrefixo}.`);
    }

    // 3. Alíquota ICMS interestadual
    if (isInterestadual && ctx.tipoOperacao === 'SAIDA') {
      const esperada = this.aliquotaInterestadualEsperada(ctx.ufEmitente, ctx.ufDestinatario);
      if (esperada !== null && Math.abs(classificacao.aliquotaIcms - esperada) > 0.1) {
        const cstSemIcms = ['40', '41', '50', '60', '102', '103', '300', '400', '500'];
        if (!cstSemIcms.includes(classificacao.cstIcms)) {
          avisos.push(
            `Alíquota ICMS interestadual ${ctx.ufEmitente}→${ctx.ufDestinatario} deveria ser ${esperada}%, foi classificada como ${classificacao.aliquotaIcms}%.`,
          );
        }
      }
    }

    // 4. DIFAL obrigatório para não-contribuinte interestadual
    if (
      isInterestadual &&
      !ctx.isContribuinte &&
      ctx.isConsumidorFinal &&
      ctx.tipoOperacao === 'SAIDA' &&
      !classificacao.alertas.some((a) => a.toLowerCase().includes('difal'))
    ) {
      avisos.push('Operação interestadual para consumidor final não contribuinte — verificar DIFAL (EC 87/2015 + LC 190/2022).');
    }

    // 5. PIS/COFINS: alíquotas coerentes com regime tributário
    if (ctx.regimeTributario === 'LR') {
      if (classificacao.cstPis === '01' && Math.abs(classificacao.aliquotaPis - 1.65) > 0.01) {
        avisos.push(`CST PIS 01 com Lucro Real: alíquota esperada 1,65%, classificada ${classificacao.aliquotaPis}%.`);
      }
      if (classificacao.cstCofins === '01' && Math.abs(classificacao.aliquotaCofins - 7.6) > 0.01) {
        avisos.push(`CST COFINS 01 com Lucro Real: alíquota esperada 7,6%, classificada ${classificacao.aliquotaCofins}%.`);
      }
    }
    if (ctx.regimeTributario === 'LP') {
      if (classificacao.aliquotaPis > 0.65 + 0.01 && classificacao.cstPis === '01') {
        avisos.push(`Lucro Presumido usa PIS cumulativo 0,65%, não ${classificacao.aliquotaPis}%.`);
      }
    }

    // 6. CST ICMS × alíquota coerência
    if ([...CST_SEM_DEBITO_ICMS, ...CSOSN_SEM_DEBITO].includes(classificacao.cstIcms) && classificacao.aliquotaIcms > 0) {
      avisos.push(`CST ICMS ${classificacao.cstIcms} (isento/não tributado/ST) mas alíquota ICMS é ${classificacao.aliquotaIcms}% — deve ser 0.`);
    }

    // 7. Saída intraestadual deve ter CFOP 5.xxx (não 6.xxx)
    if (ctx.tipoOperacao === 'SAIDA' && !isInterestadual && cfopPrefixo === '6') {
      erros.push(`CFOP ${classificacao.cfop} é interestadual (prefixo 6) mas emitente e destinatário são da mesma UF (${ctx.ufEmitente}).`);
    }

    // 8. Exportação: CFOP 7.xxx requer destinatário no exterior
    if (cfopPrefixo === '7' && ctx.ufDestinatario !== 'EX' && ctx.ufDestinatario !== '') {
      avisos.push(`CFOP ${classificacao.cfop} é de exportação (prefixo 7) mas destinatário está em UF brasileira (${ctx.ufDestinatario}). Confirme se é exportação direta.`);
    }

    // 9. Simples Nacional → deve usar CSOSN, não CST de 2 dígitos
    if (ctx.regimeTributario === 'SN') {
      const isCSOSN = classificacao.cstIcms.length === 3;
      if (!isCSOSN) {
        erros.push(`Empresa do Simples Nacional deve usar CSOSN (3 dígitos) no campo CST ICMS, não CST ${classificacao.cstIcms}.`);
      }
    }

    // 10. Lucro Real/Presumido → deve usar CST de 2 dígitos
    if (ctx.regimeTributario !== 'SN') {
      const isCSOSN = classificacao.cstIcms.length === 3;
      if (isCSOSN) {
        erros.push(`Empresa do Lucro Real/Presumido deve usar CST ICMS (2 dígitos), não CSOSN ${classificacao.cstIcms}.`);
      }
    }

    // 11. CST com ST → alertar que campo ICMS-ST deve ser preenchido
    if (CST_EXIGE_ST.includes(classificacao.cstIcms) && ctx.tipoOperacao === 'SAIDA') {
      avisos.push(`CST ICMS ${classificacao.cstIcms} envolve substituição tributária — verifique se o produto possui MVA/ST cadastrado para ${ctx.ufDestinatario}.`);
    }

    // 12. IPI para industrial saída — alertar se tem IPI e não é saída de produção própria
    if (classificacao.temIpi && ctx.tipoOperacao === 'SAIDA') {
      const cfopProducaoPropria = ['5101', '6101', '5110', '6108', '7101'];
      if (!cfopProducaoPropria.includes(classificacao.cfop)) {
        avisos.push(`IPI classificado para CFOP ${classificacao.cfop} — confirme se o produto é de fabricação própria sujeito ao IPI.`);
      }
    }

    return { valido: erros.length === 0, erros, avisos };
  }

  private aliquotaInterestadualEsperada(ufOrigem: string, ufDestino: string): number | null {
    // Regra geral: 12% ou 7%
    if (UF_RICAS.includes(ufOrigem) && UF_ALIQUOTA_7.includes(ufDestino)) {
      return 7;
    }
    // Entre estados "ricos" ou quando não se aplica a regra do 7%
    if (!UF_ALIQUOTA_7.includes(ufDestino)) {
      return 12;
    }
    return 12; // default
  }
}

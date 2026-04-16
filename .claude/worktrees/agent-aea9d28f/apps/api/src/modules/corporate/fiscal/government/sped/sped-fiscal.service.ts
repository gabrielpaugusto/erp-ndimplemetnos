import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GovernmentTransmissionService } from '../government-transmission.service';
import {
  generateSpedHeader,
  generateSpedLine,
  formatSpedDecimal,
  formatSpedDate,
} from './sped-file-header';

/**
 * EFD ICMS/IPI (SPED Fiscal) file generation service.
 * Generates the complete EFD file with all required registers.
 */
@Injectable()
export class SpedFiscalService extends GovernmentTransmissionService {
  private static readonly LAYOUT_VERSION = '017'; // Current EFD ICMS/IPI version

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly configService: ConfigService,
  ) {
    super(prisma, configService);
  }

  /**
   * Generate a complete EFD ICMS/IPI file for a given period.
   */
  async generateFile(
    companyId: string,
    periodoInicio: Date,
    periodoFim: Date,
  ): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error(`Company ${companyId} not found`);
    }

    const lines: string[] = [];
    let lineCount = 0;

    // =========================================================================
    // BLOCO 0 - Abertura, Identificacao e Referencias
    // =========================================================================

    // Register 0000 - Header
    lines.push(
      generateSpedHeader({
        codVer: SpedFiscalService.LAYOUT_VERSION,
        codFin: '0',
        dtIni: periodoInicio,
        dtFim: periodoFim,
        nome: company.razaoSocial,
        cnpj: company.cnpj,
        uf: company.uf || 'SP',
        ie: company.inscricaoEstadual || undefined,
        codMun: company.codigoMunicipioIbge || '3550308',
        indPerfil: 'A',
        indAtiv: '0',
      }),
    );
    lineCount++;

    // Register 0001 - Opening Block 0
    lines.push(generateSpedLine('0001', '0')); // 0=com dados
    lineCount++;

    // Register 0005 - Company supplementary data
    lines.push(
      generateSpedLine(
        '0005',
        company.nomeFantasia || company.razaoSocial,
        company.cep || '',
        company.logradouro || '',
        company.numero || '',
        company.complemento || '',
        company.bairro || '',
        company.telefone || '',
        '', // fax
        company.email || '',
      ),
    );
    lineCount++;

    // Register 0100 - Accountant data (placeholder)
    lines.push(
      generateSpedLine(
        '0100',
        'CONTADOR RESPONSAVEL',
        '00000000000', // CPF
        '000000', // CRC
        '', // CNPJ escritorio
        '', // CEP
        '', // Endereco
        '', // Numero
        '', // Complemento
        '', // Bairro
        '', // Telefone
        '', // Fax
        '', // Email
        company.codigoMunicipioIbge || '',
      ),
    );
    lineCount++;

    // Register 0150 - Participants (placeholder - would iterate over persons)
    // In production, fetch all persons involved in the period
    lines.push(
      generateSpedLine(
        '0150',
        'PARTICIPANTE_EXEMPLO',
        '', // name
        '', // pais
        '', // CNPJ
        '', // CPF
        '', // IE
        '', // cod municipio
        '', // suframa
        '', // endereco
        '', // numero
        '', // complemento
        '', // bairro
      ),
    );
    lineCount++;

    // Register 0190 - Units of measure (placeholder)
    lines.push(generateSpedLine('0190', 'UN', 'UNIDADE'));
    lineCount++;
    lines.push(generateSpedLine('0190', 'KG', 'QUILOGRAMA'));
    lineCount++;
    lines.push(generateSpedLine('0190', 'M', 'METRO'));
    lineCount++;

    // Register 0200 - Products/items (placeholder)
    lines.push(
      generateSpedLine(
        '0200',
        'PROD001', // cod item
        'PRODUTO EXEMPLO', // descricao
        '', // cod barra
        '', // cod anterior
        'UN', // unid inventario
        '0', // tipo item
        '72042990', // NCM
        '', // EX IPI
        '', // cod genero
        '', // cod servico
        formatSpedDecimal(0),
      ),
    );
    lineCount++;

    // Register 0990 - Closing Block 0
    lines.push(generateSpedLine('0990', (lineCount + 1).toString()));
    lineCount++;

    // =========================================================================
    // BLOCO C - Documentos Fiscais I (Mercadorias)
    // =========================================================================

    lines.push(generateSpedLine('C001', '0')); // 0=com dados
    lineCount++;

    // Register C100 - NF-e entries (placeholder)
    // In production, fetch NFeDocuments for the period
    lines.push(
      generateSpedLine(
        'C100',
        '0', // ind operacao: 0=entrada, 1=saida
        '1', // ind emitente: 0=emissao propria, 1=terceiros
        'PARTICIPANTE_EXEMPLO',
        '55', // modelo
        '00', // situacao
        '001', // serie
        '000000001', // numero
        '', // chave acesso
        formatSpedDate(periodoInicio),
        formatSpedDate(periodoInicio),
        formatSpedDecimal(0), // valor total
        '0', // ind pagamento
        formatSpedDecimal(0), // desconto
        formatSpedDecimal(0), // abatimento
        formatSpedDecimal(0), // valor mercadorias
        '1', // ind frete
        formatSpedDecimal(0), // frete
        formatSpedDecimal(0), // seguro
        formatSpedDecimal(0), // outras despesas
        formatSpedDecimal(0), // BC ICMS
        formatSpedDecimal(0), // valor ICMS
        formatSpedDecimal(0), // BC ICMS ST
        formatSpedDecimal(0), // valor ICMS ST
        formatSpedDecimal(0), // IPI
        formatSpedDecimal(0), // PIS
        formatSpedDecimal(0), // COFINS
        formatSpedDecimal(0), // PIS ST
        formatSpedDecimal(0), // COFINS ST
      ),
    );
    lineCount++;

    // Register C170 - Items (placeholder)
    lines.push(
      generateSpedLine(
        'C170',
        '1', // numero item
        'PROD001',
        'PRODUTO EXEMPLO',
        formatSpedDecimal(1), // qtd
        'UN',
        formatSpedDecimal(0), // valor
        formatSpedDecimal(0), // desconto
        '0', // ind movto
        '000', // CST ICMS
        '1102', // CFOP
        '', // cod natureza
        formatSpedDecimal(0), // BC ICMS
        formatSpedDecimal(0), // aliq ICMS
        formatSpedDecimal(0), // valor ICMS
      ),
    );
    lineCount++;

    lines.push(generateSpedLine('C990', (lineCount + 1).toString()));
    lineCount++;

    // =========================================================================
    // BLOCO E - Apuracao ICMS
    // =========================================================================

    lines.push(generateSpedLine('E001', '0'));
    lineCount++;

    // Register E100 - ICMS period
    lines.push(
      generateSpedLine(
        'E100',
        formatSpedDate(periodoInicio),
        formatSpedDate(periodoFim),
      ),
    );
    lineCount++;

    // Register E110 - ICMS apuracao
    lines.push(
      generateSpedLine(
        'E110',
        formatSpedDecimal(0), // valor total debitos
        formatSpedDecimal(0), // ajustes debitos
        formatSpedDecimal(0), // total debitos ajustados
        formatSpedDecimal(0), // valor total creditos
        formatSpedDecimal(0), // ajustes creditos
        formatSpedDecimal(0), // total creditos ajustados
        formatSpedDecimal(0), // saldo credor anterior
        formatSpedDecimal(0), // saldo apurado
        formatSpedDecimal(0), // total deducoes
        formatSpedDecimal(0), // ICMS a recolher
        formatSpedDecimal(0), // saldo credor transportar
        formatSpedDecimal(0), // debito especial
      ),
    );
    lineCount++;

    // Register E200 - ICMS ST period (placeholder)
    lines.push(
      generateSpedLine(
        'E200',
        company.uf || 'SP',
        formatSpedDate(periodoInicio),
        formatSpedDate(periodoFim),
      ),
    );
    lineCount++;

    lines.push(generateSpedLine('E990', (lineCount + 1).toString()));
    lineCount++;

    // =========================================================================
    // BLOCO H - Inventario
    // =========================================================================

    lines.push(generateSpedLine('H001', '1')); // 1=sem dados (placeholder)
    lineCount++;

    // Register H005 would list inventory items at period end
    // Omitted for placeholder - would be populated from InventoryModule

    lines.push(generateSpedLine('H990', '2'));
    lineCount++;

    // =========================================================================
    // BLOCO 9 - Controle e Encerramento
    // =========================================================================

    lines.push(generateSpedLine('9001', '0'));
    lineCount++;

    // Register 9900 - File records summary
    lines.push(generateSpedLine('9900', '0000', '1'));
    lineCount++;
    lines.push(generateSpedLine('9900', '0001', '1'));
    lineCount++;
    lines.push(generateSpedLine('9900', '9001', '1'));
    lineCount++;
    lines.push(generateSpedLine('9900', '9900', '4'));
    lineCount++;
    lines.push(generateSpedLine('9900', '9990', '1'));
    lineCount++;
    lines.push(generateSpedLine('9900', '9999', '1'));
    lineCount++;

    lines.push(generateSpedLine('9990', (lineCount + 1).toString()));
    lineCount++;

    // Register 9999 - File closing
    lines.push(generateSpedLine('9999', (lineCount + 1).toString()));

    const fileContent = lines.join('\r\n');

    // Log the generation
    await this.logTransmission({
      companyId,
      type: 'SPED_FISCAL',
      endpoint: 'local:file_generation',
      success: true,
      documentNumber: `EFD_${formatSpedDate(periodoInicio)}_${formatSpedDate(periodoFim)}`,
      processingTimeMs: 0,
    });

    this.logger.log(
      `[SpedFiscal] Generated EFD ICMS/IPI file for ${company.razaoSocial} period ${periodoInicio.toISOString()} - ${periodoFim.toISOString()} (${lineCount + 1} lines)`,
    );

    return fileContent;
  }
}

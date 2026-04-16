import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GovernmentTransmissionService } from '../government-transmission.service';
import {
  generateSpedLine,
  formatSpedDecimal,
  formatSpedDate,
} from './sped-file-header';

/**
 * Escrituracao Contabil Digital (ECD / SPED Contabil) file generation service.
 * Generates digital accounting books (Diario, Razao, Balancetes).
 */
@Injectable()
export class EcdService extends GovernmentTransmissionService {
  private static readonly LAYOUT_VERSION = '010';

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly configService: ConfigService,
  ) {
    super(prisma, configService);
  }

  /**
   * Generate the ECD file for a given fiscal year.
   */
  async generateFile(
    companyId: string,
    anoReferencia: number,
  ): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error(`Company ${companyId} not found`);
    }

    const dtIni = new Date(anoReferencia, 0, 1);
    const dtFim = new Date(anoReferencia, 11, 31);
    const lines: string[] = [];

    // =========================================================================
    // BLOCO 0 - Abertura
    // =========================================================================

    // Register 0000 - Header (ECD has slightly different format)
    lines.push(
      generateSpedLine(
        '0000',
        'LECD', // tipo arquivo
        EcdService.LAYOUT_VERSION,
        '', // hash
        formatSpedDate(dtIni),
        formatSpedDate(dtFim),
        company.razaoSocial,
        company.cnpj,
        company.uf || 'SP',
        company.inscricaoEstadual || '',
        company.codigoMunicipioIbge || '3550308',
        '', // IM
        '0', // ind situacao especial
        '0', // ind sit ini periodo
        '0', // ind NIRE
        '0', // ind finalidade
        '', // hash substituto
        '0', // ind grande porte
      ),
    );

    lines.push(generateSpedLine('0001', '0'));

    lines.push(generateSpedLine('0990', '3'));

    // =========================================================================
    // BLOCO I - Lancamentos Contabeis
    // =========================================================================

    lines.push(generateSpedLine('I001', '0'));

    // Register I010 - Identification of the accounting book
    lines.push(
      generateSpedLine(
        'I010',
        'G', // G=Diario Geral, R=Razao, A=Diario Auxiliar, Z=Razao Auxiliar, B=Balancete
        '2.00', // versao plano referencial
      ),
    );

    // Register I050 - Chart of accounts (placeholder)
    // In production, fetch from ChartOfAccount model
    lines.push(
      generateSpedLine(
        'I050',
        formatSpedDate(dtIni),
        '01', // cod natureza: 01=ativo, 02=passivo, 03=PL, 04=receita, 05=despesa
        'S', // tipo conta: S=sintetica, A=analitica
        '1', // nivel
        '1', // codigo
        '', // cod CTA superior
        'ATIVO',
      ),
    );
    lines.push(
      generateSpedLine(
        'I050',
        formatSpedDate(dtIni),
        '01',
        'A',
        '2',
        '1.1',
        '1',
        'ATIVO CIRCULANTE',
      ),
    );
    lines.push(
      generateSpedLine(
        'I050',
        formatSpedDate(dtIni),
        '01',
        'A',
        '3',
        '1.1.01',
        '1.1',
        'CAIXA E EQUIVALENTES',
      ),
    );
    lines.push(
      generateSpedLine(
        'I050',
        formatSpedDate(dtIni),
        '02',
        'S',
        '1',
        '2',
        '',
        'PASSIVO',
      ),
    );
    lines.push(
      generateSpedLine(
        'I050',
        formatSpedDate(dtIni),
        '03',
        'S',
        '1',
        '3',
        '',
        'PATRIMONIO LIQUIDO',
      ),
    );
    lines.push(
      generateSpedLine(
        'I050',
        formatSpedDate(dtIni),
        '04',
        'S',
        '1',
        '4',
        '',
        'RECEITAS',
      ),
    );
    lines.push(
      generateSpedLine(
        'I050',
        formatSpedDate(dtIni),
        '05',
        'S',
        '1',
        '5',
        '',
        'DESPESAS',
      ),
    );

    // Register I150 - Period identification
    lines.push(
      generateSpedLine(
        'I150',
        formatSpedDate(dtIni),
        formatSpedDate(dtFim),
      ),
    );

    // Register I200 - Journal entries (placeholder)
    // In production, fetch from JournalEntry model
    lines.push(
      generateSpedLine(
        'I200',
        '00001', // numero lancamento
        formatSpedDate(dtIni),
        formatSpedDecimal(0), // valor lancamento
        'N', // ind lancamento: N=normal, E=encerramento, X=especial
      ),
    );

    // Register I250 - Journal entry items (placeholder)
    lines.push(
      generateSpedLine(
        'I250',
        '1.1.01', // cod conta debito
        '4', // cod conta credito
        formatSpedDecimal(0),
        'D', // indicador D/C
        '00001', // numero lancamento
        '', // cod historico
        'LANCAMENTO EXEMPLO',
      ),
    );

    // =========================================================================
    // BLOCO J - Demonstracoes Contabeis
    // =========================================================================

    // Register J005 - Trial balance header
    lines.push(
      generateSpedLine(
        'J005',
        formatSpedDate(dtFim),
        '', // ID escrituracao
        'BALANCETE VERIFICACAO', // nome
      ),
    );

    // Register J100 - Balance sheet (placeholder)
    lines.push(
      generateSpedLine(
        'J100',
        '1.1.01',
        'CAIXA E EQUIVALENTES',
        '3', // nivel
        'A', // tipo conta
        '01', // cod natureza
        formatSpedDecimal(0), // saldo inicial
        'D', // indicador saldo inicial
        formatSpedDecimal(0), // saldo final
        'D', // indicador saldo final
      ),
    );

    lines.push(generateSpedLine('I990', (lines.length + 1).toString()));

    // =========================================================================
    // BLOCO 9 - Encerramento
    // =========================================================================

    lines.push(generateSpedLine('9001', '0'));
    lines.push(generateSpedLine('9900', '0000', '1'));
    lines.push(generateSpedLine('9900', 'I001', '1'));
    lines.push(generateSpedLine('9900', 'I010', '1'));
    lines.push(generateSpedLine('9900', '9001', '1'));
    lines.push(generateSpedLine('9900', '9900', '5'));
    lines.push(generateSpedLine('9900', '9990', '1'));
    lines.push(generateSpedLine('9900', '9999', '1'));
    lines.push(generateSpedLine('9990', (lines.length + 2).toString()));
    lines.push(generateSpedLine('9999', (lines.length + 1).toString()));

    const fileContent = lines.join('\r\n');

    await this.logTransmission({
      companyId,
      type: 'ECD',
      endpoint: 'local:file_generation',
      success: true,
      documentNumber: `ECD_${anoReferencia}`,
      processingTimeMs: 0,
    });

    this.logger.log(
      `[ECD] Generated ECD file for ${company.razaoSocial} year ${anoReferencia} (${lines.length} lines)`,
    );

    return fileContent;
  }
}

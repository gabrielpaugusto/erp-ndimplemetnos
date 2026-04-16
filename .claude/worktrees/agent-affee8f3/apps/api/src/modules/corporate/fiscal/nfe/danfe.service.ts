import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import * as PdfPrinter from 'pdfmake';
import { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

// pdfmake requer fontes embutidas — usando Roboto (padrão)
const fonts = {
  Roboto: {
    normal: 'node_modules/pdfmake/build/vfs_fonts.js',
    bold: 'node_modules/pdfmake/build/vfs_fonts.js',
    italics: 'node_modules/pdfmake/build/vfs_fonts.js',
    bolditalics: 'node_modules/pdfmake/build/vfs_fonts.js',
  },
};

function fmtMoeda(v: number | null | undefined): string {
  if (v == null) return '0,00';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQtd(v: number | null | undefined): string {
  if (v == null) return '0';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function fmtCnpj(v: string | null | undefined): string {
  if (!v) return '';
  const d = v.replace(/\D/g, '');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return v;
}

function fmtCep(v: string | null | undefined): string {
  if (!v) return '';
  const d = v.replace(/\D/g, '');
  return d.replace(/(\d{5})(\d{3})/, '$1-$2');
}

function labelValue(label: string, value: string, labelSize = 6, valueSize = 8): Content {
  return {
    stack: [
      { text: label, style: 'fieldLabel' },
      { text: value || ' ', style: 'fieldValue', fontSize: valueSize },
    ],
  };
}

@Injectable()
export class DanfeService {
  constructor(private readonly prisma: PrismaService) {}

  async generateDanfe(nfeId: string): Promise<Buffer> {
    const nfe = await this.prisma.nFeDocument.findUnique({
      where: { id: nfeId },
      include: {
        company: true,
        person: {
          include: { addresses: { take: 1 } },
        },
        items: { orderBy: { itemNumber: 'asc' } },
      },
    });

    if (!nfe) throw new NotFoundException(`NF-e ${nfeId} não encontrada`);

    const emit = nfe.company;
    const dest = nfe.person;
    const destAddr = dest.addresses?.[0];

    const dataEmissao = nfe.dataEmissao
      ? new Date(nfe.dataEmissao).toLocaleDateString('pt-BR')
      : '---';

    const numero = nfe.numero
      ? nfe.numero.toString().padStart(9, '0')
      : 'RASCUNHO';

    const serie = (nfe.serie || 1).toString().padStart(3, '0');

    const chave = nfe.chaveAcesso || ''.padStart(44, '0');
    const chaveFormatada = chave.replace(/(\d{4})/g, '$1 ').trim();

    // ─── Helpers de layout ────────────────────────────────────────────────
    const header = (): Content => ({
      table: {
        widths: ['*', 180, 80],
        body: [
          [
            // Emitente
            {
              stack: [
                { text: emit.nomeFantasia || emit.razaoSocial, style: 'emitNome', fontSize: 11 },
                { text: emit.razaoSocial, style: 'emitRazao', fontSize: 8 },
                {
                  text: [
                    emit.logradouro || '',
                    emit.numero ? `, ${emit.numero}` : '',
                    emit.bairro ? ` - ${emit.bairro}` : '',
                  ].join(''),
                  fontSize: 7,
                },
                {
                  text: [
                    emit.municipio || '',
                    emit.uf ? ` - ${emit.uf}` : '',
                    emit.cep ? `  CEP: ${fmtCep(emit.cep)}` : '',
                  ].join(''),
                  fontSize: 7,
                },
                { text: emit.telefone ? `Fone: ${emit.telefone}` : '', fontSize: 7 },
                { text: `CNPJ: ${fmtCnpj(emit.cnpj)}`, fontSize: 7 },
                { text: `IE: ${emit.inscricaoEstadual || 'N/A'}`, fontSize: 7 },
              ],
              margin: [2, 2, 2, 2],
            },
            // DANFE central
            {
              stack: [
                { text: 'DANFE', style: 'danfeTitle', alignment: 'center' },
                {
                  text: 'Documento Auxiliar da\nNota Fiscal Eletrônica',
                  fontSize: 7,
                  alignment: 'center',
                },
                { text: ' ', fontSize: 4 },
                {
                  columns: [
                    { text: '0 - ENTRADA', fontSize: 7, alignment: 'center' },
                    {
                      canvas: [
                        {
                          type: 'rect',
                          x: 10, y: 0, w: 20, h: 20,
                          lineWidth: 1,
                        },
                      ],
                      width: 40,
                    },
                    { text: '1 - SAÍDA', fontSize: 7, alignment: 'center' },
                  ],
                },
                { text: ' ', fontSize: 4 },
                { text: `Nº ${numero}`, fontSize: 10, bold: true, alignment: 'center' },
                { text: `Série ${serie}`, fontSize: 8, alignment: 'center' },
              ],
              margin: [2, 2, 2, 2],
            },
            // Folha
            {
              stack: [
                { text: 'Folha', fontSize: 7 },
                { text: '1/1', fontSize: 9, bold: true },
              ],
              margin: [2, 2, 2, 2],
            },
          ],
        ],
      },
      layout: 'lightHorizontalLines',
    });

    const chaveAcessoSection = (): Content => ({
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                { text: 'CHAVE DE ACESSO', style: 'fieldLabel' },
                { text: chaveFormatada, style: 'chave', alignment: 'center' },
                { text: ' ', fontSize: 4 },
                {
                  text: 'Consulta de autenticidade no portal nacional da NF-e: www.nfe.fazenda.gov.br',
                  fontSize: 6,
                  alignment: 'center',
                  italics: true,
                },
              ],
              margin: [4, 3, 4, 3],
            },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 2, 0, 0],
    });

    const naturezaSection = (): Content => ({
      table: {
        widths: ['*', 'auto', 'auto'],
        body: [
          [
            {
              stack: [
                { text: 'NATUREZA DA OPERAÇÃO', style: 'fieldLabel' },
                { text: nfe.naturezaOperacao || '', style: 'fieldValue' },
              ],
              margin: [2, 1, 2, 1],
            },
            {
              stack: [
                { text: 'PROTOCOLO DE AUTORIZAÇÃO', style: 'fieldLabel' },
                { text: nfe.protocoloAutorizacao || (nfe.status === 'RASCUNHO' ? 'RASCUNHO' : '---'), style: 'fieldValue' },
              ],
              margin: [2, 1, 2, 1],
            },
            {
              stack: [
                { text: 'DATA/HORA AUTORIZAÇÃO', style: 'fieldLabel' },
                {
                  text: nfe.dataAutorizacao
                    ? new Date(nfe.dataAutorizacao).toLocaleString('pt-BR')
                    : '---',
                  style: 'fieldValue',
                },
              ],
              margin: [2, 1, 2, 1],
            },
          ],
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 2, 0, 0],
    });

    const emitSection = (): Content => ({
      table: {
        widths: ['*', 'auto', 'auto', 'auto'],
        body: [
          [
            {
              text: 'EMITENTE',
              colSpan: 4,
              style: 'sectionTitle',
              fillColor: '#e5e7eb',
              margin: [2, 1, 2, 1],
            },
            {}, {}, {},
          ],
          [
            {
              stack: [
                { text: 'CNPJ', style: 'fieldLabel' },
                { text: fmtCnpj(emit.cnpj), style: 'fieldValue' },
              ],
              margin: [2, 1, 2, 1],
            },
            {
              stack: [
                { text: 'DATA DE EMISSÃO', style: 'fieldLabel' },
                { text: dataEmissao, style: 'fieldValue' },
              ],
              margin: [2, 1, 2, 1],
            },
            {
              stack: [
                { text: 'IE', style: 'fieldLabel' },
                { text: emit.inscricaoEstadual || 'N/A', style: 'fieldValue' },
              ],
              margin: [2, 1, 2, 1],
            },
            {
              stack: [
                { text: 'DATA SAÍDA/ENTRADA', style: 'fieldLabel' },
                {
                  text: nfe.dataEntradaSaida
                    ? new Date(nfe.dataEntradaSaida).toLocaleDateString('pt-BR')
                    : dataEmissao,
                  style: 'fieldValue',
                },
              ],
              margin: [2, 1, 2, 1],
            },
          ],
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 2, 0, 0],
    });

    const destSection = (): Content => ({
      table: {
        widths: ['*', 'auto', 'auto'],
        body: [
          [
            {
              text: 'DESTINATÁRIO / REMETENTE',
              colSpan: 3,
              style: 'sectionTitle',
              fillColor: '#e5e7eb',
              margin: [2, 1, 2, 1],
            },
            {}, {},
          ],
          [
            {
              stack: [
                { text: 'NOME / RAZÃO SOCIAL', style: 'fieldLabel' },
                { text: dest.razaoSocial || '', style: 'fieldValue' },
              ],
              margin: [2, 1, 2, 1],
            },
            {
              stack: [
                { text: 'CNPJ / CPF', style: 'fieldLabel' },
                { text: fmtCnpj(dest.cpfCnpj), style: 'fieldValue' },
              ],
              margin: [2, 1, 2, 1],
            },
            {
              stack: [
                { text: 'DATA EMISSÃO', style: 'fieldLabel' },
                { text: dataEmissao, style: 'fieldValue' },
              ],
              margin: [2, 1, 2, 1],
            },
          ],
          [
            {
              stack: [
                { text: 'ENDEREÇO', style: 'fieldLabel' },
                {
                  text: destAddr
                    ? `${destAddr.logradouro || ''}, ${destAddr.numero || ''} ${destAddr.complemento || ''}`
                    : '---',
                  style: 'fieldValue',
                },
              ],
              margin: [2, 1, 2, 1],
            },
            {
              stack: [
                { text: 'BAIRRO / DISTRITO', style: 'fieldLabel' },
                { text: destAddr?.bairro || '---', style: 'fieldValue' },
              ],
              margin: [2, 1, 2, 1],
            },
            {
              stack: [
                { text: 'CEP', style: 'fieldLabel' },
                { text: fmtCep(destAddr?.cep), style: 'fieldValue' },
              ],
              margin: [2, 1, 2, 1],
            },
          ],
          [
            {
              stack: [
                { text: 'MUNICÍPIO', style: 'fieldLabel' },
                { text: destAddr?.municipio || '---', style: 'fieldValue' },
              ],
              margin: [2, 1, 2, 1],
            },
            {
              stack: [
                { text: 'UF', style: 'fieldLabel' },
                { text: destAddr?.uf || '---', style: 'fieldValue' },
              ],
              margin: [2, 1, 2, 1],
            },
            {
              stack: [
                { text: 'IE', style: 'fieldLabel' },
                { text: dest.rgIe || 'ISENTO', style: 'fieldValue' },
              ],
              margin: [2, 1, 2, 1],
            },
          ],
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 2, 0, 0],
    });

    const itensSection = (): Content => {
      const colWidths = [20, '*', 30, 25, 30, 35, 35, 25, 30, 35];
      const headerRow = [
        { text: 'Nº', style: 'tableHeader' },
        { text: 'DESCRIÇÃO DO PRODUTO / SERVIÇO', style: 'tableHeader' },
        { text: 'NCM/SH', style: 'tableHeader' },
        { text: 'CFOP', style: 'tableHeader' },
        { text: 'UN', style: 'tableHeader' },
        { text: 'QTD', style: 'tableHeader' },
        { text: 'VL UNIT', style: 'tableHeader' },
        { text: 'VL DESC', style: 'tableHeader' },
        { text: 'VL TOTAL', style: 'tableHeader' },
        { text: 'CST/CSOSN', style: 'tableHeader' },
      ];

      const dataRows = nfe.items.map((item) => [
        { text: item.itemNumber.toString(), style: 'tableCell', alignment: 'center' },
        { text: item.description || '', style: 'tableCell' },
        { text: item.ncmCode || '', style: 'tableCell', alignment: 'center' },
        { text: item.cfopCode || '', style: 'tableCell', alignment: 'center' },
        { text: item.unit || 'UN', style: 'tableCell', alignment: 'center' },
        { text: fmtQtd(item.quantity), style: 'tableCell', alignment: 'right' },
        { text: fmtMoeda(item.unitPrice), style: 'tableCell', alignment: 'right' },
        { text: fmtMoeda(0), style: 'tableCell', alignment: 'right' },
        { text: fmtMoeda(item.totalPrice), style: 'tableCell', alignment: 'right' },
        { text: item.cstIcms || '---', style: 'tableCell', alignment: 'center' },
      ]);

      return {
        margin: [0, 2, 0, 0],
        table: {
          headerRows: 2,
          widths: colWidths,
          body: [
            [
              {
                text: 'DADOS DOS PRODUTOS / SERVIÇOS',
                colSpan: 10,
                style: 'sectionTitle',
                fillColor: '#e5e7eb',
                margin: [2, 1, 2, 1],
              },
              {}, {}, {}, {}, {}, {}, {}, {}, {},
            ],
            headerRow,
            ...dataRows,
          ],
        },
        layout: 'lightHorizontalLines',
      };
    };

    const impostosSection = (): Content => (({
      table: {
        widths: ['*', '*', '*', '*', '*', '*', '*', '*'],
        body: [
          [
            {
              text: 'CÁLCULO DO IMPOSTO',
              colSpan: 8,
              style: 'sectionTitle',
              fillColor: '#e5e7eb',
              margin: [2, 1, 2, 1],
            },
            {}, {}, {}, {}, {}, {}, {},
          ],
          [
            labelValue('BASE CÁLC. ICMS', `R$ ${fmtMoeda(nfe.valorProdutos)}`),
            labelValue('VALOR ICMS', `R$ ${fmtMoeda(nfe.valorIcms)}`),
            labelValue('BASE CÁLC. ICMS ST', `R$ ${fmtMoeda(0)}`),
            labelValue('VALOR ICMS ST', `R$ ${fmtMoeda(nfe.valorIcmsSt)}`),
            labelValue('VALOR IPI', `R$ ${fmtMoeda(nfe.valorIpi)}`),
            labelValue('VALOR PIS', `R$ ${fmtMoeda(nfe.valorPis)}`),
            labelValue('VALOR COFINS', `R$ ${fmtMoeda(nfe.valorCofins)}`),
            labelValue('VALOR TOTAL NF-e', `R$ ${fmtMoeda(nfe.valorTotal)}`, 6, 10),
          ].map((c) => ({ ...(c as object), margin: [2, 2, 2, 2] })),
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 2, 0, 0],
    }) as Content);

    const totaisSection = (): Content => (({
      table: {
        widths: ['*', '*', '*', '*', '*', '*'],
        body: [
          [
            {
              text: 'TOTAIS',
              colSpan: 6,
              style: 'sectionTitle',
              fillColor: '#e5e7eb',
              margin: [2, 1, 2, 1],
            },
            {}, {}, {}, {}, {},
          ],
          [
            labelValue('VL PRODUTOS', `R$ ${fmtMoeda(nfe.valorProdutos)}`),
            labelValue('VL FRETE', `R$ ${fmtMoeda(nfe.valorFrete)}`),
            labelValue('VL SEGURO', `R$ ${fmtMoeda(nfe.valorSeguro)}`),
            labelValue('DESCONTO', `R$ ${fmtMoeda(nfe.valorDesconto)}`),
            labelValue('OUTRAS DESP.', `R$ ${fmtMoeda(nfe.valorOutros)}`),
            labelValue('VALOR TOTAL NF-e', `R$ ${fmtMoeda(nfe.valorTotal)}`, 6, 10),
          ].map((c) => ({ ...(c as object), margin: [2, 2, 2, 2] })),
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 2, 0, 0],
    }) as Content);

    const infoAdicionaisSection = (): Content => ({
      table: {
        widths: ['*'],
        body: [
          [
            {
              text: 'INFORMAÇÕES ADICIONAIS',
              style: 'sectionTitle',
              fillColor: '#e5e7eb',
              margin: [2, 1, 2, 1],
            },
          ],
          [
            {
              text: nfe.informacoesComplementares || ' ',
              fontSize: 7,
              margin: [4, 4, 4, 4],
            },
          ],
        ],
      },
      layout: 'lightHorizontalLines',
      margin: [0, 2, 0, 0],
    });

    // ─── Watermark para rascunho ────────────────────────────────────────
    const isRascunho = nfe.status === 'RASCUNHO' || nfe.status === 'VALIDADA';

    // ─── Document definition ──────────────────────────────────────────
    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [20, 20, 20, 20],
      watermark: isRascunho
        ? { text: 'SEM VALOR FISCAL', opacity: 0.08, bold: true, fontSize: 52, angle: -45 }
        : undefined,
      styles: {
        danfeTitle: { fontSize: 14, bold: true },
        emitNome: { bold: true },
        emitRazao: { italics: true },
        sectionTitle: { fontSize: 7, bold: true },
        fieldLabel: { fontSize: 5, color: '#666666' },
        fieldValue: { fontSize: 8 },
        tableHeader: { fontSize: 6, bold: true, fillColor: '#f3f4f6', alignment: 'center' },
        tableCell: { fontSize: 7 },
        chave: { fontSize: 8, bold: true, font: 'Courier' },
      },
      content: [
        header(),
        chaveAcessoSection(),
        naturezaSection(),
        emitSection(),
        destSection(),
        itensSection(),
        impostosSection(),
        totaisSection(),
        infoAdicionaisSection(),
      ],
      footer: (currentPage, pageCount) => ({
        text: `Página ${currentPage} de ${pageCount}  —  NF-e Nº ${numero}  Série ${serie}  —  Emitido em ${dataEmissao}`,
        alignment: 'center',
        fontSize: 6,
        margin: [20, 0, 20, 0],
      }),
    };

    return this.createPdfBuffer(docDefinition);
  }

  private createPdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Carrega VFS (Virtual File System) do pdfmake com as fontes embutidas
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfMakeFonts = require('pdfmake/build/vfs_fonts');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const PdfPrinterClass = require('pdfmake/build/pdfmake');
        PdfPrinterClass.vfs = pdfMakeFonts.pdfMake.vfs;

        const pdfDoc = PdfPrinterClass.createPdf(docDefinition);
        const chunks: Buffer[] = [];

        pdfDoc.getBuffer((buffer: Buffer) => {
          resolve(buffer);
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

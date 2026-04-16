"use strict";
const fs = require("fs");
const path = require("path");

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TableOfContents,
} = require("C:/Users/Microsoft/AppData/Roaming/npm/node_modules/docx");

// ─── Colours ─────────────────────────────────────────────────────────────────
const C_HEADING1  = "1F3864";
const C_HEADING2  = "2E74B5";
const C_HEADING3  = "404040";
const C_TBL_HEAD  = "1F3864";
const C_TBL_ALT   = "D9E2F3";
const C_WARN_BG   = "FFF2CC";
const C_WARN_BORD = "ED7D31";
const C_CODE_BG   = "F2F2F2";

// ─── Page / margin constants (A4 in DXA, 1440 DXA = 1 inch = 2.54 cm) ────────
// A4: 11906 × 16838 DXA  |  2.5 cm margin = ~1417 DXA
const PAGE_W   = 11906;
const PAGE_H   = 16838;
const MARGIN   = 1417;
const CONTENT_W = PAGE_W - MARGIN * 2;   // ≈ 9072 DXA

// ─── Numbering config ─────────────────────────────────────────────────────────
const numbering = {
  config: [
    {
      reference: "bullets",
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
      ],
    },
    {
      reference: "checklist",
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u25A1", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ],
    },
    ...Array.from({ length: 30 }, (_, i) => ({
      reference: `numbered-${i}`,
      levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ],
    })),
  ],
};

// ─── Style helpers ────────────────────────────────────────────────────────────
let _numCounter = 0;
function nextNumRef() { return `numbered-${_numCounter++}`; }

function h1(text, bookmarkId) {
  const children = bookmarkId
    ? [new TextRun({ text, bold: true, font: "Arial", size: 32, color: C_HEADING1 })]
    : [new TextRun({ text, bold: true, font: "Arial", size: 32, color: C_HEADING1 })];
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    spacing: { before: 400, after: 200 },
    children,
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 26, color: C_HEADING2 })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 22, color: C_HEADING3 })],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 100, after: 100 },
    children: [new TextRun({ text, font: "Arial", size: 22, ...opts })],
  });
}

function paraRuns(runs, extraProps = {}) {
  return new Paragraph({
    spacing: { before: 100, after: 100 },
    ...extraProps,
    children: runs.map(r =>
      typeof r === "string"
        ? new TextRun({ text: r, font: "Arial", size: 22 })
        : new TextRun({ font: "Arial", size: 22, ...r })
    ),
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 22 })],
  });
}

function bulletRuns(runs, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 60, after: 60 },
    children: runs.map(r =>
      typeof r === "string"
        ? new TextRun({ text: r, font: "Arial", size: 22 })
        : new TextRun({ font: "Arial", size: 22, ...r })
    ),
  });
}

function numbered(text, ref) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 22 })],
  });
}

function numberedRuns(runs, ref) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { before: 80, after: 80 },
    children: runs.map(r =>
      typeof r === "string"
        ? new TextRun({ text: r, font: "Arial", size: 22 })
        : new TextRun({ font: "Arial", size: 22, ...r })
    ),
  });
}

function checkItem(text) {
  return new Paragraph({
    numbering: { reference: "checklist", level: 0 },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 22 })],
  });
}

function spacer(lines = 1) {
  return Array.from({ length: lines }, () => new Paragraph({ children: [] }));
}

// Warning / alert box
function warnBox(lines) {
  const border = { style: BorderStyle.SINGLE, size: 12, color: C_WARN_BORD };
  return lines.map((line, i) =>
    new Paragraph({
      spacing: { before: i === 0 ? 120 : 0, after: i === lines.length - 1 ? 120 : 0 },
      border: {
        top:    i === 0              ? border : { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: i === lines.length-1 ? border : { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left:   border,
        right:  border,
      },
      shading: { fill: C_WARN_BG, type: ShadingType.CLEAR, color: "auto" },
      children: [new TextRun({ text: line, font: "Arial", size: 22 })],
    })
  );
}

// Code block
function codeBlock(lines) {
  const border = { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };
  return lines.map((line, i) =>
    new Paragraph({
      spacing: { before: i === 0 ? 100 : 0, after: i === lines.length - 1 ? 100 : 0 },
      border: {
        top:    i === 0              ? border : { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: i === lines.length-1 ? border : { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left:   border,
        right:  border,
      },
      shading: { fill: C_CODE_BG, type: ShadingType.CLEAR, color: "auto" },
      children: [new TextRun({ text: line, font: "Courier New", size: 18 })],
    })
  );
}

// ─── Table helpers ────────────────────────────────────────────────────────────
function tblBorder(color = "CCCCCC") {
  const b = { style: BorderStyle.SINGLE, size: 6, color };
  return { top: b, bottom: b, left: b, right: b };
}

function makeCell(text, opts = {}) {
  const {
    bold = false, color = "000000", bgColor = "FFFFFF",
    colSpan, width, verticalAlign = VerticalAlign.CENTER,
    isHeader = false,
  } = opts;
  const textColor = isHeader ? "FFFFFF" : color;
  const bg = isHeader ? C_TBL_HEAD : bgColor;
  return new TableCell({
    borders: tblBorder("CCCCCC"),
    shading: { fill: bg, type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign,
    ...(width !== undefined ? { width: { size: width, type: WidthType.DXA } } : {}),
    ...(colSpan !== undefined ? { columnSpan: colSpan } : {}),
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({
        text: String(text),
        font: "Arial",
        size: isHeader ? 20 : 20,
        bold: isHeader || bold,
        color: textColor,
      })],
    })],
  });
}

function makeRow(cells, isHeader = false, isAlt = false) {
  return new TableRow({
    tableHeader: isHeader,
    children: cells.map((c, i) => {
      if (typeof c === "string") {
        return makeCell(c, { isHeader, bgColor: isAlt ? C_TBL_ALT : "FFFFFF" });
      }
      return makeCell(c.text ?? c.v ?? "", {
        isHeader,
        bgColor: isHeader ? C_TBL_HEAD : (isAlt ? C_TBL_ALT : "FFFFFF"),
        bold: c.bold,
        width: c.width,
        colSpan: c.colSpan,
        ...c,
      });
    }),
  });
}

function makeTable(headers, rows, colWidths) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      makeRow(
        headers.map((h, i) => ({ text: h, width: colWidths[i] })),
        true
      ),
      ...rows.map((row, rowIdx) =>
        makeRow(
          row.map((cell, i) => {
            if (typeof cell === "string") return { text: cell, width: colWidths[i] };
            return { ...cell, width: colWidths[i] };
          }),
          false,
          rowIdx % 2 === 1
        )
      ),
    ],
  });
}

// ─── Header / Footer ─────────────────────────────────────────────────────────
function makeHeader() {
  return new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C_HEADING2, space: 4 } },
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: "Manual do Projetista \u2014 SolidWorks para ERP | ND Implementos",
            font: "Arial", size: 18, color: C_HEADING2, italics: true,
          }),
        ],
      }),
    ],
  });
}

function makeFooter() {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 4 } },
        alignment: AlignmentType.CENTER,
        spacing: { before: 80 },
        children: [
          new TextRun({ text: "v1.0 \u2014 Mar\u00e7o 2026 | Confidencial     P\u00e1gina ", font: "Arial", size: 18, color: "888888" }),
          new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: "888888" }),
          new TextRun({ text: " de ", font: "Arial", size: 18, color: "888888" }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 18, color: "888888" }),
        ],
      }),
    ],
  });
}

// ─── Section properties ───────────────────────────────────────────────────────
const sectionProps = {
  page: {
    size: { width: PAGE_W, height: PAGE_H },
    margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  DOCUMENT CONTENT
// ═══════════════════════════════════════════════════════════════════════════════

// ─── CAPA ────────────────────────────────────────────────────────────────────
function coverSection() {
  return [
    ...spacer(6),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: "ND Implementos", font: "Arial", size: 32, bold: true, color: C_HEADING1 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 400 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 18, color: C_HEADING2, space: 8 },
        top:    { style: BorderStyle.SINGLE, size: 18, color: C_HEADING2, space: 8 },
      },
      shading: { fill: "EBF3FB", type: ShadingType.CLEAR },
      children: [new TextRun({ text: "", font: "Arial", size: 10 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 160 },
      children: [new TextRun({
        text: "Manual do Projetista \u2014 SolidWorks para ERP",
        font: "Arial", size: 48, bold: true, color: C_HEADING1,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 320 },
      children: [new TextRun({
        text: "Configura\u00e7\u00e3o e Exporta\u00e7\u00e3o da Lista de Materiais (BOM)",
        font: "Arial", size: 30, italics: true, color: C_HEADING2,
      })],
    }),
    ...spacer(3),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 100 },
      children: [new TextRun({ text: "Empresa: ND Implementos", font: "Arial", size: 24, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 100 },
      children: [new TextRun({ text: "Vers\u00e3o: 1.0", font: "Arial", size: 24 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 100 },
      children: [new TextRun({ text: "Data: Mar\u00e7o / 2026", font: "Arial", size: 24 })],
    }),
  ];
}

// ─── SUMÁRIO ──────────────────────────────────────────────────────────────────
function tocSection() {
  return [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      spacing: { before: 200, after: 400 },
      children: [new TextRun({ text: "Sum\u00e1rio", font: "Arial", size: 36, bold: true, color: C_HEADING1 })],
    }),
    new TableOfContents("Sum\u00e1rio", {
      hyperlink: true,
      headingStyleRange: "1-3",
      stylesWithLevels: [
        { styleName: "Heading 1", level: 1 },
        { styleName: "Heading 2", level: 2 },
        { styleName: "Heading 3", level: 3 },
      ],
    }),
  ];
}

// ─── CAPÍTULO 1 ───────────────────────────────────────────────────────────────
function chapter1() {
  const n1 = nextNumRef(), n2 = nextNumRef(), n3 = nextNumRef();
  return [
    h1("Cap\u00edtulo 1 \u2014 Estrutura de Projeto no SolidWorks"),
    h2("1.1 Conceitos Fundamentais"),
    para("O SolidWorks organiza o trabalho de engenharia em tr\u00eas tipos b\u00e1sicos de arquivo, cada um com fun\u00e7\u00e3o espec\u00edfica dentro do fluxo de desenvolvimento de produto:"),
    ...spacer(1),
    bulletRuns([{ text: "Part (.SLDPRT)", bold: true }, " \u2014 Pe\u00e7a individual. Representa um componente \u00fanico fabricado ou comprado. Exemplos: chapa lateral, cantoneira, parafuso, eixo."]),
    bulletRuns([{ text: "Assembly (.SLDASM)", bold: true }, " \u2014 Conjunto de pe\u00e7as. Re\u00fane m\u00faltiplos arquivos Part (e outros Assemblies) em um produto completo. Exemplos: chassi completo, carroceria, conjunto de suspenss\u00e3o."]),
    bulletRuns([{ text: "Drawing (.SLDDRW)", bold: true }, " \u2014 Desenho t\u00e9cnico. Gera vistas ortogonais, cotas, notas e a tabela de materiais (BOM) a partir de um Part ou Assembly."]),
    ...spacer(1),
    para("A compreens\u00e3o dessa hierarquia \u00e9 fundamental para que a Lista de Materiais (BOM) gerada para o ERP reflita corretamente todos os componentes do projeto."),

    h2("1.2 Organiza\u00e7\u00e3o de Pastas (padr\u00e3o obrigat\u00f3rio)"),
    para("Todos os projetos devem seguir obrigatoriamente a estrutura de pastas abaixo. Qualquer desvio desse padr\u00e3o dificulta o rastreamento de arquivos e compromete a integridade da BOM exportada ao ERP."),
    ...spacer(1),
    ...codeBlock([
      "PROJETOS/",
      "  \u251c\u2500\u2500 ND-2025-001_Nome-do-Projeto/",
      "  \u2502     \u251c\u2500\u2500 PECAS/          \u2190 arquivos .SLDPRT",
      "  \u2502     \u251c\u2500\u2500 CONJUNTOS/      \u2190 arquivos .SLDASM",
      "  \u2502     \u251c\u2500\u2500 DESENHOS/       \u2190 arquivos .SLDDRW",
      "  \u2502     \u2514\u2500\u2500 EXPORTACAO/     \u2190 arquivos Excel da BOM para o ERP",
    ]),
    ...spacer(1),
    para("A pasta EXPORTACAO \u00e9 onde ficam os arquivos .xlsx prontos para importa\u00e7\u00e3o no ERP. Nunca salve arquivos de exporta\u00e7\u00e3o fora dessa pasta."),

    h2("1.3 Nomenclatura de Arquivos (padr\u00e3o obrigat\u00f3rio)"),
    para("A nomenclatura padronizada garante unicidade do Part Number no ERP e facilita a rastreabilidade. Siga rigorosamente o padr\u00e3o abaixo:"),
    ...spacer(1),
    bulletRuns([{ text: "Parts:", bold: true }, " ND-YYYY-NNN_DESCRICAO.SLDPRT"]),
    bulletRuns([{ text: "Exemplo:", italics: true }, " ND-2025-001_CHAPA-LATERAL.SLDPRT"]),
    bulletRuns([{ text: "Assembly:", bold: true }, " ND-YYYY-NNN_ASM_DESCRICAO.SLDASM"]),
    bulletRuns([{ text: "Exemplo:", italics: true }, " ND-2025-001_ASM_CHASSI.SLDASM"]),
    bulletRuns([{ text: "Drawing:", bold: true }, " ND-YYYY-NNN_DWG_DESCRICAO.SLDDRW"]),
    ...spacer(1),
    ...warnBox([
      "\u26a0\ufe0f  IMPORTANTE: O c\u00f3digo do arquivo (sem a extens\u00e3o) \u00e9 o que ser\u00e1 usado como Part Number no ERP.",
      "         Use sempre o padr\u00e3o acima. N\u00e3o use acentos, espa\u00e7os ou caracteres especiais no nome do arquivo.",
    ]),
  ];
}

// ─── CAPÍTULO 2 ───────────────────────────────────────────────────────────────
function chapter2() {
  const n1 = nextNumRef(), n2 = nextNumRef(), n3 = nextNumRef(), n4 = nextNumRef();

  // Custom Properties table
  const cpHeaders = ["Nome do Campo", "Tipo", "Exemplo", "Obrigat\u00f3rio", "Observa\u00e7\u00e3o"];
  const cpWidths  = [1700, 900, 2000, 1100, 3372];
  const cpRows = [
    ["PartNumber",    "Texto",   "ND-2025-001",            "SIM", "C\u00f3digo \u00fanico da pe\u00e7a no ERP"],
    ["Description",  "Texto",   "CHAPA LATERAL 3MM",       "SIM", "Descri\u00e7\u00e3o completa da pe\u00e7a"],
    ["Revision",     "Texto",   "A",                       "SIM", "Revis\u00e3o do desenho (A, B, C\u2026)"],
    ["Material",     "Texto",   "A\u00c7O SAE 1020 3MM",  "SIM", "Material com espessura se aplic\u00e1vel"],
    ["Finish",       "Texto",   "JATEADO + PINTADO",       "N\u00c3O", "Acabamento superficial"],
    ["Unit",         "Texto",   "PC",                      "SIM", "Unidade: PC, KG, M, M2, M3, L"],
    ["Weight",       "N\u00famero", "12.5",               "N\u00c3O", "Peso em kg (pode ser calculado pelo SW)"],
    ["DrawingNumber","Texto",   "ND-2025-001-DWG",         "N\u00c3O", "N\u00famero do desenho t\u00e9cnico"],
    ["Supplier",     "Texto",   "COMPRADO",                "N\u00c3O", "FABRICADO ou COMPRADO"],
    ["Notes",        "Texto",   "Ver toler\u00e2ncias gerais", "N\u00c3O", "Observa\u00e7\u00f5es espec\u00edficas"],
  ];

  return [
    h1("Cap\u00edtulo 2 \u2014 Propriedades Customizadas (Custom Properties)"),
    new Paragraph({
      spacing: { before: 100, after: 100 },
      shading: { fill: "EBF3FB", type: ShadingType.CLEAR },
      border: { left: { style: BorderStyle.SINGLE, size: 24, color: C_HEADING2, space: 8 } },
      children: [new TextRun({ text: "Este \u00e9 o cap\u00edtulo mais importante do manual. As Propriedades Customizadas alimentam diretamente a BOM e, consequentemente, o ERP.", font: "Arial", size: 22, bold: true, color: C_HEADING2 })],
    }),

    h2("2.1 O que s\u00e3o Propriedades Customizadas"),
    para("O SolidWorks permite armazenar metadados (dados sobre dados) diretamente em cada arquivo de pe\u00e7a ou conjunto. Esses metadados s\u00e3o chamados de Propriedades Customizadas (Custom Properties)."),
    para("Quando a Lista de Materiais (BOM) \u00e9 inserida em um Drawing, o SolidWorks l\u00ea automaticamente essas propriedades e popula as colunas da tabela. Ao exportar a BOM para Excel, esses dados v\u00e3o junto \u2014 prontos para importa\u00e7\u00e3o no ERP."),
    para("Se as propriedades n\u00e3o forem preenchidas corretamente, a BOM exportada ter\u00e1 campos vazios e a importa\u00e7\u00e3o no ERP falhar\u00e1 ou gerar\u00e1 dados incorretos."),

    h2("2.2 Como acessar as Propriedades Customizadas"),
    para("Siga os passos abaixo para acessar e preencher as propriedades em qualquer arquivo Part ou Assembly:"),
    ...spacer(1),
    numbered("Abra o arquivo Part (.SLDPRT) ou Assembly (.SLDASM) no SolidWorks.", n1),
    numberedRuns([{ text: "No menu superior: " }, { text: "Arquivo \u2192 Propriedades", bold: true }, { text: " (ou pressione " }, { text: "Alt+Enter", bold: true }, { text: " em vers\u00f5es recentes)." }], n1),
    numberedRuns([{ text: "Clique na aba " }, { text: "\u201cPersonalizado\u201d", bold: true }, { text: " (Custom)." }], n1),
    numbered("Preencha os campos conforme a tabela da se\u00e7\u00e3o 2.3.", n1),
    numbered("Clique em OK para salvar.", n1),

    h2("2.3 Campos Obrigat\u00f3rios para o ERP"),
    para("A tabela abaixo lista todos os campos que devem ser configurados nas Custom Properties de cada pe\u00e7a:"),
    ...spacer(1),
    makeTable(cpHeaders, cpRows, cpWidths),
    ...spacer(1),

    h2("2.4 Configurando o Peso Autom\u00e1tico"),
    para("O SolidWorks calcula o peso da pe\u00e7a automaticamente com base no material aplicado e na geometria do modelo. Para vincular o campo Weight ao c\u00e1lculo autom\u00e1tico:"),
    ...spacer(1),
    numbered("Nas Custom Properties, clique no campo " + '"Weight".', n2),
    numberedRuns([{ text: "Em \u201cValor / express\u00e3o de texto\u201d, clique no \u00edcone de engrenagem (\u2699\ufe0f) ao lado do campo de valor." }], n2),
    numberedRuns([{ text: "Selecione " }, { text: "\"Propriedade do arquivo\" \u2192 \"Massa\"", bold: true }, { text: " na lista." }], n2),
    numbered("O peso passar\u00e1 a ser calculado e atualizado automaticamente sempre que a geometria ou o material forem alterados.", n2),
    ...spacer(1),
    ...warnBox([
      "\u26a0\ufe0f  O c\u00e1lculo de massa s\u00f3 \u00e9 preciso se o material correto estiver aplicado ao modelo 3D.",
      "         Veja a se\u00e7\u00e3o 2.5 para aplicar materiais corretamente.",
    ]),

    h2("2.5 Vinculando Material \u00e0 Base de Dados"),
    para("Para garantir que o c\u00e1lculo de massa seja correto, o material deve ser aplicado pelo menu do SolidWorks, n\u00e3o apenas digitado manualmente no campo de propriedade:"),
    ...spacer(1),
    numberedRuns([{ text: "No FeatureManager (painel da esquerda), clique com bot\u00e3o direito em " }, { text: "\"Material\"", bold: true }, { text: "." }], n3),
    numberedRuns([{ text: "Selecione " }, { text: "\"Editar Material\"", bold: true }, { text: "." }], n3),
    numbered("Localize e selecione o material na biblioteca (ex: A\u00e7o SAE 1020).", n3),
    numbered("Clique em Aplicar e feche a janela.", n3),
    ...spacer(1),
    para("Materiais mais usados na ND Implementos:"),
    bullet("A\u00c7O SAE 1020 \u2014 chapas e perfis estruturais"),
    bullet("A\u00c7O SAE 1045 \u2014 eixos e componentes de alta resist\u00eancia"),
    bullet("AISI 304 \u2014 a\u00e7o inoxid\u00e1vel para ambientes corrosivos"),
    bullet("AL 6061 \u2014 alum\u00ednio estrutural"),
    bullet("ALU\u00cdNIO 3003 \u2014 chapas de alum\u00ednio para acabamento"),

    h2("2.6 Template de Propriedades (recomendado)"),
    para("Para evitar que cada projetista crie os campos manualmente toda vez que iniciar uma nova pe\u00e7a, o administrador do SolidWorks pode configurar um arquivo template de pe\u00e7a (.prtdot) com todos os campos Custom Properties j\u00e1 criados e, se poss\u00edvel, parcialmente preenchidos."),
    para("Com o template configurado, todo novo arquivo .SLDPRT criado a partir dele j\u00e1 chegar\u00e1 com os campos prontos para preenchimento, reduzindo erros e agilizando o trabalho."),
    para("Solicite ao administrador do SolidWorks a configura\u00e7\u00e3o desse template caso ele ainda n\u00e3o esteja dispon\u00edvel na rede."),
  ];
}

// ─── CAPÍTULO 3 ───────────────────────────────────────────────────────────────
function chapter3() {
  const n1 = nextNumRef(), n2 = nextNumRef(), n3 = nextNumRef(), n4 = nextNumRef();

  const colHeaders = ["Posi\u00e7\u00e3o", "T\u00edtulo da Coluna", "Propriedade Vinculada", "Largura"];
  const colWidths  = [900, 2000, 2600, 1200];
  const colRows = [
    ["1",  "ITEM",          "ITEM_NUMBER (autom\u00e1tico)",  "15mm"],
    ["2",  "PART NUMBER",   "PartNumber",                     "35mm"],
    ["3",  "DESCRI\u00c7\u00c3O", "Description",             "60mm"],
    ["4",  "MATERIAL",      "Material",                       "40mm"],
    ["5",  "QUANTIDADE",    "QUANTITY (autom\u00e1tico)",    "20mm"],
    ["6",  "UNIDADE",       "Unit",                           "15mm"],
    ["7",  "PESO UNIT (kg)","Weight",                         "20mm"],
    ["8",  "ACABAMENTO",    "Finish",                         "30mm"],
    ["9",  "REVIS\u00c3O",  "Revision",                      "15mm"],
    ["10", "OBSERVA\u00c7\u00d5ES", "Notes",                 "40mm"],
  ];

  const bomTypeHeaders = ["Tipo", "Quando usar", "Para o ERP"];
  const bomTypeWidths  = [2000, 4000, 2700];  // ~8700 total < 9072
  const bomTypeRows = [
    ["Somente Pe\u00e7as (Parts Only)", "Lista todos os itens individuais, sem subconjuntos", "Usar para exporta\u00e7\u00e3o"],
    ["N\u00edvel Superior (Top Level)", "Lista apenas os filhos diretos do assembly", "N\u00e3o usar para ERP"],
    ["Indentada (Indented)", "Lista hier\u00e1rquica com subn\u00edvel", "Opcional (estrutura complexa)"],
  ];

  return [
    h1("Cap\u00edtulo 3 \u2014 Criando a Lista de Materiais no Drawing"),

    h2("3.1 O que \u00e9 a BOM no SolidWorks"),
    para("A BOM (Bill of Materials \u2014 Lista de Materiais) \u00e9 uma tabela inserida no Drawing que lista automaticamente todos os componentes de um Assembly. O SolidWorks popula a BOM lendo as Custom Properties de cada pe\u00e7a e a quantidade de vezes que ela aparece no conjunto."),
    para("A BOM do Drawing \u00e9 o ponto de partida para a exporta\u00e7\u00e3o ao ERP: \u00e9 a partir dela que ser\u00e1 gerado o arquivo Excel com a estrutura de produto."),

    h2("3.2 Inserindo a BOM no Drawing"),
    para("Siga os passos abaixo para inserir a BOM em um Drawing existente:"),
    ...spacer(1),
    numberedRuns([{ text: "Abra o Drawing (.SLDDRW) do conjunto que deseja documentar." }], n1),
    numberedRuns([{ text: "No menu superior: " }, { text: "Inserir \u2192 Tabelas \u2192 Lista de Materiais", bold: true }, { text: " (Insert \u2192 Tables \u2192 Bill of Materials)." }], n1),
    numbered("Clique em uma vista do Assembly no desenho para selecion\u00e1-la.", n1),
    numberedRuns([{ text: "Na janela \u201cLista de Materiais\u201d, configure o Tipo de BOM (ver se\u00e7\u00e3o 3.4) e a configura\u00e7\u00e3o padr\u00e3o." }], n1),
    numbered("Clique OK. A tabela aparecer\u00e1 no desenho para ser posicionada.", n1),
    numbered("Clique para posicionar a tabela na \u00e1rea desejada do desenho.", n1),

    h2("3.3 Configurando as Colunas da BOM"),
    ...warnBox([
      "\u26a0\ufe0f  IMPORTANTE: As colunas da BOM devem corresponder EXATAMENTE aos campos que o ERP vai importar.",
      "         Qualquer diferen\u00e7a nos nomes de coluna causar\u00e1 erros na importa\u00e7\u00e3o.",
    ]),
    ...spacer(1),
    para("Siga os passos abaixo para configurar as colunas da BOM:"),
    ...spacer(1),
    numberedRuns([{ text: "Clique com bot\u00e3o direito na tabela BOM \u2192 " }, { text: "Propriedades", bold: true }, { text: "." }], n2),
    numberedRuns([{ text: "Na aba " }, { text: "\u201cColunas\u201d", bold: true }, { text: ", configure as colunas na ordem listada abaixo." }], n2),
    ...spacer(1),
    makeTable(colHeaders, colRows, colWidths),
    ...spacer(1),
    para("Como adicionar uma coluna de propriedade customizada:"),
    numberedRuns([{ text: "Clique em " }, { text: "\"Adicionar Coluna\"", bold: true }, { text: "." }], n3),
    numberedRuns([{ text: "Em \u201cTipo de Coluna\u201d, selecione " }, { text: "\"Propriedade Personalizada\"", bold: true }, { text: "." }], n3),
    numberedRuns([{ text: "Em \u201cNome da Propriedade\u201d, digite o nome exato do campo (ex: " }, { text: "PartNumber", bold: true }, { text: ")." }], n3),
    numbered("Defina o t\u00edtulo da coluna conforme a tabela acima.", n3),
    numbered("Repita para cada coluna necess\u00e1ria.", n3),

    h2("3.4 Tipos de BOM \u2014 Qual usar"),
    ...spacer(1),
    makeTable(bomTypeHeaders, bomTypeRows, bomTypeWidths),
    ...spacer(1),
    ...warnBox([
      "Recomenda\u00e7\u00e3o: Sempre usar \"Somente Pe\u00e7as\" (Parts Only) para exporta\u00e7\u00e3o ao ERP.",
      "Isso garante que todos os itens individu\u00e1is sejam listados com suas quantidades totais corretas.",
    ]),

    h2("3.5 Salvando o Formato da BOM como Template"),
    para("Para n\u00e3o precisar reconfigurar a BOM em cada novo Drawing, salve o formato como template reutiliz\u00e1vel:"),
    ...spacer(1),
    numbered("Configure a BOM corretamente conforme descrito nas se\u00e7\u00f5es anteriores.", n4),
    numberedRuns([{ text: "Clique com bot\u00e3o direito na BOM \u2192 " }, { text: "\"Salvar como Template\"", bold: true }, { text: "." }], n4),
    ...codeBlock(["Salvar em: TEMPLATES/BOM_ERP_v1.sldbomtbt"]),
    numbered("Informe ao time o caminho do template para uso padronizado.", n4),
    numbered("Ao inserir uma nova BOM, selecione esse template na janela de configura\u00e7\u00e3o.", n4),
  ];
}

// ─── CAPÍTULO 4 ───────────────────────────────────────────────────────────────
function chapter4() {
  const n1 = nextNumRef(), n2 = nextNumRef(), n3 = nextNumRef(), n4 = nextNumRef();

  const errHeaders = ["Erro", "Causa", "Como Evitar"];
  const errWidths  = [2300, 2900, 3500];
  const errRows = [
    ['"Part Number n\u00e3o encontrado"',  "Campo PartNumber vazio na pe\u00e7a",          "Sempre preencher PartNumber nas Custom Properties"],
    ['"Quantidade inv\u00e1lida"',           "V\u00edrgula no lugar de ponto decimal",     "Usar ponto (.) como separador decimal"],
    ['"Unidade inv\u00e1lida"',              "Unidade n\u00e3o cadastrada no ERP",          "Usar apenas: PC, KG, M, M2, M3, L, CJ"],
    ['"Pe\u00e7a duplicada"',               "Mesma pe\u00e7a em subconjuntos diferentes",  "Usar BOM tipo \u201cSomente Pe\u00e7as\u201d"],
    ['"Caractere inv\u00e1lido"',            "Acento ou s\u00edmbolo no c\u00f3digo",      "N\u00e3o usar acentos no campo PartNumber"],
  ];

  return [
    h1("Cap\u00edtulo 4 \u2014 Exportando a BOM para o ERP"),

    h2("4.1 M\u00e9todo 1 \u2014 Exportar do Drawing (RECOMENDADO)"),
    para("Este \u00e9 o m\u00e9todo principal e recomendado. Garante que a BOM exportada corresponde exatamente ao que est\u00e1 documentado no desenho t\u00e9cnico."),
    ...spacer(1),
    numbered("No Drawing, clique com bot\u00e3o direito na tabela BOM.", n1),
    numberedRuns([{ text: "Selecione " }, { text: "\"Salvar como\u2026\"", bold: true }, { text: "." }], n1),
    numberedRuns([{ text: "Em \u201cTipo de arquivo\u201d, selecione " }, { text: "Microsoft Excel (.xlsx)", bold: true }, { text: "." }], n1),
    ...codeBlock(["Navegar at\u00e9: PROJETOS/ND-YYYY-NNN_Nome-do-Projeto/EXPORTACAO/"]),
    numberedRuns([{ text: "Nomeie o arquivo como: " }, { text: "BOM_ND-YYYY-NNN_RevA.xlsx", bold: true }], n1),
    numbered("Clique Salvar.", n1),
    numbered("Na janela de confirma\u00e7\u00e3o, verifique se as colunas est\u00e3o corretas e clique OK.", n1),

    h2("4.2 M\u00e9todo 2 \u2014 Exportar direto do Assembly"),
    para("Use este m\u00e9todo quando n\u00e3o houver um Drawing criado para o conjunto:"),
    ...spacer(1),
    numbered("Abra o Assembly (.SLDASM).", n2),
    numberedRuns([{ text: "No painel esquerdo (FeatureManager), clique com bot\u00e3o direito no nome do assembly." }], n2),
    numberedRuns([{ text: "Selecione " }, { text: "\"Salvar como BOM\u2026\"", bold: true }, { text: " ou use o menu " }, { text: "Ferramentas \u2192 Lista de Materiais", bold: true }, { text: "." }], n2),
    numbered("Configure as colunas conforme o Cap\u00edtulo 3.", n2),
    numberedRuns([{ text: "Clique em " }, { text: "\"Exportar\"", bold: true }, { text: " \u2192 Microsoft Excel (.xlsx)." }], n2),

    h2("4.3 Verificando o Arquivo Excel Antes de Importar"),
    para("Antes de importar no ERP, abra o arquivo Excel gerado e verifique os seguintes pontos:"),
    ...spacer(1),
    checkItem("A primeira linha \u00e9 o cabe\u00e7alho com os nomes das colunas"),
    checkItem("Coluna PART NUMBER preenchida em todas as linhas (sem c\u00e9lulas vazias)"),
    checkItem("Coluna DESCRI\u00c7\u00c3O preenchida em todas as linhas"),
    checkItem("Coluna QUANTIDADE com valores num\u00e9ricos (n\u00e3o texto)"),
    checkItem("Coluna UNIDADE preenchida (PC, KG, M, etc.)"),
    checkItem("Sem linhas duplicadas"),
    checkItem("Sem c\u00e9lulas mescladas"),
    checkItem("Formato do arquivo: .xlsx (n\u00e3o .xls ou .csv)"),

    h2("4.4 Estrutura Esperada do Arquivo Excel"),
    para("O arquivo Excel exportado deve ter exatamente esta estrutura na Linha 1 (cabe\u00e7alho) e dados a partir da Linha 2:"),
    ...spacer(1),
    ...codeBlock([
      "Linha 1 (cabe\u00e7alho):",
      "ITEM | PART NUMBER | DESCRI\u00c7\u00c3O | MATERIAL | QUANTIDADE | UNIDADE | PESO UNIT (kg) | ACABAMENTO | REVIS\u00c3O | OBSERVA\u00c7\u00d5ES",
      "",
      "Exemplo de dados:",
      "1 | ND-2025-001 | CHAPA LATERAL 3MM      | A\u00c7O SAE 1020 |  2 | PC | 12.5 | PINTADO | A |",
      "2 | ND-2025-002 | PERFIL U 50X30X3       | A\u00c7O SAE 1020 |  4 | M  |  3.2 | PINTADO | A |",
      "3 | ND-2025-003 | PARAFUSO M10X30        | A\u00c7O INOX     | 16 | PC |  0.05|         | A |",
    ]),

    h2("4.5 Erros Comuns e Como Evitar"),
    para("A tabela abaixo lista os erros mais frequentes durante a exporta\u00e7\u00e3o e importa\u00e7\u00e3o da BOM, com suas causas e solu\u00e7\u00f5es:"),
    ...spacer(1),
    makeTable(errHeaders, errRows, errWidths),
  ];
}

// ─── CAPÍTULO 5 ───────────────────────────────────────────────────────────────
function chapter5() {
  const n1 = nextNumRef(), n2 = nextNumRef();
  return [
    h1("Cap\u00edtulo 5 \u2014 Importando no ERP"),

    h2("5.1 Acessando o M\u00f3dulo de Engenharia"),
    para("O m\u00f3dulo de engenharia do ERP \u00e9 o ponto de entrada para importa\u00e7\u00e3o de estruturas de produto provenientes do SolidWorks."),
    ...spacer(1),
    numberedRuns([{ text: "No ERP, acesse o menu " }, { text: "Engenharia", bold: true }, { text: " no painel principal." }], n1),
    numberedRuns([{ text: "Clique em " }, { text: "\"Importar BOM do SolidWorks\"", bold: true }, { text: "." }], n1),

    h2("5.2 Processo de Importa\u00e7\u00e3o"),
    para("Siga o passo a passo abaixo para realizar a importa\u00e7\u00e3o com sucesso:"),
    ...spacer(1),
    numberedRuns([{ text: "Clique em " }, { text: "\"Selecionar Arquivo\"", bold: true }, { text: "." }], n2),
    numbered("Localize o arquivo .xlsx na pasta EXPORTACAO/ do projeto.", n2),
    para("O sistema executar\u00e1 uma valida\u00e7\u00e3o autom\u00e1tica, que verificar\u00e1:"),
    bullet("Campos obrigat\u00f3rios (PartNumber, Description, Quantity, Unit)"),
    bullet("Duplicatas dentro do arquivo"),
    bullet("Formatos de n\u00fameros e datas"),
    bullet("Unidades de medida cadastradas"),
    numbered("Revise o preview dos dados. Se houver erros, corrija o arquivo Excel e reimporte.", n2),
    numberedRuns([{ text: "Ap\u00f3s validar, clique em " }, { text: "\"Confirmar Importa\u00e7\u00e3o\"", bold: true }, { text: "." }], n2),
    para("O ERP criar\u00e1 automaticamente:"),
    bullet("Os Produtos (itens) se ainda n\u00e3o existirem no cadastro"),
    bullet("A Estrutura do Produto (BOM) com os relacionamentos pai-filho"),
    bullet("O v\u00ednculo com o c\u00f3digo do projeto"),

    h2("5.3 O que acontece ap\u00f3s a importa\u00e7\u00e3o"),
    para("Ap\u00f3s a importa\u00e7\u00e3o bem-sucedida, os dados est\u00e3o dispon\u00edveis em todo o sistema:"),
    ...spacer(1),
    bullet("Os itens ficam dispon\u00edveis no m\u00f3dulo " + "PCP \u2192 Estrutura de Produto (BOM)"),
    bullet("Ordens de produ\u00e7\u00e3o podem ser criadas automaticamente a partir da BOM"),
    bullet("O m\u00f3dulo de estoque passa a monitorar os itens e suas quantidades"),
    bullet("Requisi\u00e7\u00f5es de material podem ser geradas automaticamente para o setor de compras"),
    bullet("Relat\u00f3rios de custo de produto ficam dispon\u00edveis para a gest\u00e3o"),
    ...spacer(1),
    ...warnBox([
      "\u26a0\ufe0f  Ap\u00f3s a importa\u00e7\u00e3o, sempre verifique no ERP se todos os itens foram criados corretamente",
      "         e se a estrutura de produto reflete a hierarquia esperada do projeto.",
    ]),
  ];
}

// ─── CAPÍTULO 6 — CHECKLIST ───────────────────────────────────────────────────
function chapter6() {
  return [
    h1("Cap\u00edtulo 6 \u2014 Checklist Completo do Projetista"),
    para("Use este checklist como refer\u00eancia r\u00e1pida em cada etapa do processo. Todos os itens marcados com caixa devem ser verificados antes de avan\u00e7ar para a pr\u00f3xima etapa."),

    h2("Antes de iniciar o projeto"),
    checkItem("Criar pasta do projeto seguindo o padr\u00e3o ND-YYYY-NNN_Nome"),
    checkItem("Usar template de Part com campos Custom Properties j\u00e1 criados"),
    checkItem("Verificar se o material est\u00e1 cadastrado no SolidWorks (base de materiais)"),

    h2("Durante o desenvolvimento"),
    checkItem("Preencher PartNumber com c\u00f3digo \u00fanico para cada pe\u00e7a (sem acentos, sem espa\u00e7os)"),
    checkItem("Preencher Description com descri\u00e7\u00e3o clara e padronizada (MAI\u00daSCULAS)"),
    checkItem("Preencher Material com nome completo (ex: A\u00c7O SAE 1020 3MM, n\u00e3o s\u00f3 \"a\u00e7o\")"),
    checkItem("Preencher Unit (PC, KG, M, M2, etc.)"),
    checkItem("Aplicar material pelo menu Ferramentas \u2192 Material (para c\u00e1lculo de peso correto)"),
    checkItem("Manter revis\u00e3o atualizada no campo Revision"),

    h2("Antes da exporta\u00e7\u00e3o"),
    checkItem("BOM configurada com template padr\u00e3o ND Implementos"),
    checkItem("Tipo de BOM: \"Somente Pe\u00e7as\" (Parts Only)"),
    checkItem("Todas as colunas na ordem correta"),
    checkItem("Sem itens com Part Number vazio"),
    checkItem("Sem itens com Quantidade = 0"),

    h2("Na exporta\u00e7\u00e3o"),
    checkItem("Formato: Microsoft Excel (.xlsx)"),
    checkItem("Arquivo salvo em EXPORTACAO/ do projeto"),
    checkItem("Nome do arquivo: BOM_ND-YYYY-NNN_RevX.xlsx"),
    checkItem("Verificar arquivo Excel antes de importar no ERP"),

    h2("No ERP"),
    checkItem("Acessar Engenharia \u2192 Importar BOM"),
    checkItem("Fazer valida\u00e7\u00e3o antes de confirmar"),
    checkItem("Conferir que todos os itens foram criados corretamente"),
    checkItem("Vincular BOM ao c\u00f3digo do projeto/pedido"),
  ];
}

// ─── APÊNDICES ────────────────────────────────────────────────────────────────
function appendices() {
  const unitHeaders = ["C\u00f3digo", "Descri\u00e7\u00e3o"];
  const unitWidths  = [1500, 5000];
  const unitRows = [
    ["PC",  "Pe\u00e7a (unidade)"],
    ["CJ",  "Conjunto"],
    ["KG",  "Quilograma"],
    ["M",   "Metro linear"],
    ["M2",  "Metro quadrado"],
    ["M3",  "Metro c\u00fabico"],
    ["L",   "Litro"],
    ["CM",  "Cent\u00edmetro"],
    ["MM",  "Mil\u00edmetro"],
    ["UN",  "Unidade gen\u00e9rica"],
  ];

  const matHeaders = ["C\u00f3digo no SW", "Descri\u00e7\u00e3o Completa"];
  const matWidths  = [2500, 5000];
  const matRows = [
    ["A\u00c7O SAE 1020",     "A\u00e7o carbono SAE 1020 laminado"],
    ["A\u00c7O SAE 1020 3MM", "Chapa de a\u00e7o SAE 1020 espessura 3mm"],
    ["A\u00c7O SAE 1020 4MM", "Chapa de a\u00e7o SAE 1020 espessura 4mm"],
    ["A\u00c7O SAE 1020 5MM", "Chapa de a\u00e7o SAE 1020 espessura 5mm"],
    ["A\u00c7O SAE 1020 6MM", "Chapa de a\u00e7o SAE 1020 espessura 6mm"],
    ["A\u00c7O SAE 1045",     "A\u00e7o carbono SAE 1045"],
    ["AISI 304",         "A\u00e7o inoxid\u00e1vel AISI 304"],
    ["AL 6061",          "Alum\u00ednio liga 6061"],
    ["ALU\u00cdNIO 3003", "Alum\u00ednio liga 3003"],
  ];

  const supHeaders = ["Suporte", "Contato"];
  const supWidths  = [3000, 4500];
  const supRows = [
    ["D\u00favidas sobre SolidWorks",           "Equipe de Engenharia"],
    ["D\u00favidas sobre importa\u00e7\u00e3o no ERP", "TI / Administrador do Sistema"],
    ["Erros de valida\u00e7\u00e3o",             "Abrir chamado no ERP: Suporte \u2192 Chamados"],
  ];

  return [
    h1("Ap\u00eandice A \u2014 Unidades de Medida Aceitas pelo ERP"),
    para("O ERP aceita exclusivamente as unidades de medida listadas abaixo. Qualquer outro valor causar\u00e1 erro de valida\u00e7\u00e3o na importa\u00e7\u00e3o."),
    ...spacer(1),
    makeTable(unitHeaders, unitRows, unitWidths),

    h1("Ap\u00eandice B \u2014 Materiais Padr\u00e3o ND Implementos"),
    para("Use exatamente os c\u00f3digos abaixo no campo Material das Custom Properties. Isso garante consist\u00eancia na BOM e facilita filtros e relat\u00f3rios no ERP."),
    ...spacer(1),
    makeTable(matHeaders, matRows, matWidths),

    h1("Ap\u00eandice C \u2014 Contatos de Suporte"),
    para("Em caso de d\u00favidas ou problemas, acione os canais de suporte conforme o tipo de ocorr\u00eancia:"),
    ...spacer(1),
    makeTable(supHeaders, supRows, supWidths),
    ...spacer(1),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({
        text: "\u2014 fim do documento \u2014",
        font: "Arial", size: 20, italics: true, color: "888888",
      })],
    }),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BUILD DOCUMENT
// ═══════════════════════════════════════════════════════════════════════════════
const styles = {
  default: {
    document: { run: { font: "Arial", size: 22 } },
  },
  paragraphStyles: [
    {
      id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run:       { size: 32, bold: true,  font: "Arial", color: C_HEADING1 },
      paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 },
    },
    {
      id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run:       { size: 26, bold: true,  font: "Arial", color: C_HEADING2 },
      paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 1 },
    },
    {
      id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
      run:       { size: 22, bold: true,  font: "Arial", color: C_HEADING3 },
      paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 },
    },
  ],
};

const doc = new Document({
  styles,
  numbering,
  sections: [
    // ── Cover + TOC (no header/footer on cover) ─────────────────────
    {
      properties: { ...sectionProps },
      children: [
        ...coverSection(),
        ...tocSection(),
      ],
    },
    // ── Main content ─────────────────────────────────────────────────
    {
      properties: { ...sectionProps },
      headers: { default: makeHeader() },
      footers: { default: makeFooter() },
      children: [
        ...chapter1(),
        ...chapter2(),
        ...chapter3(),
        ...chapter4(),
        ...chapter5(),
        ...chapter6(),
        ...appendices(),
      ],
    },
  ],
});

const outPath = path.resolve(
  "C:/Users/Microsoft/OneDrive/Documentos/GitHub/novo teste/docs/Manual_SolidWorks_BOM_ERP.docx"
);

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log("OK: arquivo salvo em", outPath);
  console.log("Tamanho:", buf.length, "bytes");
}).catch(err => {
  console.error("ERRO:", err);
  process.exit(1);
});

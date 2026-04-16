const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, TableOfContents,
  LevelFormat, ExternalHyperlink, Bookmark, InternalHyperlink
} = require('docx');
const fs = require('fs');

const BLUE = "1F3864";
const LIGHT_BLUE = "2E75B6";
const ACCENT = "00B0F0";
const GRAY = "F2F2F2";
const DARK_GRAY = "595959";
const WHITE = "FFFFFF";
const RED = "C00000";
const GREEN = "375623";
const ORANGE = "C55A11";

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function h1(text, bookmarkId) {
  const children = bookmarkId
    ? [new Bookmark({ id: bookmarkId, children: [new TextRun({ text, bold: true, size: 36, color: WHITE, font: "Arial" })] })]
    : [new TextRun({ text, bold: true, size: 36, color: WHITE, font: "Arial" })];
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    shading: { fill: BLUE, type: ShadingType.CLEAR },
    spacing: { before: 200, after: 200 },
    indent: { left: 200 },
    children
  });
}

function h2(text, bookmarkId) {
  const children = bookmarkId
    ? [new Bookmark({ id: bookmarkId, children: [new TextRun({ text, bold: true, size: 28, color: BLUE, font: "Arial" })] })]
    : [new TextRun({ text, bold: true, size: 28, color: BLUE, font: "Arial" })];
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LIGHT_BLUE } },
    children
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text, bold: true, size: 24, color: LIGHT_BLUE, font: "Arial" })]
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, size: 22, font: "Arial", ...opts })]
  });
}

function pBold(text) {
  return p(text, { bold: true });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: "Arial" })]
  });
}

function bullet2(text) {
  return new Paragraph({
    numbering: { reference: "bullets2", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: "Arial" })]
  });
}

function numbered(text) {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: "Arial" })]
  });
}

function spacer() {
  return new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun("")] });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function infoBox(title, text, color = "D6E4F0") {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [new TableCell({
          borders: { top: { style: BorderStyle.SINGLE, size: 8, color: LIGHT_BLUE }, bottom: border, left: { style: BorderStyle.SINGLE, size: 8, color: LIGHT_BLUE }, right: border },
          shading: { fill: color, type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 200, right: 200 },
          width: { size: 9360, type: WidthType.DXA },
          children: [
            new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 22, font: "Arial", color: BLUE })] }),
            new Paragraph({ children: [new TextRun({ text, size: 22, font: "Arial" })] })
          ]
        })]
      })
    ]
  });
}

function warningBox(text) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [new TableCell({
          borders: { top: { style: BorderStyle.SINGLE, size: 8, color: "C00000" }, bottom: border, left: { style: BorderStyle.SINGLE, size: 8, color: "C00000" }, right: border },
          shading: { fill: "FFCCCC", type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 200, right: 200 },
          width: { size: 9360, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: "⚠ ATENÇÃO: " + text, size: 22, font: "Arial", color: "C00000" })] })]
        })]
      })
    ]
  });
}

function tableHeader(cols) {
  return new TableRow({
    tableHeader: true,
    children: cols.map((c, i) => new TableCell({
      borders,
      shading: { fill: BLUE, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      width: { size: c.width, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.text, bold: true, color: WHITE, size: 20, font: "Arial" })] })]
    }))
  });
}

function tableRow(cells, widths, shade = false) {
  return new TableRow({
    children: cells.map((c, i) => new TableCell({
      borders,
      shading: { fill: shade ? "F5F5F5" : WHITE, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      width: { size: widths[i], type: WidthType.DXA },
      children: [new Paragraph({ children: [new TextRun({ text: c, size: 20, font: "Arial" })] })]
    }))
  });
}

function moduleTable(rows) {
  const w1 = 3000, w2 = 6360;
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [w1, w2],
    rows: [
      tableHeader([{ text: "Módulo", width: w1 }, { text: "Descrição", width: w2 }]),
      ...rows.map((r, i) => tableRow(r, [w1, w2], i % 2 === 0))
    ]
  });
}

function statusTable(rows) {
  const w1 = 2500, w2 = 2500, w3 = 4360;
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [w1, w2, w3],
    rows: [
      tableHeader([{ text: "Status", width: w1 }, { text: "Cor", width: w2 }, { text: "Significado", width: w3 }]),
      ...rows.map((r, i) => tableRow(r, [w1, w2, w3], i % 2 === 0))
    ]
  });
}

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
      },
      {
        reference: "bullets2",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "-", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }]
      },
      {
        reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: WHITE },
        paragraph: { spacing: { before: 200, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: BLUE },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: LIGHT_BLUE },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LIGHT_BLUE } },
          spacing: { after: 100 },
          children: [
            new TextRun({ text: "ERP - Implementos Rodoviários Ltda   |   Manual do Usuário", size: 18, color: DARK_GRAY, font: "Arial" })
          ]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: LIGHT_BLUE } },
          spacing: { before: 100 },
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: "Página ", size: 18, color: DARK_GRAY, font: "Arial" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: DARK_GRAY, font: "Arial" }),
            new TextRun({ text: " de ", size: 18, color: DARK_GRAY, font: "Arial" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: DARK_GRAY, font: "Arial" }),
          ]
        })]
      })
    },
    children: [
      // ==================== CAPA ====================
      new Paragraph({ children: [new PageBreak()] }),
      spacer(), spacer(), spacer(), spacer(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
        children: [new TextRun({ text: "ERP", bold: true, size: 96, color: BLUE, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        children: [new TextRun({ text: "Implementos Rodoviários Ltda", bold: true, size: 40, color: LIGHT_BLUE, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 400 },
        shading: { fill: LIGHT_BLUE, type: ShadingType.CLEAR },
        children: [new TextRun({ text: "  MANUAL DO USUÁRIO  ", bold: true, size: 32, color: WHITE, font: "Arial" })]
      }),
      spacer(), spacer(), spacer(), spacer(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Indústria de Carrocerias e Concessionária de Implementos Rodoviários", size: 22, color: DARK_GRAY, font: "Arial", italics: true })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Versão 1.0  |  2026", size: 22, color: DARK_GRAY, font: "Arial" })]
      }),
      spacer(),

      // ==================== SUMÁRIO ====================
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        shading: { fill: BLUE, type: ShadingType.CLEAR },
        spacing: { before: 200, after: 200 },
        indent: { left: 200 },
        children: [new TextRun({ text: "Sumário", bold: true, size: 36, color: WHITE, font: "Arial" })]
      }),
      new TableOfContents("Sumário", { hyperlink: true, headingStyleRange: "1-3" }),
      spacer(),

      // ==================== 1. INTRODUÇÃO ====================
      h1("1. Introdução", "intro"),
      p("Este manual apresenta o sistema ERP desenvolvido especialmente para a Implementos Rodoviários Ltda, empresa que atua como fabricante de carrocerias e como concessionária de implementos rodoviários sob um único CNPJ com múltiplos CNAEs."),
      spacer(),
      h2("1.1 Sobre o Sistema"),
      p("O ERP cobre todos os processos da empresa de forma integrada:"),
      bullet("Gestão comercial (CRM, orçamentos, pedidos de venda)"),
      bullet("Financiamento, consórcio e seguros (F&I)"),
      bullet("Planejamento e controle da produção (PCP)"),
      bullet("Oficina e calderaria"),
      bullet("Fiscal e emissão de NF-e / NFS-e"),
      bullet("Contabilidade, financeiro e recursos humanos"),
      bullet("Compras e estoque"),
      bullet("Inteligência artificial integrada"),
      bullet("Portal do cliente"),
      spacer(),
      h2("1.2 Regimes e Particularidades"),
      infoBox("Regime Tributário", "O sistema foi configurado para o regime Lucro Real, com suporte a PIS/COFINS não cumulativo, ICMS débito/crédito, IPI, e todos os recolhimentos do LALUR/LACS."),
      spacer(),
      infoBox("Reforma Tributária", "O motor fiscal possui suporte dual: calcula os impostos atuais (ICMS, ISS, PIS, COFINS, IPI) e os novos tributos da EC 132/2023 (IBS, CBS, IS) com transição gradual de 2026 a 2033."),
      spacer(),
      warningBox("Nunca utilize dados reais (CNPJ, NF-e, eSocial) no ambiente de HOMOLOGAÇÃO. O banner vermelho no topo da tela indica quando você está em PRODUÇÃO."),
      spacer(),

      // ==================== 2. ACESSO AO SISTEMA ====================
      h1("2. Acesso ao Sistema", "acesso"),
      h2("2.1 Login"),
      p("Abra o navegador e acesse o endereço do ERP (ex: http://localhost:3000 para ambiente local)."),
      numbered("Informe seu e-mail e senha nos campos indicados."),
      numbered("Clique em Entrar."),
      numbered("O sistema irá redirecioná-lo ao painel principal."),
      spacer(),
      infoBox("Credenciais Padrão (Primeiro Acesso)", "E-mail: admin@erp.local\nSenha: admin123\n\nAlterE a senha imediatamente após o primeiro login."),
      spacer(),
      h2("2.2 Indicador de Ambiente"),
      p("Um banner é exibido no topo da tela:"),
      bullet("Banner VERDE = Ambiente de HOMOLOGAÇÃO (testes). Transmissões vão para servidores de teste do governo."),
      bullet("Banner VERMELHO = Ambiente de PRODUÇÃO. Transmissões são oficiais e geram obrigações fiscais reais."),
      spacer(),
      h2("2.3 Navegação Principal"),
      p("A barra lateral esquerda contém todos os módulos do sistema. Clique no ícone de menu (☰) para expandir ou recolher a sidebar. O assistente de IA pode ser ativado pelo botão de robô no cabeçalho."),
      spacer(),

      // ==================== 3. MÓDULOS DO SISTEMA ====================
      h1("3. Módulos do Sistema", "modulos"),
      p("O ERP é organizado em módulos funcionais. A tabela abaixo apresenta uma visão geral:"),
      spacer(),
      moduleTable([
        ["CRM", "Cadastro de pessoas (clientes, fornecedores), pipeline de leads e atividades de relacionamento."],
        ["Comercial", "Orçamentos, pedidos de venda com 3 modalidades (estoque, venda direta, produção própria)."],
        ["F&I", "Financiamentos (FINAME/BNDES), consórcios com acompanhamento de cotas e seguros."],
        ["PCP", "Centros de trabalho, lista de materiais (BOM), roteiros de fabricação."],
        ["Produção", "Ordens de produção (ATO/MTO), apontamentos de mão de obra e materiais."],
        ["Oficina", "Ordens de serviço, calderaria, requisições internas de materiais."],
        ["Fiscal", "NF-e, NFS-e, apuração de impostos, regras tributárias, livros fiscais."],
        ["Contabilidade", "Plano de contas, lançamentos contábeis com partida dupla."],
        ["Financeiro", "Contas bancárias, contas a pagar/receber, extrato, fluxo de caixa."],
        ["RH", "Funcionários, folha de pagamento com cálculo INSS/IRRF/FGTS, benefícios."],
        ["Compras", "Solicitações de compra, cotações com comparativo, pedidos de compra."],
        ["Estoque", "Locais, saldos, movimentações, inventário físico."],
        ["IA", "Assistente de inteligência artificial para análises e consultas."],
        ["Portal", "Portal de autoatendimento para clientes externos (chamados, documentos)."],
      ]),
      spacer(),

      // ==================== 4. CRM ====================
      h1("4. CRM — Clientes e Relacionamento", "crm"),
      h2("4.1 Cadastro de Pessoas"),
      p("O cadastro unificado de pessoas cobre clientes, fornecedores, transportadoras e representantes. Acesse pelo menu CRM > Pessoas."),
      h3("Campos principais:"),
      bullet("Tipo: Pessoa Física (CPF) ou Jurídica (CNPJ)"),
      bullet("Função: Cliente, Fornecedor, Transportadora, Representante ou Funcionário"),
      bullet("Endereços, contatos, dados bancários — cadastrados em abas separadas"),
      spacer(),
      h2("4.2 Pipeline de Leads"),
      p("O pipeline visualiza o funil de vendas em colunas Kanban:"),
      bullet("NOVO → CONTATO → QUALIFICADO → PROPOSTA → NEGOCIAÇÃO → GANHO / PERDIDO"),
      p("Para avançar um lead de etapa: abra o lead e altere o status, ou arraste o cartão na visão Kanban."),
      h3("Registrando Atividades:"),
      bullet("Abra um lead e clique em Nova Atividade"),
      bullet("Tipos disponíveis: Ligação, E-mail, Reunião, Visita, Proposta, Anotação"),
      bullet("O histórico fica registrado na linha do tempo do lead"),
      spacer(),

      // ==================== 5. COMERCIAL ====================
      h1("5. Comercial — Orçamentos e Pedidos", "comercial"),
      h2("5.1 Orçamentos"),
      p("Acesse por Comercial > Orçamentos > Novo Orçamento."),
      numbered("Selecione o cliente (pessoa cadastrada no CRM)"),
      numbered("Escolha a modalidade de venda:"),
      bullet2("Estoque Próprio: produto em estoque, entrega imediata"),
      bullet2("Venda Direta: produto do fabricante, com comissão para a concessionária"),
      bullet2("Produção Própria: item fabricado sob encomenda"),
      numbered("Adicione os itens com produto, quantidade e preço unitário"),
      numbered("O sistema calcula automaticamente os impostos conforme a regra tributária"),
      numbered("Salve e envie para aprovação do cliente"),
      spacer(),
      p("Quando aprovado pelo cliente, converta o orçamento em Pedido de Venda clicando em Converter em Pedido."),
      spacer(),
      h2("5.2 Pedidos de Venda"),
      p("Para Venda Direta, o campo Fabricante fica disponível para indicar o fornecedor do produto e a comissão aplicada."),
      statusTable([
        ["Rascunho", "Cinza", "Pedido criado, ainda não aprovado"],
        ["Aprovado", "Verde", "Pedido confirmado, aguardando produção ou estoque"],
        ["Em Produção", "Azul", "Ordem de produção aberta"],
        ["Faturado", "Roxo", "NF-e emitida"],
        ["Cancelado", "Vermelho", "Pedido cancelado"],
      ]),
      spacer(),

      // ==================== 6. F&I ====================
      h1("6. F&I — Financiamento, Consórcio e Seguro", "fi"),
      h2("6.1 Financiamentos"),
      p("Registre financiamentos de clientes para aquisição de implementos. O sistema suporta:"),
      bullet("FINAME / BNDES: campos específicos para Código FINAME, Linha de Crédito e Carência"),
      bullet("CDC, Leasing, Consórcio, Direto"),
      p("O fluxo de status segue: Simulação → Proposta Enviada → Aprovado → Contratado → Liberado."),
      spacer(),
      h2("6.2 Consórcios"),
      p("Gerencie cotas de consórcio com acompanhamento de parcelas mensais. O botão Contemplar registra a contemplação por Lance ou Sorteio."),
      spacer(),
      h2("6.3 Seguros"),
      p("Cadastre apólices com vigência (data início/fim). O sistema alerta para apólices próximas do vencimento. Tipos suportados: RCFV, Casco, Total, Transporte, Garantia Estendida."),
      spacer(),

      // ==================== 7. PCP ====================
      h1("7. PCP — Planejamento e Controle da Produção", "pcp"),
      h2("7.1 Centros de Trabalho"),
      p("Cadastre os centros produtivos em PCP > Centros de Trabalho. Tipos disponíveis: Fabricação, Montagem, Pintura, Calderaria, Acabamento, Inspeção."),
      p("Para cada centro, informe a capacidade por hora e o custo por hora para cálculo de custos de produção."),
      spacer(),
      h2("7.2 Lista de Materiais (BOM)"),
      p("A BOM define a estrutura de componentes de um produto acabado."),
      numbered("Acesse PCP > BOM > Nova BOM"),
      numbered("Selecione o produto pai"),
      numbered("Adicione os componentes com quantidade, unidade e percentual de perda"),
      numbered("Use o botão Explodir BOM para visualizar a árvore completa de componentes"),
      spacer(),
      h2("7.3 Roteiros de Fabricação"),
      p("O roteiro define a sequência de operações para fabricar um produto."),
      bullet("Cada etapa do roteiro é vinculada a um Centro de Trabalho"),
      bullet("Informe tempo de setup, execução e espera (em minutos)"),
      bullet("O sistema calcula o tempo total e o custo de fabricação"),
      spacer(),

      // ==================== 8. PRODUÇÃO ====================
      h1("8. Produção — Ordens e Apontamentos", "producao"),
      h2("8.1 Ordens de Produção"),
      p("Acesse Produção > Ordens > Nova Ordem. Escolha a estratégia:"),
      bullet("ATO (Assemble to Order): montagem sob pedido — componentes prontos"),
      bullet("MTO (Make to Order): fabricação sob pedido — item inteiramente fabricado"),
      bullet("MTS (Make to Stock): fabricação para estoque"),
      p("Vincule a ordem a um Pedido de Venda quando aplicável. O sistema puxa automaticamente o roteiro de fabricação."),
      spacer(),
      p("Fluxo de status das ordens:"),
      statusTable([
        ["Planejada", "Cinza", "Ordem criada, aguardando liberação"],
        ["Liberada", "Azul", "Materiais reservados, pronta para iniciar"],
        ["Em Produção", "Laranja", "Fabricação em andamento"],
        ["Pausada", "Amarelo", "Produção interrompida temporariamente"],
        ["Concluída", "Verde", "Produto fabricado"],
        ["Cancelada", "Vermelho", "Ordem cancelada"],
      ]),
      spacer(),
      h2("8.2 Apontamentos"),
      p("Registre o que foi executado em cada ordem por centro de trabalho. Tipos de apontamento:"),
      bullet("Mão de Obra: horas trabalhadas com quantidades produzidas e rejeitadas"),
      bullet("Material: consumo de materiais"),
      bullet("Setup: tempo de preparação da máquina"),
      bullet("Parada: registro de parada não planejada com motivo"),
      spacer(),

      // ==================== 9. OFICINA ====================
      h1("9. Oficina — Ordens de Serviço e Calderaria", "oficina"),
      h2("9.1 Ordens de Serviço (OS)"),
      p("Abra ordens de serviço para veículos de clientes em Oficina > Ordens de Serviço."),
      numbered("Selecione o cliente e informe os dados do veículo (placa, chassi, km)"),
      numbered("Descreva o defeito relatado"),
      numbered("Defina o tipo (Manutenção, Reforma, Instalação, Garantia, Orçamento)"),
      numbered("Adicione itens: peças (com produto do estoque), serviços ou serviços de terceiros"),
      spacer(),
      h2("9.2 Calderaria"),
      p("A calderaria executa trabalhos de fabricação em aço. As ordens de calderaria podem ser vinculadas a uma OS ou a uma Ordem de Produção."),
      p("Tipos de serviço: Corte, Dobra, Solda, Conformação, Usinagem, Tratamento Térmico, Jateamento, Montagem Estrutural."),
      spacer(),
      h2("9.3 Requisições Internas"),
      p("Quando a oficina ou a calderaria precisa de materiais do estoque, abra uma Requisição Interna."),
      infoBox("Importante", "Requisições internas entre setores da mesma empresa (mesmo CNPJ) NÃO geram NF-e. O movimento é registrado apenas internamente no estoque."),
      p("Fluxo: Rascunho → Solicitada → Aprovada → Separada → Entregue."),
      spacer(),

      // ==================== 10. FISCAL ====================
      h1("10. Fiscal — NF-e, NFS-e e Impostos", "fiscal"),
      h2("10.1 Emissão de NF-e"),
      p("Acesse Fiscal > NF-e > Nova NF-e."),
      numbered("Escolha o tipo: Saída (venda) ou Entrada (compra)"),
      numbered("Selecione a finalidade: Normal, Complementar, Ajuste ou Devolução"),
      numbered("Informe o destinatário"),
      numbered("Adicione os itens com produto, NCM e CFOP"),
      numbered("O sistema calcula automaticamente todos os impostos"),
      numbered("Valide, assine e envie para o SEFAZ"),
      spacer(),
      infoBox("Motor Tributário Dual", "O sistema calcula simultaneamente os tributos do sistema atual (ICMS, IPI, PIS/COFINS) e os novos tributos da Reforma Tributária (IBS, CBS, IS). Durante 2026-2033, o percentual de cada sistema varia conforme o calendário de transição da EC 132/2023."),
      spacer(),
      h2("10.2 Regras Tributárias"),
      p("Cadastre regras em Fiscal > Regras Tributárias. Cada regra define as alíquotas e CSTs para uma combinação de NCM + CFOP + tipo de operação."),
      spacer(),
      h2("10.3 Apuração de Impostos"),
      p("Acesse Fiscal > Apuração. Selecione o período e o tipo de imposto (ICMS, IPI, PIS, COFINS, IBS, CBS, IS). O sistema agrega todos os débitos e créditos do período e calcula o saldo a pagar."),
      spacer(),
      h2("10.4 SPED e Obrigações Acessórias"),
      p("O sistema gera os arquivos digitais para transmissão ao governo. Para transmitir, acesse as opções dentro do módulo Fiscal:"),
      bullet("SPED Fiscal (EFD ICMS/IPI)"),
      bullet("SPED Contribuições (EFD PIS/COFINS)"),
      bullet("ECD (Escrituração Contábil Digital)"),
      bullet("ECF (Escrituração Contábil Fiscal — LALUR)"),
      bullet("eSocial"),
      bullet("EFD-REINF"),
      bullet("DCTF-Web"),
      spacer(),
      warningBox("Transmita SPED e eSocial sempre pelo ambiente de HOMOLOGAÇÃO antes de enviar para Produção. Erros em transmissões de Produção podem gerar multas."),
      spacer(),

      // ==================== 11. CONTABILIDADE ====================
      h1("11. Contabilidade", "contabilidade"),
      h2("11.1 Plano de Contas"),
      p("Acesse Contabilidade > Plano de Contas. O plano é organizado em árvore hierárquica com tipos: Ativo, Passivo, Receita, Despesa e Patrimônio Líquido."),
      p("Contas analíticas (que aceitam lançamentos) ficam nas pontas da árvore. Contas sintéticas agrupam o saldo das filhas."),
      spacer(),
      h2("11.2 Lançamentos Contábeis"),
      p("Acesse Contabilidade > Lançamentos > Novo Lançamento."),
      numbered("Informe a data e a descrição do lançamento"),
      numbered("Adicione as partidas: selecione a conta, o tipo (Débito ou Crédito) e o valor"),
      numbered("O sistema valida que a soma dos débitos é igual à soma dos créditos (partida dobrada)"),
      numbered("Clique em Lançar para contabilizar"),
      p("Para estornar um lançamento incorreto, abra o lançamento e clique em Estornar. O sistema cria um lançamento invertido automaticamente."),
      spacer(),

      // ==================== 12. FINANCEIRO ====================
      h1("12. Financeiro", "financeiro"),
      h2("12.1 Contas Bancárias"),
      p("Cadastre as contas bancárias da empresa em Financeiro > Contas Bancárias. Informe banco, agência, conta, tipo (Corrente/Poupança) e saldo inicial."),
      spacer(),
      h2("12.2 Contas a Pagar"),
      p("Registre os títulos de fornecedores em Financeiro > Contas a Pagar > Novo. Para registrar o pagamento de um título, abra-o e clique em Registrar Pagamento, informando:"),
      bullet("Data do pagamento"),
      bullet("Valor pago (pode ser diferente do valor original, em casos de negociação)"),
      bullet("Forma de pagamento e conta bancária"),
      spacer(),
      p("Títulos não pagos na data de vencimento ficam automaticamente com status VENCIDO (vermelho)."),
      spacer(),
      h2("12.3 Contas a Receber"),
      p("Mesmo fluxo das contas a pagar, mas para recebimentos de clientes. O sistema permite gerar parcelas automaticamente ao criar um título."),
      spacer(),
      h2("12.4 Fluxo de Caixa"),
      p("Acesse Financeiro > Fluxo de Caixa. O sistema projeta entradas e saídas por período com base nas contas a pagar e receber em aberto."),
      spacer(),
      h2("12.5 Extrato Bancário"),
      p("Registre as movimentações do extrato bancário em Financeiro > Extrato. O campo Conciliado permite marcar as transações já verificadas."),
      spacer(),

      // ==================== 13. RH ====================
      h1("13. Recursos Humanos", "rh"),
      h2("13.1 Funcionários"),
      p("Cadastre funcionários em RH > Funcionários > Novo. Cada funcionário é vinculado a uma Pessoa já cadastrada no sistema."),
      p("Informações necessárias: matrícula, cargo, departamento, centro de custo, data de admissão, salário base, CTPS e PIS."),
      spacer(),
      h2("13.2 Folha de Pagamento"),
      p("Acesse RH > Folha de Pagamento > Nova Folha. Selecione o período (mês/ano) e o tipo:"),
      bullet("Mensal: folha ordinária"),
      bullet("Férias: pagamento de férias"),
      bullet("13º Salário: primeira ou segunda parcela"),
      bullet("Rescisão: desligamento de funcionário"),
      p("Clique em Calcular para o sistema processar automaticamente o INSS, IRRF, FGTS e demais verbas. Após conferência, clique em Aprovar e depois em Pagar."),
      spacer(),
      infoBox("Cálculos Automáticos", "O sistema utiliza as tabelas vigentes de INSS (contribuição progressiva), IRRF (tabela progressiva com deduções), FGTS (8% sobre bruto) e INSS patronal (20% sobre bruto)."),
      spacer(),
      h2("13.3 Benefícios"),
      p("Gerencie os benefícios por funcionário em RH > Benefícios. Tipos: Vale Transporte, Vale Refeição, Vale Alimentação, Plano de Saúde, Plano Odontológico, Seguro de Vida, Cesta Básica."),
      spacer(),

      // ==================== 14. COMPRAS ====================
      h1("14. Compras", "compras"),
      h2("14.1 Solicitações de Compra"),
      p("Qualquer setor pode abrir uma solicitação em Compras > Solicitações > Nova. Informe a justificativa, prioridade (1 a 10) e os itens necessários."),
      p("Fluxo: Rascunho → Solicitada → Em Cotação → Aprovada → Pedido Gerado → Recebida."),
      spacer(),
      h2("14.2 Cotações de Fornecedores"),
      p("Para cada solicitação aprovada, abra cotações em Compras > Cotações. O sistema exibe um comparativo lado a lado de até 3 fornecedores, destacando o menor preço por item."),
      spacer(),
      h2("14.3 Pedidos de Compra"),
      p("Ao aprovar uma cotação, o sistema gera automaticamente o pedido de compra. Quando os itens chegam, registre o recebimento em Compras > Pedidos > abra o pedido > Registrar Recebimento."),
      p("O recebimento gera automaticamente uma movimentação de entrada no estoque."),
      spacer(),

      // ==================== 15. ESTOQUE ====================
      h1("15. Estoque", "estoque"),
      h2("15.1 Locais de Estoque"),
      p("Cadastre os locais físicos em Estoque > Locais. Tipos: Almoxarifado, Produção, Expedição, Quarentena."),
      spacer(),
      h2("15.2 Saldos"),
      p("Consulte o saldo de cada produto por local em Estoque > Saldos. Itens com estoque abaixo do ponto de reposição ficam destacados em vermelho."),
      spacer(),
      h2("15.3 Movimentações"),
      p("Registre entradas e saídas manuais em Estoque > Movimentações. Tipos:"),
      bullet("Entrada: recebimento de compra ou produção"),
      bullet("Saída: consumo em produção ou expedição"),
      bullet("Transferência: entre locais internos"),
      bullet("Ajuste Positivo / Negativo: correção de saldo"),
      bullet("Devolução: retorno de material"),
      spacer(),
      h2("15.4 Inventário Físico"),
      p("Realize o inventário em Estoque > Inventário > Novo Inventário."),
      numbered("Selecione o local e os produtos a inventariar"),
      numbered("Clique em Iniciar Contagem"),
      numbered("Informe a quantidade física contada para cada produto"),
      numbered("O sistema calcula automaticamente as diferenças"),
      numbered("Clique em Finalizar — o sistema gera ajustes de estoque para as diferenças"),
      spacer(),

      // ==================== 16. IA ====================
      h1("16. Assistente de Inteligência Artificial", "ia"),
      h2("16.1 Abrindo o Chat"),
      p("Clique no ícone de robô no cabeçalho do sistema para abrir o painel de IA. Você pode criar conversas separadas para diferentes contextos."),
      spacer(),
      h2("16.2 Contextos Disponíveis"),
      p("Selecione o contexto antes de fazer uma pergunta:"),
      bullet("Geral: perguntas gerais sobre o sistema"),
      bullet("Financeiro: análise de contas a pagar/receber e fluxo de caixa"),
      bullet("Estoque: consultas de saldos e alertas de reposição"),
      bullet("Produção: análise de ordens e apontamentos"),
      bullet("Comercial: pipeline de vendas e orçamentos"),
      bullet("RH: dados de folha e funcionários"),
      spacer(),
      h2("16.3 Insights Automáticos"),
      p("O painel inicial do ERP exibe insights gerados automaticamente pela IA, como alertas de títulos vencidos, produtos com estoque baixo e ordens de produção atrasadas."),
      spacer(),

      // ==================== 17. PORTAL DO CLIENTE ====================
      h1("17. Portal do Cliente", "portal"),
      p("O Portal é um ambiente separado acessado pelos clientes da empresa (não pelos funcionários). Acesse pelo endereço do sistema com o caminho /portal."),
      h2("17.1 Acesso do Cliente"),
      p("O cliente utiliza e-mail e senha próprios, cadastrados pela empresa no sistema interno. O Portal é uma área segura e isolada do ERP principal."),
      spacer(),
      h2("17.2 Funcionalidades"),
      bullet("Documentos: visualize e faça download de NF-e, boletos, orçamentos e contratos"),
      bullet("Chamados: abra e acompanhe solicitações de suporte"),
      bullet("Conta: atualize dados cadastrais e altere a senha"),
      spacer(),
      h2("17.3 Gestão de Chamados (Interno)"),
      p("Os funcionários acompanham os chamados dos clientes em Chamados no menu principal. É possível atribuir o chamado a um responsável, adicionar notas internas (invisíveis ao cliente) e encerrar o chamado."),
      spacer(),

      // ==================== 18. AMBIENTES ====================
      h1("18. Ambientes: Desenvolvimento, Homologação e Produção", "ambientes"),
      h2("18.1 Ambiente de Desenvolvimento (PC Local)"),
      p("Utilizado pela equipe técnica para desenvolver e testar novas funcionalidades. Neste ambiente:"),
      bullet("GOV_AMBIENTE = HOMOLOGAÇÃO (automático)"),
      bullet("Banco de dados: erp_dev (isolado)"),
      bullet("Transmissões fiscais vão para servidores de teste do governo"),
      bullet("O seed de dados pode ser executado sem restrições"),
      spacer(),
      h2("18.2 Ambiente de Produção (Servidor)"),
      p("Ambiente oficial da empresa. Neste ambiente:"),
      bullet("GOV_AMBIENTE = PRODUÇÃO"),
      bullet("Banco de dados: erp_prod (protegido)"),
      bullet("Todas as transmissões são oficiais e geram obrigações tributárias reais"),
      bullet("O seed está bloqueado para evitar sobrescrita de dados reais"),
      bullet("Backups automáticos antes de qualquer migration do banco"),
      spacer(),
      warningBox("NUNCA execute migrations no servidor de produção sem antes fazer um backup. Use o script packages/db/scripts/migrate-prod.sh que faz o backup automaticamente antes de migrar."),
      spacer(),
      h2("18.3 Como Atualizar o ERP em Produção"),
      numbered("Desenvolva e teste no PC local (homologação)"),
      numbered("Confirme que todas as funcionalidades estão corretas"),
      numbered("No servidor, execute: ./packages/db/scripts/migrate-prod.sh"),
      numbered("O script faz backup do banco e aplica as novas migrations"),
      numbered("Reinicie os containers: docker compose -f docker-compose.prod.yml up -d"),
      spacer(),

      // ==================== 19. SUPORTE ====================
      h1("19. Resolução de Problemas e Suporte", "suporte"),
      h2("19.1 Sistema não inicia"),
      bullet("Verifique se o Docker Desktop está aberto e com os containers ativos"),
      bullet("Verifique se o PostgreSQL está respondendo (container erp-postgres-dev deve estar verde no Docker)"),
      bullet("Consulte os logs da API com: docker logs erp-api"),
      spacer(),
      h2("19.2 Erro ao emitir NF-e"),
      bullet("Verifique se o certificado digital A1 está configurado (variável CERT_PFX_PATH no .env)"),
      bullet("Confirme que o ambiente está correto (homologação para testes)"),
      bullet("Verifique os logs de transmissão em Fiscal > Transmissões Governamentais"),
      spacer(),
      h2("19.3 Dados de usuário padrão"),
      infoBox("Usuário Administrador", "E-mail: admin@erp.local\nSenha: admin123\nPerfil: ADMIN (acesso total ao sistema)"),
      spacer(),
      h2("19.4 Inicialização Manual"),
      p("Para subir o ambiente de desenvolvimento manualmente, execute na pasta do projeto:"),
      new Paragraph({
        shading: { fill: "2D2D2D", type: ShadingType.CLEAR },
        spacing: { before: 80, after: 80 },
        indent: { left: 360 },
        children: [
          new TextRun({ text: "docker compose -f docker-compose.dev.yml up -d", size: 20, font: "Courier New", color: "00FF41" }),
        ]
      }),
      new Paragraph({
        shading: { fill: "2D2D2D", type: ShadingType.CLEAR },
        spacing: { before: 0, after: 80 },
        indent: { left: 360 },
        children: [
          new TextRun({ text: "pnpm dev", size: 20, font: "Courier New", color: "00FF41" }),
        ]
      }),
      spacer(),

      // ==================== RODAPÉ FINAL ====================
      new Paragraph({ children: [new PageBreak()] }),
      spacer(), spacer(), spacer(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        shading: { fill: BLUE, type: ShadingType.CLEAR },
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: "Manual do Usuário — ERP Implementos Rodoviários Ltda", bold: true, size: 24, color: WHITE, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: "Versão 1.0  |  Março de 2026", size: 22, color: DARK_GRAY, font: "Arial" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Este documento é de uso interno e confidencial.", size: 20, color: DARK_GRAY, font: "Arial", italics: true })]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("Manual_ERP.docx", buffer);
  console.log("Manual_ERP.docx gerado com sucesso!");
});

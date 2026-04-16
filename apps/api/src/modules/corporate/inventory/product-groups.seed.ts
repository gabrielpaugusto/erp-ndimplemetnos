export const PRODUCT_GROUPS_SEED = [
  {
    code: '01', name: 'Matéria-Prima', description: 'Materiais base transformados na produção: chapas, barras, perfis, tubos',
    subgroups: [
      { code: '01', name: 'Chapas de Aço' },
      { code: '02', name: 'Perfis e Barras' },
      { code: '03', name: 'Tubos' },
      { code: '04', name: 'Alumínio' },
      { code: '05', name: 'Madeira' },
      { code: '06', name: 'Polímeros / Fibra' },
    ],
  },
  {
    code: '02', name: 'Insumos de Produção', description: 'Consumidos no processo sem integrar o produto final: eletrodos, discos, gases, tintas',
    subgroups: [
      { code: '01', name: 'Soldagem' },
      { code: '02', name: 'Abrasivos' },
      { code: '03', name: 'Pintura' },
      { code: '04', name: 'Fixação' },
      { code: '05', name: 'Vedação / Adesivos' },
      { code: '06', name: 'Elétrica / Pneumática' },
    ],
  },
  {
    code: '03', name: 'Peça Fabricada', description: 'Peças produzidas internamente: cortes, dobras, usinados, soldados',
    subgroups: [
      { code: '01', name: 'Cortes e Blanks' },
      { code: '02', name: 'Dobras e Conformados' },
      { code: '03', name: 'Usinados' },
      { code: '04', name: 'Soldados Simples' },
      { code: '05', name: 'Tratamento Superficial' },
    ],
  },
  {
    code: '04', name: 'Subconjunto', description: 'União de peças fabricadas que formam um módulo intermediário',
    subgroups: [
      { code: '01', name: 'SC Chassi' },
      { code: '02', name: 'SC Assoalho' },
      { code: '03', name: 'SC Lateral' },
      { code: '04', name: 'SC Porta' },
      { code: '05', name: 'SC Teto' },
      { code: '06', name: 'SC Instalação Elétrica' },
      { code: '07', name: 'SC Instalação Hidráulica' },
    ],
  },
  {
    code: '05', name: 'Conjunto', description: 'União de subconjuntos/peças que formam uma seção completa do implemento',
    subgroups: [
      { code: '01', name: 'CJ Chassi' },
      { code: '02', name: 'CJ Assoalho' },
      { code: '03', name: 'CJ Lateral' },
      { code: '04', name: 'CJ Porta' },
      { code: '05', name: 'CJ Teto' },
      { code: '06', name: 'CJ Instalação Completa' },
    ],
  },
  {
    code: '06', name: 'Material de Terceiros', description: 'Componentes comprados prontos que integram o produto',
    subgroups: [
      { code: '01', name: 'Iluminação / Sinalização' },
      { code: '02', name: 'Ferragens / Fechamento' },
      { code: '03', name: 'Borrachas / Vedação' },
      { code: '04', name: 'Hidráulico' },
      { code: '05', name: 'Pneumático' },
      { code: '06', name: 'Suspensão / Rodagem' },
      { code: '07', name: 'Elétrico / Eletrônico' },
      { code: '08', name: 'Acessórios Diversos' },
    ],
  },
  {
    code: '07', name: 'Peça de Reposição', description: 'Peças exclusivamente para venda avulsa — NÃO participam de BOM de produção',
    subgroups: [
      { code: '01', name: 'Reposição Chassi' },
      { code: '02', name: 'Reposição Carroceria' },
      { code: '03', name: 'Reposição Elétrica' },
      { code: '04', name: 'Reposição Hidráulica' },
    ],
  },
  {
    code: '08', name: 'Material de Uso e Consumo', description: 'Não integram produto e não são para revenda: EPIs, limpeza, escritório, ferramentas',
    subgroups: [
      { code: '01', name: 'Material de Escritório e Copa' },
      { code: '02', name: 'Material de Limpeza' },
      { code: '03', name: 'Manutenção de Veículos / Frota' },
      { code: '04', name: 'Ferramentas' },
      { code: '05', name: 'EPIs' },
    ],
  },
  {
    code: '09', name: 'Produto Acabado', description: 'Implemento completo pronto para entrega',
    subgroups: [
      { code: '01', name: 'Baú Seco' },
      { code: '02', name: 'Baú Frigorífico' },
      { code: '03', name: 'Carroceria Graneleira' },
      { code: '04', name: 'Carroceria Basculante' },
      { code: '05', name: 'Implemento Especial' },
    ],
  },
  {
    code: '10', name: 'Embalagem', description: 'Materiais de embalagem e proteção para transporte',
    subgroups: [
      { code: '01', name: 'Embalagem Primária' },
      { code: '02', name: 'Embalagem Secundária' },
      { code: '03', name: 'Materiais de Proteção' },
    ],
  },
];

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

@Injectable()
export class StProtocoloService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    ufOrigem?: string;
    ufDestino?: string;
    ncm?: string;
    search?: string;
    page?: string;
    limit?: string;
  }) {
    const page = parseInt(query.page ?? '1');
    const limit = parseInt(query.limit ?? '30');
    const where: any = { ativo: true };
    if (query.ufOrigem) where.ufOrigem = query.ufOrigem.toUpperCase();
    if (query.ufDestino) where.ufDestino = query.ufDestino.toUpperCase();
    if (query.ncm) where.ncm = { contains: query.ncm };
    if (query.search) {
      where.OR = [
        { protocolo: { contains: query.search, mode: 'insensitive' } },
        { ncm: { contains: query.search } },
        { cest: { contains: query.search } },
        { descricaoProduto: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.stProtocoloConfaz.findMany({
        where,
        orderBy: [{ ufOrigem: 'asc' }, { ufDestino: 'asc' }, { ncm: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stProtocoloConfaz.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    return this.prisma.stProtocoloConfaz.findUnique({ where: { id } });
  }

  async buscarMva(ufOrigem: string, ufDestino: string, ncm: string) {
    const today = new Date();
    const protocolo = await this.prisma.stProtocoloConfaz.findFirst({
      where: {
        ufOrigem: ufOrigem.toUpperCase(),
        ufDestino: ufDestino.toUpperCase(),
        ativo: true,
        ncm: {
          in: [ncm, ncm.substring(0, 4), ncm.substring(0, 2)],
        },
        vigenciaInicio: { lte: today },
      },
      orderBy: { ncm: 'desc' }, // mais específico primeiro
    });
    if (!protocolo) return null;
    const vigenciaFimOk = !protocolo.vigenciaFim || protocolo.vigenciaFim >= today;
    if (!vigenciaFimOk) return null;
    return {
      mva: protocolo.mvaAjustado ?? protocolo.mvaOriginal,
      protocolo: protocolo.protocolo,
      cest: protocolo.cest,
    };
  }

  async create(data: {
    ufOrigem: string; ufDestino: string; ncm: string; cest?: string;
    protocolo: string; descricaoProduto?: string;
    mvaOriginal: number; mvaAjustado?: number;
    vigenciaInicio: string; vigenciaFim?: string;
  }) {
    return this.prisma.stProtocoloConfaz.create({
      data: {
        ...data,
        ufOrigem: data.ufOrigem.toUpperCase(),
        ufDestino: data.ufDestino.toUpperCase(),
        mvaOriginal: data.mvaOriginal,
        mvaAjustado: data.mvaAjustado ?? null,
        vigenciaInicio: new Date(data.vigenciaInicio),
        vigenciaFim: data.vigenciaFim ? new Date(data.vigenciaFim) : null,
      },
    });
  }

  async update(id: string, data: Partial<{
    ufOrigem: string; ufDestino: string; ncm: string; cest: string;
    protocolo: string; descricaoProduto: string;
    mvaOriginal: number; mvaAjustado: number;
    vigenciaInicio: string; vigenciaFim: string; ativo: boolean;
  }>) {
    return this.prisma.stProtocoloConfaz.update({
      where: { id },
      data: {
        ...data,
        ufOrigem: data.ufOrigem?.toUpperCase(),
        ufDestino: data.ufDestino?.toUpperCase(),
        vigenciaInicio: data.vigenciaInicio ? new Date(data.vigenciaInicio) : undefined,
        vigenciaFim: data.vigenciaFim ? new Date(data.vigenciaFim) : undefined,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.stProtocoloConfaz.update({ where: { id }, data: { ativo: false } });
  }

  // ── Seed FiscalBrain ──────────────────────────────────────────────────────
  // Popula a tabela com os protocolos base levantados pelo estudo ST.
  // Idempotente: verifica existência por protocolo+ufOrigem+ufDestino+ncm.

  async seedProtocolosBase(): Promise<{ criados: number; ignorados: number; detalhes: string[] }> {
    const registros = this.buildSeedData();
    let criados = 0;
    let ignorados = 0;
    const detalhes: string[] = [];

    for (const r of registros) {
      const existe = await this.prisma.stProtocoloConfaz.findFirst({
        where: {
          protocolo: r.protocolo,
          ufOrigem:  r.ufOrigem,
          ufDestino: r.ufDestino,
          ncm:       r.ncm,
        },
      });

      if (existe) {
        ignorados++;
        detalhes.push(`[SKIP] ${r.protocolo} ${r.ufOrigem}→${r.ufDestino} NCM ${r.ncm}`);
        continue;
      }

      await this.prisma.stProtocoloConfaz.create({ data: r });
      criados++;
      detalhes.push(`[OK]   ${r.protocolo} ${r.ufOrigem}→${r.ufDestino} NCM ${r.ncm} MVA ${r.mvaOriginal}%`);
    }

    return { criados, ignorados, detalhes };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DADOS DO SEED
  // Fontes:
  //   • RICMS-SP Arts. 313-O/313-P + Portaria SRE 16/2023 (ST interna SP)
  //   • Protocolo ICMS 41/2008 + alterações (ST interestadual autopeças)
  //   • Convênio ICMS 142/2018 (CEST)
  //   • Decisão Normativa CAT 12/2009 (dupla condição NCM+descrição)
  //   • RC 28115/2023 (NCM 8716.90.90 engate × peças)
  // ─────────────────────────────────────────────────────────────────────────

  private buildSeedData() {
    // Fórmula MVA ajustado:
    // MVA_aj = [(1 + MVA_orig) × (1 − aliq_inter) / (1 − aliq_intra)] − 1
    const mvaAjustado = (mvaOrig: number, aliqInter: number, aliqIntra: number) =>
      Math.round(((1 + mvaOrig / 100) * (1 - aliqInter / 100) / (1 - aliqIntra / 100) - 1) * 10000) / 100;

    // ── Alíquotas internas por UF (principais) ───────────────────────────
    // Fonte: legislações estaduais vigentes (verificar atualização periódica)
    const aliqInterna: Record<string, number> = {
      AC: 17, AL: 18, AP: 18, AM: 18, BA: 20.5,
      CE: 18, DF: 18, ES: 17, GO: 17, MA: 18,
      MT: 17, MS: 17, MG: 18, PA: 17, PB: 18,
      PR: 18, PE: 18, PI: 18, RJ: 20,  RN: 18,
      RS: 18, RO: 17.5, RR: 17, SC: 17, SP: 18,
      SE: 18, TO: 18,
    };

    // Alíquota interestadual: 7% para N/NE/CO/ES; 12% para S/SE (exceto ES)
    const aliqInter = (ufDest: string): number =>
      ['AC','AL','AP','AM','BA','CE','GO','MA','MT','MS','PA','PB','PI',
       'RN','RO','RR','SE','TO','ES'].includes(ufDest) ? 7 : 12;

    const vigencia2008 = new Date('2008-01-01');
    const vigencia2019 = new Date('2019-01-01');
    const vigencia2000 = new Date('2000-12-01');

    // MVA geral autopeças (sem cláusula de fidelidade)
    const MVA_AUTO = 71.78;
    // MVA engate (8716.90.90) — mesma portaria CAT 68/2019, item 79
    // Verificar portaria: usando 71.78 como referência até confirmação da SEFAZ-SP
    const MVA_ENGATE = 71.78;

    const signatarios41 = [
      'AC','AL','AP','AM','BA','MA','MT','MG','PA','PB','PR','PI','DF',
    ];

    const registros: {
      ufOrigem: string; ufDestino: string; ncm: string; cest?: string;
      protocolo: string; descricaoProduto?: string;
      mvaOriginal: number; mvaAjustado?: number;
      vigenciaInicio: Date; vigenciaFim?: Date; ativo: boolean;
    }[] = [];

    // ─────────────────────────────────────────────────────────────────────
    // GRUPO 1 — ST INTERNA SP→SP: Autopeças NCM 8708
    // Base: RICMS-SP Arts. 313-O/313-P + Portaria SRE 16/2023
    // IVA-ST geral: 71.78% | fidelidade: 47.19%
    // ─────────────────────────────────────────────────────────────────────
    registros.push({
      ufOrigem: 'SP', ufDestino: 'SP',
      ncm: '8708',
      cest: '0107500',
      protocolo: 'RICMS-SP Arts. 313-O/313-P + Portaria SRE 16/2023',
      descricaoProduto: 'Partes, peças, componentes, acessórios e produtos de uso automotivo — NCM 8708 (regra geral sem fidelidade)',
      mvaOriginal: MVA_AUTO,
      mvaAjustado: undefined, // interna — sem ajuste
      vigenciaInicio: vigencia2000,
      ativo: true,
    });

    // Fidelidade (fabricante de veículos com contrato de fidelidade)
    registros.push({
      ufOrigem: 'SP', ufDestino: 'SP',
      ncm: '8708-FIDELIDADE',
      cest: '0107500',
      protocolo: 'RICMS-SP Arts. 313-O/313-P + Portaria SRE 16/2023 (fidelidade)',
      descricaoProduto: 'Autopeças NCM 8708 — fabricante de veículos com cláusula de fidelidade contratual de compra (IVA-ST reduzido)',
      mvaOriginal: 47.19,
      mvaAjustado: undefined,
      vigenciaInicio: vigencia2000,
      ativo: true,
    });

    // ─────────────────────────────────────────────────────────────────────
    // GRUPO 2 — ST INTERNA SP→SP: Engate reboque NCM 8716.90.90
    // Base: RICMS-SP Art. 313-O + Portaria CAT 68/2019 item 79
    // Obs: RC 28115/2023 — apenas engate COMPLETO (não peças de engate)
    // ─────────────────────────────────────────────────────────────────────
    registros.push({
      ufOrigem: 'SP', ufDestino: 'SP',
      ncm: '8716.90.90',
      cest: '0107700',
      protocolo: 'RICMS-SP Art. 313-O + Portaria CAT 68/2019 item 79',
      descricaoProduto: 'Engate para reboque e semirreboque — CEST 01.077.00 (somente o engate completo — RC 28115/2023)',
      mvaOriginal: MVA_ENGATE,
      mvaAjustado: undefined,
      vigenciaInicio: vigencia2019,
      ativo: true,
    });

    // ─────────────────────────────────────────────────────────────────────
    // GRUPO 3 — PROTOCOLO ICMS 41/2008: SP → estados signatários
    // Autopeças NCM 8708 — ST interestadual
    // MVA original: 71.78% (regra geral) | MVA ajustado: calculado por UF
    // ─────────────────────────────────────────────────────────────────────
    for (const uf of signatarios41) {
      if (uf === 'SP') continue; // SP interna já coberta no Grupo 1
      const inter  = aliqInter(uf);
      const intra  = aliqInterna[uf] ?? 18;
      const mvaAj  = mvaAjustado(MVA_AUTO, inter, intra);

      registros.push({
        ufOrigem: 'SP', ufDestino: uf,
        ncm: '8708',
        cest: '0107500',
        protocolo: 'Protocolo ICMS 41/2008',
        descricaoProduto: `Autopeças NCM 8708 — SP→${uf} (ALQ inter ${inter}% | ALQ interna ${uf} ${intra}%) — regra geral`,
        mvaOriginal: MVA_AUTO,
        mvaAjustado: mvaAj,
        vigenciaInicio: vigencia2008,
        ativo: true,
      });

      // Fidelidade
      const mvaAjFid = mvaAjustado(47.19, inter, intra);
      registros.push({
        ufOrigem: 'SP', ufDestino: uf,
        ncm: '8708-FIDELIDADE',
        cest: '0107500',
        protocolo: 'Protocolo ICMS 41/2008 (fidelidade)',
        descricaoProduto: `Autopeças NCM 8708 — SP→${uf} — fabricante com cláusula de fidelidade`,
        mvaOriginal: 47.19,
        mvaAjustado: mvaAjFid,
        vigenciaInicio: vigencia2008,
        ativo: true,
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // GRUPO 4 — NCMs sem ST: registro informativo para o FiscalBrain
    // Implementos completos 8716.10–8716.40 → sem ST em SP e sem protocolo
    // Registrado com mvaOriginal = 0 e ativo = false como "referência negativa"
    // para que o buscarMva retorne null (sem protocolo) corretamente.
    // Não são inseridos — apenas documentados aqui para rastreabilidade.
    // ─────────────────────────────────────────────────────────────────────
    // NCMs 8716.10, 8716.20, 8716.31, 8716.39, 8716.40 → NÃO geram registro ST.
    // O sistema retornará null no buscarMva e o FiscalBrain aplicará CST 00 / CFOP 5.101.

    return registros;
  }
}

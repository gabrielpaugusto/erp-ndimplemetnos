import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';

const DATA_LIMITE_APROVEIT = new Date('2026-12-31T23:59:59Z');

export interface CreditoResumo {
  tipo: string;
  totalPendente: number;
  totalAproveitado: number;
  totalExtinto: number;
  registros: number;
  alertaEncerramento: boolean; // true se há saldo pendente e data >= 01/01/2027
}

@Injectable()
export class EncerCreditoPisCofinsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Retorna resumo dos créditos PIS/COFINS por tipo para uma empresa. */
  async resumo(companyId: string): Promise<CreditoResumo[]> {
    const rows = await (this.prisma as any).encerCreditoPisCofins.groupBy({
      by: ['tipo'],
      where: { companyId },
      _sum: { valorSaldo: true, valorAproveitado: true, valorExtinto: true },
      _count: { id: true },
    });

    const hoje = new Date();
    return rows.map((r: any) => ({
      tipo:             r.tipo,
      totalPendente:    Number(r._sum.valorSaldo       ?? 0),
      totalAproveitado: Number(r._sum.valorAproveitado ?? 0),
      totalExtinto:     Number(r._sum.valorExtinto     ?? 0),
      registros:        r._count.id,
      alertaEncerramento: hoje >= DATA_LIMITE_APROVEIT && Number(r._sum.valorSaldo ?? 0) > 0,
    }));
  }

  /** Registra ou atualiza um crédito PIS/COFINS apurado em um período. */
  async registrar(data: {
    companyId: string;
    tipo: 'PIS' | 'COFINS';
    periodoOrigem: string;
    natureza: string;
    valorOriginal: number;
    fundamentoLegal?: string;
  }) {
    const valorSaldo = data.valorOriginal;
    return (this.prisma as any).encerCreditoPisCofins.create({
      data: {
        companyId:     data.companyId,
        tipo:          data.tipo,
        periodoOrigem: data.periodoOrigem,
        natureza:      data.natureza,
        valorOriginal: valorSaldo,
        valorSaldo,
        fundamentoLegal: data.fundamentoLegal,
      },
    });
  }

  /** Registra aproveitamento parcial ou total de um crédito. */
  async aproveitarCredito(id: string, valorAproveitando: number) {
    const credito = await (this.prisma as any).encerCreditoPisCofins.findUniqueOrThrow({
      where: { id },
    });

    const novoAproveitado = Number(credito.valorAproveitado) + valorAproveitando;
    const novoSaldo       = Number(credito.valorOriginal) - novoAproveitado;
    const status          = novoSaldo <= 0 ? 'APROVEITADO' : 'APROVEITADO_PARCIAL';

    return (this.prisma as any).encerCreditoPisCofins.update({
      where: { id },
      data: {
        valorAproveitado: novoAproveitado,
        valorSaldo:       Math.max(0, novoSaldo),
        status,
        dataEncerramento: status === 'APROVEITADO' ? new Date() : undefined,
      },
    });
  }

  /**
   * Extingue saldos remanescentes após 31/12/2026.
   * Deve ser executado em processo batch no encerramento do exercício 2026.
   * LC 214/2025 Art. 345: créditos não aproveitados são extintos sem indenização.
   */
  async encerrarSaldosExpirados(companyId: string): Promise<{ encerrados: number; valorExtinto: number }> {
    const hoje = new Date();
    if (hoje < DATA_LIMITE_APROVEIT) {
      return { encerrados: 0, valorExtinto: 0 };
    }

    const pendentes = await (this.prisma as any).encerCreditoPisCofins.findMany({
      where: {
        companyId,
        status: { in: ['PENDENTE', 'APROVEITADO_PARCIAL'] },
        valorSaldo: { gt: 0 },
      },
    });

    if (pendentes.length === 0) return { encerrados: 0, valorExtinto: 0 };

    let valorExtintoTotal = 0;
    for (const c of pendentes) {
      const saldo = Number(c.valorSaldo);
      valorExtintoTotal += saldo;
      await (this.prisma as any).encerCreditoPisCofins.update({
        where: { id: c.id },
        data: {
          valorExtinto:    saldo,
          valorSaldo:      0,
          status:          'EXTINTO',
          dataEncerramento: hoje,
          observacoes:     `Extinto por encerramento do prazo LC 214/2025 Art. 345 em ${hoje.toISOString().substring(0,10)}`,
        },
      });
    }

    return { encerrados: pendentes.length, valorExtinto: valorExtintoTotal };
  }

  /**
   * Valida emissão de NF-e/NFS-e: alerta se dataEmissao >= 2027 e houver
   * créditos PIS/COFINS com saldo pendente (situação irregular — deveriam ter sido
   * aproveitados ou extintos em 31/12/2026).
   */
  async validarEmissao(companyId: string, dataEmissao: Date): Promise<string[]> {
    const alertas: string[] = [];
    if (dataEmissao.getFullYear() < 2027) return alertas;

    const pendentes = await (this.prisma as any).encerCreditoPisCofins.findMany({
      where: {
        companyId,
        status: { in: ['PENDENTE', 'APROVEITADO_PARCIAL'] },
        valorSaldo: { gt: 0 },
      },
      select: { tipo: true, valorSaldo: true },
    });

    if (pendentes.length > 0) {
      const totalPIS    = pendentes.filter((c: any) => c.tipo === 'PIS')
                                   .reduce((s: number, c: any) => s + Number(c.valorSaldo), 0);
      const totalCOFINS = pendentes.filter((c: any) => c.tipo === 'COFINS')
                                   .reduce((s: number, c: any) => s + Number(c.valorSaldo), 0);
      if (totalPIS > 0)
        alertas.push(`Alerta: saldo de crédito PIS R$ ${totalPIS.toFixed(2)} não encerrado (LC 214/2025 Art. 345).`);
      if (totalCOFINS > 0)
        alertas.push(`Alerta: saldo de crédito COFINS R$ ${totalCOFINS.toFixed(2)} não encerrado (LC 214/2025 Art. 345).`);
    }

    return alertas;
  }
}

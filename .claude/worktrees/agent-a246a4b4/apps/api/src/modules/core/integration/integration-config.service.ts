import { Injectable } from '@nestjs/common';

@Injectable()
export class IntegrationConfigService {
  /**
   * Returns default account codes by category.
   * These codes correspond to the standard chart of accounts seeded in the system.
   * They can be overridden by company-specific configuration in the future.
   */
  getAccountCodes() {
    return {
      caixa: '1.1.1.001',           // Caixa e equivalentes
      banco: '1.1.1.002',           // Banco conta corrente
      clientes: '1.1.2.001',        // Clientes (duplicatas a receber)
      estoqueMP: '1.1.4.001',       // Estoque matéria-prima
      estoqueProd: '1.1.4.002',     // Estoque produtos acabados
      estoqueMerc: '1.1.4.003',     // Estoque mercadorias
      fornecedores: '2.1.1.001',    // Fornecedores (duplicatas a pagar)
      salariosAPagar: '2.1.2.001',  // Salários a pagar
      fgtsAPagar: '2.1.2.002',      // FGTS a recolher
      inssAPagar: '2.1.2.003',      // INSS a recolher
      receitaVendas: '3.1.1.001',   // Receita de vendas
      receitaServicos: '3.1.2.001', // Receita de serviços
      cmv: '4.1.1.001',             // Custo das mercadorias vendidas
      despSalarios: '4.2.1.001',    // Despesa com salários
      despFgts: '4.2.1.002',        // Despesa FGTS
      despInss: '4.2.1.003',        // Despesa INSS patronal
    };
  }

  /**
   * Finds a ChartOfAccount id by its code within a company's chart of accounts.
   * Returns null if no active account with the given code exists.
   */
  async findAccountId(
    prisma: any,
    companyId: string,
    code: string,
  ): Promise<string | null> {
    const account = await prisma.chartOfAccount.findFirst({
      where: { companyId, code, active: true },
    });
    return account?.id ?? null;
  }
}

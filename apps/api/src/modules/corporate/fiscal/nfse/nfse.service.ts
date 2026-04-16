import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { NfseRfbClientService } from './nfse-rfb-client.service';
import { NfseXmlBuilderService } from './nfse-xml-builder.service';
import { OperacoesFiscaisService } from '@/modules/corporate/fiscal/operacoes-fiscais.service';

@Injectable()
export class NfseService {
  private readonly logger = new Logger(NfseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nfseClient: NfseRfbClientService,
    private readonly xmlBuilder: NfseXmlBuilderService,
    private readonly operacoesFiscais: OperacoesFiscaisService,
  ) {}

  private getAmbiente(company: { ambienteNfse: number }): '1' | '2' {
    return company.ambienteNfse === 1 ? '1' : '2';
  }

  // -------------------------------------------------------------------------
  // NFS-e Emitidas
  // -------------------------------------------------------------------------

  async findAllEmitidas(companyId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.nfseEmitida.findMany({
        where: { companyId },
        include: { nbsCode: true, lc116Servico: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.nfseEmitida.count({ where: { companyId } }),
    ]);
    return { data, total, page, limit };
  }

  async findOneEmitida(companyId: string, id: string) {
    const nfse = await this.prisma.nfseEmitida.findFirst({
      where: { id, companyId },
      include: { nbsCode: true, lc116Servico: true, company: true },
    });
    if (!nfse) throw new NotFoundException('NFS-e não encontrada');
    return nfse;
  }

  async criarRascunho(companyId: string, dto: any) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');

    const proximoNumero = company.proximoNumeroNfse ?? 1;

    // Buscar alíquotas configuradas da empresa
    const taxRate = await this.prisma.companyTaxRate.findFirst({
      where: {
        companyId,
        vigenciaInicio: { lte: new Date() },
        OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: new Date() } }],
      },
      orderBy: { vigenciaInicio: 'desc' },
    });

    // Buscar regime tributário da empresa (prestador)
    const empresa = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxRegime: true, issRetidoMunicipio: true },
    });

    // Buscar dados fiscais do tomador pelo CPF/CNPJ
    const tomador = dto.tomadorCpfCnpj
      ? await this.prisma.person.findFirst({
          where: { companyId, cpfCnpj: dto.tomadorCpfCnpj.replace(/\D/g, '') },
          select: { type: true, taxRegime: true, optanteSimples: true, retencaoIss: true },
        })
      : null;

    // Buscar NBS code para verificar retenção de INSS e alíquota IRRF
    const nbsCode = dto.nbsCodeId
      ? await this.prisma.nbsCode.findUnique({
          where: { id: dto.nbsCodeId },
          select: { aliquotaIrrf: true, requerRetencaoInss: true, aliquotaIss: true },
        })
      : null;

    // Buscar configuração de retenções (mínimos e reforma tributária)
    const retentionConfig = await this.prisma.taxRetentionConfig.findUnique({
      where: { companyId },
    });
    const minimoRetencaoPisCofinsCsll = retentionConfig?.minimoRetencaoPisCofinsCsll ?? 215.05;
    const minimoRetencaoIrrf = retentionConfig?.minimoRetencaoIrrf ?? 10.00;
    const minimoRetencaoInss = retentionConfig?.minimoRetencaoInss ?? 0.00;
    const minimoRetencaoIss = retentionConfig?.minimoRetencaoIss ?? 0.00;
    const usarSistemaNovo = retentionConfig?.usarSistemaNovo ?? false;

    // Buscar LC 116/2003 (sistema atual ISS) para alíquota ISS padrão
    const lc116 = !usarSistemaNovo && dto.lc116ServicoId
      ? await this.prisma.lc116Servico.findUnique({
          where: { id: dto.lc116ServicoId },
          select: { aliquotaIss: true },
        })
      : null;

    // REGRA PRINCIPAL: Simples Nacional e MEI = sem retenção alguma
    const prestadorSimplesOuMei = empresa?.taxRegime === 'SIMPLES_NACIONAL' || empresa?.taxRegime === 'MEI';
    const tomadorSimplesOuMei = tomador?.optanteSimples || tomador?.taxRegime === 'SIMPLES_NACIONAL' || tomador?.taxRegime === 'MEI';
    const aplicarRetencoes = !prestadorSimplesOuMei && !tomadorSimplesOuMei && tomador?.type === 'PJ';

    const valorServico = Number(dto.valorServico);

    // ISSQN — alíquota e retenção (comum a ambos os sistemas)
    // Sistema atual: prioriza lc116.aliquotaIss; reforma: prioriza nbsCode.aliquotaIss
    const aliquotaIss = dto.aliquotaIss ?? lc116?.aliquotaIss ?? nbsCode?.aliquotaIss ?? taxRate?.aliquotaIss ?? 5.0;
    const issRetido = dto.issRetido !== undefined
      ? dto.issRetido
      : (aplicarRetencoes && (tomador?.retencaoIss || empresa?.issRetidoMunicipio || false));
    const issAplica = valorServico >= minimoRetencaoIss;
    const valorIss = issAplica ? valorServico * (aliquotaIss / 100) : 0;
    const issRetidoFinal = issAplica ? issRetido : false;

    // IRRF — alíquota configurada no NBS (comum a ambos os sistemas)
    const aliquotaIrrf = (nbsCode?.aliquotaIrrf ?? 1.5) / 100;

    // SISTEMA ATUAL (PIS/COFINS/CSLL/IRRF) — IN RFB 2.145/2023
    const retencaoPisCofinsCsll = !usarSistemaNovo && aplicarRetencoes && valorServico >= minimoRetencaoPisCofinsCsll;
    const retencaoIrrf = !usarSistemaNovo && aplicarRetencoes && valorServico >= minimoRetencaoIrrf;
    const retencaoInssAplica = aplicarRetencoes && (nbsCode?.requerRetencaoInss ?? false) && valorServico >= minimoRetencaoInss;

    const aliqPis = (taxRate?.aliquotaPis ?? 0.65) / 100;
    const aliqCofins = (taxRate?.aliquotaCofins ?? 3.0) / 100;
    const aliqCsll = (taxRate?.aliquotaCsll ?? 1.0) / 100;
    // INSS: usa alíquota configurada na empresa (padrão 0 = não retém por padrão)
    // A alíquota correta varia por faixa salarial (tabela InssFaixa) — aqui é o % de retenção na fonte para tomadores
    const aliqInss = (taxRate?.aliquotaInss ?? 0.0) / 100;

    const valorPis = retencaoPisCofinsCsll ? valorServico * aliqPis : 0;
    const valorCofins = retencaoPisCofinsCsll ? valorServico * aliqCofins : 0;
    const valorCsll = retencaoPisCofinsCsll ? valorServico * aliqCsll : 0;
    const valorIr = retencaoIrrf ? valorServico * aliquotaIrrf : 0;
    const valorInss = retencaoInssAplica ? valorServico * aliqInss : 0;

    // SISTEMA NOVO — REFORMA TRIBUTÁRIA (CBS + IBS) — EC 132/2023 + LC 214/2025
    const aliquotaCbs = retentionConfig?.aliquotaCbs ?? 0.9;
    const aliquotaIbs = retentionConfig?.aliquotaIbs ?? 0.1;
    const valorCbs = usarSistemaNovo && aplicarRetencoes ? valorServico * (aliquotaCbs / 100) : 0;
    const valorIbs = usarSistemaNovo && aplicarRetencoes ? valorServico * (aliquotaIbs / 100) : 0;

    // CSLL e IRRF se mantêm na reforma
    const valorCsllReforma = usarSistemaNovo && aplicarRetencoes && valorServico >= minimoRetencaoPisCofinsCsll ? valorServico * aliqCsll : 0;
    const valorIrReforma = usarSistemaNovo && aplicarRetencoes && valorServico >= minimoRetencaoIrrf ? valorServico * aliquotaIrrf : 0;

    // Valor líquido = serviço - impostos retidos
    const totalRetido = usarSistemaNovo
      ? (issRetidoFinal ? valorIss : 0) + valorCbs + valorIbs + valorCsllReforma + valorIrReforma + valorInss
      : (issRetidoFinal ? valorIss : 0) + valorPis + valorCofins + valorCsll + valorIr + valorInss;
    const valorLiquidoNfse = valorServico - totalRetido;

    // Para sistema novo, usar valores de CSLL/IR da reforma no registro
    const valorCsllFinal = usarSistemaNovo ? valorCsllReforma : valorCsll;
    const valorIrFinal = usarSistemaNovo ? valorIrReforma : valorIr;

    const nfse = await this.prisma.nfseEmitida.create({
      data: {
        companyId,
        numero: proximoNumero,
        serie: company.serieNfse ?? '1',
        tomadorCpfCnpj: dto.tomadorCpfCnpj,
        tomadorNome: dto.tomadorNome,
        tomadorIe: dto.tomadorIe,
        tomadorIm: dto.tomadorIm,
        tomadorEmail: dto.tomadorEmail,
        tomadorTelefone: dto.tomadorTelefone,
        tomadorLogradouro: dto.tomadorLogradouro,
        tomadorNumero: dto.tomadorNumero,
        tomadorComplemento: dto.tomadorComplemento,
        tomadorBairro: dto.tomadorBairro,
        tomadorMunicipio: dto.tomadorMunicipio,
        tomadorCodMunicipio: dto.tomadorCodMunicipio,
        tomadorUf: dto.tomadorUf,
        tomadorCep: dto.tomadorCep,
        nbsCodeId: dto.nbsCodeId ?? null,
        lc116ServicoId: dto.lc116ServicoId ?? null,
        discriminacao: dto.discriminacao,
        valorServico,
        valorDeducoes: dto.valorDeducoes ?? 0,
        valorPis: usarSistemaNovo ? 0 : valorPis,
        valorCofins: usarSistemaNovo ? 0 : valorCofins,
        valorInss,
        valorIr: valorIrFinal,
        valorCsll: valorCsllFinal,
        valorIss,
        aliquotaIss,
        valorLiquidoNfse,
        issRetido: issRetidoFinal,
        valorCbs,
        valorIbs,
        usouSistemaNovo: usarSistemaNovo,
        dataCompetencia: new Date(dto.dataCompetencia),
        status: 'PENDENTE',
      },
    });

    return nfse;
  }

  async emitir(companyId: string, id: string) {
    const nfse = await this.findOneEmitida(companyId, id);

    if (nfse.status === 'AUTORIZADA') {
      throw new BadRequestException('NFS-e já foi autorizada');
    }
    if (nfse.status === 'CANCELADA') {
      throw new BadRequestException(
        'NFS-e cancelada não pode ser reemitida',
      );
    }

    const ambiente = this.getAmbiente(nfse.company);

    // Construir e assinar DPS
    const dpsXml = await this.xmlBuilder.buildDps(id);
    const dpsAssinado = await this.xmlBuilder.assinarDps(dpsXml, companyId);

    // Salvar XML enviado
    await this.prisma.nfseEmitida.update({
      where: { id },
      data: { xmlEnviado: dpsAssinado },
    });

    try {
      const resultado = await this.nfseClient.emitirNfse(
        companyId,
        ambiente,
        dpsAssinado,
      );

      await this.prisma.nfseEmitida.update({
        where: { id },
        data: {
          status: 'AUTORIZADA',
          codigoVerificacao:
            resultado?.codigoVerificacao ?? resultado?.id ?? null,
          xmlRetorno: JSON.stringify(resultado),
        },
      });

      // Incrementar próximo número somente após autorização bem-sucedida
      await this.prisma.company.update({
        where: { id: companyId },
        data: { proximoNumeroNfse: { increment: 1 } },
      });

      return { success: true, resultado };
    } catch (error: any) {
      await this.prisma.nfseEmitida.update({
        where: { id },
        data: { status: 'REJEITADA', xmlRetorno: error.message },
      });
      throw error;
    }
  }

  async cancelar(companyId: string, id: string, motivo: string) {
    const nfse = await this.findOneEmitida(companyId, id);

    if (nfse.status !== 'AUTORIZADA') {
      throw new BadRequestException(
        'Apenas NFS-e autorizadas podem ser canceladas',
      );
    }

    if (!nfse.codigoVerificacao) {
      throw new BadRequestException(
        'Código de verificação não encontrado para esta NFS-e',
      );
    }

    const ambiente = this.getAmbiente(nfse.company);

    await this.nfseClient.cancelarNfse(
      companyId,
      ambiente,
      nfse.codigoVerificacao,
      motivo,
    );

    return this.prisma.nfseEmitida.update({
      where: { id },
      data: { status: 'CANCELADA', motivoCancelamento: motivo },
    });
  }

  // -------------------------------------------------------------------------
  // NFS-e Recebidas
  // -------------------------------------------------------------------------

  async findAllRecebidas(companyId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.nfseRecebida.findMany({
        where: { companyId },
        include: { nbsCode: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.nfseRecebida.count({ where: { companyId } }),
    ]);
    return { data, total, page, limit };
  }

  async sincronizarRecebidas(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');

    const ambiente = this.getAmbiente(company);
    const cnpj = (company as any).cnpj?.replace(/\D/g, '') ?? '';

    // NSU inicial: último processado ou 0 para buscar tudo
    let nsuAtual: bigint = (company as any).ultimoNsuNfse ?? BigInt(0);
    let maiorNsu: bigint = nsuAtual;

    // Carregar configurações de retenção e alíquotas
    const [retentionConfig, taxRate, empresa] = await Promise.all([
      this.prisma.taxRetentionConfig.findUnique({ where: { companyId } }),
      this.prisma.companyTaxRate.findFirst({
        where: { companyId, vigenciaFim: null },
        orderBy: { vigenciaInicio: 'desc' },
      }),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { taxRegime: true },
      }),
    ]);

    const minimoFederal = retentionConfig?.minimoRetencaoPisCofinsCsll ?? 215.05;
    const minimoIrrf    = retentionConfig?.minimoRetencaoIrrf ?? 10.00;
    const minimoIss     = retentionConfig?.minimoRetencaoIss ?? 0.00;
    const empresaNaoSimples = empresa?.taxRegime !== 'SIMPLES_NACIONAL' && empresa?.taxRegime !== 'MEI';

    let importadas = 0;
    let continuar  = true;

    try {
      // ── Loop NSU — modelo igual NF-e DF-e ────────────────────────────
      while (continuar) {
        const lote = await this.nfseClient.consultarDFe(companyId, ambiente, nsuAtual, cnpj);

        if (lote.StatusProcessamento === 'REJEICAO') {
          const erroMsg = lote.Erros?.[0]?.Descricao ?? 'Rejeição da RFB sem detalhe';
          throw new BadRequestException(`RFB rejeitou a consulta: ${erroMsg}`);
        }

        if (lote.StatusProcessamento === 'NENHUM_DOCUMENTO_LOCALIZADO') {
          continuar = false;
          break;
        }

        // DOCUMENTOS_LOCALIZADOS — processar cada documento do lote
        for (const dfe of lote.LoteDFe ?? []) {
          if (!dfe.NSU) continue;
          const nsuDoc = BigInt(dfe.NSU);
          if (nsuDoc > maiorNsu) maiorNsu = nsuDoc;

          // Só processa NFS-e (ignora eventos, CNC, etc.)
          if (dfe.TipoDocumento !== 'NFSE' && dfe.TipoDocumento !== 'DPS') continue;
          if (!dfe.ArquivoXml) continue;

          try {
            // Descomprimir e parsear XML
            const xml = await this.nfseClient.descomprimirXml(dfe.ArquivoXml);
            const nota = this.nfseClient.parseNfseXml(xml, dfe.NSU, dfe.ChaveAcesso, dfe.DataHoraGeracao);

            // Verificar duplicata
            const existing = await this.prisma.nfseRecebida.findFirst({
              where: { companyId, numero: nota.numero, prestadorCnpj: nota.prestadorCnpj },
            });
            if (existing) continue;

            // Regime do prestador (para cálculo de retenções)
            const prestadorCadastrado = nota.prestadorCnpj
              ? await this.prisma.person.findFirst({
                  where: { companyId, cpfCnpj: nota.prestadorCnpj },
                  select: { taxRegime: true },
                })
              : null;

            const prestadorRegime = prestadorCadastrado?.taxRegime ?? null;
            const prestadorNaoSimples = prestadorRegime !== 'SIMPLES_NACIONAL' && prestadorRegime !== 'MEI';
            const deveReter = empresaNaoSimples && prestadorNaoSimples;

            // Calcular retenções federais
            const aliqPis    = (taxRate?.aliquotaPis    ?? 0.65) / 100;
            const aliqCofins = (taxRate?.aliquotaCofins ?? 3.0)  / 100;
            const aliqCsll   = (taxRate?.aliquotaCsll   ?? 1.0)  / 100;
            const aliqIr     = (taxRate?.aliquotaIr     ?? 1.5)  / 100;
            const vs = nota.valorServico;

            const valorPisRetido    = deveReter && vs >= minimoFederal ? vs * aliqPis    : 0;
            const valorCofinsRetido = deveReter && vs >= minimoFederal ? vs * aliqCofins : 0;
            const valorCsllRetido   = deveReter && vs >= minimoFederal ? vs * aliqCsll   : 0;
            const valorIrRetido     = deveReter && vs >= minimoIrrf    ? vs * aliqIr     : 0;
            const valorIssAReter     = !nota.issRetido && deveReter && vs >= minimoIss ? nota.valorIss : 0;

            await this.prisma.nfseRecebida.create({
              data: {
                companyId,
                numero: nota.numero,
                codigoVerificacao: nota.chaveAcesso ?? null,
                prestadorCnpj: nota.prestadorCnpj,
                prestadorNome: nota.prestadorNome,
                prestadorIm: nota.prestadorIm,
                prestadorMunicipio: nota.prestadorMunicipio,
                prestadorUf: nota.prestadorUf,
                prestadorRegime,
                discriminacao: nota.discriminacao,
                valorServico: vs,
                valorIss: nota.valorIss,
                aliquotaIss: nota.aliquotaIss,
                issRetido: nota.issRetido,
                valorPisRetido,
                valorCofinsRetido,
                valorCsllRetido,
                valorIrRetido,
                valorIssAReter,
                dataEmissao: new Date(nota.dataEmissao),
                dataCompetencia: nota.dataCompetencia ? new Date(nota.dataCompetencia) : null,
                status: 'RECEBIDA',
                xmlContent: nota.xmlOriginal,
              },
            });
            importadas++;
          } catch (parseErr: any) {
            this.logger.warn(`Erro ao processar NSU ${dfe.NSU}: ${parseErr.message}`);
          }
        }

        // Avançar para próximo NSU (último do lote + 1)
        nsuAtual = maiorNsu + BigInt(1);
      }

      // Salvar maior NSU processado e timestamp
      await this.prisma.company.update({
        where: { id: companyId },
        data: {
          ultimoNsuNfse: maiorNsu,
          lastNfseRecebidaSync: new Date(),
        } as any,
      });

      return {
        message: `Sincronização concluída: ${importadas} NFS-e(s) recebida(s) importada(s)`,
        importadas,
        ultimoNsu: maiorNsu.toString(),
      };
    } catch (error: any) {
      this.logger.error(`Erro na sincronização NFS-e recebidas: ${error.message}`);

      // Se já é uma exceção HTTP do NestJS, repassa diretamente
      if (error instanceof HttpException) throw error;

      // Converte erros conhecidos de certificado/configuração em 400 com mensagem legível
      const msg: string = error.message ?? 'Erro na sincronização com a RFB';

      if (
        msg.includes('Certificado digital não instalado') ||
        msg.includes('CERT_ENCRYPTION_KEY') ||
        msg.includes('Não foi possível extrair')
      ) {
        throw new BadRequestException(msg);
      }

      // Erros de rede/timeout/RFB
      if (error.code === 'ENOTFOUND') {
        throw new BadRequestException(
          'Servidor da RFB não encontrado (DNS). ' +
          'Em produção, o IP do servidor precisa estar registrado no SERPRO para acesso à API Nacional NFS-e. ' +
          'Use o ambiente de Homologação para testes locais.',
        );
      }
      if (error.code === 'ECONNREFUSED') {
        throw new BadRequestException(
          'Conexão recusada pelo servidor da RFB. Verifique o ambiente configurado (Homologação/Produção) em Configurações → Empresa → NF-e/SEFAZ.',
        );
      }
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
        throw new BadRequestException('Tempo de resposta esgotado ao consultar a RFB. Tente novamente em instantes.');
      }

      // Resposta de erro do servidor RFB (axios)
      if (error.response) {
        const status: number = error.response.status ?? 502;
        const data = error.response.data;

        // RFB retornou HTML (ex: 404 IIS) — não exibir o HTML cru
        const isHtml =
          typeof data === 'string' && data.trim().startsWith('<') ||
          (error.response.headers?.['content-type'] ?? '').includes('text/html');

        if (isHtml) {
          if (status === 404) {
            throw new BadRequestException(
              'O servidor da RFB retornou HTML 404 — o proxy ARR da RFB bloqueou o acesso antes de chegar na aplicação. ' +
              'Isso indica restrição de IP: a API NFS-e Nacional (ADN Contribuinte) exige que as conexões ' +
              'partam de IPs cadastrados na RFB/SERPRO. ' +
              'Solicite o cadastro do IP do servidor junto à RFB ou use a VPN/proxy autorizado.',
            );
          }
          throw new HttpException(
            `Servidor da RFB retornou erro ${status}. Verifique as configurações de ambiente e certificado.`,
            HttpStatus.BAD_GATEWAY,
          );
        }

        // RFB retornou JSON estruturado com NENHUM_DOCUMENTO_LOCALIZADO (E2220) — é sucesso, não erro
        if (data?.StatusProcessamento === 'NENHUM_DOCUMENTO_LOCALIZADO') {
          await this.prisma.company.update({
            where: { id: companyId },
            data: { lastNfseRecebidaSync: new Date() } as any,
          });
          return {
            message: 'Sincronização concluída: nenhum documento localizado na RFB para este CNPJ.',
            importadas: 0,
            ultimoNsu: nsuAtual.toString(),
          };
        }

        // RFB retornou JSON com mensagem de erro real
        const rfbMsg = data?.Erros?.[0]?.Descricao ?? data?.message ?? data?.erro ?? data?.descricao ?? JSON.stringify(data);
        throw new HttpException(`RFB: ${rfbMsg}`, status);
      }

      // Qualquer outro erro — expõe a mensagem como 400 para não retornar 500 genérico
      throw new BadRequestException(msg);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // ESCRITURAR NFS-e RECEBIDA
  // Integra ao Motor de Regras Fiscais (TES) para determinar CFOP, créditos PIS/COFINS
  // e retenções (ISS / Federal / INSS) conforme o regime tributário da empresa.
  // ──────────────────────────────────────────────────────────────────────────────

  async escriturarRecebida(id: string, companyId: string, userId: string) {
    const nfse = await (this.prisma as any).nfseRecebida.findFirst({
      where: { id, companyId },
    });
    if (!nfse) throw new NotFoundException(`NFS-e recebida ${id} não encontrada`);
    if (nfse.status === 'ESCRITURADA') throw new BadRequestException('NFS-e já foi escriturada.');

    // Lê dados da empresa
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxRegime: true, uf: true },
    });
    const taxRegimeEmpresa = (company as any)?.taxRegime ?? 'LUCRO_REAL';
    const ufEmpresa        = (company as any)?.uf ?? '';

    // Determina tipo do prestador (por regime)
    const regimePrestador  = nfse.prestadorRegime ?? '';
    const tipoFornecedor   = regimePrestador === 'SIMPLES_NACIONAL' ? 'SIMPLES_NACIONAL'
                           : regimePrestador === 'MEI' ? 'MEI' : undefined;

    // Consulta motor para SERVICO_TOMADO
    const regra = await this.operacoesFiscais.determinar(companyId, {
      tipo:          'ENTRADA',
      destinacao:    'SERVICO_TOMADO',
      tipoFornecedor,
      ufFornecedor:  nfse.prestadorUf ?? ufEmpresa,
      ufEmpresa,
      taxRegimeEmpresa,
    });

    const valorServico  = Number(nfse.valorServico ?? 0);
    const valorIss      = Number(nfse.valorIss ?? 0);
    const today         = new Date();
    const periodo       = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;

    // PIS/COFINS sobre serviço (1,65% + 7,6% para Lucro Real não-cumulativo)
    const creditaPisCofins = regra?.creditaPisCofins ?? false;
    const valorPis    = creditaPisCofins ? this.round(valorServico * 0.0165) : 0;
    const valorCofins = creditaPisCofins ? this.round(valorServico * 0.076)  : 0;

    // Retenções calculadas
    const retencaoIss     = regra?.retencaoIss     ?? nfse.issRetido ?? false;
    const retencaoFederal = regra?.retencaoFederal ?? false;
    const retencaoInss    = regra?.retencaoInss    ?? false;

    // Valores retidos
    const valorIssAReter       = retencaoIss     ? valorIss : 0;
    const valorFederalAReter   = retencaoFederal ? this.round(valorServico * 0.0465) : 0; // 4,65% (PIS+COFINS+CSLL)
    const valorInssAReter      = retencaoInss    ? this.round(valorServico * 0.11)   : 0; // 11%

    const cfop = regra?.cfop ?? '1933';

    await this.prisma.$transaction(async (tx) => {
      // 1. FiscalEntry — lançamento no Livro de Serviços Tomados
      const fiscalBase: any = {
        companyId,
        type:             'CREDITO',
        bookType:         'ENTRADA',
        dataLancamento:   today,
        periodoReferencia: periodo,
        cfopCode:         cfop,
        naturezaOperacao: 'Aquisição de Serviço',
        valorContabil:    valorServico,
        baseCalculo:      valorServico,
        observations:     `NFS-e ${nfse.numero} — ${nfse.prestadorNome} | ${nfse.discriminacao ?? ''}`.slice(0, 500),
      };

      if (creditaPisCofins && valorPis > 0) {
        await tx.fiscalEntry.create({ data: { ...fiscalBase, taxType: 'PIS',    aliquota: 1.65, valorImposto: valorPis    } as any });
        await tx.fiscalEntry.create({ data: { ...fiscalBase, taxType: 'COFINS', aliquota: 7.60, valorImposto: valorCofins } as any });
      } else {
        // Registra mesmo sem crédito (regime cumulativo ou Simples)
        await tx.fiscalEntry.create({ data: { ...fiscalBase, taxType: 'ISS', aliquota: nfse.aliquotaIss ?? 0, valorImposto: valorIss,
          observations: `${fiscalBase.observations} — ISS ${retencaoIss ? 'RETIDO' : 'NÃO RETIDO'}` } as any });
      }

      // 2. Contas a Pagar — valor líquido após retenções
      const valorLiquido = valorServico - valorIssAReter - valorFederalAReter - valorInssAReter;
      if (nfse.prestadorCnpj || nfse.prestadorNome) {
        const prestador = await tx.person.findFirst({
          where: { companyId, cpfCnpj: nfse.prestadorCnpj },
          select: { id: true },
        });
        if (prestador) {
          await tx.financialMovement.create({
            data: {
              companyId,
              type:           'DESPESA' as any,
              personId:       prestador.id,
              description:    `NFS-e ${nfse.numero} — ${nfse.prestadorNome}${retencaoFederal ? ' (ret. federal 4,65%)' : ''}${retencaoInss ? ' (ret. INSS 11%)' : ''}`,
              numero:         `NFSE-${nfse.numero}`,
              valor:          valorLiquido > 0 ? valorLiquido : valorServico,
              dataEmissao:    today,
              dataVencimento: today,
              status:         'PENDENTE' as any,
              observations:   `Bruto: R$ ${valorServico.toFixed(2)} | ISS retido: R$ ${valorIssAReter.toFixed(2)} | Federal: R$ ${valorFederalAReter.toFixed(2)} | INSS: R$ ${valorInssAReter.toFixed(2)}`,
            } as any,
          });
        }
      }

      // 3. Atualiza status da NFS-e
      await (tx as any).nfseRecebida.update({
        where: { id },
        data: {
          status:             'ESCRITURADA',
          creditoPisCofins:   creditaPisCofins,
          valorPisCredito:    valorPis,
          valorCofinsCredito: valorCofins,
          cfopEscriturado:    cfop,
          retencaoIssEfetiva: retencaoIss,
          retencaoFederal:    retencaoFederal,
          retencaoInss:       retencaoInss,
        } as any,
      });
    });

    this.logger.log(`[EscriturarNFSe] NFS-e ${nfse.numero} escriturada — CFOP ${cfop} | crédito PIS/COFINS: ${creditaPisCofins} | ret. ISS: ${retencaoIss}`);

    return {
      message: `NFS-e ${nfse.numero} escriturada com sucesso`,
      cfop,
      creditaPisCofins,
      valorPis,
      valorCofins,
      retencaoIss,
      retencaoFederal,
      retencaoInss,
      valorIssRetido:     valorIssAReter,
      valorFederalRetido: valorFederalAReter,
      valorInssRetido:    valorInssAReter,
    };
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /**
   * Escrituração fiscal de NFS-e emitida:
   * - Lança livro fiscal de saídas (PIS/COFINS/ISS débito)
   * - Gera Contas a Receber (líquido de ISS retido pelo tomador)
   * - Lançamento contábil
   * - Status → ESCRITURADA
   */
  async escriturarEmitida(id: string, companyId: string, userId: string) {
    const nfse = await this.prisma.nfseEmitida.findFirst({ where: { id, companyId } });
    if (!nfse) throw new NotFoundException('NFS-e não encontrada');
    if (!['AUTORIZADA'].includes(nfse.status as string)) throw new BadRequestException('NFS-e deve estar AUTORIZADA para ser escriturada.');

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxRegime: true, uf: true },
    });
    const taxRegimeEmpresa = (company as any)?.taxRegime ?? 'LUCRO_REAL';
    const ufEmpresa = (company as any)?.uf ?? '';
    const ufCliente = nfse.tomadorUf ?? ufEmpresa;

    const regra = await this.operacoesFiscais.determinar(companyId, {
      tipo: 'SAIDA',
      destinacao: 'SERVICO_EMITIDO',
      ufCliente,
      ufEmpresa,
      taxRegimeEmpresa,
    });

    const valorServico = Number(nfse.valorServico);
    const valorIss    = Number(nfse.valorIss);
    const valorPis    = Number(nfse.valorPis);
    const valorCofins = Number(nfse.valorCofins);
    const issRetido   = nfse.issRetido;
    const valorLiquido = Number(nfse.valorLiquidoNfse);

    const dataEmissao = nfse.dataEmissao ?? new Date();
    const periodoRef  = `${dataEmissao.getFullYear()}-${String(dataEmissao.getMonth()+1).padStart(2,'0')}`;

    const debitaPisCofins = regra?.debitaPisCofins ?? (taxRegimeEmpresa !== 'SIMPLES_NACIONAL' && taxRegimeEmpresa !== 'MEI');
    const cfop = regra?.cfop ?? (ufCliente === ufEmpresa ? '5933' : '6933');

    return this.prisma.$transaction(async (tx) => {
      const base: any = {
        companyId,
        type: 'DEBITO',
        bookType: 'SAIDA',
        dataLancamento: dataEmissao,
        periodoReferencia: periodoRef,
        cfopCode: cfop,
        naturezaOperacao: 'Prestação de Serviço',
        valorContabil: valorServico,
        baseCalculo: valorServico,
        observations: `NFS-e ${nfse.numero} — ${nfse.tomadorNome}`,
      };

      // ISS a recolher (débito)
      if (valorIss > 0) {
        await tx.fiscalEntry.create({ data: { ...base, taxType: 'ISS', aliquota: nfse.aliquotaIss, valorImposto: valorIss, observations: `${base.observations} — ISS ${issRetido ? '(retido tomador)' : 'a recolher'}` } as any });
      }
      // PIS/COFINS (Lucro Real/Presumido)
      if (debitaPisCofins && valorPis > 0) {
        await tx.fiscalEntry.create({ data: { ...base, taxType: 'PIS',    aliquota: taxRegimeEmpresa === 'LUCRO_REAL' ? 1.65 : 0.65, valorImposto: valorPis    } as any });
      }
      if (debitaPisCofins && valorCofins > 0) {
        await tx.fiscalEntry.create({ data: { ...base, taxType: 'COFINS', aliquota: taxRegimeEmpresa === 'LUCRO_REAL' ? 7.6  : 3.0,  valorImposto: valorCofins } as any });
      }

      // Contas a Receber — valor líquido (já descontado ISS retido + retenções federais)
      const tomadorPessoa = nfse.tomadorCpfCnpj
        ? await tx.person.findFirst({ where: { companyId, cpfCnpj: nfse.tomadorCpfCnpj }, select: { id: true } })
        : null;

      let financialMovementId: string | null = null;
      if (tomadorPessoa) {
        const dataVencimento = new Date(dataEmissao.getTime() + 30 * 24 * 60 * 60 * 1000);
        const fm = await tx.financialMovement.create({
          data: {
            companyId,
            type: 'RECEIVABLE' as any,
            personId: tomadorPessoa.id,
            description: `NFS-e ${nfse.numero} — ${nfse.tomadorNome}`,
            numero: `NFSE-${nfse.numero}`,
            valor: valorLiquido,
            dataEmissao,
            dataVencimento,
            status: 'PENDENTE' as any,
            observations: `NFS-e ${nfse.numero} | Serviço: R$ ${valorServico.toFixed(2)} | ISS retido: ${issRetido ? 'Sim' : 'Não'}`,
          },
        });
        financialMovementId = fm.id;
      }

      // Lançamento contábil
      const [ctaReceita, ctaCliente, ctaIss] = await Promise.all([
        tx.chartOfAccount.findFirst({ where: { companyId, code: { startsWith: '3' }, nature: 'CREDORA'  }, select: { id: true } }),
        tx.chartOfAccount.findFirst({ where: { companyId, code: { startsWith: '1' }, nature: 'DEVEDORA' }, select: { id: true } }),
        tx.chartOfAccount.findFirst({ where: { companyId, code: { startsWith: '2' }, nature: 'CREDORA'  }, select: { id: true } }),
      ]);

      const journalLines: any[] = [
        { type: 'DEVEDORA', value: valorLiquido, description: `A receber — NFS-e ${nfse.numero}`, accountId: ctaCliente?.id },
        { type: 'CREDORA',  value: valorServico, description: `Receita serviços — NFS-e ${nfse.numero}`, accountId: ctaReceita?.id },
      ];
      if (issRetido && valorIss > 0) {
        journalLines.push({ type: 'DEVEDORA', value: valorIss, description: 'ISS retido pelo tomador', accountId: ctaIss?.id });
      }
      if (!issRetido && valorIss > 0) {
        journalLines.push({ type: 'DEVEDORA', value: valorIss, description: 'ISS a recolher', accountId: ctaIss?.id });
        journalLines.push({ type: 'CREDORA',  value: valorIss, description: 'ISS a recolher (passivo)', accountId: ctaIss?.id });
      }

      await tx.journalEntry.create({
        data: {
          companyId,
          numero: `NFSE-${nfse.numero}`,
          date: dataEmissao,
          description: `NFS-e ${nfse.numero} — ${nfse.tomadorNome}`,
          totalValue: valorServico,
          userId,
          items: { create: journalLines.filter(l => l.accountId) },
        },
      });

      // Status → ESCRITURADA
      await tx.nfseEmitida.update({ where: { id }, data: { status: 'ESCRITURADA' as any } });

      return { financialMovementId, message: 'NFS-e escriturada com sucesso.' };
    });
  }
}

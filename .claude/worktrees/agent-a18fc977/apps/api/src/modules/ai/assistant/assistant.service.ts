import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { AiToolsService } from './ai-tools.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiToolsService: AiToolsService,
  ) {}

  async getConversations(userId: string, companyId: string) {
    return this.prisma.aiConversation.findMany({
      where: { userId, companyId },
      orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      select: {
        id: true,
        title: true,
        context: true,
        status: true,
        messageCount: true,
        lastMessageAt: true,
        createdAt: true,
      },
    });
  }

  async getConversation(id: string) {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    return conversation;
  }

  async createConversation(
    userId: string,
    companyId: string,
    dto: CreateConversationDto,
  ) {
    return this.prisma.aiConversation.create({
      data: {
        userId,
        companyId,
        title: dto.title || 'Nova conversa',
        context: dto.context,
      },
    });
  }

  async sendMessage(
    conversationId: string,
    userId: string,
    companyId: string,
    dto: SendMessageDto,
  ) {
    // 1. Verify conversation exists
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    // 2. Save user message
    await this.prisma.aiMessage.create({
      data: {
        conversationId,
        role: 'USER',
        content: dto.content,
      },
    });

    // 3. Determine tool type based on content analysis
    const toolType = this.determineToolType(dto.content);

    // 4. Execute tool and get data
    let toolResult: any = null;
    let toolCalls: any[] = [];
    let toolResults: any[] = [];

    try {
      switch (toolType) {
        case 'ANALYZE_FINANCIAL':
          toolResult = await this.aiToolsService.executeFinancialAnalysis(companyId);
          break;
        case 'ANALYZE_STOCK':
          toolResult = await this.aiToolsService.executeStockAnalysis(companyId);
          break;
        case 'ANALYZE_PRODUCTION':
          toolResult = await this.aiToolsService.executeProductionAnalysis(companyId);
          break;
        case 'GENERATE_REPORT':
          const reportType = this.extractReportType(dto.content);
          toolResult = await this.aiToolsService.generateReport(companyId, reportType);
          break;
        default:
          toolResult = await this.aiToolsService.executeDataQuery(
            companyId,
            dto.content,
          );
      }

      toolCalls = [{ type: toolType, input: { query: dto.content } }];
      toolResults = [{ type: toolType, data: toolResult }];
    } catch (error) {
      toolResults = [{ type: toolType, error: error.message }];
    }

    // 5. Build assistant response
    const responseContent = this.buildResponse(toolType, toolResult, dto.content);

    // 6. Save assistant message
    const assistantMessage = await this.prisma.aiMessage.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: responseContent,
        toolCalls: toolCalls,
        toolResults: toolResults,
      },
    });

    // 7. Save tool execution record
    if (toolResult) {
      await this.prisma.aiToolExecution.create({
        data: {
          companyId,
          messageId: assistantMessage.id,
          toolType: toolType as any,
          input: { query: dto.content },
          output: toolResult,
          success: true,
          executionTimeMs: 0,
        },
      });
    }

    // 8. Update conversation
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        messageCount: { increment: 2 },
        lastMessageAt: new Date(),
        title:
          conversation.title === 'Nova conversa'
            ? dto.content.substring(0, 100)
            : undefined,
      },
    });

    return assistantMessage;
  }

  async archiveConversation(id: string) {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    return this.prisma.aiConversation.update({
      where: { id },
      data: { status: 'ARQUIVADA' },
    });
  }

  async deleteConversation(id: string) {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    return this.prisma.aiConversation.delete({ where: { id } });
  }

  private determineToolType(content: string): string {
    const lower = content.toLowerCase();

    if (
      lower.match(
        /financeiro|contas|pagar|receber|fluxo|caixa|pagamento|boleto|fatura/,
      )
    ) {
      return 'ANALYZE_FINANCIAL';
    }

    if (
      lower.match(
        /estoque|saldo|produto|movimenta[cç][aã]o|almoxarifado|invent[aá]rio/,
      )
    ) {
      return 'ANALYZE_STOCK';
    }

    if (
      lower.match(
        /produ[cç][aã]o|ordem|pcp|fabricar|fabricaç[aã]o|op\b/,
      )
    ) {
      return 'ANALYZE_PRODUCTION';
    }

    if (lower.match(/relat[oó]rio|report|resumo|dashboar/)) {
      return 'GENERATE_REPORT';
    }

    return 'QUERY_DATA';
  }

  private extractReportType(content: string): string {
    const lower = content.toLowerCase();
    if (lower.match(/financeiro|caixa|pagar|receber/)) return 'financeiro';
    if (lower.match(/estoque|produto|saldo/)) return 'estoque';
    if (lower.match(/venda|pedido|comercial/)) return 'vendas';
    return 'geral';
  }

  private buildResponse(
    toolType: string,
    toolResult: any,
    userQuery: string,
  ): string {
    if (!toolResult) {
      return 'Desculpe, nao consegui processar sua solicitacao no momento. Tente novamente.';
    }

    switch (toolType) {
      case 'ANALYZE_FINANCIAL':
        return [
          '## Analise Financeira',
          '',
          `**Total a Receber:** R$ ${Number(toolResult.totalAReceber || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${toolResult.countReceitas} titulos)`,
          `**Total a Pagar:** R$ ${Number(toolResult.totalAPagar || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${toolResult.countDespesas} titulos)`,
          `**Titulos Vencidos:** ${toolResult.vencidos}`,
          '',
          toolResult.vencidos > 0
            ? `> **Atencao:** Existem ${toolResult.vencidos} titulo(s) vencido(s) que precisam de atencao.`
            : '> Nenhum titulo vencido encontrado.',
        ].join('\n');

      case 'ANALYZE_STOCK':
        return [
          '## Analise de Estoque',
          '',
          `**Total de itens no estoque:** ${toolResult.totalItems}`,
          `**Itens abaixo do minimo:** ${toolResult.belowMinimum}`,
          '',
          toolResult.belowMinimum > 0
            ? `> **Alerta:** ${toolResult.belowMinimum} item(ns) estao abaixo do estoque minimo.`
            : '> Todos os itens estao com estoque adequado.',
        ].join('\n');

      case 'ANALYZE_PRODUCTION':
        return [
          '## Analise de Producao',
          '',
          `**Ordens em producao:** ${toolResult.inProgress}`,
          `**Concluidas hoje:** ${toolResult.completedToday}`,
          `**Pendentes (planejadas/liberadas):** ${toolResult.pending}`,
          '',
          '**Por status:**',
          ...(toolResult.byStatus || []).map(
            (s: any) => `- ${s.status}: ${s.count}`,
          ),
        ].join('\n');

      case 'GENERATE_REPORT':
        return [
          `## Relatorio - ${toolResult.type || 'Geral'}`,
          '',
          '```json',
          JSON.stringify(toolResult, null, 2),
          '```',
        ].join('\n');

      default:
        return [
          '## Resultado da Consulta',
          '',
          '```json',
          JSON.stringify(toolResult, null, 2),
          '```',
        ].join('\n');
    }
  }
}

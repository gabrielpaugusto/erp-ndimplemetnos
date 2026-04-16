import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/core/database/prisma.service';
import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

// ── DTOs ─────────────────────────────────────────────────────────────────────

export class CampoDef {
  @IsString() key: string;
  @IsString() label: string;
  @IsString() type: string; // "text" | "number" | "select" | "boolean" | "multiselect"
  @IsOptional() required?: boolean;
  @IsOptional() @IsArray() options?: string[];
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() placeholder?: string;
}

export class CreateTemplateDto {
  @IsString() nome: string;
  @IsString() categoria: string;
  @IsOptional() @IsString() descricao?: string;
  @IsArray() campos: CampoDef[];
}

export class UpsertCustomizationDto {
  @IsOptional() @IsString() templateId?: string;
  campos: Record<string, unknown>;
  @IsOptional() @IsString() observacoes?: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Sprint 3.4 — Campos Estruturados de Customização
 *
 * Templates por categoria de produto (Semirreboque, Baú, Tanque, etc.)
 * + formulário dinâmico por Pedido de Venda baseado no template selecionado.
 * Os campos preenchidos ficam pesquisáveis e são integrados com a BOM customizada.
 */
@Injectable()
export class CustomizationService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Templates ─────────────────────────────────────────────────────────────

  async findAllTemplates(companyId: string) {
    return this.prisma.customizationTemplate.findMany({
      where: { companyId, active: true },
      orderBy: { categoria: 'asc' },
    });
  }

  async findTemplate(id: string, companyId: string) {
    const t = await this.prisma.customizationTemplate.findFirst({
      where: { id, companyId },
    });
    if (!t) throw new NotFoundException(`Template ${id} não encontrado`);
    return t;
  }

  async createTemplate(companyId: string, dto: CreateTemplateDto) {
    return this.prisma.customizationTemplate.create({
      data: {
        companyId,
        nome:      dto.nome,
        categoria: dto.categoria,
        descricao: dto.descricao ?? null,
        campos:    dto.campos as any,
      },
    });
  }

  async updateTemplate(id: string, companyId: string, dto: Partial<CreateTemplateDto>) {
    await this.findTemplate(id, companyId);
    return this.prisma.customizationTemplate.update({
      where: { id },
      data: {
        nome:      dto.nome,
        categoria: dto.categoria,
        descricao: dto.descricao,
        campos:    dto.campos ? (dto.campos as any) : undefined,
      },
    });
  }

  // ── Customizações de Pedido de Venda ──────────────────────────────────────

  async getCustomization(saleOrderId: string, companyId: string) {
    return this.prisma.saleOrderCustomization.findFirst({
      where: { saleOrderId, companyId },
      include: { template: true },
    });
  }

  /**
   * Cria ou atualiza a customização de um Pedido de Venda.
   * Valida os campos obrigatórios do template se templateId for fornecido.
   */
  async upsertCustomization(
    saleOrderId: string,
    companyId: string,
    dto: UpsertCustomizationDto,
  ) {
    // Verifica que o Pedido de Venda existe
    const order = await this.prisma.saleOrder.findFirst({
      where: { id: saleOrderId, companyId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException(`Pedido de Venda ${saleOrderId} não encontrado`);

    // Valida campos obrigatórios do template
    if (dto.templateId) {
      const template = await this.findTemplate(dto.templateId, companyId);
      const campos = template.campos as unknown as CampoDef[];
      const missing = campos
        .filter((c) => c.required)
        .filter((c) => dto.campos[c.key] === undefined || dto.campos[c.key] === null || dto.campos[c.key] === '');

      if (missing.length > 0) {
        throw new NotFoundException(
          `Campo(s) obrigatório(s) não preenchido(s): ${missing.map((c) => c.label).join(', ')}`,
        );
      }
    }

    return this.prisma.saleOrderCustomization.upsert({
      where:  { saleOrderId },
      create: {
        companyId,
        saleOrderId,
        templateId:  dto.templateId ?? null,
        campos:      dto.campos as any,
        observacoes: dto.observacoes ?? null,
      },
      update: {
        templateId:  dto.templateId ?? null,
        campos:      dto.campos as any,
        observacoes: dto.observacoes ?? null,
      },
      include: { template: true },
    });
  }

  /**
   * Retorna os campos do template no formato adequado para renderização
   * de formulário dinâmico no frontend.
   */
  async getTemplateForm(templateId: string, companyId: string) {
    const template = await this.findTemplate(templateId, companyId);
    return {
      templateId: template.id,
      categoria:  template.categoria,
      nome:       template.nome,
      campos:     template.campos as unknown as CampoDef[],
    };
  }

  // ── Templates padrão ──────────────────────────────────────────────────────

  /**
   * Seed de templates padrão para fabricantes de implementos rodoviários.
   * Chamado uma única vez durante a configuração da empresa.
   */
  async seedDefaultTemplates(companyId: string) {
    const defaults = [
      {
        nome:      'Semirreboque Carga Geral',
        categoria: 'SEMIRREBOQUE',
        descricao: 'Template para semirreboquess de carga geral / baú / grade baixa',
        campos: [
          { key: 'comprimento',    label: 'Comprimento (m)',  type: 'number', required: true,  unit: 'm' },
          { key: 'largura',        label: 'Largura (m)',      type: 'number', required: true,  unit: 'm' },
          { key: 'altura_interna', label: 'Altura interna (m)', type: 'number', required: false, unit: 'm' },
          { key: 'eixos',          label: 'Número de eixos',  type: 'select', required: true,  options: ['2', '3', '4'] },
          { key: 'suspensao',      label: 'Suspensão',        type: 'select', required: true,  options: ['Mecânica', 'Pneumática', 'Mista'] },
          { key: 'piso',           label: 'Tipo de piso',     type: 'select', required: false, options: ['Madeira', 'Alumínio', 'Aço'] },
          { key: 'cor_externa',    label: 'Cor externa',      type: 'text',   required: false },
          { key: 'pneus',          label: 'Especificação pneus', type: 'text', required: false },
          { key: 'capacidade_kg',  label: 'Capacidade (kg)',  type: 'number', required: false, unit: 'kg' },
          { key: 'observacoes_tecnicas', label: 'Obs. técnicas', type: 'text', required: false },
        ],
      },
      {
        nome:      'Tanque Rodoviário',
        categoria: 'TANQUE',
        descricao: 'Template para tanques rodoviários de combustível, químicos e alimentícios',
        campos: [
          { key: 'capacidade_litros', label: 'Capacidade (litros)', type: 'number', required: true,  unit: 'L' },
          { key: 'produto',           label: 'Produto transportado', type: 'text',   required: true },
          { key: 'compartimentos',    label: 'Nº compartimentos',   type: 'number', required: true },
          { key: 'material',          label: 'Material do tanque',  type: 'select', required: true,  options: ['Aço Carbono', 'Aço Inox 304', 'Aço Inox 316', 'Alumínio'] },
          { key: 'isolamento',        label: 'Isolamento térmico',  type: 'boolean', required: false },
          { key: 'eixos',             label: 'Número de eixos',     type: 'select', required: true,  options: ['2', '3', '4'] },
        ],
      },
      {
        nome:      'Plataforma / Lowboy',
        categoria: 'PLATAFORMA',
        descricao: 'Template para plataformas e lowboys para carga especial',
        campos: [
          { key: 'comprimento',   label: 'Comprimento (m)', type: 'number', required: true,  unit: 'm' },
          { key: 'largura',       label: 'Largura (m)',     type: 'number', required: true,  unit: 'm' },
          { key: 'capacidade_t',  label: 'Capacidade (t)',  type: 'number', required: true,  unit: 't' },
          { key: 'eixos',         label: 'Número de eixos', type: 'select', required: true,  options: ['2', '3', '4', '5', '6+'] },
          { key: 'rampa',         label: 'Com rampa',       type: 'boolean', required: false },
          { key: 'extensivel',    label: 'Extensível',      type: 'boolean', required: false },
        ],
      },
    ];

    let created = 0;
    for (const t of defaults) {
      const exists = await this.prisma.customizationTemplate.findFirst({
        where: { companyId, categoria: t.categoria },
      });
      if (!exists) {
        await this.prisma.customizationTemplate.create({
          data: { companyId, ...t, campos: t.campos as any },
        });
        created++;
      }
    }

    return { created, message: `${created} template(s) padrão criado(s)` };
  }
}

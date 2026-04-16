import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  Min,
} from 'class-validator';

export class CreateStockMovementDto {
  @IsString()
  productId: string;

  @IsString()
  locationId: string;

  @IsOptional()
  @IsString()
  locationDestinationId?: string;

  @IsString()
  @IsIn([
    'ENTRADA',
    'SAIDA',
    'TRANSFERENCIA',
    'AJUSTE_POSITIVO',
    'AJUSTE_NEGATIVO',
    'CONSUMO_INTERNO',
    'DEVOLUCAO',
  ])
  type: string;

  @IsString()
  @IsIn([
    'COMPRA',
    'VENDA',
    'PRODUCAO',
    'REQUISICAO',
    'INVENTARIO',
    'AJUSTE',
    'DEVOLUCAO_CLIENTE',
    'DEVOLUCAO_FORNECEDOR',
    'RGGF',   // A7/A8: Gastos Gerais de Fabricação
    'RUC',    // A8: Requisição de Uso e Consumo
    'OS',     // A8: Ordem de Serviço
  ])
  source: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @IsOptional()
  @IsString()
  saleOrderId?: string;

  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @IsOptional()
  @IsString()
  requisitionId?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}

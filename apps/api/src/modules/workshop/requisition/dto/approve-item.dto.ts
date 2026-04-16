import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum ApproveItemAction {
  APROVAR = 'APROVAR',
  REJEITAR = 'REJEITAR',
}

export class ApproveRequisitionSingleItemDto {
  @IsEnum(ApproveItemAction)
  action: ApproveItemAction;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityApproved?: number;

  @IsOptional()
  @IsString()
  motivoRejeicao?: string;
}

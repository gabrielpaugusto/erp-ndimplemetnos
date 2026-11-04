import { IsBoolean, IsOptional } from 'class-validator';
import { ClassificacaoFiscal } from '../classificador.service';

export class ResolverExcecaoDto {
  @IsBoolean() aceitar: boolean;
  @IsOptional() resolucao?: Partial<ClassificacaoFiscal>;
}

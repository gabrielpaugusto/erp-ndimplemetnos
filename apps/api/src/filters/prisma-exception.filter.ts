import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Converts Prisma-specific errors into meaningful HTTP responses instead of HTTP 500.
 *
 * P2003 — Foreign key constraint violation → 409 Conflict
 * P2025 — Record not found (delete/update) → 404 Not Found
 * P2002 — Unique constraint violation → 409 Conflict
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    this.logger.warn(`Prisma ${exception.code}: ${exception.message}`);

    switch (exception.code) {
      case 'P2025':
        return res.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Registro não encontrado.',
          error: 'Not Found',
        });

      case 'P2003':
        return res.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message:
            'Não é possível excluir este registro pois ele possui vínculos com outros dados.',
          error: 'Conflict',
        });

      case 'P2002': {
        const field = (exception.meta?.target as string[])?.join(', ') ?? 'campo';
        return res.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: `Já existe um registro com o mesmo valor para: ${field}.`,
          error: 'Conflict',
        });
      }

      default:
        this.logger.error(`Unhandled Prisma error ${exception.code}`, exception.stack);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Erro interno do servidor.',
          error: 'Internal Server Error',
        });
    }
  }
}

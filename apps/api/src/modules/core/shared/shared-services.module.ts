import { Global, Module } from '@nestjs/common';
import { DocumentEventService } from '../audit/document-event.service';
import { FieldLockService } from '../field-lock/field-lock.service';
import { StockReservationService } from '../stock-reservation/stock-reservation.service';

/**
 * Sprint 2 — Módulo global que provê os services de rastreabilidade e controle.
 * @Global() garante que DocumentEventService, FieldLockService e StockReservationService
 * estão disponíveis em todos os módulos sem importação explícita.
 */
@Global()
@Module({
  providers: [
    DocumentEventService,
    FieldLockService,
    StockReservationService,
  ],
  exports: [
    DocumentEventService,
    FieldLockService,
    StockReservationService,
  ],
})
export class SharedServicesModule {}

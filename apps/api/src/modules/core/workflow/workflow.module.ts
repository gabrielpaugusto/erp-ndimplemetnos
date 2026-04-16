import { Global, Module } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowEngineController } from './workflow-engine.controller';

/**
 * Sprint 4.4 — Workflow Engine Module
 * @Global para que WorkflowEngineService possa ser injetado em qualquer módulo
 * que precise disparar eventos de workflow (SaleOrders, ProductionOrders, etc.)
 */
@Global()
@Module({
  controllers: [WorkflowEngineController],
  providers:   [WorkflowEngineService],
  exports:     [WorkflowEngineService],
})
export class WorkflowModule {}

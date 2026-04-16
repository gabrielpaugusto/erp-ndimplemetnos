import { AsyncLocalStorage } from 'async_hooks';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export const auditStorage = new AsyncLocalStorage<AuditContext>();

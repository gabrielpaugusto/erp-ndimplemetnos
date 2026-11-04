import { AsyncLocalStorage } from 'async_hooks';

export interface AuditContext {
  userId?: string;
  companyId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export const auditStorage = new AsyncLocalStorage<AuditContext>();

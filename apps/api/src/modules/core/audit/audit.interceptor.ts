import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { auditStorage } from './audit.context';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id ?? request.user?.sub;
    const ipAddress =
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? request.ip ?? '';
    const userAgent = request.headers['user-agent'] ?? '';

    return new Observable((subscriber) => {
      auditStorage.run({ userId, ipAddress, userAgent }, () => {
        next
          .handle()
          .subscribe({
            next: (value) => subscriber.next(value),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
      });
    });
  }
}

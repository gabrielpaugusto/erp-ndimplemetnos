import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

// Auth
import { PortalAuthService } from './portal-auth.service';
import { PortalAuthController } from './portal-auth.controller';
import { PortalAuthGuard } from './guards/portal-auth.guard';

// Tickets
import { PortalTicketsService } from './portal-tickets.service';
import { PortalTicketsController } from './portal-tickets.controller';
import { TicketManagementController } from './ticket-management.controller';

// Documents
import { PortalDocumentsService } from './portal-documents.service';
import { PortalDocumentsController } from './portal-documents.controller';
import { DocumentSharingController } from './document-sharing.controller';

// Notifications
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRY', '15m'),
        },
      }),
    }),
  ],
  controllers: [
    PortalAuthController,
    PortalTicketsController,
    TicketManagementController,
    PortalDocumentsController,
    DocumentSharingController,
    NotificationsController,
  ],
  providers: [
    PortalAuthService,
    PortalAuthGuard,
    PortalTicketsService,
    PortalDocumentsService,
    NotificationsService,
  ],
  exports: [
    PortalAuthService,
    PortalAuthGuard,
    PortalTicketsService,
    PortalDocumentsService,
    NotificationsService,
  ],
})
export class PortalModule {}

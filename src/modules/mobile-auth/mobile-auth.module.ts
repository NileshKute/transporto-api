import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { WhatsappMetaModule } from '../whatsapp-meta/whatsapp-meta.module';
import { MobileAuthController } from './mobile-auth.controller';
import { MobileAuthService } from './mobile-auth.service';

@Module({
  imports: [
    PrismaModule,
    WhatsappMetaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'transporto-super-secret-jwt-key-2026',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  controllers: [MobileAuthController],
  providers: [MobileAuthService],
  exports: [MobileAuthService],
})
export class MobileAuthModule {}

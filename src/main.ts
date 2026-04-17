import { webcrypto } from 'crypto';
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto;
}

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as bodyParser from 'body-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust Railway's reverse proxy
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(url => url.trim().replace(/\/$/, ''))
    : ['http://localhost:3000'];

  // Run CORS before body parsers and helmet so OPTIONS preflight always gets a clean response.
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  });

  console.log(`🔒 CORS allowed origins: ${allowedOrigins.join(', ')}`);

  app.use(
    bodyParser.json({
      limit: '50mb',
      verify: (req: { rawBody?: Buffer; method?: string; originalUrl?: string; url?: string }, _res, buf: Buffer) => {
        const url = req.originalUrl || req.url || '';
        if (
          req.method === 'POST' &&
          url.includes('/whatsapp/meta/webhook')
        ) {
          req.rawBody = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
        }
      },
    }),
  );
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  app.use(
    helmet({
      // Default is same-origin; APIs consumed from another origin need cross-origin so the
      // browser can read responses after CORS checks (see Cross-Origin-Resource-Policy).
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Transporto API')
    .setDescription('Transportation Fleet & Cold Storage Management System API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Dashboard', 'Aggregated stats and recent activity')
    .addTag('Vehicles', 'Vehicle management')
    .addTag(
      'GPS',
      'GeoTrackers sync, GpsLive/GpsHistory, share links (public GET /api/gps/track/:token)',
    )
    .addTag('Drivers', 'Driver management')
    .addTag('Trips', 'Trip management')
    .addTag('Fuel', 'Fuel entry management')
    .addTag('BPCL SmartFleet', 'BPCL Excel import and fleet card tagging')
    .addTag('Toll', 'Kotak FASTag toll Excel import and analytics')
    .addTag('Maintenance', 'Vehicle maintenance records')
    .addTag('Vehicle Maintenance Book', 'Truck/reefer service log and configurable types')
    .addTag('Emergencies', 'Emergency reporting and management')
    .addTag('Insurance', 'Insurance policy management')
    .addTag('Cold Storage', 'Cold storage unit monitoring')
    .addTag('Shifts', 'Driver shift management')
    .addTag('WhatsApp', 'WhatsApp message integration (Twilio)')
    .addTag('WhatsappMeta', 'WhatsApp Cloud API (Meta) — webhooks & send')
    .addTag('Clients', 'Billing clients and vehicle assignments')
    .addTag('Invoices', 'Invoice generation and PDF')
    .addTag('Quotations', 'Client quotations, PDF, import, convert to invoice')
    .addTag('Permissions', 'Role-based access control matrix')
    .addTag('MobileAuth', 'Mobile phone OTP login')
    .addTag('MobileTrip', 'Mobile trip start/end/GPS tracking')
    .addTag('MobileDriver', 'Mobile driver profile, salary, ledger')
    .addTag('MobileFleet', 'Mobile fleet manager views')
    .addTag('DocumentExpiry', 'Document expiry alerts and reminders')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`\n🚛 Transporto API running on port ${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
}

bootstrap();

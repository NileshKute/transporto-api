import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust Railway's reverse proxy
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  app.use(helmet());

  const frontendUrls = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((url) => url.trim()).filter(Boolean)
    : [];
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    ...frontendUrls,
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

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
    .addTag('Drivers', 'Driver management')
    .addTag('Trips', 'Trip management')
    .addTag('Fuel', 'Fuel entry management')
    .addTag('Maintenance', 'Vehicle maintenance records')
    .addTag('Emergencies', 'Emergency reporting and management')
    .addTag('Insurance', 'Insurance policy management')
    .addTag('Cold Storage', 'Cold storage unit monitoring')
    .addTag('Shifts', 'Driver shift management')
    .addTag('WhatsApp', 'WhatsApp message integration')
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

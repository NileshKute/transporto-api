import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:3001', process.env.FRONTEND_URL].filter(Boolean),
    credentials: true,
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
  await app.listen(port);

  console.log(`\n🚛 Transporto API running on http://localhost:${port}/api`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs\n`);
}

bootstrap();

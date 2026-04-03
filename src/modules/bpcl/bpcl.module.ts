import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BpclController } from './bpcl.controller';
import { BpclService } from './bpcl.service';
import { BpclCardService } from './bpcl-card.service';

@Module({
  imports: [PrismaModule],
  controllers: [BpclController],
  providers: [BpclService, BpclCardService],
  exports: [BpclService, BpclCardService],
})
export class BpclModule {}

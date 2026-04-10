import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TollController } from './toll.controller';
import { TollService } from './toll.service';

@Module({
  imports: [PrismaModule],
  controllers: [TollController],
  providers: [TollService],
  exports: [TollService],
})
export class TollModule {}

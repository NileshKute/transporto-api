import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EmergenciesService } from './emergencies.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Emergencies')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('emergencies')
export class EmergenciesController {
  constructor(private emergenciesService: EmergenciesService) {}

  @Get()
  @ApiOperation({ summary: 'List all emergencies with status filter and pagination' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query() query: any) {
    return this.emergenciesService.findAll(query);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Report a new emergency' })
  create(@Body() dto: any) {
    return this.emergenciesService.create(dto);
  }

  @Put(':id/resolve')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Resolve an emergency with resolution notes' })
  resolve(@Param('id') id: string, @Body() dto: any) {
    return this.emergenciesService.resolve(id, dto);
  }
}

import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Shifts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private shiftsService: ShiftsService) {}

  @Get()
  @ApiOperation({ summary: 'List all shifts with filters and pagination' })
  @ApiQuery({ name: 'driverId', required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query() query: any) {
    return this.shiftsService.findAll(query);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new shift' })
  create(@Body() dto: any) {
    return this.shiftsService.create(dto);
  }

  @Put(':id/start')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Start a shift (set ACTIVE and startTime)' })
  start(@Param('id') id: string) {
    return this.shiftsService.start(id);
  }

  @Put(':id/end')
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'End a shift (compute hoursWorked and overtime > 10h)' })
  end(@Param('id') id: string, @Body() dto: any) {
    return this.shiftsService.end(id, dto);
  }
}

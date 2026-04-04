import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Partial vehicle updates; body may include other fields (see VehiclesService.parseVehicleDto). */
export class UpdateVehicleDto {
  @ApiPropertyOptional({
    description:
      'Map icon key (e.g. reefer_truck, mini_truck, medium_truck, large_truck, container, van, pickup, tanker, tempo, bike)',
    example: 'reefer_truck',
  })
  @IsOptional()
  @IsString()
  iconType?: string;
}

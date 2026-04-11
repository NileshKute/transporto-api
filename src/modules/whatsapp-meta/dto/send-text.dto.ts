import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class SendTextDto {
  @ApiProperty({ description: 'Recipient WhatsApp ID (digits, no +)' })
  @IsString()
  @MinLength(5)
  to!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  text!: string;
}

export class LinkContactDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;
}

export class SendTemplateDto {
  @ApiProperty()
  @IsString()
  to!: string;

  @ApiProperty()
  @IsString()
  templateName!: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  languageCode!: string;

  @ApiPropertyOptional({
    description: 'Meta template components JSON (optional)',
  })
  @IsOptional()
  components?: unknown;
}

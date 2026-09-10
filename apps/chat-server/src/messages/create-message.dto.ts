import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @MaxLength(10000)
  bodyMd: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @IsUUID()
  clientMessageId: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
}

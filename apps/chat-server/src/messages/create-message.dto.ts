import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateMessageDto{
    @IsString()
    @MinLength(1)
    @MaxLength(10000)
    bodyMd: string;

    @IsOptional()
    @IsUUID()
    replyToId: string;

    @IsUUID()
    clientMessageId: string;
}
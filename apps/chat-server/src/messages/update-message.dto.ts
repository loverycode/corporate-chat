import {IsString, MinLength, MaxLength} from "class-validator";

export class UpdateMessageDto{
    @IsString()
    @MinLength(1)
    @MaxLength(10000)
    bodyMd: string;
}
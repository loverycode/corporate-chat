import { ChannelType } from "@prisma/client";
import { IsString, IsOptional, IsArray, IsEnum, IsUUID, ArrayMinSize } from "class-validator";
export class CreateChannelDto{
    @IsEnum(ChannelType)
    type: ChannelType;

    @IsOptional()
    @IsString()
    title?:string;

    @IsOptional()
    @IsUUID()
    contextObjectId?:string;

    @IsArray()
    @IsUUID('4', {each: true})
    members:string[];
}
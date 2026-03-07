import { IsString } from "class-validator";

export class UpdateOrgnizationDto {
    @IsString()
    name?: string
}
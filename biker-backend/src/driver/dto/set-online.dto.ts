import { IsBoolean } from 'class-validator';

export class SetOnlineDto {
    @IsBoolean()
    online: boolean;
}

import { IsBoolean } from 'class-validator'

export class UpdateVisibilityDto {
  @IsBoolean({ message: 'is_visible must be a boolean' })
  is_visible: boolean
}

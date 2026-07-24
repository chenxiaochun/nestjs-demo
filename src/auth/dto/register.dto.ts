import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @MinLength(6, { message: '密码长度至少为6位' })
  @IsNotEmpty({ message: '密码不能为空' })
  password!: string;
}

import { IsEmail, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty({ message: '邮箱不能为空' })
  email!: string;

  @IsNotEmpty({ message: '密码不能为空' })
  password!: string;
}

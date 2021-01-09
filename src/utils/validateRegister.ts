import { UsernamePasswordInput } from '../resolvers/UsernamePasswordInput'

export const validateRegister = (options: UsernamePasswordInput) => {
  if (!options.email.includes('@')) {
    return [
      {
        field: 'email',
        message: '이메일이 올바르지 않습니다.',
      },
    ]
  }

  if (options.username.length <= 2) {
    return [
      {
        field: 'username',
        message: '이름은 두 글자 이상이어야 합니다.',
      },
    ]
  }

  if (options.username.includes('@')) {
    return [
      {
        field: 'username',
        message: '이름에 @가 포함될 수 없습니다.',
      },
    ]
  }

  if (options.password.length <= 3) {
    return [
      {
        field: 'password',
        message: '비밀번호는 세 글자 이상이어야 합니다.',
      },
    ]
  }

  return null
}

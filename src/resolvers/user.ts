import argon2 from 'argon2'
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from 'type-graphql'
import { User } from '../entities'
import { MyContext } from '../types'
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from '../constants'
import { UsernamePasswordInput } from './UsernamePasswordInput'
import { validateRegister } from '../utils/validateRegister'
import { sendEmail } from '../utils/sendEmail'
import { v4 } from 'uuid'
import { getConnection } from 'typeorm'

@ObjectType()
class FieldError {
  @Field()
  field: string

  @Field()
  message: string
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[]

  @Field(() => User, { nullable: true })
  user?: User
}

@Resolver(User)
export class UserResolver {
  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: MyContext) {
    return req.session.userId === user.id ? user.email : ''
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() { redis, req }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length <= 3) {
      return {
        errors: [
          {
            field: 'password',
            message: '비밀번호는 세 글자 이상이어야 합니다.',
          },
        ],
      }
    }

    const key = `${FORGET_PASSWORD_PREFIX}${token}`
    const userIdStr = await redis.get(key)

    if (!userIdStr) {
      return {
        errors: [
          {
            field: 'token',
            message: '토큰이 만료되었습니다.',
          },
        ],
      }
    }

    const userId = parseInt(userIdStr)
    const user = await User.findOne(userId)

    if (!user) {
      return {
        errors: [
          {
            field: 'token',
            message: '유저가 존재하지 않습니다.',
          },
        ],
      }
    }

    await User.update(
      { id: userId },
      {
        password: await argon2.hash(newPassword),
      }
    )
    await redis.del(key)

    req.session.userId = user.id

    return { user }
  }

  @Mutation(() => Boolean)
  async forgotPassowrd(
    @Arg('email') email: string,
    @Ctx() { redis }: MyContext
  ) {
    const user = await User.findOne({ where: { email } })
    if (!user) return true

    const token = v4()

    await redis.set(
      `${FORGET_PASSWORD_PREFIX}${token}`,
      user.id,
      'ex',
      1000 * 60 * 60 * 24 * 3 // 3일
    )

    sendEmail(
      email,
      'Change Password',
      `<a href="http://localhost:3000/change-password/${token}">reset password</a>`
    )

    return true
  }

  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: MyContext) {
    const id = req.session.userId
    if (!id) return null

    return User.findOne(id)
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg('options') options: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const errors = validateRegister(options)
    if (errors) return { errors }

    const hashedPassword = await argon2.hash(options.password)
    let user
    try {
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          email: options.email,
          username: options.username,
          password: hashedPassword,
        })
        .returning('*')
        .execute()

      user = result.raw[0]
    } catch (err) {
      if (err.code === '23505') {
        return {
          errors: [
            {
              field: 'username',
              message: '이미 존재하는 유저입니다.',
            },
          ],
        }
      }
    }
    // store user id session
    // this will set a cookie on the user
    // keep them logged in
    req.session.userId = user.id

    return { user }
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('usernameOrEmail') usernameOrEmail: string,
    @Arg('password') password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne(
      usernameOrEmail.includes('@')
        ? { where: { email: usernameOrEmail } }
        : { where: { username: usernameOrEmail } }
    )
    if (!user) {
      return {
        errors: [
          { field: 'usernameOrEmail', message: '유저가 존재하지 않습니다.' },
        ],
      }
    }

    const valid = await argon2.verify(user.password, password)

    if (!valid) {
      return {
        errors: [
          { field: 'password', message: '비밀번호가 올바르지 않습니다.' },
        ],
      }
    }

    req.session.userId = user.id

    return { user }
  }

  @Mutation(() => Boolean)
  async logout(@Ctx() { req, res }: MyContext): Promise<Boolean> {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME)
        resolve(!!err)
      })
    )
  }
}

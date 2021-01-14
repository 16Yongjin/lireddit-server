import { isAuth } from '../middleware/isAuth'
import { MyContext } from '../types'
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from 'type-graphql'
import { Post, Updoot, User } from '../entities'
import { getConnection } from 'typeorm'

@InputType()
class PostInput {
  @Field()
  title: string

  @Field()
  text: string
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[]

  @Field()
  hasMore: boolean
}

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() post: Post) {
    return post.text.slice(0, 50)
  }

  @FieldResolver(() => User)
  creator(@Root() post: Post, @Ctx() { userLoader }: MyContext) {
    return userLoader.load(post.creatorId)
  }

  @FieldResolver(() => Int, { nullable: true })
  async voteStatus(
    @Root() post: Post,
    @Ctx() { req, updootLoader }: MyContext
  ) {
    const { userId } = req.session
    if (!userId) return null

    const updoot = await updootLoader.load({ postId: post.id, userId })
    return updoot ? updoot.value : null
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg('postId', () => Int) postId: number,
    @Arg('value', () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const { userId } = req.session
    const isUpdoot = value !== -1
    const voteValue = isUpdoot ? 1 : -1

    const updoot = await Updoot.findOne({ where: { userId, postId } })

    if (updoot && updoot.value !== voteValue) {
      // 이미 투표 완료 but 값 변경 시도
      await getConnection().transaction(async (tm) => {
        await tm.query(`
          update updoot
          set value = ${voteValue}
          where "postId" = ${postId} and "userId" = ${userId}
        `)

        await tm.query(`
          update post
          set points = points + ${voteValue * 2}
          where id = ${postId};
        `)
      })
    } else if (!updoot) {
      // 처음 투표함
      await getConnection().transaction(async (tm) => {
        await tm.query(`
          insert into updoot ("userId", "postId", value)
          values (${userId}, ${postId}, ${voteValue});
        `)

        await tm.query(`
          update post
          set points = points + ${voteValue}
          where id = ${postId};
        `)
      })
    }
    return true
  }

  @Query(() => PaginatedPosts)
  async posts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null,
    @Ctx() { req }: MyContext
  ): Promise<PaginatedPosts> {
    const { userId } = req.session
    console.log('userId', userId)
    const realLimit = Math.max(Math.min(50, limit), 0)
    const realLimitPlusOne = realLimit + 1

    const replacements: any[] = [realLimitPlusOne]

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)))
    }

    const posts = await getConnection().query(
      `
      select p.*,
      ${
        userId
          ? `(select value from updoot where "userId"=${userId} and "postId"=p.id) "voteStatus"`
          : 'null as "voteStatus"'
      }
      from post p
      ${cursor ? `where p."createdAt" < $2` : ''}
      order by p."createdAt" DESC
      limit $1
    `,
      replacements
    )

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimitPlusOne,
    }
  }

  @Query(() => Post, { nullable: true })
  post(@Arg('id', () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne(id)
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  createPost(
    @Arg('input', () => PostInput) input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    return Post.create({
      ...input,
      creatorId: req.session.userId,
    }).save()
  }

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg('id', () => Int) id: number,
    @Arg('title') title: string,
    @Arg('text') text: string,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    const { userId: creatorId } = req.session

    const result = await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('id = :id and "creatorId" = :creatorId', { id, creatorId })
      .returning('*')
      .execute()

    return result.raw[0]
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg('id', () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    const { userId } = req.session

    const post = await Post.findOne({ id })
    if (!post) return false

    if (post.creatorId !== userId) {
      throw new Error('not authorized')
    }

    await Post.delete({ id, creatorId: userId })
    return true
  }
}

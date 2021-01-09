import { isAuth } from '../middleware/isAuth'
import { MyContext } from '../types'
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Info,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from 'type-graphql'
import { Post, Updoot } from '../entities'
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
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 50)
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
    await Updoot.insert({
      userId,
      postId,
      value: voteValue,
    })

    await getConnection().query(`
    update post p
    set p.points = p.points + $1
    where p.id = $2
    `, [voteValue, postId])

    
    return true
  }



  @Query(() => PaginatedPosts)
  async posts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null,
    @Info() info: any
  ): Promise<PaginatedPosts> {
    console.log(info)
    const realLimit = Math.max(Math.min(50, limit), 0)
    const realLimitPlusOne = realLimit + 1

    const replacements: any[] = [realLimitPlusOne]

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)))
    }

    const posts = await getConnection().query(
      `
      select p.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'email', u.email,
        'createdAt', u."createdAt",
        'updatedAt', u."updatedAt"
      ) creator
      from post p 
      inner join public.user u on u.id = p."creatorId"
      ${cursor ? `where p."createdAt < $2` : ''}
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
  post(@Arg('id') id: number): Promise<Post | undefined> {
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
    @Arg('id') id: number,
    @Arg('title', () => String, { nullable: true }) title: string
  ): Promise<Post | null> {
    const post = await Post.findOne(id)
    if (!post) return null

    if (typeof title !== 'undefined') {
      post.title = title
      Post.update({ id }, { title })
    }

    return post
  }

  @Mutation(() => Boolean)
  async deletePost(@Arg('id') id: number): Promise<boolean> {
    await Post.delete(id)
    return true
  }
}

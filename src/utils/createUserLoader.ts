import DataLoader from 'dataloader'
import { User } from '../entities'

export const createUserLoader = () =>
  new DataLoader<number, User>(async (userIds) => {
    const users = await User.findByIds(userIds as number[])
    console.log(users.map((u) => u.id))
    const userIdToUser = users.reduce(
      (record, user) => ((record[user.id] = user), record),
      {} as Record<number, User>
    )

    const sortedUsers = userIds.map((userId) => userIdToUser[userId])
    return sortedUsers
  })

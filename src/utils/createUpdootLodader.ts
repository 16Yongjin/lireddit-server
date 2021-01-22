import DataLoader from 'dataloader'
import { Updoot } from '../entities'

type UpdootKey = {
  postId: number
  userId: number
}

const keyToStr = (key: UpdootKey) => `${key.postId}|${key.userId}`

export const createUpdootLoader = () =>
  new DataLoader<UpdootKey, Updoot | null>(async (keys) => {
    const updoots = await Updoot.findByIds(keys as any)
    const updootIdToUpdoot = updoots.reduce(
      (record, updoot) => ((record[keyToStr(updoot)] = updoot), record),
      {} as Record<string, Updoot>
    )

    const sortedUpdoots = keys.map((key) => updootIdToUpdoot[keyToStr(key)])
    return sortedUpdoots
  })

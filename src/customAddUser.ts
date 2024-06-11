import { Buffer } from 'node:buffer'
import { $fetch } from 'ofetch'

export async function customAddUser(users: { user: string; monthlyDollars: number }[]) {
  const customData: any[] = []
  await Promise.all(users.map(({ user, monthlyDollars }) => {
    return new Promise((resolve) => {
      $fetch(`https://api.github.com/users/${user}`, {
        responseType: 'json',
      })
        .then(async (data: any) => {
          // 提取头像地址和仓库地址
          customData.push({
            sponsor: {
              type: 'User',
              name: user,
              login: user,
              avatarUrl: data.avatar_url,
              linkUrl: `https://github.com/${user}`,
            },
            monthlyDollars,
          })
          resolve(customData)
        })
        .catch((error: any) => {
          console.error('获取用户信息失败:', error)
          resolve(customData)
        })
    })
  }))
  return customData
}

export function toBase64(url: string) {
  return new Promise((resolve) => {
    $fetch(url, { responseType: 'arrayBuffer' }).then((arrayBuffer) => {
      const buffer = Buffer.from(arrayBuffer)
      const base64 = buffer.toString('base64')
      resolve(`data:image/png;base64,${base64}`)
    })
  })
}

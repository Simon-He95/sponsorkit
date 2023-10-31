import fetch from 'node-fetch'

export async function customAddUser(users: { user: string; monthlyDollars: number }[]) {
  const customData: any[] = []
  await Promise.all(users.map(({ user, monthlyDollars }) => {
    return new Promise((resolve, reject) => {
      fetch(`https://api.github.com/users/${user}`)
        .then((response: any) => response.json())
        .then((data: any) => {
          // 提取头像地址和仓库地址
          customData.push({
            tierName: 'Sponsors',
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
          reject(error)
        })
    })
  }))
  return customData
}

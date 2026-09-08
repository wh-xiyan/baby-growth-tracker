import type { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { bootstrapSession } from './services/auth'
import { getCloudEnvId, isCloudConfigured } from './services/cloud'
import { useSessionStore } from './stores/session'
// 全局样式
import './app.scss'

function App(props: PropsWithChildren) {
  const setSession = useSessionStore((state) => state.setSession)
  const setInitialized = useSessionStore((state) => state.setInitialized)

  useLaunch(() => {
    if (isCloudConfigured()) {
      Taro.cloud.init({ env: getCloudEnvId(), traceUser: true })
    }
    bootstrapSession()
      .then((session) =>
        setSession({
          ...session,
          userId: session.user.id,
          familyId: session.family?.id,
          childId: session.currentChildId,
        }),
      )
      .catch((error) => {
        console.error('云端登录初始化失败，请查看控制台', error)
        Taro.showToast({ title: '登录初始化失败', icon: 'none' })
      })
      .finally(() => setInitialized(true))
  })

  return props.children
}

export default App

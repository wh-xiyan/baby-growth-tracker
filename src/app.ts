import type { PropsWithChildren } from 'react'
// 全局样式
import './app.scss'

function App(props: PropsWithChildren) {
  return props.children
}

export default App

import Taro, { useDidShow } from '@tarojs/taro'

const previewPages = new WeakSet<object>()

/** Native media preview resumes the same page; preserve its data and interaction state. */
export function previewMedia(sources: { url: string; type: 'image' | 'video' }[], current = 0) {
  const pages = Taro.getCurrentPages()
  const page = pages[pages.length - 1]
  if (page) previewPages.add(page)
  return Taro.previewMedia({ sources, current }).catch((error) => {
    if (page) previewPages.delete(page)
    throw error
  })
}

export function usePageDidShow(callback: () => void) {
  useDidShow(() => {
    const pages = Taro.getCurrentPages()
    const page = pages[pages.length - 1]
    if (page && previewPages.has(page)) {
      previewPages.delete(page)
      return
    }
    callback()
  })
}

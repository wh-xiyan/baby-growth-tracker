import { Canvas, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect } from 'react'

export interface ChartPoint {
  date: string
  value: number
}
export function GrowthChart({
  points,
  metric,
}: {
  points: ChartPoint[]
  metric: 'height' | 'weight'
}) {
  useEffect(() => {
    if (points.length < 2) return
    const task = Taro.createSelectorQuery().select('#growth-chart').boundingClientRect()
    task.exec((result) => {
      const bounds = result[0] as { width: number; height: number } | undefined
      if (!bounds?.width) return
      const context = Taro.createCanvasContext('growth-chart')
      const width = bounds.width
      const height = bounds.height
      const values = points.map((point) => point.value)
      const low = Math.min(...values)
      const span = Math.max(...values) - low || 1
      const coordinates = points.map((point, index) => ({
        x: 16 + (index * (width - 32)) / (points.length - 1),
        y: 18 + (1 - (point.value - low) / span) * (height - 36),
      }))
      context.clearRect(0, 0, width, height)
      context.setStrokeStyle('#7FA68A')
      context.setLineWidth(2)
      context.beginPath()
      coordinates.forEach((point, index) =>
        index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y),
      )
      context.stroke()
      context.setFillStyle('#7FA68A')
      coordinates.forEach((point) => {
        context.beginPath()
        context.arc(point.x, point.y, 3, 0, Math.PI * 2)
        context.fill()
      })
      context.draw()
    })
  }, [points, metric])
  if (points.length < 2)
    return (
      <View className='muted chart-empty'>
        {points.length ? '再记录一次，就能看见变化趋势' : '还没有测量记录'}
      </View>
    )
  return (
    <View>
      <Canvas
        id='growth-chart'
        canvasId='growth-chart'
        style={{ width: '100%', height: '120px' }}
      />
      <View
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#6B7A70',
        }}
      >
        <Text>{points[0].date}</Text>
        <Text>{metric === 'height' ? '身高 · cm' : '体重 · kg'}</Text>
        <Text>{points[points.length - 1].date}</Text>
      </View>
    </View>
  )
}

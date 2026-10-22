import { Canvas, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef } from 'react'
import type { GrowthMetric, GrowthPoint, StandardRow } from '../../../types/growth'
import { growthUnits } from '../../../utils/growth'

type Position = { x: number; y: number; id: string }
export function GrowthReferenceChart({
  points,
  hidden,
  rows,
  metric,
  selectedId,
  showAll,
  onSelect,
}: {
  hidden?: boolean
  points: GrowthPoint[]
  rows: StandardRow[]
  metric: GrowthMetric
  selectedId?: string
  showAll: boolean
  onSelect: (id: string) => void
}) {
  const positions = useRef<Position[]>([]),
    seq = useRef(0)
  useEffect(() => {
    const sequence = seq
    const request = ++sequence.current
    if (hidden) return
    Taro.nextTick(() =>
      Taro.createSelectorQuery()
        .select('#growth-reference-chart')
        .boundingClientRect()
        .exec((result) => {
          const bounds = result[0] as { width: number; height: number } | undefined
          if (!bounds?.width || !points.length || request !== sequence.current) return
          const ctx = Taro.createCanvasContext('growth-reference-chart'),
            w = bounds.width,
            h = bounds.height
          const left = 36,
            right = w - 32,
            top = 20,
            bottom = h - 38
          const min = Math.max(0, Math.min(...points.map((p) => p.age)) - 1),
            max = Math.max(min + 2, Math.max(...points.map((p) => p.age)) + 1)
          const visible = rows.filter(
            (r, i) =>
              (r[0] >= min && r[0] <= max) ||
              (r[0] < min && rows[i + 1]?.[0] > min) ||
              (r[0] > max && rows[i - 1]?.[0] < max),
          )
          const vals = [...points.map((p) => p.value), ...visible.flatMap((r) => [r[1], r[7]])],
            vmin = Math.min(...vals),
            vmax = Math.max(...vals),
            pad = (vmax - vmin) * 0.12 || 1
          const low = vmin - pad,
            high = vmax + pad,
            x = (age: number) => left + ((age - min) / (max - min)) * (right - left),
            y = (value: number) => bottom - ((value - low) / (high - low)) * (bottom - top)
          ctx.clearRect(0, 0, w, h)
          ctx.setFontSize(10)
          ctx.setTextAlign('right')
          ctx.setFillStyle('#778279')
          ctx.setLineWidth(1)
          for (let i = 0; i < 5; i++) {
            const v = low + ((high - low) * i) / 4,
              yy = y(v)
            ctx.setStrokeStyle('#e6e8de')
            ctx.beginPath()
            ctx.moveTo(left, yy)
            ctx.lineTo(right, yy)
            ctx.stroke()
            ctx.fillText(v.toFixed(1), left - 5, yy + 3)
          }
          ctx.fillText(growthUnits[metric], left - 4, 10)
          ctx.setTextAlign('center')
          for (let i = 0; i < 4; i++) {
            const age = min + ((max - min) * i) / 3
            ctx.fillText(age.toFixed(1), x(age), bottom + 18)
          }
          ctx.fillText('测量时月龄（月）', (left + right) / 2, h - 3)
          ctx.save()
          ctx.beginPath()
          ctx.rect(left, top, right - left, bottom - top)
          ctx.clip()
          const cols = showAll ? [1, 2, 3, 4, 5, 6, 7] : [1, 4, 7]
          for (const col of cols) {
            ctx.setStrokeStyle(col === 4 ? '#94aa83' : '#bec7b2')
            ctx.setLineWidth(col === 4 ? 1.5 : 1)
            ctx.setLineDash([4, 3], 0)
            ctx.beginPath()
            visible.forEach((r, i) => {
              const prev = visible[i - 1]
              if (i && !(metric === 'height' && prev[0] < 24 && r[0] >= 24))
                ctx.lineTo(x(r[0]), y(r[col]))
              else ctx.moveTo(x(r[0]), y(r[col]))
            })
            ctx.stroke()
          }
          ctx.setLineDash([], 0)
          ctx.setStrokeStyle('#496f56')
          ctx.setLineWidth(2)
          ctx.beginPath()
          points.forEach((p, i) => {
            const prev = points[i - 1]
            const breakLine =
              metric === 'height' &&
              prev &&
              (p.method !== prev.method || p.age < 24 !== prev.age < 24)
            if (i && !breakLine) ctx.lineTo(x(p.age), y(p.value))
            else ctx.moveTo(x(p.age), y(p.value))
          })
          ctx.stroke()
          positions.current = points.map((p) => ({ id: p.id, x: x(p.age), y: y(p.value) }))
          positions.current.forEach((p) => {
            ctx.setFillStyle('#fff')
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.id === selectedId ? 4.5 : 3, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
          })
          ctx.restore()
          // Label an actual visible node rather than extrapolating values at the chart edge.
          const last = visible.filter((r) => r[0] <= max && r[0] >= min).slice(-1)[0]
          if (last) {
            ctx.setFontSize(showAll ? 8 : 9)
            ctx.setTextAlign('left')
            cols.forEach((col) => {
              ctx.setFillStyle(col === 4 ? '#71865f' : '#86917c')
              ctx.fillText('P' + [0, 3, 10, 25, 50, 75, 90, 97][col], right + 4, y(last[col]) + 3)
            })
          }
          ctx.draw()
        }),
    )
    return () => {
      sequence.current++
    }
  }, [points, rows, metric, selectedId, showAll, hidden])
  return (
    <View className='growth-chart-wrap'>
      <Canvas
        hidden={hidden}
        id='growth-reference-chart'
        canvasId='growth-reference-chart'
        className='growth-reference-canvas'
        disableScroll
        onTouchEnd={(event) => {
          const touch = event.changedTouches[0]
          if (!touch) return
          const hit = positions.current
            .map((p) => ({ ...p, d: Math.hypot(touch.x - p.x, touch.y - p.y) }))
            .sort((a, b) => a.d - b.d)[0]
          if (hit && hit.d < 24) onSelect(hit.id)
        }}
      />
      <View className='growth-chart-legend'>
        <Text>宝宝实测 · 实线圆点</Text>
        {rows.length > 0 && <Text>标准参考 · 虚线</Text>}
      </View>
    </View>
  )
}

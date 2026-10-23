import { Button, Input, Picker, Text, Textarea, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { getRecord, type DailyRecord } from '../../services/records'
import { saveGrowthRecord as saveRecord } from '../../services/growth'
import { uploadMediaAsset } from '../../services/media'
import { MediaThumbnail } from '../../components/media/MediaThumbnail'
import { useSessionStore } from '../../stores/session'
import { canManageRecord, growthError } from '../../utils/growth'
import { localDate, localTime } from '../../utils/home'
import type { RecordMetrics } from '../../types/record'
import { categoryMeta } from '../record-list/constants'
import './growth-editor.scss'

const labels: Record<string, string> = {
  amount: '数量',
  durationMinutes: '时长（分钟）',
  foods: '辅食名称',
  allergy: '过敏观察',
  sleepStart: '入睡时间（含日期）',
  sleepEnd: '醒来时间（含日期）',
  temperature: '体温（℃）',
}
export function ExistingCareEditor() {
  const { params } = useRouter(),
    { familyId, childId, userId, currentRole, children } = useSessionStore()
  const [types, setTypes] = useState<Record<string, string>>({})
  const [record, setRecord] = useState<DailyRecord>(),
    [title, setTitle] = useState(''),
    [date, setDate] = useState(''),
    [time, setTime] = useState(''),
    [content, setContent] = useState(''),
    [metrics, setMetrics] = useState<RecordMetrics>({}),
    [ids, setIds] = useState<string[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const allowed =
    record &&
    record.familyId === familyId &&
    record.childId === childId &&
    canManageRecord(currentRole, userId, record)
  useEffect(() => {
    let active = true
    setLoading(true)
    if (!familyId || !childId || !params.id) {
      setLoading(false)
      return
    }
    void getRecord({ familyId, childId, recordId: params.id })
      .then((r) => {
        if (!active) return
        setRecord(r)
        setTitle(r.title)
        setDate(localDate(r.occurredAt))
        setTime(localTime(r.occurredAt))
        setContent(r.content || '')
        setMetrics(r.metrics || {})
        setIds(r.mediaFileIds || [])
        setTypes(Object.fromEntries((r.media || []).map((m) => [m.fileId, m.fileType])))
      })
      .catch((cause) => {
        if (active) setError(growthError(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [familyId, childId, params.id])
  const save = async () => {
    if (!record || !allowed || busy) return
    const nextMetrics = { ...metrics }
    const occurredAt = `${date}T${time}:00+08:00`,
      birth = children.find((c) => c.id === childId)?.birthday?.slice(0, 10)
    if (
      !title.trim() ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
      !Number.isFinite(new Date(occurredAt).getTime()) ||
      new Date(occurredAt) > new Date() ||
      (birth && date < birth)
    ) {
      setError('请填写标题以及出生后且不晚于现在的有效时间')
      return
    }
    if (metrics.sleepStart && metrics.sleepEnd) {
      const start = new Date(String(metrics.sleepStart)).getTime(),
        end = new Date(String(metrics.sleepEnd)).getTime()
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        setError('醒来时间须晚于入睡时间')
        return
      }
      nextMetrics.sleepDurationMinutes = Math.round((end - start) / 60000)
    }
    setBusy(true)
    try {
      await saveRecord(
        {
          ...record,
          title: title.trim(),
          occurredAt,
          content,
          metrics: nextMetrics,
          mediaFileIds: ids,
        },
        record,
      )
      Taro.showToast({ title: '已保存', icon: 'success' })
      await Taro.navigateBack()
    } catch (cause) {
      setError(growthError(cause))
    } finally {
      setBusy(false)
    }
  }
  const addMedia = async () => {
    if (!familyId || !childId || !allowed || busy) return
    setBusy(true)
    try {
      const uploaded = await uploadMediaAsset({ familyId, childId })
      setIds((current) => [...current, uploaded.fileId])
      setTypes((current) => ({ ...current, [uploaded.fileId]: uploaded.fileType }))
    } catch (cause) {
      setError(growthError(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <View className='growth-editor-page'>
      <Text className='growth-editor-title'>编辑记录</Text>
      {loading ? (
        <Text>正在读取…</Text>
      ) : !record ? (
        <Text>记录不可用，请返回重试</Text>
      ) : (
        <>
          <View className='growth-editor-card'>
            <Text>
              记录分类：{categoryMeta[record.category]?.label || '日常记录'} · 分类不可变更
            </Text>
            <Input
              value={title}
              maxlength={50}
              disabled={!allowed || busy}
              onInput={(e) => setTitle(e.detail.value)}
            />
            <Picker
              disabled={!allowed || busy}
              mode='date'
              value={date}
              end={localDate()}
              onChange={(e) => setDate(e.detail.value)}
            >
              <View>{date}</View>
            </Picker>
            <Picker
              disabled={!allowed || busy}
              mode='time'
              value={time}
              onChange={(e) => setTime(e.detail.value)}
            >
              <View>{time}</View>
            </Picker>
            <Textarea
              value={content}
              maxlength={2000}
              disabled={!allowed || busy}
              onInput={(e) => setContent(e.detail.value)}
            />
            {Object.keys(metrics)
              .filter((k) => labels[k])
              .map((k) => (
                <View key={k}>
                  <Text>{labels[k]}</Text>
                  <Input
                    disabled={!allowed || busy}
                    value={String(metrics[k] ?? '')}
                    type={typeof record.metrics?.[k] === 'number' ? 'digit' : 'text'}
                    onInput={(e) =>
                      setMetrics((current) => ({
                        ...current,
                        [k]:
                          typeof record.metrics?.[k] === 'number'
                            ? Number(e.detail.value)
                            : e.detail.value,
                      }))
                    }
                  />
                </View>
              ))}
          </View>
          <View className='growth-editor-card'>
            {ids.map((id) => (
              <View key={id}>
                <MediaThumbnail
                  familyId={familyId!}
                  fileId={id}
                  fileType={types[id]}
                  className='growth-editor-thumbnail'
                />
                <Button
                  disabled={!allowed || busy}
                  onClick={() => setIds((current) => current.filter((i) => i !== id))}
                >
                  移除附件
                </Button>
              </View>
            ))}
            <Button
              disabled={!allowed || busy || ids.length >= 9}
              loading={busy}
              onClick={addMedia}
            >
              {busy ? '正在处理…' : '添加照片 / 视频'}
            </Button>
          </View>
          {allowed ? (
            <Button loading={busy} disabled={busy} onClick={save}>
              保存修改
            </Button>
          ) : (
            <Text>仅记录本人或管理员可以修改。</Text>
          )}
        </>
      )}
      {error && <View className='growth-editor-alert'>{error}</View>}
    </View>
  )
}

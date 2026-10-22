import { Button, Input, Picker, Text, Textarea, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../../stores/session'
import { getRecord, type DailyRecord } from '../../services/records'
import { chooseGrowthMedia, uploadGrowthMedia, type GrowthMediaFile } from '../../services/media'
import { saveGrowthRecord } from '../../services/growth'
import { MediaThumbnail } from '../../components/media/MediaThumbnail'
import { localDate, localTime, isMeasurement } from '../../utils/home'
import { validDate } from '../../utils/care-records'
import {
  canManageRecord,
  growthAgeLabel,
  growthError,
  measurementMethods,
} from '../../utils/growth'
import type { RecordMetrics } from '../../types/record'
import './growth-editor.scss'

type Category = 'measurement' | 'milestone' | 'study'
type Form = {
  category: Category
  date: string
  time: string
  height: string
  weight: string
  headCircumference: string
  method: string
  source: string
  title: string
  content: string
}
type Attachment = Omit<GrowthMediaFile, 'fileType'> & {
  fileType: 'image' | 'video' | 'unknown'
  fileId?: string
  status: 'ready' | 'uploading' | 'failed'
}

export function GrowthRecordEditor() {
  const { params } = useRouter(),
    { familyId, childId, userId, children, currentRole, initialized } = useSessionStore()
  const child = children.find((c) => c.id === childId),
    now = new Date().toISOString(),
    canAdd = currentRole === 'owner' || currentRole === 'adult'
  const initialCategory: Category =
    params.category === 'study'
      ? 'study'
      : params.category === 'measurement'
        ? 'measurement'
        : 'milestone'
  const [form, setForm] = useState<Form>({
    category: initialCategory,
    date: localDate(),
    time: localTime(now),
    height: '',
    weight: '',
    headCircumference: '',
    method: '',
    source: 'home',
    title: '',
    content: '',
  })
  const [existing, setExisting] = useState<DailyRecord>(),
    [media, setMedia] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(Boolean(params.id)),
    [loadError, setLoadError] = useState(false),
    [saving, setSaving] = useState(false),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState('')
  const pending = useRef(false),
    mounted = useRef(true),
    sequence = useRef(0),
    target = useRef<string>()
  const contextKey = `${familyId || ''}/${childId || ''}`
  if (!target.current && familyId && childId) target.current = contextKey
  const switched = Boolean(target.current && target.current !== contextKey)
  const allowed =
    canAdd && (!existing || canManageRecord(currentRole, userId, existing)) && !switched
  useEffect(() => {
    const activeSequence = sequence
    mounted.current = true
    return () => {
      mounted.current = false
      activeSequence.current++
    }
  }, [])
  useEffect(() => {
    if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) return
    if (dirty)
      Taro.enableAlertBeforeUnload({
        message: '还有未保存的成长记录，确定离开吗？',
        fail: (cause) => console.warn('未能启用离开提醒', cause),
      })
    else Taro.disableAlertBeforeUnload({ fail: (cause) => console.warn('未能关闭离开提醒', cause) })
    return () => {
      Taro.disableAlertBeforeUnload({ fail: (cause) => console.warn('清理离开提醒失败', cause) })
    }
  }, [dirty])
  const load = useCallback(async () => {
    if (!initialized || !params.id || !familyId || !childId || switched) return
    const request = ++sequence.current
    setLoading(true)
    setLoadError(false)
    try {
      const r = await getRecord({ familyId, childId, recordId: params.id })
      if (request !== sequence.current) return
      if (!isMeasurement(r) && !['milestone', 'study'].includes(r.category))
        throw new Error('INVALID_GROWTH_RECORD')
      setExisting(r)
      setForm({
        category: isMeasurement(r) ? 'measurement' : (r.category as Category),
        date: localDate(r.occurredAt),
        time: localTime(r.occurredAt),
        height: r.metrics?.height === undefined ? '' : String(r.metrics.height),
        weight: r.metrics?.weight === undefined ? '' : String(r.metrics.weight),
        headCircumference:
          r.metrics?.headCircumference === undefined ? '' : String(r.metrics.headCircumference),
        method:
          r.metrics?.measurementMethod === 'unknown' ? '' : r.metrics?.measurementMethod || '',
        source: r.metrics?.measurementSource || '',
        title: r.title,
        content: r.content || '',
      })
      setMedia(
        (r.mediaFileIds || []).map((id, i) => ({
          id: 'existing-' + i,
          path: id,
          fileId: id,
          fileType:
            r.media?.find((m) => m.fileId === id)?.fileType === 'video'
              ? 'video'
              : r.media?.find((m) => m.fileId === id)?.fileType === 'image'
                ? 'image'
                : 'unknown',
          status: 'ready',
        })),
      )
    } catch (cause) {
      console.error('读取成长编辑记录失败', cause)
      if (request === sequence.current) setLoadError(true)
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [initialized, params.id, familyId, childId, switched])
  useEffect(() => {
    void load()
  }, [load])
  const change = (key: keyof Form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setDirty(true)
    setError('')
  }
  const validContext = () => {
    const state = useSessionStore.getState()
    return state.familyId === familyId && state.childId === childId
  }
  const uploadOne = async (file: Attachment) => {
    if (!mounted.current || !familyId || !childId || !validContext() || file.fileType === 'unknown')
      return
    setMedia((current) =>
      current.map((m) => (m.id === file.id ? { ...m, status: 'uploading' } : m)),
    )
    try {
      const fileId = await uploadGrowthMedia(
        { familyId, childId },
        { ...file, fileType: file.fileType },
      )
      if (mounted.current && validContext())
        setMedia((current) =>
          current.map((m) => (m.id === file.id ? { ...m, fileId, status: 'ready' } : m)),
        )
    } catch (cause) {
      console.error('上传成长附件失败', cause)
      if (mounted.current && validContext())
        setMedia((current) =>
          current.map((m) => (m.id === file.id ? { ...m, status: 'failed' } : m)),
        )
    }
  }
  const choose = async () => {
    if (pending.current || saving || !allowed || media.length >= 10) return
    pending.current = true
    setBusy(true)
    try {
      const files = await chooseGrowthMedia(10 - media.length)
      if (!mounted.current || !validContext()) return
      const added: Attachment[] = files.map((f) => ({ ...f, status: 'uploading' }))
      setMedia((current) => [...current, ...added])
      setDirty(true)
      for (const file of added) {
        if (!mounted.current || !validContext()) break
        await uploadOne(file)
      }
    } catch (cause) {
      if (!/cancel/i.test(String((cause as { errMsg?: string })?.errMsg || cause))) {
        console.error('选择成长附件失败', cause)
        Taro.showToast({ title: '未能选择媒体，请重试', icon: 'none' })
      }
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const retry = async (file: Attachment) => {
    if (pending.current || saving || !allowed) return
    pending.current = true
    setBusy(true)
    try {
      await uploadOne(file)
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const save = async () => {
    if (pending.current || saving || !allowed || !child || !familyId || !childId || !validContext())
      return
    const occurredAt = `${form.date}T${form.time}:00+08:00`
    if (
      !validDate(form.date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time) ||
      new Date(occurredAt) > new Date() ||
      form.date < child.birthday.slice(0, 10)
    ) {
      setError('发生时间须在宝宝出生后，且不能晚于现在')
      return
    }
    const metrics: RecordMetrics = { ...existing?.metrics }
    if (form.category === 'measurement') {
      for (const key of ['height', 'weight', 'headCircumference'] as const) {
        delete metrics[key]
        if (form[key].trim()) {
          const value = Number(form[key])
          if (!Number.isFinite(value) || value <= 0) {
            setError('测量数值必须大于0')
            return
          }
          metrics[key] = value
        }
      }
      if (!['height', 'weight', 'headCircumference'].some((key) => metrics[key] !== undefined)) {
        setError('身长/身高、体重、头围至少填写一项')
        return
      }
      if (metrics.height && !['lying', 'standing'].includes(form.method)) {
        setError('填写身长/身高时，请选择测量方法')
        return
      }
      metrics.measurementMethod = (form.method || 'unknown') as RecordMetrics['measurementMethod']
      metrics.measurementSource = (form.source || undefined) as RecordMetrics['measurementSource']
    } else if (!form.title.trim() || form.title.trim().length > 50) {
      setError('请填写事件标题，最多50字')
      return
    }
    if (form.content.length > 2000) {
      setError('补充描述最多2000字')
      return
    }
    const attachments = media.filter((m) => m.status === 'ready' && m.fileId)
    if (
      form.category !== 'measurement' &&
      (media.length > 10 || attachments.length !== media.length)
    ) {
      setError('请先重试或移除上传失败的附件，照片与视频合计最多10个')
      return
    }
    pending.current = true
    setSaving(true)
    setError('')
    try {
      await saveGrowthRecord(
        {
          familyId,
          childId,
          category: form.category,
          title: form.category === 'measurement' ? '身体测量' : form.title.trim(),
          occurredAt,
          content: form.content.trim(),
          metrics,
          mediaFileIds:
            form.category === 'measurement'
              ? existing?.mediaFileIds || []
              : attachments.map((m) => m.fileId!),
        },
        existing,
      )
      if (!validContext()) return
      if (!existing)
        Taro.setStorageSync('baby-growth-growth-entry', {
          workspace: form.category === 'measurement' ? 'measurement' : 'events',
          resetRange: true,
          metric:
            form.category === 'measurement'
              ? (['height', 'weight', 'headCircumference'] as const).find(
                  (key) => metrics[key] !== undefined,
                )
              : undefined,
        })
      setDirty(false)
      if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP)
        await new Promise<void>((resolve) =>
          Taro.disableAlertBeforeUnload({ complete: () => resolve() }),
        )
      Taro.showToast({ title: '记录已保存', icon: 'success' })
      Taro.navigateBack().catch(() => Taro.switchTab({ url: '/pages/growth/index' }))
    } catch (cause) {
      console.error('保存成长档案失败', cause)
      if (mounted.current) setError(growthError(cause))
    } finally {
      pending.current = false
      if (mounted.current) setSaving(false)
    }
  }
  const cancel = async () => {
    if (busy || saving) return
    if (dirty) {
      const answer = await Taro.showModal({
        title: '放弃未保存的内容？',
        content: '已保存的记录不会受到影响。',
        confirmText: '放弃修改',
        cancelText: '继续编辑',
      })
      if (!answer.confirm) return
    }
    if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP)
      await new Promise<void>((resolve) =>
        Taro.disableAlertBeforeUnload({ complete: () => resolve() }),
      )
    Taro.navigateBack().catch(() => Taro.switchTab({ url: '/pages/growth/index' }))
  }
  if (!initialized) return <View className='growth-editor-page'>正在读取家庭信息…</View>
  if (!familyId || !childId || !child)
    return (
      <View className='growth-editor-page'>
        <Text>请先完成宝宝档案，再添加成长记录。</Text>
        <Button onClick={() => Taro.navigateTo({ url: '/pages/onboarding/index' })}>
          前往设置
        </Button>
      </View>
    )
  if (loading) return <View className='growth-editor-page'>正在读取成长记录…</View>
  if (loadError)
    return (
      <View className='growth-editor-page'>
        <Text>记录加载失败或已被删除</Text>
        <Button onClick={load}>重新加载</Button>
      </View>
    )
  return (
    <View className='growth-editor-page'>
      <Text className='growth-editor-eyebrow'>小树成长日记</Text>
      <Text className='growth-editor-title'>
        {existing ? '编辑' : '新增'}
        {form.category === 'measurement' ? '身体测量' : '成长事件'}
      </Text>
      {!allowed && (
        <View className='growth-editor-alert'>
          {switched
            ? '宝宝已切换，请返回后重新打开记录。'
            : existing
              ? '仅管理员或记录本人可以修改。'
              : '当前没有新增记录权限。'}
        </View>
      )}
      <View className='growth-editor-card'>
        <Field label='记录类型'>
          <View className='growth-editor-types'>
            {(['measurement', 'milestone', 'study'] as const).map((c, i) => (
              <Button
                key={c}
                disabled={Boolean(existing) || !allowed || busy || saving}
                className={form.category === c ? 'active' : ''}
                onClick={() => {
                  if (form.category === c) return
                  setForm({
                    category: c,
                    date: localDate(),
                    time: localTime(new Date().toISOString()),
                    height: '',
                    weight: '',
                    headCircumference: '',
                    method: '',
                    source: 'home',
                    title: '',
                    content: '',
                  })
                  setMedia([])
                  setError('')
                  setDirty(false)
                }}
              >
                {['身体测量', '里程碑', '学习变化'][i]}
              </Button>
            ))}
          </View>
        </Field>
        <View className='growth-editor-datetime'>
          <Field label='发生日期'>
            <Picker
              disabled={!allowed || saving || busy}
              mode='date'
              value={form.date}
              start={child?.birthday?.slice(0, 10)}
              end={localDate()}
              onChange={(e) => change('date', e.detail.value)}
            >
              <View className='growth-editor-picker'>{form.date}</View>
            </Picker>
          </Field>
          <Field label='发生时间'>
            <Picker
              disabled={!allowed || saving || busy}
              mode='time'
              value={form.time}
              onChange={(e) => change('time', e.detail.value)}
            >
              <View className='growth-editor-picker'>{form.time}</View>
            </Picker>
          </Field>
        </View>
        <Text className='growth-editor-hint'>当时{growthAgeLabel(child?.birthday, form.date)}</Text>
        {form.category === 'measurement' ? (
          <>
            <Text className='growth-editor-hint'>三个指标至少填写一项，缺少的指标可以留空。</Text>
            {(['height', 'weight', 'headCircumference'] as const).map((key, i) => (
              <Field key={key} label={['身长/身高（cm）', '体重（kg）', '头围（cm）'][i]}>
                <Input
                  type='digit'
                  disabled={!allowed || saving || busy}
                  value={form[key]}
                  placeholder='选填，填写大于0的数值'
                  onInput={(e) => change(key, e.detail.value)}
                />
              </Field>
            ))}
            <Field label='身长/身高测量方法（填写该指标时必选）'>
              <Picker
                disabled={!allowed || saving || busy}
                mode='selector'
                range={['请选择', '卧位身长', '站立身高']}
                value={['', 'lying', 'standing'].indexOf(form.method)}
                onChange={(e) =>
                  change('method', ['', 'lying', 'standing'][Number(e.detail.value)])
                }
              >
                <View className='growth-editor-picker'>
                  {measurementMethods[form.method] || '请选择'}
                </View>
              </Picker>
            </Field>
            <Field label='测量来源'>
              <Picker
                disabled={!allowed || saving || busy}
                mode='selector'
                range={['未记录', '家庭测量', '机构测量']}
                value={['', 'home', 'clinic'].indexOf(form.source)}
                onChange={(e) => change('source', ['', 'home', 'clinic'][Number(e.detail.value)])}
              >
                <View className='growth-editor-picker'>
                  {form.source === 'clinic'
                    ? '机构测量'
                    : form.source === 'home'
                      ? '家庭测量'
                      : '未记录'}
                </View>
              </Picker>
            </Field>
            <Text className='growth-editor-hint'>
              2岁以下参考卧位身长，2岁起参考站立身高；头围使用软尺，经齐眉弓上缘与枕部最高点测量。请如实填写方法，系统不会自动换算数值。
            </Text>
          </>
        ) : (
          <Field label='事件标题'>
            <Input
              disabled={!allowed || saving || busy}
              value={form.title}
              maxlength={50}
              placeholder='例如：第一次自己穿上鞋子'
              onInput={(e) => change('title', e.detail.value)}
            />
            <Text className='growth-editor-hint'>{form.title.length} / 50</Text>
          </Field>
        )}
        <Field label='补充描述（选填）'>
          <Textarea
            disabled={!allowed || saving || busy}
            value={form.content}
            maxlength={2000}
            placeholder='记录当时的情景与小变化…'
            onInput={(e) => change('content', e.detail.value)}
          />
          <Text className='growth-editor-hint'>{form.content.length} / 2000</Text>
        </Field>
      </View>
      {form.category !== 'measurement' && (
        <View className='growth-editor-card'>
          <View className='growth-editor-media-heading'>
            <Text>照片与视频（选填）</Text>
            <Text>{media.length} / 10</Text>
          </View>
          <Text className='growth-editor-hint'>
            可混合添加，合计最多10个。点击照片预览，视频可播放；移除后可继续添加。
          </Text>
          <View className='growth-editor-media-grid'>
            {media.map((m) => (
              <View key={m.id} className='growth-editor-media-item'>
                <MediaThumbnail
                  familyId={familyId!}
                  fileId={m.fileId || m.path}
                  fileType={m.fileType}
                  className='growth-editor-thumbnail'
                />
                <Text className='growth-editor-media-type'>
                  {m.fileType === 'video' ? '视频' : m.fileType === 'image' ? '照片' : '媒体'}
                </Text>
                <Text className='growth-editor-hint'>
                  {m.status === 'uploading'
                    ? '正在上传…'
                    : m.status === 'failed'
                      ? '上传失败'
                      : '已添加'}
                </Text>
                {m.status === 'failed' && (
                  <Button
                    className='growth-editor-retry'
                    disabled={busy || saving || !allowed}
                    onClick={() => retry(m)}
                  >
                    重试上传
                  </Button>
                )}
                <Button
                  className='growth-editor-remove'
                  disabled={busy || saving || !allowed}
                  onClick={() => {
                    setMedia((current) => current.filter((f) => f.id !== m.id))
                    setDirty(true)
                  }}
                >
                  移除
                </Button>
              </View>
            ))}
          </View>
          <Button
            className='growth-editor-add'
            loading={busy}
            disabled={!allowed || busy || saving || media.length >= 10}
            onClick={choose}
          >
            {busy
              ? '正在上传…'
              : media.length >= 10
                ? '已达10个上限，移除后可继续添加'
                : '添加照片 / 视频'}
          </Button>
          {media.some((m) => m.status === 'failed') && (
            <View className='growth-editor-alert'>
              部分附件上传失败，请重试或移除；填写的文字已保留。
            </View>
          )}
        </View>
      )}
      {error && <View className='growth-editor-alert'>{error}</View>}
      <View className='growth-editor-actions'>
        <Button className='growth-editor-cancel' disabled={busy || saving} onClick={cancel}>
          取消
        </Button>
        <Button
          className='growth-editor-save'
          disabled={!allowed || busy || saving || media.some((m) => m.status === 'failed')}
          loading={saving}
          onClick={save}
        >
          保存记录
        </Button>
      </View>
    </View>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className='growth-editor-field'>
      <Text className='growth-editor-label'>{label}</Text>
      {children}
    </View>
  )
}

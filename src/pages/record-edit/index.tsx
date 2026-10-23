import { Button, Input, Picker, Text, Textarea, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { createRecord } from '../../services/records'
import { uploadMediaAsset } from '../../services/media'
import { useSessionStore } from '../../stores/session'
import { Icon } from '../../components/icon'
import type { IconName } from '../../components/icon'
import { MediaThumbnail } from '../../components/media/MediaThumbnail'
import type { FeedingType, RecordCategory } from '../../types/record'
import {
  recordScenes,
  recordForms,
  resolveRecordEntry,
  type RecordForm,
} from '../../utils/record-flow'
import { ExistingCareEditor } from './ExistingCareEditor'
import { GrowthRecordEditor } from './GrowthRecordEditor'
import { usePageDidShow } from '../../services/media-preview'
import './index.scss'

type MainTab = RecordForm
type FeedingTab = FeedingType

const feedingTabs: Array<{ value: FeedingTab; label: string }> = [
  { value: 'breastfeeding', label: '母乳' },
  { value: 'formula', label: '配方奶' },
  { value: 'solid_food', label: '辅食' },
]
const currentTime = () => {
  const date = new Date()
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
const currentDate = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const toNumber = (value: string) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}
const sleepDurationMinutes = (start: string, end: string) => {
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0
  const startTotal = startHour * 60 + startMinute
  const endTotal = endHour * 60 + endMinute
  const duration = endTotal - startTotal
  return duration >= 0 ? duration : duration + 24 * 60
}
const formatSleepDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours === 0) return `${remainder} 分钟`
  if (remainder === 0) return `${hours} 小时`
  return `${hours} 小时 ${remainder} 分钟`
}

function CareRecordEdit() {
  const router = useRouter()
  const familyId = useSessionStore((state) => state.familyId)
  const childId = useSessionStore((state) => state.childId)
  const entry = resolveRecordEntry(router.params.category, router.params.scene)
  const currentRole = useSessionStore((state) => state.currentRole)
  const scene = entry.scene
  const [mainTab, setMainTab] = useState<MainTab | undefined>(entry.form)
  const canEdit = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'adult'
  const [feedingTab, setFeedingTab] = useState<FeedingTab>(
    router.params.category === 'solid_food' ? 'solid_food' : 'breastfeeding',
  )
  const [time, setTime] = useState(currentTime())
  const [side, setSide] = useState<'left' | 'right'>('left')
  const [duration, setDuration] = useState('15')
  const [amount, setAmount] = useState('120')
  const [foodType, setFoodType] = useState<'staple' | 'vegetable' | 'meat'>('staple')
  const [foods, setFoods] = useState('')
  const [allergy, setAllergy] = useState('')
  const [sleepStart, setSleepStart] = useState('13:20')
  const [sleepEnd, setSleepEnd] = useState('15:05')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [temperature, setTemperature] = useState('')
  const [healthType, setHealthType] = useState<'temperature' | 'symptom' | 'medicine' | 'visit'>(
    'symptom',
  )
  const [date, setDate] = useState(
    router.params.date && /^\d{4}-\d{2}-\d{2}$/.test(router.params.date)
      ? router.params.date
      : currentDate(),
  )
  const [content, setContent] = useState('')
  const [mediaFileIds, setMediaFileIds] = useState<string[]>([])
  const [mediaUploading, setMediaUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const dateLabel = `${date.replace(/-/g, '/')} · 记录宝宝的今天`
  const sleepDurationLabel = useMemo(
    () => formatSleepDuration(sleepDurationMinutes(sleepStart, sleepEnd)),
    [sleepEnd, sleepStart],
  )

  const save = async () => {
    if (submitting || mediaUploading || !mainTab) return
    if (!familyId || !childId) {
      Taro.showToast({ title: '请先完成宝宝档案', icon: 'none' })
      return
    }
    if (currentRole !== 'owner' && currentRole !== 'admin' && currentRole !== 'adult') {
      Taro.showToast({ title: '只读成员无法新增记录', icon: 'none' })
      return
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      Taro.showToast({ title: '请输入有效时间', icon: 'none' })
      return
    }
    if (['milestone', 'study', 'travel'].includes(mainTab) && !milestoneTitle.trim()) {
      Taro.showToast({ title: '请填写新发现', icon: 'none' })
      return
    }
    if (mainTab === 'measurement' && !(Number(height) > 0 || Number(weight) > 0)) {
      Taro.showToast({ title: '请填写身高或体重', icon: 'none' })
      return
    }
    if (mainTab === 'health' && healthType === 'temperature' && !(Number(temperature) > 0)) {
      Taro.showToast({ title: '请填写体温', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      let category: RecordCategory = mainTab
      let title = '成长记录'
      let metrics: Record<string, string | number | undefined> = {}
      if (mainTab === 'feeding') {
        category = feedingTab === 'solid_food' ? 'solid_food' : 'feeding'
        title =
          feedingTab === 'breastfeeding'
            ? '母乳喂养'
            : feedingTab === 'formula'
              ? '配方奶'
              : '辅食记录'
        metrics =
          feedingTab === 'breastfeeding'
            ? { feedingType: feedingTab, side, durationMinutes: toNumber(duration) }
            : feedingTab === 'formula'
              ? { feedingType: feedingTab, amount: toNumber(amount), unit: 'ml' }
              : {
                  feedingType: feedingTab,
                  foodType,
                  foods,
                  allergy,
                  amount: toNumber(amount),
                  unit: 'g',
                }
      } else if (mainTab === 'sleep') {
        title = '睡眠记录'
        metrics = {
          sleepStart: `${date}T${sleepStart}:00+08:00`,
          sleepEnd: `${sleepEnd > sleepStart ? date : new Date(new Date(`${date}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10)}T${sleepEnd}:00+08:00`,
          sleepDurationMinutes: sleepDurationMinutes(sleepStart, sleepEnd),
        }
      } else if (mainTab === 'measurement') {
        title = '身体测量'
        metrics = { height: toNumber(height), weight: toNumber(weight) }
      } else if (mainTab === 'milestone') {
        title = milestoneTitle.trim()
      } else if (mainTab === 'health') {
        title =
          healthType === 'temperature'
            ? '体温记录'
            : healthType === 'medicine'
              ? '用药记录'
              : healthType === 'visit'
                ? '就医记录'
                : '症状记录'
        metrics = {
          healthType,
          ...(healthType === 'temperature' ? { temperature: toNumber(temperature) } : {}),
        }
      } else if (mainTab === 'diaper') {
        title = '排便记录'
      } else if (mainTab === 'study' || mainTab === 'travel') {
        title = milestoneTitle.trim()
      } else {
        category = 'note'
        title = '成长瞬间'
      }
      await createRecord({
        familyId,
        childId,
        category,
        title,
        occurredAt: `${date}T${time}:00+08:00`,
        content,
        metrics,
        mediaFileIds,
      })
      Taro.showToast({ title: '记录已保存', icon: 'success' })
      await new Promise((resolve) => setTimeout(resolve, 500))
      Taro.navigateBack()
    } catch (error) {
      console.error('保存成长记录失败', error)
      Taro.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const chooseMedia = async () => {
    if (mediaUploading || submitting) return
    if (!familyId || !childId) {
      Taro.showToast({ title: '请先完成宝宝档案', icon: 'none' })
      return
    }
    setMediaUploading(true)
    try {
      const uploaded = await uploadMediaAsset({ familyId, childId })
      setMediaFileIds((current) => [...current, uploaded.fileId])
      Taro.showToast({ title: '媒体已添加', icon: 'success' })
    } catch (error) {
      console.error('上传媒体失败', error)
      Taro.showToast({ title: '上传失败，请重试', icon: 'none' })
    } finally {
      setMediaUploading(false)
    }
  }

  const selectedScene = recordScenes.find((item) => item.value === scene)
  const selectedForm = recordForms.find((item) => item.value === mainTab)
  if (!mainTab)
    return (
      <View className='record-edit-page'>
        <View className='record-title'>
          {scene ? `选择${selectedScene?.label}类别` : '今天想记录什么？'}
        </View>
        <View className='record-date'>
          {scene ? '选择类别后填写记录' : '先选择记录类型，再选择具体类别'}
        </View>
        <View className='flow-options'>
          {(scene ? recordForms.filter((item) => item.scene === scene) : recordScenes).map(
            (item) => (
              <Button
                key={item.value}
                className='flow-option'
                disabled={!canEdit}
                onClick={() => {
                  const query = scene ? `category=${item.value}` : `scene=${item.value}`
                  Taro.navigateTo({
                    url: `/pages/record-edit/index?${query}&date=${date}`,
                  })
                }}
              >
                <Icon name={item.icon} size={26} color='#7FA68A' />
                <View className='flow-option-copy'>
                  <Text className='flow-option-title'>{item.label}</Text>
                  <Text className='flow-option-description'>{item.description}</Text>
                </View>
                <Text className='flow-option-arrow'>›</Text>
              </Button>
            ),
          )}
        </View>
        {!canEdit && (
          <View className='flow-readonly'>您当前没有新增记录权限，可以返回查看记录。</View>
        )}
      </View>
    )
  return (
    <View className='record-edit-page'>
      <View className='record-topbar'>
        {/* <Button className='back-button' onClick={() => Taro.navigateBack()}>
          ‹
        </Button> */}
        <View className='record-heading'>
          <View className='record-title'>记录{selectedForm?.label}</View>
          <View className='record-date'>
            {selectedScene?.label} / {selectedForm?.label}
          </View>
          <Button
            className='flow-back'
            disabled={submitting || mediaUploading}
            onClick={() => setMainTab(undefined)}
          >
            更换类别
          </Button>
          <View className='record-date'>{dateLabel}</View>
        </View>
        {/* <View className='calendar-mark'>□</View> */}
      </View>
      <Field label='记录日期'>
        <Picker
          mode='date'
          value={date}
          end={currentDate()}
          onChange={(event) => setDate(event.detail.value)}
        >
          <View className='picker-field'>{date}</View>
        </Picker>
      </Field>
      {mainTab === 'feeding' && (
        <View className='record-card'>
          <CardTitle
            title='喂养记录'
            icon='baby-bottle'
            hint={
              feedingTab === 'breastfeeding'
                ? '已选 · 母乳'
                : feedingTab === 'formula'
                  ? '已选 · 配方奶'
                  : '已选 · 辅食'
            }
          />
          <View className='sub-tabs'>
            {feedingTabs.map((tab) => (
              <Button
                key={tab.value}
                className={`sub-tab ${feedingTab === tab.value ? 'active' : ''}`}
                onClick={() => setFeedingTab(tab.value)}
              >
                {tab.label}
              </Button>
            ))}
          </View>
          <Field label='喂养时间'>
            <Input
              className='field-input'
              type='text'
              value={time}
              onInput={(event) => setTime(event.detail.value)}
            />
          </Field>
          {feedingTab === 'breastfeeding' && (
            <>
              <Field label='哺乳侧别'>
                <Segment<'left' | 'right'>
                  value={side}
                  options={[
                    ['left', '左侧'],
                    ['right', '右侧'],
                  ]}
                  onChange={setSide}
                />
              </Field>
              <Field label='哺乳时长' suffix='分钟'>
                <Input
                  className='field-input'
                  type='number'
                  value={duration}
                  onInput={(event) => setDuration(event.detail.value)}
                />
              </Field>
              <Field label='备注'>
                <Input
                  className='field-input'
                  placeholder='记录宝宝吃奶状态或需要备注的内容'
                  value={content}
                  onInput={(event) => setContent(event.detail.value)}
                />
              </Field>
            </>
          )}
          {feedingTab === 'formula' && (
            <>
              <Field label='奶量' suffix='ml'>
                <Input
                  className='field-input'
                  type='number'
                  value={amount}
                  onInput={(event) => setAmount(event.detail.value)}
                />
              </Field>
              <Field label='奶粉品牌（选填）'>
                <Input
                  className='field-input'
                  placeholder='输入或选择奶粉品牌'
                  value={content}
                  onInput={(event) => setContent(event.detail.value)}
                />
              </Field>
            </>
          )}
          {feedingTab === 'solid_food' && (
            <>
              <Field label='辅食类型'>
                <Segment<'staple' | 'vegetable' | 'meat'>
                  value={foodType}
                  options={[
                    ['staple', '米糊'],
                    ['vegetable', '蔬菜'],
                    ['meat', '肉泥'],
                  ]}
                  onChange={setFoodType}
                />
              </Field>
              <Field label='进食量' suffix='g'>
                <Input
                  className='field-input'
                  type='number'
                  value={amount}
                  onInput={(event) => setAmount(event.detail.value)}
                />
              </Field>
              <Field label='进食名称'>
                <Input
                  className='field-input'
                  placeholder='例如：南瓜、西兰花、胡萝卜'
                  value={foods}
                  onInput={(event) => setFoods(event.detail.value)}
                />
              </Field>
              <Field label='过敏备注'>
                <Input
                  className='field-input'
                  placeholder='记录尝试后的反应'
                  value={allergy}
                  onInput={(event) => setAllergy(event.detail.value)}
                />
              </Field>
            </>
          )}
        </View>
      )}
      {mainTab === 'sleep' && (
        <View className='record-card'>
          <CardTitle title='睡眠记录' icon='moon' hint='记录一天' />
          <View className='time-grid'>
            <Field label='入睡时间'>
              <Picker
                mode='time'
                value={sleepStart}
                onChange={(event) => setSleepStart(event.detail.value)}
              >
                <View className='picker-field'>
                  <Text>{sleepStart}</Text>
                  <Text className='picker-indicator'>⌄</Text>
                </View>
              </Picker>
            </Field>
            <Field label='醒来时间'>
              <Picker
                mode='time'
                value={sleepEnd}
                onChange={(event) => setSleepEnd(event.detail.value)}
              >
                <View className='picker-field'>
                  <Text>{sleepEnd}</Text>
                  <Text className='picker-indicator'>⌄</Text>
                </View>
              </Picker>
            </Field>
          </View>
          <View className='metric-highlight'>
            本次睡眠时长 <Text>{sleepDurationLabel}</Text>
          </View>
          <Field label='备注'>
            <Input
              className='field-input'
              placeholder='例如：夜醒 1 次'
              value={content}
              onInput={(event) => setContent(event.detail.value)}
            />
          </Field>
        </View>
      )}
      {mainTab === 'measurement' && (
        <View className='record-card'>
          <CardTitle title='身体测量' icon='sapling' hint='身体数据' />
          <View className='time-grid'>
            <Field label='身高' suffix='cm'>
              <Input
                className='field-input'
                type='digit'
                value={height}
                onInput={(event) => setHeight(event.detail.value)}
              />
            </Field>
            <Field label='体重' suffix='kg'>
              <Input
                className='field-input'
                type='digit'
                value={weight}
                onInput={(event) => setWeight(event.detail.value)}
              />
            </Field>
          </View>
        </View>
      )}
      {(mainTab === 'health' ||
        mainTab === 'diaper' ||
        mainTab === 'milestone' ||
        mainTab === 'study' ||
        mainTab === 'travel') && (
        <View className='record-card'>
          <CardTitle title={`${selectedForm?.label}记录`} icon='sapling' hint='留下今天' />
          {mainTab === 'health' && (
            <>
              <Segment<'temperature' | 'symptom' | 'medicine' | 'visit'>
                value={healthType}
                options={[
                  ['temperature', '体温'],
                  ['symptom', '症状'],
                  ['medicine', '用药'],
                  ['visit', '就医'],
                ]}
                onChange={setHealthType}
              />
              {healthType === 'temperature' && (
                <Field label='体温' suffix='℃'>
                  <Input
                    className='field-input'
                    type='digit'
                    value={temperature}
                    onInput={(event) => setTemperature(event.detail.value)}
                  />
                </Field>
              )}
            </>
          )}
          {['milestone', 'study', 'travel'].includes(mainTab) && (
            <Field label={mainTab === 'travel' ? '旅行名称或地点' : '学会了什么'}>
              <Input
                className='field-input'
                placeholder='例如：第一次自己穿鞋'
                value={milestoneTitle}
                onInput={(event) => setMilestoneTitle(event.detail.value)}
              />
            </Field>
          )}
          <Field label={mainTab === 'health' ? '症状、用药或就医详情' : '补充描述'}>
            <Textarea
              className='note-input'
              value={content}
              onInput={(event) => setContent(event.detail.value)}
            />
          </Field>
          {['milestone', 'study', 'travel'].includes(mainTab) && (
            <Button
              className='media-placeholder'
              loading={mediaUploading}
              disabled={mediaUploading || submitting}
              onClick={chooseMedia}
            >
              添加照片或视频（已添加 {mediaFileIds.length} 个）
            </Button>
          )}
        </View>
      )}
      {mainTab === 'note' && (
        <View className='record-card'>
          <CardTitle title='记录瞬间' icon='camera' hint='图片与文字' />
          <Button
            className='media-placeholder'
            disabled={mediaUploading || submitting}
            loading={mediaUploading}
            onClick={chooseMedia}
          >
            <Icon name='upload-one' size={28} color='#7FA68A' />
            <Text>{mediaFileIds.length ? '继续添加图片或视频' : '添加一张图片或视频'}</Text>
          </Button>
          {mediaFileIds.length > 0 && familyId && (
            <View className='media-preview-list'>
              {mediaFileIds.map((fileId) => (
                <MediaThumbnail
                  className='media-preview-image'
                  familyId={familyId}
                  fileId={fileId}
                  key={fileId}
                />
              ))}
            </View>
          )}
          <Textarea
            className='note-input'
            placeholder='写下此刻想说的话...'
            value={content}
            onInput={(event) => setContent(event.detail.value)}
          />
        </View>
      )}
      <View className='save-area'>
        <Button
          className='save-button'
          loading={submitting}
          disabled={submitting || mediaUploading || !canEdit}
          onClick={save}
        >
          ✓ 保存记录
        </Button>
      </View>
      {submitting && (
        <View className='record-saving-mask'>
          <View className='record-saving-dialog'>
            <View className='record-saving-spinner' />
            <Text>正在保存记录...</Text>
          </View>
        </View>
      )}
    </View>
  )
}

function CardTitle({ title, icon, hint }: { title: string; icon?: IconName; hint: string }) {
  return (
    <View className='card-title-row'>
      <View className='card-title-copy'>
        {icon && <Icon name={icon} size={18} color='#7FA68A' />}
        <Text className='card-title'>{title}</Text>
      </View>
      <Text className='card-hint'>{hint}</Text>
    </View>
  )
}
function Field({
  children,
  label,
  suffix,
}: {
  children: React.ReactNode
  label: string
  suffix?: string
}) {
  return (
    <View className='field'>
      <View className='field-label'>
        <Text>{label}</Text>
        {suffix && <Text className='field-suffix'>{suffix}</Text>}
      </View>
      {children}
    </View>
  )
}
function Segment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<[T, string]>
  onChange: (value: T) => void
}) {
  return (
    <View className='segment'>
      {options.map(([option, label]) => (
        <Button
          key={option}
          className={`segment-button ${value === option ? 'active' : ''}`}
          onClick={() => onChange(option)}
        >
          {label}
        </Button>
      ))}
    </View>
  )
}

export default function RecordEdit() {
  usePageDidShow(() => {})
  const { params } = useRouter()
  return ['measurement', 'milestone', 'study'].includes(params.category || '') ? (
    <GrowthRecordEditor />
  ) : params.id ? (
    <ExistingCareEditor />
  ) : (
    <CareRecordEdit />
  )
}

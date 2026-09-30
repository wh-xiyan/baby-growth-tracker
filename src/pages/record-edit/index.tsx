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
import './index.scss'

type MainTab = 'feeding' | 'sleep' | 'milestone' | 'note'
type FeedingTab = FeedingType

const mainTabs: Array<{ value: MainTab; label: string; icon: IconName }> = [
  { value: 'feeding', label: '喂养', icon: 'baby-bottle' },
  { value: 'sleep', label: '睡眠', icon: 'moon' },
  { value: 'milestone', label: '成长', icon: 'sapling' },
  { value: 'note', label: '瞬间', icon: 'camera' },
]
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

export default function RecordEdit() {
  const router = useRouter()
  const familyId = useSessionStore((state) => state.familyId)
  const childId = useSessionStore((state) => state.childId)
  const initialTab = router.params.category as MainTab
  const [mainTab, setMainTab] = useState<MainTab>(
    mainTabs.some((item) => item.value === initialTab) ? initialTab : 'feeding',
  )
  const [feedingTab, setFeedingTab] = useState<FeedingTab>('breastfeeding')
  const [time, setTime] = useState(currentTime())
  const [side, setSide] = useState<'left' | 'right'>('left')
  const [duration, setDuration] = useState('15')
  const [amount, setAmount] = useState('120')
  const [foodType, setFoodType] = useState<'staple' | 'vegetable' | 'meat'>('staple')
  const [foods, setFoods] = useState('')
  const [allergy, setAllergy] = useState('')
  const [sleepStart, setSleepStart] = useState('13:20')
  const [sleepEnd, setSleepEnd] = useState('15:05')
  const [height, setHeight] = useState('72.5')
  const [weight, setWeight] = useState('9.2')
  const [content, setContent] = useState('')
  const [mediaFileIds, setMediaFileIds] = useState<string[]>([])
  const [mediaUploading, setMediaUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const dateLabel = useMemo(() => {
    const date = new Date()
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · 星期${'日一二三四五六'[date.getDay()]}`
  }, [])
  const sleepDurationLabel = useMemo(
    () => formatSleepDuration(sleepDurationMinutes(sleepStart, sleepEnd)),
    [sleepEnd, sleepStart],
  )

  const save = async () => {
    if (submitting || mediaUploading) return
    if (!familyId || !childId) {
      Taro.showToast({ title: '请先完成宝宝档案', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      let category: RecordCategory = mainTab
      let title = '成长记录'
      let metrics: Record<string, string | number | undefined> = {}
      if (mainTab === 'feeding') {
        category = 'feeding'
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
          sleepStart,
          sleepEnd,
          sleepDurationMinutes: sleepDurationMinutes(sleepStart, sleepEnd),
        }
      } else if (mainTab === 'milestone') {
        title = '成长记录'
        metrics = { height: toNumber(height), weight: toNumber(weight) }
      } else {
        category = 'note'
        title = '成长瞬间'
      }
      await createRecord({
        familyId,
        childId,
        category,
        title,
        occurredAt: `${currentDate()}T${time}:00.000Z`,
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

  return (
    <View className='record-edit-page'>
      <View className='record-topbar'>
        {/* <Button className='back-button' onClick={() => Taro.navigateBack()}>
          ‹
        </Button> */}
        <View className='record-heading'>
          <View className='record-title'>记录今天</View>
          <View className='record-date'>{dateLabel}</View>
        </View>
        {/* <View className='calendar-mark'>□</View> */}
      </View>
      <View className='main-tabs'>
        {mainTabs.map((tab) => (
          <Button
            key={tab.value}
            className={`main-tab ${mainTab === tab.value ? 'active' : ''}`}
            onClick={() => setMainTab(tab.value)}
          >
            <Icon
              className='tab-icon'
              name={tab.icon}
              size={16}
              color={mainTab === tab.value ? '#E79576' : '#8D7E77'}
            />
            <Text>{tab.label}</Text>
          </Button>
        ))}
      </View>
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
      {mainTab === 'milestone' && (
        <View className='record-card'>
          <CardTitle title='成长记录' icon='sapling' hint='身体数据' />
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
          <Field label='成长里程碑'>
            <Input
              className='field-input'
              placeholder='今天第一次自己站起来啦'
              value={content}
              onInput={(event) => setContent(event.detail.value)}
            />
          </Field>
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
            <Icon name='upload-one' size={28} color='#E79576' />
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
          disabled={submitting || mediaUploading}
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
        {icon && <Icon name={icon} size={18} color='#E79576' />}
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

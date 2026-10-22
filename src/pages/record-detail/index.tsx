import { Button, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePageDidShow } from '../../services/media-preview'
import { getRecord, type DailyRecord } from '../../services/records'
import { useSessionStore } from '../../stores/session'
import { localDate, localTime, isMeasurement } from '../../utils/home'
import { careTitle, careValue, detailMetrics } from '../../utils/care-records'
import { MediaThumbnail } from '../../components/media/MediaThumbnail'
import { categoryMeta } from '../record-list/constants'
import { canManageRecord, growthAgeLabel, growthError, isGrowthEvent } from '../../utils/growth'
import { deleteGrowthRecord } from '../../services/growth'
import './index.scss'

export default function RecordDetail() {
  const { familyId, childId, initialized, currentRole, userId, children } = useSessionStore()
  const { params } = useRouter()
  const [record, setRecord] = useState<DailyRecord>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const sequence = useRef(0)
  const [deleting, setDeleting] = useState(false)
  const deletePending = useRef(false)
  const child = children.find((c) => c.id === childId)
  const growthRecord = record && (isMeasurement(record) || isGrowthEvent(record))
  const canManage = Boolean(
    growthRecord &&
      record &&
      record.familyId === familyId &&
      record.childId === childId &&
      canManageRecord(currentRole, userId, record),
  )
  const load = useCallback(async () => {
    const request = ++sequence.current
    if (!initialized) return
    setRecord(undefined)
    setLoading(true)
    setError(false)
    try {
      if (!familyId || !childId || !params.id) throw new Error('NOT_FOUND')
      const data = await getRecord({ familyId, childId, recordId: params.id })
      if (request === sequence.current) setRecord(data)
    } catch (cause) {
      console.error('加载记录详情失败', cause)
      if (request === sequence.current) setError(true)
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [familyId, childId, params.id, initialized])
  useEffect(() => {
    void load()
    return () => {
      sequence.current += 1
    }
  }, [load])
  usePageDidShow(() => {
    void load()
  })
  const removeRecord = async () => {
    if (!record || !canManage || deletePending.current) return
    const original = record
    deletePending.current = true
    try {
      const answer = await Taro.showModal({
        title: '删除这条成长记录？',
        content:
          '删除后将从成长档案与首页摘要中移除，并永久删除对应照片和视频，无法恢复。其他记录仍在使用的媒体会保留。',
        confirmText: '删除',
        confirmColor: '#a4513e',
      })
      if (!answer.confirm) return
      const active = useSessionStore.getState()
      if (active.familyId !== original.familyId || active.childId !== original.childId) return
      setDeleting(true)
      await deleteGrowthRecord(original)
      const session = useSessionStore.getState()
      if (session.childId !== original.childId || session.familyId !== original.familyId) return
      Taro.showToast({ title: '记录已删除', icon: 'success' })
      Taro.navigateBack().catch(() => Taro.switchTab({ url: '/pages/growth/index' }))
    } catch (cause) {
      console.error('删除成长记录失败', cause)
      Taro.showToast({ title: growthError(cause), icon: 'none', duration: 3000 })
    } finally {
      setDeleting(false)
      deletePending.current = false
    }
  }
  return (
    <View className='care-detail-page'>
      {loading ? (
        <Text className='care-detail-state'>正在加载记录…</Text>
      ) : error || !record ? (
        <View className='care-detail-state'>
          <Text>无法加载记录，可能已删除或暂无查看权限。</Text>
          <Button onClick={load}>重新加载</Button>
        </View>
      ) : (
        <>
          <View className='care-detail-hero'>
            <Text className='care-detail-eyebrow'>
              {isMeasurement(record) ? '身体测量' : categoryMeta[record.category]?.label} ·{' '}
              {record.authorName || '家庭成员'}记录
            </Text>
            <Text className='care-detail-title'>
              {isMeasurement(record) ? '身体测量' : careTitle(record)}
            </Text>
            {careValue(record) && <Text className='care-detail-value'>{careValue(record)}</Text>}
            <Text className='care-detail-date'>
              {localDate(record.occurredAt)} {localTime(record.occurredAt)}
            </Text>
          </View>
          <View className='care-detail-fields'>
            <Field
              label='记录时间'
              value={`${localDate(record.occurredAt)} ${localTime(record.occurredAt)}`}
            />
            {growthRecord && (
              <Field
                label='当时年龄'
                value={growthAgeLabel(child?.birthday, localDate(record.occurredAt))}
              />
            )}
            <Field label='记录人' value={record.authorName || '家庭成员'} />
            {isMeasurement(record) && !record.metrics?.measurementMethod && (
              <Field label='身长/身高测量方法' value='未记录方法' />
            )}
            {isMeasurement(record) && !record.metrics?.measurementSource && (
              <Field label='测量来源' value='未记录' />
            )}
            {detailMetrics(record).map((field) => (
              <Field key={field.label} {...field} />
            ))}
          </View>
          {record.content?.trim() && (
            <View className='care-detail-section'>
              <Text className='care-detail-section-title'>补充备注</Text>
              <View className='care-detail-note'>{record.content}</View>
            </View>
          )}
          {familyId && Boolean(record.mediaFileIds?.length) && (
            <View className='care-detail-section'>
              <Text className='care-detail-section-title'>照片与视频</Text>
              <View className='care-detail-media'>
                {record.mediaFileIds!.map((fileId) => (
                  <MediaThumbnail
                    key={fileId}
                    familyId={familyId}
                    fileId={fileId}
                    fileType={record.media?.find((item) => item.fileId === fileId)?.fileType}
                    className='care-detail-image'
                  />
                ))}
              </View>
            </View>
          )}
          {growthRecord && (
            <View className='growth-detail-management'>
              <Text className='growth-detail-permission'>
                {canManage
                  ? '你可以编辑或删除这条记录。'
                  : currentRole === 'viewer'
                    ? '当前为只读成员，可查看成长记录。'
                    : '这是其他成员的记录，仅管理员可以修改。'}
              </Text>
              {canManage && (
                <View className='growth-detail-actions'>
                  <Button
                    className='growth-detail-delete'
                    loading={deleting}
                    disabled={deleting}
                    onClick={removeRecord}
                  >
                    删除
                  </Button>
                  <Button
                    className='growth-detail-edit'
                    disabled={deleting}
                    onClick={() =>
                      Taro.navigateTo({
                        url: `/pages/record-edit/index?category=${isMeasurement(record) ? 'measurement' : record.category}&id=${encodeURIComponent(record.id)}`,
                      })
                    }
                  >
                    编辑记录
                  </Button>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </View>
  )
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className='care-detail-field'>
      <Text>{label}</Text>
      <Text>{value}</Text>
    </View>
  )
}

import { Button, Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getRecord, type DailyRecord } from '../../services/records'
import { useSessionStore } from '../../stores/session'
import { localDate, localTime } from '../../utils/home'
import { careTitle, careValue, detailMetrics } from '../../utils/care-records'
import { MediaThumbnail } from '../../components/media/MediaThumbnail'
import { categoryMeta } from '../record-list/constants'
import './index.scss'

export default function RecordDetail() {
  const { familyId, childId, initialized } = useSessionStore()
  const { params } = useRouter()
  const [record, setRecord] = useState<DailyRecord>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const sequence = useRef(0)
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
              {categoryMeta[record.category]?.label} · {record.authorName || '家庭成员'}记录
            </Text>
            <Text className='care-detail-title'>{careTitle(record)}</Text>
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
            <Field label='记录人' value={record.authorName || '家庭成员'} />
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

import {
  Button,
  Picker,
  ScrollView,
  Swiper,
  SwiperItem,
  Switch,
  Text,
  View,
} from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { usePageDidShow } from '../../services/media-preview'
import { useSessionStore } from '../../stores/session'
import { localDate, isMeasurement } from '../../utils/home'
import { shiftDate, validRange } from '../../utils/care-records'
import {
  growthAge,
  growthAgeLabel,
  growthLabels,
  growthMetrics,
  growthUnits,
  compareGrowth,
  referenceRows,
  measurementTitle,
  measurementMethods,
} from '../../utils/growth'
import type {
  GrowthEventType,
  GrowthMetric,
  GrowthWorkspace,
  GrowthQuery,
} from '../../types/growth'
import type { DailyRecord } from '../../services/records'
import { MediaThumbnail } from '../../components/media/MediaThumbnail'
import { GrowthReferenceChart } from './components/GrowthReferenceChart'
import { useGrowthData } from './useGrowthData'
import './index.scss'

export default function Growth() {
  const { familyId, childId, children, currentRole, initialized, setCurrentChild } =
    useSessionStore()
  const child = children.find((c) => c.id === childId),
    today = localDate(),
    canAdd = currentRole === 'owner' || currentRole === 'adult'
  const [workspace, setWorkspace] = useState<GrowthWorkspace>('measurement'),
    [history, setHistory] = useState(false)
  const [metric, setMetric] = useState<GrowthMetric>('height'),
    [eventType, setEventType] = useState<GrowthEventType>('all')
  const [measurementRange, setMeasurementRange] = useState({
    start: shiftDate(today, -364),
    end: today,
    preset: 'year',
  })
  const [eventRange, setEventRange] = useState({
    start: shiftDate(today, -29),
    end: today,
    preset: 'month',
  })
  const [reference, setReference] = useState(true),
    [showAll, setShowAll] = useState(false),
    [point, setPoint] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}),
    [historyCount, setHistoryCount] = useState(20)
  const [editingRange, setEditingRange] = useState(false),
    [draftStart, setDraftStart] = useState(''),
    [draftEnd, setDraftEnd] = useState(today)
  const range = workspace === 'measurement' ? measurementRange : eventRange
  const query = useMemo<GrowthQuery | undefined>(
    () =>
      initialized && familyId && childId
        ? {
            familyId,
            childId,
            workspace,
            eventType,
            startDate: range.start || undefined,
            endDate: range.end,
            limit: 20,
          }
        : undefined,
    [initialized, familyId, childId, workspace, eventType, range.start, range.end],
  )
  const { records, summary, loading, error, reload, hasMore, loadMore, loadingMore, moreError } =
    useGrowthData(query)
  usePageDidShow(() => {
    setHistory(false)
    setMetric('height')
    setEventType('all')
    setReference(true)
    setShowAll(false)
    setMeasurementRange({ start: shiftDate(localDate(), -364), end: localDate(), preset: 'year' })
    setEventRange({ start: shiftDate(localDate(), -29), end: localDate(), preset: 'month' })
    setEditingRange(false)
    setDraftStart('')
    setDraftEnd(localDate())
    setPoint('')
    setExpanded({})
    setHistoryCount(20)
    const entry = Taro.getStorageSync('baby-growth-growth-entry')
    const destination = typeof entry === 'string' ? entry : entry?.workspace
    if (destination === 'events' || destination === 'measurement') {
      Taro.removeStorageSync('baby-growth-growth-entry')
      setWorkspace(destination)
      if (entry?.resetRange) {
        const all = { start: '', end: localDate(), preset: 'all' }
        if (destination === 'measurement') setMeasurementRange(all)
        else {
          setEventRange(all)
          setEventType('all')
        }
      }
      if (growthMetrics.includes(entry?.metric)) setMetric(entry.metric)
      setHistory(false)
    }
    if (Taro.getStorageSync('baby-growth-growth-records-refresh')) {
      Taro.removeStorageSync('baby-growth-growth-records-refresh')
      void reload()
    }
  })
  const [refreshing, setRefreshing] = useState(false)
  usePullDownRefresh(async () => {
    setRefreshing(true)
    Taro.showNavigationBarLoading()
    try {
      await reload()
    } finally {
      setRefreshing(false)
      Taro.hideNavigationBarLoading()
      Taro.stopPullDownRefresh()
    }
  })
  useEffect(() => {
    setPoint('')
    setExpanded({})
    setHistoryCount(20)
  }, [childId, workspace, metric, eventType, range.start, range.end])
  useEffect(() => {
    setEditingRange(false)
  }, [childId])
  const measured = useMemo(
    () => records.filter((r) => Number(r.metrics?.[metric]) > 0),
    [records, metric],
  )
  const selected = measured.find((r) => r.id === point) || measured[0]
  const points = useMemo(
    () =>
      measured
        .slice()
        .reverse()
        .flatMap((r) => {
          const age = growthAge(child?.birthday, localDate(r.occurredAt))
          return age
            ? [
                {
                  id: r.id,
                  date: localDate(r.occurredAt),
                  age: age.exact,
                  value: Number(r.metrics?.[metric]),
                  method: r.metrics?.measurementMethod,
                },
              ]
            : []
        }),
    [measured, child?.birthday, metric],
  )
  const standards = useMemo(
    () => (reference ? referenceRows(child, metric) : []),
    [reference, child, metric],
  )
  const comparison = selected ? compareGrowth(selected, child, metric) : undefined
  const latest = summary[metric]?.[0],
    previous = summary[metric]?.[1]
  const visible = workspace === 'measurement' ? measured.slice(0, historyCount) : records
  const groups = useMemo(() => {
    const map = new Map<string, DailyRecord[]>()
    visible.forEach((r) => {
      const key = localDate(r.occurredAt).slice(0, workspace === 'measurement' ? 7 : 10)
      map.set(key, [...(map.get(key) || []), r])
    })
    return [...map]
  }, [visible, workspace])
  const choosePreset = (preset: string, days: number | null) => {
    const next = { preset, start: days ? shiftDate(today, 1 - days) : '', end: today }
    if (workspace === 'measurement') setMeasurementRange(next)
    else setEventRange(next)
  }
  const openRecord = (r: DailyRecord) =>
    Taro.navigateTo({ url: `/pages/record-detail/index?id=${encodeURIComponent(r.id)}` })
  const add = () =>
    Taro.navigateTo({
      url: `/pages/record-edit/index?category=${workspace === 'measurement' ? 'measurement' : eventType === 'study' ? 'study' : 'milestone'}`,
    })
  return (
    <View className='growth-page'>
      {refreshing && (
        <View className='growth-empty' role='status'>
          正在刷新成长记录…
        </View>
      )}
      <View className='growth-topline'>
        <Text className='growth-eyebrow'>小树成长日记</Text>
        {children.length > 1 && (
          <Picker
            mode='selector'
            range={children.map((c) => c.name)}
            value={children.findIndex((c) => c.id === childId)}
            onChange={(e) => setCurrentChild(children[Number(e.detail.value)].id)}
          >
            <View className='growth-link'>切换宝宝 ›</View>
          </Picker>
        )}
      </View>
      <Text className='growth-title'>{child ? `${child.name}的成长档案` : '成长档案'}</Text>
      <Text className='growth-subtitle'>
        {child ? growthAgeLabel(child.birthday, today) + ' · ' : ''}看见变化，珍藏每一个第一次
      </Text>
      <View className='growth-tabs'>
        {(
          [
            ['measurement', '身体测量'],
            ['events', '成长事件'],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            className={`growth-tab ${workspace === key ? 'active' : ''}`}
            onClick={() => {
              setWorkspace(key)
              setHistory(false)
            }}
          >
            {label}
          </Button>
        ))}
      </View>
      {!child ? (
        <View className='growth-empty'>
          <Text>请先完成宝宝档案</Text>
          <Button
            className='growth-secondary'
            onClick={() => Taro.navigateTo({ url: '/pages/onboarding/index' })}
          >
            前往设置
          </Button>
        </View>
      ) : (
        <>
          {workspace === 'measurement' && (
            <>
              {history && (
                <Button className='growth-link' onClick={() => setHistory(false)}>
                  ‹ 返回生长曲线
                </Button>
              )}
              <View className='growth-chips'>
                {growthMetrics.map((key) => (
                  <Button
                    key={key}
                    className={`growth-chip ${metric === key ? 'active' : ''}`}
                    onClick={() => setMetric(key)}
                  >
                    {growthLabels[key]}
                  </Button>
                ))}
              </View>
              {!history && !loading && !error && (
                <View className='growth-latest'>
                  <Text className='growth-muted'>全历史最新{growthLabels[metric]}</Text>
                  <Text className='growth-latest-value'>
                    {latest ? `${latest.metrics?.[metric]} ${growthUnits[metric]}` : '尚未记录'}
                  </Text>
                  <Text className='growth-small'>
                    {latest ? localDate(latest.occurredAt) + ' 测量' : ''}
                    {previous
                      ? ` · 较上次 ${Number(latest?.metrics?.[metric]) - Number(previous.metrics?.[metric]) >= 0 ? '+' : ''}${(Number(latest?.metrics?.[metric]) - Number(previous.metrics?.[metric])).toFixed(1)}${growthUnits[metric]}（${localDate(previous.occurredAt)}）`
                      : ''}
                  </Text>
                </View>
              )}
            </>
          )}
          <Button
            className='growth-range'
            onClick={() => {
              setDraftStart(range.start || child.birthday.slice(0, 10))
              setDraftEnd(range.end)
              setEditingRange(true)
            }}
          >
            <View>
              <Text className='growth-small'>查询日期范围</Text>
              <Text className='growth-range-value'>
                {range.start ? `${range.start} — ${range.end}` : '全部历史'}
              </Text>
            </View>
            <Text>选择日期 ›</Text>
          </Button>
          <View className='growth-chips'>
            {(workspace === 'measurement'
              ? [
                  ['quarter', '近3个月', 90],
                  ['half', '近6个月', 180],
                  ['year', '近1年', 365],
                  ['all', '全部', null],
                ]
              : [
                  ['week', '近7天', 7],
                  ['month', '近30天', 30],
                  ['all', '全部', null],
                ]
            ).map(([key, label, days]) => (
              <Button
                key={String(key)}
                className={`growth-chip ${range.preset === key ? 'active' : ''}`}
                onClick={() => choosePreset(String(key), days as number | null)}
              >
                {label}
              </Button>
            ))}
          </View>
          {workspace === 'events' && (
            <View className='growth-chips'>
              {(
                [
                  ['all', '全部'],
                  ['milestone', '里程碑'],
                  ['study', '学习变化'],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  className={`growth-chip ${eventType === key ? 'active' : ''}`}
                  onClick={() => setEventType(key)}
                >
                  {label}
                </Button>
              ))}
            </View>
          )}
          {loading ? (
            <View className='growth-empty'>正在加载成长档案…</View>
          ) : error ? (
            <View className='growth-empty'>
              <Text>成长档案加载失败</Text>
              <Button className='growth-secondary' onClick={reload}>
                重新加载
              </Button>
            </View>
          ) : workspace === 'measurement' && !history ? (
            <>
              <View className='growth-section-heading'>
                <Text>生长曲线</Text>
                <View className='growth-switch'>
                  <Text>标准参考</Text>
                  <Switch
                    color='#7fa68a'
                    checked={reference}
                    onChange={(e) => setReference(e.detail.value)}
                  />
                </View>
              </View>
              <View className='growth-standard-source'>
                <Text className='growth-source-title'>卫健委 · 7岁以下儿童生长标准</Text>
                <Text className='growth-small'>
                  WS/T 423—2022 ·{' '}
                  {child.gender === 'male'
                    ? '男童参考表'
                    : child.gender === 'female'
                      ? '女童参考表'
                      : '待补充性别'}
                </Text>
                <Button
                  className='growth-link'
                  onClick={() => Taro.navigateTo({ url: '/pages/growth-reference/index' })}
                >
                  参考依据与说明 ›
                </Button>
              </View>
              {reference && (
                <View className='growth-chips'>
                  <Text className='growth-small'>参考线</Text>
                  <Button
                    className={`growth-chip ${!showAll ? 'active' : ''}`}
                    onClick={() => setShowAll(false)}
                  >
                    简洁 · 3条
                  </Button>
                  <Button
                    className={`growth-chip ${showAll ? 'active' : ''}`}
                    onClick={() => setShowAll(true)}
                  >
                    完整 · 7条
                  </Button>
                </View>
              )}
              {points.length > 0 ? (
                <>
                  <GrowthReferenceChart
                    hidden={editingRange}
                    points={points}
                    rows={standards}
                    metric={metric}
                    selectedId={selected?.id}
                    showAll={showAll}
                    onSelect={setPoint}
                  />
                  <Text className='growth-small growth-chart-note'>
                    虚线连接标准原始节点，仅供阅读，不作预测。
                    {metric === 'height' ? '24月龄处分开绘制；不同测量方法的实测点不连线。' : ''}
                  </Text>
                  <ScrollView scrollX className='growth-point-scroll'>
                    <View className='growth-point-pills'>
                      {measured
                        .slice()
                        .reverse()
                        .map((r) => (
                          <Button
                            key={r.id}
                            className={`growth-chip ${selected?.id === r.id ? 'active' : ''}`}
                            onClick={() => setPoint(r.id)}
                          >
                            {localDate(r.occurredAt).slice(5)} · {r.metrics?.[metric]}
                            {growthUnits[metric]}
                          </Button>
                        ))}
                    </View>
                  </ScrollView>
                  {selected && (
                    <View className='growth-insight'>
                      <Text className='growth-eyebrow'>
                        {point ? '所选测量' : '本范围最近测量'}
                      </Text>
                      <Text className='growth-selected-value'>
                        {selected.metrics?.[metric]} {growthUnits[metric]}
                      </Text>
                      <Text className='growth-small'>
                        {localDate(selected.occurredAt)} ·{' '}
                        {growthAgeLabel(child.birthday, localDate(selected.occurredAt))}
                      </Text>
                      {reference ? (
                        <>
                          {comparison?.reason ? (
                            <View className='growth-alert'>
                              {comparison.reason}
                              {child.gender !== 'male' && child.gender !== 'female' && (
                                <Button
                                  className='growth-link'
                                  onClick={() =>
                                    Taro.navigateTo({ url: '/pages/child-profile/index' })
                                  }
                                >
                                  查看宝宝档案 ›
                                </Button>
                              )}
                            </View>
                          ) : (
                            <>
                              <Text className='growth-position'>{comparison?.position}</Text>
                              <Text className='growth-small'>
                                按测量时{comparison?.month}整月龄 · 表{comparison?.table}
                                对照，非精确百分位计算
                              </Text>
                              <View className='growth-reference-values'>
                                {[1, 4, 7].map((col, i) => (
                                  <View key={col}>
                                    <Text className='growth-small'>{['P3', 'P50', 'P97'][i]}</Text>
                                    <Text>
                                      {comparison?.row?.[col]} {growthUnits[metric]}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                              <Text className='growth-small'>
                                {comparison?.position?.includes('低于') ||
                                comparison?.position?.includes('高于')
                                  ? '建议先核对测量数据与方法，携带连续记录咨询儿保医生。'
                                  : '百分位描述群体中的位置，不代表成长评分，请结合连续变化与儿保随访观察。'}
                              </Text>
                            </>
                          )}
                        </>
                      ) : (
                        <Text className='growth-small'>已隐藏标准参考，仅查看宝宝的实测变化。</Text>
                      )}
                      <Button className='growth-link' onClick={() => openRecord(selected)}>
                        查看这条测量记录 ›
                      </Button>
                    </View>
                  )}
                </>
              ) : (
                <View className='growth-empty'>
                  {measured.length
                    ? '出生日期有误，暂无法绘制曲线，请核对宝宝档案。'
                    : '这段时间没有测量记录，试试扩大日期范围。'}
                </View>
              )}
              <Text className='growth-small growth-chart-note'>
                {metric === 'headCircumference'
                  ? '头围参考表覆盖0～3岁，超出范围不延伸参考线。'
                  : metric === 'weight'
                    ? '年龄别体重不能单独用于判断超重或肥胖。'
                    : '2岁以下参考卧位身长，2岁至未满7岁参考站立身高。'}
                P50是参考群体中位数，不是必须达到的目标。
              </Text>
              <Button className='growth-link' onClick={() => setHistory(true)}>
                查看测量历史 ›
              </Button>
            </>
          ) : (
            <>
              <View className='growth-section-heading'>
                <Text>{workspace === 'measurement' ? '测量历史' : '成长事件'}</Text>
                {groups.length > 0 && (
                  <View>
                    <Button
                      className='growth-link'
                      onClick={() =>
                        setExpanded(Object.fromEntries(groups.map(([g]) => [g, true])))
                      }
                    >
                      全部展开
                    </Button>
                    <Button
                      className='growth-link'
                      onClick={() =>
                        setExpanded(Object.fromEntries(groups.map(([g]) => [g, false])))
                      }
                    >
                      全部收起
                    </Button>
                  </View>
                )}
              </View>
              {!groups.length && (
                <View className='growth-empty'>
                  这段时间还没有{workspace === 'measurement' ? '测量' : '成长事件'}
                  记录，试试扩大日期范围或新增一条。
                </View>
              )}
              {groups.map(([group, items], i) => {
                const open = expanded[group] ?? i === 0
                return (
                  <View className='growth-group' key={group}>
                    <Button
                      className='growth-group-toggle'
                      onClick={() => setExpanded((current) => ({ ...current, [group]: !open }))}
                    >
                      <Text>
                        {group} · {items.length}条
                      </Text>
                      <Text>{open ? '收起 ⌃' : '展开 ⌄'}</Text>
                    </Button>
                    {open && (
                      <View className='growth-records'>
                        {items.map((r) => (
                          <View className='growth-record' key={r.id} onClick={() => openRecord(r)}>
                            <Text className='growth-record-date'>
                              {localDate(r.occurredAt).slice(5).replace('-', '/')}
                            </Text>
                            <View className='growth-record-body'>
                              <Text className='growth-record-title'>
                                {isMeasurement(r) ? measurementTitle(r) : r.title}
                              </Text>
                              {!isMeasurement(r) && Boolean(r.mediaFileIds?.length) && (
                                <>
                                  <Text className='growth-small'>
                                    {r.mediaFileIds!.length}个附件 · 照片{' '}
                                    {r.media?.filter((m) => m.fileType === 'image').length || 0} /
                                    视频{' '}
                                    {r.media?.filter((m) => m.fileType === 'video').length || 0}
                                  </Text>
                                  <Swiper
                                    className='growth-event-carousel'
                                    indicatorDots={r.mediaFileIds!.length > 1}
                                    indicatorColor='rgba(255,255,255,.6)'
                                    indicatorActiveColor='#628363'
                                    autoplay={false}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    {r.mediaFileIds!.map((fileId) => (
                                      <SwiperItem key={fileId}>
                                        <MediaThumbnail
                                          familyId={familyId!}
                                          fileId={fileId}
                                          fileType={
                                            r.media?.find((m) => m.fileId === fileId)?.fileType ||
                                            'unknown'
                                          }
                                          className='growth-event-cover'
                                        />
                                      </SwiperItem>
                                    ))}
                                  </Swiper>
                                </>
                              )}
                              <Text className='growth-small'>
                                {isMeasurement(r)
                                  ? measurementMethods[String(r.metrics?.measurementMethod)] ||
                                    '未记录方法'
                                  : r.category === 'study'
                                    ? '学习变化'
                                    : '里程碑'}{' '}
                                · {growthAgeLabel(child.birthday, localDate(r.occurredAt))} ·{' '}
                                {r.authorName || '家庭成员'}记录
                              </Text>
                            </View>
                            <Text className='growth-chevron'>›</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )
              })}
              {workspace === 'measurement' && measured.length > historyCount && (
                <Button className='growth-secondary' onClick={() => setHistoryCount((n) => n + 20)}>
                  继续加载测量历史
                </Button>
              )}
              {workspace === 'events' && hasMore && (
                <Button
                  className='growth-secondary'
                  loading={loadingMore}
                  disabled={loadingMore}
                  onClick={loadMore}
                >
                  {moreError ? '加载失败，点击重试' : '加载更多成长事件'}
                </Button>
              )}
            </>
          )}
        </>
      )}
      {child && (
        <View className='growth-dock'>
          {canAdd ? (
            <Button className='growth-primary' disabled={loading} onClick={add}>
              ＋ {workspace === 'measurement' ? '记录测量' : '记录成长事件'}
            </Button>
          ) : (
            <Text className='growth-small'>
              {currentRole === 'viewer'
                ? '只读成员可以回看档案，不能新增或修改。'
                : '尚未获取家庭权限，请返回首页同步。'}
            </Text>
          )}
        </View>
      )}
      {editingRange && (
        <View className='growth-mask' onClick={() => setEditingRange(false)}>
          <View className='growth-sheet' onClick={(e) => e.stopPropagation()}>
            <Text className='growth-sheet-title'>自定义日期范围</Text>
            <Text className='growth-muted'>开始日期</Text>
            <Picker
              mode='date'
              value={draftStart}
              end={today}
              onChange={(e) => setDraftStart(e.detail.value)}
            >
              <View className='growth-date-field'>{draftStart}</View>
            </Picker>
            <Text className='growth-muted'>结束日期</Text>
            <Picker
              mode='date'
              value={draftEnd}
              end={today}
              onChange={(e) => setDraftEnd(e.detail.value)}
            >
              <View className='growth-date-field'>{draftEnd}</View>
            </Picker>
            <View className='growth-actions'>
              <Button className='growth-secondary' onClick={() => setEditingRange(false)}>
                取消
              </Button>
              <Button
                className='growth-primary'
                onClick={() => {
                  if (!validRange(draftStart, draftEnd) || draftStart >= draftEnd) {
                    Taro.showToast({ title: '开始日期须早于结束日期', icon: 'none' })
                    return
                  }
                  const next = { start: draftStart, end: draftEnd, preset: 'custom' }
                  if (workspace === 'measurement') setMeasurementRange(next)
                  else setEventRange(next)
                  setEditingRange(false)
                }}
              >
                确认
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

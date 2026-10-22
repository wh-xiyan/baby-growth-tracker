import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { growthStandard } from '../../utils/growth'
import { useSessionStore } from '../../stores/session'
import './index.scss'

export default function GrowthReference() {
  const { children, childId } = useSessionStore(),
    child = children.find((c) => c.id === childId)
  const [opening, setOpening] = useState(false)
  const openSource = async () => {
    if (opening) return
    setOpening(true)
    try {
      const file = await Taro.downloadFile({ url: growthStandard.url })
      if (file.statusCode !== 200) throw new Error('DOWNLOAD_FAILED')
      await Taro.openDocument({ filePath: file.tempFilePath, fileType: 'pdf', showMenu: true })
    } catch (cause) {
      console.error('打开标准原文失败', cause)
      Taro.showToast({ title: '原文打开失败，可复制链接查看', icon: 'none' })
    } finally {
      setOpening(false)
    }
  }
  return (
    <View className='growth-reference-page'>
      <Text className='growth-reference-eyebrow'>有依据地参考，温柔地观察</Text>
      <Text className='growth-reference-title'>这张曲线如何参考？</Text>
      <Text className='growth-reference-subtitle'>沿着宝宝自己的节奏，观察持续的变化。</Text>
      <Section title='标准来源'>
        <Text>国家卫生健康委员会《7岁以下儿童生长标准》</Text>
        <Text>WS/T 423—2022 · 2023年3月1日实施</Text>
        <Text>使用附录A的年龄别身长/身高、体重、头围百分位数原始表值。</Text>
        <Button loading={opening} disabled={opening} onClick={openSource}>
          查看标准原文 PDF ›
        </Button>
        <Button onClick={() => Taro.setClipboardData({ data: growthStandard.url })}>
          复制官方原文链接
        </Button>
        <Text className='growth-reference-note'>
          首次打开原文需联网；若提示域名限制，可复制官方链接至浏览器查看。
        </Text>
      </Section>
      <Section title='当前宝宝档案'>
        <Text>
          {child?.name || '宝宝'} ·{' '}
          {child?.gender === 'male'
            ? '男童参考表'
            : child?.gender === 'female'
              ? '女童参考表'
              : '性别待补充'}{' '}
          · 出生日期 {child?.birthday?.slice(0, 10) || '待补充'}
        </Text>
        <Text>
          性别只决定匹配哪张参考表，界面配色不区分性别。年龄按测量发生日期与出生日期计算。
        </Text>
      </Section>
      <Section title='怎样理解 P50？'>
        <Text>P50是参考群体的中位数，P3、P97也只是分布位置，不是合格线、目标线或成长评分。</Text>
        <Text>实线圆点是宝宝实测，虚线是标准参考。可显示简洁3条或完整7条参考线。</Text>
      </Section>
      <Section title='范围与测量方法'>
        <Text>身长/身高、体重：出生至未满7周岁。头围参考表：0～3岁，超过36月龄不再提供对照。</Text>
        <Text>
          2岁以下使用卧位身长；2岁起使用站立身高。方法不匹配或旧记录未填写方法时，保留记录但暂不对照，不自动换算数值。
        </Text>
      </Section>
      <Section title='数据展示规则'>
        <Text>测量点按实际月龄定位，对照数值按日历整月龄查表，月末生日按目标月最后一天计算。</Text>
        <Text>
          只使用原文列出的节点；虚线连接仅供阅读，不计算精确插值百分位或Z分数。2岁以后部分整月龄没有原表节点时，会明确说明，不自动取最近节点，也不外推表格末端之后的数据。
        </Text>
        <Text>
          24月龄的身长/身高交界不连线；实测方法改变时分段展示。旧记录不会被自动补成某种测量方法。
        </Text>
      </Section>
      <Section title='结合连续变化观察'>
        <Text>
          家庭测量可能存在误差，请先核对方法与数值，再结合连续记录和儿保随访观察。年龄别体重不能单独用于判断超重或肥胖。
        </Text>
      </Section>
    </View>
  )
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className='growth-reference-section'>
      <Text className='growth-reference-heading'>{title}</Text>
      {children}
    </View>
  )
}

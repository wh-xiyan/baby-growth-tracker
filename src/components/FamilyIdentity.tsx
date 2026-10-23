import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useSessionStore } from '../stores/session'
import { roleLabels } from '../domain/family'

export function FamilyIdentity() {
  const { family, membership, currentRole, sessionError } = useSessionStore()
  return (
    <Button
      style={{
        background: '#e4eddf',
        color: '#496f56',
        fontSize: '12px',
        lineHeight: '1.7',
        padding: '7px 12px',
        borderRadius: '16px',
        margin: '8px 0',
        textAlign: 'left',
      }}
      onClick={() => Taro.navigateTo({ url: '/pages/family/index' })}
    >
      <Text>
        {sessionError
          ? '权限同步失败 · 点击重试'
          : family
            ? `${membership?.relationshipCode || '身份待完善'} · ${currentRole ? roleLabels[currentRole] : '权限待同步'}`
            : '游客 · 关联家庭'}{' '}
        ›
      </Text>
    </Button>
  )
}
export function GuestHome() {
  const { children, childId, sessionError, membershipIssue } = useSessionStore(),
    child = children.find((c) => c.id === childId)
  return (
    <View
      style={{ padding: '28px 22px', background: '#f7f5ec', minHeight: '100vh', color: '#34463b' }}
    >
      <Text style={{ fontSize: '27px', fontWeight: 600, display: 'block' }}>
        {child ? `${child.name}的成长空间` : '欢迎来到宝宝成长录'}
      </Text>
      <FamilyIdentity />
      <Text style={{ fontSize: '13px', display: 'block', margin: '18px 0' }}>
        未关联家庭时，只能查看自己的基础档案、空状态与公共内容。家庭记录和媒体不会展示。
      </Text>
      {sessionError && <Text>{sessionError}，请到家庭页重新同步。</Text>}
      {membershipIssue && <Text>旧账号家庭归属待整理，请进入家庭管理处理。</Text>}
      <Button
        onClick={() =>
          Taro.navigateTo({ url: child ? '/pages/child-profile/index' : '/pages/onboarding/index' })
        }
      >
        {child ? '查看与更正宝宝资料' : '建立个人宝宝档案'}
      </Button>
      <Button onClick={() => Taro.navigateTo({ url: '/pages/family/index' })}>
        创建家庭 / 加入家庭
      </Button>
      <View
        style={{ marginTop: '28px', padding: '20px', background: 'white', borderRadius: '16px' }}
      >
        <Text>成长小知识</Text>
        <Text style={{ display: 'block', fontSize: '13px', marginTop: '12px' }}>
          规律记录宝宝的变化，比比较单次数字更有意义。
        </Text>
        <Text style={{ display: 'block', fontSize: '11px', marginTop: '12px' }}>
          公共内容 · 无家庭私有数据
        </Text>
      </View>
    </View>
  )
}

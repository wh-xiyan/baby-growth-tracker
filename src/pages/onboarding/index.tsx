import { Button, Input, Picker, Radio, RadioGroup, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { familyAction, familyError } from '../../services/family'
import { useSessionStore } from '../../stores/session'
import { localDate } from '../../utils/home'
import '../family/index.scss'

export default function Onboarding() {
  const { initialized, familyId } = useSessionStore()
  const [name, setName] = useState(''),
    [birthday, setBirthday] = useState(''),
    [gender, setGender] = useState('unknown'),
    [agreed, setAgreed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const save = async () => {
    if (busy || !agreed) return
    setBusy(true)
    setError('')
    try {
      await familyAction('savePersonalChild', { data: { name, birthday, gender } })
      Taro.showToast({ title: '档案已保存', icon: 'success' })
      await Taro.switchTab({ url: '/pages/home/index' })
    } catch (cause) {
      setError(familyError(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <View className='family-page'>
      <Text className='family-title'>先认识一下宝宝</Text>
      <Text className='family-muted'>
        建立个人待关联档案，仅你可见。关联家庭后，才能共同记录成长。
      </Text>
      <View className='family-card'>
        <Text className='family-label'>宝宝昵称</Text>
        <Input
          maxlength={50}
          value={name}
          onInput={(e) => setName(e.detail.value)}
          placeholder='请输入宝宝昵称'
        />
        <Text className='family-label'>出生日期</Text>
        <Picker
          mode='date'
          value={birthday || localDate()}
          end={localDate()}
          onChange={(e) => setBirthday(e.detail.value)}
        >
          <View className='family-picker'>{birthday || '请选择日期'}</View>
        </Picker>
        <Text className='family-label'>生长参考使用的性别</Text>
        <Picker
          range={['暂不填写', '男童', '女童']}
          onChange={(e) => setGender(['unknown', 'male', 'female'][Number(e.detail.value)])}
        >
          <View className='family-picker'>
            {gender === 'male' ? '男童' : gender === 'female' ? '女童' : '暂不填写'}
          </View>
        </Picker>
        <Text className='family-muted'>性别仅用于生长标准参考，不影响页面配色。</Text>
        <RadioGroup onChange={(event) => setAgreed(event.detail.value === 'agreed')}>
          <View className='family-consent'>
            <Radio value='agreed' checked={agreed} color='#496f56' />
            <Text>我已知晓档案仅用于宝宝成长记录，家庭关联前仅本人可见。</Text>
          </View>
        </RadioGroup>
        <Button
          className='family-primary'
          disabled={!initialized || !agreed || busy || !name.trim() || !birthday}
          loading={busy}
          onClick={save}
        >
          保存个人档案
        </Button>
      </View>
      <View className='family-notice'>
        个人档案不能新增照护、成长、疫苗或媒体记录。
        {familyId
          ? '新个人档案可在家庭页申请归入家庭。'
          : '你也可以先接受家人的邀请，避免重复建档。'}
      </View>
      <Button
        className='family-secondary'
        onClick={() => Taro.navigateTo({ url: '/pages/family/index' })}
      >
        关联家庭 / 接受邀请
      </Button>
      {error && <View className='family-error'>{error}</View>}
    </View>
  )
}

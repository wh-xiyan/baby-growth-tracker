import { Button, Input, Picker, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo, useState } from 'react'
import { createFamilyAndChild } from '../../services/auth'
import { useSessionStore } from '../../stores/session'
import './index.scss'

type Gender = 'male' | 'female' | 'unknown'

const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function Onboarding() {
  const setSession = useSessionStore((state) => state.setSession)
  const initialized = useSessionStore((state) => state.initialized)
  const [familyName, setFamilyName] = useState('我们的家')
  const [childName, setChildName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [gender, setGender] = useState<Gender>('unknown')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const birthdayLabel = useMemo(
    () => (birthday ? birthday.replace(/-/g, ' / ') : '请选择出生日期'),
    [birthday],
  )

  const submit = async () => {
    if (!familyName.trim() || !childName.trim() || !birthday)
      return Taro.showToast({ title: '请完善家庭和宝宝信息', icon: 'none' })
    if (!agreed) return Taro.showToast({ title: '请先同意用户协议与隐私政策', icon: 'none' })
    setSubmitting(true)
    try {
      const session = await createFamilyAndChild(familyName.trim(), {
        name: childName.trim(),
        birthday,
        gender,
      })
      setSession({
        ...session,
        userId: session.user.id,
        familyId: session.family?.id,
        childId: session.currentChildId,
      })
      Taro.showToast({ title: session.isDemo ? '已创建本地演示档案' : '创建成功', icon: 'none' })
      setTimeout(() => Taro.switchTab({ url: '/pages/home/index' }), 500)
    } catch {
      Taro.showToast({ title: '创建失败，请稍后重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!initialized)
    return (
      <View className='onboarding-loading'>
        <View className='loading-bottle'>🍼</View>
        <View className='loading-title'>正在准备你的小家</View>
        <View className='loading-caption'>马上就好，先抱抱期待</View>
      </View>
    )

  return (
    <View className='onboarding-page'>
      <View className='onboarding-spot spot-yellow' />
      <View className='onboarding-spot spot-blue' />
      <View className='welcome'>
        <View className='welcome-copy'>
          <View className='eyebrow'>
            WELCOME HOME <Text className='eyebrow-dot'>·</Text>
          </View>
          <View className='welcome-title'>开启爱的记录</View>
          <View className='welcome-subtitle'>先为宝宝建立一个专属的小家吧</View>
        </View>
        <View className='welcome-illustration' aria-label='温馨的小家'>
          <View className='cloud cloud-left' />
          <View className='cloud cloud-right' />
          <View className='sun'>☀</View>
          <View className='house'>
            <View className='roof' />
            <View className='house-body'>
              <View className='window' />
              <View className='door' />
            </View>
          </View>
          <View className='heart'>♥</View>
        </View>
      </View>
      <View className='setup-card'>
        <View className='card-heading'>
          <View className='card-title'>建立宝宝档案</View>
          <View className='card-progress'>
            1 <Text>/</Text> 1
          </View>
        </View>
        <View className='card-caption'>这些信息只为你们的家服务</View>
        <View className='form-group'>
          <View className='form-label'>
            <Text className='label-icon'>⌂</Text> 家庭名称
          </View>
          <Input
            className='form-input'
            value={familyName}
            onInput={(e) => setFamilyName(e.detail.value)}
            placeholder='例如：我们的小家'
            maxlength={30}
          />
          <View className='field-hint'>这是你们共同守护的空间</View>
        </View>
        <View className='form-group'>
          <View className='form-label'>
            <Text className='label-icon'>♡</Text> 宝宝昵称
          </View>
          <Input
            className='form-input'
            value={childName}
            onInput={(e) => setChildName(e.detail.value)}
            placeholder='请输入宝宝的小名'
            maxlength={20}
          />
        </View>
        <View className='form-group'>
          <View className='form-label'>
            <Text className='label-icon'>✦</Text> 出生日期
          </View>
          <Picker
            mode='date'
            value={birthday || today()}
            end={today()}
            onChange={(e) => setBirthday(e.detail.value)}
          >
            <View className='form-input picker-input'>
              <Text className={birthday ? '' : 'placeholder'}>{birthdayLabel}</Text>
              <Text className='chevron'>›</Text>
            </View>
          </Picker>
        </View>
        <View className='form-group gender-group'>
          <View className='form-label'>
            <Text className='label-icon'>✿</Text> 宝宝性别
          </View>
          <View className='gender-options'>
            <View
              className={`gender-option gender-male ${gender === 'male' ? 'selected' : ''}`}
              onClick={() => setGender('male')}
            >
              <View className='gender-symbol'>♂</View>
              <View className='gender-name'>男宝宝</View>
              <View className='gender-check'>✓</View>
            </View>
            <View
              className={`gender-option gender-female ${gender === 'female' ? 'selected' : ''}`}
              onClick={() => setGender('female')}
            >
              <View className='gender-symbol'>♀</View>
              <View className='gender-name'>女宝宝</View>
              <View className='gender-check'>✓</View>
            </View>
          </View>
        </View>
        <View className={`agreement ${agreed ? 'checked' : ''}`} onClick={() => setAgreed(!agreed)}>
          <View className='agreement-box'>{agreed ? '✓' : ''}</View>
          <View className='agreement-text'>
            我已阅读并同意 <Text className='agreement-link'>《用户协议》</Text> 与{' '}
            <Text className='agreement-link'>《隐私政策》</Text>
          </View>
        </View>
        <Button
          className='create-button'
          loading={submitting}
          disabled={submitting}
          onClick={submit}
        >
          完成创建，开始记录 <Text className='button-arrow'>→</Text>
        </Button>
      </View>
      <View className='safe-note'>🔒 你的数据仅用于记录和陪伴成长</View>
    </View>
  )
}

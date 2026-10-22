import { Button, Input, Picker, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { useSessionStore } from '../../stores/session'
import { updateChildProfile } from '../../services/children'
import { localDate } from '../../utils/home'
import { validDate } from '../../utils/care-records'
import type { Child } from '../../types/child'
import './index.scss'

export default function ChildProfile() {
  const { children, childId, currentRole } = useSessionStore(),
    child = children.find((c) => c.id === childId)
  const [name, setName] = useState(''),
    [birthday, setBirthday] = useState(''),
    [gender, setGender] = useState<Child['gender']>('unknown'),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('')
  const allowed = currentRole === 'owner' || currentRole === 'adult'
  useEffect(() => {
    setName(child?.name || '')
    setBirthday(child?.birthday?.slice(0, 10) || '')
    setGender(child?.gender || 'unknown')
    setError('')
  }, [child])
  const save = async () => {
    if (!allowed || !child || saving) return
    if (!name.trim() || !validDate(birthday) || birthday > localDate()) {
      setError('请填写宝宝姓名与有效出生日期')
      return
    }
    const original = child
    if (birthday !== child.birthday.slice(0, 10)) {
      const answer = await Taro.showModal({
        title: '更新出生日期？',
        content: '成长记录的月龄、阶段及标准对照会按新生日重新计算，原始测量值保持不变。',
      })
      if (!answer.confirm) return
    }
    setSaving(true)
    setError('')
    try {
      await updateChildProfile(original, { name: name.trim(), birthday, gender })
      Taro.showToast({ title: '宝宝资料已保存', icon: 'success' })
    } catch (cause) {
      console.error('保存宝宝资料失败', cause)
      setError('保存失败，请检查网络及家庭权限后重试')
    } finally {
      setSaving(false)
    }
  }
  if (!child) return <View className='child-profile-page'>请先完成宝宝档案</View>
  return (
    <View className='child-profile-page'>
      <Text className='child-profile-title'>宝宝资料</Text>
      <Text className='child-profile-hint'>用于计算记录时年龄，并匹配生长标准参考表。</Text>
      <Text className='child-profile-label'>宝宝姓名</Text>
      <Input
        value={name}
        maxlength={50}
        disabled={!allowed || saving}
        onInput={(e) => setName(e.detail.value)}
      />
      <Text className='child-profile-label'>出生日期</Text>
      <Picker
        disabled={!allowed || saving}
        mode='date'
        value={birthday}
        end={localDate()}
        onChange={(e) => setBirthday(e.detail.value)}
      >
        <View className='child-profile-picker'>{birthday}</View>
      </Picker>
      <Text className='child-profile-label'>性别</Text>
      <Picker
        disabled={!allowed || saving}
        mode='selector'
        range={['未填写', '男童', '女童']}
        value={gender === 'male' ? 1 : gender === 'female' ? 2 : 0}
        onChange={(e) =>
          setGender((['unknown', 'male', 'female'] as const)[Number(e.detail.value)])
        }
      >
        <View className='child-profile-picker'>
          {gender === 'male' ? '男童' : gender === 'female' ? '女童' : '未填写'}
        </View>
      </Picker>
      <Text className='child-profile-hint'>
        性别仅用于匹配标准数据，不影响界面配色。未填写时仍可记录测量，不显示标准对照。
      </Text>
      {error && <View className='child-profile-error'>{error}</View>}
      {allowed ? (
        <Button className='child-profile-save' loading={saving} disabled={saving} onClick={save}>
          保存宝宝资料
        </Button>
      ) : (
        <Text className='child-profile-hint'>只读成员可查看，无法修改宝宝资料。</Text>
      )}
    </View>
  )
}

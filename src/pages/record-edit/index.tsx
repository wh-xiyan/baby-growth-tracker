import { View } from '@tarojs/components'
import { Form, Input, Button } from '@nutui/nutui-react-taro'

export default function RecordEdit() {
  return (
    <View className='page'>
      <View className='page-title'>新增记录</View>
      <View className='section'>
        <Form>
          <View>标题</View>
          <Input placeholder='例如：第一次独立走路' />
          <View>备注</View>
          <Input placeholder='补充一些细节' />
          <Button block type='primary'>
            保存记录
          </Button>
        </Form>
      </View>
    </View>
  )
}

import Taro from '@tarojs/taro'

export function getCloudEnvId(): string | undefined {
  return process.env.TARO_CLOUD_ENV
}
export async function callCloudFunction<T>(
  name: string,
  data?: Record<string, unknown>,
): Promise<T> {
  const result = await Taro.cloud.callFunction({ name, data })
  return result.result as T
}

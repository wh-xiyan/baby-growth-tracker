import Taro from '@tarojs/taro'

export function getCloudEnvId(): string | undefined {
  return CLOUD_ENV_ID || undefined
}

export function isCloudConfigured(): boolean {
  const envId = getCloudEnvId()
  return Boolean(envId)
}

export async function callCloudFunction<T>(
  name: string,
  data?: Record<string, unknown>,
): Promise<T> {
  const result = await Taro.cloud.callFunction({ name, data })
  const payload = result.result as { ok?: boolean; data?: T }
  if (payload?.ok === false) throw new Error('CLOUD_FUNCTION_FAILED')
  return payload?.ok ? (payload.data as T) : (result.result as T)
}

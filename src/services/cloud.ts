import Taro from '@tarojs/taro'

export function getCloudEnvId(): string | undefined {
  // `process` is available during the build, but is not a runtime global in
  // WeChat's JavaScriptCore. Keep the demo/local path usable when no env ID
  // was injected by Taro's DefinePlugin.
  if (typeof process === 'undefined' || !process.env) return undefined
  return process.env.TARO_CLOUD_ENV
}

export function isCloudConfigured(): boolean {
  const envId = getCloudEnvId()
  return Boolean(envId && envId !== 'your-cloud-environment-id')
}

export async function callCloudFunction<T>(
  name: string,
  data?: Record<string, unknown>,
): Promise<T> {
  const result = await Taro.cloud.callFunction({ name, data })
  return result.result as T
}

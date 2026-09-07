import { db, now, result } from '../../shared/db'
export async function main() {
  const today = now(); const end = new Date(today.getTime() + 14 * 86400000); const pending = await db.collection('vaccines').where({ status: 'planned', reminderEnabled: true, plannedDate: db.command.gte(today).and(db.command.lte(end)) }).get()
  // 订阅消息发送需在配置模板 ID 后调用 cloud.openapi.subscribeMessage.send。
  console.log('vaccine reminders pending', pending.data.length); return result({ count: pending.data.length })
}

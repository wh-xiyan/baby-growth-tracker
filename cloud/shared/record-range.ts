import { localDate } from './home'
export function queryRange(event: { date?: string; startDate?: string; endDate?: string }) {
  const from = String(event.startDate || event.date || '')
  const to = String(event.endDate || event.date || from)
  const valid = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(new Date(`${value}T00:00:00Z`).getTime()) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  if (!valid(from) || !valid(to) || from > to || to > localDate())
    throw new Error('INVALID_DAILY_RECORD_QUERY')
  return {
    start: new Date(`${from}T00:00:00+08:00`),
    end: new Date(new Date(`${to}T00:00:00+08:00`).getTime() + 86400000),
  }
}

import { ROCDate } from '../types';

/**
 * Converts a Gregorian Date to ROC Date (Taiwan 民國).
 */
export function toROCDate(date: Date): string {
  const year = date.getFullYear() - 1911;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * Converts ROC Date components to a Gregorian Date.
 */
export function fromROCComponents(year: number, month: number, day: number): Date {
  return new Date(year + 1911, month - 1, day);
}

/**
 * Gets a relative status message and color based on expiry date.
 */
export function getExpiryStatus(expiryDate: Date, hasIssue: boolean) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(expiryDate);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (hasIssue) return { label: '維修中', color: 'text-red-600', badge: 'bg-red-100', days: diffDays };
  if (diffDays < 0) return { label: `逾期 ${Math.abs(diffDays)} 天`, color: 'text-slate-400', badge: 'bg-slate-100', days: diffDays };
  if (diffDays === 0) return { label: '今日到期', color: 'text-red-600 font-bold animate-pulse', badge: 'bg-red-50', days: diffDays };
  if (diffDays <= 30) return { label: `剩 ${diffDays} 天`, color: 'text-orange-600 font-bold animate-pulse', badge: 'bg-orange-50', days: diffDays };
  
  return { label: `剩 ${diffDays} 天`, color: 'text-green-600 font-medium', badge: 'bg-green-50', days: diffDays };
}

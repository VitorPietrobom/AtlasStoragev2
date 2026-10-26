import { Alert } from 'react-native';

import { RuleError } from '../core/ops';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "3 Oct" this year, "3 Oct 2025" otherwise. */
export function shortDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "10 Oct 2026" */
export function longDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "14:02" today, "10 Oct" before. */
export function timeOrDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return shortDate(iso, now).toUpperCase();
}

export function ago(iso: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 45) return `${days} days ago`;
  const months = Math.round(days / 30.4);
  if (months < 18) return `${months} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

/** Run a domain action; a rule refusal becomes a friendly alert instead of a crash. */
export function attempt(fn: () => void): boolean {
  try {
    fn();
    return true;
  } catch (e) {
    if (e instanceof RuleError) {
      Alert.alert('Not possible', e.message);
      return false;
    }
    throw e;
  }
}

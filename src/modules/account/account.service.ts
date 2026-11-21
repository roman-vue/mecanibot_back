import { proRequired } from '../../shared/errors';
import { countVehicles } from '../vehicle/vehicle.model';
import { toYmd, today } from '../plan/plan.schedule';
import { findAccount, upsertAccount } from './account.model';

export const PLAN_LIMITS = {
  free: { vehicles: 1, historyMonths: 6 as number | null, customReminders: 3 as number | null },
  pro: { vehicles: 5, historyMonths: null as number | null, customReminders: null as number | null },
};

export function isPro(deviceId: string): boolean {
  return findAccount(deviceId)?.is_pro === 1;
}

export function limitsFor(deviceId: string) {
  return isPro(deviceId) ? PLAN_LIMITS.pro : PLAN_LIMITS.free;
}

export function getAccount(deviceId: string) {
  const account = findAccount(deviceId);
  const pro = account?.is_pro === 1;
  const { vehicles, historyMonths } = pro ? PLAN_LIMITS.pro : PLAN_LIMITS.free;
  return {
    is_pro: pro,
    pro_since: account?.pro_since ?? null,
    limits: { vehicles, historyMonths },
    usage: { vehicles: countVehicles(deviceId) },
  };
}

// Demo activation: there is no payment integration yet.
export function setPlan(deviceId: string, pro: boolean) {
  upsertAccount(deviceId, pro, pro ? toYmd(today()) : null);
  return getAccount(deviceId);
}

export function assertPro(deviceId: string, feature: string): void {
  if (!isPro(deviceId)) throw proRequired(`${feature} is a Pro feature`);
}

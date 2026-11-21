import { db } from '../../config/database';
import { assertPro, limitsFor } from '../account/account.service';
import { addMonths, parseYmd, toYmd, today } from '../plan/plan.schedule';
import { recordLastMaintenance } from '../vehicle/vehicle.model';
import { getOwnedVehicle, updateKm } from '../vehicle/vehicle.service';
import { countHistoryBefore, insertHistory, listCosts, listHistory } from './maintenance.model';

export function history(deviceId: string, plate: string) {
  getOwnedVehicle(deviceId, plate);
  const { historyMonths } = limitsFor(deviceId);
  const from = historyMonths === null ? '0000-00-00' : toYmd(addMonths(today(), -historyMonths));
  return {
    history: listHistory(deviceId, plate, from),
    limited: historyMonths !== null,
    hidden: historyMonths === null ? 0 : countHistoryBefore(deviceId, plate, from),
  };
}

// A maintenance that was not part of the plan (e.g. a repair).
export function add(deviceId: string, plate: string, task: string, date?: string, km?: string, cost?: number) {
  const vehicle = getOwnedVehicle(deviceId, plate);
  if (cost !== undefined) assertPro(deviceId, 'Registering costs');

  const when = date && parseYmd(date) ? date : toYmd(today());
  db.transaction(() => {
    insertHistory({ deviceId, car_plate: plate, task, km: km ?? null, date: when, reminder_id: null, cost: cost ?? null });
    recordLastMaintenance(vehicle.id, when, task, null);
  })();

  if (km) updateKm(deviceId, plate, km);
  return history(deviceId, plate);
}

export function expenses(deviceId: string, plate: string, year?: number) {
  getOwnedVehicle(deviceId, plate);
  assertPro(deviceId, 'Expenses');

  const y = year ?? today().getFullYear();
  const items = listCosts(deviceId, plate, y);
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.task, (totals.get(item.task) ?? 0) + item.cost);

  return {
    year: y,
    total: items.reduce((sum, i) => sum + i.cost, 0),
    byTask: [...totals].map(([task, amount]) => ({ task, amount })).sort((a, b) => b.amount - a.amount),
    items,
  };
}

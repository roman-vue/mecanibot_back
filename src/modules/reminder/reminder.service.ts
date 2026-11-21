import { db } from '../../config/database';
import { AppError, notFound, proRequired } from '../../shared/errors';
import { logger } from '../../middlewares/logger.middleware';
import { assertPro, limitsFor } from '../account/account.service';
import { insertHistory } from '../maintenance/maintenance.model';
import { catalogFor } from '../plan/plan.catalog';
import { computeDueDate, parseKm, toYmd, today, usageFor } from '../plan/plan.schedule';
import { recordLastMaintenance } from '../vehicle/vehicle.model';
import { getOwnedVehicle } from '../vehicle/vehicle.service';
import {
  CUSTOM_TASK, ReminderRow, countPendingCustom, findReminder, insertReminder, listReminders, markDone,
} from './reminder.model';

// Reminders created before intervals were stored fall back to the catalog task with the same name.
function intervalOf(r: ReminderRow, type: number | null) {
  if (r.task_id === CUSTOM_TASK && !r.interval_months) return null;
  if (r.interval_months) return { taskId: r.task_id, km: r.interval_km, months: r.interval_months };
  const task = catalogFor(type ?? 2).find((t) => t.name === r.message);
  return task ? { taskId: task.id, km: task.km?.def ?? null, months: task.months.def } : null;
}

export function list(deviceId: string, plate: string) {
  getOwnedVehicle(deviceId, plate);
  return listReminders(deviceId, plate);
}

// Marks a reminder as done, logs it in the history and schedules the next repetition from today.
export function complete(deviceId: string, reminderId: number, kmText?: string, cost?: number) {
  const reminder = findReminder(deviceId, reminderId);
  if (!reminder) throw notFound('Reminder');
  if (reminder.status === 1) throw new AppError(409, 'Reminder already completed', 'ALREADY_COMPLETED');
  if (cost !== undefined) assertPro(deviceId, 'Registering costs');

  const vehicle = getOwnedVehicle(deviceId, reminder.car_plate);
  const doneDate = toYmd(today());
  let next: { message: string; dateTime: string } | null = null;

  db.transaction(() => {
    markDone(reminder.id);
    insertHistory({
      deviceId, car_plate: reminder.car_plate, task: reminder.message,
      km: kmText ?? null, date: doneDate, reminder_id: reminder.id, cost: cost ?? null,
    });
    recordLastMaintenance(vehicle.id, doneDate, reminder.message, kmText ?? null);

    const interval = intervalOf(reminder, vehicle.type);
    if (!interval) return;
    const currentKm = parseKm(kmText ?? vehicle.km);
    const due = toYmd(computeDueDate({
      baseDate: today(), baseKm: currentKm, intervalKm: interval.km, intervalMonths: interval.months,
      currentKm, kmPerMonth: usageFor(vehicle.type, vehicle.km_per_month),
    }));
    insertReminder({
      deviceId, car_plate: reminder.car_plate, message: reminder.message, description: reminder.description,
      dateTime: due, task_id: interval.taskId, interval_km: interval.km, interval_months: interval.months,
      base_km: currentKm, base_date: doneDate,
    });
    next = { message: reminder.message, dateTime: due };
  })();

  logger.info('Reminder completed', { plate: reminder.car_plate, reminderId, next });
  return { next };
}

export function addCustom(deviceId: string, plate: string, task: string, date: string, repeatMonths?: number) {
  getOwnedVehicle(deviceId, plate);
  if (date < toYmd(today())) throw new AppError(400, 'The date cannot be in the past', 'DATE_IN_PAST');

  const { customReminders: max } = limitsFor(deviceId);
  if (max !== null && countPendingCustom(deviceId, plate) >= max) {
    throw proRequired(`The free plan allows ${max} custom reminders per vehicle`);
  }

  // User-facing text, shown as-is by the Spanish app.
  const description = repeatMonths
    ? `Recordatorio tuyo. Cada ${repeatMonths} ${repeatMonths === 1 ? 'mes' : 'meses'}.`
    : 'Recordatorio tuyo.';
  insertReminder({
    deviceId, car_plate: plate, message: task, description, dateTime: date, task_id: CUSTOM_TASK,
    interval_km: null, interval_months: repeatMonths ?? null, base_km: null, base_date: toYmd(today()),
  });

  logger.info('Custom reminder added', { plate, task, date, repeatMonths });
  return listReminders(deviceId, plate);
}

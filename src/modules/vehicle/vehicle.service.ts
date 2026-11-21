import { db } from '../../config/database';
import { AppError, notFound, proRequired } from '../../shared/errors';
import { logger } from '../../middlewares/logger.middleware';
import { limitsFor } from '../account/account.service';
import { buildMaintenancePlan } from '../plan/plan.service';
import { monthsBetween, parseKm, parseYmd, toYmd, today, usageFor, computeDueDate } from '../plan/plan.schedule';
import { insertReminders, listPending, listReminders, setDueDate } from '../reminder/reminder.model';
import type { CreateVehicleInput } from './vehicle.schema';
import {
  VehicleRow, deleteVehicle, findVehicle, insertVehicle, listVehicles, renameVehicle, updateOdometer, countVehicles,
} from './vehicle.model';

// Usage (km/month) is only learned after this many days between odometer readings.
const MIN_DAYS_TO_LEARN_USAGE = 7;

export function getOwnedVehicle(deviceId: string, plate: string): VehicleRow {
  const vehicle = findVehicle(deviceId, plate);
  if (!vehicle) throw notFound('Vehicle');
  return vehicle;
}

export function list(deviceId: string) {
  return listVehicles(deviceId);
}

export function get(deviceId: string, plate: string) {
  const vehicle = getOwnedVehicle(deviceId, plate);
  return { ...vehicle, reminders: listReminders(deviceId, plate) };
}

export async function create(deviceId: string, input: CreateVehicleInput) {
  if (findVehicle(deviceId, input.car_plate)) {
    throw new AppError(409, 'This plate is already registered on this device', 'PLATE_EXISTS');
  }
  const { vehicles: maxVehicles } = limitsFor(deviceId);
  if (countVehicles(deviceId) >= maxVehicles) {
    throw proRequired(`Your plan allows ${maxVehicles} vehicle(s)`);
  }

  const vehicle = insertVehicle({ deviceId, ...input });
  logger.info('Vehicle created', { deviceId, plate: vehicle.car_plate });

  // The vehicle is already saved: a plan failure must not leave the request half done.
  let aiError: string | undefined;
  try {
    const plan = await buildMaintenancePlan({
      type: input.type, model: input.model, km: input.km,
      lastMaintenance: input.last_maintenance, lastTask: input.last_task,
    });
    insertReminders(plan.map((p) => ({ deviceId, car_plate: vehicle.car_plate, ...p })));
  } catch (err) {
    aiError = 'PLAN_FAILED';
    logger.error('Maintenance plan failed', { plate: vehicle.car_plate, err: String(err) });
  }

  return { vehicle, reminders: listReminders(deviceId, vehicle.car_plate), ...(aiError ? { aiError } : {}) };
}

export function rename(deviceId: string, plate: string, newPlate: string) {
  getOwnedVehicle(deviceId, plate);
  if (newPlate !== plate && findVehicle(deviceId, newPlate)) {
    throw new AppError(409, 'This plate is already registered on this device', 'PLATE_EXISTS');
  }
  renameVehicle(deviceId, plate, newPlate);
  return getOwnedVehicle(deviceId, newPlate);
}

export function remove(deviceId: string, plate: string) {
  getOwnedVehicle(deviceId, plate);
  deleteVehicle(deviceId, plate);
  logger.info('Vehicle deleted', { deviceId, plate });
}

// Updates the odometer, learns real usage and moves km-based due dates.
export function updateKm(deviceId: string, plate: string, kmText: string) {
  const vehicle = getOwnedVehicle(deviceId, plate);
  const newKm = parseKm(kmText);
  if (newKm === null) throw new AppError(400, 'Invalid km', 'VALIDATION_ERROR');
  const oldKm = parseKm(vehicle.km);

  let kmPerMonth = vehicle.km_per_month;
  const since = parseYmd(vehicle.km_updated_at);
  if (since && oldKm !== null && newKm > oldKm) {
    const months = monthsBetween(since, today());
    if (months >= MIN_DAYS_TO_LEARN_USAGE / 30.44) {
      const observed = (newKm - oldKm) / months;
      kmPerMonth = Math.round(kmPerMonth ? (kmPerMonth + observed) / 2 : observed);
    }
  }

  const usage = usageFor(vehicle.type, kmPerMonth);
  let recalculated = 0;
  db.transaction(() => {
    updateOdometer(vehicle.id, newKm, kmPerMonth, toYmd(today()));
    for (const r of listPending(deviceId, plate)) {
      if (!r.interval_km || !r.interval_months) continue;
      const due = toYmd(computeDueDate({
        baseDate: parseYmd(r.base_date) ?? today(), baseKm: r.base_km, intervalKm: r.interval_km,
        intervalMonths: r.interval_months, currentKm: newKm, kmPerMonth: usage,
      }));
      if (due !== r.dateTime) {
        setDueDate(r.id, due);
        recalculated++;
      }
    }
  })();

  logger.info('Km updated', { plate, km: newKm, kmPerMonth, recalculated });
  return { km: newKm, km_per_month: kmPerMonth, recalculated, reminders: listReminders(deviceId, plate) };
}

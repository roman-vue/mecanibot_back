import { z } from 'zod';
import { plate, ymd } from '../vehicle/vehicle.schema';
import { DOCUMENT_KINDS } from './document.model';

export const documentParamsSchema = z.object({ plate, kind: z.enum(DOCUMENT_KINDS) });

export const setDocumentSchema = z.object({ expires_on: ymd });

import type { Response } from 'express';

export const ok = <T>(res: Response, data: T) => res.status(200).json({ success: true, data });

export const created = <T>(res: Response, data: T) => res.status(201).json({ success: true, data });

import { z } from 'zod';
export const PrintArea = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1), width_mm: z.number().positive(), height_mm: z.number().positive() });
export const GarmentPrintAreas = z.partialRecord(z.enum(['front','back','left_sleeve','right_sleeve','hood','crown','visor','side']), PrintArea);

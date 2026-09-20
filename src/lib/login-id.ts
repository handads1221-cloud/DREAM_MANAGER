import { createHash } from 'node:crypto';
export function normalizeLoginId(value: string) { return value.trim().normalize('NFKC').toLocaleLowerCase('en-US'); }
export function loginIdToAuthEmail(value: string) { return `u_${createHash('sha256').update(normalizeLoginId(value), 'utf8').digest('hex')}@accounts.dream-manager.invalid`; }

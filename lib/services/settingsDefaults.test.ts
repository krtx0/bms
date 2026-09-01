// Covers the one real branch in settingsDefaults.ts: default-filling when the singleton doc is
// missing business_info/workspace — the expected steady state, since numbering.ts's counters.*
// writes have been upserting this doc since Phase 3, long before Settings ever wrote business
// fields.

import { expect, it } from 'vitest';
import { withDefaults } from './settingsDefaults';

it('doc is null (settings doc never created) — full defaults', () => {
  const result = withDefaults(null);
  expect(result.business_info).toEqual({
    name: 'Mélange Patisserie',
    tagline: '',
    email: '',
    phone: '',
    address: '',
    gstin: '',
  });
  expect(result.workspace).toEqual({ currency: 'INR', timezone: 'Asia/Kolkata' });
});

it('doc exists with only counters (no business_info/workspace keys at all) — full defaults', () => {
  const result = withDefaults({});
  expect(result.business_info.name).toBe('Mélange Patisserie');
  expect(result.workspace.currency).toBe('INR');
});

it('stored values pass through untouched once saved', () => {
  const result = withDefaults({
    business_info: { name: 'Sugar & Spice', tagline: 'Fresh daily', email: 'a@b.com', phone: '123', address: 'X', gstin: 'GST1' },
    workspace: { currency: 'USD', timezone: 'America/New_York' },
  });
  expect(result.business_info.name).toBe('Sugar & Spice');
  expect(result.workspace).toEqual({ currency: 'USD', timezone: 'America/New_York' });
});

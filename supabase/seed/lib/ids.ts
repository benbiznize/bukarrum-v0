/**
 * Stable UUIDs and identifiers for the demo tenant.
 * These MUST match any hardcoded references in tests,
 * bookmarks, or docs. Do not change without updating call sites.
 */
export const DEMO = {
  authUserId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'demo@bukarrum.test',
  password: 'demo-password-123',

  tenantId: '11111111-1111-1111-1111-111111111111',
  tenantSlug: 'estudio-sonico',
  tenantName: 'Estudio Sónico',

  locations: {
    providencia: {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Sede Providencia',
      slug: 'providencia',
      address: 'Av. Providencia 1234',
      city: 'Santiago',
      timezone: 'America/Santiago',
    },
    nunoa: {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Sede Ñuñoa',
      slug: 'nunoa',
      address: 'Irarrázaval 567',
      city: 'Santiago',
      timezone: 'America/Santiago',
    },
  },

  resources: {
    djRoom:            'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    productionStudioA: 'aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    ciclorama:         'aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    podcastRoom:       'bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    lightingKit:       'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  },
} as const;

export const PLAN_SLUGS = ['starter', 'pro', 'enterprise'] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

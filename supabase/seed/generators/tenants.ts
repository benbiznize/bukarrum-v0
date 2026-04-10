import type { Sql } from '../lib/db';
import { DEMO, PLAN_SLUGS } from '../lib/ids';
import { fakerEs, slugify } from '../lib/faker';
import type {
  SeededAddOn,
  SeededResource,
  SeededTenant,
  DayOfWeek,
} from '../lib/types';

/**
 * Insert the hardcoded Estudio Sónico skeleton: tenant, subscription,
 * locations, resources, resource_locations, availability, add-ons.
 *
 * Returns a normalized SeededTenant the booking generator can consume.
 */
export async function seedDemoTenant(
  sql: Sql,
  planIdBySlug: Record<string, string>,
): Promise<SeededTenant> {
  const { providencia, nunoa } = DEMO.locations;

  // Tenant
  await sql`
    insert into public.tenants (id, user_id, name, slug)
    values (${DEMO.tenantId}, ${DEMO.authUserId}, ${DEMO.tenantName}, ${DEMO.tenantSlug})
  `;

  // Subscription (Pro)
  await sql`
    insert into public.subscriptions
      (tenant_id, plan_id, status, current_period_start, current_period_end)
    values (
      ${DEMO.tenantId},
      ${planIdBySlug.pro},
      'active',
      now(),
      now() + interval '30 days'
    )
  `;

  // Locations
  await sql`
    insert into public.locations
      (id, tenant_id, name, slug, address, city, timezone)
    values
      (${providencia.id}, ${DEMO.tenantId}, ${providencia.name}, ${providencia.slug},
       ${providencia.address}, ${providencia.city}, ${providencia.timezone}),
      (${nunoa.id},       ${DEMO.tenantId}, ${nunoa.name},       ${nunoa.slug},
       ${nunoa.address},  ${nunoa.city},    ${nunoa.timezone})
  `;

  // Resources (tenant-scoped)
  const resourceSeeds: Array<{
    id: string;
    name: string;
    description: string;
    type: 'room' | 'equipment';
    hourlyRate: number;
    minH: number;
    maxH: number;
    locationIds: string[];
    availability: Array<{ day: DayOfWeek; start: string; end: string }>;
    addOns: Array<{ name: string; description: string; mode: 'hourly' | 'flat'; price: number }>;
  }> = [
    {
      id: DEMO.resources.djRoom,
      name: 'Sala de Ensayo DJ',
      description: 'Sala equipada con CDJs Pioneer, mixer DJM-900, y monitores KRK',
      type: 'room',
      hourlyRate: 15000,
      minH: 1,
      maxH: 4,
      locationIds: [providencia.id],
      availability: weekdays(['monday','tuesday','wednesday','thursday','friday','saturday'], '10:00', '22:00'),
      addOns: [
        { name: 'Arriendo de Audífonos', description: 'Audífonos DJ profesionales Pioneer HDJ-X7', mode: 'flat',   price: 5000 },
        { name: 'Pendrive con Música',    description: 'Pendrive cargado con set curado de tracks',  mode: 'flat',   price: 3000 },
        { name: 'Grabación de Audio',     description: 'Grabación profesional del set completo',     mode: 'hourly', price: 8000 },
      ],
    },
    {
      id: DEMO.resources.productionStudioA,
      name: 'Estudio de Producción A',
      description: 'Producción musical con Pro Tools, interfaz Apollo, y monitores Genelec',
      type: 'room',
      hourlyRate: 25000,
      minH: 2,
      maxH: 8,
      locationIds: [providencia.id],
      availability: weekdays(['monday','tuesday','wednesday','thursday','friday'], '09:00', '23:00'),
      addOns: [
        { name: 'Ingeniero de Sonido', description: 'Técnico profesional para grabación y mezcla en vivo', mode: 'hourly', price: 20000 },
      ],
    },
    {
      id: DEMO.resources.ciclorama,
      name: 'Ciclorama',
      description: 'Ciclorama blanco 4x6m para fotografía y video',
      type: 'room',
      hourlyRate: 35000,
      minH: 2,
      maxH: 8,
      locationIds: [providencia.id],
      availability: weekdays(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'], '08:00', '20:00'),
      addOns: [
        { name: 'Fotógrafo', description: 'Fotógrafo profesional para sesiones en ciclorama', mode: 'hourly', price: 25000 },
      ],
    },
    {
      id: DEMO.resources.podcastRoom,
      name: 'Sala de Podcasting',
      description: 'Sala acústica con 4 micrófonos Shure SM7B y grabadora Rodecaster',
      type: 'room',
      hourlyRate: 12000,
      minH: 1,
      maxH: 4,
      locationIds: [nunoa.id],
      availability: weekdays(['monday','tuesday','wednesday','thursday','friday','saturday'], '09:00', '21:00'),
      addOns: [
        { name: 'Editor de Podcast', description: 'Post-producción y edición de audio para tu podcast', mode: 'flat', price: 15000 },
      ],
    },
    {
      id: DEMO.resources.lightingKit,
      name: 'Kit de Iluminación',
      description: 'Kit completo Godox con 3 luces, softboxes y trípodes',
      type: 'equipment',
      hourlyRate: 8000,
      minH: 1,
      maxH: 8,
      locationIds: [providencia.id, nunoa.id],
      availability: weekdays(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'], '08:00', '22:00'),
      addOns: [],
    },
  ];

  // Insert resources in one batch
  const resourceRows = resourceSeeds.map((r) => ({
    id: r.id,
    tenant_id: DEMO.tenantId,
    name: r.name,
    description: r.description,
    type: r.type,
    hourly_rate: r.hourlyRate,
    min_duration_hours: r.minH,
    max_duration_hours: r.maxH,
  }));
  await sql`insert into public.resources ${sql(resourceRows)}`;

  // Resource <-> location junction rows
  const rlRows = resourceSeeds.flatMap((r) =>
    r.locationIds.map((locId) => ({ resource_id: r.id, location_id: locId })),
  );
  await sql`insert into public.resource_locations ${sql(rlRows)}`;

  // Availability rows
  const availRows = resourceSeeds.flatMap((r) =>
    r.availability.map((a) => ({
      resource_id: r.id,
      day_of_week: a.day,
      start_time: a.start,
      end_time: a.end,
    })),
  );
  await sql`insert into public.availability ${sql(availRows)}`;

  // Add-ons — collect ids as we go so we can return them in the SeededResource
  const addOnRowsByResource = new Map<string, SeededAddOn[]>();
  const addOnRowsFlat = resourceSeeds.flatMap((r) =>
    r.addOns.map((a) => ({
      resource_id: r.id,
      name: a.name,
      description: a.description,
      pricing_mode: a.mode,
      unit_price: a.price,
    })),
  );

  if (addOnRowsFlat.length > 0) {
    const inserted = await sql<{ id: string; resource_id: string; name: string; pricing_mode: 'hourly' | 'flat'; unit_price: number }[]>`
      insert into public.add_on_services ${sql(addOnRowsFlat)}
      returning id, resource_id, name, pricing_mode, unit_price
    `;
    for (const row of inserted) {
      const list = addOnRowsByResource.get(row.resource_id) ?? [];
      list.push({
        id: row.id,
        name: row.name,
        pricingMode: row.pricing_mode,
        unitPrice: row.unit_price,
      });
      addOnRowsByResource.set(row.resource_id, list);
    }
  }

  const resources: SeededResource[] = resourceSeeds.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    hourlyRate: r.hourlyRate,
    minDurationHours: r.minH,
    maxDurationHours: r.maxH,
    locationIds: r.locationIds,
    availability: r.availability.map((a) => ({
      dayOfWeek: a.day,
      startTime: a.start,
      endTime: a.end,
    })),
    addOns: addOnRowsByResource.get(r.id) ?? [],
  }));

  return {
    id: DEMO.tenantId,
    name: DEMO.tenantName,
    slug: DEMO.tenantSlug,
    ownerUserId: DEMO.authUserId,
    planSlug: 'pro',
    locations: [
      { id: providencia.id, name: providencia.name, slug: providencia.slug, address: providencia.address, city: providencia.city, timezone: providencia.timezone },
      { id: nunoa.id,       name: nunoa.name,       slug: nunoa.slug,       address: nunoa.address,       city: nunoa.city,       timezone: nunoa.timezone },
    ],
    resources,
  };
}

function weekdays(days: DayOfWeek[], start: string, end: string) {
  return days.map((day) => ({ day, start, end }));
}

/**
 * Creates 3 fully-generated thin tenants, one per plan tier.
 * Used to exercise RLS isolation and plan gating in a dev environment.
 *
 * Auth users are created BEFORE this function because the admin API
 * cannot be called inside the pg transaction — see index.ts.
 */
export async function seedThinTenants(
  sql: Sql,
  planIdBySlug: Record<string, string>,
  ownerUserIds: string[],
): Promise<SeededTenant[]> {
  if (ownerUserIds.length !== PLAN_SLUGS.length) {
    throw new Error(
      `[seed] expected ${PLAN_SLUGS.length} thin-tenant owners, got ${ownerUserIds.length}`,
    );
  }

  const tenants: SeededTenant[] = [];

  for (let i = 0; i < PLAN_SLUGS.length; i++) {
    const planSlug = PLAN_SLUGS[i];
    const ownerUserId = ownerUserIds[i];
    const prefix = fakerEs.helpers.arrayElement(['Estudio', 'Sala', 'Ciclorama']);
    const suffix = fakerEs.company.name().split(/\s+/)[0];
    const name = `${prefix} ${suffix}`;
    const suffixHash = fakerEs.string.alphanumeric({ length: 4, casing: 'lower' });
    const slug = `${slugify(name)}-${suffixHash}`;

    // Tenant row
    const [{ id: tenantId }] = await sql<{ id: string }[]>`
      insert into public.tenants (user_id, name, slug)
      values (${ownerUserId}, ${name}, ${slug})
      returning id
    `;

    // Subscription
    await sql`
      insert into public.subscriptions
        (tenant_id, plan_id, status, current_period_start, current_period_end)
      values (
        ${tenantId},
        ${planIdBySlug[planSlug]},
        'active',
        now(),
        now() + interval '30 days'
      )
    `;

    // 1-2 locations
    const locationCount = fakerEs.number.int({ min: 1, max: 2 });
    const locationRows = Array.from({ length: locationCount }, (_, idx) => {
      const city = fakerEs.helpers.arrayElement(['Santiago', 'Valparaíso', 'Concepción']);
      const locName = `Sede ${fakerEs.location.street()}`;
      return {
        tenant_id: tenantId,
        name: locName,
        slug: `${slugify(locName)}-${idx + 1}`,
        address: fakerEs.location.streetAddress(),
        city,
        timezone: 'America/Santiago',
      };
    });
    const insertedLocations = await sql<{ id: string; name: string; slug: string; address: string; city: string; timezone: string }[]>`
      insert into public.locations ${sql(locationRows)}
      returning id, name, slug, address, city, timezone
    `;

    // 2-4 resources
    const resourceCount = fakerEs.number.int({ min: 2, max: 4 });
    const resourceSeeds = Array.from({ length: resourceCount }, () => {
      const hourlyRate = fakerEs.number.int({ min: 8, max: 40 }) * 1000;
      const resName = fakerEs.helpers.arrayElement([
        'Sala de Ensayo', 'Estudio de Grabación', 'Ciclorama', 'Sala de Podcast',
        'Salón Principal', 'Estudio B', 'Sala Acústica', 'Box de Ensayo',
      ]);
      return {
        tenant_id: tenantId,
        name: resName,
        description: fakerEs.lorem.sentence({ min: 6, max: 12 }),
        type: 'room' as const,
        hourly_rate: hourlyRate,
        min_duration_hours: 1,
        max_duration_hours: 4,
      };
    });
    const insertedResources = await sql<{ id: string; name: string; type: 'room' | 'equipment'; hourly_rate: number; min_duration_hours: number; max_duration_hours: number }[]>`
      insert into public.resources ${sql(resourceSeeds)}
      returning id, name, type, hourly_rate, min_duration_hours, max_duration_hours
    `;

    // Attach every resource to every location (simple, realistic)
    const rlRows = insertedResources.flatMap((r) =>
      insertedLocations.map((loc) => ({ resource_id: r.id, location_id: loc.id })),
    );
    await sql`insert into public.resource_locations ${sql(rlRows)}`;

    // Availability: Mon-Sat 09:00-21:00 for every resource
    const days: DayOfWeek[] = ['monday','tuesday','wednesday','thursday','friday','saturday'];
    const availRows = insertedResources.flatMap((r) =>
      days.map((day) => ({
        resource_id: r.id,
        day_of_week: day,
        start_time: '09:00',
        end_time: '21:00',
      })),
    );
    await sql`insert into public.availability ${sql(availRows)}`;

    // 0-1 add-ons per resource
    const addOnRowsFlat: Array<{ resource_id: string; name: string; description: string; pricing_mode: 'hourly' | 'flat'; unit_price: number }> = [];
    for (const r of insertedResources) {
      if (fakerEs.datatype.boolean()) {
        addOnRowsFlat.push({
          resource_id: r.id,
          name: fakerEs.helpers.arrayElement(['Arriendo de Audífonos','Servicio de Catering','Fotógrafo','Técnico de Sonido']),
          description: fakerEs.lorem.sentence({ min: 4, max: 8 }),
          pricing_mode: fakerEs.helpers.arrayElement(['hourly','flat'] as const),
          unit_price: fakerEs.number.int({ min: 3, max: 20 }) * 1000,
        });
      }
    }

    const addOnsByResource = new Map<string, SeededAddOn[]>();
    if (addOnRowsFlat.length > 0) {
      const inserted = await sql<{ id: string; resource_id: string; name: string; pricing_mode: 'hourly' | 'flat'; unit_price: number }[]>`
        insert into public.add_on_services ${sql(addOnRowsFlat)}
        returning id, resource_id, name, pricing_mode, unit_price
      `;
      for (const row of inserted) {
        const list = addOnsByResource.get(row.resource_id) ?? [];
        list.push({ id: row.id, name: row.name, pricingMode: row.pricing_mode, unitPrice: row.unit_price });
        addOnsByResource.set(row.resource_id, list);
      }
    }

    const resources: SeededResource[] = insertedResources.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      hourlyRate: r.hourly_rate,
      minDurationHours: r.min_duration_hours,
      maxDurationHours: r.max_duration_hours,
      locationIds: insertedLocations.map((l) => l.id),
      availability: days.map((day) => ({ dayOfWeek: day, startTime: '09:00', endTime: '21:00' })),
      addOns: addOnsByResource.get(r.id) ?? [],
    }));

    tenants.push({
      id: tenantId,
      name,
      slug,
      ownerUserId,
      planSlug,
      locations: insertedLocations.map((l) => ({
        id: l.id,
        name: l.name,
        slug: l.slug,
        address: l.address,
        city: l.city,
        timezone: l.timezone,
      })),
      resources,
    });
  }

  return tenants;
}

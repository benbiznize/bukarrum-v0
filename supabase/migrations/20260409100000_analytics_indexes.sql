-- Composite index for analytics date-range queries by resource
CREATE INDEX IF NOT EXISTS bookings_resource_start_time_idx
  ON public.bookings(resource_id, start_time);

-- Index on location_id for location-based analytics grouping
CREATE INDEX IF NOT EXISTS bookings_location_id_idx
  ON public.bookings(location_id);

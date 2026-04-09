export type CalendarBooking = {
  id: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  total_price: number;
  status: string;
  notes: string | null;
  resource_id: string;
  resource_name: string;
  location_id: string | null;
  location_name: string | null;
  booker_name: string;
  booker_email: string;
};

export type CalendarResource = {
  id: string;
  name: string;
};

export type CalendarLocation = {
  id: string;
  name: string;
  timezone: string | null;
};

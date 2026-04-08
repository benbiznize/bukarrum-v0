"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";

type Location = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  timezone: string;
};

export function StepLocation({
  locations,
  dispatch,
}: {
  locations: Location[];
  dispatch: React.Dispatch<{ type: "SELECT_LOCATION"; locationId: string; locationName: string; locationTimezone: string }>;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Selecciona un local</h2>
      <div className="grid gap-3">
        {locations.map((loc) => (
          <Card
            key={loc.id}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() =>
              dispatch({
                type: "SELECT_LOCATION",
                locationId: loc.id,
                locationName: loc.name,
                locationTimezone: loc.timezone,
              })
            }
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <MapPin className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{loc.name}</p>
                {loc.address && (
                  <p className="text-sm text-muted-foreground">
                    {loc.address}{loc.city ? `, ${loc.city}` : ""}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

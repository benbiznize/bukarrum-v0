"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getResourcesForLocation } from "@/app/(booking)/[tenantSlug]/actions";
import { useDict } from "@/lib/i18n/dict-context";

type Resource = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  hourly_rate: number;
  min_duration_hours: number;
  max_duration_hours: number;
  image_url: string | null;
};

const fmt = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

export function StepResource({
  locationId,
  dispatch,
}: {
  locationId: string;
  dispatch: React.Dispatch<{
    type: "SELECT_RESOURCE";
    resourceId: string;
    resourceName: string;
    hourlyRate: number;
    minDuration: number;
    maxDuration: number;
  }>;
}) {
  const { booking, common } = useDict();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getResourcesForLocation(locationId).then((data) => {
      setResources(data as Resource[]);
      setLoading(false);
    });
  }, [locationId]);

  if (loading) {
    return (
      <div className="grid gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (resources.length === 0) {
    return <p className="text-muted-foreground text-center py-8">{booking.noResources}</p>;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">{booking.selectResource}</h2>
      <div className="grid gap-3">
        {resources.map((res) => (
          <Card
            key={res.id}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() =>
              dispatch({
                type: "SELECT_RESOURCE",
                resourceId: res.id,
                resourceName: res.name,
                hourlyRate: res.hourly_rate,
                minDuration: res.min_duration_hours,
                maxDuration: res.max_duration_hours,
              })
            }
          >
            <CardContent className="p-0 overflow-hidden">
              {res.image_url && (
                <div className="relative w-full aspect-[3/1]">
                  <Image
                    src={res.image_url}
                    alt={res.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 512px) 100vw, 512px"
                    unoptimized
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{res.name}</p>
                    {res.description && (
                      <p className="text-sm text-muted-foreground mt-1">{res.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    {res.type === "room" ? common.room : common.equipment}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-primary mt-2">
                  {fmt.format(res.hourly_rate)} {common.perHour}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

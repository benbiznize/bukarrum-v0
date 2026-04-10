import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type DashboardDict = {
  analyticsView: {
    upgradeTitle: string;
    upgradeDesc: string;
    upgradeButton: string;
  };
};

export function UpgradePrompt({
  dict,
  tenantSlug,
}: {
  dict: DashboardDict;
  tenantSlug: string;
}) {
  const d = dict.analyticsView;

  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center text-center gap-4 pt-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold">{d.upgradeTitle}</h2>
          <p className="text-muted-foreground">{d.upgradeDesc}</p>
          <Button
            nativeButton={false}
            render={<Link href={`/dashboard/${tenantSlug}/settings`} />}
          >
            {d.upgradeButton}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import type { Activity } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  activities: Activity[];
  onSelect: (activity: Activity) => void;
};

export function StravaImportPanel({ activities, onSelect }: Props) {
  return (
    <Card className="space-y-4 bg-panelAlt/95">
      <div>
        <p className="text-xs uppercase tracking-widest text-accent">Import from Strava</p>
        <h3 className="mt-1 text-lg font-semibold">Select an activity to auto-fill</h3>
      </div>
      <div className="space-y-3">
        {activities.map((activity) => (
          <div key={activity.id} className="rounded-xl border border-border bg-background/70 p-3">
            <p className="font-medium">{activity.name}</p>
            <p className="text-xs text-muted">
              {activity.distance_km} km - {activity.date}
            </p>
            <Button className="mt-2 text-xs uppercase tracking-wider" variant="secondary" onClick={() => onSelect(activity)} type="button">
              Use this activity
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

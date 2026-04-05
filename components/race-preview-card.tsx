import { Card } from "@/components/ui/card";

type Props = {
  name: string;
  location: string;
  date: string;
  distanceKm: string;
  elevationM: string;
  time: string;
  description: string;
};

export function RacePreviewCard(props: Props) {
  return (
    <Card className="relative h-full overflow-hidden p-0">
      <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: "url('/reference/hero-3.png')" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#04070d]" />
      <div className="relative p-6">
      <p className="text-xs uppercase tracking-widest text-gold">Live Preview</p>
      <h3 className="mt-3 text-3xl font-semibold">{props.name || "Your race name"}</h3>
      <p className="mt-1 text-sm text-muted">{props.location || "Location pending"}</p>
      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted">Date</p>
          <p>{props.date || "TBD"}</p>
        </div>
        <div>
          <p className="text-muted">Distance</p>
          <p>{props.distanceKm ? `${props.distanceKm} km` : "TBD"}</p>
        </div>
        <div>
          <p className="text-muted">Elevation</p>
          <p>{props.elevationM ? `${props.elevationM} m` : "N/A"}</p>
        </div>
        <div>
          <p className="text-muted">Time</p>
          <p>{props.time || "N/A"}</p>
        </div>
      </div>
      <p className="mt-6 text-sm leading-relaxed text-slate-200">
        {props.description || "Why this race mattered to you..."}
      </p>
      </div>
    </Card>
  );
}

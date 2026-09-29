import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Play, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";
import { trackingLocation, trackingOccupancy, trackingSOS, trackingStart, trackingStatus } from "@/integrations/backend/client";

export function DriverDashboard({ driverId }: { driverId: string }) {
  const [isTripActive, setIsTripActive] = useState(false);
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [occupancy, setOccupancy] = useState<"low" | "medium" | "high">("low");
  const [locationInterval, setLocationInterval] = useState<NodeJS.Timeout | null>(null);

  const startTrip = async () => {
    try {
      const result = await trackingStart({ occupancy: "low" });
      const trip = result.json?.data;
      if (!result.res.ok || !trip) throw new Error(result.json?.message || "Could not start trip");
      setCurrentTripId(trip.id);
      setIsTripActive(true);
      toast.success("Trip started. GPS broadcasting is active.");

      const broadcast = () => {
        if (!navigator.geolocation) {
          toast.error("This device does not support GPS.");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const response = await trackingLocation(trip.id, {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              speed: Number.isFinite(position.coords.speed as number) ? position.coords.speed : null,
              bearing: Number.isFinite(position.coords.heading as number) ? position.coords.heading : null,
              accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
            });
            if (!response.res.ok) toast.error(response.json?.message || "GPS update failed");
          },
          (error) => toast.error(`GPS error: ${error.message}`),
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
        );
      };
      broadcast();
      const interval = setInterval(broadcast, 10000);
      setLocationInterval(interval);
    } catch (error: any) {
      toast.error(error.message || "Could not start trip");
    }
  };

  const endTrip = async () => {
    if (!currentTripId) return;
    try {
      const result = await trackingStatus(currentTripId, "completed");
      if (!result.res.ok) throw new Error(result.json?.message || "Could not end trip");
      if (locationInterval) clearInterval(locationInterval);
      setLocationInterval(null);
      setIsTripActive(false);
      setCurrentTripId(null);
      toast.success("Trip completed");
    } catch (error: any) {
      toast.error(error.message || "Could not end trip");
    }
  };

  const handleOccupancyChange = async (level: "low" | "medium" | "high") => {
    setOccupancy(level);
    if (currentTripId) {
      const result = await trackingOccupancy(currentTripId, level);
      if (!result.res.ok) toast.error(result.json?.message || "Could not update occupancy");
    }

  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="rounded-[2rem] shadow-sm border-none bg-white p-6">
        <CardHeader className="px-0">
          <CardTitle className="font-display text-2xl flex items-center gap-2">
            <Play className={`h-6 w-6 ${isTripActive ? 'text-green-500' : 'text-slate-300'}`} />
            Trip Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 space-y-8">
          <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <p className="font-bold text-ink">Trip Status</p>
              <p className="text-sm text-ink/60">{isTripActive ? "Broadcasting GPS..." : "Ready to start"}</p>
            </div>
            <Switch 
              checked={isTripActive} 
              onCheckedChange={(val) => val ? startTrip() : endTrip()} 
            />
          </div>

          <div className="space-y-4">
            <Label className="font-bold flex items-center gap-2">
              <Users className="h-4 w-4" /> Bus Occupancy
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {(['low', 'medium', 'high'] as const).map((level) => (
                <Button
                  key={level}
                  variant={occupancy === level ? "default" : "outline"}
                  className={`rounded-xl capitalize font-bold h-12 transition-all ${
                    occupancy === level ? 'bg-primary shadow-lg scale-105' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => handleOccupancyChange(level)}
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>

          <Button 
            variant="destructive" 
            className="w-full h-14 rounded-xl font-bold flex items-center gap-2 shadow-lg"
            onClick={async () => {
              const result = await trackingSOS({ tripId: currentTripId || undefined, message: "Driver pressed SOS / Emergency" });
              if (!result.res.ok) toast.error(result.json?.message || "SOS failed");
              else toast.error("Emergency alert sent to admin");
            }}
          >
            <AlertTriangle className="h-5 w-5" /> SOS / Emergency
          </Button>
        </CardContent>
      </Card>
      
      {/* Route Info Card */}
      <Card className="rounded-[2rem] shadow-sm border-none bg-slate-900 text-white p-6">
        <CardHeader className="px-0">
          <CardTitle className="font-display text-2xl">Current Route</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center font-bold text-xl">1</div>
              <div>
                <p className="font-bold">Campus Main</p>
                <p className="text-sm text-white/60">Next Stop: Administrative Building</p>
              </div>
            </div>
            {/* Add more route steps here */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

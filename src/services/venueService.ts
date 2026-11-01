import { getSupabase } from "@/lib/supabase";

export interface VerifiedVenue {
  id: string;
  name: string;
  lat: number;
  lng: number;
  accuracy: number;
  verified_at: string;
}

export async function listVerifiedVenues(): Promise<VerifiedVenue[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Connect to the server to load saved venues.");
  const { data, error } = await supabase
    .from("verified_venues")
    .select("id,name,lat,lng,accuracy,verified_at")
    .eq("active", true)
    .order("name");
  if (error)
    throw new Error(
      "Saved venues could not be loaded. You can still capture a fresh venue location.",
    );
  return (data ?? []) as VerifiedVenue[];
}

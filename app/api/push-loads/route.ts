import { NextRequest, NextResponse } from "next/server";

const SHV_URL = "https://shv-logistics-tms.vercel.app/api/sor/loads";
const USER_EMAIL = process.env.USER_EMAIL || "samka.marfua@accenture.com";

type WalmartLoad = {
  load_no: string;
  frt_ord_no: string;
  shipper_nm: string;
  orig_city: string;
  orig_st: string;
  dest_city: string;
  dest_st: string;
  shp_dt: string;
  del_dt: string;
  wgt: string | null;
  mode: string;
};

type SHVLoad = {
  load_number: string;
  bol_number: string;
  shipper_name: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  ship_date: string;
  delivery_date: string;
  weight: number;
  equipment_type: string;
};

type PushResult = {
  load_number: string;
  status: "accepted" | "rejected" | "skipped";
  errors?: string[];
};

// MMDDYYYY → DDMMYYYY
function toSHVDate(mmddyyyy: string): string {
  if (!mmddyyyy || mmddyyyy.length !== 8) return mmddyyyy ?? "";
  return mmddyyyy.slice(2, 4) + mmddyyyy.slice(0, 2) + mmddyyyy.slice(4);
}

// "41,860 lbs" → 41860
function parseWeight(wgt: string | null): number {
  if (!wgt) return 0;
  return Math.round(Number(wgt.replace(/,/g, "").replace(/\s*lbs?/i, "").trim())) || 0;
}

function getEquipmentType(mode: string): string | null {
  const m = (mode ?? "").toUpperCase().trim();
  if (m === "AMBIENT") return "Dry Van 53'";
  if (m === "REFRIGERATED" || m === "FREEZER") return "Reefer 53'";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { loads }: { loads: WalmartLoad[] } = await req.json();

    if (!Array.isArray(loads) || loads.length === 0) {
      return NextResponse.json({ error: "No loads provided" }, { status: 400 });
    }

    const toSend: SHVLoad[] = [];
    const skipped: PushResult[] = [];

    for (const load of loads) {
      const equipment_type = getEquipmentType(load.mode);
      if (!equipment_type) {
        skipped.push({
          load_number: load.load_no,
          status: "skipped",
          errors: [`Mode "${load.mode}" requires manual review — call Walmart for temperature details`],
        });
        continue;
      }

      toSend.push({
        load_number: load.load_no,
        bol_number: load.frt_ord_no,
        shipper_name: load.shipper_nm.trim(),
        origin_city: load.orig_city.trim(),
        origin_state: load.orig_st.trim(),
        destination_city: load.dest_city.trim(),
        destination_state: load.dest_st.trim(),
        ship_date: toSHVDate(load.shp_dt),
        delivery_date: toSHVDate(load.del_dt),
        weight: parseWeight(load.wgt),
        equipment_type,
      });
    }

    if (toSend.length === 0) {
      return NextResponse.json({ results: skipped });
    }

    const body = toSend.length === 1 ? { load: toSend[0] } : { loads: toSend };

    const res = await fetch(SHV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${USER_EMAIL}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    // Map SHV accepted/rejected arrays back to per-load results
    const accepted: string[] = data.accepted ?? [];
    const rejected: Array<{ load_number: string; errors: string[] }> = data.rejected ?? [];

    const pushed: PushResult[] = [
      ...accepted.map((ln) => ({ load_number: ln, status: "accepted" as const })),
      ...rejected.map((r) => ({ load_number: r.load_number, status: "rejected" as const, errors: r.errors })),
    ];

    // For any loads sent but not in either list (shouldn't happen, but be safe)
    for (const load of toSend) {
      if (!pushed.find((r) => r.load_number === load.load_number)) {
        pushed.push({ load_number: load.load_number, status: "rejected", errors: ["No response from SHV"] });
      }
    }

    return NextResponse.json({ results: [...pushed, ...skipped] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

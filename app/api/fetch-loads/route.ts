import { NextResponse } from "next/server";

const WALMART_API_URL = "https://wmt-freight-portal.vercel.app/api/sap/loads";
const USER_EMAIL = process.env.USER_EMAIL || "samka.marfua@accenture.com";

export async function GET() {
  try {
    const res = await fetch(WALMART_API_URL, {
      headers: { Authorization: `Bearer ${USER_EMAIL}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Walmart API ${res.status}: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ loads: data.loads ?? [], count: data.count ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

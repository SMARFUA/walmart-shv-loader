"use client";

import { useState } from "react";

type WalmartLoad = {
  load_no: string;
  tender_id: string;
  frt_ord_no: string;
  carrier_scac: string;
  shipper_nm: string;
  vendor_nbr: string;
  orig_city: string;
  orig_st: string;
  dc_nbr: string;
  dest_city: string;
  dest_st: string;
  dept_nbr: string;
  shp_dt: string;
  del_dt: string;
  pallet_cnt: string;
  case_cnt: string;
  wgt: string | null;
  dist_mi: string;
  hazmat_flg: string;
  mode: string;
};

type PushResult = {
  load_number: string;
  status: "accepted" | "rejected" | "skipped";
  errors?: string[];
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

function equipmentType(mode: string): { type: string; needsReview: boolean; reason?: string } {
  const m = (mode ?? "").toUpperCase().trim();
  if (m === "AMBIENT") return { type: "Dry Van 53'", needsReview: false };
  if (m === "REFRIGERATED" || m === "FREEZER") return { type: "Reefer 53'", needsReview: false };
  return {
    type: "",
    needsReview: true,
    reason: `Mode "${mode}" — call Walmart for temperature details before pushing`,
  };
}

function displayDate(mmddyyyy: string): string {
  if (!mmddyyyy || mmddyyyy.length !== 8) return mmddyyyy ?? "";
  return `${mmddyyyy.slice(0, 2)}/${mmddyyyy.slice(2, 4)}/${mmddyyyy.slice(4)}`;
}

function displayWeight(wgt: string | null): string {
  return wgt ?? "—";
}

export default function Home() {
  const [loads, setLoads] = useState<WalmartLoad[]>([]);
  const [fetchMsg, setFetchMsg] = useState("");
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pushMsg, setPushMsg] = useState("");
  const [pushState, setPushState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pushResults, setPushResults] = useState<PushResult[]>([]);
  const [sanitizedLoads, setSanitizedLoads] = useState<SHVLoad[]>([]);

  async function fetchLoads() {
    setFetchState("loading");
    setFetchMsg("Fetching open tenders from Walmart...");
    setLoads([]);
    setPushResults([]);
    setSanitizedLoads([]);
    setPushMsg("");
    setPushState("idle");

    try {
      const res = await fetch("/api/fetch-loads");
      const data = await res.json();
      if (!res.ok) {
        setFetchState("error");
        setFetchMsg(`Error: ${data.error ?? res.statusText}`);
        return;
      }
      setLoads(data.loads ?? []);
      setFetchState("success");
      setFetchMsg(`${data.count ?? data.loads?.length ?? 0} open tender${data.count !== 1 ? "s" : ""} fetched.`);
    } catch (err) {
      setFetchState("error");
      setFetchMsg(`Network error: ${String(err)}`);
    }
  }

  async function sanitizeAndPush() {
    if (loads.length === 0) return;
    setPushState("loading");
    setPushMsg("Sanitizing and pushing to SHV TMS...");
    setPushResults([]);

    try {
      const res = await fetch("/api/push-loads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loads }),
      });
      const data = await res.json();
      if (!res.ok && !data.results) {
        setPushState("error");
        setPushMsg(`Error: ${data.error ?? res.statusText}`);
        return;
      }
      const results: PushResult[] = data.results ?? [];
      setPushResults(results);
      setSanitizedLoads(data.sanitized ?? []);
      const accepted = results.filter((r) => r.status === "accepted").length;
      const rejected = results.filter((r) => r.status === "rejected").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      const parts = [];
      if (accepted) parts.push(`${accepted} accepted`);
      if (rejected) parts.push(`${rejected} rejected`);
      if (skipped) parts.push(`${skipped} skipped (needs review)`);
      setPushState(rejected > 0 ? "error" : "success");
      setPushMsg(parts.join(", ") + ".");
    } catch (err) {
      setPushState("error");
      setPushMsg(`Network error: ${String(err)}`);
    }
  }

  const stateColor = {
    idle: "text-gray-400",
    loading: "text-blue-600",
    success: "text-green-600",
    error: "text-red-600",
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Walmart → SHV Logistics Load Builder</h1>
            <p className="text-sm text-gray-500 mt-1">
              Fetch open tenders from Walmart, sanitize load data, and push them into the SHV TMS.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Account email</label>
            <input
              type="email"
              readOnly
              value="samkakalpo@gmail.com"
              className="font-mono text-xs bg-gray-100 border border-gray-200 rounded px-3 py-1.5 text-gray-700 w-64 cursor-default select-all"
            />
          </div>
        </div>

        {/* Buttons + status */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={fetchLoads}
            disabled={fetchState === "loading"}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {fetchState === "loading" ? "Fetching..." : "Fetch Loads"}
          </button>

          <button
            onClick={sanitizeAndPush}
            disabled={loads.length === 0 || pushState === "loading"}
            className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pushState === "loading" ? "Pushing..." : "Sanitize & Push"}
          </button>

          <div className="text-sm space-y-0.5">
            {fetchMsg && <p className={stateColor[fetchState]}>Fetch: {fetchMsg}</p>}
            {pushMsg && <p className={stateColor[pushState]}>Push: {pushMsg}</p>}
          </div>
        </div>

        {/* Loads table */}
        {loads.length > 0 && (
          <div className="bg-white rounded-xl shadow overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Load No.</th>
                  <th className="px-4 py-3 text-left">BOL (Frt Ord)</th>
                  <th className="px-4 py-3 text-left">Shipper</th>
                  <th className="px-4 py-3 text-left">Origin</th>
                  <th className="px-4 py-3 text-left">Destination</th>
                  <th className="px-4 py-3 text-left">Ship Date</th>
                  <th className="px-4 py-3 text-left">Del. Date</th>
                  <th className="px-4 py-3 text-left">Weight</th>
                  <th className="px-4 py-3 text-left">Mode</th>
                  <th className="px-4 py-3 text-left">Equipment Type</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loads.map((load) => {
                  const eq = equipmentType(load.mode);
                  const result = pushResults.find((r) => r.load_number === load.load_no);
                  return (
                    <tr key={load.load_no} className={eq.needsReview ? "bg-yellow-50" : ""}>
                      <td className="px-4 py-3 font-mono text-gray-800 whitespace-nowrap">{load.load_no}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{load.frt_ord_no}</td>
                      <td className="px-4 py-3 text-gray-600">{load.shipper_nm}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{load.orig_city}, {load.orig_st}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{load.dest_city}, {load.dest_st}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{displayDate(load.shp_dt)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{displayDate(load.del_dt)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{displayWeight(load.wgt)}</td>
                      <td className="px-4 py-3 text-gray-600">{load.mode}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {eq.needsReview
                          ? <span className="text-yellow-700 font-medium">— Review needed</span>
                          : <span className="text-gray-800">{eq.type}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {result ? (
                          result.status === "accepted" ? (
                            <span className="text-green-600 font-medium">Pushed</span>
                          ) : result.status === "skipped" ? (
                            <span className="text-yellow-600">Skipped</span>
                          ) : (
                            <span className="text-red-600 font-medium" title={result.errors?.join("; ")}>
                              Rejected
                            </span>
                          )
                        ) : eq.needsReview ? (
                          <span className="text-yellow-600">{eq.reason}</span>
                        ) : (
                          <span className="text-gray-400">Ready</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rejection detail */}
        {pushResults.some((r) => r.status === "rejected") && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-semibold text-red-700">Rejection details</h2>
            {pushResults
              .filter((r) => r.status === "rejected")
              .map((r) => (
                <div key={r.load_number}>
                  <p className="text-sm font-mono text-red-800">{r.load_number}</p>
                  <ul className="list-disc list-inside text-xs text-red-700 mt-0.5 space-y-0.5">
                    {(r.errors ?? ["Unknown error"]).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              ))}
          </div>
        )}

        {/* Sanitized data sent to SHV */}
        {sanitizedLoads.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">Sanitized data sent to SHV</h2>
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-blue-50 text-blue-600 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Load No.</th>
                    <th className="px-4 py-3 text-left">BOL</th>
                    <th className="px-4 py-3 text-left">Shipper</th>
                    <th className="px-4 py-3 text-left">Origin</th>
                    <th className="px-4 py-3 text-left">Destination</th>
                    <th className="px-4 py-3 text-left">Ship Date</th>
                    <th className="px-4 py-3 text-left">Del. Date</th>
                    <th className="px-4 py-3 text-left">Weight (lbs)</th>
                    <th className="px-4 py-3 text-left">Equipment Type</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sanitizedLoads.map((load) => {
                    const result = pushResults.find((r) => r.load_number === load.load_number);
                    return (
                      <tr key={load.load_number}>
                        <td className="px-4 py-3 font-mono text-gray-800 whitespace-nowrap">{load.load_number}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{load.bol_number}</td>
                        <td className="px-4 py-3 text-gray-600">{load.shipper_name}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{load.origin_city}, {load.origin_state}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{load.destination_city}, {load.destination_state}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{load.ship_date.slice(0,2)}/{load.ship_date.slice(2,4)}/{load.ship_date.slice(4)}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{load.delivery_date.slice(0,2)}/{load.delivery_date.slice(2,4)}/{load.delivery_date.slice(4)}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{load.weight}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{load.equipment_type || "—"}</td>
                        <td className="px-4 py-3 text-xs">
                          {result?.status === "accepted" && <span className="text-green-600 font-medium">Pushed</span>}
                          {result?.status === "rejected" && <span className="text-red-600 font-medium">Rejected</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loads.length === 0 && fetchState === "success" && (
          <p className="text-gray-500 text-sm">No open tenders found for this account.</p>
        )}
      </div>
    </div>
  );
}

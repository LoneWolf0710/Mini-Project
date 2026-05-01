import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVehicles } from "@/hooks/useFleet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

export default function Reports() {
  const { vehicles } = useVehicles();
  const [busy, setBusy] = useState(false);

  const exportCsv = async (kind: "telemetry" | "alerts" | "maintenance") => {
    setBusy(true);
    try {
      const table = kind === "telemetry" ? "telemetry_readings" : kind === "alerts" ? "alerts" : "maintenance_records";
      const { data } = await supabase.from(table).select("*").limit(5000);
      const rows = data ?? [];
      if (rows.length === 0) { toast.info("Nothing to export."); return; }
      const headers = Object.keys(rows[0]);
      const csv = [headers.join(","), ...rows.map((r: any) =>
        headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${kind}-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  };

  const fleetPdf = async () => {
    setBusy(true);
    try {
      const [{ data: preds }, { data: alerts }] = await Promise.all([
        supabase.from("maintenance_predictions").select("*").order("predicted_at", { ascending: false }).limit(500),
        supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(500),
      ]);
      const vMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));
      const doc = new jsPDF();
      doc.setFontSize(20); doc.text("FleetIQ — Fleet Performance Report", 14, 20);
      doc.setFontSize(10); doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
      doc.text(`Vehicles: ${vehicles.length}  ·  Open alerts: ${(alerts ?? []).filter((a: any) => !a.is_resolved).length}`, 14, 34);

      autoTable(doc, {
        startY: 42, head: [["Vehicle", "Plate", "Status", "Odometer"]],
        body: vehicles.map((v) => [v.name, v.plate, v.status, Math.round(v.odometer).toLocaleString()]),
        theme: "grid", styles: { fontSize: 9 },
      });

      const latestPred: Record<string, any> = {};
      (preds ?? []).forEach((p: any) => { if (!latestPred[p.vehicle_id]) latestPred[p.vehicle_id] = p; });

      doc.addPage();
      doc.setFontSize(16); doc.setTextColor(0); doc.text("Latest AI Risk Assessments", 14, 20);
      autoTable(doc, {
        startY: 26, head: [["Vehicle", "Risk", "Confidence", "Action"]],
        body: vehicles.map((v) => {
          const p = latestPred[v.id];
          return [v.name, p?.risk ?? "—", p ? `${Math.round(p.confidence * 100)}%` : "—", p?.recommended_action ?? "—"];
        }),
        theme: "grid", styles: { fontSize: 9 },
      });

      doc.addPage();
      doc.setFontSize(16); doc.text("Recent Alerts", 14, 20);
      autoTable(doc, {
        startY: 26, head: [["When", "Vehicle", "Severity", "Message"]],
        body: (alerts ?? []).slice(0, 50).map((a: any) => [
          new Date(a.created_at).toLocaleString(),
          vMap[a.vehicle_id]?.name ?? "—",
          a.severity, a.message,
        ]),
        theme: "grid", styles: { fontSize: 8 },
      });

      doc.save(`fleetiq-report-${Date.now()}.pdf`);
    } finally { setBusy(false); }
  };

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Download fleet data and executive PDF reports.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <FileText className="h-6 w-6 text-primary" />
          <h3 className="mt-3 font-semibold">Fleet Performance Report (PDF)</h3>
          <p className="mt-1 text-sm text-muted-foreground">Vehicles inventory, latest AI risk per vehicle, recent alerts.</p>
          <Button className="mt-4" disabled={busy} onClick={fleetPdf}><Download className="mr-2 h-4 w-4" />Generate PDF</Button>
        </div>
        <div className="glass rounded-2xl p-6">
          <FileSpreadsheet className="h-6 w-6 text-accent" />
          <h3 className="mt-3 font-semibold">CSV exports</h3>
          <p className="mt-1 text-sm text-muted-foreground">Raw data for analysis in Excel or any tool.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => exportCsv("telemetry")}>Telemetry</Button>
            <Button variant="outline" disabled={busy} onClick={() => exportCsv("alerts")}>Alerts</Button>
            <Button variant="outline" disabled={busy} onClick={() => exportCsv("maintenance")}>Maintenance</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

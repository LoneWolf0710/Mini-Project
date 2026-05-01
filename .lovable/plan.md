# FleetIQ — 10 Feature Expansion

Shipping all 10 in 3 waves so we can verify each batch before moving on.

---

## Wave 1 — Intelligence & Visualization

**1. Fuel Anomaly Detection**
- Extend `predict-maintenance` edge function with rolling z-score on fuel deltas
- New `alert_type` = `fuel_anomaly`, severity scaled by drop magnitude
- Mini fuel chart on Vehicle Detail showing anomalies as red dots

**6. Trip Replay / Time-Travel Map**
- New page `/app/replay/:vehicleId`
- Day picker + timeline scrubber (shadcn Slider) over telemetry for chosen day
- Animated marker walks the polyline; live gauges show speed/RPM/temp/fuel at scrub position
- Play/pause + 1x/4x/16x speed controls

**3. Predictive ETA**
- Compute heading + speed from last 2 telemetry points
- For each vehicle, find nearest geofence on current heading vector
- Show ETA chip on map markers ("ETA Warehouse A: 12 min")

---

## Wave 2 — Operations

**4. Maintenance Scheduler (Calendar)**
- New page `/app/scheduler`, month/week/day toggle
- New table `maintenance_schedules` (vehicle_id, scheduled_for, type, status, notes)
- Auto-suggest entries from high-risk predictions (one-click "Schedule")
- Drag to reschedule, click to mark complete (writes to `maintenance_records`)

**5. Fuel Logs & Cost Tracking**
- New table `fuel_logs` (vehicle_id, liters, price_per_liter, odometer, logged_at, logged_by)
- Page `/app/fuel` with entry form, monthly spend chart, cost/km computed per vehicle
- Leaderboard widget: top 5 fuel burners by L/100km

**2. Route Optimization**
- New page `/app/routes`
- Add stops (lat/lng or address via Nominatim free geocode), call OSRM public API for optimal order
- Display optimized polyline on Leaflet map with numbered stop markers
- "Assign to vehicle" → saves to `planned_routes` table; map page shows planned vs actual trail

**9. Driver Mobile View**
- New route `/app/me` (default for `driver` role)
- Single-column layout: my vehicle card, today's trip stats, my driver score trend, my recent alerts with one-tap acknowledge

---

## Wave 3 — Platform & Polish

**7. PDF Vehicle Health Report**
- "Export PDF" button on Vehicle Detail
- jsPDF + html2canvas snapshot of charts; appends 30-day stats, predictions table, maintenance history
- Downloads as `vehicle-{plate}-{date}.pdf`

**8. Customizable Dashboard Widgets**
- Migrate Dashboard to react-grid-layout
- Widget registry: KPIs, map, alerts feed, top risks, fuel chart, driver leaderboard
- "Edit layout" mode with add/remove/resize; persist per user in new `user_dashboard_layouts` table

**10. Webhooks & Public API Management**
- New table `webhooks` (user_id, url, events[], secret, enabled)
- Admin page `/app/admin/webhooks` to register URLs + pick events
- New edge function `dispatch-webhook` called from `ingest-telemetry` and `predict-maintenance` on relevant events; HMAC-SHA256 signature header
- Extend existing `/iot/docs` page with "API Keys" tab to rotate ingest keys per vehicle

---

## Technical Notes

**New tables:** `maintenance_schedules`, `fuel_logs`, `planned_routes`, `user_dashboard_layouts`, `webhooks`, `webhook_deliveries` (audit log). All with staff-manage RLS + driver-self-read where applicable.

**New deps:** `react-grid-layout`, `jspdf`, `html2canvas`, `date-fns` (already in project most likely).

**External APIs (no key required):**
- OSRM (`router.project-osrm.org`) for route optimization
- Nominatim (`nominatim.openstreetmap.org`) for geocoding — with proper User-Agent

**No new secrets needed.** Webhooks use per-webhook generated secrets stored in our DB.

**Order rationale:** Wave 1 = visual wow for demos. Wave 2 = practical ops value. Wave 3 = platform/polish that benefits from the data the earlier waves produce.

---

Ready to execute all 3 waves back-to-back on approval.

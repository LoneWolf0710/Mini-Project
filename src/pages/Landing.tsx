import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Activity, Brain, Cpu, Gauge, MapPin, ShieldCheck, Truck, Zap } from "lucide-react";

const features = [
  { icon: Activity, title: "Real-time telemetry", desc: "Stream engine, fuel, vibration & GPS data from every vehicle, live." },
  { icon: Brain, title: "Predictive maintenance", desc: "Statistical anomaly engine flags failures before they ground a vehicle." },
  { icon: MapPin, title: "Live fleet map", desc: "Watch your fleet move in real-time, color-coded by health." },
  { icon: Gauge, title: "Operational analytics", desc: "Fuel efficiency, downtime, mileage and risk leaderboards." },
  { icon: Cpu, title: "IoT-ready ingest", desc: "Public API for Arduino, ESP32 or any HTTP-capable sensor." },
  { icon: ShieldCheck, title: "Role-based access", desc: "Admins, fleet managers and drivers each see exactly what they need." },
];

export default function Landing() {
  return (
    <div className="min-h-screen overflow-hidden">
      {/* NAV */}
      <header className="container flex items-center justify-between py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent glow-primary">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-mono text-lg font-semibold tracking-tight">FleetIQ</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</a>
          <a href="#how" className="text-sm text-muted-foreground hover:text-foreground">How it works</a>
          <a href="#stack" className="text-sm text-muted-foreground hover:text-foreground">Stack</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link to="/auth?mode=signup"><Button size="sm" className="bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90">Launch console</Button></Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="container relative grid gap-12 py-20 md:grid-cols-2 md:py-32">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-mono text-xs text-primary">
              <span className="pulse-dot bg-primary" />
              FleetIQ v1.0 — live telemetry online
            </div>
            <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
              Mobility <span className="gradient-text">intelligence</span> for every vehicle in your fleet.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Stream IoT sensor data, predict failures before they happen, and turn raw telemetry into
              operational decisions — all from one luminous, real-time console.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth?mode=signup">
                <Button size="lg" className="bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90">
                  <Zap className="mr-2 h-4 w-4" /> Start the demo fleet
                </Button>
              </Link>
              <a href="#features"><Button size="lg" variant="outline">Explore features</Button></a>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-border pt-6">
              <Stat label="Vehicles tracked" value="∞" />
              <Stat label="Sensor stream" value="10s" />
              <Stat label="Risk model" value="60s" />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }}>
            <HeroPreview />
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="container py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">A complete fleet OS.</h2>
          <p className="mt-4 text-muted-foreground">Everything from raw IoT ingest to executive PDF reports — built in.</p>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.05 }}
              className="glass rounded-2xl p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="container py-24">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-4xl font-bold tracking-tight">From sensor to decision in seconds.</h2>
            <p className="mt-4 text-muted-foreground">FleetIQ ingests sensor readings, normalizes them, runs a rolling statistical model, and surfaces alerts on a live console — no servers to babysit.</p>
          </div>
          <ol className="space-y-4">
            {[
              ["1", "Ingest", "Arduino/ESP32 (or our simulator) POSTs telemetry to a secure endpoint."],
              ["2", "Stream", "Realtime pipeline pushes new readings to every connected dashboard."],
              ["3", "Predict", "Rolling z-score + trend rules score each vehicle every minute."],
              ["4", "Act", "High-risk vehicles trigger alerts and recommended actions."],
            ].map(([n, t, d]) => (
              <li key={n} className="glass flex gap-4 rounded-xl p-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 font-mono text-primary">{n}</div>
                <div>
                  <div className="font-semibold">{t}</div>
                  <div className="text-sm text-muted-foreground">{d}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-24">
        <div className="glass relative overflow-hidden rounded-3xl p-12 text-center">
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div className="relative">
            <h3 className="text-3xl font-bold md:text-4xl">Ready to see your fleet think?</h3>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Spin up a demo fleet in 30 seconds. No credit card. No hardware required.</p>
            <Link to="/auth?mode=signup">
              <Button size="lg" className="mt-6 bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90">
                <Zap className="mr-2 h-4 w-4" /> Launch console
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="container border-t border-border py-8 text-center font-mono text-xs text-muted-foreground">
        FleetIQ © {new Date().getFullYear()} — Intelligent Mobility Platform
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-2xl font-semibold gradient-text">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="glass relative aspect-square w-full max-w-xl rounded-3xl p-6">
      <div className="absolute inset-0 grid-bg rounded-3xl opacity-50" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div className="font-mono text-xs text-muted-foreground">FLEET.LIVE</div>
          <div className="flex items-center gap-2 font-mono text-xs text-primary">
            <span className="pulse-dot bg-primary" /> STREAMING
          </div>
        </div>
        <div className="mt-6 grid flex-1 grid-cols-2 gap-3">
          {[
            { name: "TRK-01", risk: "low", temp: 87, color: "primary" },
            { name: "TRK-02", risk: "med", temp: 102, color: "warning" },
            { name: "TRK-03", risk: "low", temp: 79, color: "primary" },
            { name: "TRK-04", risk: "high", temp: 118, color: "destructive" },
          ].map((v) => (
            <div key={v.name} className="rounded-xl border border-border bg-secondary/40 p-4 animate-float" style={{ animationDelay: `${Math.random()}s` }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">{v.name}</span>
                <span className={`pulse-dot bg-${v.color}`} />
              </div>
              <div className="mt-3 font-mono text-2xl font-semibold">{v.temp}°</div>
              <div className="mt-1 text-xs text-muted-foreground">engine temp</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4 font-mono text-xs">
          <span className="text-muted-foreground">PREDICTION</span>
          <span className="text-warning">TRK-04 — bearing wear, 92% conf.</span>
        </div>
      </div>
    </div>
  );
}

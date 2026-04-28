# FleetAI — Django + Python Edition

A full conversion of the React/TypeScript FleetAI fleet management system
into a pure Django + Python stack, with identical UI/UX.

---

## Project Structure

```
fleet_django/
├── manage.py
├── requirements.txt
├── fleet_project/
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
└── fleet_app/
    ├── fleet_data.py          # Python equivalent of fleetData.ts (data generation + ML logic)
    ├── views.py               # All view logic
    ├── urls.py                # URL routing
    ├── templatetags/
    │   └── fleet_filters.py   # Custom Django template filters
    └── templates/fleet/
        ├── base.html          # Sidebar + layout (Orbitron font, dark cyberpunk theme)
        ├── dashboard.html     # Command Center with Chart.js area + pie charts
        ├── vehicles.html      # Vehicle grid with search & status filters
        ├── vehicle_card.html  # Reusable vehicle card partial
        ├── predictions.html   # AI predictions + manual prediction engine
        ├── alerts.html        # Alert center with AJAX resolve
        ├── analytics.html     # 4 Chart.js analytics charts
        ├── iot.html           # IoT Device Hub with Arduino guide
        └── settings.html      # Security & IoT config settings
```

---

## Setup & Run

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Apply migrations (needed for sessions)

```bash
python manage.py migrate
```

### 3. Run the development server

```bash
python manage.py runserver
```

### 4. Open in browser

```
http://127.0.0.1:8000/
```

---

## Pages / Routes

| URL                    | View              | Description                        |
|------------------------|-------------------|------------------------------------|
| `/`                    | index             | Redirects to dashboard             |
| `/dashboard/`          | dashboard         | Command Center — stats & charts    |
| `/vehicles/`           | vehicles_view     | All vehicles, search & filter      |
| `/predictions/`        | predictions_view  | AI maintenance predictions + form  |
| `/alerts/`             | alerts_view       | Live alerts, AJAX resolve          |
| `/analytics/`          | analytics_view    | 4 analytics charts                 |
| `/iot/`                | iot_view          | IoT device hub                     |
| `/settings/`           | settings_view     | Security & system config           |

---

## Key Design Decisions

### Data Layer (`fleet_data.py`)
- Direct Python translation of `fleetData.ts`
- Same `predict_maintenance()` scoring algorithm
- `random.Random(seed=42)` for reproducible vehicle generation
- Seeded at module import — stable across page refreshes

### Alert State
- Resolved alerts stored in Django sessions (`request.session`)
- Resolve action uses AJAX POST (no page reload) — same as original

### Charts
- Chart.js (CDN) replaces Recharts
- All chart colors match the original HSL values exactly
- Area gradients, tooltips, grid styles all replicated

### UI/UX Fidelity
- Orbitron + Inter + JetBrains Mono fonts (Google Fonts CDN)
- Same dark theme CSS variables (--primary, --warning, --destructive, etc.)
- Glow effects (`box-shadow`, `text-shadow`) replicated in pure CSS
- Scanline overlay effect preserved
- Pulse animations on status dots and IoT indicators
- Vehicle card hover lift effect
- Alert slide-out animation on resolve

### Template Filters (`fleet_filters.py`)
- `replace` — replaces characters in strings
- `multiply_by` — for animation delay calculations
- `get_item` — dict lookup in templates
- `split` — string splitting for filter tab lists

---

## Production Notes

- Change `SECRET_KEY` in `settings.py`
- Set `DEBUG = False`
- Configure `ALLOWED_HOSTS`
- Switch `DATABASES` to PostgreSQL
- Use `gunicorn` or `uvicorn` as WSGI server
- Serve static files with WhiteNoise or nginx

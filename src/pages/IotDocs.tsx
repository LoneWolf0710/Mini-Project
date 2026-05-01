export default function IotDocs() {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-telemetry`;
  const sketch = `// FleetIQ — ESP32 / Arduino UNO R4 WiFi telemetry sketch
#include <WiFi.h>
#include <HTTPClient.h>
const char* SSID = "your-wifi";
const char* PASS = "your-password";
const char* URL  = "${url}";
const char* PLATE = "TRK-01";

void setup() {
  Serial.begin(115200);
  WiFi.begin(SSID, PASS);
  while (WiFi.status() != WL_CONNECTED) delay(500);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http; http.begin(URL);
    http.addHeader("Content-Type", "application/json");
    String body = String("{\\"vehicle_plate\\":\\"") + PLATE +
      "\\",\\"engine_temp\\":" + String(random(70, 110)) +
      ",\\"rpm\\":" + String(random(1500, 3000)) +
      ",\\"fuel_level\\":" + String(random(20, 100)) +
      ",\\"vibration\\":" + String(random(10, 80) / 100.0, 2) +
      ",\\"battery_voltage\\":" + String(11 + random(0, 20) / 10.0, 1) +
      ",\\"speed\\":" + String(random(0, 110)) + "}";
    int code = http.POST(body);
    Serial.println(code);
    http.end();
  }
  delay(10000);
}`;

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">IoT integration</h1>
        <p className="text-muted-foreground">Connect Arduino UNO R4 WiFi or ESP32 directly to FleetIQ.</p>
      </header>
      <div className="glass rounded-2xl p-6">
        <h3 className="font-semibold">Endpoint</h3>
        <pre className="mt-2 rounded-lg bg-secondary/40 p-3 font-mono text-xs break-all">{url}</pre>
        <h3 className="mt-6 font-semibold">Reference Arduino sketch</h3>
        <pre className="mt-2 max-h-[480px] overflow-auto rounded-lg bg-secondary/40 p-3 font-mono text-xs">{sketch}</pre>
      </div>
    </div>
  );
}

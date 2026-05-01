// fleet-agent/dashboard/static/map.js

let map, drawingManager, geofencePolygon, vehicleMarker;
let currentCoords = [];
let socket;

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 28.6139, lng: 77.2090 },
        zoom: 15,
        mapTypeId: "roadmap",
    });

    drawingManager = new google.maps.drawing.DrawingManager({
        drawingControl: false,
        polygonOptions: {
            fillColor: "#1a73e8",
            fillOpacity: 0.2,
            strokeColor: "#1a73e8",
            strokeWeight: 2,
            editable: true,
            draggable: false,
        },
    });
    drawingManager.setMap(map);

    google.maps.event.addListener(drawingManager, "overlaycomplete", (event) => {
        if (event.type === google.maps.drawing.OverlayType.POLYGON) {
            geofencePolygon = event.overlay;
            drawingManager.setDrawingMode(null);
            updateCoordsFromPolygon();
            
            google.maps.event.addListener(geofencePolygon.getPath(), 'set_at', updateCoordsFromPolygon);
            google.maps.event.addListener(geofencePolygon.getPath(), 'insert_at', updateCoordsFromPolygon);
            google.maps.event.addListener(geofencePolygon.getPath(), 'remove_at', updateCoordsFromPolygon);
        }
    });

    vehicleMarker = new google.maps.Marker({
        position: { lat: 28.6139, lng: 77.2090 },
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#1a73e8",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
        },
        title: "Vehicle",
        map: map,
    });

    connectSocket();
    loadCurrentGeofence();
}

function updateCoordsFromPolygon() {
    if (!geofencePolygon) return;
    const path = geofencePolygon.getPath();
    currentCoords = [];
    for (let i = 0; i < path.getLength(); i++) {
        const pt = path.getAt(i);
        currentCoords.push({ lat: pt.lat(), lng: pt.lng() });
    }
    document.getElementById("geofence-status-line").innerText = `Vertex count: ${currentCoords.length} (Unsaved)`;
}

function loadCurrentGeofence() {
    fetch("/config")
        .then((res) => res.json())
        .then((data) => {
            if (data.geofence_coords && data.geofence_coords.length >= 3) {
                const path = data.geofence_coords.map(c => ({lat: c[0], lng: c[1]}));
                geofencePolygon = new google.maps.Polygon({
                    paths: path,
                    fillColor: "#1a73e8",
                    fillOpacity: 0.2,
                    strokeColor: "#1a73e8",
                    strokeWeight: 2,
                    editable: false,
                    draggable: false,
                });
                geofencePolygon.setMap(map);
                currentCoords = path;
                document.getElementById("geofence-status-line").innerText = `Vertex count: ${currentCoords.length}`;
                
                const bounds = new google.maps.LatLngBounds();
                path.forEach(pt => bounds.extend(pt));
                map.fitBounds(bounds);
                
                google.maps.event.addListener(geofencePolygon.getPath(), 'set_at', updateCoordsFromPolygon);
                google.maps.event.addListener(geofencePolygon.getPath(), 'insert_at', updateCoordsFromPolygon);
                google.maps.event.addListener(geofencePolygon.getPath(), 'remove_at', updateCoordsFromPolygon);
            }
        })
        .catch(console.error);
}

function connectSocket() {
    socket = io();

    socket.on("telemetry", (data) => {
        if (data.gps && data.gps.lat !== null && data.gps.lon !== null) {
            const newPos = { lat: data.gps.lat, lng: data.gps.lon };
            vehicleMarker.setPosition(newPos);
            
            if (!map.getBounds().contains(newPos)) {
                map.panTo(newPos);
            }
        }

        const gpsBadge = document.getElementById("gps-status");
        if (data.gps && data.gps.fix) {
            gpsBadge.className = "badge badge-green";
            gpsBadge.innerText = "ACTIVE";
        } else {
            gpsBadge.className = "badge badge-red";
            gpsBadge.innerText = "NO FIX";
        }

        const geoBadge = document.getElementById("geofence-status");
        if (data.geofence && data.geofence.inside) {
            geoBadge.className = "badge badge-green";
            geoBadge.innerText = "INSIDE";
        } else {
            geoBadge.className = "badge badge-red";
            geoBadge.innerText = "BREACH";
        }

        const killBadge = document.getElementById("kill-status");
        const killLine = document.getElementById("kill-status-line");
        if (data.kill_status === "ACTIVE") {
            killBadge.className = "badge badge-red";
            killBadge.innerText = "ACTIVE";
            killLine.innerText = "Status: ACTIVE";
        } else {
            killBadge.className = "badge badge-green";
            killBadge.innerText = "NORMAL";
            killLine.innerText = "Status: NORMAL";
        }

        if (data.gps) {
            let speedKmh = 0;
            if (data.gps.speed_ms !== null) {
                speedKmh = (data.gps.speed_ms * 3.6).toFixed(1);
            }
            document.getElementById("data-speed").innerText = `${speedKmh} km/h`;
            document.getElementById("data-satellites").innerText = data.gps.satellites || 0;
        }
        
        document.getElementById("data-timestamp").innerText = formatTime(data.timestamp);

        if (data.alert === "GEOFENCE_BREACH") {
            appendBreachLog(data.gps.lat, data.gps.lon, data.timestamp);
            flashPolygon("#e53935", 3000);
        }
    });

    socket.on("geofence_ack", (data) => {
        document.getElementById("geofence-status-line").innerText = `Saved — ${data.vertex_count} vertices confirmed by vehicle`;
    });

    socket.on("kill_status", (data) => {
        const killLine = document.getElementById("kill-status-line");
        const killBadge = document.getElementById("kill-status");
        if (data.action === "KILL") {
            killBadge.className = "badge badge-red";
            killBadge.innerText = "ACTIVE";
            killLine.innerText = "Status: ACTIVE";
        } else if (data.action === "RESTORE") {
            killBadge.className = "badge badge-green";
            killBadge.innerText = "NORMAL";
            killLine.innerText = "Status: NORMAL";
        }
    });

    socket.on("connect", () => {
        socket.emit("request_status");
    });
}

function flashPolygon(color, durationMs) {
    if (geofencePolygon) {
        geofencePolygon.setOptions({ fillColor: color, strokeColor: color });
        setTimeout(() => {
            if (geofencePolygon) {
                geofencePolygon.setOptions({ fillColor: "#1a73e8", strokeColor: "#1a73e8" });
            }
        }, durationMs);
    }
}

function formatTime(unixTimestamp) {
    const d = new Date(unixTimestamp * 1000);
    return d.toTimeString().split(' ')[0];
}

function appendBreachLog(lat, lon, timestamp) {
    const logContainer = document.getElementById("breach-log");
    const entry = document.createElement("div");
    entry.className = "breach-entry";
    entry.innerText = `${formatTime(timestamp)} — Breach at ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    
    logContainer.prepend(entry);
    
    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    fetch("/config")
        .then(res => res.json())
        .then(data => {
            document.getElementById("vehicle-id-subtitle").innerText = data.vehicle_id;
            
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${data.api_key}&libraries=drawing,geometry&callback=initMap`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        })
        .catch(console.error);

    document.getElementById("btn-draw").addEventListener("click", () => {
        if (geofencePolygon) {
            geofencePolygon.setMap(null);
            geofencePolygon = null;
        }
        currentCoords = [];
        drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
        document.getElementById("geofence-status-line").innerText = "Vertex count: 0 (Drawing...)";
    });

    document.getElementById("btn-edit").addEventListener("click", () => {
        if (geofencePolygon) {
            geofencePolygon.setEditable(true);
        }
    });

    document.getElementById("btn-save").addEventListener("click", () => {
        if (currentCoords.length < 3) {
            alert("Draw at least 3 points to define a boundary.");
            return;
        }
        const coordsArray = currentCoords.map(c => [c.lat, c.lng]);
        socket.emit("update_geofence", { coords: coordsArray });
        
        if (geofencePolygon) {
            geofencePolygon.setEditable(false);
        }
        drawingManager.setDrawingMode(null);
        document.getElementById("geofence-status-line").innerText = "Saving...";
    });

    document.getElementById("btn-clear").addEventListener("click", () => {
        if (geofencePolygon) {
            geofencePolygon.setMap(null);
            geofencePolygon = null;
        }
        currentCoords = [];
        document.getElementById("geofence-status-line").innerText = "No boundary set";
    });

    document.getElementById("btn-kill").addEventListener("click", () => {
        if (window.confirm("Are you sure you want to kill the vehicle ignition? This action is immediate and potentially dangerous.")) {
            socket.emit("send_kill", { action: "KILL" });
        }
    });

    document.getElementById("btn-restore").addEventListener("click", () => {
        socket.emit("send_kill", { action: "RESTORE" });
    });
});

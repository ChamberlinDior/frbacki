import type { TerminalSummary } from './types';
import { formatFreshness, getConnectivityStatus } from './terminalPresentation';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildLeafletHtml(terminals: TerminalSummary[]): string {
  const data = JSON.stringify(
    terminals.map((terminal) => ({
      ...terminal,
      displayName:
        terminal.displayName ?? terminal.serialNumber ?? `TPE #${terminal.id}`,
      statusLabel:
        getConnectivityStatus(terminal) === 'ONLINE' ? 'En ligne' : 'Offline',
      freshness: formatFreshness(terminal),
      battery: terminal.lastBatteryPercent,
      network: terminal.lastNetworkType,
    })),
  );

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{height:100%;background:#f6faff}
.leaflet-popup-content-wrapper{border-radius:14px;border:1px solid #d7e3f2;box-shadow:0 10px 30px rgba(18,50,74,.12)}
.leaflet-popup-content{margin:12px 14px;font-family:Arial,sans-serif;color:#12324A}
.title{font-size:14px;font-weight:700;margin-bottom:6px}
.meta{font-size:12px;color:#58748D;line-height:1.6}
</style>
</head>
<body>
<div id="map"></div>
<script>
(function(){
  const T=${data};
  const map=L.map('map',{zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  const points=[];
  T.forEach(function(t){
    if(t.lastGpsLat==null||t.lastGpsLng==null)return;
    points.push([t.lastGpsLat,t.lastGpsLng]);
    const color=t.outsideAuthorizedZone?'#D64545':(t.connectivityStatus==='ONLINE'?'#1F6FE5':'#D64545');
    const marker=L.circleMarker([t.lastGpsLat,t.lastGpsLng],{radius:8,color:'#fff',weight:2,fillColor:color,fillOpacity:1}).addTo(map);
    marker.bindPopup(
      '<div class="title">'+t.displayName+'</div>'+
      '<div class="meta">Zone: '+(t.authorizedZoneName||'Zone personnalisee')+'<br/>Statut: '+t.statusLabel+'<br/>Fraicheur: '+t.freshness+'<br/>Batterie: '+(t.battery==null?'—':t.battery+'%')+'<br/>Reseau: '+(t.network||'—')+'</div>'
    );
    if(t.baseLatitude!=null&&t.baseLongitude!=null&&t.alertRadiusMeters!=null){
      L.circle([t.baseLatitude,t.baseLongitude],{
        radius:t.alertRadiusMeters,
        color:color,
        weight:2,
        fillColor:color,
        fillOpacity:t.outsideAuthorizedZone?0.16:0.10
      }).addTo(map);
    }
  });
  if(points.length){ map.fitBounds(points,{padding:[40,40],maxZoom:16}); }
  else { map.setView([0.3901,9.4544],11); }
})();
</script>
</body>
</html>`;
}

export function buildLeafletRouteHtml(params: {
  adminLocation: { latitude: number; longitude: number };
  targetLocation: { latitude: number; longitude: number };
  targetLabel: string;
}): string {
  const admin = JSON.stringify(params.adminLocation);
  const target = JSON.stringify(params.targetLocation);
  const label = escapeHtml(params.targetLabel);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{height:100%;background:#f6faff}
.leaflet-popup-content-wrapper{border-radius:14px;border:1px solid #d7e3f2;box-shadow:0 10px 30px rgba(18,50,74,.12)}
.leaflet-popup-content{margin:12px 14px;font-family:Arial,sans-serif;color:#12324A}
</style>
</head>
<body>
<div id="map"></div>
<script>
(function(){
  const admin=${admin};
  const target=${target};
  const map=L.map('map',{zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

  const adminMarker=L.circleMarker([admin.latitude,admin.longitude],{
    radius:8,color:'#fff',weight:2,fillColor:'#1F6FE5',fillOpacity:1
  }).addTo(map).bindPopup('<strong>Admin</strong>');

  const targetMarker=L.circleMarker([target.latitude,target.longitude],{
    radius:8,color:'#fff',weight:2,fillColor:'#D64545',fillOpacity:1
  }).addTo(map).bindPopup('<strong>${label}</strong>');

  L.polyline([
    [admin.latitude,admin.longitude],
    [target.latitude,target.longitude]
  ],{
    color:'#1F6FE5',
    weight:4,
    opacity:0.9,
    dashArray:'10,8'
  }).addTo(map);

  map.fitBounds([
    [admin.latitude,admin.longitude],
    [target.latitude,target.longitude]
  ],{padding:[40,40],maxZoom:16});
})();
</script>
</body>
</html>`;
}

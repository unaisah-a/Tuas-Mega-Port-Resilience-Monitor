"""
Generate Folium interactive vessel route map for Tuas Mega Port Resilience Monitor.
Run: python3 generate_map.py
Output: public/folium_map.html
Simulated data only — not for operational navigation.
"""
import folium
from folium.plugins import PolyLineTextPath
import os, sys

# ── Simulated coordinates ──────────────────────────────────────────────────────
TUAS          = [1.30, 103.65]
ORIGIN        = [9.0, 95.5]    # Andaman Sea — route divergence point

MALACCA_ROUTE = [
    ORIGIN,
    [7.2, 97.8],
    [5.0, 100.2],
    [3.5, 101.5],   # SL TRADER position (38 nm from anchorage)
    [2.5, 102.5],
    [1.70, 103.30],
    TUAS
]

SUNDA_ROUTE = [
    ORIGIN,
    [6.0, 97.0],
    [2.0, 100.5],
    [-3.0, 103.5],
    [-6.0, 105.8],   # Sunda Strait
    [-4.5, 107.5],
    [-1.0, 107.0],
    [1.30, 104.50],
    TUAS
]

LOMBOK_ROUTE = [
    ORIGIN,
    [4.0, 96.0],
    [-2.0, 100.0],
    [-7.0, 107.0],
    [-8.5, 115.5],   # Lombok Strait
    [-7.0, 114.0],
    [-3.0, 110.0],
    [1.30, 104.50],
    TUAS
]

SL_TRADER_POS      = [3.5, 101.5]
AURORA_PIONEER_POS = [2.8, 100.8]
GOLDEN_STAR_POS    = [1.05, 104.05]   # Near Batam Island

# ── Colours ────────────────────────────────────────────────────────────────────
C_MALACCA = '#ef4444'
C_SUNDA   = '#f59e0b'
C_LOMBOK  = '#5fb0d8'
C_ARROW   = dict(fill='#ffffff', opacity='0.7', font_size='14')


def add_route(m, coords, color, weight, dash, tooltip_html, label):
    line = folium.PolyLine(
        coords,
        color=color,
        weight=weight,
        opacity=0.85,
        tooltip=folium.Tooltip(tooltip_html, sticky=True),
        dash_array=dash
    )
    line.add_to(m)
    try:
        PolyLineTextPath(
            line, '  ›  ',
            repeat=True,
            offset=14,
            attributes={'fill': color, 'font-size': '16', 'opacity': '0.8'}
        ).add_to(m)
    except Exception:
        pass   # graceful skip if plugin unavailable


def generate_map(storm_active=False, congestion_active=False, out_path='public/folium_map.html'):
    m = folium.Map(
        location=[2.0, 103.5],
        zoom_start=5,
        tiles='CartoDB dark_matter',
        prefer_canvas=True
    )

    # ── Malacca route ──────────────────────────────────────────────────────────
    malacca_risk  = 'Severe — Gale warning active' if storm_active else 'High — Gale warning active'
    malacca_cc    = 'NOT recommended during storm — reefer integrity risk' if storm_active else 'Use with caution — monitor reefer systems continuously'
    malacca_conf  = 'Low' if storm_active else 'Medium'
    malacca_note  = ('AVOID — Active storm. Divert cold-chain pharma to Sunda.' if storm_active
                     else 'Primary route. Gale warning active. Cold-chain monitoring required.')

    malacca_tip = (
        '<div style="font-family:monospace;font-size:12px;line-height:1.6">'
        '<b style="color:#ef4444">Malacca Strait Baseline</b><br>'
        f'Delta transit: 0 days | Cost index: 100 | CO2 index: 100<br>'
        f'Risk: {malacca_risk}<br>'
        f'Cold-chain: {malacca_cc}<br>'
        f'Confidence: {malacca_conf}<br>'
        f'<i>{malacca_note}</i>'
        '</div>'
    )
    add_route(m, MALACCA_ROUTE, C_MALACCA, 4,
              '8 4' if storm_active else None,
              malacca_tip, 'Malacca Baseline')

    # GPS points along Malacca
    for i, pt in enumerate([MALACCA_ROUTE[1], MALACCA_ROUTE[2], MALACCA_ROUTE[4]]):
        folium.CircleMarker(
            pt, radius=4, color=C_MALACCA, fill=True,
            fill_color=C_MALACCA, fill_opacity=0.7,
            tooltip=f'Malacca WP{i+1} | {pt[0]:.2f}°N {pt[1]:.2f}°E | Route active'
        ).add_to(m)

    # ── Sunda route ────────────────────────────────────────────────────────────
    sunda_tip = (
        '<div style="font-family:monospace;font-size:12px;line-height:1.6">'
        '<b style="color:#f59e0b">Sunda Strait Reroute — Contingency</b><br>'
        'Delta transit: +2 days | Cost index: 118 (×1.18) | CO2 index: 115 (×1.15)<br>'
        'Risk: Medium — calm seas<br>'
        'Cold-chain: YES — reefer monitoring intact, suitable for 2-8°C pharma<br>'
        'Confidence: High<br>'
        '<i>Recommended contingency when Malacca is disrupted. Calmer seas.</i>'
        '</div>'
    )
    add_route(m, SUNDA_ROUTE, C_SUNDA, 3, '6 3', sunda_tip, 'Sunda Contingency')

    for i, pt in enumerate([SUNDA_ROUTE[2], SUNDA_ROUTE[4], SUNDA_ROUTE[6]]):
        folium.CircleMarker(
            pt, radius=3, color=C_SUNDA, fill=True,
            fill_color=C_SUNDA, fill_opacity=0.6,
            tooltip=f'Sunda WP{i+1} | {pt[0]:.2f}°N {pt[1]:.2f}°E | Contingency route'
        ).add_to(m)

    # ── Lombok route ───────────────────────────────────────────────────────────
    lombok_tip = (
        '<div style="font-family:monospace;font-size:12px;line-height:1.6">'
        '<b style="color:#5fb0d8">Lombok Strait Deep Alternate</b><br>'
        'Delta transit: +3.5 days | Cost index: 126 (×1.26) | CO2 index: 124 (×1.24)<br>'
        'Risk: Low — clear seas<br>'
        'Cold-chain: CONDITIONAL — +3.5 day extension may breach 2-8°C service window. Human validation required.<br>'
        'Confidence: Medium (human validation required for cold-chain pharma)<br>'
        '<i>Longest alternate. Use only if both Malacca and Sunda are unavailable. Highest CO2.</i>'
        '</div>'
    )
    add_route(m, LOMBOK_ROUTE, C_LOMBOK, 3, '4 4', lombok_tip, 'Lombok Deep Alternate')

    for i, pt in enumerate([LOMBOK_ROUTE[2], LOMBOK_ROUTE[4], LOMBOK_ROUTE[6]]):
        folium.CircleMarker(
            pt, radius=3, color=C_LOMBOK, fill=True,
            fill_color=C_LOMBOK, fill_opacity=0.5,
            tooltip=f'Lombok WP{i+1} | {pt[0]:.2f}°N {pt[1]:.2f}°E | Deep alternate route'
        ).add_to(m)

    # ── Tuas Mega Port destination ─────────────────────────────────────────────
    berth_str = 'HIGH CONGESTION ~92%' if congestion_active else 'Normal — 70-80%'
    folium.Marker(
        TUAS,
        tooltip=folium.Tooltip(
            '<div style="font-family:monospace;font-size:12px;line-height:1.6">'
            '<b style="color:#f58220">Tuas Mega Port — Destination</b><br>'
            f'1.30°N, 103.65°E | Singapore<br>'
            f'Berth occupancy: {berth_str}<br>'
            'Status: Active port operations<br>'
            '<i>Priority berthing for cold-chain pharma cargo (SHP-2041, SHP-2042)</i>'
            '</div>',
            sticky=True
        ),
        icon=folium.Icon(color='orange', icon='anchor', prefix='fa')
    ).add_to(m)

    # ── SL TRADER ──────────────────────────────────────────────────────────────
    folium.Marker(
        SL_TRADER_POS,
        tooltip=folium.Tooltip(
            '<div style="font-family:monospace;font-size:12px;line-height:1.6">'
            '<b style="color:#ef4444">SL TRADER (SHP-2041)</b><br>'
            'IMO: IMO9874321<br>'
            'Cargo: Pharmaceuticals — Insulin &amp; Vaccines<br>'
            'Temperature: 2-8°C (CRITICAL cold-chain)<br>'
            'Origin: Rotterdam, Netherlands<br>'
            'Current: Malacca Strait — 38 nm from Tuas anchorage<br>'
            'ETA: 6h | Status: Critical<br>'
            '<b style="color:#ef4444">Inventory risk: Stockout in 18h — priority berthing required</b>'
            '</div>',
            sticky=True
        ),
        icon=folium.Icon(color='red', icon='ship', prefix='fa')
    ).add_to(m)

    # ── AURORA PIONEER ─────────────────────────────────────────────────────────
    folium.CircleMarker(
        AURORA_PIONEER_POS,
        radius=7, color=C_SUNDA, fill=True,
        fill_color=C_SUNDA, fill_opacity=0.85,
        tooltip=folium.Tooltip(
            '<div style="font-family:monospace;font-size:12px;line-height:1.6">'
            '<b style="color:#f59e0b">AURORA PIONEER (SHP-2042)</b><br>'
            'Cargo: Biologics — COVID-19 Antivirals &amp; Blood Products<br>'
            'Temperature: 2-8°C (Critical cold-chain)<br>'
            'Origin: Hamburg, Germany<br>'
            'Current: Malacca Strait — 190 nm west of Singapore<br>'
            'ETA: 18h | Status: Watch'
            '</div>',
            sticky=True
        )
    ).add_to(m)

    # ── GOLDEN STAR 1 incident marker ──────────────────────────────────────────
    folium.Marker(
        GOLDEN_STAR_POS,
        tooltip=folium.Tooltip(
            '<div style="font-family:monospace;font-size:12px;line-height:1.6">'
            '<b style="color:#a8bbd3">GOLDEN STAR 1 — Simulated Incident</b><br>'
            'Location: Near Batam Island (1.05°N, 104.05°E)<br>'
            'Event: Simulated vessel incident — 5 Jun 2026<br>'
            'Status: All 9 crew rescued. Simulated incident reference only.<br>'
            '<span style="color:#f59e0b">⚠ Operational note:</span> Monitor for regional disruption.<br>'
            'Do not overreact — no confirmed impact on Tuas port operations.'
            '</div>',
            sticky=True
        ),
        icon=folium.Icon(color='gray', icon='exclamation-triangle', prefix='fa')
    ).add_to(m)

    # ── Route origin / divergence point ────────────────────────────────────────
    folium.Marker(
        ORIGIN,
        tooltip=folium.Tooltip(
            '<div style="font-family:monospace;font-size:12px;line-height:1.6">'
            '<b>Route Divergence Point — Andaman Sea</b><br>'
            f'9.0°N, 95.5°E<br>'
            '→ <span style="color:#ef4444">Malacca (red)</span> — Primary, 0 days delta<br>'
            '→ <span style="color:#f59e0b">Sunda (amber)</span> — Contingency, +2 days<br>'
            '→ <span style="color:#5fb0d8">Lombok (blue)</span> — Deep alternate, +3.5 days'
            '</div>',
            sticky=True
        ),
        icon=folium.Icon(color='blue', icon='play', prefix='fa')
    ).add_to(m)

    # ── Legend & disclaimer overlay ────────────────────────────────────────────
    legend_html = '''
    <div style="
        position:fixed;bottom:30px;left:10px;
        background:rgba(8,16,32,0.88);
        color:#a8bbd3;
        padding:8px 12px;border-radius:8px;
        font-size:11px;font-family:monospace;
        z-index:9999;border:1px solid #27426b;
        line-height:1.8;pointer-events:none">
      <div style="font-weight:bold;color:#eef2f8;margin-bottom:4px">ROUTE LEGEND</div>
      <div><span style="color:#ef4444">━━</span> Malacca Baseline (primary)</div>
      <div><span style="color:#f59e0b">╌╌</span> Sunda Reroute (contingency +2d)</div>
      <div><span style="color:#5fb0d8">┄┄</span> Lombok Alternate (deep +3.5d)</div>
      <div style="margin-top:6px;color:#f58220">⚓ = Tuas Mega Port</div>
      <div style="color:#ef4444">🚢 = SL TRADER (Critical)</div>
      <div style="color:#666;margin-top:6px;font-size:10px">Hover routes/markers for trade-off data</div>
    </div>
    <div style="
        position:fixed;bottom:10px;left:50%;transform:translateX(-50%);
        background:rgba(8,16,32,0.82);color:#a8bbd3;
        padding:3px 14px;border-radius:6px;
        font-size:10px;font-family:monospace;
        z-index:9999;border:1px solid #27426b;pointer-events:none">
      Interactive simulated vessel route map — not for operational navigation
    </div>
    '''
    m.get_root().html.add_child(folium.Element(legend_html))

    os.makedirs(os.path.dirname(out_path) if os.path.dirname(out_path) else '.', exist_ok=True)
    m.save(out_path)
    return out_path


if __name__ == '__main__':
    path = generate_map()
    print(f'Folium map saved → {path}')

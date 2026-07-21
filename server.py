"""
Lightweight Flask server for Folium map serving.
Optional enhancement — the app works with the static public/folium_map.html without this.
Run: python3 server.py
Serves on http://localhost:5001
"""
from flask import Flask, Response, request
from flask.helpers import send_from_directory
import sys, os

sys.path.insert(0, os.path.dirname(__file__))

app = Flask(__name__)

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


@app.route('/map')
def serve_map():
    try:
        from generate_map import generate_map
        storm   = request.args.get('storm', 'false').lower() == 'true'
        congest = request.args.get('congestion', 'false').lower() == 'true'
        html = generate_map(storm_active=storm, congestion_active=congest,
                            out_path='/tmp/tmprm_folium.html')
        with open('/tmp/tmprm_folium.html', 'r', encoding='utf-8') as f:
            content = f.read()
        resp = Response(content, mimetype='text/html', headers=CORS_HEADERS)
        return resp
    except Exception as e:
        return Response(f'<p style="color:red">Map generation error: {e}</p>',
                        mimetype='text/html', headers=CORS_HEADERS)


@app.route('/health')
def health():
    return Response('ok', mimetype='text/plain', headers=CORS_HEADERS)


if __name__ == '__main__':
    print('Flask Folium server running on http://localhost:5001')
    app.run(port=5001, debug=False)

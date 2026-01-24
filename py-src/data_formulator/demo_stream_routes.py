# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

"""
Demo data REST APIs for streaming/refresh demos.

Design Philosophy:
- Each endpoint returns a COMPLETE dataset (not just a single row)
- Datasets are meaningful on their own for analysis/visualization
- When refreshed, datasets change over time:
  * New rows may be added (accumulating data)
  * Existing values may update (latest readings)
- This allows tracking trends, changes, and patterns over time

Example Use Cases:
- Stock prices: "Last 30 days" grows daily with new data
- ISS position: Track trajectory over last N minutes
- Earthquakes: All quakes since a start date accumulates

Rate Limiting:
- External API routes are rate-limited to prevent abuse
- Limits are set per IP address using Flask-Limiter
"""

import random
import logging
import requests
import io
import csv
import math
from datetime import datetime, timedelta
from flask import Blueprint, Response, request, jsonify
from typing import List, Dict, Any, Optional
from collections import deque
import threading

logger = logging.getLogger(__name__)

demo_stream_bp = Blueprint('demo_stream', __name__, url_prefix='/api/demo-stream')

# ============================================================================
# Rate Limiting Configuration
# ============================================================================
# Uses Flask-Limiter with deferred app initialization to avoid circular imports.
# The limiter is created here and init_app() is called from app.py.

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Create limiter without app - will be initialized via init_app() in app.py
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],  # No default limits - only apply to specific routes
    storage_uri="memory://",
    strategy="fixed-window",
)

# Rate limit strings for different endpoint types
# These are applied to routes that call external APIs

# ISS API (open-notify.org) - generous limits
ISS_RATE_LIMIT = "30 per minute"

# USGS Earthquake API - allow reasonable queries
EARTHQUAKE_RATE_LIMIT = "20 per minute"

# Weather APIs (Open-Meteo, NWS) - moderate limits
WEATHER_RATE_LIMIT = "20 per minute"

# yfinance API - more restrictive due to Yahoo's limits
YFINANCE_RATE_LIMIT = "10 per minute"

# Simulated/mock data - no external calls, more generous
MOCK_RATE_LIMIT = "60 per minute"

# Try to import yfinance
import yfinance as yf


# ============================================================================
# Helper Functions
# ============================================================================

def make_csv_response(rows: list, filename: str = "data.csv") -> Response:
    """Convert list of dicts to CSV text response"""
    if not rows:
        return Response("", mimetype='text/csv')
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Access-Control-Allow-Origin': '*'}
    )


# ============================================================================
# ISS Location Tracking - Real-time trajectory
# Returns accumulated position history that grows over time
# Recommended refresh: 5-10 seconds
# ============================================================================

# Thread-safe storage for ISS position history
_iss_track_lock = threading.Lock()
_iss_track_history: deque = deque(maxlen=500)  # Keep last 500 positions (~40 min at 5s intervals)
_iss_last_fetch: Optional[datetime] = None

def _fetch_iss_position() -> Optional[Dict[str, Any]]:
    """Fetch current ISS position from API"""
    try:
        response = requests.get("http://api.open-notify.org/iss-now.json", timeout=10)
        response.raise_for_status()
        data = response.json()
        position = data.get("iss_position", {})
        return {
            "timestamp": datetime.utcfromtimestamp(data.get("timestamp", 0)).isoformat() + "Z",
            "latitude": float(position.get("latitude", 0)),
            "longitude": float(position.get("longitude", 0)),
        }
    except Exception as e:
        logger.warning(f"Failed to fetch ISS position: {e}")
        return None


@demo_stream_bp.route('/iss', methods=['GET'])
@limiter.limit(ISS_RATE_LIMIT)
def get_iss():
    """
    ISS position trajectory over time. Each refresh adds new position(s).
    
    Query params:
        - minutes: How many minutes of history to return (default: 30, max: 60)
        - limit: Max number of points to return (default: 100, max: 500)
    
    Data accumulates over time - each refresh may add new positions.
    The ISS completes one orbit in ~90 minutes, so 30 min shows ~1/3 of orbit.
    
    Recommended refresh: 5-10 seconds
    """
    global _iss_last_fetch
    
    minutes = min(60, max(1, int(request.args.get('minutes', 30))))
    limit = min(500, max(10, int(request.args.get('limit', 100))))
    
    now = datetime.utcnow()
    cutoff = now - timedelta(minutes=minutes)
    
    # Fetch new position if enough time has passed (at least 3 seconds)
    with _iss_track_lock:
        should_fetch = _iss_last_fetch is None or (now - _iss_last_fetch).total_seconds() >= 3
        
        if should_fetch:
            position = _fetch_iss_position()
            if position:
                position["fetched_at"] = now.isoformat() + "Z"
                _iss_track_history.append(position)
                _iss_last_fetch = now
        
        # Filter to requested time window and limit
        rows = []
        for pos in _iss_track_history:
            try:
                pos_time = datetime.fromisoformat(pos["timestamp"].replace("Z", "+00:00")).replace(tzinfo=None)
                if pos_time >= cutoff:
                    rows.append(pos)
            except:
                continue
        
        # Limit and sort by time
        rows = sorted(rows, key=lambda x: x["timestamp"])[-limit:]
    
    # If we have no data yet, fetch once and return
    if not rows:
        position = _fetch_iss_position()
        if position:
            position["fetched_at"] = now.isoformat() + "Z"
            rows = [position]
    
    return make_csv_response(rows)


@demo_stream_bp.route('/iss/current', methods=['GET'])
@limiter.limit(ISS_RATE_LIMIT)
def get_iss_current():
    """
    Current ISS position only (single row).
    Use /iss for trajectory tracking over time.
    Recommended refresh: 5 seconds
    """
    try:
        response = requests.get("http://api.open-notify.org/iss-now.json", timeout=10)
        response.raise_for_status()
        data = response.json()
        
        position = data.get("iss_position", {})
        rows = [{
            "timestamp": datetime.utcfromtimestamp(data.get("timestamp", 0)).isoformat() + "Z",
            "latitude": float(position.get("latitude", 0)),
            "longitude": float(position.get("longitude", 0)),
            "fetched_at": datetime.utcnow().isoformat() + "Z"
        }]
        return make_csv_response(rows)
    except Exception as e:
        return Response(f"error,{str(e)}", mimetype='text/csv'), 500


# ============================================================================
# USGS Earthquakes - Accumulating dataset of seismic events
# Data naturally grows over time as new earthquakes occur
# Recommended refresh: 60 seconds
# ============================================================================

@demo_stream_bp.route('/earthquakes', methods=['GET'])
@limiter.limit(EARTHQUAKE_RATE_LIMIT)
def get_earthquakes():
    """
    Earthquakes from USGS. Dataset grows as new quakes occur.
    
    Query params:
        - timeframe: 'hour', 'day', 'week', 'month' (default: 'day')
        - min_magnitude: Minimum magnitude filter (default: 0)
        - max_magnitude: Maximum magnitude filter (optional)
        - since: ISO date string - only return quakes after this time
        - limit: Maximum number of results (default: 20000, max: 20000)
        - use_query_api: 'true' to use query API for more data (default: 'false' for quick summary)
    
    Use case:
        - Set timeframe='week' to see a week of earthquake data
        - Each refresh may show new earthquakes that occurred
        - Use min_magnitude to filter for significant quakes (e.g., 4.0+)
        - Set use_query_api=true and limit=10000 to get large datasets
    
    Recommended refresh: 60 seconds
    """
    timeframe = request.args.get('timeframe', 'day')
    min_magnitude = float(request.args.get('min_magnitude', 0))
    max_magnitude = request.args.get('max_magnitude')
    since_str = request.args.get('since')
    limit = min(20000, max(1, int(request.args.get('limit', 20000))))
    use_query_api = request.args.get('use_query_api', 'false').lower() == 'true'
    
    fetched_at = datetime.utcnow().isoformat() + "Z"
    rows = []
    
    # Parse 'since' filter if provided
    since_timestamp = None
    if since_str:
        try:
            since_dt = datetime.fromisoformat(since_str.replace("Z", "+00:00")).replace(tzinfo=None)
            since_timestamp = since_dt.timestamp() * 1000  # USGS uses milliseconds
        except:
            pass
    
    try:
        if use_query_api or limit > 1000:
            # Use USGS Query API for larger datasets
            now = datetime.utcnow()
            timeframe_deltas = {
                "hour": timedelta(hours=1),
                "day": timedelta(days=1),
                "week": timedelta(weeks=1),
                "month": timedelta(days=30)
            }
            start_time = now - timeframe_deltas.get(timeframe, timedelta(days=1))
            
            params = {
                "format": "geojson",
                "starttime": start_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "endtime": now.strftime("%Y-%m-%dT%H:%M:%S"),
                "minmagnitude": min_magnitude,
                "limit": limit,
                "orderby": "time"  # Most recent first
            }
            
            if max_magnitude:
                params["maxmagnitude"] = float(max_magnitude)
            
            url = "https://earthquake.usgs.gov/fdsnws/event/1/query"
            response = requests.get(url, params=params, timeout=60)
            response.raise_for_status()
            data = response.json()
        else:
            # Use summary feeds for quick queries
            feeds = {"hour": "all_hour", "day": "all_day", "week": "all_week", "month": "all_month"}
            feed = feeds.get(timeframe, "all_day")
            url = f"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{feed}.geojson"
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()
        
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            coords = feature.get("geometry", {}).get("coordinates", [0, 0, 0])
            
            # Filter by magnitude (additional client-side filter for summary feeds)
            mag = props.get("mag")
            if mag is not None:
                if mag < min_magnitude:
                    continue
                if max_magnitude and mag > float(max_magnitude):
                    continue
            
            # Filter by 'since' time
            quake_time = props.get("time", 0)
            if since_timestamp and quake_time <= since_timestamp:
                continue
            
            rows.append({
                "id": feature.get("id"),
                "time": datetime.utcfromtimestamp(quake_time / 1000).isoformat() + "Z",
                "latitude": coords[1] if len(coords) > 1 else None,
                "longitude": coords[0] if len(coords) > 0 else None,
                "depth_km": coords[2] if len(coords) > 2 else None,
                "magnitude": mag,
                "place": props.get("place"),
                "type": props.get("type", "earthquake"),
                "status": props.get("status"),
                "felt": props.get("felt"),  # Number of people who reported feeling it
                "cdi": props.get("cdi"),  # Maximum reported intensity
                "mmi": props.get("mmi"),  # Maximum estimated instrumental intensity
                "tsunami": props.get("tsunami", 0),  # Tsunami warning (0 or 1)
                "sig": props.get("sig"),  # Significance (0-1000)
                "net": props.get("net"),  # Network that reported the event
                "code": props.get("code"),  # Event code
                "url": props.get("url"),  # USGS detail page URL
                "fetched_at": fetched_at
            })
            
            # Limit results if using summary feed
            if not use_query_api and len(rows) >= limit:
                break
        
        # Sort by time, most recent first
        rows.sort(key=lambda x: x["time"], reverse=True)
        
        # Apply limit (in case summary feed returned more than requested)
        if len(rows) > limit:
            rows = rows[:limit]
        
        return make_csv_response(rows)
    except Exception as e:
        logger.warning(f"Failed to fetch earthquakes: {e}")
        return Response(f"error,{str(e)}", mimetype='text/csv'), 500


# ============================================================================
# Current Weather (Open-Meteo) - Updates every 15 minutes
# Recommended refresh: 300 seconds
# ============================================================================

WEATHER_CITIES = [
    {"name": "Seattle", "lat": 47.6062, "lon": -122.3321},
    {"name": "New York", "lat": 40.7128, "lon": -74.0060},
    {"name": "Los Angeles", "lat": 34.0522, "lon": -118.2437},
    {"name": "Chicago", "lat": 41.8781, "lon": -87.6298},
    {"name": "Miami", "lat": 25.7617, "lon": -80.1918},
    {"name": "Denver", "lat": 39.7392, "lon": -104.9903},
    {"name": "Boston", "lat": 42.3601, "lon": -71.0589},
    {"name": "Phoenix", "lat": 33.4484, "lon": -112.0740},
]

@demo_stream_bp.route('/weather', methods=['GET'])
@limiter.limit(WEATHER_RATE_LIMIT)
def get_weather():
    """
    Current weather for major US cities. Updates every 15 minutes.
    Recommended refresh: 300 seconds
    """
    fetched_at = datetime.utcnow().isoformat() + "Z"
    rows = []
    
    for city in WEATHER_CITIES:
        try:
            params = {
                "latitude": city["lat"],
                "longitude": city["lon"],
                "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation",
                "timezone": "auto"
            }
            response = requests.get("https://api.open-meteo.com/v1/forecast", params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            current = data.get("current", {})
            
            rows.append({
                "city": city["name"],
                "latitude": city["lat"],
                "longitude": city["lon"],
                "temperature_c": current.get("temperature_2m"),
                "humidity_percent": current.get("relative_humidity_2m"),
                "wind_speed_kmh": current.get("wind_speed_10m"),
                "precipitation_mm": current.get("precipitation"),
                "fetched_at": fetched_at
            })
        except Exception as e:
            logger.warning(f"Failed to fetch weather for {city['name']}: {e}")
    
    return make_csv_response(rows)


# ============================================================================
# Weather History (Open-Meteo) - Past days of hourly data
# Dataset grows as new hours pass
# ============================================================================

@demo_stream_bp.route('/weather/history', methods=['GET'])
@limiter.limit(WEATHER_RATE_LIMIT)
def get_weather_history():
    """
    Hourly weather history for a location. Dataset grows with each hour.
    
    Query params:
        - city: City name (default: Seattle) - one of the WEATHER_CITIES
        - days: Number of past days to include (default: 7, max: 14)
    
    Use case:
        - Track temperature/weather trends over the past week
        - Each hour, a new row appears in the dataset
        - Great for visualizing weather patterns
    
    Recommended refresh: 3600 seconds (hourly)
    """
    city_name = request.args.get('city', 'Seattle')
    days = min(14, max(1, int(request.args.get('days', 7))))
    
    # Find city coordinates
    city = next((c for c in WEATHER_CITIES if c["name"].lower() == city_name.lower()), WEATHER_CITIES[0])
    
    fetched_at = datetime.utcnow().isoformat() + "Z"
    
    try:
        # Open-Meteo historical/archive API
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        params = {
            "latitude": city["lat"],
            "longitude": city["lon"],
            "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code",
            "timezone": "auto",
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d")
        }
        
        response = requests.get("https://api.open-meteo.com/v1/forecast", params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        hourly = data.get("hourly", {})
        times = hourly.get("time", [])
        temps = hourly.get("temperature_2m", [])
        humidity = hourly.get("relative_humidity_2m", [])
        wind = hourly.get("wind_speed_10m", [])
        precip = hourly.get("precipitation", [])
        weather_codes = hourly.get("weather_code", [])
        
        # Weather code descriptions
        weather_desc = {
            0: "Clear", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
            45: "Foggy", 48: "Depositing Rime Fog",
            51: "Light Drizzle", 53: "Moderate Drizzle", 55: "Dense Drizzle",
            61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain",
            71: "Slight Snow", 73: "Moderate Snow", 75: "Heavy Snow",
            80: "Slight Showers", 81: "Moderate Showers", 82: "Violent Showers",
            95: "Thunderstorm", 96: "Thunderstorm with Hail", 99: "Thunderstorm with Heavy Hail"
        }
        
        rows = []
        for i, time_str in enumerate(times):
            code = weather_codes[i] if i < len(weather_codes) else 0
            rows.append({
                "city": city["name"],
                "timestamp": time_str + ":00Z" if ":" in time_str else time_str,
                "temperature_c": temps[i] if i < len(temps) else None,
                "humidity_percent": humidity[i] if i < len(humidity) else None,
                "wind_speed_kmh": wind[i] if i < len(wind) else None,
                "precipitation_mm": precip[i] if i < len(precip) else None,
                "weather_code": code,
                "weather": weather_desc.get(code, "Unknown"),
                "fetched_at": fetched_at
            })
        
        return make_csv_response(rows)
    except Exception as e:
        logger.warning(f"Failed to fetch weather history: {e}")
        return Response(f"error,{str(e)}", mimetype='text/csv'), 500


# ============================================================================
# NWS Weather Forecast - Updates every few hours
# Recommended refresh: 3600 seconds (1 hour)
# ============================================================================

NWS_LOCATIONS = {
    "seattle": {"name": "Seattle, WA", "office": "SEW", "gridX": 124, "gridY": 67},
    "new_york": {"name": "New York, NY", "office": "OKX", "gridX": 33, "gridY": 37},
    "los_angeles": {"name": "Los Angeles, CA", "office": "LOX", "gridX": 154, "gridY": 44},
    "chicago": {"name": "Chicago, IL", "office": "LOT", "gridX": 65, "gridY": 76},
}

@demo_stream_bp.route('/forecast/<location>', methods=['GET'])
@limiter.limit(WEATHER_RATE_LIMIT)
def get_forecast(location: str):
    """
    7-day forecast from NWS. Updates every few hours.
    Locations: seattle, new_york, los_angeles, chicago
    Recommended refresh: 3600 seconds
    """
    loc_key = location.lower().replace("-", "_")
    if loc_key not in NWS_LOCATIONS:
        return Response(f"error,Unknown location. Use: {','.join(NWS_LOCATIONS.keys())}", mimetype='text/csv'), 400
    
    loc = NWS_LOCATIONS[loc_key]
    
    try:
        url = f"https://api.weather.gov/gridpoints/{loc['office']}/{loc['gridX']},{loc['gridY']}/forecast"
        headers = {"User-Agent": "(DataFormulator, demo@example.com)"}
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        fetched_at = datetime.utcnow().isoformat() + "Z"
        rows = []
        
        for period in data.get("properties", {}).get("periods", []):
            rows.append({
                "location": loc["name"],
                "period": period.get("name"),
                "temperature": period.get("temperature"),
                "temperature_unit": period.get("temperatureUnit"),
                "wind_speed": period.get("windSpeed"),
                "wind_direction": period.get("windDirection"),
                "forecast": period.get("shortForecast"),
                "fetched_at": fetched_at
            })
        
        return make_csv_response(rows)
    except Exception as e:
        return Response(f"error,{str(e)}", mimetype='text/csv'), 500


# ============================================================================
# yfinance - Stock/Financial Data via Yahoo Finance
# Single unified API with historical daily data + recent 15min intraday data
# Recommended refresh: 300 seconds (5 minutes) during market hours
# ============================================================================

DEFAULT_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA"]


@demo_stream_bp.route('/yfinance', methods=['GET'])
@limiter.limit(YFINANCE_RATE_LIMIT)
def get_yfinance():
    """
    Stock prices via yfinance with historical daily data + recent intraday data (15min intervals).
    
    Returns a complete dataset combining:
    - Historical daily data from start_date (default: 6 months ago)
    - Recent intraday data at 15-minute intervals (last ~5-7 days)
    - Today's live intraday data points
    
    Query params:
        - symbols: comma-separated stock symbols (default: AAPL,MSFT,GOOGL,AMZN,META,NVDA,TSLA)
        - start_date: YYYY-MM-DD format (default: 6 months ago)
    
    Example use case:
        - /api/demo-stream/yfinance?symbols=AAPL,MSFT&start_date=2025-07-01
        - Returns daily data from July 2025, plus recent 15min intraday data
        - New data appears each trading day
    
    Recommended refresh: 300 seconds (5 minutes) during market hours
    """
    symbols_param = request.args.get('symbols', ','.join(DEFAULT_SYMBOLS))
    symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()][:10]
    
    now = datetime.utcnow()
    today = now.date()
    
    # Parse start_date, default to 6 months ago
    start_date_str = request.args.get('start_date')
    if start_date_str:
        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        except:
            start_date = now - timedelta(days=180)
    else:
        start_date = now - timedelta(days=180)
    
    # Calculate number of days
    days = (now - start_date).days
    
    # yfinance typically provides intraday data for last 5-7 days
    intraday_days_limit = 7
    intraday_interval = '15m'
    
    fetched_at = now.isoformat() + "Z"
    rows = []
    
    # Helper to check if value is valid (not NaN/None)
    def is_valid(val):
        try:
            return val is not None and not (isinstance(val, float) and math.isnan(val))
        except:
            return False
    
    # Helper to format timestamp
    def format_timestamp(date_obj):
        """Convert pandas Timestamp or datetime to string"""
        try:
            if hasattr(date_obj, 'tz_convert'):
                date_utc = date_obj.tz_convert('UTC')
            elif hasattr(date_obj, 'tz_localize') and date_obj.tz is not None:
                date_utc = date_obj.tz_convert('UTC')
            else:
                date_utc = date_obj
            
            if hasattr(date_utc, 'to_pydatetime'):
                date_utc = date_utc.to_pydatetime()
            elif hasattr(date_utc, 'timestamp'):
                date_utc = datetime.fromtimestamp(date_utc.timestamp())
            
            if isinstance(date_utc, datetime):
                return date_utc.strftime("%Y-%m-%d %H:%M:%S")
            else:
                return str(date_utc)
        except:
            return str(date_obj)
    
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            
            # Get historical daily data for older period (before intraday range)
            daily_days = max(0, days - intraday_days_limit)
            
            if daily_days > 0:
                daily_end = now - timedelta(days=intraday_days_limit)
                hist_daily = ticker.history(start=start_date.strftime("%Y-%m-%d"), end=daily_end.strftime("%Y-%m-%d"))
                
                for date, row in hist_daily.iterrows():
                    try:
                        if hasattr(date, 'strftime'):
                            date_str = date.strftime("%Y-%m-%d")
                        else:
                            date_str = str(date)
                    except:
                        date_str = str(date)
                    
                    rows.append({
                        "symbol": symbol,
                        "timestamp": date_str + " 00:00:00",
                        "date": date_str,
                        "open": round(row["Open"], 2) if is_valid(row["Open"]) else None,
                        "high": round(row["High"], 2) if is_valid(row["High"]) else None,
                        "low": round(row["Low"], 2) if is_valid(row["Low"]) else None,
                        "close": round(row["Close"], 2) if is_valid(row["Close"]) else None,
                        "volume": int(row["Volume"]) if is_valid(row["Volume"]) else None,
                        "data_type": "daily",
                        "fetched_at": fetched_at
                    })
            
            # Get recent intraday data at 15min intervals (last 5-7 days excluding today)
            try:
                hist_intraday = ticker.history(interval=intraday_interval, period='7d')
                
                if not hist_intraday.empty:
                    for date, row in hist_intraday.iterrows():
                        # Skip today (we'll get it separately to ensure latest)
                        try:
                            if hasattr(date, 'date'):
                                date_only = date.date()
                            elif hasattr(date, 'to_pydatetime'):
                                date_only = date.to_pydatetime().date()
                            else:
                                date_only = date
                            
                            if isinstance(date_only, str):
                                date_only = datetime.strptime(date_only, "%Y-%m-%d").date()
                            
                            if date_only == today:
                                continue  # Skip today, will get it below
                        except:
                            pass
                        
                        timestamp_str = format_timestamp(date)
                        
                        rows.append({
                            "symbol": symbol,
                            "timestamp": timestamp_str,
                            "date": timestamp_str.split()[0] if ' ' in timestamp_str else str(date),
                            "open": round(row["Open"], 2) if is_valid(row["Open"]) else None,
                            "high": round(row["High"], 2) if is_valid(row["High"]) else None,
                            "low": round(row["Low"], 2) if is_valid(row["Low"]) else None,
                            "close": round(row["Close"], 2) if is_valid(row["Close"]) else None,
                            "volume": int(row["Volume"]) if is_valid(row["Volume"]) else None,
                            "data_type": "intraday",
                            "fetched_at": fetched_at
                        })
            except Exception as e:
                logger.warning(f"Failed to fetch intraday historical for {symbol}: {e}")
            
            # Get today's intraday data (always fetch to ensure latest)
            hist_intraday_today = ticker.history(interval=intraday_interval, period='1d')
            
            if not hist_intraday_today.empty:
                for date, row in hist_intraday_today.iterrows():
                    timestamp_str = format_timestamp(date)
                    
                    rows.append({
                        "symbol": symbol,
                        "timestamp": timestamp_str,
                        "date": today.strftime("%Y-%m-%d"),
                        "open": round(row["Open"], 2) if is_valid(row["Open"]) else None,
                        "high": round(row["High"], 2) if is_valid(row["High"]) else None,
                        "low": round(row["Low"], 2) if is_valid(row["Low"]) else None,
                        "close": round(row["Close"], 2) if is_valid(row["Close"]) else None,
                        "volume": int(row["Volume"]) if is_valid(row["Volume"]) else None,
                        "data_type": "intraday",
                        "fetched_at": fetched_at
                    })
            else:
                # If no intraday data, try to get today's price
                try:
                    info = ticker.info
                    price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
                    if price:
                        rows.append({
                            "symbol": symbol,
                            "timestamp": today.strftime("%Y-%m-%d") + " 00:00:00",
                            "date": today.strftime("%Y-%m-%d"),
                            "open": price,
                            "high": price,
                            "low": price,
                            "close": price,
                            "volume": info.get('volume', 0),
                            "data_type": "daily",
                            "fetched_at": fetched_at
                        })
                except:
                    pass
                    
        except Exception as e:
            logger.warning(f"Failed to fetch data for {symbol}: {e}")
    
    # Sort by symbol, then timestamp
    rows.sort(key=lambda x: (x["symbol"], x["timestamp"]))
    
    return make_csv_response(rows)


# ============================================================================
# Mock Live Sales Feed - Updates every second (for demo)
# Rich schema with programmatically correlated data
# ============================================================================


@demo_stream_bp.route('/live-sales', methods=['GET'])
@limiter.limit(MOCK_RATE_LIMIT)
def get_live_sales():
    """
    Simulated live sales feed. Updates every second.
    Each refresh shows recent "transactions" with product details.
    Recommended refresh: 1 second
    """
    now = datetime.utcnow()
    hour_of_day = now.hour + now.minute / 60
    
    # Products with realistic pricing and popularity
    products = [
        {"name": "Wireless Headphones", "category": "Electronics", "base_price": 79.99, "popularity": 0.15},
        {"name": "Smart Watch", "category": "Electronics", "base_price": 199.99, "popularity": 0.10},
        {"name": "Running Shoes", "category": "Sports", "base_price": 129.99, "popularity": 0.12},
        {"name": "Yoga Mat", "category": "Sports", "base_price": 34.99, "popularity": 0.08},
        {"name": "Coffee Maker", "category": "Home", "base_price": 89.99, "popularity": 0.09},
        {"name": "Desk Lamp", "category": "Home", "base_price": 45.99, "popularity": 0.07},
        {"name": "Backpack", "category": "Accessories", "base_price": 59.99, "popularity": 0.11},
        {"name": "Water Bottle", "category": "Accessories", "base_price": 24.99, "popularity": 0.13},
        {"name": "Bluetooth Speaker", "category": "Electronics", "base_price": 49.99, "popularity": 0.08},
        {"name": "Fitness Tracker", "category": "Electronics", "base_price": 69.99, "popularity": 0.07},
    ]
    
    regions = ["North America", "Europe", "Asia Pacific", "Latin America"]
    region_weights = [0.45, 0.30, 0.18, 0.07]
    
    channels = ["Web", "Mobile App", "In-Store", "Partner"]
    channel_weights = [0.40, 0.35, 0.15, 0.10]
    
    # Generate 5-10 recent transactions
    num_transactions = random.randint(5, 10)
    rows = []
    
    for i in range(num_transactions):
        product = random.choices(products, weights=[p["popularity"] for p in products])[0]
        region = random.choices(regions, weights=region_weights)[0]
        channel = random.choices(channels, weights=channel_weights)[0]
        
        quantity = random.choices([1, 2, 3, 4, 5], weights=[0.5, 0.25, 0.15, 0.07, 0.03])[0]
        discount = random.choices([0, 5, 10, 15, 20], weights=[0.6, 0.15, 0.12, 0.08, 0.05])[0]
        
        unit_price = round(product["base_price"] * (1 - discount / 100), 2)
        total = round(unit_price * quantity, 2)
        
        # Transaction time within the last minute
        tx_time = now - timedelta(seconds=random.randint(0, 60))
        
        rows.append({
            "transaction_id": f"TX{int(tx_time.timestamp() * 1000) % 1000000:06d}",
            "timestamp": tx_time.isoformat() + "Z",
            "product": product["name"],
            "category": product["category"],
            "quantity": quantity,
            "unit_price": unit_price,
            "discount_pct": discount,
            "total": total,
            "region": region,
            "channel": channel,
        })
    
    # Sort by timestamp descending
    rows.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return make_csv_response(rows)


# ============================================================================
# API Info Endpoint
# ============================================================================

@demo_stream_bp.route('/info', methods=['GET'])
def get_info():
    """List all available demo data endpoints with their parameters"""
    return jsonify({
        "name": "Demo Data REST APIs",
        "description": "Each endpoint returns CSV text with complete datasets that change over time. "
                       "Import URL in frontend, set auto-refresh to watch data evolve.",
        "design_philosophy": [
            "Each endpoint returns a COMPLETE dataset (not just one row)",
            "Datasets are meaningful for analysis and visualization", 
            "When refreshed, new data may appear (accumulating) or values may update",
            "Use date parameters to track data from a specific point in time"
        ],
        "demo_examples": [
            {
                "id": "yfinance",
                "url": "/api/demo-stream/yfinance?symbols=AAPL,MSFT,GOOGL",
                "name": "Stock Data (6 months + Intraday)",
                "refresh_seconds": 300,
                "description": "Historical daily data (6 months default) + recent 15min intraday data + today's live prices (via yfinance)",
                "params": {
                    "symbols": "Comma-separated stock symbols (max 10)",
                    "start_date": "YYYY-MM-DD start date (default: 6 months ago)"
                }
            },
            {
                "id": "yfinance-ytd",
                "url": f"/api/demo-stream/yfinance?symbols=AAPL,NVDA,TSLA&start_date={datetime.utcnow().strftime('%Y')}-01-01",
                "name": "Stock Data (Year to Date)",
                "refresh_seconds": 300,
                "description": "Year-to-date stock data with daily history + recent intraday (via yfinance)"
            },
            {
                "id": "iss-trajectory",
                "url": "/api/demo-stream/iss?minutes=30",
                "name": "ISS Trajectory",
                "refresh_seconds": 5,
                "description": "ISS orbital path - positions accumulate over time",
                "params": {
                    "minutes": "Minutes of history (1-60, default 30)",
                    "limit": "Max points to return (10-500)"
                }
            },
            {
                "id": "earthquakes-week",
                "url": "/api/demo-stream/earthquakes?timeframe=week&min_magnitude=4",
                "name": "Earthquakes (Week, M4+)",
                "refresh_seconds": 60,
                "description": "Significant earthquakes - new quakes appear over time",
                "params": {
                    "timeframe": "hour, day, week, month",
                    "min_magnitude": "Minimum magnitude filter",
                    "max_magnitude": "Maximum magnitude filter (optional)",
                    "since": "ISO datetime - only quakes after this time",
                    "limit": "Max results (1-20000, default 20000)",
                    "use_query_api": "true to use query API for large datasets (default false)"
                }
            },
            {
                "id": "earthquakes-large",
                "url": "/api/demo-stream/earthquakes?timeframe=month&min_magnitude=2&use_query_api=true&limit=10000",
                "name": "Earthquakes (Month, Large Dataset)",
                "refresh_seconds": 300,
                "description": "Large dataset with up to 10,000 earthquakes from the past month"
            },
            {
                "id": "weather-history",
                "url": "/api/demo-stream/weather/history?city=Seattle&days=7",
                "name": "Weather History (7 days)",
                "refresh_seconds": 3600,
                "description": "Hourly weather data - new hours appear over time",
                "params": {
                    "city": "City name (Seattle, New York, etc.)",
                    "days": "Past days to include (1-14)"
                }
            },
            {
                "id": "live-sales",
                "url": "/api/demo-stream/live-sales",
                "name": "Live Sales Feed",
                "refresh_seconds": 1,
                "description": "Simulated e-commerce transactions"
            },
            {
                "id": "weather-current",
                "url": "/api/demo-stream/weather",
                "name": "Weather (Current)",
                "refresh_seconds": 300,
                "description": "Current conditions for 8 US cities"
            }
        ],
        "usage": "Click any example to load it, or enter a custom URL. Set auto-refresh to watch data change over time."
    })

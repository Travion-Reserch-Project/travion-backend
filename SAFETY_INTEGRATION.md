# Safety Component Integration Documentation

## Overview

The Safety component integrates Google Maps API with a Machine Learning model to predict safety risks for any location based on latitude and longitude coordinates.

## Complete Flow

```
User Location (lat/lon)
         ↓
Backend Safety Service
         ↓
Google Maps API (Extract Features)
    • is_beach (check beach nearby)
    • is_tourist_place (check tourist attractions)
    • is_transit (bus stand OR train station)
    • is_crowded (market OR mall OR tourist place)
    • hour (current time in Sri Lanka)
    • day_of_week (0=Sunday to 6=Saturday)
    • is_weekend (Saturday or Sunday)
    • police_nearby (check police stations)
    • area_cluster (default 0)
         ↓
ML Model (Safety Service - Port 8003)
    Input: 13 features
    Output: 7 incident types × 3 severity levels
         ↓
Backend Processing
    • Transform predictions
    • Save to database
    • Return formatted response
         ↓
Frontend (SafetyAlerts Screen)
    Display real-time safety predictions
```

## Architecture

### 1. **Model** (`src/models/SafetyAlert.ts`)

- MongoDB schema for storing safety alerts
- Fields: userId, location, features, predictions, timestamp

### 2. **Repository** (`src/repositories/SafetyRepository.ts`)

- Database operations
- Methods:
  - `create()` - Save new alert
  - `findByUserId()` - Get user's history
  - `findRecentByLocation()` - Get nearby alerts
  - `getHighRiskAlertsForUser()` - Get high-risk alerts

### 3. **Google Maps Service** (`src/services/GoogleMapsService.ts`)

- Extracts location features from lat/lon
- Methods:
  - `extractLocationFeatures()` - Main method
  - `reverseGeocode()` - Get address/location name
  - `checkNearbyPlace()` - Check for nearby amenities

### 4. **Safety Service** (`src/services/SafetyService.ts`)

- Orchestrates the complete flow
- Main method: `getSafetyPredictions(userId, latitude, longitude)`
- Steps:
  1. Call Google Maps API to extract features
  2. Send features to ML model
  3. Transform ML predictions
  4. Save to database
  5. Return formatted response

### 5. **Controller** (`src/controllers/SafetyController.ts`)

- Handles HTTP requests
- Endpoints:
  - `POST /api/v1/safety/predictions` - Get safety predictions
  - `GET /api/v1/safety/history` - Get alert history
  - `GET /api/v1/safety/high-risk` - Get high-risk alerts
  - `GET /api/v1/safety/nearby` - Get nearby alerts
  - `GET /api/v1/safety/health` - ML service health check

### 6. **Routes** (`src/routes/safetyRoutes.ts`)

- Route definitions with validation

## API Endpoints

### POST /api/v1/safety/predictions

Get safety predictions for a location.

**Request:**

```json
{
  "latitude": 6.9271,
  "longitude": 79.8612
}
```

**Response:**

```json
{
  "success": true,
  "location": {
    "latitude": 6.9271,
    "longitude": 79.8612,
    "address": "Colombo, Sri Lanka",
    "locationName": "Colombo"
  },
  "features": {
    "area_cluster": 0,
    "is_beach": 1,
    "is_crowded": 1,
    "is_tourist_place": 1,
    "is_transit": 1,
    "hour": 14,
    "day_of_week": 3,
    "is_weekend": 0,
    "police_nearby": 1
  },
  "predictions": [
    {
      "incidentType": "Scam",
      "riskLevel": "high",
      "confidence": 0.85
    },
    {
      "incidentType": "Pickpocket",
      "riskLevel": "medium",
      "confidence": 0.65
    },
    ...
  ],
  "alerts": [
    {
      "id": "1",
      "title": "Scam Risk - HIGH",
      "description": "High scam risk detected. Avoid engaging with suspicious individuals.",
      "level": "high",
      "location": "Colombo",
      "incidentType": "Scam"
    }
  ],
  "timestamp": "2026-01-03T12:00:00.000Z"
}
```

### GET /api/v1/safety/history

Get user's alert history.

**Query Parameters:**

- `limit` (optional): Number of results (1-100, default: 10)
- `skip` (optional): Number to skip (default: 0)

### GET /api/v1/safety/high-risk

Get high-risk alerts for user.

**Query Parameters:**

- `limit` (optional): Number of results (1-50, default: 5)

### GET /api/v1/safety/nearby

Get alerts near a location.

**Query Parameters:**

- `latitude` (required): -90 to 90
- `longitude` (required): -180 to 180
- `radius` (optional): Radius in km (0.1-100, default: 5)
- `limit` (optional): Number of results (1-100, default: 10)

### GET /api/v1/safety/health

Check ML service health.

## Configuration

### Environment Variables (.env)

```env
# Google Maps API Key (Required!)
GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here

# ML Safety Service URL
SAFETY_API_URL=http://localhost:8003/api/safety
```

### Get Google Maps API Key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable APIs:
   - Geocoding API
   - Places API
4. Create credentials → API Key
5. Restrict API key (optional but recommended):
   - API restrictions: Geocoding API, Places API
   - Application restrictions: HTTP referrers or IP addresses

## ML Model Integration

### ML Service Endpoint

**URL:** `http://localhost:8003/api/safety/predict`

### Input Format (11 features - matches ML model):

```json
{
  "lat": 6.9271,
  "lon": 79.8612,
  "area_cluster": 0,
  "is_beach": 1,
  "is_crowded": 1,
  "is_tourist_place": 1,
  "is_transit": 1,
  "hour": 14,
  "day_of_week": 3,
  "is_weekend": 0,
  "police_nearby": 1
}
```

### Feature Calculation Logic:

- **is_transit**: 1 if bus station OR train station nearby (combined)
- **is_crowded**: 1 if market OR shopping mall OR tourist place nearby (combined)
- **hour**: Current hour in Sri Lanka timezone (0-23)
- **day_of_week**: Current day (0=Sunday, 6=Saturday)
- **is_weekend**: 1 if Saturday or Sunday
- **area_cluster**: Default 0 (can be enhanced with clustering algorithm)

### Expected Output:

```json
{
  "predictions": {
    "Scam": { "level": "high", "confidence": 0.85 },
    "Pickpocket": { "level": "medium", "confidence": 0.65 },
    "Theft": { "level": "low", "confidence": 0.3 },
    "Money Theft": { "level": "medium", "confidence": 0.55 },
    "Harassment": { "level": "low", "confidence": 0.25 },
    "Bag Snatching": { "level": "medium", "confidence": 0.6 },
    "Extortion": { "level": "low", "confidence": 0.2 }
  }
}
```

## Frontend Integration

### Frontend Service (services/safetyService.ts)

Already uses the backend API endpoint:

```typescript
POST / api / v1 / safety / predictions;
Body: {
  (latitude, longitude);
}
```

### SafetyAlerts Component

Receives alerts from API and displays:

- Incident type
- Risk level (low/medium/high)
- Description
- Location

## Testing

### 1. Test Google Maps API:

```bash
# Set GOOGLE_MAPS_API_KEY in .env
# Start backend
npm run dev

# Test endpoint
curl -X POST http://localhost:3001/api/v1/safety/predictions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"latitude": 6.9271, "longitude": 79.8612}'
```

### 2. Test ML Model:

```bash
# Start ML service
cd ml-services/safety-service
python app.py

# Test directly
curl -X POST http://localhost:8003/api/safety/predict \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 6.9271,
    "longitude": 79.8612,
    "is_beach": 1,
    ...
  }'
```

### 3. Test Complete Flow:

- Start ML service (port 8003)
- Start backend (port 3001)
- Start frontend
- Navigate to Safety screen
- Allow location permission
- View real predictions

## Error Handling

### Google Maps API Errors:

- Invalid API key → Check .env
- Quota exceeded → Check Google Cloud Console
- Invalid coordinates → Validate lat/lon

### ML Model Errors:

- Connection refused → Start ML service
- Timeout → Check ML service health
- Invalid response → Verify ML model output format

### Database Errors:

- Connection failed → Check MongoDB
- Validation error → Check input data

## Deployment Considerations

### Environment Variables:

- ✅ GOOGLE_MAPS_API_KEY (required)
- ✅ SAFETY_API_URL (required)
- ✅ MONGODB_URI (required)

### Google Maps API:

- Enable billing (API calls cost money)
- Set up API key restrictions
- Monitor quota usage

### ML Service:

- Deploy on same network as backend
- Use internal URL for better security
- Set up health monitoring

### Database:

- Index on userId, timestamp
- Index on location for geospatial queries
- Set up backup strategy

## Differences from Other Components

Unlike the chat and recommendation components, the Safety component:

1. **Uses Google Maps API** - Automatically extracts location features
2. **No manual feature input** - User only provides lat/lon
3. **Multi-output predictions** - 7 incident types × 3 severity levels
4. **Real-time safety** - Based on current time (is_night)
5. **Location-aware** - Features extracted based on actual location data

## Summary

✅ **Model**: SafetyAlert schema for database
✅ **Repository**: Database operations
✅ **Google Maps Service**: Feature extraction
✅ **Safety Service**: Complete flow orchestration
✅ **Controller**: HTTP request handling
✅ **Routes**: API endpoints with validation
✅ **Config**: Google Maps API key added
✅ **Documentation**: Complete integration guide

**Ready to deploy!** 🚀

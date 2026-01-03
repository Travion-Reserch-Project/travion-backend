# Safety Component - Quick Setup Guide

## 🎯 What Was Created

### Backend Files Created/Updated:

1. **Model**: `src/models/SafetyAlert.ts` - MongoDB schema
2. **Repository**: `src/repositories/SafetyRepository.ts` - Database operations
3. **Service**: `src/services/GoogleMapsService.ts` - NEW! Feature extraction
4. **Service**: `src/services/SafetyService.ts` - UPDATED! Complete flow
5. **Controller**: `src/controllers/SafetyController.ts` - UPDATED! New endpoints
6. **Routes**: `src/routes/safetyRoutes.ts` - UPDATED! New routes
7. **Config**: `src/config/config.ts` - UPDATED! Added Google Maps API key
8. **Docs**: `SAFETY_INTEGRATION.md` - Complete documentation

## 🚀 Quick Start

### Step 1: Install Dependencies (if needed)

```bash
cd travion-backend
npm install axios dotenv mongoose express-validator
```

### Step 2: Configure Environment Variables

Add to your `.env` file:

```env
# Google Maps API Key (GET THIS!)
GOOGLE_MAPS_API_KEY=your-api-key-here

# ML Safety Service
SAFETY_API_URL=http://localhost:8003/api/safety

# MongoDB
MONGODB_URI=mongodb://localhost:27017/travion-backend
```

### Step 3: Get Google Maps API Key

1. Go to: https://console.cloud.google.com/
2. Create project
3. Enable APIs:
   - ✅ Geocoding API
   - ✅ Places API
4. Create API Key
5. Copy to `.env`

### Step 4: Start Services

```bash
# Terminal 1: Start ML Service
cd ml-services/safety-service
python app.py  # Should run on port 8003

# Terminal 2: Start Backend
cd travion-backend
npm run dev  # Should run on port 3001

# Terminal 3: Start Frontend
cd travion-mobile
npm start
```

## 📡 API Endpoint

### Main Endpoint:

```
POST http://localhost:3001/api/v1/safety/predictions
```

### Request:

```json
{
  "latitude": 6.8485,
  "longitude": 79.9217
}
```

### Response:

```json
{
  "success": true,
  "location": {
    "latitude": 6.8485,
    "longitude": 79.9217,
    "address": "Maharagama, Sri Lanka",
    "locationName": "Maharagama"
  },
  "features": {
    "area_cluster": 0,
    "is_beach": 0,
    "is_crowded": 1,
    "is_tourist_place": 0,
    "is_transit": 1,
    "hour": 14,
    "day_of_week": 3,
    "is_weekend": 0,
    "police_nearby": 1
  },
  "predictions": [...],
  "alerts": [...]
}
```

## ✅ How It Works

```
User clicks "Get Safety Alerts" in frontend
         ↓
Frontend sends lat/lon to backend
         ↓
Backend → Google Maps API
    ✅ Get address (Maharagama)
    ✅ Check nearby beach (NO)
    ✅ Check nearby tourist place (NO)
    ✅ Check nearby bus stand (YES)
    ✅ Check nearby train station (YES)
    ✅ Calculate is_transit = 1 (bus OR train)
    ✅ Check nearby market (YES)
    ✅ Check nearby shopping mall (NO)
    ✅ Calculate is_crowded = 1 (market OR mall OR tourist)
    ✅ Check nearby police (YES)
    ✅ Calculate hour, day_of_week, is_weekend (from current time)
    ✅ area_cluster = 0 (default)
         ↓
Backend → ML Model (port 8003)
    Input: 11 features (matches ML model schema)
    Output: 7 risk predictions
         ↓
Backend → Database
    Save alert with predictions
         ↓
Backend → Frontend
    Return formatted alerts
         ↓
Frontend displays safety alerts
    ✅ Scam - High Risk
    ✅ Pickpocket - Medium Risk
    ✅ etc.
```

## 🧪 Test It!

### Option 1: Using cURL

```bash
# Replace YOUR_JWT_TOKEN with actual token
curl -X POST http://localhost:3001/api/v1/safety/predictions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "latitude": 6.8485,
    "longitude": 79.9217
  }'
```

### Option 2: Using Postman

1. Method: POST
2. URL: `http://localhost:3001/api/v1/safety/predictions`
3. Headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_JWT_TOKEN`
4. Body (raw JSON):

```json
{
  "latitude": 6.8485,
  "longitude": 79.9217
}
```

### Option 3: Using Frontend

1. Open mobile app
2. Go to Safety Alerts screen
3. Allow location permission
4. View real predictions! 🎉

## 🔧 Troubleshooting

### Error: "Google Maps API key is not configured"

➡️ Add `GOOGLE_MAPS_API_KEY` to `.env`

### Error: "Failed to connect to ML service"

➡️ Start ML service on port 8003

### Error: "Failed to reverse geocode"

➡️ Check Google Maps API key is valid
➡️ Enable Geocoding API in Google Cloud Console

### Error: "Failed to check nearby place"

➡️ Enable Places API in Google Cloud Console

### No alerts showing

➡️ Check MongoDB is running
➡️ Check user is authenticated

## 📝 Important Notes

1. **YOU ARE CORRECT!** - Google Maps API automatically fetches all features
2. **NO manual input needed** - User only provides lat/lon
3. **Works for ANY location** - Not just locations in dataset
4. **recommendationApiUrl removed** - Not your component
5. **Model & Repository added** - Following team's architecture pattern

## 🎓 Example Locations to Test

### Maharagama (Your Example):

```json
{ "latitude": 6.8485, "longitude": 79.9217 }
```

Expected features:

- is_beach: 0 (NO)
- is_tourist_place: 0 (NO)
- is_transit: 1 (YES - bus OR train station)
- is_crowded: 1 (YES - market nearby)
- police_nearby: 1 (YES)

### Colombo (Tourist area):

```json
{ "latitude": 6.9271, "longitude": 79.8612 }
```

Expected features:

- is_beach: 1 (YES - near Galle Face)
- is_transit: 1 (YES - bus/train stations)
- is_crowded: 1 (YES - tourist place + shopping areas1 (YES)
- is_crowded: 1 (YES)

### Galle (Beach city):

```json
{ "latitude": 6.0535, "longitude": 80.221 }
```

Expected features:

- is_beach: 1 (YES)
- is_tourist_place: 1 (YES)

## 📚 Next Steps

1. ✅ Get Google Maps API key
2. ✅ Add to `.env`
3. ✅ Start ML service
4. ✅ Start backend
5. ✅ Test with Postman
6. ✅ Test with frontend
7. ✅ Show to team lead! 🚀

---

**All backend parts created just like your teammates!** ✨

- Model ✅
- Repository ✅
- Service ✅
- Controller ✅
- Routes ✅
- Google Maps Integration ✅
- ML Model Integration ✅

Good luck with your demo! 🎉

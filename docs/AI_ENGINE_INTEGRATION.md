# AI Engine Integration Documentation

Complete documentation for the Node.js backend integration with the Python ML/AI Engine.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Setup & Configuration](#setup--configuration)
3. [API Endpoints Reference](#api-endpoints-reference)
4. [cURL Examples](#curl-examples)
5. [Implementation Details](#implementation-details)
6. [Error Handling](#error-handling)
7. [Testing Guide](#testing-guide)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Application                              │
│                        (Mobile App / Web Frontend)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Node.js Backend (Express + TypeScript)                   │
│                              Port: 3001                                      │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │   Controllers   │  │    Services      │  │      Repositories          │ │
│  │  - AIEngine     │  │  - AIEngine      │  │  - UserPreferences         │ │
│  │  - Preferences  │  │  - Preferences   │  │                            │ │
│  └─────────────────┘  └──────────────────┘  └─────────────────────────────┘ │
│           │                    │                         │                   │
│           ▼                    ▼                         ▼                   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │   Validators    │  │   HTTP Client    │  │        MongoDB              │ │
│  │   (Joi)         │  │   (Axios)        │  │   (User Preferences)        │ │
│  └─────────────────┘  └──────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ HTTP Requests
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Python AI Engine (FastAPI)                               │
│                              Port: 8000                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  Agentic     │  │ Recommend    │  │  CrowdCast   │  │  Event Sentinel  │ │
│  │  Chat        │  │ Engine       │  │  Engine      │  │  Engine          │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐                                         │
│  │ Golden Hour  │  │   Physics    │                                         │
│  │ Engine       │  │   Engine     │                                         │
│  └──────────────┘  └──────────────┘                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Client** sends request to Node.js backend (port 3001)
2. **Node.js backend** validates request using Joi schemas
3. **AIEngineService** forwards request to Python AI Engine (port 8000)
4. **AI Engine** processes request and returns response
5. **Node.js backend** formats response and sends to client

---

## Setup & Configuration

### Prerequisites

- Node.js 18+
- MongoDB instance
- Python AI Engine running on port 8000

### Environment Variables

Add these to your `.env` file:

```env
# AI Engine Configuration
AI_ENGINE_BASE_URL=http://localhost:8000
AI_ENGINE_TIMEOUT=30000
AI_ENGINE_RETRY_ATTEMPTS=3
AI_ENGINE_RETRY_DELAY=1000
```

### Installation

```bash
# Navigate to travion-backend
cd services/travion-backend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Verify Setup

```bash
# Check Node.js backend health
curl http://localhost:3001/api/v1/health

# Check AI Engine health (through Node.js proxy)
curl http://localhost:3001/api/v1/ai/health

# Check AI Engine availability
curl http://localhost:3001/api/v1/ai/status
```

---

## API Endpoints Reference

### Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

To get a token:

```bash
# Register
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123", "name": "Test User"}'

# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

---

## cURL Examples

### AI Engine Endpoints

#### 1. Health Check (Public)

```bash
# Check AI Engine health
curl -X GET http://localhost:3001/api/v1/ai/health

# Response
{
  "success": true,
  "message": "AI Engine health check completed",
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "components": {
      "recommendation_engine": "healthy",
      "crowdcast": "healthy",
      "event_sentinel": "healthy",
      "golden_hour": "healthy"
    }
  }
}
```

#### 2. Check Availability (Public)

```bash
curl -X GET http://localhost:3001/api/v1/ai/status

# Response
{
  "success": true,
  "message": "AI Engine is available",
  "data": {
    "available": true
  }
}
```

#### 3. Agentic Chat (Protected)

```bash
curl -X POST http://localhost:3001/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "message": "What are the best places to visit in Kandy?",
    "threadId": "optional-thread-id",
    "context": {
      "currentLocation": {
        "lat": 7.2906,
        "lng": 80.6337
      },
      "preferences": {
        "history": 0.8,
        "adventure": 0.5,
        "nature": 0.7,
        "relaxation": 0.3
      }
    }
  }'

# Response
{
  "success": true,
  "message": "Chat response generated",
  "data": {
    "response": "Based on your location and preferences, I recommend visiting...",
    "thread_id": "thread-123",
    "tool_calls": [...],
    "reasoning_log": [...]
  }
}
```

#### 4. Get Recommendations (Protected)

```bash
curl -X POST http://localhost:3001/api/v1/ai/recommend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "current_lat": 7.2906,
    "current_lng": 80.6337,
    "preferences": {
      "history": 0.8,
      "adventure": 0.5,
      "nature": 0.7,
      "relaxation": 0.3
    },
    "top_k": 5,
    "max_distance_km": 20,
    "target_datetime": "2025-01-15T10:00:00Z",
    "outdoor_only": false,
    "exclude_locations": ["Temple of the Tooth"]
  }'

# Response
{
  "success": true,
  "message": "Recommendations retrieved",
  "data": {
    "recommendations": [
      {
        "name": "Sigiriya Rock Fortress",
        "score": 0.95,
        "distance_km": 15.2,
        "category": "Historical",
        "reasons": ["High historical value", "Matches your preferences"]
      }
    ],
    "itinerary_slots": [...],
    "constraint_violations": [],
    "reasoning_log": [...]
  }
}
```

#### 5. Get Location Explanation (Protected)

```bash
curl -X GET "http://localhost:3001/api/v1/ai/explain/Sigiriya%20Rock%20Fortress?user_lat=7.2906&user_lng=80.6337" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response
{
  "success": true,
  "message": "Location explanation retrieved",
  "data": {
    "location_name": "Sigiriya Rock Fortress",
    "explanation": "A UNESCO World Heritage Site featuring ancient rock fortress...",
    "category": "Historical",
    "distance_from_user_km": 15.2,
    "recommendation_reasons": [...]
  }
}
```

#### 6. Get Nearby Locations (Protected)

```bash
curl -X GET "http://localhost:3001/api/v1/ai/locations/nearby?lat=7.2906&lng=80.6337&top_k=10&max_distance_km=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response
{
  "success": true,
  "message": "Nearby locations retrieved",
  "data": {
    "locations": [
      {
        "name": "Temple of the Tooth",
        "distance_km": 2.5,
        "category": "Religious",
        "coordinates": { "lat": 7.2936, "lng": 80.6413 }
      }
    ],
    "total_count": 10
  }
}
```

#### 7. Crowd Prediction (Protected)

```bash
curl -X POST http://localhost:3001/api/v1/ai/crowd \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "location_type": "temple",
    "target_datetime": "2025-01-15T10:00:00Z",
    "is_poya": false,
    "is_school_holiday": false
  }'

# Response
{
  "success": true,
  "message": "Crowd prediction retrieved",
  "data": {
    "predicted_crowd_level": "moderate",
    "crowd_score": 0.65,
    "confidence": 0.85,
    "factors": [
      "Weekend effect",
      "Morning hours typically less crowded"
    ],
    "recommendations": [
      "Consider visiting before 10 AM for fewer crowds"
    ]
  }
}
```

#### 8. Event Impact Analysis (Protected)

```bash
curl -X POST http://localhost:3001/api/v1/ai/events/impact \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "location_name": "Temple of the Tooth",
    "target_date": "2025-01-15",
    "activity_type": "sightseeing"
  }'

# Response
{
  "success": true,
  "message": "Event impact analysis retrieved",
  "data": {
    "is_poya_day": false,
    "is_new_year_shutdown": false,
    "predicted_crowd_modifier": 1.2,
    "temporal_context": {
      "day_of_week": "Wednesday",
      "categories": ["Weekday"]
    },
    "travel_advice_strings": [
      "Normal operating hours expected"
    ],
    "active_events": []
  }
}
```

#### 9. Check Holiday (Protected)

```bash
curl -X GET "http://localhost:3001/api/v1/ai/events/check-holiday?location_name=Temple%20of%20the%20Tooth&target_date=2025-01-15" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response
{
  "success": true,
  "message": "Holiday check completed",
  "data": {
    "isPoya": false,
    "isHoliday": false,
    "isNewYearShutdown": false,
    "crowdModifier": 1.0,
    "warnings": []
  }
}
```

#### 10. Golden Hour by Coordinates (Protected)

```bash
curl -X POST http://localhost:3001/api/v1/ai/physics/golden-hour \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "latitude": 7.9570,
    "longitude": 80.7603,
    "date": "2025-01-15",
    "elevation_m": 370,
    "location_name": "Sigiriya",
    "include_current_position": true
  }'

# Response
{
  "success": true,
  "message": "Golden hour data retrieved",
  "data": {
    "location_name": "Sigiriya",
    "date": "2025-01-15",
    "timezone": "Asia/Colombo",
    "morning_golden_hour": {
      "start_local": "06:15",
      "end_local": "06:45",
      "start_utc": "00:45",
      "end_utc": "01:15"
    },
    "evening_golden_hour": {
      "start_local": "17:45",
      "end_local": "18:15",
      "start_utc": "12:15",
      "end_utc": "12:45"
    },
    "sunrise": "06:30",
    "sunset": "18:00",
    "solar_noon": "12:15",
    "day_length_hours": 11.5
  }
}
```

#### 11. Golden Hour by Location Name (Protected)

```bash
curl -X GET "http://localhost:3001/api/v1/ai/physics/golden-hour/Sigiriya?date=2025-01-15&include_current_position=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 12. Sun Position (Protected)

```bash
curl -X GET "http://localhost:3001/api/v1/ai/physics/sun-position?latitude=7.9570&longitude=80.7603&elevation_m=370" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response
{
  "success": true,
  "message": "Sun position retrieved",
  "data": {
    "elevation_deg": 45.2,
    "azimuth_deg": 125.8,
    "is_daylight": true,
    "light_quality": "good",
    "timestamp_utc": "2025-01-15T06:00:00Z"
  }
}
```

#### 13. Light Quality (Protected)

```bash
curl -X GET "http://localhost:3001/api/v1/ai/physics/light-quality?latitude=7.9570&longitude=80.7603" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response
{
  "success": true,
  "message": "Light quality retrieved",
  "data": {
    "quality": "golden",
    "isDaylight": true,
    "elevation": 15.5,
    "azimuth": 95.2
  }
}
```

#### 14. Comprehensive Location Info (Protected)

```bash
curl -X GET "http://localhost:3001/api/v1/ai/location-info/Sigiriya?target_date=2025-01-15&user_lat=7.2906&user_lng=80.6337" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response
{
  "success": true,
  "message": "Location info retrieved",
  "data": {
    "explanation": {...},
    "eventImpact": {...},
    "goldenHour": {...}
  }
}
```

#### 15. Optimal Visit Time (Protected)

```bash
curl -X GET "http://localhost:3001/api/v1/ai/optimal-visit-time/Sigiriya?location_type=historical&target_date=2025-01-15" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response
{
  "success": true,
  "message": "Optimal visit time retrieved",
  "data": {
    "recommendedTime": "06:15",
    "goldenHourMorning": {
      "start": "06:15",
      "end": "06:45"
    },
    "goldenHourEvening": {
      "start": "17:45",
      "end": "18:15"
    },
    "crowdStatus": "LOW",
    "warnings": []
  }
}
```

---

### User Preferences Endpoints

All preferences endpoints require authentication.

#### 1. Get All Preferences

```bash
curl -X GET http://localhost:3001/api/v1/preferences \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response
{
  "success": true,
  "message": "Preferences retrieved",
  "data": {
    "userId": "...",
    "preferenceScores": {
      "history": 0.5,
      "adventure": 0.5,
      "nature": 0.5,
      "relaxation": 0.5
    },
    "travelStyle": {
      "pacePreference": "moderate",
      "budgetRange": "mid-range",
      "groupSize": "couple"
    },
    "savedLocations": [],
    "searchHistory": [],
    "favoriteCategories": [],
    "avoidCategories": [],
    "visitedLocations": []
  }
}
```

#### 2. Get Preference Scores

```bash
curl -X GET http://localhost:3001/api/v1/preferences/scores \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response
{
  "success": true,
  "message": "Preference scores retrieved",
  "data": {
    "history": 0.8,
    "adventure": 0.5,
    "nature": 0.7,
    "relaxation": 0.3
  }
}
```

#### 3. Update Preference Scores

```bash
curl -X PATCH http://localhost:3001/api/v1/preferences/scores \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "history": 0.9,
    "adventure": 0.6,
    "nature": 0.8,
    "relaxation": 0.4
  }'
```

#### 4. Update Travel Style

```bash
curl -X PATCH http://localhost:3001/api/v1/preferences/travel-style \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "pacePreference": "slow",
    "budgetRange": "luxury",
    "groupSize": "couple",
    "accessibility": false,
    "dietaryRestrictions": ["vegetarian"],
    "transportationPreferences": ["private-car", "train"],
    "accommodationType": "resort"
  }'
```

#### 5. Save a Location

```bash
curl -X POST http://localhost:3001/api/v1/preferences/saved-locations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "locationId": "sigiriya-001",
    "name": "Sigiriya Rock Fortress",
    "latitude": 7.9570,
    "longitude": 80.7603,
    "category": "Historical",
    "notes": "Must visit during golden hour"
  }'
```

#### 6. Get Saved Locations

```bash
curl -X GET http://localhost:3001/api/v1/preferences/saved-locations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 7. Remove Saved Location

```bash
curl -X DELETE http://localhost:3001/api/v1/preferences/saved-locations/sigiriya-001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 8. Check if Location is Saved

```bash
curl -X GET http://localhost:3001/api/v1/preferences/saved-locations/sigiriya-001/check \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response
{
  "success": true,
  "message": "Location save status checked",
  "data": {
    "isSaved": true
  }
}
```

#### 9. Update Location Notes

```bash
curl -X PATCH http://localhost:3001/api/v1/preferences/saved-locations/sigiriya-001/notes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "notes": "Visited on Jan 15, amazing sunrise views!"
  }'
```

#### 10. Add Search History

```bash
curl -X POST http://localhost:3001/api/v1/preferences/search-history \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "temples in Kandy",
    "resultCount": 15,
    "selectedLocationId": "tooth-temple-001",
    "selectedLocationName": "Temple of the Tooth"
  }'
```

#### 11. Get Search History

```bash
curl -X GET "http://localhost:3001/api/v1/preferences/search-history?limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 12. Clear Search History

```bash
curl -X DELETE http://localhost:3001/api/v1/preferences/search-history \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 13. Update Categories

```bash
curl -X PATCH http://localhost:3001/api/v1/preferences/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "favoriteCategories": ["Historical", "Nature", "Beach"],
    "avoidCategories": ["Nightlife", "Shopping"]
  }'
```

#### 14. Add Favorite Category

```bash
curl -X POST http://localhost:3001/api/v1/preferences/categories/favorite/Wildlife \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 15. Remove Favorite Category

```bash
curl -X DELETE http://localhost:3001/api/v1/preferences/categories/favorite/Wildlife \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 16. Mark Location as Visited

```bash
curl -X POST http://localhost:3001/api/v1/preferences/visited-locations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "locationId": "sigiriya-001"
  }'
```

#### 17. Get Visited Locations

```bash
curl -X GET http://localhost:3001/api/v1/preferences/visited-locations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 18. Unmark Location as Visited

```bash
curl -X DELETE http://localhost:3001/api/v1/preferences/visited-locations/sigiriya-001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 19. Update Home Location

```bash
curl -X PUT http://localhost:3001/api/v1/preferences/home-location \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "latitude": 6.9271,
    "longitude": 79.8612,
    "city": "Colombo",
    "country": "Sri Lanka"
  }'
```

#### 20. Update Notification Preferences

```bash
curl -X PATCH http://localhost:3001/api/v1/preferences/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "goldenHourAlerts": true,
    "crowdAlerts": true,
    "eventAlerts": true,
    "poyaDayReminders": true
  }'
```

#### 21. Delete All Preferences

```bash
curl -X DELETE http://localhost:3001/api/v1/preferences \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Implementation Details

### File Structure

```
src/
├── config/
│   └── aiEngine.ts              # AI Engine configuration
├── types/
│   ├── aiEngine.ts              # TypeScript interfaces
│   └── index.ts                 # Types barrel export
├── utils/
│   ├── httpClient.ts            # Axios HTTP client with retry
│   └── index.ts                 # Utils barrel export
├── models/
│   └── UserPreferences.ts       # MongoDB schema
├── repositories/
│   └── UserPreferencesRepository.ts  # Data access layer
├── services/
│   ├── AIEngineService.ts       # AI Engine API client
│   └── UserPreferencesService.ts    # Business logic
├── validators/
│   ├── aiEngineValidator.ts     # Joi validation schemas
│   ├── userPreferencesValidator.ts  # Preferences validation
│   └── index.ts                 # Validators barrel export
├── controllers/
│   ├── AIEngineController.ts    # HTTP handlers for AI
│   └── UserPreferencesController.ts  # HTTP handlers for prefs
└── routes/
    ├── aiEngineRoutes.ts        # AI Engine routes
    ├── userPreferencesRoutes.ts # Preferences routes
    └── index.ts                 # Routes registration
```

### Service Layer Pattern

```typescript
// AIEngineService.ts - Communicates with Python AI Engine
class AIEngineService {
  async chat(message, threadId, context) {
    return await httpClient.post('/api/v1/chat', { message, thread_id: threadId });
  }

  async getRecommendations(request) {
    return await httpClient.post('/api/v1/recommend', request);
  }

  // ... more methods
}

// UserPreferencesService.ts - Manages user preferences
class UserPreferencesService {
  async getPreferences(userId) {
    return await this.repository.findOrCreate(userId);
  }

  async updatePreferenceScores(userId, scores) {
    // Validate scores are 0-1
    return await this.repository.updatePreferenceScores(userId, scores);
  }

  // ... more methods
}
```

### HTTP Client with Retry Logic

```typescript
// httpClient.ts
class HttpClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.AI_ENGINE_BASE_URL,
      timeout: parseInt(process.env.AI_ENGINE_TIMEOUT || '30000'),
    });

    // Add retry logic with exponential backoff
    this.setupInterceptors();
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.client.post(url, data);
    return response.data;
  }
}
```

### MongoDB User Preferences Schema

```typescript
// UserPreferences.ts
const UserPreferencesSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

  preferenceScores: {
    history: { type: Number, default: 0.5, min: 0, max: 1 },
    adventure: { type: Number, default: 0.5, min: 0, max: 1 },
    nature: { type: Number, default: 0.5, min: 0, max: 1 },
    relaxation: { type: Number, default: 0.5, min: 0, max: 1 },
  },

  travelStyle: {
    pacePreference: { type: String, enum: ['slow', 'moderate', 'fast'] },
    budgetRange: { type: String, enum: ['budget', 'mid-range', 'luxury'] },
    groupSize: { type: String, enum: ['solo', 'couple', 'small-group', 'large-group'] },
    accessibility: { type: Boolean, default: false },
    dietaryRestrictions: [String],
    transportationPreferences: [String],
    accommodationType: { type: String, enum: ['hotel', 'hostel', 'resort', 'homestay', 'any'] },
  },

  savedLocations: [{
    locationId: String,
    name: String,
    latitude: Number,
    longitude: Number,
    category: String,
    savedAt: Date,
    notes: String,
  }],

  searchHistory: [{
    query: String,
    timestamp: Date,
    resultCount: Number,
    selectedLocationId: String,
    selectedLocationName: String,
  }],

  favoriteCategories: [String],
  avoidCategories: [String],
  visitedLocations: [String],

  homeLocation: {
    latitude: Number,
    longitude: Number,
    city: String,
    country: String,
  },

  notificationPreferences: {
    goldenHourAlerts: { type: Boolean, default: true },
    crowdAlerts: { type: Boolean, default: true },
    eventAlerts: { type: Boolean, default: true },
    poyaDayReminders: { type: Boolean, default: true },
  },
});
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Additional details"
  }
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid request data |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource already exists |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | AI Engine unavailable |
| 504 | GATEWAY_TIMEOUT | AI Engine timeout |

### AI Engine Error Handling

```typescript
// AIEngineService handles errors from Python backend
private handleError(error: unknown, operation: string): never {
  if (axiosError.code === 'ECONNREFUSED') {
    throw new AppError('AI Engine service is unavailable', 503);
  }

  if (axiosError.code === 'ETIMEDOUT') {
    throw new AppError('AI Engine request timed out', 504);
  }

  throw new AppError(error.message || `AI Engine ${operation} failed`, 500);
}
```

---

## Testing Guide

### Manual Testing with cURL

```bash
# 1. Start AI Engine (Python)
cd services/ml-services/ai-agent-engine
python -m uvicorn src.main:app --reload --port 8000

# 2. Start Node.js Backend
cd services/travion-backend
npm run dev

# 3. Test Health Endpoints
curl http://localhost:3001/api/v1/health
curl http://localhost:3001/api/v1/ai/health

# 4. Get Auth Token
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' \
  | jq -r '.data.token')

# 5. Test Protected Endpoints
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/preferences

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/v1/ai/locations/nearby?lat=7.29&lng=80.63"
```

### Integration Test Script

```bash
#!/bin/bash
# test-integration.sh

BASE_URL="http://localhost:3001/api/v1"

echo "=== Testing AI Engine Integration ==="

# Health checks
echo -e "\n1. Testing Health Endpoints..."
curl -s "$BASE_URL/health" | jq '.success'
curl -s "$BASE_URL/ai/health" | jq '.success'
curl -s "$BASE_URL/ai/status" | jq '.data.available'

# Get auth token
echo -e "\n2. Getting Auth Token..."
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123"}' \
  | jq -r '.data.token')

if [ "$TOKEN" == "null" ]; then
  echo "Creating test user..."
  curl -s -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com", "password": "test123", "name": "Test"}'

  TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com", "password": "test123"}' \
    | jq -r '.data.token')
fi

echo "Token: ${TOKEN:0:20}..."

# Test AI endpoints
echo -e "\n3. Testing AI Endpoints..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/ai/locations/nearby?lat=7.29&lng=80.63&top_k=3" | jq '.success'

# Test Preferences
echo -e "\n4. Testing Preferences..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/preferences" | jq '.success'

curl -s -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"history": 0.9}' \
  "$BASE_URL/preferences/scores" | jq '.success'

echo -e "\n=== All Tests Complete ==="
```

---

## Troubleshooting

### AI Engine Connection Issues

```bash
# Check if AI Engine is running
curl http://localhost:8000/api/v1/health

# Check Node.js can reach AI Engine
curl http://localhost:3001/api/v1/ai/status

# Check environment variables
cat .env | grep AI_ENGINE
```

### Common Issues

1. **503 Service Unavailable**: AI Engine not running
   - Start Python AI Engine: `uvicorn src.main:app --port 8000`

2. **504 Gateway Timeout**: AI Engine slow response
   - Increase `AI_ENGINE_TIMEOUT` in `.env`

3. **401 Unauthorized**: Invalid/missing JWT token
   - Login to get fresh token
   - Check token format: `Bearer <token>`

4. **400 Validation Error**: Invalid request data
   - Check request body matches schema
   - Coordinates must be in Sri Lanka bounds (lat: 5-10, lng: 79-82)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-15 | Initial implementation |

---

## Support

For issues or questions:
- Check the [Travion Complete Guide](../../ml-services/ai-agent-engine/docs/TRAVION_COMPLETE_GUIDE.md)
- Review AI Engine documentation in `services/ml-services/ai-agent-engine/docs/`

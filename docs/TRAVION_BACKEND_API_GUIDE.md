# Travion Backend - Complete API Guide

## Overview

Travion Backend is a Node.js/Express.js REST API that serves as the gateway for the Travion AI Tour Guide application. It integrates with a Python-based AI Engine to provide intelligent travel recommendations, chat-based trip planning, and personalized user experiences for Sri Lanka tourism.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Getting Started](#3-getting-started)
4. [AI Engine Integration](#4-ai-engine-integration)
5. [Authentication](#5-authentication)
6. [API Reference](#6-api-reference)
   - [Auth Endpoints](#61-auth-endpoints)
   - [User Endpoints](#62-user-endpoints)
   - [Preferences Endpoints](#63-preferences-endpoints)
   - [Trip Endpoints](#64-trip-endpoints)
   - [Chat Endpoints](#65-chat-endpoints)
   - [AI Engine Endpoints](#66-ai-engine-endpoints)
7. [Data Models](#7-data-models)
8. [Error Handling](#8-error-handling)
9. [Testing Guide](#9-testing-guide)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TRAVION SYSTEM ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐         ┌─────────────────────────────────────────────┐ │
│   │  Mobile App  │         │           TRAVION BACKEND                    │ │
│   │  (Flutter)   │         │           (Node.js + Express)                │ │
│   └──────┬───────┘         │           Port: 3001                         │ │
│          │                 │                                              │ │
│   ┌──────┴───────┐         │  ┌────────────────────────────────────────┐ │ │
│   │   Web App    │   HTTP  │  │              API Layer                  │ │ │
│   │   (React)    │─────────│  │  ┌──────────────────────────────────┐  │ │ │
│   └──────────────┘         │  │  │  /auth    - Authentication       │  │ │ │
│                            │  │  │  /users   - User Management      │  │ │ │
│                            │  │  │  /preferences - User Prefs       │  │ │ │
│                            │  │  │  /trips   - Trip Management      │  │ │ │
│                            │  │  │  /chat    - Chat Sessions        │  │ │ │
│                            │  │  │  /ai      - AI Engine Proxy      │  │ │ │
│                            │  │  └──────────────────────────────────┘  │ │ │
│                            │  └────────────────────────────────────────┘ │ │
│                            │                       │                      │ │
│                            │  ┌────────────────────┴───────────────────┐ │ │
│                            │  │           Service Layer                 │ │ │
│                            │  │  ┌─────────┐ ┌─────────┐ ┌───────────┐ │ │ │
│                            │  │  │  Auth   │ │  User   │ │   Trip    │ │ │ │
│                            │  │  │ Service │ │ Service │ │  Service  │ │ │ │
│                            │  │  └─────────┘ └─────────┘ └───────────┘ │ │ │
│                            │  │  ┌─────────┐ ┌─────────┐ ┌───────────┐ │ │ │
│                            │  │  │  Chat   │ │  Prefs  │ │ AIEngine  │ │ │ │
│                            │  │  │ Service │ │ Service │ │  Service  │ │ │ │
│                            │  │  └─────────┘ └─────────┘ └─────┬─────┘ │ │ │
│                            │  └────────────────────────────────┼───────┘ │ │
│                            │                                   │         │ │
│                            └───────────────────────────────────┼─────────┘ │
│                                                                │           │
│   ┌────────────────────────┐                                   │           │
│   │      MongoDB Atlas     │◄──────────────────────────────────┤           │
│   │  ┌──────────────────┐  │                                   │           │
│   │  │ Users            │  │                                   │           │
│   │  │ UserPreferences  │  │                                   │           │
│   │  │ SavedTrips       │  │                                   │           │
│   │  │ ChatSessions     │  │                                   ▼           │
│   │  └──────────────────┘  │         ┌─────────────────────────────────┐  │
│   └────────────────────────┘         │         AI ENGINE               │  │
│                                      │     (Python + FastAPI)          │  │
│                                      │         Port: 8001              │  │
│                                      │                                 │  │
│                                      │  ┌───────────────────────────┐  │  │
│                                      │  │ 7 Pillars of Intelligence │  │  │
│                                      │  │ ├── LangGraph Agent       │  │  │
│                                      │  │ ├── CrowdCast ML          │  │  │
│                                      │  │ ├── Event Sentinel        │  │  │
│                                      │  │ ├── Golden Hour Engine    │  │  │
│                                      │  │ ├── Recommendation Engine │  │  │
│                                      │  │ └── ChromaDB Vector Store │  │  │
│                                      │  └───────────────────────────┘  │  │
│                                      └─────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
1. Client Request → Travion Backend (Node.js)
2. Authentication Middleware (JWT Validation)
3. Request Validation (Joi Schemas)
4. Controller → Service → Repository → MongoDB
5. For AI features: Service → AI Engine (Python) → Response
6. Response back to Client
```

---

## 2. Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 18.x+ |
| Framework | Express.js | 4.18.x |
| Language | TypeScript | 5.x |
| Database | MongoDB Atlas | 7.x |
| ODM | Mongoose | 8.x |
| Authentication | JWT | jsonwebtoken 9.x |
| Validation | Joi | 17.x |
| HTTP Client | Axios | 1.6.x |
| Logging | Winston | 3.x |
| Security | Helmet, CORS, HPP | Latest |

---

## 3. Getting Started

### Prerequisites

- Node.js 18.x or higher
- MongoDB Atlas account
- AI Engine running on port 8001

### Installation

```bash
# Navigate to travion-backend
cd services/travion-backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Configure environment variables (see below)
nano .env

# Start development server
npm run dev

# Start production server
npm start
```

### Environment Variables

```env
# Application
NODE_ENV=development
PORT=3001
API_VERSION=v1

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/travion
DATABASE_NAME=travion

# JWT
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# AI Engine
AI_ENGINE_BASE_URL=http://localhost:8001
AI_ENGINE_TIMEOUT=30000
AI_ENGINE_RETRY_ATTEMPTS=3

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:8080

# Logging
LOG_LEVEL=debug
```

### Verify Installation

```bash
# Check health endpoint
curl http://localhost:3001/api/v1/health
```

Expected Response:
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 4. AI Engine Integration

### How It Works

The Travion Backend acts as a gateway to the AI Engine, providing:

1. **Authentication Layer** - All AI requests require valid JWT tokens
2. **User Context Injection** - User preferences are automatically included in requests
3. **Response Caching** - Frequently accessed data is cached
4. **Error Handling** - AI Engine errors are gracefully handled

### AI Engine Service

```typescript
// Location: src/services/AIEngineService.ts

// The AIEngineService wraps all AI Engine endpoints with:
// - Retry logic for failed requests
// - Timeout handling
// - Error transformation
// - Request/response logging

// Example: Getting recommendations with user preferences
const recommendations = await aiEngineService.getRecommendations({
  current_lat: 7.2906,
  current_lng: 80.6337,
  preferences: userPreferences.preferenceScores,
  top_k: 5
});
```

### Communication Pattern

```
┌──────────────┐     ┌───────────────────┐     ┌─────────────────┐
│    Client    │     │  Travion Backend  │     │   AI Engine     │
│              │     │                   │     │                 │
│  POST /chat  │────▶│  1. Validate JWT  │     │                 │
│              │     │  2. Get User Prefs │     │                 │
│              │     │  3. Forward to AI ├────▶│  4. Process     │
│              │     │                   │     │  5. LangGraph   │
│              │     │                   │◀────┤  6. Response    │
│              │◀────┤  7. Save History  │     │                 │
│              │     │  8. Return        │     │                 │
└──────────────┘     └───────────────────┘     └─────────────────┘
```

---

## 5. Authentication

### JWT Token Strategy

- **Access Token**: Valid for 7 days, used for API requests
- **Refresh Token**: Valid for 30 days, used to get new access tokens
- **Storage**: HTTP-only cookies (web) + Response body (mobile)

### Authentication Flow

```
1. Register/Login → Get access_token + refresh_token
2. Include token in requests: Authorization: Bearer <access_token>
3. When expired: POST /auth/refresh with refresh_token
4. Logout: POST /auth/logout (revokes tokens)
```

---

## 6. API Reference

### Base URL
```
http://localhost:3001/api/v1
```

### Request Headers
```
Content-Type: application/json
Authorization: Bearer <access_token>  (for protected routes)
```

---

### 6.1 Auth Endpoints

#### Register User
```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "userName": "johndoe_abc123",
      "isActive": true,
      "profileStatus": "Incomplete",
      "provider": "local",
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Login
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Refresh Token
```bash
curl -X POST http://localhost:3001/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

#### Get Profile
```bash
curl -X GET http://localhost:3001/api/v1/auth/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Logout
```bash
curl -X POST http://localhost:3001/api/v1/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 6.2 User Endpoints

#### Get User Profile
```bash
curl -X GET http://localhost:3001/api/v1/users/profile \
  -H "Authorization: Bearer <token>"
```

#### Update User Profile
```bash
curl -X PUT http://localhost:3001/api/v1/users/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "gender": "Male",
    "dob": "1990-05-15",
    "country": "Sri Lanka",
    "preferredLanguage": "en"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "user": {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Smith",
      "gender": "Male",
      "dob": "1990-05-15T00:00:00.000Z",
      "country": "Sri Lanka",
      "preferredLanguage": "en",
      "profileStatus": "Complete"
    }
  }
}
```

---

### 6.3 Preferences Endpoints

#### Get User Preferences
```bash
curl -X GET http://localhost:3001/api/v1/preferences \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "preferences": {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k2",
      "userId": "65a1b2c3d4e5f6g7h8i9j0k1",
      "preferenceScores": {
        "history": 0.7,
        "adventure": 0.5,
        "nature": 0.8,
        "relaxation": 0.6
      },
      "travelStyle": {
        "pacePreference": "moderate",
        "budgetRange": "mid-range",
        "groupSize": "couple",
        "accessibility": false,
        "dietaryRestrictions": ["vegetarian"],
        "accommodationType": "hotel"
      },
      "savedLocations": [],
      "favoriteCategories": ["temples", "nature", "beaches"],
      "avoidCategories": ["nightlife"],
      "notificationPreferences": {
        "goldenHourAlerts": true,
        "crowdAlerts": true,
        "eventAlerts": true,
        "poyaDayReminders": true
      }
    }
  }
}
```

#### Update Preference Scores
```bash
curl -X PATCH http://localhost:3001/api/v1/preferences/scores \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "history": 0.8,
    "adventure": 0.6,
    "nature": 0.9,
    "relaxation": 0.4
  }'
```

#### Update Travel Style
```bash
curl -X PATCH http://localhost:3001/api/v1/preferences/travel-style \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "pacePreference": "fast",
    "budgetRange": "luxury",
    "groupSize": "couple",
    "accessibility": false,
    "dietaryRestrictions": ["vegetarian", "gluten-free"],
    "transportationPreferences": ["car", "train"],
    "accommodationType": "resort"
  }'
```

#### Save Location
```bash
curl -X POST http://localhost:3001/api/v1/preferences/saved-locations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "sigiriya_001",
    "name": "Sigiriya Rock Fortress",
    "latitude": 7.9570,
    "longitude": 80.7603,
    "category": "heritage",
    "notes": "Must visit for sunrise"
  }'
```

#### Get Saved Locations
```bash
curl -X GET http://localhost:3001/api/v1/preferences/saved-locations \
  -H "Authorization: Bearer <token>"
```

#### Remove Saved Location
```bash
curl -X DELETE http://localhost:3001/api/v1/preferences/saved-locations/sigiriya_001 \
  -H "Authorization: Bearer <token>"
```

#### Update Home Location
```bash
curl -X PUT http://localhost:3001/api/v1/preferences/home-location \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 6.9271,
    "longitude": 79.8612,
    "city": "Colombo",
    "country": "Sri Lanka"
  }'
```

#### Update Notification Preferences
```bash
curl -X PATCH http://localhost:3001/api/v1/preferences/notifications \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "goldenHourAlerts": true,
    "crowdAlerts": true,
    "eventAlerts": false,
    "poyaDayReminders": true
  }'
```

---

### 6.4 Trip Endpoints

#### Create Trip
```bash
curl -X POST http://localhost:3001/api/v1/trips \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cultural Triangle Adventure",
    "description": "Exploring ancient cities of Sri Lanka",
    "startDate": "2024-03-15",
    "endDate": "2024-03-20",
    "destinations": ["Sigiriya", "Polonnaruwa", "Anuradhapura"],
    "travelersCount": 2,
    "tags": ["culture", "history", "photography"],
    "estimatedBudget": {
      "currency": "USD",
      "amount": 500
    },
    "itinerary": [
      {
        "order": 0,
        "time": "06:00",
        "locationName": "Sigiriya Rock Fortress",
        "latitude": 7.9570,
        "longitude": 80.7603,
        "activity": "Climb Sigiriya for sunrise",
        "durationMinutes": 180,
        "notes": "Bring water, wear comfortable shoes",
        "crowdPrediction": 35,
        "lightingQuality": "golden"
      },
      {
        "order": 1,
        "time": "10:00",
        "locationName": "Pidurangala Rock",
        "latitude": 7.9667,
        "longitude": 80.7544,
        "activity": "Hike for panoramic views",
        "durationMinutes": 120,
        "crowdPrediction": 20
      }
    ]
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Trip created successfully",
  "data": {
    "trip": {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k3",
      "userId": "65a1b2c3d4e5f6g7h8i9j0k1",
      "title": "Cultural Triangle Adventure",
      "status": "draft",
      "totalDays": 6,
      "generatedBy": "user",
      "isPublic": false,
      "itinerary": [...],
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

#### Get All Trips
```bash
curl -X GET "http://localhost:3001/api/v1/trips?page=1&limit=10&status=planned" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "trips": [...],
    "total": 15,
    "pages": 2,
    "page": 1
  }
}
```

#### Get Trip by ID
```bash
curl -X GET http://localhost:3001/api/v1/trips/65a1b2c3d4e5f6g7h8i9j0k3 \
  -H "Authorization: Bearer <token>"
```

#### Update Trip
```bash
curl -X PUT http://localhost:3001/api/v1/trips/65a1b2c3d4e5f6g7h8i9j0k3 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cultural Triangle Extended",
    "description": "Updated description",
    "endDate": "2024-03-22"
  }'
```

#### Update Trip Status
```bash
curl -X PATCH http://localhost:3001/api/v1/trips/65a1b2c3d4e5f6g7h8i9j0k3/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "planned"
  }'
```

**Valid Status Values:** `draft`, `planned`, `ongoing`, `completed`, `cancelled`

#### Delete Trip
```bash
curl -X DELETE http://localhost:3001/api/v1/trips/65a1b2c3d4e5f6g7h8i9j0k3 \
  -H "Authorization: Bearer <token>"
```

#### Add Itinerary Item
```bash
curl -X POST http://localhost:3001/api/v1/trips/65a1b2c3d4e5f6g7h8i9j0k3/itinerary \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "time": "14:00",
    "locationName": "Dambulla Cave Temple",
    "latitude": 7.8568,
    "longitude": 80.6490,
    "activity": "Explore the cave temples",
    "durationMinutes": 90,
    "lightingQuality": "good"
  }'
```

#### Update Itinerary Item
```bash
curl -X PUT http://localhost:3001/api/v1/trips/65a1b2c3d4e5f6g7h8i9j0k3/itinerary/0 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "time": "05:30",
    "notes": "Earlier start for better lighting"
  }'
```

#### Remove Itinerary Item
```bash
curl -X DELETE http://localhost:3001/api/v1/trips/65a1b2c3d4e5f6g7h8i9j0k3/itinerary/2 \
  -H "Authorization: Bearer <token>"
```

#### Reorder Itinerary
```bash
curl -X PATCH http://localhost:3001/api/v1/trips/65a1b2c3d4e5f6g7h8i9j0k3/itinerary/reorder \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "newOrder": [2, 0, 1, 3]
  }'
```

#### Toggle Trip Visibility
```bash
curl -X PATCH http://localhost:3001/api/v1/trips/65a1b2c3d4e5f6g7h8i9j0k3/visibility \
  -H "Authorization: Bearer <token>"
```

#### Duplicate Trip
```bash
curl -X POST http://localhost:3001/api/v1/trips/65a1b2c3d4e5f6g7h8i9j0k3/duplicate \
  -H "Authorization: Bearer <token>"
```

#### Add Rating
```bash
curl -X POST http://localhost:3001/api/v1/trips/65a1b2c3d4e5f6g7h8i9j0k3/rating \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "review": "Amazing trip! The AI recommendations were spot on."
  }'
```

#### Get Upcoming Trips
```bash
curl -X GET http://localhost:3001/api/v1/trips/upcoming \
  -H "Authorization: Bearer <token>"
```

#### Search Trips
```bash
curl -X GET "http://localhost:3001/api/v1/trips/search?q=sigiriya&limit=5" \
  -H "Authorization: Bearer <token>"
```

#### Get Public Trips (No Auth Required)
```bash
curl -X GET "http://localhost:3001/api/v1/trips/public?page=1&limit=20"
```

---

### 6.5 Chat Endpoints

#### Quick Chat (Auto-creates session)
```bash
curl -X POST http://localhost:3001/api/v1/chat/quick \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Plan a 3-day trip to Ella with hiking and scenic views",
    "context": {
      "currentLocation": {
        "latitude": 6.9271,
        "longitude": 79.8612
      },
      "targetDate": "2024-03-01"
    }
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "sessionId": "chat_lxyz123_abc456",
    "response": "I'd love to help you plan a 3-day trip to Ella! Here's what I recommend...",
    "intent": "trip_planning",
    "itinerary": [
      {
        "time": "06:00",
        "location": "Little Adam's Peak",
        "activity": "Sunrise hike",
        "duration_minutes": 120,
        "crowd_prediction": 25,
        "lighting_quality": "golden"
      }
    ],
    "constraints": [
      {
        "constraint_type": "weather",
        "description": "March is dry season - ideal for hiking",
        "severity": "low"
      }
    ],
    "metadata": {
      "reasoning_loops": 2,
      "documents_retrieved": 5,
      "web_search_used": false
    },
    "messageCount": 2
  }
}
```

#### Create Chat Session
```bash
curl -X POST http://localhost:3001/api/v1/chat/sessions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Ella Trip Planning",
    "context": {
      "preferences": {
        "history": 0.5,
        "adventure": 0.8,
        "nature": 0.9,
        "relaxation": 0.6
      }
    }
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Chat session created",
  "data": {
    "session": {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k4",
      "userId": "65a1b2c3d4e5f6g7h8i9j0k1",
      "sessionId": "chat_lxyz123_def789",
      "title": "Ella Trip Planning",
      "status": "active",
      "messageCount": 0,
      "context": {...}
    }
  }
}
```

#### Get All Sessions
```bash
curl -X GET "http://localhost:3001/api/v1/chat/sessions?page=1&limit=20&status=active" \
  -H "Authorization: Bearer <token>"
```

#### Get Session by ID
```bash
curl -X GET http://localhost:3001/api/v1/chat/sessions/chat_lxyz123_def789 \
  -H "Authorization: Bearer <token>"
```

#### Send Message
```bash
curl -X POST http://localhost:3001/api/v1/chat/sessions/chat_lxyz123_def789/messages \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What about accommodation options near Nine Arch Bridge?",
    "context": {
      "currentLocation": {
        "latitude": 6.8667,
        "longitude": 81.0667
      }
    }
  }'
```

#### Get Chat History
```bash
curl -X GET "http://localhost:3001/api/v1/chat/sessions/chat_lxyz123_def789/messages?limit=50&offset=0" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "role": "user",
        "content": "Plan a 3-day trip to Ella",
        "timestamp": "2024-01-15T10:30:00.000Z"
      },
      {
        "role": "assistant",
        "content": "I'd love to help you plan...",
        "timestamp": "2024-01-15T10:30:05.000Z",
        "metadata": {
          "intent": "trip_planning",
          "reasoningLoops": 2,
          "documentsRetrieved": 5
        }
      }
    ]
  }
}
```

#### Close Session
```bash
curl -X POST http://localhost:3001/api/v1/chat/sessions/chat_lxyz123_def789/close \
  -H "Authorization: Bearer <token>"
```

#### Archive Session
```bash
curl -X POST http://localhost:3001/api/v1/chat/sessions/chat_lxyz123_def789/archive \
  -H "Authorization: Bearer <token>"
```

#### Reopen Session
```bash
curl -X POST http://localhost:3001/api/v1/chat/sessions/chat_lxyz123_def789/reopen \
  -H "Authorization: Bearer <token>"
```

#### Update Session Context
```bash
curl -X PATCH http://localhost:3001/api/v1/chat/sessions/chat_lxyz123_def789/context \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentLocation": {
      "latitude": 6.8667,
      "longitude": 81.0667
    },
    "targetDate": "2024-03-15"
  }'
```

#### Set Location
```bash
curl -X PATCH http://localhost:3001/api/v1/chat/sessions/chat_lxyz123_def789/location \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 6.8667,
    "longitude": 81.0667
  }'
```

#### Update Session Title
```bash
curl -X PATCH http://localhost:3001/api/v1/chat/sessions/chat_lxyz123_def789/title \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Ella Adventure Planning"
  }'
```

#### Link Session to Trip
```bash
curl -X POST http://localhost:3001/api/v1/chat/sessions/chat_lxyz123_def789/link-trip \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tripId": "65a1b2c3d4e5f6g7h8i9j0k3"
  }'
```

#### Unlink Session from Trip
```bash
curl -X DELETE http://localhost:3001/api/v1/chat/sessions/chat_lxyz123_def789/link-trip \
  -H "Authorization: Bearer <token>"
```

#### Get Recent Sessions
```bash
curl -X GET "http://localhost:3001/api/v1/chat/sessions/recent?limit=5" \
  -H "Authorization: Bearer <token>"
```

#### Search Sessions
```bash
curl -X GET "http://localhost:3001/api/v1/chat/sessions/search?q=ella&limit=10" \
  -H "Authorization: Bearer <token>"
```

#### Delete Session
```bash
curl -X DELETE http://localhost:3001/api/v1/chat/sessions/chat_lxyz123_def789 \
  -H "Authorization: Bearer <token>"
```

---

### 6.6 AI Engine Endpoints

These endpoints proxy requests to the AI Engine with user authentication and preference injection.

#### Chat with AI (Direct)
```bash
curl -X POST http://localhost:3001/api/v1/ai/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the best beaches near Galle?",
    "threadId": "thread_abc123"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "query": "What are the best beaches near Galle?",
    "intent": "tourism_query",
    "response": "Near Galle, I recommend these beautiful beaches...",
    "itinerary": null,
    "constraints": [],
    "reasoning_logs": [
      {
        "timestamp": "2024-01-15T10:30:01.000Z",
        "check_type": "crowd_check",
        "result": "pass",
        "details": "Low crowd expected"
      }
    ],
    "metadata": {
      "reasoning_loops": 1,
      "documents_retrieved": 8,
      "web_search_used": false
    }
  }
}
```

#### Get Recommendations
```bash
curl -X POST http://localhost:3001/api/v1/ai/recommend \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "current_lat": 7.2906,
    "current_lng": 80.6337,
    "top_k": 5,
    "max_distance_km": 50,
    "target_datetime": "2024-03-15T10:00:00",
    "outdoor_only": true
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "recommendations": [
      {
        "rank": 1,
        "name": "Sigiriya Rock Fortress",
        "latitude": 7.9570,
        "longitude": 80.7603,
        "similarity_score": 0.92,
        "distance_km": 45.2,
        "combined_score": 0.87,
        "preference_scores": {
          "history": 0.95,
          "adventure": 0.7,
          "nature": 0.8,
          "relaxation": 0.3
        },
        "is_outdoor": true,
        "constraint_checks": [
          {
            "constraint_type": "crowd",
            "status": "ok",
            "value": 35,
            "message": "Moderate crowd expected"
          }
        ],
        "reasoning": "Highly recommended based on your interest in history",
        "optimal_visit_time": "06:00-09:00"
      }
    ],
    "metadata": {
      "candidates_evaluated": 150,
      "processing_time_ms": 245
    }
  }
}
```

#### Get Location Explanation
```bash
curl -X GET "http://localhost:3001/api/v1/ai/explain/Sigiriya?user_lat=7.2906&user_lng=80.6337" \
  -H "Authorization: Bearer <token>"
```

#### Get Nearby Locations
```bash
curl -X GET "http://localhost:3001/api/v1/ai/locations/nearby?lat=7.2906&lng=80.6337&top_k=10&max_distance_km=30" \
  -H "Authorization: Bearer <token>"
```

#### Get Crowd Prediction
```bash
curl -X POST http://localhost:3001/api/v1/ai/crowd \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "location_type": "Heritage",
    "target_datetime": "2024-03-15T10:00:00",
    "is_poya": false,
    "is_school_holiday": false
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "location": "Heritage",
    "datetime": "2024-03-15T10:00:00",
    "crowd_level": 0.45,
    "crowd_percentage": 45,
    "crowd_status": "MODERATE",
    "recommendation": "Good time to visit, moderate crowds expected",
    "optimal_times": [
      {
        "time_range": "06:00-08:00",
        "crowd_level": "LOW",
        "confidence": 0.85
      }
    ]
  }
}
```

#### Get Event Impact
```bash
curl -X POST http://localhost:3001/api/v1/ai/events/impact \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "location_name": "Temple of the Tooth",
    "target_date": "2024-05-23",
    "activity_type": "temple_visit"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "is_legal_conflict": false,
    "predicted_crowd_modifier": 2.5,
    "travel_advice_strings": [
      "Vesak Poya Day - Expect 2.5x normal crowds",
      "Temple will be very crowded with devotees",
      "Consider visiting early morning (5:00-6:00 AM)"
    ],
    "location_sensitivity": {
      "location_name": "Temple of the Tooth",
      "l_rel": 0.95,
      "l_nat": 0.1,
      "l_hist": 0.9
    },
    "temporal_context": {
      "name": "Vesak Full Moon Poya Day",
      "is_poya": true,
      "is_mercantile": true,
      "bridge_info": {
        "is_bridge_day": true,
        "potential_long_weekend_days": 4
      }
    },
    "constraints": [
      {
        "constraint_type": "SOFT_CONSTRAINT",
        "code": "POYA_EXTREME_CROWD",
        "severity": "HIGH",
        "message": "Religious site on Poya day - expect extreme crowds"
      }
    ],
    "is_poya_day": true,
    "is_new_year_shutdown": false
  }
}
```

#### Get Golden Hour (by Coordinates)
```bash
curl -X POST http://localhost:3001/api/v1/ai/physics/golden-hour \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 6.8667,
    "longitude": 81.0667,
    "date": "2024-03-21",
    "elevation_m": 1041,
    "location_name": "Ella",
    "include_current_position": true
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "location": {
      "name": "Ella",
      "latitude": 6.8667,
      "longitude": 81.0667,
      "elevation_m": 1041
    },
    "date": "2024-03-21",
    "timezone": "Asia/Colombo",
    "morning_golden_hour": {
      "start_local": "06:05:23",
      "end_local": "06:35:12",
      "duration_minutes": 29.8
    },
    "evening_golden_hour": {
      "start_local": "17:55:45",
      "end_local": "18:25:18",
      "duration_minutes": 29.6
    },
    "sunrise": "06:15:30",
    "sunset": "18:15:00",
    "current_position": {
      "elevation_deg": 45.2,
      "azimuth_deg": 180.5,
      "is_daylight": true,
      "light_quality": "harsh"
    }
  }
}
```

#### Get Golden Hour (by Location Name)
```bash
curl -X GET "http://localhost:3001/api/v1/ai/physics/golden-hour/Sigiriya?date=2024-03-21&include_current_position=true" \
  -H "Authorization: Bearer <token>"
```

#### Get Current Sun Position
```bash
curl -X GET "http://localhost:3001/api/v1/ai/physics/sun-position?latitude=7.9570&longitude=80.7603&elevation_m=200" \
  -H "Authorization: Bearer <token>"
```

#### Get Current Light Quality
```bash
curl -X GET "http://localhost:3001/api/v1/ai/physics/light-quality?latitude=7.9570&longitude=80.7603" \
  -H "Authorization: Bearer <token>"
```

#### Check Holiday
```bash
curl -X GET "http://localhost:3001/api/v1/ai/events/check-holiday?location_name=Colombo&target_date=2024-05-23" \
  -H "Authorization: Bearer <token>"
```

#### Get Comprehensive Location Info
```bash
curl -X GET "http://localhost:3001/api/v1/ai/location-info/Sigiriya?target_date=2024-03-15&user_lat=7.2906&user_lng=80.6337" \
  -H "Authorization: Bearer <token>"
```

#### Get Optimal Visit Time
```bash
curl -X GET "http://localhost:3001/api/v1/ai/optimal-visit-time/Sigiriya?location_type=Heritage&target_date=2024-03-15" \
  -H "Authorization: Bearer <token>"
```

#### AI Engine Health Check (Public)
```bash
curl -X GET http://localhost:3001/api/v1/ai/health
```

#### AI Engine Status (Public)
```bash
curl -X GET http://localhost:3001/api/v1/ai/status
```

---

## 7. Data Models

### User Model

```typescript
interface IUser {
  _id: ObjectId;
  email: string;                    // Unique, required
  password?: string;                // Hashed, for local auth
  firstName: string;                // Required
  lastName: string;                 // Required
  userName: string;                 // Auto-generated unique
  gender?: 'Male' | 'Female' | 'Other';
  dob?: Date;
  isActive: boolean;                // Default: true
  profileStatus: 'Incomplete' | 'Complete';
  country?: string;
  preferredLanguage?: string;
  googleId?: string;                // For Google OAuth
  profilePicture?: string;
  provider: 'local' | 'google';
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### UserPreferences Model

```typescript
interface IUserPreferences {
  _id: ObjectId;
  userId: ObjectId;                 // Ref to User
  preferenceScores: {
    history: number;                // 0-1
    adventure: number;              // 0-1
    nature: number;                 // 0-1
    relaxation: number;             // 0-1
  };
  travelStyle: {
    pacePreference: 'slow' | 'moderate' | 'fast';
    budgetRange: 'budget' | 'mid-range' | 'luxury';
    groupSize: 'solo' | 'couple' | 'small-group' | 'large-group';
    accessibility: boolean;
    dietaryRestrictions?: string[];
    transportationPreferences?: string[];
    accommodationType?: 'hotel' | 'hostel' | 'resort' | 'homestay' | 'any';
  };
  savedLocations: ISavedLocation[];  // Max 100
  searchHistory: ISearchHistoryEntry[];
  favoriteCategories: string[];
  avoidCategories: string[];
  visitedLocations: string[];
  homeLocation?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
  };
  notificationPreferences: {
    goldenHourAlerts: boolean;
    crowdAlerts: boolean;
    eventAlerts: boolean;
    poyaDayReminders: boolean;
  };
  lastUpdated: Date;
}
```

### SavedTrip Model

```typescript
interface ISavedTrip {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  destinations: string[];
  itinerary: IItineraryItem[];      // Max 200 items
  totalDays: number;
  isPublic: boolean;
  status: 'draft' | 'planned' | 'ongoing' | 'completed' | 'cancelled';
  coverImage?: string;
  tags: string[];
  estimatedBudget?: {
    currency: string;
    amount: number;
  };
  travelersCount: number;
  generatedBy: 'user' | 'ai';
  aiMetadata?: IAIMetadata;
  constraints?: ITripConstraint[];
  rating?: number;                  // 1-5
  review?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface IItineraryItem {
  order: number;
  time: string;                     // HH:MM format
  locationName: string;
  locationId?: string;
  latitude?: number;
  longitude?: number;
  activity: string;
  durationMinutes: number;
  notes?: string;
  crowdPrediction?: number;         // 0-100
  lightingQuality?: 'golden' | 'blue' | 'good' | 'harsh' | 'dark';
  constraints?: string[];
}
```

### ChatSession Model

```typescript
interface IChatSession {
  _id: ObjectId;
  userId: ObjectId;
  sessionId: string;                // Unique, e.g., "chat_abc123_xyz789"
  title?: string;
  messages: IChatMessage[];         // Max 500
  context: ISessionContext;
  status: 'active' | 'closed' | 'archived';
  messageCount: number;
  lastActivity: Date;
  linkedTripId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface IChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: string;
    reasoningLoops?: number;
    documentsRetrieved?: number;
    webSearchUsed?: boolean;
    processingTimeMs?: number;
    constraints?: object[];
  };
}
```

---

## 8. Error Handling

### Error Response Format

```json
{
  "success": false,
  "message": "Error description here"
}
```

### Common Error Codes

| Status Code | Meaning | Example |
|-------------|---------|---------|
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate entry |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | AI Engine down |

### Validation Errors

```json
{
  "success": false,
  "message": "Validation error: \"email\" must be a valid email"
}
```

---

## 9. Testing Guide

### Manual Testing Flow

#### 1. Register and Login
```bash
# Register
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","firstName":"Test","lastName":"User"}'

# Save the token from response
TOKEN="eyJhbGci..."
```

#### 2. Set User Preferences
```bash
curl -X PATCH http://localhost:3001/api/v1/preferences/scores \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"history":0.8,"adventure":0.6,"nature":0.9,"relaxation":0.4}'
```

#### 3. Start AI Chat
```bash
curl -X POST http://localhost:3001/api/v1/chat/quick \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Plan a weekend trip to Sigiriya and Dambulla"}'
```

#### 4. Get Recommendations
```bash
curl -X POST http://localhost:3001/api/v1/ai/recommend \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_lat":7.2906,"current_lng":80.6337,"top_k":5}'
```

#### 5. Create Trip from Chat
```bash
curl -X POST http://localhost:3001/api/v1/trips \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Sigiriya Weekend",
    "startDate":"2024-03-15",
    "endDate":"2024-03-17",
    "destinations":["Sigiriya","Dambulla"],
    "generatedBy":"ai"
  }'
```

### Postman Collection

Import this collection for testing:

```json
{
  "info": {
    "name": "Travion Backend API",
    "_postman_id": "travion-api-v1"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {"name": "Register", "request": {"method": "POST", "url": "{{baseUrl}}/auth/register"}},
        {"name": "Login", "request": {"method": "POST", "url": "{{baseUrl}}/auth/login"}},
        {"name": "Profile", "request": {"method": "GET", "url": "{{baseUrl}}/auth/profile"}}
      ]
    },
    {
      "name": "Chat",
      "item": [
        {"name": "Quick Chat", "request": {"method": "POST", "url": "{{baseUrl}}/chat/quick"}},
        {"name": "Get Sessions", "request": {"method": "GET", "url": "{{baseUrl}}/chat/sessions"}}
      ]
    },
    {
      "name": "AI",
      "item": [
        {"name": "Recommend", "request": {"method": "POST", "url": "{{baseUrl}}/ai/recommend"}},
        {"name": "Crowd", "request": {"method": "POST", "url": "{{baseUrl}}/ai/crowd"}},
        {"name": "Golden Hour", "request": {"method": "POST", "url": "{{baseUrl}}/ai/physics/golden-hour"}}
      ]
    }
  ],
  "variable": [
    {"key": "baseUrl", "value": "http://localhost:3001/api/v1"}
  ]
}
```

---

## Summary

The Travion Backend provides a comprehensive API for:

- **User Management**: Registration, authentication, profile management
- **Personalization**: Travel preferences, saved locations, visit history
- **Trip Planning**: Create, manage, and share trips with AI-generated itineraries
- **AI Chat**: Conversational trip planning with context persistence
- **AI Integration**: Recommendations, crowd predictions, golden hour, event alerts

All endpoints follow RESTful conventions and return consistent JSON responses. The system integrates seamlessly with the Python AI Engine to provide intelligent, personalized travel experiences.

---

**Version**: 1.0.0
**Last Updated**: 2024-01-15
**API Base URL**: `http://localhost:3001/api/v1`
**AI Engine URL**: `http://localhost:8001/api/v1`

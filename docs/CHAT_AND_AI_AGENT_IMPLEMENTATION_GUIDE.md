# Travion Chat & AI Agent Implementation Guide

> **Complete Technical Documentation for Chat Sessions, Thread Management, and AI Agent Integration**

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Session & Thread Management](#2-session--thread-management)
3. [Chat APIs Implementation](#3-chat-apis-implementation)
4. [AI Agent APIs](#4-ai-agent-apis)
5. [Data Models](#5-data-models)
6. [Implementation Techniques](#6-implementation-techniques)
7. [Integration Patterns](#7-integration-patterns)
8. [API Reference with cURL Examples](#8-api-reference-with-curl-examples)
9. [Best Practices](#9-best-practices)
10. [Error Handling](#10-error-handling)

---

## 1. Architecture Overview

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRAVION ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────────┐ │
│  │   Mobile App /   │────▶│  Node.js Backend │────▶│  AI Engine (Python)  │ │
│  │   Web Frontend   │◀────│  (Travion-Backend)│◀────│  (FastAPI + LangGraph)│ │
│  └──────────────────┘     └────────┬─────────┘     └──────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│                           ┌──────────────────┐                               │
│                           │   MongoDB Atlas  │                               │
│                           │  (Data Storage)  │                               │
│                           └──────────────────┘                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Three-Layer Communication

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        REQUEST/RESPONSE FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CLIENT                   NODE.JS BACKEND              AI ENGINE             │
│  ┌─────┐                  ┌─────────────┐             ┌─────────────┐       │
│  │     │  1. HTTP Request │             │  3. Forward │             │       │
│  │ App │ ───────────────▶ │ Controller  │ ──────────▶ │  LangGraph  │       │
│  │     │                  │   Service   │             │   Agent     │       │
│  │     │  6. HTTP Response│   Repo      │  4. AI Resp │             │       │
│  │     │ ◀─────────────── │             │ ◀────────── │             │       │
│  └─────┘                  └──────┬──────┘             └─────────────┘       │
│                                  │                                           │
│                           2. Save│5. Save                                    │
│                             User │Response                                   │
│                            Message│+ Metadata                                │
│                                  ▼                                           │
│                           ┌─────────────┐                                    │
│                           │   MongoDB   │                                    │
│                           │  Sessions   │                                    │
│                           └─────────────┘                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Component Responsibilities

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| **Travion Backend** | Node.js + Express + TypeScript | User auth, session management, API gateway, data persistence |
| **AI Engine** | Python + FastAPI + LangGraph | Agentic reasoning, recommendations, constraint checking |
| **MongoDB** | MongoDB Atlas | User data, sessions, messages, trips, preferences |

---

## 2. Session & Thread Management

### 2.1 What is a Session?

A **Session** is a container for a conversation between a user and the AI. It:

- Has a unique `sessionId` (e.g., `chat_m4k8x2p1_7hnq93vf`)
- Belongs to a single user (`userId`)
- Stores conversation history (array of messages)
- Maintains context (location, preferences, target date)
- Has status management (active, closed, archived)

### 2.2 What is a Thread?

A **Thread** (or `thread_id`) is used by the AI Engine (LangGraph) for:

- Conversation memory persistence
- Context tracking across multiple interactions
- Reasoning loop continuity

**Key Insight**: The `sessionId` in our Node.js backend is passed as `thread_id` to the AI Engine.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SESSION vs THREAD RELATIONSHIP                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  NODE.JS BACKEND                           AI ENGINE                         │
│  ┌────────────────────────┐               ┌────────────────────────┐        │
│  │                        │               │                        │        │
│  │  SESSION (MongoDB)     │               │  THREAD (LangGraph)    │        │
│  │  ├── sessionId ◀───────┼───────────────┼──▶ thread_id          │        │
│  │  ├── userId            │               │  ├── Memory State      │        │
│  │  ├── messages[]        │               │  ├── Reasoning Loops   │        │
│  │  ├── context           │               │  └── Graph State       │        │
│  │  ├── status            │               │                        │        │
│  │  └── linkedTripId      │               │                        │        │
│  │                        │               │                        │        │
│  └────────────────────────┘               └────────────────────────┘        │
│                                                                              │
│  RESPONSIBILITIES:                        RESPONSIBILITIES:                  │
│  • User authentication                    • Agentic reasoning                │
│  • Message persistence                    • Tool calling                     │
│  • Context management                     • Knowledge retrieval              │
│  • Session lifecycle                      • Response generation              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SESSION LIFECYCLE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  CREATE  │───▶│  ACTIVE  │───▶│  CLOSED  │───▶│ ARCHIVED │              │
│  └──────────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘              │
│                       │               │               │                      │
│                       │               │               │                      │
│                       ▼               ▼               ▼                      │
│                  ┌──────────┐   ┌──────────┐   ┌──────────┐                 │
│                  │ Messages │   │  Can be  │   │  Auto    │                 │
│                  │ Added    │   │ Reopened │   │ Cleanup  │                 │
│                  │ Context  │   │          │   │ (90 days)│                 │
│                  │ Updated  │   │          │   │          │                 │
│                  └──────────┘   └──────────┘   └──────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Status Transitions:**

| From | To | Action | Use Case |
|------|-----|--------|----------|
| - | `active` | Create Session | New conversation |
| `active` | `closed` | Close Session | Conversation ended |
| `closed` | `active` | Reopen Session | Resume conversation |
| `closed` | `archived` | Archive Session | Long-term storage |
| `archived` | `deleted` | Auto Cleanup | After 90 days |

### 2.4 Session ID Generation

```typescript
/**
 * Generate unique session ID
 * Format: chat_{timestamp_base36}_{random_8chars}
 * Example: chat_m4k8x2p1_7hnq93vf
 */
private generateSessionId(): string {
  const timestamp = Date.now().toString(36);  // Base36 timestamp
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `chat_${timestamp}_${randomPart}`;
}
```

**Benefits:**
- Time-sortable (timestamp prefix)
- Human-readable prefix
- Unique across all users
- URL-safe characters

---

## 3. Chat APIs Implementation

### 3.1 Chat Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHAT IMPLEMENTATION LAYERS                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ ROUTES (chatSessionRoutes.ts)                                          │ │
│  │ • Define endpoints: POST /chat/sessions, POST /chat/quick, etc.        │ │
│  │ • Apply middleware: authenticate, validate                             │ │
│  │ • Map to controller methods                                            │ │
│  └───────────────────────────────────┬────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ CONTROLLER (ChatSessionController.ts)                                  │ │
│  │ • Handle HTTP request/response                                         │ │
│  │ • Extract parameters from req.body, req.params, req.query              │ │
│  │ • Format API responses                                                 │ │
│  │ • Error handling via next(error)                                       │ │
│  └───────────────────────────────────┬────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ SERVICE (ChatSessionService.ts)                                        │ │
│  │ • Business logic                                                       │ │
│  │ • AI Engine integration (calls AIEngineService)                        │ │
│  │ • User preferences injection                                           │ │
│  │ • Validation and transformation                                        │ │
│  └───────────────────────────────────┬────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ REPOSITORY (ChatSessionRepository.ts)                                  │ │
│  │ • MongoDB operations                                                   │ │
│  │ • CRUD for sessions and messages                                       │ │
│  │ • Query building and optimization                                      │ │
│  │ • Data transformation                                                  │ │
│  └───────────────────────────────────┬────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ MODEL (ChatSession.ts)                                                 │ │
│  │ • Mongoose schema definition                                           │ │
│  │ • TypeScript interfaces                                                │ │
│  │ • Indexes for performance                                              │ │
│  │ • Pre-save hooks                                                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Send Message Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SEND MESSAGE FLOW (Step by Step)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. CLIENT REQUEST                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ POST /api/v1/chat/sessions/:sessionId/messages                      │    │
│  │ Headers: { Authorization: "Bearer <token>" }                        │    │
│  │ Body: { message: "What are the best beaches near Colombo?" }        │    │
│  └────────────────────────────────────────────────────────────────┬────┘    │
│                                                                   │         │
│  2. AUTHENTICATION MIDDLEWARE                                     ▼         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • Verify JWT token                                                  │    │
│  │ • Extract userId from token                                         │    │
│  │ • Attach user to request: req.user = { userId, email, role }        │    │
│  └────────────────────────────────────────────────────────────────┬────┘    │
│                                                                   │         │
│  3. VALIDATION MIDDLEWARE                                         ▼         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • Validate sessionId in params (1-100 chars)                        │    │
│  │ • Validate message in body (1-2000 chars, required)                 │    │
│  │ • Validate optional context object                                  │    │
│  └────────────────────────────────────────────────────────────────┬────┘    │
│                                                                   │         │
│  4. CONTROLLER (ChatSessionController.sendMessage)                ▼         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • Extract: sessionId, userId, message, context                      │    │
│  │ • Call: chatService.sendMessage(sessionId, userId, message, context)│    │
│  │ • Return: formatted JSON response                                   │    │
│  └────────────────────────────────────────────────────────────────┬────┘    │
│                                                                   │         │
│  5. SERVICE (ChatSessionService.sendMessage)                      ▼         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ a) Get or create session from repository                            │    │
│  │ b) Update context if provided                                       │    │
│  │ c) Create user message object with timestamp                        │    │
│  │ d) Call AI Engine: aiService.chat(message, sessionId, context)      │    │
│  │ e) Map AI response constraints (snake_case → camelCase)             │    │
│  │ f) Create assistant message with metadata                           │    │
│  │ g) Save both messages to session                                    │    │
│  │ h) Return session + response data                                   │    │
│  └────────────────────────────────────────────────────────────────┬────┘    │
│                                                                   │         │
│  6. AI ENGINE SERVICE (AIEngineService.chat)                      ▼         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • Build ChatRequest: { message, thread_id, context }                │    │
│  │ • POST to AI Engine: http://localhost:8000/api/v1/chat              │    │
│  │ • Return ChatResponse with intent, response, itinerary, constraints │    │
│  └────────────────────────────────────────────────────────────────┬────┘    │
│                                                                   │         │
│  7. AI ENGINE (Python/LangGraph)                                  ▼         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • Intent Classification (greeting, tourism_query, trip_planning)    │    │
│  │ • Knowledge Retrieval (ChromaDB vector search)                      │    │
│  │ • Constraint Checking (CrowdCast, Event Sentinel, Golden Hour)      │    │
│  │ • Response Generation (LLM)                                         │    │
│  │ • Return structured response with metadata                          │    │
│  └────────────────────────────────────────────────────────────────┬────┘    │
│                                                                   │         │
│  8. RESPONSE TO CLIENT                                            ▼         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ {                                                                   │    │
│  │   "success": true,                                                  │    │
│  │   "data": {                                                         │    │
│  │     "sessionId": "chat_m4k8x2p1_7hnq93vf",                          │    │
│  │     "response": "Based on your location, here are the best...",     │    │
│  │     "intent": "tourism_query",                                      │    │
│  │     "metadata": { "reasoning_loops": 1, "documents_retrieved": 5 }  │    │
│  │   }                                                                 │    │
│  │ }                                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Quick Chat vs Regular Chat

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     QUICK CHAT vs REGULAR CHAT                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  QUICK CHAT (POST /chat/quick)                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ • Auto-creates session if sessionId not provided or doesn't exist      │ │
│  │ • Convenience endpoint for simple integrations                         │ │
│  │ • Single endpoint for "send message and get response"                  │ │
│  │                                                                        │ │
│  │ Flow:                                                                  │ │
│  │ 1. Check if sessionId provided                                         │ │
│  │ 2. If yes → find session, if not found → create new                    │ │
│  │ 3. If no sessionId → create new session                                │ │
│  │ 4. Send message and return response                                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  REGULAR CHAT (POST /chat/sessions/:sessionId/messages)                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ • Requires existing session                                            │ │
│  │ • Session must be created first via POST /chat/sessions                │ │
│  │ • More control over session lifecycle                                  │ │
│  │ • Better for multi-turn conversations                                  │ │
│  │                                                                        │ │
│  │ Flow:                                                                  │ │
│  │ 1. Session ID required in URL                                          │ │
│  │ 2. Verify session exists and belongs to user                           │ │
│  │ 3. Send message and return response                                    │ │
│  │ 4. Error if session not found                                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  WHEN TO USE WHICH:                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Quick Chat:                                                            │ │
│  │ • One-off questions                                                    │ │
│  │ • Mobile apps with simple UI                                           │ │
│  │ • Chatbots that don't need session management                          │ │
│  │                                                                        │ │
│  │ Regular Chat:                                                          │ │
│  │ • Complex multi-turn conversations                                     │ │
│  │ • Web apps with chat history UI                                        │ │
│  │ • Need to manage session lifecycle (close, archive)                    │ │
│  │ • Link sessions to trips                                               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Context Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SESSION CONTEXT                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  interface ISessionContext {                                                 │
│    currentLocation?: {                                                       │
│      latitude: number;   // User's current GPS location                      │
│      longitude: number;                                                      │
│    };                                                                        │
│    targetDate?: Date;    // Planned visit date                               │
│    preferences?: {       // User's interest scores (0-1)                     │
│      history: number;    // Historical/cultural sites                        │
│      adventure: number;  // Adventure activities                             │
│      nature: number;     // Nature and wildlife                              │
│      relaxation: number; // Relaxation and leisure                           │
│    };                                                                        │
│    lastRecommendations?: string[]; // Previously recommended locations       │
│  }                                                                           │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  HOW CONTEXT IS USED:                                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  1. SESSION CREATION                                                   │ │
│  │     • Load user preferences from UserPreferences collection            │ │
│  │     • Inject into session context automatically                        │ │
│  │                                                                        │ │
│  │  2. MESSAGE SENDING                                                    │ │
│  │     • Context passed to AI Engine with each message                    │ │
│  │     • AI uses location for distance calculations                       │ │
│  │     • AI uses preferences for personalized recommendations             │ │
│  │     • AI uses targetDate for constraint checking                       │ │
│  │                                                                        │ │
│  │  3. CONTEXT UPDATE                                                     │ │
│  │     • Update location when user moves                                  │ │
│  │     • Update targetDate when planning for specific day                 │ │
│  │     • Update preferences if user changes interests                     │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  AUTO-PREFERENCE INJECTION CODE:                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ async createSession(data: CreateSessionData): Promise<IChatSession> {  │ │
│  │   // Load user preferences for context                                 │ │
│  │   const preferences = await this.preferencesRepository               │ │
│  │     .findByUserId(data.userId);                                        │ │
│  │                                                                        │ │
│  │   const context: ISessionContext = {                                   │ │
│  │     ...data.context,                                                   │ │
│  │     preferences: preferences?.preferenceScores,  // Auto-inject       │ │
│  │   };                                                                   │ │
│  │                                                                        │ │
│  │   return await this.repository.create({ ...data, context });           │ │
│  │ }                                                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. AI Agent APIs

### 4.1 AI Engine Architecture (7 Pillars of Intelligence)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AI ENGINE - 7 PILLARS OF INTELLIGENCE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      LangGraph Agentic Core                         │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │                    Orchestrator Agent                         │   │    │
│  │  │   • Intent Classification                                     │   │    │
│  │  │   • Tool Selection                                            │   │    │
│  │  │   • Self-Correction Loops                                     │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│          ┌─────────────────────────┼─────────────────────────┐              │
│          │                         │                         │              │
│          ▼                         ▼                         ▼              │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐         │
│  │  Knowledge  │          │  CrowdCast  │          │   Event     │         │
│  │  Retrieval  │          │   Engine    │          │  Sentinel   │         │
│  │  (ChromaDB) │          │ (XGBoost)   │          │ (Calendar)  │         │
│  │             │          │             │          │             │         │
│  │ • Vector DB │          │ • ML Crowd  │          │ • Holidays  │         │
│  │ • RAG       │          │   Prediction│          │ • Poya Days │         │
│  │ • 80+ Locs  │          │ • Optimal   │          │ • Festivals │         │
│  │             │          │   Times     │          │ • Closures  │         │
│  └─────────────┘          └─────────────┘          └─────────────┘         │
│          │                         │                         │              │
│          ▼                         ▼                         ▼              │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐         │
│  │  Golden     │          │   Hybrid    │          │   Ranker    │         │
│  │  Hour       │          │  Recommender│          │   Agent     │         │
│  │  Engine     │          │  Engine     │          │   (LLM)     │         │
│  │             │          │             │          │             │         │
│  │ • Sunrise   │          │ • TF-IDF    │          │ • Re-rank   │         │
│  │ • Sunset    │          │ • Location  │          │ • Explain   │         │
│  │ • Light     │          │   Scoring   │          │ • Filter    │         │
│  │   Quality   │          │ • Prefs     │          │             │         │
│  └─────────────┘          └─────────────┘          └─────────────┘         │
│                                    │                                         │
│                                    ▼                                         │
│                           ┌─────────────┐                                    │
│                           │   Web       │                                    │
│                           │   Search    │                                    │
│                           │  (Tavily)   │                                    │
│                           │             │                                    │
│                           │ • Real-time │                                    │
│                           │   Info      │                                    │
│                           └─────────────┘                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 AI Agent API Categories

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AI AGENT API CATEGORIES                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. CHAT API (Agentic Conversation)                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ POST /api/v1/ai/chat                                                   │ │
│  │ • Full agentic workflow                                                │ │
│  │ • Multi-turn conversation with thread persistence                      │ │
│  │ • Returns: response, intent, itinerary, constraints, metadata          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  2. RECOMMENDATION APIs (Location Discovery)                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ POST /api/v1/ai/recommend       - Personalized recommendations         │ │
│  │ GET  /api/v1/ai/explain/:loc    - Location explanation                 │ │
│  │ GET  /api/v1/ai/locations/nearby - Nearby locations                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  3. CROWDCAST APIs (Crowd Prediction)                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ POST /api/v1/ai/crowd           - Predict crowd levels                 │ │
│  │ Returns: crowd_level, crowd_status, optimal_times                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  4. EVENT SENTINEL APIs (Holiday/Event Impact)                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ POST /api/v1/ai/events/impact   - Event impact analysis                │ │
│  │ GET  /api/v1/ai/events/check-holiday - Holiday check                   │ │
│  │ Returns: is_poya, constraints, crowd_modifier, travel_advice           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  5. GOLDEN HOUR APIs (Photography/Lighting)                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ POST /api/v1/ai/physics/golden-hour     - By coordinates               │ │
│  │ GET  /api/v1/ai/physics/golden-hour/:loc - By location name            │ │
│  │ GET  /api/v1/ai/physics/sun-position    - Current sun position         │ │
│  │ GET  /api/v1/ai/physics/light-quality   - Current light quality        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  6. CONVENIENCE APIs (Combined Data)                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ GET /api/v1/ai/location-info/:loc     - All info for location          │ │
│  │ GET /api/v1/ai/optimal-visit-time/:loc - Best time to visit            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  7. HEALTH/STATUS APIs (Public)                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ GET /api/v1/ai/health  - Component health status                       │ │
│  │ GET /api/v1/ai/status  - Quick availability check                      │ │
│  │ GET /api/v1/ai/graph   - LangGraph visualization                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 AI Engine Integration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AI ENGINE INTEGRATION (AIEngineService.ts)                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  NODE.JS BACKEND                                     AI ENGINE (FastAPI)     │
│  ┌──────────────────────────┐                       ┌─────────────────────┐ │
│  │  AIEngineService         │                       │                     │ │
│  │  ┌────────────────────┐  │    HTTP/JSON          │  /api/v1/chat       │ │
│  │  │ chat()             │──┼──────────────────────▶│  /api/v1/recommend  │ │
│  │  │ getRecommendations │  │                       │  /api/v1/crowd      │ │
│  │  │ getCrowdPrediction │  │                       │  /api/v1/events/... │ │
│  │  │ getEventImpact     │  │◀──────────────────────│  /api/v1/physics/...│ │
│  │  │ getGoldenHour      │  │    Structured Response│                     │ │
│  │  └────────────────────┘  │                       └─────────────────────┘ │
│  │                          │                                               │
│  │  Error Handling:         │                                               │
│  │  • ECONNREFUSED → 503    │                                               │
│  │  • ETIMEDOUT → 504       │                                               │
│  │  • API Error → Pass thru │                                               │
│  └──────────────────────────┘                                               │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  HTTP CLIENT CONFIGURATION (httpClient.ts):                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ const aiEngineClient = axios.create({                                  │ │
│  │   baseURL: process.env.AI_ENGINE_URL || 'http://localhost:8000',       │ │
│  │   timeout: 30000,  // 30 second timeout                                │ │
│  │   headers: { 'Content-Type': 'application/json' }                      │ │
│  │ });                                                                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Data Models

### 5.1 ChatSession Model

```typescript
/**
 * ChatSession Model Schema
 * Stores conversation history and context
 */

// Message metadata from AI Engine
interface IMessageMetadata {
  intent?: string;              // greeting, tourism_query, trip_planning, etc.
  reasoningLoops?: number;      // 0-2 self-correction loops
  documentsRetrieved?: number;  // RAG retrieval count
  webSearchUsed?: boolean;      // Whether Tavily was used
  processingTimeMs?: number;    // Processing duration
  constraints?: Array<{
    constraintType: string;     // poya_alcohol, crowd_warning, etc.
    description: string;        // Human-readable description
    severity: string;           // low, medium, high, critical
  }>;
}

// Individual message in conversation
interface IChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;              // Message text
  timestamp: Date;              // When sent
  metadata?: IMessageMetadata;  // AI-specific metadata
}

// Session context for personalization
interface ISessionContext {
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  targetDate?: Date;
  preferences?: {
    history: number;     // 0-1
    adventure: number;   // 0-1
    nature: number;      // 0-1
    relaxation: number;  // 0-1
  };
  lastRecommendations?: string[];
}

// Main ChatSession document
interface IChatSession {
  userId: ObjectId;           // Owner
  sessionId: string;          // Unique identifier (also used as thread_id)
  title?: string;             // Auto-generated from first message
  messages: IChatMessage[];   // Conversation history (max 500)
  context: ISessionContext;   // Personalization context
  status: 'active' | 'closed' | 'archived';
  messageCount: number;       // Denormalized count
  lastActivity: Date;         // For sorting/cleanup
  linkedTripId?: ObjectId;    // Optional trip association
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.2 MongoDB Indexes

```javascript
// Performance indexes for ChatSession
chatSessionSchema.index({ userId: 1, lastActivity: -1 });  // User's sessions sorted by activity
chatSessionSchema.index({ userId: 1, status: 1 });         // Filter by status
chatSessionSchema.index({ sessionId: 1 });                  // Session lookup (unique)
chatSessionSchema.index({ userId: 1, createdAt: -1 });     // User's sessions sorted by creation
```

---

## 6. Implementation Techniques

### 6.1 Thread Persistence Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      THREAD PERSISTENCE PATTERN                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PROBLEM: How to maintain conversation context across multiple messages?     │
│                                                                              │
│  SOLUTION: Dual-layer persistence                                            │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 1: Node.js Backend (MongoDB)                                   │   │
│  │                                                                      │   │
│  │ • Store all messages with full content                               │   │
│  │ • Store user context (location, preferences)                         │   │
│  │ • Store AI metadata (intent, constraints)                            │   │
│  │ • Enables: History viewing, search, export                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 2: AI Engine (LangGraph State)                                 │   │
│  │                                                                      │   │
│  │ • In-memory conversation state                                       │   │
│  │ • Last N messages for context window                                 │   │
│  │ • Graph execution state                                              │   │
│  │ • Enables: Contextual responses, follow-up handling                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  SYNCHRONIZATION:                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  sessionId (Node.js) ←→ thread_id (AI Engine)                        │   │
│  │                                                                      │   │
│  │  When sending message:                                               │   │
│  │  1. Node.js: Create/get session by sessionId                         │   │
│  │  2. Node.js: Save user message to MongoDB                            │   │
│  │  3. AI Engine: Load thread state by thread_id                        │   │
│  │  4. AI Engine: Process and generate response                         │   │
│  │  5. Node.js: Save assistant message + metadata to MongoDB            │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Message Pair Saving Pattern

```typescript
/**
 * Pattern: Save user message and assistant response together
 * Benefits:
 * - Atomic operation (both saved or neither)
 * - Single database roundtrip
 * - Consistent message counts
 */

async sendMessage(sessionId: string, userId: string, message: string) {
  // 1. Create user message
  const userMessage: IChatMessage = {
    role: 'user',
    content: message,
    timestamp: new Date(),
  };

  // 2. Get AI response
  const aiResponse = await this.aiService.chat(message, sessionId, context);

  // 3. Create assistant message with metadata
  const assistantMessage: IChatMessage = {
    role: 'assistant',
    content: aiResponse.response,
    timestamp: new Date(),
    metadata: {
      intent: aiResponse.intent,
      reasoningLoops: aiResponse.metadata?.reasoning_loops,
      documentsRetrieved: aiResponse.metadata?.documents_retrieved,
      // ... more metadata
    },
  };

  // 4. Save BOTH messages atomically
  await this.repository.addMessages(sessionId, userId, [userMessage, assistantMessage]);
}
```

### 6.3 Context Injection Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CONTEXT INJECTION PATTERN                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  GOAL: Automatically personalize AI responses without client-side logic      │
│                                                                              │
│  FLOW:                                                                       │
│                                                                              │
│  1. USER REGISTERS                                                           │
│     ┌────────────────────────────────────────────────────────────────────┐  │
│     │ POST /api/v1/auth/register                                         │  │
│     │ → Creates User document                                            │  │
│     │ → Creates UserPreferences document (default scores)                │  │
│     └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  2. USER UPDATES PREFERENCES                                                 │
│     ┌────────────────────────────────────────────────────────────────────┐  │
│     │ PUT /api/v1/preferences                                            │  │
│     │ → Updates preference scores                                        │  │
│     │ → e.g., { history: 0.8, adventure: 0.3, nature: 0.9, relax: 0.5 }  │  │
│     └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  3. USER STARTS CHAT SESSION                                                 │
│     ┌────────────────────────────────────────────────────────────────────┐  │
│     │ POST /api/v1/chat/sessions                                         │  │
│     │                                                                    │  │
│     │ ChatSessionService.createSession():                                │  │
│     │   const preferences = await preferencesRepo.findByUserId(userId);  │  │
│     │   const context = {                                                │  │
│     │     ...providedContext,                                            │  │
│     │     preferences: preferences.preferenceScores  // AUTO-INJECTED   │  │
│     │   };                                                               │  │
│     └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  4. USER SENDS MESSAGE                                                       │
│     ┌────────────────────────────────────────────────────────────────────┐  │
│     │ POST /api/v1/chat/sessions/:sessionId/messages                     │  │
│     │                                                                    │  │
│     │ AIEngineService.chat(message, sessionId, session.context):         │  │
│     │   POST to AI Engine with context containing preferences            │  │
│     │   AI personalizes response based on preference scores              │  │
│     └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  RESULT: User with high nature score gets nature-focused recommendations     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Snake_case to camelCase Mapping

```typescript
/**
 * AI Engine uses snake_case (Python convention)
 * Node.js uses camelCase (JavaScript convention)
 *
 * Pattern: Map at service layer
 */

// AI Engine Response (snake_case)
interface ConstraintViolation {
  constraint_type: string;    // snake_case
  description: string;
  severity: string;
  suggestion: string;
}

// Node.js Model (camelCase)
interface IMessageConstraint {
  constraintType: string;     // camelCase
  description: string;
  severity: string;
}

// Mapping in ChatSessionService
const mappedConstraints = aiResponse.constraints?.map(c => ({
  constraintType: c.constraint_type,  // Map here
  description: c.description,
  severity: c.severity,
}));
```

---

## 7. Integration Patterns

### 7.1 Trip Linking Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRIP LINKING PATTERN                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SCENARIO: User plans a trip through chat, wants to save it                  │
│                                                                              │
│  FLOW:                                                                       │
│                                                                              │
│  1. USER CHATS ABOUT TRIP                                                    │
│     ┌────────────────────────────────────────────────────────────────────┐  │
│     │ "Plan a 2-day trip to Sigiriya and Dambulla"                       │  │
│     │                                                                    │  │
│     │ AI Response includes:                                              │  │
│     │ - itinerary: [{ time, location, activity, crowd_prediction }, ...] │  │
│     │ - constraints: [{ constraintType, description, severity }]         │  │
│     └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  2. USER SAVES TRIP                                                          │
│     ┌────────────────────────────────────────────────────────────────────┐  │
│     │ POST /api/v1/trips                                                 │  │
│     │ {                                                                  │  │
│     │   "title": "Sigiriya Adventure",                                   │  │
│     │   "destination": "Sigiriya",                                       │  │
│     │   "itinerary": [...from AI response...],                           │  │
│     │   "aiMetadata": {                                                  │  │
│     │     "sessionId": "chat_xxx",                                       │  │
│     │     "reasoningLoops": 2,                                           │  │
│     │     "documentsRetrieved": 5                                        │  │
│     │   }                                                                │  │
│     │ }                                                                  │  │
│     └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  3. LINK CHAT SESSION TO TRIP                                                │
│     ┌────────────────────────────────────────────────────────────────────┐  │
│     │ POST /api/v1/chat/sessions/:sessionId/link-trip                    │  │
│     │ { "tripId": "newly_created_trip_id" }                              │  │
│     │                                                                    │  │
│     │ Benefits:                                                          │  │
│     │ - Navigate from trip to planning conversation                      │  │
│     │ - Continue conversation about specific trip                        │  │
│     │ - Track which chats led to which trips                             │  │
│     └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  DATA RELATIONSHIP:                                                          │
│                                                                              │
│  ChatSession                        SavedTrip                                │
│  ┌─────────────────┐               ┌─────────────────┐                      │
│  │ sessionId       │               │ _id             │                      │
│  │ linkedTripId ───┼──────────────▶│                 │                      │
│  │ messages[]      │               │ aiMetadata      │                      │
│  │                 │               │   sessionId ────┼──────┐               │
│  └─────────────────┘               └─────────────────┘      │               │
│         ▲                                                    │               │
│         └────────────────────────────────────────────────────┘               │
│                     (Bidirectional reference)                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Real-time Location Update Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REAL-TIME LOCATION UPDATE PATTERN                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MOBILE APP FLOW:                                                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 1. App starts, gets GPS location                                    │    │
│  │    navigator.geolocation.getCurrentPosition()                       │    │
│  └──────────────────────────────────────┬──────────────────────────────┘    │
│                                         │                                    │
│                                         ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 2. Create/resume chat session with location                         │    │
│  │                                                                     │    │
│  │    POST /api/v1/chat/sessions                                       │    │
│  │    {                                                                │    │
│  │      "context": {                                                   │    │
│  │        "currentLocation": { "latitude": 6.9271, "longitude": 79.8 } │    │
│  │      }                                                              │    │
│  │    }                                                                │    │
│  └──────────────────────────────────────┬──────────────────────────────┘    │
│                                         │                                    │
│                                         ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 3. Location changes significantly (>100m)                           │    │
│  │                                                                     │    │
│  │    PATCH /api/v1/chat/sessions/:sessionId/location                  │    │
│  │    { "latitude": 7.2906, "longitude": 80.6337 }                     │    │
│  │                                                                     │    │
│  │    OR include in next message:                                      │    │
│  │    POST /api/v1/chat/sessions/:sessionId/messages                   │    │
│  │    {                                                                │    │
│  │      "message": "What's nearby?",                                   │    │
│  │      "context": {                                                   │    │
│  │        "currentLocation": { "latitude": 7.2906, "longitude": 80.6 } │    │
│  │      }                                                              │    │
│  │    }                                                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  AI ENGINE USES LOCATION FOR:                                                │
│  • Distance calculations to recommended locations                            │
│  • "Nearby" queries                                                          │
│  • Travel time estimates                                                     │
│  • Location-specific constraints (e.g., temple dress code at current loc)    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. API Reference with cURL Examples

### 8.1 Chat Session APIs

#### Create Session

```bash
# Create a new chat session
curl -X POST http://localhost:3000/api/v1/chat/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Planning Sigiriya Trip",
    "context": {
      "currentLocation": {
        "latitude": 6.9271,
        "longitude": 79.8612
      },
      "targetDate": "2024-02-15"
    }
  }'

# Response:
{
  "success": true,
  "message": "Chat session created",
  "data": {
    "session": {
      "_id": "...",
      "sessionId": "chat_m4k8x2p1_7hnq93vf",
      "title": "Planning Sigiriya Trip",
      "status": "active",
      "messageCount": 0,
      "context": {
        "currentLocation": { "latitude": 6.9271, "longitude": 79.8612 },
        "targetDate": "2024-02-15",
        "preferences": { "history": 0.7, "adventure": 0.5, "nature": 0.8, "relaxation": 0.3 }
      }
    }
  }
}
```

#### Send Message

```bash
# Send a message and get AI response
curl -X POST http://localhost:3000/api/v1/chat/sessions/chat_m4k8x2p1_7hnq93vf/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "What are the best historical sites near Kandy?"
  }'

# Response:
{
  "success": true,
  "data": {
    "sessionId": "chat_m4k8x2p1_7hnq93vf",
    "response": "Based on your interest in history (80% match), here are the top historical sites near Kandy:\n\n1. **Temple of the Tooth (Sri Dalada Maligawa)** - UNESCO World Heritage Site housing Buddha's tooth relic. Best visited in the morning (6-8 AM) for peaceful experience.\n\n2. **Kandy Royal Palace** - Adjacent to the temple, showcasing Kandyan architecture...",
    "intent": "tourism_query",
    "metadata": {
      "reasoning_loops": 1,
      "documents_retrieved": 5,
      "web_search_used": false
    },
    "messageCount": 2
  }
}
```

#### Quick Chat

```bash
# Quick chat - auto-creates session if needed
curl -X POST http://localhost:3000/api/v1/chat/quick \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "What should I pack for a beach trip?",
    "context": {
      "currentLocation": {
        "latitude": 6.0174,
        "longitude": 80.2168
      }
    }
  }'

# Response includes new sessionId:
{
  "success": true,
  "data": {
    "sessionId": "chat_m4k9a3b2_xyzabc12",
    "response": "For a beach trip in Sri Lanka, here's what to pack...",
    "intent": "tourism_query",
    ...
  }
}
```

#### Get Chat History

```bash
# Get messages with pagination
curl -X GET "http://localhost:3000/api/v1/chat/sessions/chat_m4k8x2p1_7hnq93vf/messages?limit=20&offset=0" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
{
  "success": true,
  "data": {
    "messages": [
      {
        "role": "user",
        "content": "What are the best historical sites near Kandy?",
        "timestamp": "2024-01-15T10:30:00.000Z"
      },
      {
        "role": "assistant",
        "content": "Based on your interest in history...",
        "timestamp": "2024-01-15T10:30:02.000Z",
        "metadata": {
          "intent": "tourism_query",
          "reasoningLoops": 1,
          "documentsRetrieved": 5
        }
      }
    ]
  }
}
```

#### Update Location

```bash
# Update current location mid-conversation
curl -X PATCH http://localhost:3000/api/v1/chat/sessions/chat_m4k8x2p1_7hnq93vf/location \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "latitude": 7.2906,
    "longitude": 80.6337
  }'
```

#### Link to Trip

```bash
# Link session to a saved trip
curl -X POST http://localhost:3000/api/v1/chat/sessions/chat_m4k8x2p1_7hnq93vf/link-trip \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tripId": "507f1f77bcf86cd799439011"
  }'
```

### 8.2 AI Agent APIs

#### Personalized Recommendations

```bash
# Get AI-powered recommendations based on location and preferences
curl -X POST http://localhost:3000/api/v1/ai/recommend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "current_lat": 7.2906,
    "current_lng": 80.6337,
    "preferences": {
      "history": 0.8,
      "adventure": 0.3,
      "nature": 0.7,
      "relaxation": 0.4
    },
    "top_k": 5,
    "max_distance_km": 50,
    "target_datetime": "2024-02-15T10:00:00"
  }'

# Response:
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "rank": 1,
        "name": "Sigiriya Rock Fortress",
        "latitude": 7.9570,
        "longitude": 80.7603,
        "similarity_score": 0.92,
        "distance_km": 45.2,
        "combined_score": 0.88,
        "preference_scores": {
          "history": 0.95,
          "adventure": 0.70,
          "nature": 0.60,
          "relaxation": 0.20
        },
        "constraint_checks": [
          {
            "constraint_type": "crowd",
            "status": "warning",
            "value": 0.75,
            "message": "Expected moderate crowds (Poya day tomorrow)"
          }
        ],
        "reasoning": "Excellent match for history lovers. The ancient fortress offers breathtaking views...",
        "optimal_visit_time": "06:00-09:00"
      }
    ],
    "metadata": {
      "candidates_evaluated": 80,
      "processing_time_ms": 245,
      "self_corrections": 1
    }
  }
}
```

#### Crowd Prediction

```bash
# Get crowd prediction for a location type
curl -X POST http://localhost:3000/api/v1/ai/crowd \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "location_type": "heritage",
    "target_datetime": "2024-02-15T10:00:00"
  }'

# Response:
{
  "success": true,
  "data": {
    "crowd_level": 0.65,
    "crowd_percentage": 65,
    "crowd_status": "MODERATE",
    "recommendation": "Consider visiting earlier in the morning for fewer crowds",
    "optimal_times": [
      { "time": "06:00", "crowd": 0.25 },
      { "time": "07:00", "crowd": 0.35 },
      { "time": "16:00", "crowd": 0.45 }
    ]
  }
}
```

#### Event Impact Analysis

```bash
# Check if there are any events/holidays affecting a location
curl -X POST http://localhost:3000/api/v1/ai/events/impact \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "location_name": "Temple of the Tooth",
    "target_date": "2024-02-23",
    "activity_type": "photography"
  }'

# Response:
{
  "success": true,
  "data": {
    "is_legal_conflict": false,
    "predicted_crowd_modifier": 2.5,
    "is_poya_day": true,
    "travel_advice_strings": [
      "Poya Day: Expect significantly higher crowds at religious sites",
      "Dress modestly - white clothing recommended for temple visits",
      "No alcohol sales throughout the country"
    ],
    "constraints": [
      {
        "constraint_type": "SOFT_CONSTRAINT",
        "code": "POYA_HIGH_CROWD",
        "severity": "MEDIUM",
        "message": "Religious site will have 2.5x normal crowd levels",
        "affected_activities": ["tourism", "photography"]
      }
    ],
    "temporal_context": {
      "name": "Navam Full Moon Poya Day",
      "categories": ["Public", "Bank", "Poya"],
      "is_poya": true
    }
  }
}
```

#### Golden Hour Calculation

```bash
# Get golden hour times for a location
curl -X GET "http://localhost:3000/api/v1/ai/physics/golden-hour/Sigiriya?date=2024-02-15&include_current_position=true" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
{
  "success": true,
  "data": {
    "location": {
      "name": "Sigiriya",
      "latitude": 7.9570,
      "longitude": 80.7603,
      "elevation_m": 349
    },
    "date": "2024-02-15",
    "timezone": "Asia/Colombo",
    "morning_golden_hour": {
      "start_local": "06:12:00",
      "end_local": "06:42:00",
      "duration_minutes": 30
    },
    "evening_golden_hour": {
      "start_local": "17:48:00",
      "end_local": "18:18:00",
      "duration_minutes": 30
    },
    "sunrise": "06:28:00",
    "sunset": "18:15:00",
    "current_position": {
      "light_quality": "good",
      "elevation_deg": 45.2,
      "is_daylight": true
    }
  }
}
```

#### Location Explanation

```bash
# Get detailed explanation for a location
curl -X GET "http://localhost:3000/api/v1/ai/explain/Polonnaruwa?user_lat=7.2906&user_lng=80.6337" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
{
  "success": true,
  "data": {
    "location_name": "Polonnaruwa",
    "found": true,
    "location_info": {
      "latitude": 7.9403,
      "longitude": 81.0188,
      "is_outdoor": true,
      "preference_scores": {
        "history": 0.95,
        "adventure": 0.40,
        "nature": 0.50,
        "relaxation": 0.30
      }
    },
    "preference_analysis": {
      "history_match": "Excellent - Ancient royal capital with UNESCO ruins",
      "adventure_match": "Moderate - Cycling through ruins possible",
      "nature_match": "Good - Wildlife in surrounding areas",
      "relaxation_match": "Limited - Active exploration required"
    },
    "best_times": ["Early morning (6-9 AM)", "Late afternoon (4-6 PM)"],
    "tips": [
      "Rent a bicycle at the entrance for easier exploration",
      "Carry water - limited shade in ruins area",
      "Visit Gal Vihara for famous Buddha statues"
    ]
  }
}
```

### 8.3 Comprehensive Location Info

```bash
# Get all information about a location in one call
curl -X GET "http://localhost:3000/api/v1/ai/location-info/Yala%20National%20Park?target_date=2024-02-15" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response combines: explanation + event impact + golden hour
{
  "success": true,
  "data": {
    "explanation": { /* location explanation */ },
    "eventImpact": { /* event/holiday analysis */ },
    "goldenHour": { /* sunrise/sunset times */ }
  }
}
```

---

## 9. Best Practices

### 9.1 Session Management Best Practices

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SESSION MANAGEMENT BEST PRACTICES                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. USE QUICK CHAT FOR SIMPLE INTEGRATIONS                                   │
│     ┌────────────────────────────────────────────────────────────────────┐  │
│     │ • One API call for message + response                              │  │
│     │ • Auto-creates session if needed                                   │  │
│     │ • Store returned sessionId for continuations                       │  │
│     │ • Best for: Mobile apps, simple chatbots                           │  │
│     └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  2. USE REGULAR CHAT FOR COMPLEX APPS                                        │
│     ┌────────────────────────────────────────────────────────────────────┐  │
│     │ • Create session explicitly                                        │  │
│     │ • Manage lifecycle (close, archive)                                │  │
│     │ • Link to trips                                                    │  │
│     │ • Best for: Web apps with chat history UI                          │  │
│     └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  3. ALWAYS PASS CONTEXT WHEN AVAILABLE                                       │
│     ┌────────────────────────────────────────────────────────────────────┐  │
│     │ • Location enables distance-based recommendations                  │  │
│     │ • Target date enables constraint checking                          │  │
│     │ • Preferences enable personalization                               │  │
│     └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  4. CLEAN UP OLD SESSIONS                                                    │
│     ┌────────────────────────────────────────────────────────────────────┐  │
│     │ • Archive sessions when user is done                               │  │
│     │ • Run cleanup job for old archived sessions                        │  │
│     │ • Don't accumulate thousands of sessions per user                  │  │
│     └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  5. HANDLE AI ENGINE UNAVAILABILITY                                          │
│     ┌────────────────────────────────────────────────────────────────────┐  │
│     │ • Check /api/v1/ai/status before sending messages                  │  │
│     │ • Provide fallback message if AI Engine is down                    │  │
│     │ • Implement retry logic with exponential backoff                   │  │
│     └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Performance Optimization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PERFORMANCE OPTIMIZATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DATABASE:                                                                   │
│  • Use compound indexes for common queries                                   │
│  • Limit message history (500 messages max per session)                      │
│  • Project only needed fields in list queries                                │
│  • Use pagination for large result sets                                      │
│                                                                              │
│  AI ENGINE:                                                                  │
│  • Set appropriate timeouts (30s for chat, 10s for others)                   │
│  • Don't call AI Engine for non-AI operations                                │
│  • Cache health check results (5 minute TTL)                                 │
│  • Use batch operations where possible                                       │
│                                                                              │
│  SESSION:                                                                    │
│  • Reuse sessions for related conversations                                  │
│  • Don't create new session for each message                                 │
│  • Archive completed sessions to reduce active count                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Error Handling

### 10.1 Error Response Format

```typescript
// Standard error response
{
  "success": false,
  "error": {
    "message": "Session not found",
    "statusCode": 404,
    "code": "SESSION_NOT_FOUND"  // Optional error code
  }
}
```

### 10.2 Common Errors

| HTTP Code | Error | Cause | Solution |
|-----------|-------|-------|----------|
| 400 | Message is required | Empty message body | Provide non-empty message |
| 401 | Unauthorized | Missing/invalid token | Include valid Bearer token |
| 404 | Session not found | Invalid sessionId | Create session first or check ID |
| 503 | AI Engine unavailable | AI Engine down | Check /ai/status, retry later |
| 504 | AI Engine timeout | Slow response | Increase timeout, simplify query |

### 10.3 Error Handling Pattern

```typescript
// Controller error handling
sendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // ... implementation
  } catch (error) {
    next(error);  // Pass to error middleware
  }
};

// Service error handling
async sendMessage(...) {
  const session = await this.repository.findBySessionIdAndUser(sessionId, userId);
  if (!session) {
    throw new AppError('Chat session not found', 404);  // Custom error
  }
  // ...
}

// AI Engine error handling
private handleError(error: unknown, operation: string): never {
  if (error.code === 'ECONNREFUSED') {
    throw new AppError('AI Engine service is unavailable', 503);
  }
  if (error.code === 'ETIMEDOUT') {
    throw new AppError('AI Engine request timed out', 504);
  }
  throw new AppError(`AI Engine ${operation} failed`, 500);
}
```

---

## Summary

This implementation provides:

1. **Robust Session Management**: Create, manage, and cleanup chat sessions with full lifecycle support
2. **Thread Persistence**: Maintain conversation context across multiple messages via sessionId/thread_id synchronization
3. **AI Integration**: Seamless connection to Python AI Engine with all 7 pillars of intelligence
4. **Context Injection**: Automatic preference loading and context management
5. **Trip Linking**: Associate conversations with saved trips for traceability
6. **Error Handling**: Comprehensive error handling with appropriate HTTP status codes

The architecture follows industry best practices with clear separation of concerns (Routes → Controller → Service → Repository → Model) and proper TypeScript typing throughout.

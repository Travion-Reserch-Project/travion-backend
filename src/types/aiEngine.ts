/**
 * TypeScript interfaces for AI Engine API requests and responses
 * Based on the AI Agent Engine documentation (FastAPI Python backend)
 */

// ============================================================================
// USER PREFERENCE TYPES (used across multiple APIs)
// ============================================================================

export interface UserPreferenceScores {
  history: number;     // 0-1: Interest in historical/cultural sites
  adventure: number;   // 0-1: Interest in adventure activities
  nature: number;      // 0-1: Interest in nature and wildlife
  relaxation: number;  // 0-1: Interest in relaxation and leisure
}

export interface UserLocation {
  latitude: number;
  longitude: number;
}

// ============================================================================
// CHAT API TYPES (/api/v1/chat)
// ============================================================================

export interface ChatContext {
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  preferences?: UserPreferenceScores;
}

export interface ChatRequest {
  message: string;              // User message (1-2000 chars)
  thread_id?: string;           // Thread ID for conversation persistence
  stream?: boolean;             // Enable streaming response (default: false)
  context?: ChatContext;        // Optional context for chat
}

export interface ItinerarySlot {
  time: string;                 // e.g., "16:30"
  location: string;             // Destination name
  activity: string;             // What to do
  duration_minutes: number;     // Suggested duration
  crowd_prediction: number;     // Expected crowd (0-100)
  lighting_quality: string;     // "golden", "harsh", "good", "dark"
  notes?: string;               // Special considerations
}

export interface ConstraintViolation {
  constraint_type: string;      // e.g., "poya_alcohol"
  description: string;          // Human-readable explanation
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;           // Corrective action
}

export interface ReasoningLog {
  timestamp: string;            // ISO format
  check_type: string;           // "event_sentinel", "crowdcast", "golden_hour"
  result: string;               // "ok", "warning", "blocked"
  details: string;              // Additional info
}

export interface ChatResponse {
  query: string;                // Original user query
  intent: 'greeting' | 'tourism_query' | 'trip_planning' | 'real_time_info' | 'off_topic';
  response: string;             // Final generated response
  itinerary?: ItinerarySlot[];  // Structured plan (for trip_planning)
  constraints?: ConstraintViolation[];
  reasoning_logs?: ReasoningLog[];
  metadata: {
    reasoning_loops: number;    // 0-2
    documents_retrieved: number;
    web_search_used: boolean;
  };
}

// ============================================================================
// RECOMMENDATION API TYPES (/api/v1/recommend)
// ============================================================================

export interface RecommendationRequest {
  current_lat: number;          // User latitude (5.0-10.0 for Sri Lanka)
  current_lng: number;          // User longitude (79.0-82.0 for Sri Lanka)
  preferences?: {
    history?: number;           // 0-1 (default: 0.5)
    adventure?: number;         // 0-1 (default: 0.5)
    nature?: number;            // 0-1 (default: 0.5)
    relaxation?: number;        // 0-1 (default: 0.5)
  };
  top_k?: number;               // Number of results (1-10, default: 3)
  max_distance_km?: number;     // Search radius (1-500, default: 20)
  target_datetime?: string;     // ISO format target visit time
  outdoor_only?: boolean;       // Filter outdoor locations only
  exclude_locations?: string[]; // Location names to exclude
  user_id?: string;             // User ID for tracking
}

export interface ConstraintCheck {
  constraint_type: string;      // "crowd", "lighting", "holiday"
  status: 'ok' | 'warning' | 'blocked';
  value: number;
  message: string;
}

export interface RecommendationItem {
  rank: number;
  name: string;
  latitude: number;
  longitude: number;
  similarity_score: number;     // 0-1
  distance_km: number;
  combined_score: number;       // 0-1
  preference_scores: {
    history: number;
    adventure: number;
    nature: number;
    relaxation: number;
  };
  is_outdoor: boolean;
  constraint_checks?: ConstraintCheck[];
  reasoning?: string;           // LLM-generated explanation
  optimal_visit_time?: string;  // Best time to visit
  warnings?: string[];
}

export interface RecommendationResponse {
  success: boolean;
  user_id?: string;
  request_location: {
    latitude: number;
    longitude: number;
  };
  target_datetime?: string;
  recommendations: RecommendationItem[];
  metadata: {
    candidates_evaluated: number;
    processing_time_ms: number;
    max_distance_km: number;
    self_corrections: number;
    constraints_checked: string[];
  };
  reasoning_summary?: string;
}

// ============================================================================
// EXPLAIN API TYPES (/api/v1/explain/{location_name})
// ============================================================================

export interface ExplainResponse {
  location_name: string;
  found: boolean;
  location_info?: {
    latitude: number;
    longitude: number;
    is_outdoor: boolean;
    preference_scores: {
      history: number;
      adventure: number;
      nature: number;
      relaxation: number;
    };
  };
  preference_analysis?: {
    history_match: string;
    adventure_match: string;
    nature_match: string;
    relaxation_match: string;
  };
  constraint_analysis?: {
    typical_crowds: string;
    weather_sensitivity: string;
    poya_impact: string;
  };
  similar_locations?: string[];
  detailed_reasoning?: string;
  best_times?: string[];
  tips?: string[];
}

// ============================================================================
// NEARBY LOCATIONS API TYPES (/api/v1/locations/nearby)
// ============================================================================

export interface NearbyLocationsRequest {
  lat: number;
  lng: number;
  top_k?: number;               // Default: 5
  max_distance_km?: number;     // Default: 50
}

export interface NearbyLocation {
  name: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  is_outdoor: boolean;
  preference_scores: {
    history: number;
    adventure: number;
    nature: number;
    relaxation: number;
  };
}

export interface NearbyLocationsResponse {
  success: boolean;
  request_location: {
    latitude: number;
    longitude: number;
  };
  locations: NearbyLocation[];
  total_found: number;
}

// ============================================================================
// CROWDCAST API TYPES (/api/v1/crowd)
// ============================================================================

export interface CrowdPredictionRequest {
  location_type: string;        // e.g., "heritage", "beach", "temple"
  target_datetime: string;      // ISO format
  is_poya?: boolean;            // Override for Poya day
  is_school_holiday?: boolean;  // Override for school holiday
}

export interface OptimalTime {
  time: string;
  crowd: number;
}

export interface CrowdPredictionResponse {
  crowd_level: number;          // 0-1 normalized
  crowd_percentage: number;     // 0-100%
  crowd_status: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  recommendation: string;
  optimal_times?: OptimalTime[];
}

// ============================================================================
// EVENT SENTINEL API TYPES (/api/v1/events/impact)
// ============================================================================

export interface EventImpactRequest {
  location_name: string;        // Fuzzy matched location
  target_date: string;          // YYYY-MM-DD format
  activity_type?: string;       // e.g., "nightlife", "photography"
}

export interface BridgeInfo {
  is_bridge_day: boolean;
  bridge_type?: 'MONDAY_BRIDGE' | 'FRIDAY_BRIDGE' | 'DOUBLE_BRIDGE' | 'MONDAY_NATURAL' | 'FRIDAY_NATURAL';
  potential_long_weekend_days: number;
  adjacent_dates: string[];
}

export interface TemporalContext {
  uid: string;
  name: string;
  date: string;
  day_of_week: string;
  day_number: number;           // ISO weekday (1=Mon, 7=Sun)
  categories: string[];         // ["Public", "Bank", "Poya", "Mercantile"]
  is_poya: boolean;
  is_mercantile: boolean;
  bridge_info: BridgeInfo;
}

export interface LocationSensitivity {
  location_name: string;
  match_confidence: number;     // 0-1
  l_rel: number;                // Religious score
  l_nat: number;                // Nature score
  l_hist: number;               // History score
  l_adv: number;                // Adventure score
  sensitivity_flags: string[];  // ["HIGH_RELIGIOUS_SITE", "VESAK_PEAK_PERIOD", etc.]
}

export interface EventConstraint {
  constraint_type: 'HARD_CONSTRAINT' | 'SOFT_CONSTRAINT' | 'WARNING';
  code: string;                 // e.g., "POYA_ALCOHOL_BAN"
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  affected_activities: string[];
}

export interface EventImpactResponse {
  is_legal_conflict: boolean;
  predicted_crowd_modifier: number; // 0-5.0
  travel_advice_strings: string[];
  location_sensitivity: LocationSensitivity;
  temporal_context?: TemporalContext;
  constraints: EventConstraint[];
  is_poya_day: boolean;
  is_new_year_shutdown: boolean;
  is_weekend: boolean;
  is_long_weekend: boolean;
  activity_allowed?: boolean;
  activity_warnings?: string[];
  calculation_timestamp: string;
  engine_version: string;
}

// ============================================================================
// GOLDEN HOUR / PHYSICS API TYPES (/api/v1/physics/golden-hour)
// ============================================================================

export interface GoldenHourRequest {
  latitude: number;             // -90 to 90
  longitude: number;            // -180 to 180
  date: string;                 // YYYY-MM-DD
  elevation_m?: number;         // Observer elevation (default: 0, max: 3000)
  location_name?: string;       // Human-readable name
  include_current_position?: boolean; // Include real-time sun position
}

export interface TimeWindow {
  start: string;                // UTC timestamp
  end: string;                  // UTC timestamp
  start_local: string;          // Local time string (HH:MM:SS)
  end_local: string;            // Local time string
  duration_minutes: number;
  elevation_at_start_deg?: number;
  elevation_at_end_deg?: number;
}

export interface SolarPosition {
  timestamp: string;
  local_time: string;
  elevation_deg: number;
  azimuth_deg: number;
  atmospheric_refraction_deg?: number;
  is_daylight: boolean;
  light_quality: 'golden' | 'blue' | 'harsh' | 'good' | 'dark';
  calculation_method: 'astral' | 'pysolar';
}

export interface GoldenHourResponse {
  location: {
    name?: string;
    latitude: number;
    longitude: number;
    elevation_m: number;
  };
  date: string;
  timezone: string;             // Always "Asia/Colombo"
  morning_golden_hour: TimeWindow;
  evening_golden_hour: TimeWindow;
  morning_blue_hour?: TimeWindow;
  evening_blue_hour?: TimeWindow;
  solar_noon: string;
  solar_noon_elevation_deg: number;
  sunrise: string;
  sunset: string;
  day_length_hours: number;
  current_position?: SolarPosition;
  metadata: {
    topographic_correction_minutes: number;
    calculation_method: 'astral' | 'pysolar';
    precision_estimate_deg: number;
  };
  warnings: string[];
}

// ============================================================================
// SUN POSITION API TYPES (/api/v1/physics/sun-position)
// ============================================================================

export interface SunPositionRequest {
  latitude: number;
  longitude: number;
  elevation_m?: number;
}

export interface SunPositionResponse {
  timestamp: string;
  local_time: string;
  elevation_deg: number;
  azimuth_deg: number;
  atmospheric_refraction_deg: number;
  is_daylight: boolean;
  light_quality: 'golden' | 'blue' | 'harsh' | 'good' | 'dark';
  calculation_method: 'astral' | 'pysolar';
}

// ============================================================================
// HEALTH CHECK API TYPES (/api/v1/health)
// ============================================================================

export interface ComponentHealth {
  llm: 'connected' | 'disconnected' | 'unknown';
  graph: 'compiled' | 'error' | 'unknown';
  crowdcast: 'available' | 'unavailable';
  event_sentinel: 'available' | 'unavailable';
  golden_hour: 'available' | 'unavailable';
  physics_engine: string;       // e.g., "available (astral)"
  recommender: string;          // e.g., "available (80 locations)"
  ranker_agent: 'available' | 'unavailable';
  ranker_llm?: 'connected' | 'disconnected';
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  components: ComponentHealth;
}

// ============================================================================
// GRAPH VISUALIZATION API TYPES (/api/v1/graph)
// ============================================================================

export interface GraphResponse {
  diagram: string;              // Mermaid diagram string
}

// ============================================================================
// ERROR RESPONSE TYPE
// ============================================================================

export interface AIEngineError {
  detail: string;
  status_code?: number;
}

// ============================================================================
// SIMPLE API TYPES (location name only)
// ============================================================================

/**
 * Simple Crowd Prediction Request
 * POST /api/v1/simple/crowd
 */
export interface SimpleCrowdPredictionRequest {
  location_name: string;          // Location name (auto-detects type)
}

/**
 * Simple Crowd Prediction Response
 */
export interface SimpleCrowdPredictionResponse {
  location_name: string;
  location_type: string;
  prediction_date: string;
  prediction_time: string;
  crowd_level: number;
  crowd_percentage: number;
  crowd_status: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  recommendation: string;
  optimal_times: OptimalTime[];
  factors: {
    is_weekend: boolean;
    is_holiday: boolean;
    is_poya: boolean;
    weather_factor: number;
  };
}

/**
 * Simple Golden Hour Request
 * POST /api/v1/simple/golden-hour
 */
export interface SimpleGoldenHourRequest {
  location_name: string;          // Location name (auto-looks up coordinates)
}

/**
 * Simple Golden Hour Response
 */
export interface SimpleGoldenHourResponse {
  location_name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  date: string;
  timezone: string;
  sunrise: string;
  sunset: string;
  morning_golden_hour: {
    start: string;
    end: string;
    duration_minutes: number;
  };
  evening_golden_hour: {
    start: string;
    end: string;
    duration_minutes: number;
  };
  current_light_quality?: string;
  photography_recommendation: string;
}

/**
 * Simple Description Request
 * POST /api/v1/simple/description
 */
export interface SimpleDescriptionRequest {
  location_name: string;
  preference: UserPreferenceScores;
}

/**
 * Simple Description Response
 */
export interface SimpleDescriptionResponse {
  location_name: string;
  preference_scores: UserPreferenceScores;
  primary_focus: string;
  description: string;
  highlights: string[];
  best_time_to_visit?: string;
  tips: string[];
  related_activities: string[];
}

/**
 * Simple Recommendation Request
 * POST /api/v1/simple/recommend
 */
export interface SimpleRecommendationRequest {
  latitude: number;             // User's latitude (5.0-10.0 for Sri Lanka)
  longitude: number;            // User's longitude (79.0-82.0 for Sri Lanka)
  preferences?: UserPreferenceScores;  // User preference scores
  max_distance_km?: number;     // Max distance in km (default: 50)
  top_k?: number;               // Number of results (default: 5)
}

/**
 * Simple Recommendation Location
 */
export interface SimpleRecommendationLocation {
  rank: number;
  name: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  similarity_score: number;
  preference_scores: {
    history: number;
    adventure: number;
    nature: number;
    relaxation: number;
  };
  is_outdoor: boolean;
  description?: string;
}

/**
 * Simple Recommendation Response
 */
export interface SimpleRecommendationResponse {
  success: boolean;
  user_location: {
    lat: number;
    lng: number;
  };
  max_distance_km: number;
  total_found: number;
  recommendations: SimpleRecommendationLocation[];
}

/**
 * TypeScript interfaces for AI Engine API requests and responses
 * Based on the AI Agent Engine documentation (FastAPI Python backend)
 */

// ============================================================================
// USER PREFERENCE TYPES (used across multiple APIs)
// ============================================================================

export interface UserPreferenceScores {
  history: number; // 0-1: Interest in historical/cultural sites
  adventure: number; // 0-1: Interest in adventure activities
  nature: number; // 0-1: Interest in nature and wildlife
  relaxation: number; // 0-1: Interest in relaxation and leisure
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
  message: string; // User message (1-2000 chars)
  thread_id?: string; // Thread ID for conversation persistence
  user_id?: string; // User ID for user-specific chat history isolation
  stream?: boolean; // Enable streaming response (default: false)
  context?: ChatContext; // Optional context for chat
}

export interface ItinerarySlot {
  time: string; // e.g., "16:30"
  location: string; // Destination name
  activity: string; // What to do
  duration_minutes: number; // Suggested duration
  crowd_prediction: number; // Expected crowd (0-100)
  lighting_quality: string; // "golden", "harsh", "good", "dark"
  notes?: string; // Special considerations
  day?: number; // Day number in multi-day trip
  order?: number; // Order within the day
  icon?: string; // Icon name for UI display
  highlight?: boolean; // Whether this is a highlighted activity
  ai_insight?: string; // AI-generated insight for this activity
  cultural_tip?: string; // Cultural etiquette tip for this activity
  ethical_note?: string; // Ethical note (e.g., photography restrictions)
  best_photo_time?: string; // Best time for photography at this location
}

export interface ConstraintViolation {
  constraint_type: string; // e.g., "poya_alcohol"
  description: string; // Human-readable explanation
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string; // Corrective action
}

export interface ReasoningLog {
  timestamp: string; // ISO format
  check_type: string; // "event_sentinel", "crowdcast", "golden_hour"
  result: string; // "ok", "warning", "blocked"
  details: string; // Additional info
}

export interface ChatResponse {
  query: string; // Original user query
  intent: 'greeting' | 'tourism_query' | 'trip_planning' | 'real_time_info' | 'off_topic';
  response: string; // Final generated response
  itinerary?: ItinerarySlot[]; // Structured plan (for trip_planning)
  constraints?: ConstraintViolation[];
  reasoning_logs?: ReasoningLog[];
  metadata: {
    reasoning_loops: number; // 0-2
    documents_retrieved: number;
    web_search_used: boolean;
  };
}

// ============================================================================
// TOUR PLAN GENERATION API TYPES (/api/v1/tour-plan/generate)
// ============================================================================

export interface SelectedLocation {
  name: string; // Location name
  latitude: number; // Latitude coordinate
  longitude: number; // Longitude coordinate
  image_url?: string; // Location image URL
  distance_km?: number; // Distance from user's location
}

/**
 * User preferences payload sent to AI Engine for tour plan personalization.
 * Combines preference scores with travel style details.
 */
export interface TourPlanUserPreferences {
  history: number; // 0-1: Interest in historical/cultural sites
  adventure: number; // 0-1: Interest in adventure activities
  nature: number; // 0-1: Interest in nature and wildlife
  relaxation: number; // 0-1: Interest in relaxation and leisure
  pace?: 'slow' | 'moderate' | 'fast';
  budget?: 'budget' | 'mid-range' | 'luxury';
  group_size?: 'solo' | 'couple' | 'small-group' | 'large-group';
  dietary?: string[];
  accessibility?: boolean;
}

/**
 * A single step result from the AI Engine's agentic processing pipeline.
 * Each step represents one tool/agent invocation during plan generation.
 */
export interface TourPlanStepResult {
  step: string; // Step name (e.g., "crowd_check", "golden_hour", "event_sentinel")
  status: 'ok' | 'warning' | 'error';
  summary: string; // Human-readable summary of what this step found
  data?: Record<string, unknown>; // Raw data from the step
}

export interface TourPlanGenerateRequest {
  selected_locations: SelectedLocation[]; // List of locations to include
  start_date: string; // Trip start date (YYYY-MM-DD)
  end_date: string; // Trip end date (YYYY-MM-DD)
  thread_id?: string; // Session ID for conversation continuity
  user_id?: string; // User ID for user-specific chat history isolation
  preferences?: string[]; // User preferences (e.g., ["photography", "nature"])
  message?: string; // Optional message for plan generation/refinement
  user_preferences?: TourPlanUserPreferences; // Structured user preferences for personalization
  conversation_history?: ConversationMessage[]; // Previous messages for refinement context
  selected_restaurant_ids?: string[]; // IDs of restaurants the user selected from recommendations
  selected_accommodation_ids?: string[]; // IDs of accommodations the user selected from recommendations
  skip_restaurants?: boolean; // Skip restaurant recommendations entirely
  skip_accommodations?: boolean; // Skip accommodation recommendations entirely
}

export interface TourPlanMetadata {
  match_score: number; // Overall match score (0-100)
  total_days: number; // Number of days in the plan
  total_locations: number; // Number of locations covered
  golden_hour_optimized: boolean;
  crowd_optimized: boolean;
  event_aware: boolean;
  preference_match_explanation?: string; // Why this plan matches user preferences
}

/**
 * Structured clarification question from the AI agent.
 * Displayed as interactive options in the mobile UI.
 */
export interface ClarificationOption {
  label: string;
  description: string;
  recommended: boolean;
}

export interface ClarificationQuestion {
  question: string;
  options: ClarificationOption[];
  context: string;
  type: 'single_select' | 'multi_select';
}

/**
 * Cultural tip for a specific location.
 */
export interface CulturalTip {
  location: string;
  tip: string;
  category: 'cultural' | 'ethical' | 'safety' | 'etiquette';
}

export interface TourPlanResponse {
  success: boolean;
  thread_id: string; // Session ID for conversation continuity
  response: string; // Generated response text summary
  itinerary: ItinerarySlot[]; // List of itinerary slots organized by day
  metadata: TourPlanMetadata; // Plan metadata with scores
  constraints?: ConstraintViolation[];
  reasoning_logs?: ReasoningLog[];
  warnings?: string[]; // List of warnings for the plan
  tips?: string[]; // Helpful tips for the trip
  step_results?: TourPlanStepResult[]; // Agentic pipeline step results
  clarification_question?: ClarificationQuestion; // Structured question when input is ambiguous
  cultural_tips?: CulturalTip[]; // Sri Lanka-specific cultural tips/etiquette
  events?: EventInfo[]; // Special events/holidays for the trip dates
  final_itinerary?: FinalItinerary; // Map-ready structured itinerary with coordinates
  weather_data?: Record<string, any>; // Per-location weather forecasts
  interrupt_reason?: string; // Constraint interrupt reason (e.g., "heavy_rain", "poya_day")
  restaurant_recommendations?: RestaurantRecommendation[]; // Top 3 restaurants per meal slot (skippable)
  accommodation_recommendations?: AccommodationRecommendation[]; // Top 3 hotels per overnight (2+ day trips, skippable)
  // ── HITL Interrupt Fields ──
  pending_user_selection?: boolean; // True when graph is paused waiting for user selection
  selection_cards?: SelectionCard[]; // Pre-formatted UI cards for mobile selection
  prompt_text?: string; // Short header text for mobile selection prompt (e.g. 'Pick a restaurant')
  search_candidates?: SearchCandidate[]; // Raw grounded candidates from MCP search
  mcp_search_metadata?: Record<string, any>; // MCP search pipeline metadata
  weather_interrupt?: boolean; // True when graph is paused due to severe weather
  weather_prompt_message?: string; // Human-readable weather warning message
  weather_prompt_options?: WeatherPromptOption[]; // Options for user weather decision
}

export interface EventInfo {
  date: string;
  name: string;
  type: string; // 'poya' | 'holiday' | 'festival' | 'school_holiday'
  impact: string;
  warnings: string[];
}

// ============================================================================
// FINAL ITINERARY TYPES (Map-Ready Structured Output)
// ============================================================================

export interface RouteCoordinate {
  lat: number;
  lng: number;
  location_name: string;
  sequence_id: number;
}

export interface ContextualNote {
  sequence_id: number;
  location_name: string;
  note_type: string; // "poya_warning" | "weather_alert" | "safety_alert" | "crowd_warning"
  message: string;
  severity: string; // "info" | "warning" | "critical"
}

export interface FinalItineraryStop {
  sequence_id: number;
  day: number;
  time: string;
  location: string;
  activity: string;
  duration_minutes: number;
  coordinates: { lat: number; lng: number };
  crowd_prediction: number;
  lighting_quality: string;
  weather_summary?: string;
  icon?: string;
  highlight?: boolean;
  ai_insight?: string;
  cultural_tip?: string;
  ethical_note?: string;
  best_photo_time?: string;
  notes?: string;
  // ── Visual Hierarchy Fields ──
  visual_hierarchy?: number; // 1=must-see, 2=recommended, 3=optional
  best_for_photos?: boolean; // True when Golden Hour identifies premium photo conditions
  photo_urls?: string[]; // Photo URLs for image carousel
}

export interface FinalItinerary {
  stops: FinalItineraryStop[];
  route_polyline: RouteCoordinate[];
  contextual_notes: ContextualNote[];
  total_distance_km: number;
  total_days: number;
  summary: string;
  warnings: string[];
  tips: string[];
  route_geometry?: Record<string, any>[]; // GeoJSON FeatureCollection for Mapbox/Google Maps
}

// ============================================================================
// HOTEL / RESTAURANT SEARCH TYPES
// ============================================================================

export interface HotelSearchResult {
  name: string;
  type: string; // "hotel" | "restaurant" | "bar"
  price_range?: string; // "$" | "$$" | "$$$"
  rating?: number; // 0-5
  url?: string;
  description: string;
  distance_from_location?: string;
  location_name: string;
}

export interface HotelSearchResponse {
  success: boolean;
  query: string;
  search_type: string;
  location: string;
  results: HotelSearchResult[];
  total_results: number;
}

// ============================================================================
// RESTAURANT & ACCOMMODATION RECOMMENDATION TYPES
// ============================================================================

export interface RestaurantRecommendation {
  id: string; // Unique selection ID (e.g., "rest_d1_lunch_1")
  name: string;
  rating?: number; // 0-5
  cuisine_type?: string; // "Sri Lankan", "International", etc.
  price_range?: string; // "$", "$$", "$$$"
  url?: string;
  description: string;
  near_location: string; // Which itinerary location this is near
  meal_slot: 'breakfast' | 'lunch' | 'dinner';
  day: number;
}

export interface AccommodationRecommendation {
  id: string; // Unique selection ID (e.g., "hotel_d1_1")
  name: string;
  rating?: number; // 0-5
  price_range?: string; // "$", "$$", "$$$"
  url?: string;
  description: string;
  near_location: string; // Near which itinerary location
  check_in_day: number;
  type: 'hotel' | 'resort' | 'guesthouse';
}

// ============================================================================
// HITL SELECTION & WEATHER INTERRUPT TYPES
// ============================================================================

/**
 * A pre-formatted UI card for the mobile selection picker.
 * Produced by the Advanced Multi-Step Search (MCP pipeline).
 */
export interface SelectionCard {
  card_id: string; // Maps to SearchCandidate.id
  title: string; // Display name
  subtitle?: string; // e.g., "Boutique Hotel · Galle"
  badge?: string; // "Top Pick", "Best Value", "Verified"
  image_url?: string; // Primary display image
  photo_urls?: string[]; // Full photo carousel
  rating?: number; // 0-5
  price_range?: string; // "$", "$$", "$$$"
  vibe_match_score?: number; // 0-100 match to user preferences
  description?: string; // Short blurb
  tags?: string[]; // ["pool", "wifi", "breakfast"]
  distance_km?: number; // Distance from itinerary anchor
}

/**
 * A raw search candidate from the MCP grounding pipeline.
 */
export interface SearchCandidate {
  id: string;
  name: string;
  type: string; // "hotel", "restaurant", "activity"
  description: string;
  price_range?: string;
  rating?: number;
  opening_hours?: string;
  lat?: number;
  lng?: number;
  url?: string;
  location_name: string;
  vibe_match_score?: number;
  photo_urls?: string[];
}

/**
 * An option in the weather interrupt prompt.
 */
export interface WeatherPromptOption {
  id: string; // "switch_indoor" | "reschedule" | "keep"
  label: string; // Display label
  description: string; // Explanation of what this choice does
}

/**
 * Request to resume the graph after HITL selection.
 */
export interface ResumeSelectionRequest {
  threadId: string;
  selectedCandidateId: string;
}

/**
 * Request to resume the graph after weather interrupt decision.
 */
export interface ResumeWeatherRequest {
  threadId: string;
  userWeatherChoice: 'switch_indoor' | 'reschedule' | 'keep';
}

// ============================================================================
// LOCATION CHAT API TYPES (/api/v1/chat/location)
// ============================================================================

export interface ConversationMessage {
  role: 'user' | 'assistant'; // Message role
  content: string; // Message content
}

export interface LocationChatRequest {
  message: string; // User message (1-2000 chars)
  thread_id?: string; // Thread ID for conversation persistence
  user_id?: string; // User ID for user-specific chat history isolation
  location_name: string; // Location to focus on (2-100 chars)
  user_preferences?: UserPreferenceScores; // User preference scores
  conversation_history?: ConversationMessage[]; // Previous messages for context
}

// Location chat uses the same ChatResponse type

// ============================================================================
// RECOMMENDATION API TYPES (/api/v1/recommend)
// ============================================================================

export interface RecommendationRequest {
  current_lat: number; // User latitude (5.0-10.0 for Sri Lanka)
  current_lng: number; // User longitude (79.0-82.0 for Sri Lanka)
  preferences?: {
    history?: number; // 0-1 (default: 0.5)
    adventure?: number; // 0-1 (default: 0.5)
    nature?: number; // 0-1 (default: 0.5)
    relaxation?: number; // 0-1 (default: 0.5)
  };
  top_k?: number; // Number of results (1-10, default: 3)
  max_distance_km?: number; // Search radius (1-500, default: 20)
  target_datetime?: string; // ISO format target visit time
  outdoor_only?: boolean; // Filter outdoor locations only
  exclude_locations?: string[]; // Location names to exclude
  user_id?: string; // User ID for tracking
}

export interface ConstraintCheck {
  constraint_type: string; // "crowd", "lighting", "holiday"
  status: 'ok' | 'warning' | 'blocked';
  value: number;
  message: string;
}

export interface RecommendationItem {
  rank: number;
  name: string;
  latitude: number;
  longitude: number;
  similarity_score: number; // 0-1
  distance_km: number;
  combined_score: number; // 0-1
  preference_scores: {
    history: number;
    adventure: number;
    nature: number;
    relaxation: number;
  };
  is_outdoor: boolean;
  constraint_checks?: ConstraintCheck[];
  reasoning?: string; // LLM-generated explanation
  optimal_visit_time?: string; // Best time to visit
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
  top_k?: number; // Default: 5
  max_distance_km?: number; // Default: 50
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
  location_type: string; // e.g., "heritage", "beach", "temple"
  target_datetime: string; // ISO format
  is_poya?: boolean; // Override for Poya day
  is_school_holiday?: boolean; // Override for school holiday
}

export interface OptimalTime {
  time: string;
  crowd: number;
}

export interface CrowdPredictionResponse {
  crowd_level: number; // 0-1 normalized
  crowd_percentage: number; // 0-100%
  crowd_status: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  recommendation: string;
  optimal_times?: OptimalTime[];
}

// ============================================================================
// EVENT SENTINEL API TYPES (/api/v1/events/impact)
// ============================================================================

export interface EventImpactRequest {
  location_name: string; // Fuzzy matched location
  target_date: string; // YYYY-MM-DD format
  activity_type?: string; // e.g., "nightlife", "photography"
}

export interface BridgeInfo {
  is_bridge_day: boolean;
  bridge_type?:
    | 'MONDAY_BRIDGE'
    | 'FRIDAY_BRIDGE'
    | 'DOUBLE_BRIDGE'
    | 'MONDAY_NATURAL'
    | 'FRIDAY_NATURAL';
  potential_long_weekend_days: number;
  adjacent_dates: string[];
}

export interface TemporalContext {
  uid: string;
  name: string;
  date: string;
  day_of_week: string;
  day_number: number; // ISO weekday (1=Mon, 7=Sun)
  categories: string[]; // ["Public", "Bank", "Poya", "Mercantile"]
  is_poya: boolean;
  is_mercantile: boolean;
  bridge_info: BridgeInfo;
}

export interface LocationSensitivity {
  location_name: string;
  match_confidence: number; // 0-1
  l_rel: number; // Religious score
  l_nat: number; // Nature score
  l_hist: number; // History score
  l_adv: number; // Adventure score
  sensitivity_flags: string[]; // ["HIGH_RELIGIOUS_SITE", "VESAK_PEAK_PERIOD", etc.]
}

export interface EventConstraint {
  constraint_type: 'HARD_CONSTRAINT' | 'SOFT_CONSTRAINT' | 'WARNING';
  code: string; // e.g., "POYA_ALCOHOL_BAN"
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
  latitude: number; // -90 to 90
  longitude: number; // -180 to 180
  date: string; // YYYY-MM-DD
  elevation_m?: number; // Observer elevation (default: 0, max: 3000)
  location_name?: string; // Human-readable name
  include_current_position?: boolean; // Include real-time sun position
}

export interface TimeWindow {
  start: string; // UTC timestamp
  end: string; // UTC timestamp
  start_local: string; // Local time string (HH:MM:SS)
  end_local: string; // Local time string
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
  timezone: string; // Always "Asia/Colombo"
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
  physics_engine: string; // e.g., "available (astral)"
  recommender: string; // e.g., "available (80 locations)"
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
  diagram: string; // Mermaid diagram string
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
  location_name: string; // Location name (auto-detects type)
  date?: string; // Optional date in YYYY-MM-DD format
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
  location_name: string; // Location name (auto-looks up coordinates)
  date?: string; // Optional date in YYYY-MM-DD format
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
  latitude: number; // User's latitude (5.0-10.0 for Sri Lanka)
  longitude: number; // User's longitude (79.0-82.0 for Sri Lanka)
  preferences?: UserPreferenceScores; // User preference scores
  max_distance_km?: number; // Max distance in km (default: 50)
  top_k?: number; // Number of results (default: 5)
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

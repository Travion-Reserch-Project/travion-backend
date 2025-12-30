/**
 * AI Engine API Configuration
 * Centralized configuration for connecting to the Python ML/AI Engine service
 */

export interface AIEngineConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  endpoints: {
    // Chat & Conversation
    chat: string;
    // Recommendations
    recommend: string;
    explain: string;
    nearbyLocations: string;
    // CrowdCast
    crowd: string;
    // Event Sentinel
    events: string;
    eventImpact: string;
    // Golden Hour / Physics
    goldenHour: string;
    physicsGoldenHour: string;
    sunPosition: string;
    // Health
    health: string;
    graph: string;
    // Simple APIs (location name only)
    simpleCrowd: string;
    simpleGoldenHour: string;
    simpleDescription: string;
    simpleRecommend: string;
  };
}

/**
 * Get AI Engine configuration with values from environment variables
 * Uses a factory function to ensure fresh values on each call
 */
const getAIEngineConfig = (): AIEngineConfig => ({
  baseUrl: process.env.AI_ENGINE_BASE_URL || 'http://localhost:8001',
  timeout: parseInt(process.env.AI_ENGINE_TIMEOUT || '30000', 10),
  retryAttempts: parseInt(process.env.AI_ENGINE_RETRY_ATTEMPTS || '3', 10),
  retryDelay: parseInt(process.env.AI_ENGINE_RETRY_DELAY || '1000', 10),
  endpoints: {
    // Chat & Conversation
    chat: '/api/v1/chat',
    // Recommendations
    recommend: '/api/v1/recommend',
    explain: '/api/v1/explain',
    nearbyLocations: '/api/v1/locations/nearby',
    // CrowdCast
    crowd: '/api/v1/crowd',
    // Event Sentinel
    events: '/api/v1/events',
    eventImpact: '/api/v1/events/impact',
    // Golden Hour / Physics
    goldenHour: '/api/v1/golden-hour',
    physicsGoldenHour: '/api/v1/physics/golden-hour',
    sunPosition: '/api/v1/physics/sun-position',
    // Health
    health: '/api/v1/health',
    graph: '/api/v1/graph',
    // Simple APIs (location name only)
    simpleCrowd: '/api/v1/simple/crowd',
    simpleGoldenHour: '/api/v1/simple/golden-hour',
    simpleDescription: '/api/v1/simple/description',
    simpleRecommend: '/api/v1/simple/recommend',
  },
});

// Export as a proxy to always get fresh config values
export const aiEngineConfig = new Proxy({} as AIEngineConfig, {
  get: (_target, prop: keyof AIEngineConfig) => {
    const config = getAIEngineConfig();
    return config[prop];
  },
});

export default aiEngineConfig;

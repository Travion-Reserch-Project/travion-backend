import axios, { AxiosResponse } from 'axios';

export interface MLServiceConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  retryDelay: number;
}

export interface MLServiceRequest {
  query: string;
  userLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  context?: {
    userId: string;
    sessionId: string;
    language?: string;
  };
}

export interface MLServiceResponse {
  success: boolean;
  data: {
    response: string;
    recommendations?: Array<{
      type: string;
      details: any;
      confidence: number;
    }>;
    queryType: string;
    processingTime: number;
  };
  error?: {
    message: string;
    code: string;
  };
}

export interface MLServiceHealth {
  status: 'healthy' | 'unhealthy';
  version?: string;
  uptime?: number;
  lastCheck: Date;
}

export class MLService {
  private config: MLServiceConfig;
  private healthStatus: MLServiceHealth;

  constructor(config?: Partial<MLServiceConfig>) {
    this.config = {
      baseURL: 'http://localhost:8001',
      timeout: 30000, // 30 seconds
      retries: 3,
      retryDelay: 1000, // 1 second
      ...config,
    };

    this.healthStatus = {
      status: 'unhealthy',
      lastCheck: new Date(),
    };

    // Check health on initialization
    this.checkHealth();
  }

  /**
   * Send a query to the ML service
   */
  async sendQuery(request: MLServiceRequest): Promise<{
    response: MLServiceResponse | null;
    latency: number;
    status: 'success' | 'error' | 'timeout' | 'unavailable';
    errorDetails?: any;
  }> {
    const startTime = Date.now();
    let attempt = 0;

    while (attempt < this.config.retries) {
      try {
        const response = await this.makeRequest('/api/query', request);
        const latency = Date.now() - startTime;

        return {
          response: response.data,
          latency,
          status: 'success',
        };
      } catch (error: any) {
        attempt++;
        const latency = Date.now() - startTime;

        // If it's the last attempt, return the error
        if (attempt >= this.config.retries) {
          const status = this.determineErrorStatus(error);
          return {
            response: null,
            latency,
            status,
            errorDetails: {
              message: error.message || 'Unknown error',
              code: error.code || 'UNKNOWN',
              response: error.response?.data,
              status: error.response?.status,
            },
          };
        }

        // Wait before retry
        await this.delay(this.config.retryDelay * attempt);
      }
    }

    // This should never be reached, but just in case
    return {
      response: null,
      latency: Date.now() - startTime,
      status: 'error',
      errorDetails: { message: 'Max retries exceeded' },
    };
  }

  /**
   * Check the health of the ML service
   */
  async checkHealth(): Promise<MLServiceHealth> {
    try {
      const response = await axios.get(`${this.config.baseURL}/health`, {
        timeout: 5000, // 5 seconds for health check
      });

      this.healthStatus = {
        status: 'healthy',
        version: response.data.version,
        uptime: response.data.uptime,
        lastCheck: new Date(),
      };
    } catch (error) {
      this.healthStatus = {
        status: 'unhealthy',
        lastCheck: new Date(),
      };
    }

    return this.healthStatus;
  }

  /**
   * Get current health status
   */
  getHealthStatus(): MLServiceHealth {
    return { ...this.healthStatus };
  }

  /**
   * Detect query type based on keywords and content
   */
  detectQueryType(
    query: string
  ): 'transport' | 'general' | 'location' | 'recommendation' | 'other' {
    const lowerQuery = query.toLowerCase();

    // Transport keywords
    const transportKeywords = [
      'bus',
      'train',
      'metro',
      'taxi',
      'uber',
      'grab',
      'transport',
      'travel',
      'route',
      'direction',
      'navigation',
      'ride',
      'journey',
      'trip',
      'station',
      'stop',
      'schedule',
      'timetable',
      'fare',
      'ticket',
    ];

    // Location keywords
    const locationKeywords = [
      'where',
      'location',
      'address',
      'place',
      'near',
      'nearby',
      'distance',
      'map',
      'gps',
      'coordinates',
    ];

    // Recommendation keywords
    const recommendationKeywords = [
      'recommend',
      'suggest',
      'best',
      'fastest',
      'cheapest',
      'optimal',
      'prefer',
      'option',
      'alternative',
      'choice',
    ];

    // Check for transport-related queries
    if (transportKeywords.some((keyword) => lowerQuery.includes(keyword))) {
      return 'transport';
    }

    // Check for location-related queries
    if (locationKeywords.some((keyword) => lowerQuery.includes(keyword))) {
      return 'location';
    }

    // Check for recommendation queries
    if (recommendationKeywords.some((keyword) => lowerQuery.includes(keyword))) {
      return 'recommendation';
    }

    // Default to general if no specific patterns found
    return 'general';
  }

  /**
   * Format ML service response into conversational text
   */
  formatResponse(mlResponse: MLServiceResponse, queryType: string): string {
    try {
      if (!mlResponse.success || !mlResponse.data) {
        return this.getFallbackResponse(queryType);
      }

      let formattedText = mlResponse.data.response;

      // Add recommendations if available
      if (mlResponse.data.recommendations && mlResponse.data.recommendations.length > 0) {
        formattedText += '\n\nHere are some recommendations:\n';
        mlResponse.data.recommendations.forEach((rec, index) => {
          formattedText += `${index + 1}. ${rec.type}: ${this.formatRecommendation(rec.details)}\n`;
        });
      }

      return formattedText;
    } catch (error) {
      console.error('Error formatting ML response:', error);
      return this.getFallbackResponse(queryType);
    }
  }

  /**
   * Get fallback response when ML service is unavailable
   */
  private getFallbackResponse(queryType: string): string {
    const fallbackResponses = {
      transport:
        "I'm sorry, I'm having trouble accessing transport information right now. Please try again in a moment or contact support if the issue persists.",
      location:
        "I'm currently unable to process location queries. Please try again later or provide more specific details.",
      recommendation:
        "I'm sorry, I can't provide recommendations at the moment due to a temporary service issue. Please try again soon.",
      general:
        "I'm experiencing some technical difficulties right now. Please try again in a few moments.",
      other: "I'm sorry, I'm unable to process your request at the moment. Please try again later.",
    };

    return (
      fallbackResponses[queryType as keyof typeof fallbackResponses] || fallbackResponses.other
    );
  }

  /**
   * Format individual recommendation details
   */
  private formatRecommendation(details: any): string {
    try {
      if (typeof details === 'string') {
        return details;
      }

      if (details && typeof details === 'object') {
        if (details.description) {
          return details.description;
        }

        // Format transport recommendation
        if (details.route || details.duration || details.cost) {
          let formatted = '';
          if (details.route) formatted += `Route: ${details.route} `;
          if (details.duration) formatted += `(${details.duration}) `;
          if (details.cost) formatted += `- Cost: ${details.cost}`;
          return formatted.trim();
        }

        // Generic object formatting
        return Object.entries(details)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
      }

      return String(details);
    } catch (error) {
      return 'Details unavailable';
    }
  }

  /**
   * Make HTTP request to ML service
   */
  private async makeRequest(endpoint: string, data: any): Promise<AxiosResponse> {
    return axios.post(`${this.config.baseURL}${endpoint}`, data, {
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Determine error status from axios error
   */
  private determineErrorStatus(error: any): 'error' | 'timeout' | 'unavailable' {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return 'timeout';
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return 'unavailable';
    }

    return 'error';
  }

  /**
   * Utility function to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

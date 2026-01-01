import axios from 'axios';
import { TripExtraction } from './LLMService';

export interface RecommendationResponse {
  success: boolean;
  [key: string]: any;
}

export class RecommendationService {
  private endpoint: string;
  private timeoutMs: number;

  constructor(
    endpoint: string = process.env.RECOMMENDATION_API_URL || 'http://localhost:8001/api/recommend',
    timeoutMs: number = 15000
  ) {
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }

  async getRecommendations(payload: TripExtraction): Promise<RecommendationResponse> {
    const response = await axios.post(
      this.endpoint,
      {
        origin: payload.origin,
        destination: payload.destination,
        departure_date: payload.departureDate,
        departure_time: payload.departureTime,
      },
      {
        timeout: this.timeoutMs,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data as RecommendationResponse;
  }
}

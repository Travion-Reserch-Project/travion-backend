import { logger } from '../../../../shared/config/logger';
import { RouteContext } from './RouteContextBuilder';
import { MLService } from './MLService';
import { MLFeatureExtractor } from '../utils/MLFeatureExtractor';
import { MLPredictionFilter } from '../utils/MLPredictionFilter';
import { WeatherService } from './WeatherService';
import { TrafficService } from './TrafficService';
import { HolidayService } from '../utils/HolidayService';

export interface UserWeights {
  speed_weight: number; // 0-1
  budget_weight: number; // 0-1
  comfort_weight: number; // 0-1
  scenic_weight: number; // 0-1
  safety_weight: number; // 0-1
}

export interface RankedRoute extends RouteContext {
  score: number;
  ml_confidence?: number; // ML prediction confidence
  ml_prediction?: string; // ML predicted transport mode
  scoreBreakdown: {
    speed_score: number;
    budget_score: number;
    comfort_score: number;
    scenic_score: number;
    safety_score: number;
    weather_penalty: number;
    traffic_penalty: number;
    accident_penalty: number;
    ml_boost?: number; // Boost from ML confidence
    final_score: number;
  };
}

/**
 * RankingService implements hybrid route ranking
 * Combines rule-based scoring with ML predictions
 */
export class RankingService {
  private defaultWeights: UserWeights = {
    speed_weight: 0.25,
    budget_weight: 0.25,
    comfort_weight: 0.2,
    scenic_weight: 0.15,
    safety_weight: 0.15,
  };

  private mlService: MLService;
  private mlFeatureExtractor: MLFeatureExtractor;

  constructor() {
    logger.info('RankingService initialized');

    // Initialize ML components
    this.mlService = new MLService();
    const weatherService = new WeatherService();
    const trafficService = new TrafficService();
    const holidayService = new HolidayService();
    this.mlFeatureExtractor = new MLFeatureExtractor(
      weatherService,
      trafficService,
      holidayService
    );

    if (process.env.USE_ML === 'true') {
      logger.info('ML ranking is enabled - will use ML service when available');
    }
  }

  /**
   * Rank routes using rule-based scoring
   * Can be replaced with ML-based ranking if USE_ML=true
   */
  async rankRoutes(
    routeContexts: RouteContext[],
    userWeights?: Partial<UserWeights>,
    coordinates?: {
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
      departureTime?: Date;
    }
  ): Promise<RankedRoute[]> {
    try {
      if (routeContexts.length === 0) {
        logger.warn('No routes to rank');
        return [];
      }

      // Use ML ranking if enabled and coordinates provided
      if (process.env.USE_ML === 'true' && coordinates) {
        return await this.rankRoutesWithML(routeContexts, coordinates, userWeights);
      }

      // Default rule-based ranking
      return this.rankRoutesRuleBased(routeContexts, userWeights);
    } catch (error) {
      logger.error('Error ranking routes:', error);
      // Fallback to rule-based if ML fails
      return this.rankRoutesRuleBased(routeContexts, userWeights);
    }
  }

  /**
   * Rule-based ranking algorithm
   */
  private rankRoutesRuleBased(
    routeContexts: RouteContext[],
    userWeights?: Partial<UserWeights>
  ): RankedRoute[] {
    const weights = { ...this.defaultWeights, ...userWeights };

    const rankedRoutes = routeContexts
      .map((route): RankedRoute => {
        // Normalize scores (lower is better for negative factors)
        const speedScore = 1 / (1 + route.dynamic.duration_min / 60); // Faster routes score higher
        const budgetScore = 1 / (1 + route.static.base_fare_lkr / 500); // Cheaper routes score higher
        const comfortScore = route.static.comfort_score || 0.5;
        const scenicScore = route.static.scenic_score || 0.5;
        const safetyScore = 1 - route.dynamic.accident_risk;

        // Calculate penalties
        const weatherPenalty = route.dynamic.weather_risk * 0.15; // Up to -0.15
        const trafficPenalty = Math.min(route.dynamic.traffic_delay_min / 100, 0.1); // Up to -0.1
        const accidentPenalty = route.dynamic.accident_risk * 0.1; // Up to -0.1

        // Weighted final score
        const finalScore =
          weights.speed_weight * speedScore +
          weights.budget_weight * budgetScore +
          weights.comfort_weight * comfortScore +
          weights.scenic_weight * scenicScore +
          weights.safety_weight * safetyScore -
          weatherPenalty -
          trafficPenalty -
          accidentPenalty;

        return {
          ...route,
          score: Math.max(0, Math.min(1, finalScore)), // Normalize to 0-1
          scoreBreakdown: {
            speed_score: speedScore,
            budget_score: budgetScore,
            comfort_score: comfortScore,
            scenic_score: scenicScore,
            safety_score: safetyScore,
            weather_penalty: weatherPenalty,
            traffic_penalty: trafficPenalty,
            accident_penalty: accidentPenalty,
            final_score: finalScore,
          },
        };
      })
      .sort((a, b) => b.score - a.score); // Higher score = better

    logger.info(`Ranked ${rankedRoutes.length} routes:`, {
      topRoute: rankedRoutes[0]?.route_id,
      topScore: rankedRoutes[0]?.score,
    });

    return rankedRoutes;
  }

  /**
   * ML-based ranking using external ML service
   * Hybrid approach: Combines ML confidence with rule-based scoring
   */
  private async rankRoutesWithML(
    routeContexts: RouteContext[],
    coordinates: {
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
      departureTime?: Date;
    },
    userWeights?: Partial<UserWeights>
  ): Promise<RankedRoute[]> {
    logger.info('Using ML-based ranking for route optimization');

    try {
      // Get available transport types from routes
      const availableTypes = [...new Set(routeContexts.map((r) => r.static.transport_type))];
      logger.info('Available transport types:', availableTypes);

      // Get ML predictions for each route
      const routesWithML = await Promise.all(
        routeContexts.map(async (route) => {
          try {
            // Extract ML features from route context
            const features = await this.mlFeatureExtractor.extractFeatures({
              distance_km: route.dynamic.distance_km,
              origin: {
                lat: coordinates.origin.lat,
                lng: coordinates.origin.lng,
                isUrban: true, // TODO: Get from city data
              },
              destination: {
                lat: coordinates.destination.lat,
                lng: coordinates.destination.lng,
              },
              departureTime: coordinates.departureTime || new Date(),
            });

            // Get ML prediction
            const mlPrediction = await this.mlService.predictTransportModeWithFeatures(features);

            // Filter ML scores to only include available transport types
            const routeType = route.static.transport_type.toLowerCase();

            // Get normalized confidence score for this route based on available options
            const routeConfidence = MLPredictionFilter.getRouteConfidence(
              routeType,
              mlPrediction.all_scores,
              availableTypes
            );

            logger.debug(
              `Route ${route.route_id} (${routeType}): ML confidence ${routeConfidence.toFixed(3)}`
            );

            // Get best available type if original prediction not available
            const bestAvailable = MLPredictionFilter.getBestAvailableType(
              mlPrediction.all_scores,
              availableTypes
            );

            return {
              route,
              mlPrediction: bestAvailable?.type || mlPrediction.prediction,
              mlConfidence: routeConfidence,
              features,
              originalPrediction: mlPrediction.prediction,
              allScores: mlPrediction.all_scores,
            };
          } catch (error) {
            logger.warn(`Error getting ML prediction for route ${route.route_id}:`, error);
            return {
              route,
              mlPrediction: null,
              mlConfidence: 0.3,
              features: null,
              originalPrediction: null,
              allScores: {},
            };
          }
        })
      );

      // Log ML filtering results
      const firstRouteWithML = routesWithML.find((r) => r.originalPrediction);
      if (firstRouteWithML) {
        logger.info('ML Prediction Filtering:', {
          originalPrediction: firstRouteWithML.originalPrediction,
          originalScores: firstRouteWithML.allScores,
          availableTypes,
          filteredBestType: firstRouteWithML.mlPrediction,
        });

        // Check if original prediction is unavailable
        if (
          firstRouteWithML.originalPrediction &&
          !MLPredictionFilter.isPredictionAvailable(
            firstRouteWithML.originalPrediction,
            availableTypes
          )
        ) {
          logger.warn(
            `ML predicted ${firstRouteWithML.originalPrediction} but it's not available. Using ${firstRouteWithML.mlPrediction} instead.`
          );
        }
      }

      // Combine ML scores with rule-based ranking
      const weights = { ...this.defaultWeights, ...userWeights };

      const rankedRoutes = routesWithML
        .map(({ route, mlPrediction, mlConfidence }): RankedRoute => {
          // Calculate rule-based scores
          const speedScore = 1 / (1 + route.dynamic.duration_min / 60);
          const budgetScore = 1 / (1 + route.static.base_fare_lkr / 500);
          const comfortScore = route.static.comfort_score || 0.5;
          const scenicScore = route.static.scenic_score || 0.5;
          const safetyScore = 1 - route.dynamic.accident_risk;

          // Calculate penalties
          const weatherPenalty = route.dynamic.weather_risk * 0.15;
          const trafficPenalty = Math.min(route.dynamic.traffic_delay_min / 100, 0.1);
          const accidentPenalty = route.dynamic.accident_risk * 0.1;

          // Rule-based score
          const ruleBasedScore =
            weights.speed_weight * speedScore +
            weights.budget_weight * budgetScore +
            weights.comfort_weight * comfortScore +
            weights.scenic_weight * scenicScore +
            weights.safety_weight * safetyScore -
            weatherPenalty -
            trafficPenalty -
            accidentPenalty;
          weights.comfort_weight * comfortScore +
            weights.scenic_weight * scenicScore +
            weights.safety_weight * safetyScore -
            weatherPenalty -
            trafficPenalty -
            accidentPenalty;

          // ML confidence boost (0-0.3 range)
          // High confidence routes get a significant boost
          const mlBoost = (mlConfidence - 0.3) * 0.5; // Scale to -0.15 to +0.35

          // Combine scores: 70% rule-based + 30% ML boost
          const finalScore = ruleBasedScore * 0.7 + mlBoost;

          return {
            ...route,
            score: Math.max(0, Math.min(1, finalScore)),
            ml_confidence: mlConfidence,
            ml_prediction: mlPrediction || undefined,
            scoreBreakdown: {
              speed_score: speedScore,
              budget_score: budgetScore,
              comfort_score: comfortScore,
              scenic_score: scenicScore,
              safety_score: safetyScore,
              weather_penalty: weatherPenalty,
              traffic_penalty: trafficPenalty,
              accident_penalty: accidentPenalty,
              ml_boost: mlBoost,
              final_score: finalScore,
            },
          };
        })
        .sort((a, b) => b.score - a.score);

      logger.info(`Ranked ${rankedRoutes.length} routes with ML:`, {
        topRoute: rankedRoutes[0]?.route_id,
        topScore: rankedRoutes[0]?.score.toFixed(3),
        mlConfidence: rankedRoutes[0]?.ml_confidence?.toFixed(3),
        mlPrediction: rankedRoutes[0]?.ml_prediction,
      });

      return rankedRoutes;
    } catch (error) {
      logger.error('Error in ML-based ranking, falling back to rule-based:', error);
      return this.rankRoutesRuleBased(routeContexts, userWeights);
    }
  }

  /**
   * Get user preferences based on query context
   */
  guessUserWeights(message: string): Partial<UserWeights> {
    const weights: Partial<UserWeights> = {};

    const lowerMessage = message.toLowerCase();

    // Speed preferences
    if (/fast|quick|rush|hurry|urgent|asap/i.test(lowerMessage)) {
      weights.speed_weight = 0.4;
      weights.budget_weight = 0.1;
    }

    // Budget preferences
    if (/cheap|budget|afford|price|cost|expensive/i.test(lowerMessage)) {
      weights.budget_weight = 0.4;
      weights.comfort_weight = 0.1;
    }

    // Comfort preferences
    if (/comfort|luxury|relax|comfortable|easy|convenient/i.test(lowerMessage)) {
      weights.comfort_weight = 0.4;
      weights.budget_weight = 0.1;
    }

    // Safety preferences
    if (/safe|safety|secure|dangerous|accident|risk/i.test(lowerMessage)) {
      weights.safety_weight = 0.35;
    }

    // Scenic preferences
    if (/scenic|view|beautiful|sight|landscape|nature|view/i.test(lowerMessage)) {
      weights.scenic_weight = 0.35;
    }

    return weights;
  }

  /**
   * Calculate total cost considering multiple factors
   */
  calculateTotalCost(route: RankedRoute): number {
    const baseFare = route.static.base_fare_lkr;
    const distanceSurcharge = route.dynamic.distance_km * 5; // 5 LKR per km
    const weatherSurcharge = route.dynamic.weather_risk * 100; // Max 100 LKR
    const trafficSurcharge = route.dynamic.traffic_delay_min * 2; // 2 LKR per minute delay

    return baseFare + distanceSurcharge + weatherSurcharge + trafficSurcharge;
  }
}

export const rankingService = new RankingService();

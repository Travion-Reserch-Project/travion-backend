import { logger } from '../../../../shared/config/logger';
import { RouteContext } from './RouteContextBuilder';

export interface UserWeights {
  speed_weight: number; // 0-1
  budget_weight: number; // 0-1
  comfort_weight: number; // 0-1
  scenic_weight: number; // 0-1
  safety_weight: number; // 0-1
}

export interface RankedRoute extends RouteContext {
  score: number;
  scoreBreakdown: {
    speed_score: number;
    budget_score: number;
    comfort_score: number;
    scenic_score: number;
    safety_score: number;
    weather_penalty: number;
    traffic_penalty: number;
    accident_penalty: number;
    final_score: number;
  };
}

/**
 * RankingService implements rule-based route ranking
 * ML integration is pluggable via environment variable
 */
export class RankingService {
  private defaultWeights: UserWeights = {
    speed_weight: 0.25,
    budget_weight: 0.25,
    comfort_weight: 0.2,
    scenic_weight: 0.15,
    safety_weight: 0.15,
  };

  constructor() {
    logger.info('RankingService initialized');
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
    userWeights?: Partial<UserWeights>
  ): Promise<RankedRoute[]> {
    try {
      if (routeContexts.length === 0) {
        logger.warn('No routes to rank');
        return [];
      }

      // Use ML ranking if enabled
      if (process.env.USE_ML === 'true') {
        return await this.rankRoutesWithML(routeContexts, userWeights);
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
   */
  private async rankRoutesWithML(
    routeContexts: RouteContext[],
    userWeights?: Partial<UserWeights>
  ): Promise<RankedRoute[]> {
    // Placeholder for ML integration
    // This would call the ML microservice with extracted features
    logger.info('Using ML-based ranking (not yet implemented, falling back to rule-based)');
    return this.rankRoutesRuleBased(routeContexts, userWeights);
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

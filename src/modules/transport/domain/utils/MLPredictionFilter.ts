import { logger } from '../../../../shared/config/logger';

/**
 * Helper to filter and adjust ML predictions based on actually available transport routes
 */
export class MLPredictionFilter {
  /**
   * Filter ML all_scores to only include available transport types and normalize
   *
   * Example:
   * - ML scores: { train: 0.999, bus: 0.00015, car: 0.00002, intercity: 0.00007 }
   * - Available: ['bus', 'car']
   * - Result: { bus: 0.882, car: 0.118 } (normalized from 0.00015 and 0.00002)
   */
  static filterAndNormalizeScores(
    allScores: {
      bus?: number;
      train?: number;
      car?: number;
      intercity?: number;
      [key: string]: number | undefined;
    },
    availableTypes: string[]
  ): Record<string, number> {
    // Map common variations to standard types
    const typeMap: Record<string, string> = {
      tuk_tuk: 'car',
      taxi: 'car',
    };

    // Normalize available types
    const normalizedAvailable = availableTypes.map((type) => typeMap[type] || type.toLowerCase());

    logger.info('Filtering ML scores:', {
      originalScores: allScores,
      availableTypes: normalizedAvailable,
    });

    // Filter scores to only available types
    const filteredScores: Record<string, number> = {};
    let totalScore = 0;

    for (const [type, score] of Object.entries(allScores)) {
      if (score !== undefined && normalizedAvailable.includes(type)) {
        filteredScores[type] = score;
        totalScore += score;
      }
    }

    // If no available types match ML predictions, distribute equally
    if (totalScore === 0 || Object.keys(filteredScores).length === 0) {
      logger.warn('No ML scores match available transport types, using equal distribution');
      const equalScore = 1.0 / normalizedAvailable.length;
      normalizedAvailable.forEach((type) => {
        filteredScores[type] = equalScore;
      });
      return filteredScores;
    }

    // Normalize so filtered scores sum to 1.0
    const normalizedScores: Record<string, number> = {};
    for (const [type, score] of Object.entries(filteredScores)) {
      normalizedScores[type] = score / totalScore;
    }

    logger.info('Normalized ML scores for available types:', normalizedScores);

    return normalizedScores;
  }

  /**
   * Get the best predicted transport type from available options
   */
  static getBestAvailableType(
    allScores: {
      bus?: number;
      train?: number;
      car?: number;
      intercity?: number;
      [key: string]: number | undefined;
    },
    availableTypes: string[]
  ): { type: string; confidence: number } | null {
    const normalizedScores = this.filterAndNormalizeScores(allScores, availableTypes);

    if (Object.keys(normalizedScores).length === 0) {
      return null;
    }

    // Find highest score
    let bestType = '';
    let bestScore = 0;

    for (const [type, score] of Object.entries(normalizedScores)) {
      if (score > bestScore) {
        bestType = type;
        bestScore = score;
      }
    }

    return { type: bestType, confidence: bestScore };
  }

  /**
   * Get ML confidence score for a specific route type, considering only available options
   */
  static getRouteConfidence(
    routeType: string,
    allScores: {
      bus?: number;
      train?: number;
      car?: number;
      intercity?: number;
      [key: string]: number | undefined;
    },
    availableTypes: string[]
  ): number {
    const normalizedScores = this.filterAndNormalizeScores(allScores, availableTypes);

    // Map route type variations
    const typeMap: Record<string, string> = {
      tuk_tuk: 'car',
      taxi: 'car',
    };

    const normalizedRouteType = typeMap[routeType.toLowerCase()] || routeType.toLowerCase();

    return normalizedScores[normalizedRouteType] || 0.3; // Default to 0.3 if not found
  }

  /**
   * Check if ML's top prediction is actually available
   */
  static isPredictionAvailable(prediction: string, availableTypes: string[]): boolean {
    const typeMap: Record<string, string> = {
      tuk_tuk: 'car',
      taxi: 'car',
    };

    const normalizedPrediction = typeMap[prediction.toLowerCase()] || prediction.toLowerCase();
    const normalizedAvailable = availableTypes.map((type) => typeMap[type] || type.toLowerCase());

    return normalizedAvailable.includes(normalizedPrediction);
  }

  /**
   * Get a user-friendly message about ML prediction vs availability
   */
  static getAvailabilityMessage(
    prediction: string,
    confidence: number,
    availableTypes: string[],
    allScores: {
      bus?: number;
      train?: number;
      car?: number;
      intercity?: number;
      [key: string]: number | undefined;
    }
  ): string | null {
    if (this.isPredictionAvailable(prediction, availableTypes)) {
      return null; // Prediction is available, no message needed
    }

    const bestAvailable = this.getBestAvailableType(allScores, availableTypes);
    if (!bestAvailable) {
      return null;
    }

    return `Note: ML recommends ${prediction} (${(confidence * 100).toFixed(1)}% confidence), but it's not available for this route. Showing ${bestAvailable.type} as the best available option.`;
  }
}

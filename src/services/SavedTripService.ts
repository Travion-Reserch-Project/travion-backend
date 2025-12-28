/**
 * SavedTrip Service
 * Business logic for trip management
 */

import { AppError } from '../middleware/errorHandler';
import {
  SavedTripRepository,
  CreateTripData,
  TripFilters,
} from '../repositories/SavedTripRepository';
import { ISavedTrip, IItineraryItem } from '../models/SavedTrip';

export class SavedTripService {
  private repository: SavedTripRepository;

  constructor() {
    this.repository = new SavedTripRepository();
  }

  // ============================================================================
  // CORE TRIP OPERATIONS
  // ============================================================================

  /**
   * Create a new trip
   */
  async createTrip(data: CreateTripData): Promise<ISavedTrip> {
    // Validate dates
    if (new Date(data.endDate) < new Date(data.startDate)) {
      throw new AppError('End date must be after start date', 400);
    }

    return await this.repository.create(data);
  }

  /**
   * Get trip by ID with ownership check
   */
  async getTripById(tripId: string, userId: string): Promise<ISavedTrip> {
    const trip = await this.repository.findByIdAndUser(tripId, userId);
    if (!trip) {
      throw new AppError('Trip not found', 404);
    }
    return trip;
  }

  /**
   * Get all trips for a user
   */
  async getUserTrips(
    userId: string,
    page: number = 1,
    limit: number = 20,
    filters?: TripFilters
  ): Promise<{ trips: ISavedTrip[]; total: number; pages: number; page: number }> {
    const result = await this.repository.findByUserId(userId, page, limit, filters);
    return { ...result, page };
  }

  /**
   * Update a trip
   */
  async updateTrip(
    tripId: string,
    userId: string,
    data: Partial<ISavedTrip>
  ): Promise<ISavedTrip> {
    // Validate dates if both are provided
    if (data.startDate && data.endDate) {
      if (new Date(data.endDate) < new Date(data.startDate)) {
        throw new AppError('End date must be after start date', 400);
      }
    }

    const trip = await this.repository.update(tripId, userId, data);
    if (!trip) {
      throw new AppError('Trip not found', 404);
    }
    return trip;
  }

  /**
   * Delete a trip
   */
  async deleteTrip(tripId: string, userId: string): Promise<void> {
    const trip = await this.repository.delete(tripId, userId);
    if (!trip) {
      throw new AppError('Trip not found', 404);
    }
  }

  // ============================================================================
  // STATUS OPERATIONS
  // ============================================================================

  /**
   * Update trip status
   */
  async updateTripStatus(
    tripId: string,
    userId: string,
    status: 'draft' | 'planned' | 'ongoing' | 'completed' | 'cancelled'
  ): Promise<ISavedTrip> {
    const trip = await this.repository.updateStatus(tripId, userId, status);
    if (!trip) {
      throw new AppError('Trip not found', 404);
    }
    return trip;
  }

  /**
   * Get trips by status
   */
  async getTripsByStatus(userId: string, status: string): Promise<ISavedTrip[]> {
    return await this.repository.findByStatus(userId, status);
  }

  // ============================================================================
  // ITINERARY OPERATIONS
  // ============================================================================

  /**
   * Add itinerary item
   */
  async addItineraryItem(
    tripId: string,
    userId: string,
    item: IItineraryItem
  ): Promise<ISavedTrip> {
    // Get current trip to determine order
    const currentTrip = await this.getTripById(tripId, userId);
    const maxOrder = currentTrip.itinerary.length > 0
      ? Math.max(...currentTrip.itinerary.map(i => i.order))
      : -1;

    const itemWithOrder = {
      ...item,
      order: item.order ?? maxOrder + 1,
    };

    const trip = await this.repository.addItineraryItem(tripId, userId, itemWithOrder);
    if (!trip) {
      throw new AppError('Trip not found', 404);
    }
    return trip;
  }

  /**
   * Update itinerary item
   */
  async updateItineraryItem(
    tripId: string,
    userId: string,
    itemIndex: number,
    item: Partial<IItineraryItem>
  ): Promise<ISavedTrip> {
    // Validate index
    const trip = await this.getTripById(tripId, userId);
    if (itemIndex < 0 || itemIndex >= trip.itinerary.length) {
      throw new AppError('Invalid itinerary item index', 400);
    }

    const updated = await this.repository.updateItineraryItem(tripId, userId, itemIndex, item);
    if (!updated) {
      throw new AppError('Failed to update itinerary item', 500);
    }
    return updated;
  }

  /**
   * Remove itinerary item
   */
  async removeItineraryItem(
    tripId: string,
    userId: string,
    itemIndex: number
  ): Promise<ISavedTrip> {
    const trip = await this.getTripById(tripId, userId);
    if (itemIndex < 0 || itemIndex >= trip.itinerary.length) {
      throw new AppError('Invalid itinerary item index', 400);
    }

    const updated = await this.repository.removeItineraryItem(tripId, userId, itemIndex);
    if (!updated) {
      throw new AppError('Failed to remove itinerary item', 500);
    }
    return updated;
  }

  /**
   * Reorder itinerary items
   */
  async reorderItinerary(
    tripId: string,
    userId: string,
    newOrder: number[]
  ): Promise<ISavedTrip> {
    const trip = await this.getTripById(tripId, userId);

    // Validate new order array
    if (newOrder.length !== trip.itinerary.length) {
      throw new AppError('Invalid order array length', 400);
    }

    const sortedOrder = [...newOrder].sort((a, b) => a - b);
    const expected = Array.from({ length: trip.itinerary.length }, (_, i) => i);
    if (JSON.stringify(sortedOrder) !== JSON.stringify(expected)) {
      throw new AppError('Invalid order array - must contain all indices', 400);
    }

    const updated = await this.repository.reorderItinerary(tripId, userId, newOrder);
    if (!updated) {
      throw new AppError('Failed to reorder itinerary', 500);
    }
    return updated;
  }

  // ============================================================================
  // PUBLIC TRIPS OPERATIONS
  // ============================================================================

  /**
   * Get public trips
   */
  async getPublicTrips(
    page: number = 1,
    limit: number = 20,
    tags?: string[]
  ): Promise<{ trips: ISavedTrip[]; total: number; pages: number; page: number }> {
    const result = await this.repository.findPublicTrips(page, limit, tags);
    return { ...result, page };
  }

  /**
   * Toggle trip public/private
   */
  async togglePublic(tripId: string, userId: string): Promise<ISavedTrip> {
    const trip = await this.repository.togglePublic(tripId, userId);
    if (!trip) {
      throw new AppError('Trip not found', 404);
    }
    return trip;
  }

  /**
   * Share trip (make public)
   */
  async shareTrip(tripId: string, userId: string): Promise<ISavedTrip> {
    const trip = await this.getTripById(tripId, userId);
    if (trip.isPublic) {
      throw new AppError('Trip is already public', 400);
    }

    return await this.updateTrip(tripId, userId, { isPublic: true });
  }

  /**
   * Unshare trip (make private)
   */
  async unshareTrip(tripId: string, userId: string): Promise<ISavedTrip> {
    const trip = await this.getTripById(tripId, userId);
    if (!trip.isPublic) {
      throw new AppError('Trip is already private', 400);
    }

    return await this.updateTrip(tripId, userId, { isPublic: false });
  }

  // ============================================================================
  // RATING & REVIEW OPERATIONS
  // ============================================================================

  /**
   * Add rating and review
   */
  async addRating(
    tripId: string,
    userId: string,
    rating: number,
    review?: string
  ): Promise<ISavedTrip> {
    if (rating < 1 || rating > 5) {
      throw new AppError('Rating must be between 1 and 5', 400);
    }

    const trip = await this.repository.addRating(tripId, userId, rating, review);
    if (!trip) {
      throw new AppError('Trip not found', 404);
    }
    return trip;
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Duplicate a trip
   */
  async duplicateTrip(tripId: string, userId: string): Promise<ISavedTrip> {
    const trip = await this.repository.duplicate(tripId, userId);
    if (!trip) {
      throw new AppError('Trip not found', 404);
    }
    return trip;
  }

  /**
   * Get upcoming trips
   */
  async getUpcomingTrips(userId: string): Promise<ISavedTrip[]> {
    return await this.repository.getUpcomingTrips(userId);
  }

  /**
   * Search trips
   */
  async searchTrips(
    userId: string,
    searchTerm: string,
    limit: number = 10
  ): Promise<ISavedTrip[]> {
    return await this.repository.search(userId, searchTerm, limit);
  }

  /**
   * Get trip count for user
   */
  async getTripCount(userId: string): Promise<number> {
    return await this.repository.countByUser(userId);
  }
}

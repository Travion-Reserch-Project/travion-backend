/**
 * SavedTrip Repository
 * Data access layer for saved trips and itineraries
 */

import mongoose from 'mongoose';
import {
  SavedTrip,
  ISavedTrip,
  IItineraryItem,
  ITripConstraint,
  IAIMetadata,
} from '../models/SavedTrip';

export interface CreateTripData {
  userId: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  destinations?: string[];
  itinerary?: IItineraryItem[];
  isPublic?: boolean;
  status?: 'draft' | 'planned' | 'ongoing' | 'completed' | 'cancelled';
  tags?: string[];
  estimatedBudget?: { currency: string; amount: number };
  travelersCount?: number;
  generatedBy?: 'user' | 'ai';
  aiMetadata?: IAIMetadata;
  constraints?: ITripConstraint[];
}

export interface TripFilters {
  status?: string;
  isPublic?: boolean;
  generatedBy?: 'user' | 'ai';
  startDateFrom?: Date;
  startDateTo?: Date;
  tags?: string[];
}

export class SavedTripRepository {
  // ============================================================================
  // CORE CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new saved trip
   */
  async create(data: CreateTripData): Promise<ISavedTrip> {
    const trip = new SavedTrip({
      ...data,
      userId: new mongoose.Types.ObjectId(data.userId),
    });
    return await trip.save();
  }

  /**
   * Find trip by ID
   */
  async findById(tripId: string): Promise<ISavedTrip | null> {
    return await SavedTrip.findById(tripId);
  }

  /**
   * Find trip by ID and user ID (ownership check)
   */
  async findByIdAndUser(tripId: string, userId: string): Promise<ISavedTrip | null> {
    return await SavedTrip.findOne({
      _id: new mongoose.Types.ObjectId(tripId),
      userId: new mongoose.Types.ObjectId(userId),
    });
  }

  /**
   * Find all trips for a user with pagination
   */
  async findByUserId(
    userId: string,
    page: number = 1,
    limit: number = 20,
    filters?: TripFilters
  ): Promise<{ trips: ISavedTrip[]; total: number; pages: number }> {
    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
    };

    if (filters) {
      if (filters.status) query.status = filters.status;
      if (filters.isPublic !== undefined) query.isPublic = filters.isPublic;
      if (filters.generatedBy) query.generatedBy = filters.generatedBy;
      if (filters.tags?.length) query.tags = { $in: filters.tags };
      if (filters.startDateFrom || filters.startDateTo) {
        query.startDate = {};
        if (filters.startDateFrom) {
          (query.startDate as Record<string, Date>).$gte = filters.startDateFrom;
        }
        if (filters.startDateTo) {
          (query.startDate as Record<string, Date>).$lte = filters.startDateTo;
        }
      }
    }

    const skip = (page - 1) * limit;
    const [trips, total] = await Promise.all([
      SavedTrip.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SavedTrip.countDocuments(query),
    ]);

    return {
      trips,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Update a trip
   */
  async update(
    tripId: string,
    userId: string,
    data: Partial<ISavedTrip>
  ): Promise<ISavedTrip | null> {
    return await SavedTrip.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(tripId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  /**
   * Delete a trip
   */
  async delete(tripId: string, userId: string): Promise<ISavedTrip | null> {
    return await SavedTrip.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(tripId),
      userId: new mongoose.Types.ObjectId(userId),
    });
  }

  // ============================================================================
  // STATUS OPERATIONS
  // ============================================================================

  /**
   * Update trip status
   */
  async updateStatus(
    tripId: string,
    userId: string,
    status: 'draft' | 'planned' | 'ongoing' | 'completed' | 'cancelled'
  ): Promise<ISavedTrip | null> {
    return await SavedTrip.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(tripId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { $set: { status } },
      { new: true }
    );
  }

  /**
   * Get trips by status
   */
  async findByStatus(
    userId: string,
    status: string
  ): Promise<ISavedTrip[]> {
    return await SavedTrip.find({
      userId: new mongoose.Types.ObjectId(userId),
      status,
    }).sort({ startDate: 1 });
  }

  // ============================================================================
  // ITINERARY OPERATIONS
  // ============================================================================

  /**
   * Add itinerary item to trip
   */
  async addItineraryItem(
    tripId: string,
    userId: string,
    item: IItineraryItem
  ): Promise<ISavedTrip | null> {
    return await SavedTrip.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(tripId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { $push: { itinerary: item } },
      { new: true }
    );
  }

  /**
   * Update itinerary item
   */
  async updateItineraryItem(
    tripId: string,
    userId: string,
    itemIndex: number,
    item: Partial<IItineraryItem>
  ): Promise<ISavedTrip | null> {
    const updateObj: Record<string, unknown> = {};
    Object.entries(item).forEach(([key, value]) => {
      updateObj[`itinerary.${itemIndex}.${key}`] = value;
    });

    return await SavedTrip.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(tripId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { $set: updateObj },
      { new: true }
    );
  }

  /**
   * Remove itinerary item
   */
  async removeItineraryItem(
    tripId: string,
    userId: string,
    itemIndex: number
  ): Promise<ISavedTrip | null> {
    const trip = await this.findByIdAndUser(tripId, userId);
    if (!trip) return null;

    trip.itinerary.splice(itemIndex, 1);
    // Reorder remaining items
    trip.itinerary.forEach((item, idx) => {
      item.order = idx;
    });

    return await trip.save();
  }

  /**
   * Reorder itinerary items
   */
  async reorderItinerary(
    tripId: string,
    userId: string,
    newOrder: number[]
  ): Promise<ISavedTrip | null> {
    const trip = await this.findByIdAndUser(tripId, userId);
    if (!trip) return null;

    const reorderedItinerary = newOrder.map((oldIndex, newIndex) => {
      const item = trip.itinerary[oldIndex];
      item.order = newIndex;
      return item;
    });

    trip.itinerary = reorderedItinerary;
    return await trip.save();
  }

  // ============================================================================
  // PUBLIC TRIPS OPERATIONS
  // ============================================================================

  /**
   * Get public trips with pagination
   */
  async findPublicTrips(
    page: number = 1,
    limit: number = 20,
    tags?: string[]
  ): Promise<{ trips: ISavedTrip[]; total: number; pages: number }> {
    const query: Record<string, unknown> = { isPublic: true };
    if (tags?.length) {
      query.tags = { $in: tags };
    }

    const skip = (page - 1) * limit;
    const [trips, total] = await Promise.all([
      SavedTrip.find(query)
        .select('-itinerary') // Exclude full itinerary for list view
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SavedTrip.countDocuments(query),
    ]);

    return {
      trips,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Toggle trip public/private
   */
  async togglePublic(tripId: string, userId: string): Promise<ISavedTrip | null> {
    const trip = await this.findByIdAndUser(tripId, userId);
    if (!trip) return null;

    trip.isPublic = !trip.isPublic;
    return await trip.save();
  }

  // ============================================================================
  // RATING & REVIEW OPERATIONS
  // ============================================================================

  /**
   * Add or update rating and review
   */
  async addRating(
    tripId: string,
    userId: string,
    rating: number,
    review?: string
  ): Promise<ISavedTrip | null> {
    return await SavedTrip.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(tripId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { $set: { rating, review } },
      { new: true }
    );
  }

  // ============================================================================
  // DUPLICATE & UTILITY OPERATIONS
  // ============================================================================

  /**
   * Duplicate a trip
   */
  async duplicate(tripId: string, userId: string): Promise<ISavedTrip | null> {
    const original = await this.findByIdAndUser(tripId, userId);
    if (!original) return null;

    const duplicateData: CreateTripData = {
      userId,
      title: `${original.title} (Copy)`,
      description: original.description,
      startDate: original.startDate,
      endDate: original.endDate,
      destinations: [...original.destinations],
      itinerary: original.itinerary.map(item => ({ ...item })),
      isPublic: false,
      status: 'draft',
      tags: [...original.tags],
      estimatedBudget: original.estimatedBudget,
      travelersCount: original.travelersCount,
      generatedBy: 'user',
    };

    return await this.create(duplicateData);
  }

  /**
   * Count trips for a user
   */
  async countByUser(userId: string): Promise<number> {
    return await SavedTrip.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
    });
  }

  /**
   * Get upcoming trips (starting in next 30 days)
   */
  async getUpcomingTrips(userId: string): Promise<ISavedTrip[]> {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return await SavedTrip.find({
      userId: new mongoose.Types.ObjectId(userId),
      startDate: { $gte: now, $lte: thirtyDaysLater },
      status: { $in: ['planned', 'ongoing'] },
    }).sort({ startDate: 1 });
  }

  /**
   * Search trips by title or destination
   */
  async search(
    userId: string,
    searchTerm: string,
    limit: number = 10
  ): Promise<ISavedTrip[]> {
    const regex = new RegExp(searchTerm, 'i');
    return await SavedTrip.find({
      userId: new mongoose.Types.ObjectId(userId),
      $or: [
        { title: regex },
        { destinations: regex },
        { tags: regex },
      ],
    })
      .limit(limit)
      .sort({ createdAt: -1 });
  }
}

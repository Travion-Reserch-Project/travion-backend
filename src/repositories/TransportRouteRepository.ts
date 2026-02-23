import { TransportRoute, ITransportRoute } from '../models/TransportRoute';

export class TransportRouteRepository {
  async findById(routeId: string): Promise<ITransportRoute | null> {
    return TransportRoute.findOne({ route_id: routeId });
  }

  async findByOriginAndDestination(
    originCityId: number,
    destinationCityId: number,
    transportType?: 'bus' | 'train' | 'car'
  ): Promise<ITransportRoute[]> {
    const query: Record<string, unknown> = {
      origin_city_id: originCityId,
      destination_city_id: destinationCityId,
    };
    if (transportType) {
      query.transport_type = transportType;
    }
    return TransportRoute.find(query).sort({ distance_km: 1, estimated_time_min: 1 });
  }

  async findByOrigin(
    originCityId: number,
    transportType?: 'bus' | 'train' | 'car'
  ): Promise<ITransportRoute[]> {
    const query: Record<string, unknown> = { origin_city_id: originCityId };
    if (transportType) {
      query.transport_type = transportType;
    }
    return TransportRoute.find(query);
  }

  async findByDestination(
    destinationCityId: number,
    transportType?: 'bus' | 'train' | 'car'
  ): Promise<ITransportRoute[]> {
    const query: Record<string, unknown> = { destination_city_id: destinationCityId };
    if (transportType) {
      query.transport_type = transportType;
    }
    return TransportRoute.find(query);
  }

  async findDirectRoutes(
    originCityId: number,
    destinationCityId: number
  ): Promise<ITransportRoute[]> {
    return TransportRoute.find({
      origin_city_id: originCityId,
      destination_city_id: destinationCityId,
      has_transfer: false,
    }).sort({ estimated_time_min: 1 });
  }

  async create(routeData: Partial<ITransportRoute>): Promise<ITransportRoute> {
    const route = new TransportRoute(routeData);
    return route.save();
  }

  async update(
    routeId: string,
    updateData: Partial<ITransportRoute>
  ): Promise<ITransportRoute | null> {
    return TransportRoute.findOneAndUpdate({ route_id: routeId }, updateData, { new: true });
  }

  async findAll(
    transportType?: 'bus' | 'train' | 'car',
    limit: number = 100,
    skip: number = 0
  ): Promise<ITransportRoute[]> {
    const query: Record<string, unknown> = {};
    if (transportType) {
      query.transport_type = transportType;
    }
    return TransportRoute.find(query).limit(limit).skip(skip);
  }
}

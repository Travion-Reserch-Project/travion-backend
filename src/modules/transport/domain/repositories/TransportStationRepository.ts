import { TransportStation, ITransportStation } from '../models/TransportStation';

export class TransportStationRepository {
  async findById(stationId: number): Promise<ITransportStation | null> {
    return TransportStation.findOne({ station_id: stationId });
  }

  async findByCity(cityId: number, stationType?: 'bus' | 'train'): Promise<ITransportStation[]> {
    const query: Record<string, unknown> = { city_id: cityId };
    if (stationType) {
      query.station_type = stationType;
    }
    return TransportStation.find(query);
  }

  async findNearby(
    longitude: number,
    latitude: number,
    maxDistanceKm: number = 10,
    stationType?: 'bus' | 'train'
  ): Promise<ITransportStation[]> {
    const query: Record<string, unknown> = {
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: maxDistanceKm * 1000,
        },
      },
    };
    if (stationType) {
      query.station_type = stationType;
    }
    return TransportStation.find(query).limit(10);
  }

  async searchByName(name: string, stationType?: 'bus' | 'train'): Promise<ITransportStation[]> {
    const query: Record<string, unknown> = {
      name: new RegExp(name, 'i'),
    };
    if (stationType) {
      query.station_type = stationType;
    }
    return TransportStation.find(query).limit(10);
  }

  async create(stationData: Partial<ITransportStation>): Promise<ITransportStation> {
    const station = new TransportStation(stationData);
    return station.save();
  }

  async update(
    stationId: number,
    updateData: Partial<ITransportStation>
  ): Promise<ITransportStation | null> {
    return TransportStation.findOneAndUpdate({ station_id: stationId }, updateData, { new: true });
  }

  async findAll(
    stationType?: 'bus' | 'train',
    limit: number = 100,
    skip: number = 0
  ): Promise<ITransportStation[]> {
    const query: Record<string, unknown> = {};
    if (stationType) {
      query.station_type = stationType;
    }
    return TransportStation.find(query).limit(limit).skip(skip);
  }
}

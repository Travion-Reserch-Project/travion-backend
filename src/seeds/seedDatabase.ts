import mongoose from 'mongoose';
import { Province } from '../modules/transport/domain/models/Province';
import { District } from '../modules/transport/domain/models/District';
import { City } from '../modules/transport/domain/models/City';
import { TransportRoute } from '../modules/transport/domain/models/TransportRoute';
import { logger } from '../shared/config/logger';
import * as fs from 'fs';
import * as path from 'path';

// Configure database connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/travion-research';
    await mongoose.connect(mongoUri);
    logger.info('Database connected successfully for seeding');
  } catch (error) {
    logger.error('Database connection failed:', error);
    process.exit(1);
  }
};

// Load provinces from JSON file
const loadProvincesFromJSON = (): any[] => {
  try {
    const filePath = path.join(__dirname, '../data/provinces.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logger.warn('Could not load provinces from JSON:', error);
    return [];
  }
};

// Load districts from JSON file
const loadDistrictsFromJSON = (): any[] => {
  try {
    const filePath = path.join(__dirname, '../data/districts.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    logger.warn('Could not load districts from JSON:', error);
    return [];
  }
};

// Load cities from JSON file
const loadCitiesFromJSON = (): any[] => {
  try {
    const filePath = path.join(__dirname, '../data/sri_lanka_cities_updated.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.cities || [];
  } catch (error) {
    logger.warn('Could not load cities from JSON, will use sample data:', error);
    return [];
  }
};

// Format city data for MongoDB
const formatCityData = (rawCity: any) => {
  return {
    city_id: rawCity.id || rawCity.city_id,
    district_id: rawCity.district_id || 1, // Default to 1 if not provided
    name: {
      en: rawCity.name || rawCity.city_name || 'Unknown',
      si: rawCity.name_sinhala || rawCity.name || 'Unknown',
      ta: rawCity.name_tamil || rawCity.name || 'Unknown',
    },
    location: {
      type: 'Point',
      coordinates: [rawCity.longitude || 0, rawCity.latitude || 0],
    },
    transport_access: {
      has_railway: rawCity.has_railway || false,
      has_bus: rawCity.has_bus || false,
      has_any_transport: rawCity.has_railway || rawCity.has_bus || false,
      has_both: (rawCity.has_railway && rawCity.has_bus) || false,
    },
    transport_stats: {
      railway_stations_count: rawCity.railway_stations_count || 0,
      bus_stations_count: rawCity.bus_stations_count || 0,
      distance_to_nearest_railway_km: rawCity.distance_to_nearest_railway_km || undefined,
      distance_to_nearest_bus_km: rawCity.distance_to_nearest_bus_km || undefined,
    },
  };
};

// Seed provinces
const seedProvinces = async () => {
  try {
    logger.info('Starting province seeding...');
    const provincesFromJSON = loadProvincesFromJSON();

    if (provincesFromJSON.length === 0) {
      logger.error('No provinces found in JSON file!');
      throw new Error('Provinces data file is missing or empty');
    }

    const formattedProvinces = provincesFromJSON.map((province) => ({
      province_id: province.id,
      name: {
        en: province.name_en,
        si: province.name_si,
        ta: province.name_ta,
      },
    }));

    await Province.insertMany(formattedProvinces);
    logger.info(`✅ Seeded ${formattedProvinces.length} provinces`);
    return formattedProvinces;
  } catch (error) {
    logger.error('Error seeding provinces:', error);
    throw error;
  }
};

// Seed districts
const seedDistricts = async () => {
  try {
    logger.info('Starting district seeding...');
    const districtsFromJSON = loadDistrictsFromJSON();

    if (districtsFromJSON.length === 0) {
      logger.error('No districts found in JSON file!');
      throw new Error('Districts data file is missing or empty');
    }

    const formattedDistricts = districtsFromJSON.map((district) => ({
      district_id: district.id,
      province_id: district.province_id,
      name: {
        en: district.name_en,
        si: district.name_si,
        ta: district.name_ta,
      },
    }));

    await District.insertMany(formattedDistricts);
    logger.info(`✅ Seeded ${formattedDistricts.length} districts`);
    return formattedDistricts;
  } catch (error) {
    logger.error('Error seeding districts:', error);
    throw error;
  }
};

// Seed cities
const seedCities = async () => {
  try {
    logger.info('Starting city seeding...');
    const citiesFromJSON = loadCitiesFromJSON();

    if (citiesFromJSON.length === 0) {
      logger.warn('No cities loaded from JSON, seeding major Sri Lankan cities');
      // Seed major cities manually
      const majorCities = [
        {
          city_id: 1,
          district_id: 1,
          name: { en: 'Colombo', si: 'කොළඹ', ta: 'கொழும்பு' },
          location: { type: 'Point', coordinates: [79.8612, 6.9271] },
          transport_access: {
            has_railway: true,
            has_bus: true,
            has_any_transport: true,
            has_both: true,
          },
          transport_stats: { railway_stations_count: 5, bus_stations_count: 10 },
        },
        {
          city_id: 2,
          district_id: 2,
          name: { en: 'Kandy', si: 'නුවර', ta: 'கண்டி' },
          location: { type: 'Point', coordinates: [80.6337, 7.2906] },
          transport_access: {
            has_railway: true,
            has_bus: true,
            has_any_transport: true,
            has_both: true,
          },
          transport_stats: { railway_stations_count: 2, bus_stations_count: 5 },
        },
        {
          city_id: 3,
          district_id: 3,
          name: { en: 'Galle', si: 'ගාල්ල', ta: 'காலி' },
          location: { type: 'Point', coordinates: [80.2208, 6.0535] },
          transport_access: {
            has_railway: true,
            has_bus: true,
            has_any_transport: true,
            has_both: true,
          },
          transport_stats: { railway_stations_count: 1, bus_stations_count: 4 },
        },
        {
          city_id: 4,
          district_id: 4,
          name: { en: 'Jaffna', si: 'යාපනය', ta: 'யாழ்ப்பாணம்' },
          location: { type: 'Point', coordinates: [80.7764, 9.6615] },
          transport_access: {
            has_railway: false,
            has_bus: true,
            has_any_transport: true,
            has_both: false,
          },
          transport_stats: { railway_stations_count: 0, bus_stations_count: 3 },
        },
        {
          city_id: 5,
          district_id: 5,
          name: { en: 'Nuwara Eliya', si: 'නුවර එළිය', ta: 'நுவரएளிய' },
          location: { type: 'Point', coordinates: [80.7667, 6.9497] },
          transport_access: {
            has_railway: false,
            has_bus: true,
            has_any_transport: true,
            has_both: false,
          },
          transport_stats: { railway_stations_count: 0, bus_stations_count: 3 },
        },
        {
          city_id: 6,
          district_id: 6,
          name: { en: 'Negombo', si: 'නෑගොඩ', ta: 'நெகொம்பு' },
          location: { type: 'Point', coordinates: [79.839, 7.207] },
          transport_access: {
            has_railway: false,
            has_bus: true,
            has_any_transport: true,
            has_both: false,
          },
          transport_stats: { railway_stations_count: 0, bus_stations_count: 4 },
        },
        {
          city_id: 7,
          district_id: 7,
          name: { en: 'Embilipitiya', si: 'එම්බිලිපිටිය', ta: 'எம்பிலిபிட்டிய' },
          location: { type: 'Point', coordinates: [80.8171, 7.0167] },
          transport_access: {
            has_railway: false,
            has_bus: true,
            has_any_transport: true,
            has_both: false,
          },
          transport_stats: { railway_stations_count: 0, bus_stations_count: 2 },
        },
        {
          city_id: 8,
          district_id: 8,
          name: { en: 'Nugegoda', si: 'නුගේගොඩ', ta: 'நுகெகொடை' },
          location: { type: 'Point', coordinates: [79.8864, 6.8667] },
          transport_access: {
            has_railway: true,
            has_bus: true,
            has_any_transport: true,
            has_both: true,
          },
          transport_stats: { railway_stations_count: 1, bus_stations_count: 6 },
        },
        {
          city_id: 9,
          district_id: 9,
          name: { en: 'Matara', si: 'මාතර', ta: 'மாதரை' },
          location: { type: 'Point', coordinates: [80.5478, 5.7489] },
          transport_access: {
            has_railway: true,
            has_bus: true,
            has_any_transport: true,
            has_both: true,
          },
          transport_stats: { railway_stations_count: 1, bus_stations_count: 3 },
        },
        {
          city_id: 10,
          district_id: 10,
          name: { en: 'Anuradhapura', si: 'අනුරාධපුරය', ta: 'அனுராதபுரம்' },
          location: { type: 'Point', coordinates: [80.7137, 8.3128] },
          transport_access: {
            has_railway: true,
            has_bus: true,
            has_any_transport: true,
            has_both: true,
          },
          transport_stats: { railway_stations_count: 1, bus_stations_count: 3 },
        },
      ];

      await City.insertMany(majorCities);
      logger.info(`Seeded ${majorCities.length} major cities`);
      return majorCities;
    } else {
      logger.info(`Loading ${citiesFromJSON.length} cities from JSON file...`);
      const formattedCities = citiesFromJSON.map((city) => formatCityData(city));

      // Insert in batches to avoid memory issues
      const batchSize = 100;
      for (let i = 0; i < formattedCities.length; i += batchSize) {
        const batch = formattedCities.slice(i, i + batchSize);
        try {
          await City.insertMany(batch, { ordered: false });
          logger.info(`Inserted batch ${i / batchSize + 1} (${batch.length} cities)`);
        } catch (error: any) {
          // Continue on duplicate key errors
          if (error.code === 11000) {
            logger.warn(`Batch ${i / batchSize + 1} had duplicate entries, continuing...`);
          } else {
            throw error;
          }
        }
      }
      logger.info(`Successfully seeded ${formattedCities.length} cities`);
      return formattedCities;
    }
  } catch (error) {
    logger.error('Error seeding cities:', error);
    throw error;
  }
};

// Seed transport routes between major cities
const seedTransportRoutes = async () => {
  try {
    logger.info('Starting transport routes seeding...');

    // Get actual city IDs from database (since JSON has specific IDs)
    const colombo = await City.findOne({ 'name.en': /^Colombo 1/i });
    const kandy = await City.findOne({ 'name.en': /^Kandy$/i });
    const galle = await City.findOne({ 'name.en': /^Galle$/i });
    const jaffna = await City.findOne({ 'name.en': /^Jaffna$/i });
    const matara = await City.findOne({ 'name.en': /^Matara$/i });
    const negombo = await City.findOne({ 'name.en': /^Negombo$/i });
    const anuradhapura = await City.findOne({ 'name.en': /^Anuradhapura$/i });

    if (!colombo || !kandy || !galle) {
      logger.warn('Some major cities not found in database for route creation');
      return;
    }

    // Sample routes between major cities (using actual city_ids from database)
    const routes = [
      // Colombo <-> Kandy
      {
        route_id: 'RTE_CMB_KY_BUS_01',
        origin_city_id: colombo.city_id,
        destination_city_id: kandy.city_id,
        transport_type: 'bus' as const,
        distance_km: 115,
        estimated_time_min: 180,
        base_fare_lkr: 650,
        has_transfer: false,
        route_details: {
          stops: ['Colombo Central', 'Nugegoda', 'Kandy Central'],
          frequency: 'every 30 minutes',
          schedule: '05:00-22:00',
        },
      },
      {
        route_id: 'RTE_CMB_KY_TRAIN_01',
        origin_city_id: colombo.city_id,
        destination_city_id: kandy.city_id,
        transport_type: 'car' as const,
        distance_km: 115,
        estimated_time_min: 225,
        base_fare_lkr: 850,
        has_transfer: false,
        route_details: {
          stops: ['Colombo Fort', 'Peradeniya', 'Kandy'],
          frequency: '4-5 trains daily',
          schedule: '06:00-20:00',
        },
      },
      // Colombo <-> Galle
      {
        route_id: 'RTE_CMB_GL_BUS_01',
        origin_city_id: colombo.city_id,
        destination_city_id: galle.city_id,
        transport_type: 'bus' as const,
        distance_km: 115,
        estimated_time_min: 150,
        base_fare_lkr: 550,
        has_transfer: false,
        route_details: {
          stops: ['Colombo Central', 'Moratuwa', 'Galle Fort'],
          frequency: 'every 45 minutes',
          schedule: '05:30-23:00',
        },
      },
      {
        route_id: 'RTE_CMB_GL_TRAIN_01',
        origin_city_id: colombo.city_id,
        destination_city_id: galle.city_id,
        transport_type: 'car' as const,
        distance_km: 115,
        estimated_time_min: 180,
        base_fare_lkr: 750,
        has_transfer: false,
        route_details: {
          stops: ['Colombo Fort', 'Galle'],
          frequency: '3-4 trains daily',
          schedule: '06:45-19:30',
        },
      },
    ];

    // Add Jaffna routes if city exists
    if (jaffna) {
      routes.push({
        route_id: 'RTE_CMB_JAF_BUS_01',
        origin_city_id: colombo.city_id,
        destination_city_id: jaffna.city_id,
        transport_type: 'bus' as const,
        distance_km: 395,
        estimated_time_min: 600,
        base_fare_lkr: 1500,
        has_transfer: false,
        route_details: {
          stops: ['Colombo', 'Vavuniya', 'Jaffna'],
          frequency: '2-3 buses daily',
          schedule: '05:00-19:00',
        },
      });

      routes.push({
        route_id: 'RTE_GL_JAF_BUS_01',
        origin_city_id: galle.city_id,
        destination_city_id: jaffna.city_id,
        transport_type: 'bus' as const,
        distance_km: 510,
        estimated_time_min: 720,
        base_fare_lkr: 1800,
        has_transfer: true,
        route_details: {
          stops: ['Galle', 'Colombo', 'Vavuniya', 'Jaffna'],
          frequency: '1 bus daily',
          schedule: '06:00',
        },
      });
    }

    // Add other city routes if they exist
    if (matara) {
      routes.push({
        route_id: 'RTE_CMB_MAT_BUS_01',
        origin_city_id: colombo.city_id,
        destination_city_id: matara.city_id,
        transport_type: 'bus' as const,
        distance_km: 160,
        estimated_time_min: 210,
        base_fare_lkr: 650,
        has_transfer: false,
        route_details: {
          stops: ['Colombo Central', 'Galle', 'Matara'],
          frequency: 'every 1 hour',
          schedule: '05:30-22:00',
        },
      });
    }

    if (negombo) {
      routes.push({
        route_id: 'RTE_CMB_NGO_BUS_01',
        origin_city_id: colombo.city_id,
        destination_city_id: negombo.city_id,
        transport_type: 'bus' as const,
        distance_km: 42,
        estimated_time_min: 60,
        base_fare_lkr: 200,
        has_transfer: false,
        route_details: {
          stops: ['Colombo Central', 'Ja-Ela', 'Negombo'],
          frequency: 'every 30 minutes',
          schedule: '05:00-23:00',
        },
      });
    }

    if (anuradhapura) {
      routes.push({
        route_id: 'RTE_CMB_ANU_BUS_01',
        origin_city_id: colombo.city_id,
        destination_city_id: anuradhapura.city_id,
        transport_type: 'bus' as const,
        distance_km: 210,
        estimated_time_min: 360,
        base_fare_lkr: 950,
        has_transfer: false,
        route_details: {
          stops: ['Colombo Central', 'Kurunegala', 'Anuradhapura'],
          frequency: 'every 2 hours',
          schedule: '05:30-17:00',
        },
      });
    }

    await TransportRoute.insertMany(routes);
    logger.info(`Successfully seeded ${routes.length} transport routes`);
  } catch (error) {
    logger.error('Error seeding transport routes:', error);
    throw error;
  }
};

// Main seeding function
const seedDatabase = async () => {
  try {
    await connectDB();

    // Clear existing data in reverse order (to respect foreign key constraints)
    logger.info('Clearing existing data...');
    await TransportRoute.deleteMany({});
    await City.deleteMany({});
    await District.deleteMany({});
    await Province.deleteMany({});

    // Seed data in correct order (provinces → districts → cities → routes)
    logger.info('\n📦 Step 1: Seeding Provinces...');
    await seedProvinces();

    logger.info('\n📦 Step 2: Seeding Districts...');
    await seedDistricts();

    logger.info('\n📦 Step 3: Seeding Cities...');
    await seedCities();

    logger.info('\n📦 Step 4: Seeding Transport Routes...');
    await seedTransportRoutes();

    logger.info('\n✅ Database seeding completed successfully!');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('Summary:');
    logger.info('  ✓ Provinces seeded');
    logger.info('  ✓ Districts seeded');
    logger.info('  ✓ Cities seeded');
    logger.info('  ✓ Transport routes seeded');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
};

// Run seeding
seedDatabase();

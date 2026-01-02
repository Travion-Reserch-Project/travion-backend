/**
 * Seed Locations Script
 * 
 * Imports location data from CSV file into MongoDB
 * 
 * Usage:
 *   npx ts-node src/scripts/seedLocations.ts
 * 
 * Or add to package.json scripts:
 *   "seed:locations": "ts-node src/scripts/seedLocations.ts"
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { Location, ILocation } from '../models/Location';

interface CSVLocation {
  Location_Name: string;
  l_hist: string;
  l_adv: string;
  l_nat: string;
  l_rel: string;
  l_outdoor: string;
  l_lat: string;
  l_lng: string;
  image_urls: string;
}

/**
 * Parse CSV line handling quoted fields with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Push the last field
  result.push(current);
  
  return result;
}

/**
 * Parse the CSV file
 */
function parseCSV(filePath: string): CSVLocation[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  // Get headers from first line
  const headers = parseCSVLine(lines[0]);
  
  const locations: CSVLocation[] = [];
  
  // Parse data rows (skip header)
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (values.length >= headers.length) {
      const location: CSVLocation = {
        Location_Name: values[0],
        l_hist: values[1],
        l_adv: values[2],
        l_nat: values[3],
        l_rel: values[4],
        l_outdoor: values[5],
        l_lat: values[6],
        l_lng: values[7],
        image_urls: values[8] || '[]',
      };
      locations.push(location);
    }
  }
  
  return locations;
}

/**
 * Parse image URLs from JSON string
 */
function parseImageUrls(imageUrlsStr: string): string[] {
  try {
    // The image_urls field is a JSON array string
    const parsed = JSON.parse(imageUrlsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`Failed to parse image URLs: ${imageUrlsStr.substring(0, 50)}...`);
    return [];
  }
}

/**
 * Convert CSV location to MongoDB document
 */
function convertToDocument(csvLocation: CSVLocation): Partial<ILocation> {
  return {
    name: csvLocation.Location_Name.trim(),
    preferenceScores: {
      history: parseFloat(csvLocation.l_hist) || 0.5,
      adventure: parseFloat(csvLocation.l_adv) || 0.5,
      nature: parseFloat(csvLocation.l_nat) || 0.5,
      relaxation: parseFloat(csvLocation.l_rel) || 0.5,
    },
    isOutdoor: csvLocation.l_outdoor === '1' || csvLocation.l_outdoor.toLowerCase() === 'true',
    coordinates: {
      latitude: parseFloat(csvLocation.l_lat) || 0,
      longitude: parseFloat(csvLocation.l_lng) || 0,
    },
    imageUrls: parseImageUrls(csvLocation.image_urls),
  };
}

/**
 * Main seed function
 */
async function seedLocations(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/travion-backend';
  const dbName = process.env.DATABASE_NAME || 'travion-backend';
  
  console.log('🌱 Starting location seed process...');
  console.log(`📦 Connecting to MongoDB: ${mongoUri}`);
  
  try {
    // Connect to MongoDB
    await mongoose.connect(mongoUri, {
      dbName,
    });
    console.log('✅ Connected to MongoDB');
    
    // Path to CSV file
    const csvPath = path.join(__dirname, '../locations_with_images_array.csv');
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at: ${csvPath}`);
    }
    
    console.log(`📄 Reading CSV file: ${csvPath}`);
    
    // Parse CSV
    const csvLocations = parseCSV(csvPath);
    console.log(`📊 Found ${csvLocations.length} locations in CSV`);
    
    // Convert to documents
    const documents = csvLocations.map(convertToDocument);
    
    // Clear existing locations (optional - comment out to keep existing data)
    console.log('🗑️  Clearing existing locations...');
    await Location.deleteMany({});
    
    // Insert locations
    console.log('💾 Inserting locations into MongoDB...');
    const result = await Location.insertMany(documents, { ordered: false });
    
    console.log(`✅ Successfully inserted ${result.length} locations`);
    
    // Print summary
    console.log('\n📊 Sample locations inserted:');
    const sampleLocations = await Location.find().limit(5).select('name coordinates.latitude coordinates.longitude');
    sampleLocations.forEach((loc, idx) => {
      console.log(`   ${idx + 1}. ${loc.name} (${loc.coordinates.latitude}, ${loc.coordinates.longitude})`);
    });
    
    // Print total count
    const totalCount = await Location.countDocuments();
    console.log(`\n📈 Total locations in database: ${totalCount}`);
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate key')) {
      console.error('⚠️  Some locations already exist (duplicate key error)');
    } else {
      console.error('❌ Error seeding locations:', error);
    }
    process.exit(1);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run the seed function
seedLocations()
  .then(() => {
    console.log('🎉 Seed process completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seed process failed:', error);
    process.exit(1);
  });



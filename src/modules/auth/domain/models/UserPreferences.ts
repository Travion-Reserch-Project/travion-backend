/**
 * Re-export UserPreferences model and interfaces from tour-agent module
 * to maintain clean imports within the auth domain
 */
export {
  IUserPreferences,
  ISavedLocation,
  ISearchHistoryEntry,
  IPreferenceScores,
  ITravelStylePreferences,
  UserPreferences,
} from '../../../tour-agent/domain/models/UserPreferences';

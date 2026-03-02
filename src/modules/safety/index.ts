/**
 * Safety Module
 * Handles safety predictions, alert history, incident reports, and safety information
 */

// Export routes
export { safetyRoutes } from './api/routes/safetyRoutes';
export { incidentReportRoutes } from './api/routes/incidentReportRoutes';

// Export controllers
export { SafetyController } from './api/controllers/SafetyController';
export { IncidentReportController } from './api/controllers/IncidentReportController';

// Export services
export { SafetyService } from './domain/services/SafetyService';
export { IncidentReportService } from './domain/services/IncidentReportService';
export { GoogleMapsService } from './domain/services/GoogleMapsService';

// Export models
export { SafetyAlert, ISafetyAlert } from './domain/models/SafetyAlert';
export { IIncidentReport } from './domain/models/IncidentReport';
export { default as IncidentReport } from './domain/models/IncidentReport';

// Export repositories
export { SafetyRepository } from './domain/repositories/SafetyRepository';
export { IncidentReportRepository } from './domain/repositories/IncidentReportRepository';

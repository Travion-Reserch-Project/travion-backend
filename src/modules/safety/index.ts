/**
 * Safety Module
 * Handles safety predictions, alert history, incident reports, push notifications, and safety information
 */

// Export routes
export { safetyRoutes } from './api/routes/safetyRoutes';
export { incidentReportRoutes } from './api/routes/incidentReportRoutes';
export { pushNotificationRoutes } from './api/routes/pushNotificationRoutes';

// Export controllers
export { SafetyController } from './api/controllers/SafetyController';
export { IncidentReportController } from './api/controllers/IncidentReportController';
export { PushNotificationController } from './api/controllers/PushNotificationController';

// Export services
export { SafetyService } from './domain/services/SafetyService';
export { IncidentReportService } from './domain/services/IncidentReportService';
export { GoogleMapsService } from './domain/services/GoogleMapsService';
export {
  PushNotificationService,
  pushNotificationService,
} from './domain/services/PushNotificationService';

// Export models
export { SafetyAlert, ISafetyAlert } from './domain/models/SafetyAlert';
export { IIncidentReport } from './domain/models/IncidentReport';
export { default as IncidentReport } from './domain/models/IncidentReport';
export { DeviceToken, IDeviceToken } from './domain/models/DeviceToken';

// Export repositories
export { SafetyRepository } from './domain/repositories/SafetyRepository';
export { IncidentReportRepository } from './domain/repositories/IncidentReportRepository';

import { InfisicalSDK, type GetSecretOptions, type ListSecretsOptions } from '@infisical/sdk';
import { logger } from './logger';

let infisicalClient: InfisicalSDK | null = null;

export const initializeInfisical = async (): Promise<InfisicalSDK> => {
  if (infisicalClient) {
    return infisicalClient;
  }

  try {
    const client = new InfisicalSDK({
      siteUrl: process.env.INFISICAL_SITE_URL || 'https://app.infisical.com',
    });

    await client.auth().universalAuth.login({
      clientId: process.env.INFISICAL_CLIENT_ID!,
      clientSecret: process.env.INFISICAL_CLIENT_SECRET!,
    });

    infisicalClient = client;
    logger.info('✅ Infisical client initialized successfully');
    return client;
  } catch (error) {
    logger.error('❌ Failed to initialize Infisical:', error);
    throw error;
  }
};

export const loadInfisicalSecrets = async (
  projectId: string,
  environment: string = 'dev',
  secretPath: string = '/'
): Promise<void> => {
  try {
    const client = await initializeInfisical();

    const options: ListSecretsOptions = {
      projectId,
      environment,
      secretPath,
      attachToProcessEnv: true,
    };

    const response = await client.secrets().listSecrets(options);

    logger.info(
      `✅ Loaded ${response.secrets?.length || 0} secrets from Infisical (${environment})`
    );
  } catch (error) {
    logger.error('❌ Failed to load secrets from Infisical:', error);
    throw error;
  }
};

export const getInfisicalSecret = async (
  projectId: string,
  secretName: string,
  environment: string = 'dev',
  secretPath: string = '/'
): Promise<string> => {
  try {
    const client = await initializeInfisical();

    const options: GetSecretOptions = {
      projectId,
      environment,
      secretPath,
      secretName,
    };

    const secret = await client.secrets().getSecret(options);

    return secret.secretValue;
  } catch (error) {
    logger.error(`❌ Failed to get secret "${secretName}" from Infisical:`, error);
    throw error;
  }
};

export { infisicalClient };

/**
 * HTTP Client Utility for AI Engine API communication
 * Provides a configured Axios instance with logging, retry logic, and error handling
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { logger } from '../config/logger';
import { aiEngineConfig } from '../config/aiEngine';
import { AIEngineError } from '../types/aiEngine';

/**
 * HTTP Client class for making requests to the AI Engine
 */
class HttpClient {
  private client: AxiosInstance;
  private retryAttempts: number;
  private retryDelay: number;

  constructor() {
    this.retryAttempts = aiEngineConfig.retryAttempts;
    this.retryDelay = aiEngineConfig.retryDelay;

    this.client = axios.create({
      baseURL: aiEngineConfig.baseUrl,
      timeout: aiEngineConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Setup request and response interceptors for logging
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const requestId = this.generateRequestId();
        config.headers['X-Request-ID'] = requestId;

        logger.debug('AI Engine Request', {
          requestId,
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
        });

        return config;
      },
      (error) => {
        logger.error('AI Engine Request Configuration Error', {
          message: error.message,
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        const requestId = response.config.headers['X-Request-ID'];

        logger.debug('AI Engine Response', {
          requestId,
          status: response.status,
          url: response.config.url,
          duration: response.headers['x-response-time'],
        });

        return response;
      },
      (error: AxiosError<AIEngineError>) => {
        const requestId = error.config?.headers?.['X-Request-ID'];

        logger.error('AI Engine Response Error', {
          requestId,
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
          detail: error.response?.data?.detail,
        });

        return Promise.reject(error);
      }
    );
  }

  /**
   * Generate a unique request ID for tracing
   */
  private generateRequestId(): string {
    return `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if error is a timeout error
   */
  private isTimeoutError(error: AxiosError): boolean {
    return error.code === 'ECONNABORTED' ||
           error.code === 'ETIMEDOUT' ||
           error.message?.includes('timeout');
  }

  /**
   * Extract safe error details for logging (avoid circular refs)
   */
  private extractErrorDetails(error: AxiosError): Record<string, unknown> {
    return {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method,
    };
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<AxiosResponse<T>>,
    retries: number = this.retryAttempts
  ): Promise<AxiosResponse<T>> {
    let lastError: AxiosError | Error;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as AxiosError;

        if (axios.isAxiosError(error)) {
          // Don't retry on timeout errors - they'll likely timeout again
          if (this.isTimeoutError(error)) {
            logger.error('AI Engine request timed out (no retry)', this.extractErrorDetails(error));
            throw error;
          }

          // Don't retry on client errors (4xx) except for 429 (rate limit)
          const status = error.response?.status;
          if (status && status >= 400 && status < 500 && status !== 429) {
            throw error;
          }
        }

        if (attempt < retries) {
          const delay = this.retryDelay * attempt; // Exponential backoff
          logger.warn(`AI Engine request failed, retrying (${attempt}/${retries})`, {
            delay,
            error: (error as Error).message,
          });
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Make a GET request
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.executeWithRetry<T>(() =>
      this.client.get<T>(url, config)
    );
    return response.data;
  }

  /**
   * Make a POST request
   */
  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.executeWithRetry<T>(() =>
      this.client.post<T>(url, data, config)
    );
    return response.data;
  }

  /**
   * Make a POST request with extended timeout (for LLM operations)
   * Default: 120 seconds (2 minutes)
   */
  async postWithLongTimeout<T>(
    url: string,
    data?: unknown,
    timeoutMs: number = 120000
  ): Promise<T> {
    const response = await this.executeWithRetry<T>(() =>
      this.client.post<T>(url, data, { timeout: timeoutMs })
    );
    return response.data;
  }

  /**
   * Make a PUT request
   */
  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.executeWithRetry<T>(() =>
      this.client.put<T>(url, data, config)
    );
    return response.data;
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.executeWithRetry<T>(() =>
      this.client.delete<T>(url, config)
    );
    return response.data;
  }

  /**
   * Check if the AI Engine is reachable
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.client.get('/api/v1/health', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const httpClient = new HttpClient();

export default httpClient;

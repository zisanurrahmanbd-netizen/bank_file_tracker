import pino from 'pino';
import pretty from 'pino-pretty';

const isDevelopment = process.env.NODE_ENV === 'development';

const stream = isDevelopment
  ? pretty({
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    })
  : undefined;

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
  },
  stream
);

// Helper functions for structured logging
export const logInfo = (message: string, data?: any) => {
  logger.info(data, message);
};

export const logError = (message: string, error?: any) => {
  logger.error({ error: error?.stack || error }, message);
};

export const logWarn = (message: string, data?: any) => {
  logger.warn(data, message);
};

export const logDebug = (message: string, data?: any) => {
  logger.debug(data, message);
};

// Request logging helper
export const logRequest = (req: any, res: any, duration: number) => {
  logger.info({
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
  }, 'HTTP Request');
};
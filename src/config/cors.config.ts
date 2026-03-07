import { registerAs } from '@nestjs/config';

export const corsConfig = registerAs('cors', () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  return {
    isProd: nodeEnv === 'production',


    allowedOrigins:
      nodeEnv === 'production'
        ? ['https://webruit.com', 'https://next.webruit.com']
        : ['http://localhost:3000', 'http://localhost:4000'],


    trackingOrigins: '*',
  };
});
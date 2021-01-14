declare namespace NodeJS {
  export interface ProcessEnv {
    DB_URL: string;
    REDIS_URL: string;
    PORT: string;
    SESSION_SECRET: string;
    CORS_ORIGIN: string;
  }
}

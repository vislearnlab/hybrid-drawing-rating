/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_PATH: string;
  readonly VITE_COMPLETION_CODE?: string;
  readonly VITE_SCREENED_OUT_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    ENVIRONMENT?: string;
    MONGO_URL: string;
    DATABASE: string;
    COLLECTION: string;
    VITE_BASE_PATH: string;
    CREDENTIALS_PATH?: string;
    VITE_COMPLETION_CODE?: string;
    VITE_SCREENED_OUT_CODE?: string;
  }
}

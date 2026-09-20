export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GRIDGOD_DESKTOP_DEV_SERVER_URL?: string;
    }
  }
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  // más variables de entorno aquí si las necesitas
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

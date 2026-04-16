import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // ============================
  // Core
  // ============================
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  API_PORT: Joi.number().default(3001),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),

  // ============================
  // Database
  // ============================
  DATABASE_URL: Joi.string().required(),

  // ============================
  // Auth (JWT)
  // ============================
  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // ============================
  // Redis
  // ============================
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow(''),

  // ============================
  // MinIO (Object Storage)
  // ============================
  MINIO_ENDPOINT: Joi.string().default('localhost'),
  MINIO_PORT: Joi.number().default(9000),
  MINIO_ACCESS_KEY: Joi.string().default('minioadmin'),
  MINIO_SECRET_KEY: Joi.string().default('minioadmin'),
  MINIO_USE_SSL: Joi.boolean().default(false),

  // ============================
  // Governo - Master Switch
  // ============================
  GOV_AMBIENTE: Joi.string().valid('1', '2').required(),
  GOV_CERTIFICADO_A1_PATH: Joi.string().optional().allow(''),
  GOV_CERTIFICADO_A1_SENHA: Joi.string().optional().allow(''),
  GOV_UF_EMITENTE: Joi.string().optional().allow(''),
  GOV_COD_MUNICIPIO_IBGE: Joi.string().optional().allow(''),

  // ============================
  // NF-e
  // ============================
  NFE_AMBIENTE: Joi.string().valid('1', '2').optional(),
  NFE_PROVIDER: Joi.string().optional().allow(''),
  NFE_PROVIDER_URL: Joi.string().optional().allow(''),
  NFE_PROVIDER_TOKEN: Joi.string().optional().allow(''),
  NFE_CSC_ID: Joi.string().optional().allow(''),
  NFE_CSC_TOKEN: Joi.string().optional().allow(''),

  // ============================
  // NFS-e
  // ============================
  NFSE_PROVIDER: Joi.string().optional().allow(''),
  NFSE_MUNICIPIO_URL_HOM: Joi.string().optional().allow(''),
  NFSE_MUNICIPIO_URL_PROD: Joi.string().optional().allow(''),
  NFSE_USUARIO: Joi.string().optional().allow(''),
  NFSE_SENHA: Joi.string().optional().allow(''),

  // ============================
  // SPED
  // ============================
  SPED_AMBIENTE: Joi.string().valid('1', '2').optional(),
  SPED_COD_FINALIDADE: Joi.string().default('0'),
  SPED_PERFIL: Joi.string().valid('A', 'B', 'C').default('A'),

  // ============================
  // eSocial
  // ============================
  ESOCIAL_AMBIENTE: Joi.string().valid('1', '2').optional(),
  ESOCIAL_URL_HOM: Joi.string().optional().allow(''),
  ESOCIAL_URL_PROD: Joi.string().optional().allow(''),
  ESOCIAL_VERSAO: Joi.string().optional().allow(''),

  // ============================
  // REINF
  // ============================
  REINF_AMBIENTE: Joi.string().valid('1', '2').optional(),
  REINF_URL_HOM: Joi.string().optional().allow(''),
  REINF_URL_PROD: Joi.string().optional().allow(''),

  // ============================
  // DCTF-Web
  // ============================
  DCTFWEB_AMBIENTE: Joi.string().valid('1', '2').optional(),
  DCTFWEB_URL_HOM: Joi.string().optional().allow(''),
  DCTFWEB_URL_PROD: Joi.string().optional().allow(''),

  // ============================
  // AI
  // ============================
  ANTHROPIC_API_KEY: Joi.string().optional().allow(''),
});

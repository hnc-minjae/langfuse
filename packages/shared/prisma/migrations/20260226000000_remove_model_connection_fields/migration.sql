-- DropColumns
ALTER TABLE "managed_models" DROP COLUMN IF EXISTS "base_url";
ALTER TABLE "managed_models" DROP COLUMN IF EXISTS "model_name";
ALTER TABLE "managed_models" DROP COLUMN IF EXISTS "api_token";
ALTER TABLE "managed_models" DROP COLUMN IF EXISTS "timeout";

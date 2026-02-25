-- AlterTable
ALTER TABLE "managed_models" ADD COLUMN "base_url" TEXT;
ALTER TABLE "managed_models" ADD COLUMN "model_name" TEXT;
ALTER TABLE "managed_models" ADD COLUMN "api_token" TEXT;
ALTER TABLE "managed_models" ADD COLUMN "timeout" INTEGER;

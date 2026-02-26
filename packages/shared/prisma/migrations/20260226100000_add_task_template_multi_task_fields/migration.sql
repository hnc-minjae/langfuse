-- AlterTable: Add multi-task fields for sequential/multiple template types
ALTER TABLE "task_templates" ADD COLUMN "tasks" JSONB;
ALTER TABLE "task_templates" ADD COLUMN "interval" INTEGER;

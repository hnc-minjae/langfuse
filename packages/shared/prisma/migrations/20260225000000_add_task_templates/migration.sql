-- CreateTable
CREATE TABLE "task_templates" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'chat',
    "managed_model_id" TEXT NOT NULL,
    "model_options" JSONB,
    "prompt_config" JSONB NOT NULL,
    "input_forms" JSONB,
    "output_key" TEXT NOT NULL DEFAULT 'text',
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commit_message" TEXT,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_templates_project_id_name_version_key" ON "task_templates"("project_id", "name", "version");

-- CreateIndex
CREATE INDEX "task_templates_project_id_idx" ON "task_templates"("project_id");

-- CreateIndex
CREATE INDEX "task_templates_project_id_name_idx" ON "task_templates"("project_id", "name");

-- CreateIndex
CREATE INDEX "task_templates_tags_idx" ON "task_templates" USING GIN ("tags");

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

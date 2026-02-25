export interface MenuTemplateFile {
  menuTemplates?: unknown[];
  templates?: unknown[];
  simpleChatTemplates?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StringsFile {
  [category: string]: {
    [key: string]: string;
  };
}

export interface OrgMapping {
  orgId: string;
  products: string[];
}

export interface ImportOptions {
  sourcePath: string;
  orgMappings: OrgMapping[];
  dryRun: boolean;
}

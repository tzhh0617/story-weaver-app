export type AppPaths = {
  databaseFile: string;
  exportDir: string;
  logDir: string;
};

export function buildAppPaths(rootDir: string): AppPaths {
  return {
    databaseFile: `${rootDir}/data.db`,
    exportDir: `${rootDir}/exports`,
    logDir: `${rootDir}/logs`,
  };
}

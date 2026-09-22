export type WebsiteVersion = {
  id: string;
  projectId: string;
  versionMajor: number;
  versionMinor: number;
  summary: string;
  careRequestId: string | null;
  isMajor: boolean;
  createdAt: string;
  createdBy: string | null;
};

export function formatWebsiteVersion(version: Pick<WebsiteVersion, "versionMajor" | "versionMinor">): string {
  return `v${version.versionMajor}.${version.versionMinor}`;
}

/** Newest first -- matches how a version history reads naturally. */
export function sortWebsiteVersions(versions: WebsiteVersion[]): WebsiteVersion[] {
  return [...versions].sort((a, b) => {
    if (a.versionMajor !== b.versionMajor) return b.versionMajor - a.versionMajor;
    return b.versionMinor - a.versionMinor;
  });
}

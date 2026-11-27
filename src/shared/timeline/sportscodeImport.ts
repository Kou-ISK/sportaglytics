import type { TimelineDocument } from '../../types/timeline/core';

export interface SportscodeXmlSource {
  path: string;
  text: string;
  sha256: string;
}

export interface SportscodeBundleSelection {
  name: string;
  videoPath: string;
  videoDisplayName: string;
  xml: SportscodeXmlSource | null;
}

export interface SportscodeImportRequest {
  xmlPath: string;
  xmlSha256: string;
  videoPath: string;
  directory: string;
  packageName: string;
  offsetSeconds: number;
  document: TimelineDocument;
  sessionStart: string | null;
  warnings: string[];
}

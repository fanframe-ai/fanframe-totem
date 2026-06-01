import type { TeamRow, TeamTutorialAssets } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readTutorialAssets(value: unknown): TeamTutorialAssets {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as TeamTutorialAssets;
}

function readConfigTutorialAssets(config: unknown): TeamTutorialAssets {
  if (!isRecord(config)) return {};
  return readTutorialAssets(config.tutorial_assets);
}

export function mergeTutorialAssetsForPublish(team: Partial<TeamRow>): TeamTutorialAssets {
  return {
    ...readConfigTutorialAssets(team.published_config),
    ...readConfigTutorialAssets(team.draft_config),
    ...readTutorialAssets(team.tutorial_assets),
  };
}

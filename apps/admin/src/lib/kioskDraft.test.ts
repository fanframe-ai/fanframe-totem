import { describe, expect, it } from "vitest";
import { mergeTutorialAssetsForPublish } from "./kioskDraft";
import type { TeamRow } from "./types";

describe("admin kiosk draft helpers", () => {
  it("preserves visual home layout fields when publishing a price-only edit", () => {
    const team = {
      kiosk_price_cents: 2500,
      tutorial_assets: {
        before: "before.jpg",
        after: "after.jpg",
      },
      published_config: {
        tutorial_assets: {
          before: "before.jpg",
          after: "after.jpg",
          homeLayout: "campaign_poster",
          homeTitleImage: "/flamengo/logomanto.png",
          kioskBackgroundVideo: "home-bg.mp4",
        },
      },
      draft_config: {},
    } as Partial<TeamRow>;

    expect(mergeTutorialAssetsForPublish(team)).toMatchObject({
      before: "before.jpg",
      after: "after.jpg",
      homeLayout: "campaign_poster",
      homeTitleImage: "/flamengo/logomanto.png",
      kioskBackgroundVideo: "home-bg.mp4",
    });
  });
});

# FanFrame Context Map

Gerado por `npm run context:map` a partir de arquivos rastreados e novos nao ignorados (commit ecbf732).
Use `docs/architecture/INDEX.md` para escolher o fluxo antes de abrir codigo.

## Admin remoto

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `apps/admin/src/App.tsx` | 4383 | `App` |
| `apps/admin/src/styles.css` | 758 | - |
| `apps/admin/src/lib/types.ts` | 183 | `Role`, `InstallStatus`, `CommandStatus`, `CommandType`, `TeamAsset`, `TeamWaitingSlide`, `TeamTutorialAssets`, `TeamRow` |
| `apps/admin/src/lib/operationalHealth.ts` | 155 | `isDeviceOffline`, `getDeviceVersionStatus`, `buildDeviceLocationLabel`, `getOperationalIssues`, `OperationalIssueType`, `OperationalIssueSeverity`, `OperationalIssue` |
| `apps/admin/src/lib/designRecipe.ts` | 145 | `applyDesignRecipe`, `createDesignRecipeFromTeam` |
| `apps/admin/src/lib/deviceOperations.ts` | 136 | `generateHumanInstallCode`, `generateSupportPin`, `KioskTestLinkResult` |
| `apps/admin/src/lib/operationalHealth.test.ts` | 130 | - |
| `apps/admin/src/lib/designRecipe.test.ts` | 80 | - |
| `apps/admin/src/lib/installInstructions.ts` | 79 | `formatInstallExpiration`, `buildOwnerInstallMessage`, `buildOwnerUpdateMessage`, `OwnerInstallMessageInput`, `OwnerUpdateMessageInput` |
| `apps/admin/src/lib/salesMetrics.test.ts` | 74 | - |
| `apps/admin/src/lib/installInstructions.test.ts` | 43 | - |
| `apps/admin/src/lib/kioskDraft.test.ts` | 34 | - |
| `apps/admin/AGENTS.md` | 31 | - |
| `apps/admin/src/lib/supabase.ts` | 28 | `publicAssetUrl`, `SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `supabase` |
| `apps/admin/package.json` | 27 | - |
| `apps/admin/src/lib/kioskDraft.ts` | 26 | `mergeTutorialAssetsForPublish` |
| `apps/admin/tsconfig.json` | 25 | - |
| `apps/admin/src/lib/kioskTestLinks.test.ts` | 21 | - |
| ... | +9 arquivos | use `rg --files` no dominio |

Testes proximos: `apps/admin/src/lib/designRecipe.test.ts`, `apps/admin/src/lib/installInstructions.test.ts`, `apps/admin/src/lib/kioskDraft.test.ts`, `apps/admin/src/lib/kioskTestLinks.test.ts`, `apps/admin/src/lib/operationalHealth.test.ts`, `apps/admin/src/lib/paidStuckSessions.test.ts`, `apps/admin/src/lib/salesDeviceFilter.test.ts`, `apps/admin/src/lib/salesMetrics.test.ts`

## Kiosk runtime

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `src/pages/Kiosk.tsx` | 2008 | `KioskPage`, `function` |
| `src/features/kiosk/AGENTS.md` | 24 | - |

Testes proximos: `electron/kiosk-config.test.ts`, `electron/kiosk-hardening.test.ts`, `electron/kiosk-package-security.test.ts`, `electron/kiosk-payments.test.ts`, `electron/kiosk-updates.test.ts`, `src/contexts/TeamContext.test.ts`, `src/lib/adminBuilderArchitecture.test.ts`, `src/lib/cameraReadyVisual.test.ts`, `src/lib/cpf.test.ts`, `src/lib/edgeFunctionsArchitecture.test.ts`, `src/lib/kiosk.test.ts`, `src/lib/kioskOnlineTestArchitecture.test.ts`

## UI compartilhada

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `src/shared/kiosk-ui/kioskVisual.css` | 2721 | - |
| `src/shared/kiosk-ui/KioskVisual.tsx` | 766 | `KioskVisualShell`, `KioskHomeVisual`, `KioskSelectionVisual`, `KioskPaymentVisual`, `KioskCpfVisual`, `KioskRecoveryResultsVisual`, `KioskCameraVisual`, `KioskCameraReadyVisual` |
| `src/shared/kiosk-ui/AGENTS.md` | 25 | - |

Testes proximos: `electron/kiosk-config.test.ts`, `electron/kiosk-hardening.test.ts`, `electron/kiosk-package-security.test.ts`, `electron/kiosk-payments.test.ts`, `electron/kiosk-updates.test.ts`, `src/contexts/TeamContext.test.ts`, `src/lib/adminBuilderArchitecture.test.ts`, `src/lib/cameraReadyVisual.test.ts`, `src/lib/cpf.test.ts`, `src/lib/edgeFunctionsArchitecture.test.ts`, `src/lib/kiosk.test.ts`, `src/lib/kioskOnlineTestArchitecture.test.ts`

## Electron

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `electron/main.cjs` | 528 | - |
| `electron/kiosk-updates.test.ts` | 176 | - |
| `electron/kiosk-updates.cjs` | 116 | - |
| `electron/kiosk-hardening.cjs` | 61 | - |
| `electron/kiosk-hardening.test.ts` | 57 | - |
| `electron/kiosk-payments.test.ts` | 41 | - |
| `electron/kiosk-config.test.ts` | 40 | - |
| `electron/kiosk-config.cjs` | 38 | - |
| `electron/kiosk-package-security.test.ts` | 37 | - |
| `electron/kiosk-payments.cjs` | 26 | - |
| `electron/AGENTS.md` | 22 | - |
| `electron/preload.cjs` | 22 | - |

Testes proximos: `electron/kiosk-config.test.ts`, `electron/kiosk-hardening.test.ts`, `electron/kiosk-package-security.test.ts`, `electron/kiosk-payments.test.ts`, `electron/kiosk-updates.test.ts`

## Supabase

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `supabase/functions/generate-tryon/index.ts` | 904 | - |
| `supabase/functions/create-kiosk-payment/index.ts` | 480 | - |
| `supabase/functions/create-delivery-link/index.ts` | 392 | - |
| `supabase/functions/health-check/index.ts` | 375 | - |
| `supabase/functions/replicate-webhook/index.ts` | 333 | - |
| `supabase/functions/recover-kiosk-photos/index.ts` | 175 | - |
| `supabase/migrations/20260104231020_efc41291-ad63-4c1f-a491-c59a7aa8b125.sql` | 172 | - |
| `supabase/functions/manage-kiosk-test-links/index.ts` | 168 | - |
| `supabase/migrations/20260509030000_add_kiosk_totem_support.sql` | 156 | - |
| `supabase/functions/redeem-kiosk-install-code/index.ts` | 154 | - |
| `supabase/migrations/20260510143000_add_operational_roles.sql` | 138 | - |
| `supabase/functions/poll-kiosk-commands/index.ts` | 133 | - |
| `supabase/functions/manage-admin-users/index.ts` | 132 | - |
| `supabase/functions/admin-maintenance/index.ts` | 126 | - |
| `supabase/migrations/20260510120000_add_kiosk_pairing_operations.sql` | 126 | - |
| `supabase/functions/create-first-admin/index.ts` | 115 | - |
| `supabase/functions/pagbank-webhook/index.ts` | 107 | - |
| `supabase/functions/mark-kiosk-session-error/index.ts` | 94 | - |
| ... | +44 arquivos | use `rg --files` no dominio |

Testes proximos: `supabase/functions/mark-kiosk-session-error/index.test.ts`, `supabase/functions/recover-kiosk-photos/index.test.ts`

## Scripts e configuracao

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `scripts/release-kiosk.ps1` | 199 | - |
| `scripts/test-pagbank-sandbox.ps1` | 177 | - |
| `package.json` | 166 | - |
| `scripts/generate-context-map.mjs` | 161 | `shouldIncludeFile`, `classifyDomain`, `buildContextMap`, `generateContextMap` |
| `scripts/check-affected.mjs` | 99 | `matchesPattern`, `selectChecks` |
| `scripts/check-kiosk-package-security.mjs` | 61 | - |
| `scripts/affected-rules.json` | 59 | - |
| `scripts/deploy-supabase-totem.ps1` | 59 | - |
| `scripts/check-affected.test.ts` | 53 | - |
| `scripts/generate-context-map.test.ts` | 45 | - |
| `scripts/verify-kiosk-release.ps1` | 39 | - |
| `scripts/check-edge-functions.mjs` | 37 | - |
| `tsconfig.app.json` | 32 | - |
| `eslint.config.js` | 27 | `tseslint` |
| `tsconfig.json` | 24 | - |
| `tsconfig.node.json` | 23 | - |
| `vite.config.ts` | 21 | `defineConfig` |

Testes proximos: `scripts/check-affected.test.ts`, `scripts/generate-context-map.test.ts`

## Documentacao

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `docs/superpowers/plans/2026-05-10-kiosk-network-operations.md` | 1486 | `normalizeInstallCode`, `buildDeviceAuthHeaders`, `shouldReportHealth`, `classifyKioskError`, `generateHumanInstallCode`, `InstallStatus`, `CommandStatus`, `CommandType` |
| `docs/superpowers/plans/2026-07-03-project-handoff-documentation.md` | 916 | - |
| `docs/superpowers/plans/2026-06-30-kiosk-paid-session-generation-recovery.md` | 773 | - |
| `docs/superpowers/plans/2026-06-01-foreground-person-filter.md` | 737 | `DetectedPerson`, `ForegroundFilterConfig`, `ForegroundDecision`, `chooseForegroundPeople`, `detectPeopleFromImage`, `loadImageFromDataUrl`, `processForegroundPhoto`, `renderForegroundOnlyImage` |
| `docs/superpowers/plans/2026-05-22-production-hardening-and-operations.md` | 567 | - |
| `docs/replicate-integration.md` | 484 | `useQueueSubscription` |
| `docs/superpowers/plans/2026-06-11-codex-context-efficiency.md` | 405 | - |
| `docs/DOCUMENTATION.md` | 390 | - |
| `docs/design-system.md` | 225 | - |
| `docs/superpowers/specs/2026-05-10-kiosk-network-operations-design.md` | 185 | - |
| `docs/OPERATIONS.md` | 124 | - |
| `docs/DEVELOPMENT.md` | 121 | - |
| `docs/kiosk-totem.md` | 120 | - |
| `docs/windows-kiosk-release.md` | 109 | - |
| `docs/release-automation.md` | 98 | - |
| `docs/HANDOFF.md` | 92 | - |
| `docs/go-live-checklist.md` | 85 | - |
| `docs/superpowers/plans/2026-06-25-kiosk-online-test-links.md` | 74 | - |
| ... | +17 arquivos | use `rg --files` no dominio |

## Outros

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `src/integrations/supabase/types.ts` | 1011 | `Json`, `Database`, `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`, `CompositeTypes`, `Constants` |
| `src/pages/admin/TeamEdit.tsx` | 823 | `TeamEdit`, `function` |
| `src/pages/admin/SystemStatus.tsx` | 698 | `AdminSystemStatus`, `function` |
| `src/components/ui/sidebar.tsx` | 638 | - |
| `src/components/wizard/ResultScreen.tsx` | 573 | `ResultScreen` |
| `src/index.css` | 518 | - |
| `src/lib/kiosk.ts` | 431 | `formatCurrencyFromCents`, `filterVisibleAssets`, `normalizeKioskTimeout`, `buildDeliveryUrl`, `normalizeInstallCode`, `buildDeviceAuthHeaders`, `shouldReportHealth`, `shouldReloadForRemoteKioskState` |
| `src/contexts/TeamContext.tsx` | 337 | `useTeam`, `normalizeTutorialAssets`, `TeamProvider`, `TeamShirt`, `TeamBackground`, `TeamTextOverrides`, `TeamWaitingSlide`, `TeamTutorialAssets` |
| `src/pages/admin/Assets.tsx` | 319 | `AdminAssets`, `function` |
| `src/hooks/useQueueSubscription.ts` | 316 | `useQueueSubscription`, `useQueueStatusCheck` |
| `src/components/wizard/UploadScreen.tsx` | 305 | `UploadScreen` |
| `src/components/ui/chart.tsx` | 304 | `ChartConfig` |
| `src/components/wizard/TestResultScreen.tsx` | 284 | `TestResultScreen` |
| `src/components/admin/AssetCard.tsx` | 227 | `AssetCard`, `AssetCardProps` |
| `src/components/ui/carousel.tsx` | 225 | - |
| `src/hooks/useAdminStats.ts` | 222 | `useAdminStats` |
| `src/lib/adminBuilderArchitecture.test.ts` | 217 | - |
| `src/pages/Index.tsx` | 211 | `Index` |
| ... | +108 arquivos | use `rg --files` no dominio |

Testes proximos: `src/contexts/TeamContext.test.ts`, `src/lib/adminBuilderArchitecture.test.ts`, `src/lib/cameraReadyVisual.test.ts`, `src/lib/cpf.test.ts`, `src/lib/edgeFunctionsArchitecture.test.ts`, `src/lib/kiosk.test.ts`, `src/lib/kioskOnlineTestArchitecture.test.ts`, `src/lib/kioskPaidGenerationRecovery.test.ts`, `src/lib/kioskPairing.test.ts`, `src/lib/photoRecoveryArchitecture.test.ts`, `src/pages/Kiosk.pairing.test.ts`

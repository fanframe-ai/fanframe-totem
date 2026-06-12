# FanFrame Context Map

Gerado por `npm run context:map` a partir de arquivos rastreados e novos nao ignorados (commit 21941fc).
Use `docs/architecture/INDEX.md` para escolher o fluxo antes de abrir codigo.

## Admin remoto

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `apps/admin/src/App.tsx` | 3703 | `App` |
| `apps/admin/src/styles.css` | 675 | - |
| `apps/admin/src/lib/types.ts` | 183 | `Role`, `InstallStatus`, `CommandStatus`, `CommandType`, `TeamAsset`, `TeamWaitingSlide`, `TeamTutorialAssets`, `TeamRow` |
| `apps/admin/src/lib/operationalHealth.ts` | 155 | `isDeviceOffline`, `getDeviceVersionStatus`, `buildDeviceLocationLabel`, `getOperationalIssues`, `OperationalIssueType`, `OperationalIssueSeverity`, `OperationalIssue` |
| `apps/admin/src/lib/designRecipe.ts` | 145 | `applyDesignRecipe`, `createDesignRecipeFromTeam` |
| `apps/admin/src/lib/operationalHealth.test.ts` | 130 | - |
| `apps/admin/src/lib/deviceOperations.ts` | 112 | `generateHumanInstallCode`, `generateSupportPin` |
| `apps/admin/src/lib/designRecipe.test.ts` | 80 | - |
| `apps/admin/src/lib/installInstructions.ts` | 79 | `formatInstallExpiration`, `buildOwnerInstallMessage`, `buildOwnerUpdateMessage`, `OwnerInstallMessageInput`, `OwnerUpdateMessageInput` |
| `apps/admin/src/lib/installInstructions.test.ts` | 43 | - |
| `apps/admin/src/lib/kioskDraft.test.ts` | 34 | - |
| `apps/admin/AGENTS.md` | 31 | - |
| `apps/admin/src/lib/supabase.ts` | 28 | `publicAssetUrl`, `SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `supabase` |
| `apps/admin/package.json` | 27 | - |
| `apps/admin/src/lib/kioskDraft.ts` | 26 | `mergeTutorialAssetsForPublish` |
| `apps/admin/tsconfig.json` | 25 | - |
| `apps/admin/src/main.tsx` | 15 | - |
| `apps/admin/vite.config.ts` | 14 | `defineConfig` |
| ... | +4 arquivos | use `rg --files` no dominio |

Testes proximos: `apps/admin/src/lib/designRecipe.test.ts`, `apps/admin/src/lib/installInstructions.test.ts`, `apps/admin/src/lib/kioskDraft.test.ts`, `apps/admin/src/lib/operationalHealth.test.ts`

## Kiosk runtime

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `src/pages/Kiosk.tsx` | 1887 | `KioskPage`, `function` |
| `src/features/kiosk/AGENTS.md` | 24 | - |

Testes proximos: `electron/kiosk-config.test.ts`, `electron/kiosk-hardening.test.ts`, `electron/kiosk-payments.test.ts`, `electron/kiosk-updates.test.ts`, `src/contexts/TeamContext.test.ts`, `src/lib/adminBuilderArchitecture.test.ts`, `src/lib/cpf.test.ts`, `src/lib/edgeFunctionsArchitecture.test.ts`, `src/lib/kiosk.test.ts`, `src/lib/kioskPairing.test.ts`, `src/lib/photoRecoveryArchitecture.test.ts`, `src/pages/Kiosk.pairing.test.ts`

## UI compartilhada

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `src/shared/kiosk-ui/kioskVisual.css` | 2615 | - |
| `src/shared/kiosk-ui/KioskVisual.tsx` | 710 | `KioskVisualShell`, `KioskHomeVisual`, `KioskSelectionVisual`, `KioskPaymentVisual`, `KioskCpfVisual`, `KioskRecoveryResultsVisual`, `KioskCameraVisual`, `KioskGeneratingVisual` |
| `src/shared/kiosk-ui/AGENTS.md` | 25 | - |

Testes proximos: `electron/kiosk-config.test.ts`, `electron/kiosk-hardening.test.ts`, `electron/kiosk-payments.test.ts`, `electron/kiosk-updates.test.ts`, `src/contexts/TeamContext.test.ts`, `src/lib/adminBuilderArchitecture.test.ts`, `src/lib/cpf.test.ts`, `src/lib/edgeFunctionsArchitecture.test.ts`, `src/lib/kiosk.test.ts`, `src/lib/kioskPairing.test.ts`, `src/lib/photoRecoveryArchitecture.test.ts`, `src/pages/Kiosk.pairing.test.ts`

## Electron

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `electron/main.cjs` | 521 | - |
| `electron/kiosk-updates.test.ts` | 176 | - |
| `electron/kiosk-updates.cjs` | 116 | - |
| `electron/kiosk-hardening.cjs` | 61 | - |
| `electron/kiosk-hardening.test.ts` | 57 | - |
| `electron/kiosk-payments.test.ts` | 41 | - |
| `electron/kiosk-config.test.ts` | 40 | - |
| `electron/kiosk-config.cjs` | 38 | - |
| `electron/kiosk-payments.cjs` | 26 | - |
| `electron/AGENTS.md` | 22 | - |
| `electron/preload.cjs` | 22 | - |

Testes proximos: `electron/kiosk-config.test.ts`, `electron/kiosk-hardening.test.ts`, `electron/kiosk-payments.test.ts`, `electron/kiosk-updates.test.ts`

## Supabase

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `supabase/functions/generate-tryon/index.ts` | 859 | - |
| `supabase/functions/create-kiosk-payment/index.ts` | 453 | - |
| `supabase/functions/create-delivery-link/index.ts` | 392 | - |
| `supabase/functions/health-check/index.ts` | 375 | - |
| `supabase/functions/replicate-webhook/index.ts` | 333 | - |
| `supabase/functions/deploy-functions/index.ts` | 236 | - |
| `supabase/migrations/20260104231020_efc41291-ad63-4c1f-a491-c59a7aa8b125.sql` | 172 | - |
| `supabase/functions/recover-kiosk-photos/index.ts` | 164 | - |
| `supabase/migrations/20260509030000_add_kiosk_totem_support.sql` | 156 | - |
| `supabase/functions/redeem-kiosk-install-code/index.ts` | 154 | - |
| `supabase/migrations/20260510143000_add_operational_roles.sql` | 138 | - |
| `supabase/functions/poll-kiosk-commands/index.ts` | 133 | - |
| `supabase/functions/manage-admin-users/index.ts` | 132 | - |
| `supabase/migrations/20260510120000_add_kiosk_pairing_operations.sql` | 126 | - |
| `supabase/functions/create-first-admin/index.ts` | 115 | - |
| `supabase/functions/pagbank-webhook/index.ts` | 107 | - |
| `supabase/functions/report-kiosk-health/index.ts` | 86 | - |
| `supabase/migrations/20260205212042_e4a1b344-4c18-4a5e-a516-a3fd1f147cc8.sql` | 69 | - |
| ... | +39 arquivos | use `rg --files` no dominio |

## Scripts e configuracao

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `scripts/deploy-edge-functions.ts` | 330 | - |
| `scripts/release-kiosk.ps1` | 199 | - |
| `scripts/test-pagbank-sandbox.ps1` | 177 | - |
| `scripts/generate-context-map.mjs` | 163 | `shouldIncludeFile`, `classifyDomain`, `buildContextMap`, `generateContextMap` |
| `package.json` | 154 | - |
| `scripts/check-affected.mjs` | 99 | `matchesPattern`, `selectChecks` |
| `scripts/affected-rules.json` | 59 | - |
| `scripts/deploy-supabase-totem.ps1` | 57 | - |
| `scripts/check-affected.test.ts` | 53 | - |
| `scripts/generate-context-map.test.ts` | 45 | - |
| `scripts/verify-kiosk-release.ps1` | 39 | - |
| `scripts/check-edge-functions.mjs` | 37 | - |
| `tsconfig.app.json` | 32 | - |
| `eslint.config.js` | 27 | `tseslint` |
| `tsconfig.json` | 24 | - |
| `tsconfig.node.json` | 23 | - |
| `vite.config.ts` | 18 | `defineConfig` |

Testes proximos: `scripts/check-affected.test.ts`, `scripts/generate-context-map.test.ts`

## Documentacao

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `docs/superpowers/plans/2026-05-10-kiosk-network-operations.md` | 1486 | `normalizeInstallCode`, `buildDeviceAuthHeaders`, `shouldReportHealth`, `classifyKioskError`, `generateHumanInstallCode`, `InstallStatus`, `CommandStatus`, `CommandType` |
| `docs/superpowers/plans/2026-06-01-foreground-person-filter.md` | 737 | `DetectedPerson`, `ForegroundFilterConfig`, `ForegroundDecision`, `chooseForegroundPeople`, `detectPeopleFromImage`, `loadImageFromDataUrl`, `processForegroundPhoto`, `renderForegroundOnlyImage` |
| `docs/superpowers/plans/2026-05-22-production-hardening-and-operations.md` | 567 | - |
| `docs/replicate-integration.md` | 484 | `useQueueSubscription` |
| `docs/superpowers/plans/2026-06-11-codex-context-efficiency.md` | 405 | - |
| `docs/DOCUMENTATION.md` | 392 | - |
| `docs/design-system.md` | 225 | - |
| `docs/superpowers/specs/2026-05-10-kiosk-network-operations-design.md` | 185 | - |
| `docs/kiosk-totem.md` | 120 | - |
| `docs/windows-kiosk-release.md` | 109 | - |
| `docs/go-live-checklist.md` | 85 | - |
| `docs/release-automation.md` | 76 | - |
| `docs/kiosk-installation-owner-guide.md` | 67 | - |
| `README.md` | 58 | - |
| `docs/superpowers/plans/2026-05-14-admin-ux-simplification.md` | 57 | - |
| `docs/superpowers/plans/2026-06-11-kiosk-photo-recovery.md` | 54 | - |
| `docs/architecture/kiosk-flow.md` | 40 | - |
| `docs/architecture/payment-flow.md` | 39 | - |
| ... | +8 arquivos | use `rg --files` no dominio |

## Outros

| Arquivo | Linhas | Exports principais |
| --- | ---: | --- |
| `src/integrations/supabase/types.ts` | 1011 | `Json`, `Database`, `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`, `CompositeTypes`, `Constants` |
| `src/pages/admin/TeamEdit.tsx` | 823 | `TeamEdit`, `function` |
| `src/pages/admin/SystemStatus.tsx` | 698 | `AdminSystemStatus`, `function` |
| `src/components/ui/sidebar.tsx` | 638 | - |
| `src/components/wizard/ResultScreen.tsx` | 573 | `ResultScreen` |
| `src/index.css` | 518 | - |
| `src/contexts/TeamContext.tsx` | 334 | `useTeam`, `normalizeTutorialAssets`, `TeamProvider`, `TeamShirt`, `TeamBackground`, `TeamTextOverrides`, `TeamWaitingSlide`, `TeamTutorialAssets` |
| `src/pages/admin/Assets.tsx` | 319 | `AdminAssets`, `function` |
| `src/hooks/useQueueSubscription.ts` | 316 | `useQueueSubscription`, `useQueueStatusCheck` |
| `src/components/wizard/UploadScreen.tsx` | 305 | `UploadScreen` |
| `src/components/ui/chart.tsx` | 304 | `ChartConfig` |
| `src/components/wizard/TestResultScreen.tsx` | 284 | `TestResultScreen` |
| `src/lib/kiosk.ts` | 259 | `formatCurrencyFromCents`, `filterVisibleAssets`, `normalizeKioskTimeout`, `buildDeliveryUrl`, `normalizeInstallCode`, `buildDeviceAuthHeaders`, `shouldReportHealth`, `shouldReloadForRemoteKioskState` |
| `src/components/admin/AssetCard.tsx` | 227 | `AssetCard`, `AssetCardProps` |
| `src/components/ui/carousel.tsx` | 225 | - |
| `src/hooks/useAdminStats.ts` | 222 | `useAdminStats` |
| `src/lib/adminBuilderArchitecture.test.ts` | 217 | - |
| `src/pages/Index.tsx` | 211 | `Index` |
| ... | +105 arquivos | use `rg --files` no dominio |

Testes proximos: `src/contexts/TeamContext.test.ts`, `src/lib/adminBuilderArchitecture.test.ts`, `src/lib/cpf.test.ts`, `src/lib/edgeFunctionsArchitecture.test.ts`, `src/lib/kiosk.test.ts`, `src/lib/kioskPairing.test.ts`, `src/lib/photoRecoveryArchitecture.test.ts`, `src/pages/Kiosk.pairing.test.ts`

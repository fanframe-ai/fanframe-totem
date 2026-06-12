# FanFrame Verification Matrix

Execute o menor conjunto que prove a mudanca. Os comandos abaixo sao contratos operacionais do repositorio.

| Mudanca | Comando minimo | Verificacao adicional |
| --- | --- | --- |
| Kiosk React, fluxo, CPF, recuperacao | `npm run check:kiosk` | Electron se usar API local |
| Componentes em `src/shared/kiosk-ui` | `npm run check:kiosk` e `npm run check:admin` | Screenshot 1080x1920 |
| Painel remoto | `npm run check:admin` | Browser no fluxo alterado |
| Electron, updater ou configuracao local | `npm run check:electron` | Instalador Windows quando empacotamento mudar |
| Edge Function | `npm run check:functions` | Teste sandbox quando integrar provedor externo |
| Migration/RLS | `npm run check:functions` | Revisao manual de policy e indice |
| Package, tsconfig, Vite ou contrato compartilhado | `npm run check:all` | - |
| Release kiosk | `npm run check:all` | `npm run release:kiosk:verify` ja incluido no check Electron |
| Documentacao/AGENTS apenas | `npm run context:check` | Revisar links e comandos |

## Limites

- `check:affected` escolhe checks a partir do Git e explica a decisao.
- Mudancas ainda nao versionadas tambem entram no calculo.
- Na duvida entre dois dominios, execute ambos.
- Build completo nao substitui teste de comportamento nem verificacao visual.


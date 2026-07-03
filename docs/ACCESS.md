# FanFrame Totem Access Matrix

This file lists required access. It must never contain actual secrets, passwords, tokens, service-role keys, customer data, CPF values, or device secrets.

## Required Access

| System | Needed For | Required Scope |
| --- | --- | --- |
| GitHub repo `fanframe-ai/fanframe-totem` | Code, releases, issue/PR history | Push to `main`, create tags/releases, upload release assets |
| Vercel admin project | Admin web deployment and env vars | Project member with deployment/env access |
| Vercel kiosk web project | Online kiosk test deployment and env vars | Project member with deployment/env access |
| Supabase project `dzfbjscrpxhpyeimggut` | Database, Edge Functions, logs, secrets | Project admin/developer; service role only in backend tools |
| PagBank | Real PIX payment integration | Production API credential management and webhook settings |
| Replicate | AI generation provider | API token management and usage visibility |
| Physical Windows kiosk | Local config, camera, updater, logs | Windows admin or operator access |

## Local Files That Stay Local

| File | Why |
| --- | --- |
| `.env` | Local frontend env values |
| `kiosk.config.json` | Device pairing/config secrets |
| Supabase access token temp files | CLI auth only |
| Build output in `release/` | Generated artifacts; GitHub Release stores published binaries |

## Safe Sharing Rule

Share the GitHub URL and this documentation. Share credentials through the team's password manager or direct secure channel. Do not paste credentials into Codex, GitHub issues, Markdown docs, or screenshots.

## Token Rotation Rule

Rotate any token that was pasted into chat, logs, screenshots, or shell history. Supabase personal access tokens and GitHub tokens should be treated as compromised once pasted into a long-lived conversation.

# AGENTS.md - Access Authenticator UX Design

## Project
React + TypeScript Vite app - Enterprise TOTP authenticator with biometric security. Mobile-first (430×932 viewport).

## Commands
- `npm run dev` - Dev server (auto-opens browser)
- `npm run build` - Output to `dist/`
- No lint/typecheck scripts exist

## Path Aliases
- Use `@/` for imports from `src/` (e.g., `@/app/App.tsx`)

## Styling
- Tailwind v4: `@import 'tailwindcss' source(none);` in `src/styles/tailwind.css`
- Theme: Primary `#003883` (Access Blue), Secondary `#FF8200` (Orange)
- Font: Effra (loaded via CDN in `src/styles/fonts.css`)

## Entry Points
- `src/main.tsx` → `src/app/App.tsx`
- UI components: `src/app/components/ui/` (shadcn-like)
- Screen components: `src/app/components/` (AddTokenFlow, BiometricPrompt, Settings, TokenList, TokenDetail, EmptyState, etc.)

## Architecture
- State: React `useState` + `localStorage` for persistence
- TOTP: Custom generator in `src/app/utils/totp.ts` (30-second windows, simplified demo)
- Screen navigation via state machine: `empty` | `list` | `add-token` | `biometric` | `detail` | `settings`

## Special Features
- **Figma asset resolver**: Use `figma:asset/filename.ext` in imports to load from `src/assets/`
- **PWA**: Configured with auto-update, portrait orientation, standalone display

## Key Dependencies
- MUI v7, Radix UI (multiple components), Motion, date-fns, html5-qrcode, react-hook-form

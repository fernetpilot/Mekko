# Mekkoo

Kalkulator for maks last på tilhenger i Norge – viser om det er førerkortet, bilen eller
hengeren som begrenser. Data fra Statens vegvesens kjøretøy-API.

Forsiden (`/`) viser bilhold-siden med en 3D-bil og eksempeldata. Kalkulatoren ligger på
`/kalkulator`, med en knapp til den øverst på forsiden.

## Kom i gang
1. Kopier `.env.example` til `.env` og lim inn API-nøkkelen (filen lastes aldri opp).
2. Kjør lokalt: `npx netlify-cli dev` og åpne adressen som vises.
3. Test beregningen: `npm test`

## Publisering
Netlify publiserer automatisk fra `main`. API-nøkkelen legges inn i Netlify under
Site configuration → Environment variables som `SVV_API_KEY`.

Se `CLAUDE.md` for prosjektregler.

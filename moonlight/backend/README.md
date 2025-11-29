# MoonLight Backend - P01-P05 Bootstrap

## Kurulum

```bash
cd backend
yarn install
cp .env.example .env
```

## Test Çalıştırma

```bash
# Tüm testler
yarn test

# Watch mode
yarn test:watch

# Coverage
yarn test:cov
```

## Geliştirme Sunucusu

```bash
yarn start:dev
```

## P01-P05 Modüller

- **P01:** Canonical Signal Model (DTO + validation)
- **P02:** Execution FSM (13-state, 3 handler)
- **P03:** ART Engine (DayCap + HMAC sign)
- **P04:** Conflict Resolver (same-symbol, cluster)
- **P05:** Fixed-Time Scheduler (bar close sync)

## Klasör Yapısı

```
backend/
├── src/
│   ├── execution/       (P02, P04, P05)
│   ├── risk/            (P03)
│   ├── shared/          (P01: DTO, enums, utils)
│   └── tests/
├── config/
└── data/
```

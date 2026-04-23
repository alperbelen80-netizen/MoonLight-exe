import { VersionedSelectorBundle } from './dom-base';

/**
 * V2.6-5-B Default versioned selector bundles.
 *
 * IMPORTANT: DOM selectors drift. Operators SHOULD override these via
 * `DOM_SELECTORS_JSON` or by registering a fresh bundle at boot. The
 * defaults ship a sensible best-effort set so smoke + contract tests pass.
 *
 * Contract (every bundle MUST expose):
 *   - emailInput, passwordInput, submitButton
 *   - dashboardReady  (a selector present only after successful login)
 *   - lastPrice       (live quote text node)
 *   - stakeInput      (investment amount input)
 *   - callButton, putButton (direction commit buttons)
 *
 * v2.6-5-B additions (all optional — adapters degrade gracefully when absent):
 *   - confirmButton   (the final "Buy" / "Invest" confirmation click)
 *   - balanceDisplay  (read live balance from the DOM)
 *   - demoBadge       (a selector present ONLY in demo mode — used for
 *                      pre-flight "is this really demo?" safety check)
 *   - payoutDisplay   (per-asset payout % text)
 *   - expiryInput     (expiry selector if adjustable)
 */

export const DEFAULT_OLYMP_TRADE_SELECTORS: VersionedSelectorBundle = {
  version: '2026-04-v2',
  loginUrl: 'https://olymptrade.com/en/platform',
  selectors: {
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    submitButton: 'button[type="submit"]',
    dashboardReady: '[data-test="trading-panel"]',
    lastPrice: '[data-test="instrument-price"]',
    stakeInput: '[data-test="amount-input"]',
    callButton: '[data-test="button-call"]',
    putButton: '[data-test="button-put"]',
    // v2.6-5-B: live-click + pre-flight extensions
    confirmButton: '[data-test="trade-confirm"]',
    balanceDisplay: '[data-test="balance-amount"]',
    demoBadge: '[data-test="account-mode"][data-mode="demo"]',
    payoutDisplay: '[data-test="payout-value"]',
    expiryInput: '[data-test="expiry-input"]',
  },
};

export const DEFAULT_BINOMO_SELECTORS: VersionedSelectorBundle = {
  version: '2026-04-v2',
  loginUrl: 'https://binomo.com/trading',
  selectors: {
    emailInput: 'input[type="email"]',
    passwordInput: 'input[type="password"]',
    submitButton: 'button[data-vt="login-submit"]',
    dashboardReady: '[data-vt="chart-container"]',
    lastPrice: '[data-vt="quote-price"]',
    stakeInput: '[data-vt="trade-amount"]',
    callButton: '[data-vt="btn-call"]',
    putButton: '[data-vt="btn-put"]',
    // v2.6-5-B
    confirmButton: '[data-vt="trade-confirm"]',
    balanceDisplay: '[data-vt="balance-value"]',
    demoBadge: '[data-vt="account-kind"][data-kind="demo"]',
    payoutDisplay: '[data-vt="asset-payout"]',
    expiryInput: '[data-vt="expiry-select"]',
  },
};

export const DEFAULT_EXPERT_OPTION_SELECTORS: VersionedSelectorBundle = {
  version: '2026-04-v2',
  loginUrl: 'https://app.expertoption.com/',
  selectors: {
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    submitButton: 'button.sign-in-submit',
    dashboardReady: '.trading-platform',
    lastPrice: '.price-current',
    stakeInput: '.investment-input',
    callButton: '.btn-call',
    putButton: '.btn-put',
    // v2.6-5-B
    confirmButton: '.trade-confirm-btn',
    balanceDisplay: '.balance-amount',
    demoBadge: '.account-mode.demo',
    payoutDisplay: '.asset-payout',
    expiryInput: '.expiry-selector',
  },
};

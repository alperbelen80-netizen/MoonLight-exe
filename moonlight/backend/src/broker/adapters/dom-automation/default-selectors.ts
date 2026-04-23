import { VersionedSelectorBundle } from './dom-base';

/**
 * V2.5-4 Default versioned selector bundles.
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
 */

export const DEFAULT_OLYMP_TRADE_SELECTORS: VersionedSelectorBundle = {
  version: '2026-04-v1',
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
  },
};

export const DEFAULT_BINOMO_SELECTORS: VersionedSelectorBundle = {
  version: '2026-04-v1',
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
  },
};

export const DEFAULT_EXPERT_OPTION_SELECTORS: VersionedSelectorBundle = {
  version: '2026-04-v1',
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
  },
};

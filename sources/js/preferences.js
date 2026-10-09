// preferences.js — site-wide Display (dark mode) and Accessibility
// (text size) preferences. Saved in localStorage, applied on every
// page load. Controlled from Account/settings.html.
//
// Honest limitation: this covers the most common, visible elements
// (page backgrounds, text, cards, forms) rather than guaranteeing
// every single component on every page is perfectly styled — this
// template has a lot of page-specific CSS with hardcoded colors.

(function () {
  var THEME_KEY = 'sv_theme'; // 'light' | 'dark'
  var TEXT_SIZE_KEY = 'sv_text_size'; // 'normal' | 'large' | 'larger'

  function applyTheme(theme) {
    document.documentElement.classList.toggle('sv-dark', theme === 'dark');
  }
  function applyTextSize(size) {
    document.documentElement.classList.remove('sv-text-large', 'sv-text-larger');
    if (size === 'large') document.documentElement.classList.add('sv-text-large');
    if (size === 'larger') document.documentElement.classList.add('sv-text-larger');
  }

  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  applyTextSize(localStorage.getItem(TEXT_SIZE_KEY) || 'normal');

  window.svSetTheme = function (theme) {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  };
  window.svGetTheme = function () {
    return localStorage.getItem(THEME_KEY) || 'light';
  };
  window.svSetTextSize = function (size) {
    localStorage.setItem(TEXT_SIZE_KEY, size);
    applyTextSize(size);
  };
  window.svGetTextSize = function () {
    return localStorage.getItem(TEXT_SIZE_KEY) || 'normal';
  };
})();

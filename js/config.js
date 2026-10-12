/**
 * Gym Pro Management System — Global API Configuration
 * -------------------------------------------------------------
 * پاش ئەوەی فایلی Code.gs ـت لەناو Google Apps Script وەک Web App بڵاوکردەوە،
 * ئەو بەستەرەی (Web app URL) پێت درا لە شوێنی API_URL دابنێ:
 * 
 * نموونە:
 * "https://script.google.com/macros/s/AKfycb.../exec"
 */
const GYM_CONFIG = {
  // بەستەری Google Apps Script Web App:
  API_URL: "https://script.google.com/macros/s/AKfycbz_1UYFwqWKfD10nwK-9kIrB1-PkJ1N2vH_KDti0hFO-nDI/exec"
};

// خوێندنەوەی بەستەر لە پاشەکەوتکراوی مۆبایل (localStorage) یان پارامیتەری URL (?api=...)
(function() {
  try {
    const params = new URLSearchParams(window.location.search);
    const paramUrl = params.get('api');
    if (paramUrl && paramUrl.trim()) {
      localStorage.setItem('gym_api_url', paramUrl.trim());
    }
  } catch (e) {}

  window.GYM_API_URL = (localStorage.getItem('gym_api_url') || GYM_CONFIG.API_URL || '').trim();
})();

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
  API_URL: "https://script.google.com/macros/s/AKfycby1nXz4stCP-j58WtCHbEmyek4aIvb_Vy-s5DiwTuvlh2I5W1und9F8ez4Gwv61Hl2u9A/exec"
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

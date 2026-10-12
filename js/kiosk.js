const $ = id => document.getElementById(id);

// Initialization of API url from query params if given (?api=...)
(function() {
  try {
    const p = new URLSearchParams(window.location.search);
    const apiParam = p.get('api');
    if (apiParam) {
      localStorage.setItem('gym_api_url', apiParam);
    }
  } catch(e){}
})();

async function call(fn, ...args) {
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    return new Promise((res, rej) => {
      google.script.run.withSuccessHandler(res).withFailureHandler(e => rej(e))[fn](...args);
    });
  }

  const apiUrl = (typeof GYM_API_URL !== 'undefined' && GYM_API_URL) ? GYM_API_URL : (localStorage.getItem('gym_api_url') || '');
  if (apiUrl) {
    const isGoogle = apiUrl.includes('script.google.com');
    const endpoint = isGoogle ? apiUrl : (apiUrl.replace(/\/$/, '') + '/api/' + fn);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: isGoogle ? { 'Content-Type': 'text/plain;charset=utf-8' } : { 'Content-Type': 'application/json' },
        body: JSON.stringify(isGoogle ? { fn, args } : { args }),
        redirect: 'follow'
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Request failed');
      return data.result;
    } catch(err) {
      console.error(`Call "${fn}" to remote API failed:`, err);
      throw err;
    }
  }

  try {
    const res = await fetch('/api/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Server error');
    return data.result;
  } catch (err) {
    console.error(`Call "${fn}" failed:`, err);
    throw err;
  }
}

let currentLang = localStorage.getItem('gym_lang') || 'ku';
let currentMember = null;
let dismissTimer = null;
let lastKnownAttendanceId = '';

// ==========================================
// پەیوەندی و دەنگ (Audio Web API & Dual Screen Sync)
// ==========================================
const kioskChannel = new BroadcastChannel('kiosk_display_sync');

// گوێگرتن لە چێک ئینی ڕاستەوخۆ لە ڕێگەی مۆبایلەوە
kioskChannel.onmessage = (event) => {
  const data = event.data;
  if (data && data.type === 'MEMBER_ACTION' && data.member) {
    showCheckinSuccess(data.member, data.action || 'checkin', data.message);
  }
};

// ژەنینی دەنگی سازگار و خۆشی چێک ئین (Musical Chime Chord)
function playKioskChime(isCheckIn = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = isCheckIn ? [440, 554.37, 659.25, 880] : [659.25, 554.37, 440];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.08 + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.7);
    });
  } catch (e) {
    console.log('Audio chime not supported:', e);
  }
}

// کاتژمێری ڕاستەوخۆ
setInterval(() => {
  const d = new Date();
  const time = d.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if ($('liveClock')) $('liveClock').textContent = time;
}, 1000);

// سویچکردنی تابەکانی کیۆسک (QR مۆبایل vs بارکۆد)
function switchKioskTab(tab) {
  const isQr = tab === 'qr';
  $('kioskQrView').classList.toggle('hidden', !isQr);
  $('kioskCodeView').classList.toggle('hidden', isQr);
  $('memberCard').classList.add('hidden');

  if (isQr) {
    $('kioskTabBtnQr').className = 'flex-1 py-3 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition bg-white/20 text-white shadow-md border border-white/25';
    $('kioskTabBtnCode').className = 'flex-1 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition text-slate-300 hover:text-white hover:bg-white/10';
  } else {
    $('kioskTabBtnQr').className = 'flex-1 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition text-slate-300 hover:text-white hover:bg-white/10';
    $('kioskTabBtnCode').className = 'flex-1 py-3 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition bg-white/20 text-white shadow-md border border-white/25';
    setTimeout(() => $('kioskCode')?.focus(), 100);
  }
}

// کیپادی سەر شاشە
function keyPress(key) {
  const inp = $('kioskCode');
  if (!inp) return;
  if (key === 'clear') {
    inp.value = '';
  } else {
    inp.value += key;
  }
  inp.focus();
}

function quickSelect(code) {
  switchKioskTab('code');
  $('kioskCode').value = code;
  findMember();
}

// پشکنینی کۆدی یاریزان
async function findMember() {
  const code = ($('kioskCode').value || '').trim().toUpperCase();
  if (!code) return;

  try {
    const m = await call('getMemberByCode', code);

    if (!m) {
      alert(currentLang === 'en' ? 'Member code not found!' : 'کۆدی ئەم یاریزانە لە سیستەمدا نەدۆزرایەوە!');
      return;
    }

    currentMember = m;
    $('kPhoto').src = m.PhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
    $('kName').textContent = m.FullName;
    $('kCodeDisplay').textContent = m.MemberCode;
    $('kPlan').textContent = m.PlanId || (currentLang === 'en' ? 'General' : 'گشتی');
    $('kExpiry').textContent = String(m.ExpiryDate || '').slice(0, 10);

    const exp = new Date(m.ExpiryDate);
    const now = new Date();
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    $('kDaysLeft').textContent = Math.max(diffDays, 0);

    const isActive = m.Status === 'Active' && diffDays >= 0;
    $('kStatusBadge').textContent = isActive ? (currentLang === 'en' ? 'Active' : 'چالاک') : (currentLang === 'en' ? 'Expired' : 'بەسەرچوو');
    $('kStatusBadge').className = `px-2.5 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`;

    $('memberCard').classList.remove('hidden');
    lucide.createIcons();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// ئەنجامدانی چێک ئین یان چێک ئاوت بە دەست
async function doAction(action) {
  if (!currentMember) return;
  try {
    const res = await call('kioskCheckInOut', currentMember.MemberCode, action, 'Kiosk Station 01');
    if (res) {
      showCheckinSuccess(currentMember, action, res.message);
      $('kioskCode').value = '';
      $('memberCard').classList.add('hidden');
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// پیشاندانی کارتی پیرۆزبایی و پەسەندبوون لەسەر شاشە
function showCheckinSuccess(m, action = 'checkin', customMsg = '') {
  playKioskChime(action === 'checkin');
  
  const isCheckIn = action === 'checkin';
  $('succPhoto').src = m.PhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
  $('succName').textContent = m.FullName;
  $('succDetails').textContent = `${m.MemberCode} • ${m.SubscriptionType || 'Monthly VIP'}`;
  
  if (isCheckIn) {
    $('succBadge').textContent = currentLang === 'en' ? 'Check-in Confirmed! ✓' : 'چێک ئین بە سەرکەوتوویی تۆمارکرا! ✓';
    $('succBadge').className = 'inline-block px-4 py-1.5 rounded-full text-xs font-black bg-emerald-500 text-white shadow-lg shadow-emerald-500/30';
    $('successActionRing').className = 'w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-400 grid place-items-center mx-auto shadow-lg shadow-emerald-500/30';
    $('succMsg').textContent = customMsg || (currentLang === 'en' ? 'Welcome to the Gym! Have a great workout.' : 'بەخێربێیت بۆ هۆڵی وەرزش! مەشقێکی بەسوود و بەچێژ.');
  } else {
    $('succBadge').textContent = currentLang === 'en' ? 'Check-out Confirmed! ⎋' : 'چێک ئاوت بە سەرکەوتوویی تۆمارکرا! ⎋';
    $('succBadge').className = 'inline-block px-4 py-1.5 rounded-full text-xs font-black bg-rose-500 text-white shadow-lg shadow-rose-500/30';
    $('successActionRing').className = 'w-24 h-24 rounded-full bg-rose-500/20 border-2 border-rose-400 grid place-items-center mx-auto shadow-lg shadow-rose-500/30';
    $('succMsg').textContent = customMsg || (currentLang === 'en' ? 'Goodbye! Thank you for working out with us.' : 'ڕۆژباش! سوپاس بۆ هاتنت، هەمیشە تەندروست بیت.');
  }

  $('checkinSuccessModal').classList.remove('hidden');

  // خۆکارانە لە دوای 4.5 چرکە دادەخرێت
  clearTimeout(dismissTimer);
  dismissTimer = setTimeout(() => {
    $('checkinSuccessModal').classList.add('hidden');
  }, 4500);
}

// دۆخی سکرینی دووەم (Presentation Mode)
function shareToSecondScreen() {
  const url = window.location.origin + '/kiosk?mode=display';
  window.open(url, 'GymKioskDisplay', 'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no');
}

// بەستەری QR کۆدی چێک ئین بۆ مۆبایل
function initKioskQrCode() {
  // لینکی ناوەکی ئەپ کە ئەگەر مۆبایلی ئاساییش سکانی کرد، پۆڕتاڵەکە بکاتەوە و ڕاستەوخۆ دیالۆگی چێک ئین بێنێت
  const checkinPayload = `${window.location.origin}/member?scanCheckin=1&station=KIOSK-01`;
  if ($('kioskCheckInQrImg')) {
    $('kioskCheckInQrImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(checkinPayload)}`;
  }
}

// گۆڕینی زمانی پەڕەی چێک ئین
function toggleKioskLanguage() {
  currentLang = currentLang === 'ku' ? 'en' : 'ku';
  localStorage.setItem('gym_lang', currentLang);
  applyKioskLanguage();
}

function applyKioskLanguage() {
  const isEn = currentLang === 'en';
  const html = $('kioskHtml');
  html.setAttribute('lang', isEn ? 'en' : 'ku');
  html.setAttribute('dir', isEn ? 'ltr' : 'rtl');

  $('tabQrLabel').textContent = isEn ? '📱 Scan QR via Phone' : '📱 سکانی QR بە مۆبایل';
  $('tabCodeLabel').textContent = isEn ? '🔢 Enter Code / Barcode' : '🔢 کۆدی یاریزان یان بارکۆد';
  $('kioskQrInstructionTitle').textContent = isEn ? 'Point your phone here' : 'مۆبایلەکەت لێرە نزیک بکەرەوە';
  $('kioskQrInstructionDesc').textContent = isEn 
    ? 'Tap (📷 Scan QR) in the Member App to instantly check-in or check-out touchless in one second.' 
    : 'لە ئەپی بەشداربووان دوگمەی (📷 سکانی چێک ئین) دابگرە بۆ ئەوەی ڕاستەوخۆ بە یەک چرکە و بێ دەستلێدان چێک ئین یان چێک ئاوت بکەیت.';
  $('kioskQrStatusLive').textContent = isEn ? 'Station Ready for Check-in & Check-out' : 'سیستەم چالاکە و ئامادەیە بۆ وەرگرتنی چێک ئین';

  $('kioskLangBtnText').textContent = isEn ? 'کوردی' : 'English';
  $('btnDualScreenText').textContent = isEn ? 'Second Screen' : 'سکرینی دووەم';
  $('pageHeadTitle').textContent = isEn ? 'Check-in Page — Smart Gym Kiosk' : 'پەڕەی چێک ئین و ئامادەبوون — Gym Kiosk Check-in';
  $('kioskSubtitle').textContent = isEn ? 'Self Check-in & Check-out Kiosk' : 'پەڕەی چێک ئین و چێک ئاوتی خۆکار (Self Check-in)';
  $('kioskPromptLabel').textContent = isEn ? 'Please scan QR or enter member code' : 'تکایە کۆدی تایبەتی خۆت لێبدە یان QR کۆد سکان بکە';
  $('kioskWelcomeTitle').textContent = isEn ? 'Welcome to the Gym' : 'بەخێربێیت بۆ هۆڵی وەرزش';
  $('btnCheckMember').textContent = isEn ? 'Check' : 'پشکنین';
  $('kioskQuickTestLabel').textContent = isEn ? 'Quick Select:' : 'کۆدە تاقیکارییەکان:';
  $('lblCardCode').textContent = isEn ? 'Code' : 'کۆد';
  $('lblCardPlan').textContent = isEn ? 'Plan' : 'پلان';
  $('lblCardExpiry').textContent = isEn ? 'Expiry Date:' : 'بەسەرچوون:';
  $('lblCardDays').textContent = isEn ? 'days left' : 'ڕۆژ ماوە';
  $('btnCheckInText').textContent = isEn ? 'Check In (Entry)' : 'چێک ئین (هاتنەژوور)';
  $('btnCheckOutText').textContent = isEn ? 'Check Out (Exit)' : 'چێک ئاوت (دەرچوون)';
  $('kioskFooterText').textContent = isEn ? 'Smart Gym Pro • Mobile & Station Attendance System' : 'Smart Gym Pro • سیستەمی چێک ئینی وێستگە و مۆبایل';
  lucide.createIcons();
}

// بارکردنی سێتینگی هۆڵ و باکگراوەند
async function loadKioskSettings() {
  try {
    const settings = await call('getSettings') || {};

    if (settings.GymName && $('kioskGymTitle')) {
      $('kioskGymTitle').innerHTML = `<span>${settings.GymName}</span><span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>`;
    }

    // وێنەی باکگراوەندی تایبەت لە ڕێکخستنەکانەوە
    const bgUrl = settings.KioskBgUrl || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80';
    document.body.style.backgroundImage = `url('${bgUrl}')`;
  } catch (e) {
    document.body.style.backgroundImage = `url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80')`;
  }
}

// چاودێریکردنی ڕاستەوخۆ (Live Polling هەر ٢.٥ چرکە جارێک)
async function startLiveAttendanceMonitor() {
  try {
    const list = await call('getTodayAttendance') || [];
    if (list.length > 0) {
      const latest = list[0];
      if (lastKnownAttendanceId && latest.Id !== lastKnownAttendanceId) {
        // چێک ئین یان چێک ئاوتی نوێ لە مۆبایلەوە کراوە!
        const isCheckIn = latest.Status === 'ئامادەیە لە هۆڵ';
        showCheckinSuccess(latest, isCheckIn ? 'checkin' : 'checkout');
      }
      lastKnownAttendanceId = latest.Id;
    }
  } catch(e) {}
}

// دەستپێکردن
(async () => {
  lucide.createIcons();
  applyKioskLanguage();
  initKioskQrCode();
  await loadKioskSettings();

  // پشکنینی دۆخی شاشەی دووەم
  if (new URLSearchParams(window.location.search).get('mode') === 'display') {
    document.body.classList.add('display-mode');
  }

  // چاودێریکردنی چێک ئینی نوێ لە ڕێگەی مۆبایلەوە
  setInterval(startLiveAttendanceMonitor, 2500);
})();
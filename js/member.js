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
let currentProfileData = null;
let html5QrScanner = null;
let deferredInstallPrompt = null;
let weightChartInstance = null;

const syncChannel = new BroadcastChannel('kiosk_display_sync');

// ==========================================
// زمانی ئەپی یاریزان (Kurdish / English)
// ==========================================
function toggleMemberLanguage() {
  currentLang = currentLang === 'ku' ? 'en' : 'ku';
  localStorage.setItem('gym_lang', currentLang);
  applyMemberLanguage();
}

function applyMemberLanguage() {
  const isEn = currentLang === 'en';
  const html = $('memberHtml');
  html.setAttribute('lang', isEn ? 'en' : 'ku');
  html.setAttribute('dir', isEn ? 'ltr' : 'rtl');

  document.querySelectorAll('.memberLangBtnText').forEach(el => {
    el.textContent = isEn ? 'کوردی' : 'English';
  });

  if ($('mPageHeadTitle')) $('mPageHeadTitle').textContent = isEn ? 'Member App — Smart Gym Pro' : 'ئەپی بەشداربووان — Smart Gym Mobile App';
  if ($('loginTitle')) $('loginTitle').textContent = isEn ? 'Member Portal' : 'ئەپی بەشداربووان';
  if ($('loginSubtitle')) $('loginSubtitle').textContent = isEn ? 'Enter your member code to sign in' : 'کۆدی بەشداربووی هۆڵ بنووسە بۆ چوونەژوورەوە';
  if ($('btnMemberLogin')) $('btnMemberLogin').querySelector('span').textContent = isEn ? 'Sign In to App' : 'چوونەژوورەوە بۆ ئەپ';
  if ($('lblQuickTestCodes')) $('lblQuickTestCodes').textContent = isEn ? 'Test Member Codes:' : 'کۆدە تاقیکارییەکان:';
  
  // Profile action cards (Install PWA & Language)
  if ($('profileInstallTitle')) $('profileInstallTitle').textContent = isEn ? 'Install Mobile Application' : 'داگرتنی ئەپڵیکەیشن';
  if ($('profileInstallSub')) $('profileInstallSub').textContent = isEn ? 'Add to Home Screen for fast access & check-in' : 'دابەزاندن وەکو ئەپ لەسەر مۆبایل بۆ خێرایی و چێک ئین';
  if ($('profilePwaInstallBtnText')) $('profilePwaInstallBtnText').textContent = isEn ? 'Install App' : 'داگرتن';
  if ($('profileLangTitle')) $('profileLangTitle').textContent = isEn ? 'App Language' : 'زمانی بەرنامە';
  if ($('profileLangSub')) $('profileLangSub').textContent = isEn ? 'Switch between Kurdish and English' : 'گۆڕین لە نێوان کوردی و ئینگلیزی';

  // Health menu modal
  if ($('healthMenuTitle')) $('healthMenuTitle').textContent = isEn ? 'Health & Body Analytics' : 'تەندروستی و لەشجوانی';
  if ($('healthMenuSub')) $('healthMenuSub').textContent = isEn ? 'Nutrition diet plan & body weight logs' : 'سیستەمی خۆراک و کێشی لەش';
  if ($('healthMenuDietTitle')) $('healthMenuDietTitle').textContent = isEn ? 'Diet & Nutrition Plan' : 'سیستەمی خۆراک (Diet Plan)';
  if ($('healthMenuDietSub')) $('healthMenuDietSub').textContent = isEn ? 'Meals, daily macros & calories' : 'ژەمەکان، ماکرۆکان و کالۆری ڕۆژانە';
  if ($('healthMenuWeightTitle')) $('healthMenuWeightTitle').textContent = isEn ? 'Weight Tracking & BMI' : 'بەدواداچوونی کێش و BMI';
  if ($('healthMenuWeightSub')) $('healthMenuWeightSub').textContent = isEn ? 'Progress curve, body measurements & log history' : 'هێڵکاری کێش، پێوانەی لەش و تۆمارکردن';

  // Exercise Video Detail Modal
  if ($('lblExWatchYt')) $('lblExWatchYt').textContent = isEn ? 'Watch on YouTube' : 'سەیرکردن لە YouTube';
  if ($('lblExMuscle')) $('lblExMuscle').textContent = isEn ? 'Target Muscle:' : 'ماسولکەی سەرەکی:';
  if ($('lblExEquip')) $('lblExEquip').textContent = isEn ? 'Equipment / Style:' : 'ئامێر / شێواز:';
  if ($('lblExSets')) $('lblExSets').textContent = isEn ? 'Sets & Reps:' : 'سێت و دووبارەکردنەوە:';
  if ($('lblExNotes')) $('lblExNotes').textContent = isEn ? 'Instructions & Form:' : 'ڕێنمایی و هەنگاوەکان:';

  if ($('lblSubTitleHome')) $('lblSubTitleHome').textContent = isEn ? 'Active Membership' : 'ئابوونەی چالاک';
  if ($('lblRemainingDays')) $('lblRemainingDays').textContent = isEn ? 'Left' : 'ماوە';
  if ($('lblDaysUnit')) $('lblDaysUnit').textContent = isEn ? 'Days' : 'ڕۆژ';
  if ($('lblSubStart')) $('lblSubStart').textContent = isEn ? 'Start Date:' : 'بەرواری دەستپێک:';
  if ($('lblSubExpiry')) $('lblSubExpiry').textContent = isEn ? 'Expiry Date:' : 'بەسەرچوون:';
  if ($('lblScanHeroTitle')) $('lblScanHeroTitle').textContent = isEn ? 'Check-in via Camera QR' : 'سکانی چێک ئین بە کامێرا';
  if ($('lblScanHeroSub')) $('lblScanHeroSub').textContent = isEn ? 'Touchless check-in & check-out' : 'بۆ چێک ئین یان چێک ئاوت لە هۆڵ';
  if ($('btnScanHeroText')) $('btnScanHeroText').textContent = isEn ? 'Scan Now' : 'سکان بکە';
  if ($('lblTodayWorkoutTitle')) $('lblTodayWorkoutTitle').textContent = isEn ? "Today's Routine" : 'ڕاهێنانی دیاریکراو';
  if ($('btnSeeAllWorkout')) $('btnSeeAllWorkout').textContent = isEn ? 'See All Workout →' : 'بینینی هەمووی ←';
  if ($('workoutPlanDesc')) $('workoutPlanDesc').textContent = isEn ? 'Exercises by routine days' : 'ڕاهێنانەکان بەپێی ڕۆژەکان';
  if ($('lblCurWeight')) $('lblCurWeight').textContent = isEn ? 'Current Weight' : 'کێشی ئێستا';
  if ($('lblBmiTitle')) $('lblBmiTitle').textContent = isEn ? 'BMI Index' : 'پێوەری BMI';
  if ($('lblWeightChartTitle')) $('lblWeightChartTitle').textContent = isEn ? 'Weight Progress Curve' : 'ڕەوتی گۆڕانی کێش';
  if ($('lblWeightLogsTitle')) $('lblWeightLogsTitle').textContent = isEn ? 'Past Weight Logs' : 'مێژووی پێوانەکانی پێشوو';

  // Bottom Bar labels
  if ($('bottomBtnHome')) $('bottomBtnHome').querySelector('span').textContent = isEn ? 'Home' : 'سەرەکی';
  if ($('bottomBtnWorkout')) $('bottomBtnWorkout').querySelector('span').textContent = isEn ? 'Workout' : 'ڕاهێنان';
  if ($('bottomBtnHealthText')) $('bottomBtnHealthText').textContent = isEn ? 'Health' : 'تەندروستی';
  if ($('bottomBtnProfile')) $('bottomBtnProfile').querySelector('span').textContent = isEn ? 'Profile' : 'پڕۆفایل';

  lucide.createIcons();
}

// ==========================================
// PWA داگرتنی ئەپ لە مۆبایل (Install as PWA)
// ==========================================
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if ($('profilePwaInstallBtn')) $('profilePwaInstallBtn').classList.remove('opacity-50');
});

function installMobilePwa() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        if ($('profilePwaInstallBtn')) $('profilePwaInstallBtn').classList.add('opacity-50');
      }
      deferredInstallPrompt = null;
    });
  } else {
    // ڕێنمایی بۆ Safari iOS یان ئەندرۆید
    alert(currentLang === 'en' 
      ? 'To install this app on your phone:\n1. Tap the Share/Options button (⎋ / ⋮) in your browser\n2. Select "Add to Home Screen" (➕ / Install App)' 
      : 'بۆ داگرتن و دانانی ئەپەکە لەسەر مۆبایلەکەت:\n١. لە وێبگەڕ کلیک لە دوگمەی Share یان سێ خاڵەکە (⎋ / ⋮) بکە\n٢. پاشان Add to Home Screen (➕) یان Install هەڵبژێرە');
  }
}

// ==========================================
// پێڕستی تەندروستی (Health Menu Actions)
// ==========================================
function openHealthMenuModal() {
  const hasDiet = currentProfileData?.dietPlan && currentProfileData.dietPlan.DietPlanId;
  const dietItem = $('healthMenuItemDiet');
  if (!hasDiet) {
    if (dietItem) dietItem.classList.add('hidden');
    // ئەگەر پلانی خۆراکی نەبوو، ڕاستەوخۆ دەچێتە بەشی کێش بەبێ پیشاندانی سیستەمی خۆراک
    switchTab('weight');
    return;
  }
  if (dietItem) dietItem.classList.remove('hidden');
  $('healthMenuModal').classList.remove('hidden');
  lucide.createIcons();
}

function closeHealthMenuModal() {
  $('healthMenuModal').classList.add('hidden');
}

function selectHealthOption(opt) {
  closeHealthMenuModal();
  if (opt === 'diet') {
    const hasDiet = currentProfileData?.dietPlan && currentProfileData.dietPlan.DietPlanId;
    if (!hasDiet) {
      switchTab('weight');
      return;
    }
    switchTab('diet');
  } else if (opt === 'weight') {
    switchTab('weight');
  }
}

// ==========================================
// چوونەژوورەوەی یاریزان
// ==========================================
function quickFill(code) {
  $('code').value = code;
  login();
}

async function login() {
  const code = ($('code').value || '').trim().toUpperCase();
  $('err').textContent = '';
  if (!code) {
    $('err').textContent = currentLang === 'en' ? 'Please enter member code' : 'تکایە کۆدی بەشداربوو بنووسە';
    return;
  }

  try {
    const profile = await call('getMemberProfile', code);
    if (!profile || !profile.member) {
      $('err').textContent = currentLang === 'en' ? 'Invalid member code!' : 'کۆدی بەشداربوو هەڵەیە یان تۆمار نەکراوە!';
      return;
    }

    localStorage.setItem('gym_member_code', code);
    currentProfileData = profile;
    currentMember = profile.member;

    renderMemberApp();
    $('login').classList.add('hidden');
    $('portal').classList.remove('hidden');

    // ئەگەر لە URL داوای چێک ئین کرابوو، دیالۆگی سکان ڕاستەوخۆ بکەرەوە
    if (new URLSearchParams(window.location.search).get('scanCheckin') === '1') {
      openChoiceModal();
    }
  } catch (e) {
    $('err').textContent = 'Error: ' + e.message;
  }
}

function logout() {
  localStorage.removeItem('gym_member_code');
  location.href = '/member';
}

// ==========================================
// پێشاندانی زانیارییەکانی یاریزان لە ئەپ
// ==========================================
function renderMemberApp() {
  if (!currentProfileData) return;
  const { member, plan, exercisesByDay, weightHistory, dietPlan } = currentProfileData;

  // هێدەر
  $('avatar').src = member.PhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
  $('profileLargeAvatar').src = member.PhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
  $('name').textContent = member.FullName;
  $('profileFullName').textContent = member.FullName;
  $('codeBadge').textContent = member.MemberCode;
  $('profileMemberCode').textContent = member.MemberCode;
  $('profilePhone').textContent = member.Phone || '—';
  $('profileHeight').textContent = (member.HeightCm || '--') + ' cm';
  $('profileGender').textContent = member.Gender || '—';

  // دۆخی ئابوونە و ماوەی ماوە
  $('subTypeName').textContent = member.SubscriptionType || 'مانگانە VIP';
  $('subStartDate').textContent = String(member.StartDate || '').slice(0, 10);
  $('subExpiryDate').textContent = String(member.ExpiryDate || '').slice(0, 10);

  const subName = String(member.SubscriptionType || '').toLowerCase();
  const isSessionBased = data.isSessionBased || subName.includes('15') || subName.includes('نیومانگ') || subName.includes('ڕۆژانە') || subName.includes('daily');
  
  let daysLeft = 0;
  if (typeof data.daysRemaining === 'number') {
    daysLeft = data.daysRemaining;
  } else if (isSessionBased) {
    const used = (attendanceHistory || []).filter(a => String(a.Date || a.CheckIn || '').slice(0, 10) >= String(member.StartDate || '').slice(0, 10)).length;
    const total = subName.includes('15') || subName.includes('نیومانگ') ? 15 : 1;
    daysLeft = Math.max(0, total - used);
  } else {
    const expDate = new Date(member.ExpiryDate || Date.now());
    const now = new Date();
    daysLeft = Math.max(0, Math.ceil((expDate - now) / (1000 * 60 * 60 * 24)));
  }

  $('subDaysLeft').textContent = daysLeft;
  if ($('lblRemainingDays')) {
    if (isSessionBased) {
      $('lblRemainingDays').textContent = currentLang === 'en' ? 'Sessions Left' : 'هاتن / دانیشتنی ماوە';
    } else {
      $('lblRemainingDays').textContent = currentLang === 'en' ? 'Days Left' : 'ڕۆژی ماوە';
    }
  }

  const isActive = member.Status === 'Active' && daysLeft > 0;
  $('subStatusBadge').textContent = isActive ? (currentLang === 'en' ? 'Active' : 'چالاک') : (currentLang === 'en' ? 'Expired' : 'بەسەرچوو');
  $('subStatusBadge').className = `inline-block mt-2 px-3 py-1 rounded-full text-xs font-black ${isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`;

  // تابی ڕاهێنان
  renderWorkoutSection(plan, exercisesByDay);

  // تابی خۆراک لە پێڕستی تەندروستی (Conditional in Health Menu)
  const dietItem = $('healthMenuItemDiet');
  if (dietPlan && dietPlan.DietPlanId) {
    if (dietItem) {
      dietItem.classList.remove('hidden');
      $('healthMenuDietSub').textContent = currentLang === 'en' ? 'Meals, daily macros & calories' : 'ژەمەکان، ماکرۆکان و کالۆری ڕۆژانە';
    }
    renderDietSection(dietPlan);
  } else {
    if (dietItem) {
      dietItem.classList.add('hidden');
    }
  }

  // تابی کێش
  renderWeightSection(member, weightHistory);

  lucide.createIcons();
}

// سویچکردنی تابەکانی ناوەوەی ئەپ
function switchTab(tabId) {
  const tabs = ['home', 'workout', 'diet', 'weight', 'profile'];
  tabs.forEach(t => {
    const content = $('tabContent' + capitalize(t));
    if (content) content.classList.toggle('hidden', t !== tabId);
  });

  const isHome = tabId === 'home';
  const isWorkout = tabId === 'workout';
  const isHealth = tabId === 'diet' || tabId === 'weight';
  const isProfile = tabId === 'profile';

  if ($('bottomBtnHome')) $('bottomBtnHome').className = `flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition ${isHome ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'}`;
  if ($('bottomBtnWorkout')) $('bottomBtnWorkout').className = `flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition ${isWorkout ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'}`;
  if ($('bottomBtnHealth')) $('bottomBtnHealth').className = `flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition ${isHealth ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'}`;
  if ($('bottomBtnProfile')) $('bottomBtnProfile').className = `flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition ${isProfile ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'}`;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ==========================================
// بەشی ڕاهێنان (Workout Section)
// ==========================================
function renderWorkoutSection(plan, exercisesByDay) {
  if (!plan) {
    $('workoutPlanName').textContent = currentLang === 'en' ? 'No workout plan assigned' : 'هیچ پلانێکی ڕاهێنان دانەنراوە';
    $('homeWorkoutSnippet').textContent = currentLang === 'en' ? 'Please ask your trainer for a routine.' : 'تکایە پەیوەندی بە ڕاهێنەرەکەتەوە بکە بۆ دانانی پلان.';
    return;
  }

  $('workoutPlanName').textContent = plan.PlanName || plan.Name || 'پلانی ڕاهێنان';
  if (currentMember.TrainerName) {
    $('planTrainerBadge').textContent = (currentLang === 'en' ? 'Trainer: ' : 'ڕاهێنەر: ') + currentMember.TrainerName;
    $('planTrainerBadge').classList.remove('hidden');
  }

  const days = Object.keys(exercisesByDay || {});
  if (!days.length) {
    $('exercisesList').innerHTML = `<p class="text-xs text-slate-400 text-center p-4">هیچ ڕاهێنانێک لەم پلانەدا تۆمار نەکراوە</p>`;
    return;
  }

  // ڕۆژەکانی هەفتە
  $('dayTabsContainer').innerHTML = days.map((day, idx) => `
    <button onclick="selectWorkoutDay('${esc(day)}')" id="btnDay-${idx}" class="day-tab-btn px-4 py-2 rounded-xl text-xs font-black shrink-0 transition ${idx === 0 ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/10 text-slate-300 hover:bg-white/20'}">
      ${esc(day)}
    </button>
  `).join('');

  // زیرەکی بەدواداچوونی ڕۆژانەی ڕاهێنان و ئاگاداری ڕۆژی نەکراو
  const memberCode = currentMember.MemberCode || 'MEM';
  const todayStr = new Date().toISOString().slice(0, 10);
  const activeDayKey = 'gym_active_workout_day_' + memberCode;
  const lastWorkoutDateKey = 'gym_last_workout_date_' + memberCode;
  const completedDaysKey = 'gym_completed_days_' + memberCode;

  let activeDay = localStorage.getItem(activeDayKey) || days[0];
  if (!days.includes(activeDay)) activeDay = days[0];

  const lastDate = localStorage.getItem(lastWorkoutDateKey);
  const completedMap = JSON.parse(localStorage.getItem(completedDaysKey) || '{}');

  let missedDay = null;
  if (lastDate && lastDate < todayStr) {
    const lastDayActive = localStorage.getItem(activeDayKey) || days[0];
    if (!completedMap[lastDate + '_' + lastDayActive]) {
      missedDay = lastDayActive;
    }
  }

  renderHomeWorkoutRoutine(days, activeDay, exercisesByDay, missedDay);
  selectWorkoutDay(activeDay);
}

function renderHomeWorkoutRoutine(days, activeDay, exercisesByDay, missedDay) {
  const isEn = currentLang === 'en';
  const activeEx = exercisesByDay[activeDay] || [];
  const container = $('homeWorkoutSnippet');
  if (!container) return;

  let alertHtml = '';
  if (missedDay) {
    alertHtml = `
      <div id="missedWorkoutPrompt" class="p-3.5 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs mb-3 space-y-2">
        <div class="flex items-center gap-2">
          <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-400 shrink-0"></i>
          <span class="font-extrabold text-amber-300">${isEn ? 'Missed Routine Alert:' : 'ئاگاداری: ڕاهێنانی ڕۆژی پێشووت تەواو نەکردووە'} (<b class="text-white">${esc(missedDay)}</b>)</span>
        </div>
        <p class="text-[11px] text-amber-200/80 leading-relaxed">
          ${isEn ? 'Would you like to shift this routine to today or skip to the next scheduled day?' : 'دەتەوێت پلانی ئەو ڕۆژەی نەتکردووە بخەیتە ئەمڕۆ، یان تێپەڕێنی بۆ ڕۆژی دواتر؟'}
        </p>
        <div class="flex gap-2 pt-1">
          <button onclick="shiftMissedWorkout('${esc(missedDay)}')" class="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-md active:scale-95 flex items-center justify-center gap-1.5">
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            <span>${isEn ? 'Shift to Today' : 'خستنە ئەمڕۆ'}</span>
          </button>
          <button onclick="skipMissedWorkout('${esc(missedDay)}')" class="py-2 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1">
            <i data-lucide="skip-forward" class="w-3.5 h-3.5 text-slate-400"></i>
            <span>${isEn ? 'Skip' : 'تێپەڕاندن'}</span>
          </button>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    ${alertHtml}
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <b class="text-sm font-black text-white">${esc(activeDay)}</b>
      </div>
      <div class="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
        ${days.map(d => `
          <button onclick="changeActiveWorkoutDay('${esc(d)}')" class="px-2 py-0.5 rounded-lg text-[10px] font-bold transition ${d === activeDay ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white/10 text-slate-400 hover:text-white'}">
            ${esc(d.replace(/ڕؤژی|ڕۆژی|Day/gi, 'D').trim())}
          </button>
        `).join('')}
      </div>
    </div>
    <div class="grid grid-cols-2 gap-2">
      ${activeEx.slice(0, 4).map(e => `
        <div onclick='openExerciseDetail(${JSON.stringify(e).replace(/'/g, "&apos;")})' class="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between gap-1.5 cursor-pointer active:scale-95 transition">
          <div class="min-w-0">
            <span class="truncate block text-slate-200 text-xs font-bold">${esc(e.Name || e.ExerciseName)}</span>
            <span class="text-[10px] text-indigo-300 font-mono">${esc(e.TargetMuscle || 'گشتی')}</span>
          </div>
          <span class="text-[10px] text-emerald-400 font-mono font-bold shrink-0">${esc(e.Sets || 3)}×${esc(e.Reps || 12)}</span>
        </div>
      `).join('')}
    </div>
    <div class="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
      <button onclick="completeCurrentDayWorkout('${esc(activeDay)}')" class="w-full py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center justify-center gap-1.5 transition active:scale-95">
        <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i>
        <span>${isEn ? 'Mark Day as Completed' : 'تەواوکردنی ڕاهێنانی ئەمڕۆ'}</span>
      </button>
    </div>
  `;
  lucide.createIcons();
}

function shiftMissedWorkout(missedDay) {
  const memberCode = currentMember?.MemberCode || 'MEM';
  localStorage.setItem('gym_active_workout_day_' + memberCode, missedDay);
  localStorage.setItem('gym_last_workout_date_' + memberCode, new Date().toISOString().slice(0, 10));
  const exercisesByDay = currentProfileData?.exercisesByDay || {};
  const days = Object.keys(exercisesByDay);
  renderHomeWorkoutRoutine(days, missedDay, exercisesByDay, null);
  selectWorkoutDay(missedDay);
}

function skipMissedWorkout(missedDay) {
  const memberCode = currentMember?.MemberCode || 'MEM';
  const exercisesByDay = currentProfileData?.exercisesByDay || {};
  const days = Object.keys(exercisesByDay);
  const nextIdx = (days.indexOf(missedDay) + 1) % (days.length || 1);
  const nextDay = days[nextIdx] || days[0];
  
  localStorage.setItem('gym_active_workout_day_' + memberCode, nextDay);
  localStorage.setItem('gym_last_workout_date_' + memberCode, new Date().toISOString().slice(0, 10));
  renderHomeWorkoutRoutine(days, nextDay, exercisesByDay, null);
  selectWorkoutDay(nextDay);
}

function changeActiveWorkoutDay(day) {
  const memberCode = currentMember?.MemberCode || 'MEM';
  localStorage.setItem('gym_active_workout_day_' + memberCode, day);
  const exercisesByDay = currentProfileData?.exercisesByDay || {};
  const days = Object.keys(exercisesByDay);
  renderHomeWorkoutRoutine(days, day, exercisesByDay, null);
  selectWorkoutDay(day);
}

function completeCurrentDayWorkout(day) {
  const memberCode = currentMember?.MemberCode || 'MEM';
  const todayStr = new Date().toISOString().slice(0, 10);
  const completedDaysKey = 'gym_completed_days_' + memberCode;
  const completedMap = JSON.parse(localStorage.getItem(completedDaysKey) || '{}');
  completedMap[todayStr + '_' + day] = true;
  localStorage.setItem(completedDaysKey, JSON.stringify(completedMap));
  localStorage.setItem('gym_last_workout_date_' + memberCode, todayStr);

  const exercisesByDay = currentProfileData?.exercisesByDay || {};
  const days = Object.keys(exercisesByDay);
  const nextIdx = (days.indexOf(day) + 1) % (days.length || 1);
  const nextDay = days[nextIdx] || days[0];
  localStorage.setItem('gym_active_workout_day_' + memberCode, nextDay);

  alert(currentLang === 'en' 
    ? `🎉 Well done! "${day}" marked as completed. Next routine: "${nextDay}".` 
    : `🎉 دەستخۆش! ڕاهێنانی "${day}" بە سەرکەوتوویی تەواوکرا. ڕاهێنانی دواتر: "${nextDay}".`);

  renderHomeWorkoutRoutine(days, nextDay, exercisesByDay, null);
  selectWorkoutDay(nextDay);
}

function selectWorkoutDay(day) {
  const exercisesByDay = currentProfileData?.exercisesByDay || {};
  const exList = exercisesByDay[day] || [];

  document.querySelectorAll('.day-tab-btn').forEach(b => {
    if (b.textContent.trim() === day) {
      b.className = 'day-tab-btn px-4 py-2 rounded-xl text-xs font-black shrink-0 transition bg-indigo-600 text-white shadow-md';
    } else {
      b.className = 'day-tab-btn px-4 py-2 rounded-xl text-xs font-black shrink-0 transition bg-white/10 text-slate-300 hover:bg-white/20';
    }
  });

  $('exercisesList').innerHTML = exList.map((e, i) => {
    const exName = esc(e.Name || e.ExerciseName);
    return `
      <div onclick='openExerciseDetail(${JSON.stringify(e).replace(/'/g, "&apos;")})' class="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99]">
        <div class="flex items-center gap-3">
          <span class="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-300 font-mono font-black text-xs grid place-items-center border border-indigo-500/30">${i + 1}</span>
          <div>
            <b class="text-sm font-bold text-white block">${exName}</b>
            <span class="text-xs text-indigo-300 font-medium">${esc(e.TargetMuscle || 'گشتی')} • ${esc(e.Sets || 3)} سێت × ${esc(e.Reps || 12)} جار</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 text-[11px] font-bold flex items-center gap-1">
            <i data-lucide="play" class="w-3 h-3 fill-rose-400"></i>
            <span>ڤیدیۆ</span>
          </span>
          <i data-lucide="chevron-left" class="w-4 h-4 text-slate-400"></i>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function getYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = String(url).match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

const DEFAULT_EXERCISE_VIDEOS = {
  'press': '8iPEnn-ltC8',
  'incline': '8iPEnn-ltC8',
  'push': 'IODxDxX7oi4',
  'treadmill': '9L2b2khySLE',
  'squat': 'aclHkVaku9U',
  'curl': 'ykJmrZ5v0Oo',
  'lat': 'CAwf7n6Luuc',
  'bench': 'rT7DgCr-3pg',
  'shoulder': 'qEwKCR5JCog',
  'plank': 'pSHjTRCQxIw',
  'deadlift': 'op9kVnSso6Q',
  'lunge': 'QOVaHwm-Q6U',
  'row': 'GZbfZ033f74',
  'cardio': '9L2b2khySLE',
  'default': '8iPEnn-ltC8'
};

function resolveExerciseVideo(ex) {
  const url = ex.VideoUrl || ex.Video || '';
  const ytId = getYouTubeId(url);
  if (ytId) return { type: 'youtube', id: ytId };
  if (url && (url.endsWith('.mp4') || url.endsWith('.webm') || url.includes('video'))) {
    return { type: 'mp4', url: url };
  }

  const text = (String(ex.Name || ex.ExerciseName || '') + ' ' + String(ex.TargetMuscle || '')).toLowerCase();
  for (const [k, v] of Object.entries(DEFAULT_EXERCISE_VIDEOS)) {
    if (text.includes(k)) {
      return { type: 'youtube', id: v };
    }
  }
  return { type: 'youtube', id: DEFAULT_EXERCISE_VIDEOS.default };
}

function openExerciseDetail(e) {
  const exName = e.Name || e.ExerciseName || 'ڕاهێنان';
  $('exDetailName').textContent = exName;
  $('exDetailTarget').textContent = e.TargetMuscle || 'گشتی';
  $('exDetailEquip').textContent = e.Equipment || 'ئاسایی';
  $('exDetailSets').textContent = `${e.Sets || 3} سێت × ${e.Reps || 12} جار (${e.RestSeconds || e.Rest || '60s'} پشوو)`;
  $('exDetailNotes').textContent = e.TrainerNotes || e.Notes || 'شێوازی ئەنجامدان بە تەندروستی بەبێ بریندارکردنی ماسولکە.';

  const container = $('exVideoContainer');
  const videoData = resolveExerciseVideo(e);

  if (videoData.type === 'youtube') {
    container.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoData.id}?autoplay=1&mute=0&controls=1&rel=0" class="w-full h-full border-0 rounded-2xl" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  } else if (videoData.type === 'mp4') {
    container.innerHTML = `<video src="${videoData.url}" controls autoplay playsinline class="w-full h-full object-contain bg-black rounded-2xl"></video>`;
  }

  $('exYoutubeExternalLink').href = `https://www.youtube.com/results?search_query=${encodeURIComponent(exName + ' gym exercise form tutorial')}`;

  $('exerciseDetailModal').classList.remove('hidden');
  lucide.createIcons();
}

function closeExerciseDetailModal() {
  const container = $('exVideoContainer');
  if (container) container.innerHTML = '';
  $('exerciseDetailModal').classList.add('hidden');
}

// ==========================================
// بەشی خۆراک (Diet Section)
// ==========================================
function renderDietSection(diet) {
  $('dietPlanTitle').textContent = diet.PlanName || 'سیستەمی خۆراک';
  $('dietPlanGoal').textContent = (currentLang === 'en' ? 'Goal: ' : 'ئامانج: ') + (diet.Goal || 'هاوسەنگ');

  // ماکرۆکان
  let extraMacros = [];
  try { extraMacros = JSON.parse(diet.ExtraMacrosJson || '[]'); } catch(e){}

  $('dietMacrosGrid').innerHTML = `
    <div class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
      <span class="text-[10px] text-amber-300 block">کالۆری گشتی</span>
      <b class="text-base font-black text-amber-400 font-mono">${diet.TotalCalories || 0}</b>
      <span class="text-[9px] text-slate-400 block">kcal</span>
    </div>
    <div class="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
      <span class="text-[10px] text-rose-300 block">پرۆتین</span>
      <b class="text-base font-black text-rose-400 font-mono">${diet.ProteinGrams || 0}</b>
      <span class="text-[9px] text-slate-400 block">g</span>
    </div>
    <div class="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-center">
      <span class="text-[10px] text-sky-300 block">کاربۆهیدرات</span>
      <b class="text-base font-black text-sky-400 font-mono">${diet.CarbsGrams || 0}</b>
      <span class="text-[9px] text-slate-400 block">g</span>
    </div>
    <div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
      <span class="text-[10px] text-emerald-300 block">چەوری تەندروست</span>
      <b class="text-base font-black text-emerald-400 font-mono">${diet.FatsGrams || 0}</b>
      <span class="text-[9px] text-slate-400 block">g</span>
    </div>
    ${extraMacros.map(m => `
      <div class="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-center">
        <span class="text-[10px] text-purple-300 block">${esc(m.title)}</span>
        <b class="text-base font-black text-purple-400 font-mono">${esc(m.target)}</b>
        <span class="text-[9px] text-slate-400 block">${esc(m.unit || '')}</span>
      </div>
    `).join('')}
  `;

  // ژەمەکان بەپێی ڕۆژەکان
  let meals = [];
  try { meals = JSON.parse(diet.MealsJson || '[]'); } catch(e){}

  window._allDietMeals = meals;
  
  // دۆزینەوەی ڕۆژەکان لەناو ژەمەکاندا
  const dietDays = [];
  meals.forEach(m => {
    const d = m.Day || m.day || 'هەموو ڕۆژەکان';
    if (!dietDays.includes(d)) dietDays.push(d);
  });

  const dayTabsContainer = $('dietDayTabsContainer');
  if (dayTabsContainer) {
    if (dietDays.length > 1) {
      dayTabsContainer.classList.remove('hidden');
      dayTabsContainer.innerHTML = `
        <button onclick="filterDietMeals('all')" id="dietDayBtn-all" class="diet-day-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition bg-emerald-600 text-white shadow-sm shrink-0">
          ${currentLang === 'en' ? 'All Days' : 'هەموو ڕۆژەکان'} (${meals.length})
        </button>
        ${dietDays.map((d, i) => `
          <button onclick="filterDietMeals('${esc(d)}')" id="dietDayBtn-${i}" class="diet-day-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition bg-white/10 text-slate-300 hover:bg-white/20 shrink-0">
            ${esc(d)}
          </button>
        `).join('')}
      `;
    } else {
      dayTabsContainer.classList.add('hidden');
    }
  }

  renderDietMealsList(meals);
}

function filterDietMeals(day) {
  const meals = window._allDietMeals || [];
  document.querySelectorAll('.diet-day-btn').forEach(btn => {
    btn.className = 'diet-day-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition bg-white/10 text-slate-300 hover:bg-white/20 shrink-0';
  });
  if (event && event.currentTarget) {
    event.currentTarget.className = 'diet-day-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition bg-emerald-600 text-white shadow-sm shrink-0';
  }
  const filtered = day === 'all' ? meals : meals.filter(m => (m.Day || m.day || 'هەموو ڕۆژەکان') === day);
  renderDietMealsList(filtered);
}

function renderDietMealsList(meals) {
  const container = $('mealsTimeline');
  if (!container) return;

  container.innerHTML = meals.length ? meals.map((m, i) => `
    <div class="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
      <div class="flex items-center justify-between pb-2 border-b border-white/10">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs grid place-items-center">${i+1}</span>
          <div>
            <b class="text-sm font-black text-white block">${esc(m.MealName || m.mealName || 'ژەم')}</b>
            ${m.Day || m.day ? `<span class="text-[10px] text-emerald-300 font-semibold">${esc(m.Day || m.day)}</span>` : ''}
          </div>
        </div>
        <span class="text-xs font-mono text-emerald-400 font-bold">${m.Calories || m.calories || 0} kcal</span>
      </div>
      <div class="text-xs text-slate-300 space-y-1">
        ${(m.Items || m.foods || []).map(it => `
          <div class="flex justify-between items-center text-xs py-1 border-b border-white/5">
            <span>• ${esc(it.Food || it.name)}</span>
            <span class="text-slate-400 font-mono">${esc(it.Amount || it.amount)}</span>
          </div>
        `).join('')}
      </div>
      ${m.Notes || m.time ? `<p class="text-[11px] text-slate-400 italic pt-1">💡 ${esc(m.Notes || ('کات: ' + m.time))}</p>` : ''}
    </div>
  `).join('') : `<p class="text-xs text-slate-400 text-center p-4">هیچ ژەمێک لەم بەشەدا تۆمار نەکراوە</p>`;

  lucide.createIcons();
}

// ==========================================
// بەشی کێش و Chart.js
// ==========================================
function renderWeightSection(member, weightHistory) {
  const currentWeight = member.CurrentWeightKg || member.InitialWeightKg || 0;
  $('statCurWeight').textContent = currentWeight ? `${currentWeight} kg` : '--';

  // ژمێریاری BMI
  const heightM = (member.HeightCm || 175) / 100;
  if (currentWeight && heightM > 0) {
    const bmi = (currentWeight / (heightM * heightM)).toFixed(1);
    $('statBmiValue').textContent = bmi;
    if (bmi < 18.5) {
      $('statBmiCategory').textContent = 'کێشی کەم (Underweight)';
      $('statBmiCategory').className = 'text-[10px] text-sky-400 font-bold';
    } else if (bmi <= 24.9) {
      $('statBmiCategory').textContent = 'تەندروست و ئاسایی (Normal)';
      $('statBmiCategory').className = 'text-[10px] text-emerald-400 font-bold';
    } else if (bmi <= 29.9) {
      $('statBmiCategory').textContent = 'کێشی زیادە (Overweight)';
      $('statBmiCategory').className = 'text-[10px] text-amber-400 font-bold';
    } else {
      $('statBmiCategory').textContent = 'قەڵەو (Obese)';
      $('statBmiCategory').className = 'text-[10px] text-rose-400 font-bold';
    }
  }

  // خشتەی تۆمارەکان
  const logs = weightHistory || [];
  $('weightLogsRows').innerHTML = logs.length ? logs.slice().reverse().map(l => `
    <tr class="border-b border-white/5">
      <td class="py-2.5 text-slate-300">${String(l.Date || '').slice(0, 10)}</td>
      <td class="py-2.5 font-bold text-indigo-400">${l.WeightKg} kg</td>
      <td class="py-2.5 text-slate-400 text-[11px]">${esc(l.Note || '—')}</td>
    </tr>
  `).join('') : `<tr><td colspan="3" class="text-center py-4 text-slate-500">هیچ تۆمارێکی پێشوو نییە</td></tr>`;

  // هێڵکاری گرافیک
  const ctx = document.getElementById('weightProgressChart');
  if (!ctx) return;
  if (weightChartInstance) weightChartInstance.destroy();

  const labels = logs.map(l => String(l.Date || '').slice(5, 10));
  const data = logs.map(l => Number(l.WeightKg));

  weightChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.length ? labels : ['سەرەتا'],
      datasets: [{
        label: 'کێش (kg)',
        data: data.length ? data : [currentWeight],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointBackgroundColor: '#22c55e',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

function openAddWeightModal() {
  $('addWeightModal').classList.remove('hidden');
}

async function submitNewWeight(e) {
  e.preventDefault();
  const weight = Number($('newWeightKgInput').value);
  const note = $('newWeightNoteInput').value;
  if (!weight || !currentMember) return;

  try {
    await call('logWeightProgress', currentMember.MemberCode, weight, note);
    $('addWeightModal').classList.add('hidden');
    $('newWeightKgInput').value = '';
    $('newWeightNoteInput').value = '';
    // نوێکردنەوەی داتاکان
    await login();
    switchTab('weight');
  } catch(e) {
    alert(e.message);
  }
}

// ==========================================
// سکانەری کامێرا بۆ QR کۆد (HTML5-QRCode Reader)
// ==========================================
function openCameraScanner() {
  $('cameraScannerModal').classList.remove('hidden');

  if (html5QrScanner) {
    try { html5QrScanner.stop(); } catch(e){}
  }

  html5QrScanner = new Html5Qrcode("cameraQrReader");
  const config = { fps: 15, qrbox: { width: 250, height: 250 } };

  html5QrScanner.start(
    { facingMode: "environment" },
    config,
    (decodedText) => {
      // QR کۆد بە سەرکەوتوویی لە ڕێگەی کامێراوە خوێندرایەوە!
      onQrCodeDetected(decodedText);
    },
    (errorMessage) => {
      // چاوەڕوانی سکان
    }
  ).catch(err => {
    console.warn("Camera start issue:", err);
    // ئەگەر کامێرا نەکرایەوە (بۆ نموونە لەسەر کۆمپیوتەری بێ وێبکام)، ئاگاداری پیشان دەدەین بەڵام تاقیکردنەوە بەردەست دەمێنێت
  });
}

function closeCameraScanner() {
  if (html5QrScanner) {
    try {
      html5QrScanner.stop().then(() => html5QrScanner.clear()).catch(() => {});
    } catch(e){}
  }
  $('cameraScannerModal').classList.add('hidden');
}

// کاتێک کامێراکە QR کۆد دەبینێت
function onQrCodeDetected(qrText) {
  // دەنگ یان ڤایبرەیشن
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  closeCameraScanner();
  openChoiceModal();
}

function simulateQrScanSuccess(dummyCode) {
  closeCameraScanner();
  openChoiceModal();
}

// کردنەوەی دیالۆگی "چێک ئین دەکەیت یان چێک ئاوت؟"
function openChoiceModal() {
  if (!currentMember) return;
  $('choiceMemberName').textContent = `${currentMember.FullName} (${currentMember.MemberCode})`;
  $('checkInOutChoiceModal').classList.remove('hidden');
}

function closeChoiceModal() {
  $('checkInOutChoiceModal').classList.add('hidden');
}

// ناردنی چێک ئین یان چێک ئاوت بۆ سیستەمی هۆڵ
async function submitAttendanceChoice(action) {
  if (!currentMember) return;
  closeChoiceModal();

  try {
    const result = await call('kioskCheckInOut', currentMember.MemberCode, action, 'Mobile Camera QR Scan');

    if (result) {
      // شەیرکردن بۆ شاشەی کیۆسک لە ڕێگەی BroadcastChannel
      try {
        syncChannel.postMessage({
          type: 'MEMBER_ACTION',
          action: action,
          member: currentMember,
          message: result.message
        });
      } catch(e){}

      // پیشاندانی بانەری سەرکەوتن لەناو ئەپدا
      const isCheckIn = action === 'checkin';
      $('bannerSuccessTitle').textContent = isCheckIn ? 'چێک ئین بە سەرکەوتوویی تۆمارکرا! ✓' : 'چێک ئاوت بە سەرکەوتوویی تۆمارکرا! ⎋';
      $('bannerSuccessMsg').textContent = result.message || (isCheckIn ? 'بەخێربێیت بۆ هۆڵی وەرزش، مەشقێکی بەسوود.' : 'ڕۆژباش! سوپاس بۆ هاتنت.');
      $('checkinSuccessBanner').classList.remove('hidden');

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch(e) {
    alert('Error: ' + e.message);
  }
}

// دەرگای ئاگادارییەکان
function toggleNotifDrawer(show) {
  $('notifDrawer').classList.toggle('hidden', !show);
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ==========================================
// PWA Mobile App Installation Manager
// ==========================================
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Show install button and install banner
  const banner = $('pwaInstallBanner');
  if (banner) banner.classList.remove('hidden');
  const btn = $('btnPwaInstall');
  if (btn) btn.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const banner = $('pwaInstallBanner');
  if (banner) banner.classList.add('hidden');
  const btn = $('btnPwaInstall');
  if (btn) btn.classList.add('hidden');
  console.log('🎉 Gym Pro Mobile App installed successfully!');
});

async function promptPwaInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('PWA Install choice:', outcome);
    deferredPrompt = null;
    const banner = $('pwaInstallBanner');
    if (banner) banner.classList.add('hidden');
  } else {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIos) {
      alert("بۆ دابەزاندنی ئەپ لەسەر ئایفۆن (iOS):\n١. لە خوارەوە لە وێبگەڕی Safari کلیک لە دوگمەی Share بکە ⎋\n٢. پاشان بگەڕێ بۆ دوگمەی 'Add to Home Screen' (➕) و دایگرە بۆ ئەوەی وەک ئەپ دابەزێت.");
    } else {
      alert("بۆ دابەزاندنی ئەپ لەسەر مۆبایلەکەت:\nلە بەشی سەرەوەی وێبگەڕەکەت (Chrome) لە بەشی سێ خاڵەکە (⋮) کلیک لە 'Install app' یان 'Add to Home screen' بکە.");
    }
  }
}

function promptConfigureApi() {
  const current = localStorage.getItem('gym_api_url') || (typeof GYM_CONFIG !== 'undefined' ? GYM_CONFIG.API_URL : '');
  const newUrl = prompt('تکایە بەستەری Google Apps Script Web App بنووسە بۆ بەستنەوەی داتابەیس:\n(نموونە: https://script.google.com/macros/s/.../exec)', current);
  if (newUrl && newUrl.trim()) {
    localStorage.setItem('gym_api_url', newUrl.trim());
    window.location.reload();
  }
}

// پشکنینی خۆکارانەی لۆگین لە کاتی کردنەوەی ئەپ
(async () => {
  applyMemberLanguage();
  lucide.createIcons();

  // پشکنینی دۆخی ئەپی دامەزراو (Standalone PWA)
  const isAppStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isAppStandalone) {
    const banner = $('pwaInstallBanner');
    if (banner) banner.classList.add('hidden');
    const btn = $('btnPwaInstall');
    if (btn) btn.classList.add('hidden');
  }

  // تۆمارکردنی Service Worker بە ڕێڕەوی نزیک (Relative) بۆ پڕۆژەی GitHub Pages
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('✅ PWA Service Worker registered:', reg.scope))
      .catch(err => console.log('Service Worker notice:', err));
  }

  const savedCode = new URLSearchParams(location.search).get('code') || localStorage.getItem('gym_member_code');
  if (savedCode) {
    $('code').value = savedCode;
    await login();
  }
})();
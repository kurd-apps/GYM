let members = [], plans = [], subscriptionTypes = [], storeItems = [], storeSales = [], expenses = [], allExercises = [], staffList = [], appSettings = {};
let dietPlans = [], foodItems = [];
let currentMediaStream = null;
const $ = id => document.getElementById(id);

// سایدباری بچووککراوە / فراوانکراو
function toggleSidebarMini() {
  const sidebar = $('adminSidebar');
  const main = $('mainContent');
  if (!sidebar || !main) return;
  const isCollapsed = sidebar.classList.toggle('sidebar-collapsed');
  main.classList.toggle('content-expanded', isCollapsed);
  localStorage.setItem('adminSidebarCollapsed', isCollapsed ? 'true' : 'false');
  const icon = $('sidebarCollapseIcon');
  if (icon) {
    icon.setAttribute('data-lucide', isCollapsed ? 'panel-right-open' : 'panel-right-close');
    lucide.createIcons();
  }
}

function restoreSidebarState() {
  if (localStorage.getItem('adminSidebarCollapsed') === 'true') {
    const sidebar = $('adminSidebar');
    const main = $('mainContent');
    if (sidebar) sidebar.classList.add('sidebar-collapsed');
    if (main) main.classList.add('content-expanded');
    const icon = $('sidebarCollapseIcon');
    if (icon) {
      icon.setAttribute('data-lucide', 'panel-right-open');
    }
  }
}

// لیستی تەواوی ماسولکەکانی لەش بەوردی بە کوردی و ئینگلیزی
const DETAILED_MUSCLES_LIST = [
  { group: 'سنگ (Chest / Pectorals)', muscles: [
    'سنگ — بەشی سەرەوەی سنگ (Upper Chest / Clavicular)',
    'سنگ — بەشی ناوەڕاستی سنگ (Middle Chest / Sternal)',
    'سنگ — بەشی خوارەوەی سنگ (Lower Chest / Costal)',
    'سنگ — تەواوی سنگ (Overall Chest)'
  ]},
  { group: 'پشت (Back)', muscles: [
    'پشت — لاتس و پەڕەی پشت (Latissimus Dorsi / Lats)',
    'پشت — سەرەوەی پشت و تراپێز (Trapezius / Traps)',
    'پشت — خوارەوەی پشت (Lower Back / Erector Spinae)',
    'پشت — ڕۆمبۆیدس و ناوەڕاستی پشت (Rhomboids / Mid-Back)'
  ]},
  { group: 'شان (Shoulders / Deltoids)', muscles: [
    'شان — بەشی پێشەوەی شان (Anterior / Front Deltoid)',
    'شان — بەشی تەنیشتی شان (Lateral / Side Deltoid)',
    'شان — بەشی دواوەی شان (Posterior / Rear Deltoid)',
    'شان — ڕۆتەیتەر کاف و ماسولکەی جومگە (Rotator Cuff)'
  ]},
  { group: 'باڵ و قۆڵ (Arms)', muscles: [
    'قۆڵ — بایسێپس (Biceps Brachii)',
    'قۆڵ — ترایسێپس (Triceps Brachii)',
    'قۆڵ — برەکیالیس (Brachialis)',
    'قۆڵ — باسک و مەچەک (Forearms / Brachioradialis)'
  ]},
  { group: 'قاچ و ڕان (Legs)', muscles: [
    'قاچ — چوار سەرەی پێشەوەی ڕان (Quadriceps)',
    'قاچ — پشتەوەی ڕان (Hamstrings)',
    'قاچ — سمت و گلوتس (Glutes / Gluteus Maximus)',
    'قاچ — بەتە و ماسولکەی دەرپێ (Calves / Gastrocnemius & Soleus)',
    'قاچ — ناوەوەی ڕان (Adductors)',
    'قاچ — دەرەوەی ڕان (Abductors)'
  ]},
  { group: 'سک و ناوەند (Core & Abs)', muscles: [
    'سک — بەشی سەرەوە و خوارەوەی سک (Rectus Abdominis / Six Pack)',
    'سک — تەنیشتەکانی سک (Obliques)',
    'سک — ماسولکەی قووڵی ناوەند (Transverse Abdominis / Core)'
  ]},
  { group: 'کاردیۆ و تەواوی جەستە (Cardio & Full Body)', muscles: [
    'کاردیۆ و دڵ و بۆریەکانی خوێن (Cardiovascular / Endurance)',
    'تەواوی جەستە (Full Body / Compound)'
  ]}
];

function getMuscleDropdownHtml(selectedMuscle = '') {
  let html = `<select name="TargetMuscle" class="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 font-bold text-xs">`;
  html += `<option value="">-- بەشی ماسولکە هەڵبژێرە --</option>`;
  DETAILED_MUSCLES_LIST.forEach(cat => {
    html += `<optgroup label="${esc(cat.group)}">`;
    cat.muscles.forEach(m => {
      const isSel = m.trim() === String(selectedMuscle).trim();
      html += `<option value="${esc(m)}" ${isSel ? 'selected' : ''}>${esc(m)}</option>`;
    });
    html += `</optgroup>`;
  });
  html += `</select>`;
  return html;
}

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

function show(id) {
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  const target = $(id);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav').forEach(x => {
    x.classList.toggle('bg-white/10', x.dataset.v === id);
  });

  const t = (typeof APP_TRANSLATIONS !== 'undefined' && APP_TRANSLATIONS[currentAppLanguage]) ? APP_TRANSLATIONS[currentAppLanguage] : null;
  if (t && t.titles && t.titles[id]) {
    $('pageTitle').textContent = t.titles[id];
    if ($('pageSubTitle') && t.subtitles && t.subtitles[id]) $('pageSubTitle').textContent = t.subtitles[id];
  } else {
    const titles = {
      dashboard: 'داشبۆرد',
      members: 'بەشداربووان',
      plans: 'پلانەکانی ڕاهێنان و خۆراک',
      finances: 'داهات و خەرجی',
      store: 'فرۆشگا و POS',
      staff: 'ستاف و کارمەندان',
      notifications: 'ئاگادارییەکان',
      settings: 'ڕێکخستنەکان'
    };
    $('pageTitle').textContent = titles[id] || 'Gym Pro';
  }

  if (id === 'dashboard') renderTodayAttendance();
  if (id === 'members') renderMembers();
  if (id === 'plans') renderPlans();
  if (id === 'finances') renderFinances();
  if (id === 'store') renderStore();
  if (id === 'staff') renderStaff();
  if (id === 'notifications') renderNotifications();
  if (id === 'settings') renderSettings();
  lucide.createIcons();
}

async function loadAll() {
  try {
    const d = await call('getDashboardData');
    $('kMembers').textContent = d.totalMembers || 0;
    
    // داهاتی ئەمڕۆ
    $('kTodayRevenue').textContent = (d.todayRevenue || 0).toLocaleString() + ' IQD';
    $('kTodaySubRev').textContent = (d.todaySubRevenue || 0).toLocaleString();
    $('kTodayStoreRev').textContent = (d.todayStoreRevenue || 0).toLocaleString();

    // داهاتی مانگانە
    $('kRevenue').textContent = (d.monthlyRevenue || 0).toLocaleString() + ' IQD';
    $('kSubRev').textContent = (d.subRevenue || 0).toLocaleString();
    $('kStoreRev').textContent = (d.storeRevenue || 0).toLocaleString();
    $('kAttendance').textContent = d.todayAttendance || 0;

    draw('attendanceChart', d.attendanceTrend.map(x => x.date), d.attendanceTrend.map(x => x.value), 'ئامادەبوون');
    draw('memberChart', d.membersGrowth.map(x => x.date), d.membersGrowth.map(x => x.value), 'بەشداربووان');

    members = await call('getMembers');
    plans = await call('getPlans');
    subscriptionTypes = await call('getSubscriptionTypes');
    storeItems = await call('getStoreItems');
    storeSales = await call('getStoreSales');
    staffList = await call('getStaff');
    expenses = await call('getExpenses');
    allExercises = await call('getAllExercises');
    dietPlans = await call('getDietPlans');
    foodItems = await call('getFoodItems');
    appSettings = await call('getSettings');

    restoreSidebarState();

    if (appSettings.GymName) {
      $('sidebarGymName').textContent = appSettings.GymName;
    }

    await renderTodayAttendance();
    renderMembers();
    renderPlans();
    renderDietPlans();
    renderFinances();
    renderStore();
    renderStaff();
    await renderNotifications();
    renderSettings();
    lucide.createIcons();
  } catch (e) {
    console.error('loadAll error:', e);
  }
}

function draw(id, labels, data, label) {
  const canvas = $(id);
  if (!canvas) return;
  let chart = Chart.getChart(id);
  if (chart) chart.destroy();
  
  new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: id === 'attendanceChart' ? '#6366f1' : '#10b981',
        backgroundColor: id === 'attendanceChart' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.35,
        borderWidth: 2.5
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

// ==========================================
// بەڕێوەبردنی ئەندامان (Members View & Modal)
// ==========================================
function renderMembers() {
  const q = ($('memberSearch')?.value || '').toLowerCase().trim();
  const isEn = currentAppLanguage === 'en';
  const filtered = members.filter(m => 
    ((m.FullName || '') + ' ' + (m.MemberCode || '') + ' ' + (m.Phone || '')).toLowerCase().includes(q)
  );

  $('memberRows').innerHTML = filtered.length ? filtered.map(m => `
    <tr class="border-b hover:bg-slate-50 transition">
      <td class="p-3.5">
        <div class="flex items-center gap-3">
          <img src="${m.PhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" class="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-sm" onerror="this.src='https://placehold.co/96x96?text=User'">
          <span class="font-mono text-xs font-bold text-indigo-600">${esc(m.MemberCode)}</span>
        </div>
      </td>
      <td class="p-3.5 font-semibold text-slate-800">${esc(m.FullName)}</td>
      <td class="p-3.5"><span class="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold">${esc(m.SubscriptionType || (isEn ? 'Monthly' : 'مانگانە'))}</span></td>
      <td class="p-3.5 text-xs font-medium">
        <b>${(m.FinalPrice !== '' && m.FinalPrice !== undefined ? m.FinalPrice : m.SubscriptionPrice || 0).toLocaleString()} IQD</b>
        ${m.Discount ? `<span class="block text-[11px] text-emerald-600">${isEn ? 'Discount:' : 'داشکاندن:'} ${Number(m.Discount).toLocaleString()}</span>` : ''}
      </td>
      <td class="p-3.5 text-xs">${m.CurrentWeightKg ? m.CurrentWeightKg + ' kg' : '—'}</td>
      <td class="p-3.5"><span class="px-2 py-0.5 bg-slate-100 rounded text-xs">${esc(m.PlanId || (isEn ? 'Not Assigned' : 'دیارینەکراوە'))}</span></td>
      <td class="p-3.5 text-xs text-slate-600">${fmt(m.ExpiryDate)}</td>
      <td class="p-3.5">
        <span class="px-2.5 py-1 rounded-full text-xs font-bold ${m.Status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
          ${m.Status === 'Active' ? (isEn ? 'Active' : 'چالاک') : (isEn ? 'Expired' : 'بەسەرچوو')}
        </span>
      </td>
      <td class="p-3.5 whitespace-nowrap text-center">
        <div class="inline-flex items-center gap-1.5">
          <button onclick='editMember(${JSON.stringify(m).replace(/'/g, "&apos;")})' class="px-2.5 py-1 rounded-lg text-indigo-600 hover:bg-indigo-50 font-bold text-xs transition flex items-center gap-1" title="${isEn ? 'Edit Member' : 'دەستکاریکردنی بەشداربوو'}">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            <span>${isEn ? 'Edit' : 'ئیدیت'}</span>
          </button>
          <button onclick="printMemberPlan('${esc(m.MemberCode)}')" class="px-2.5 py-1 rounded-lg text-emerald-600 hover:bg-emerald-50 font-bold text-xs transition flex items-center gap-1" title="${isEn ? 'Print Workout & Diet Plan (PDF)' : 'چاپکردنی پلانی ڕاهێنان و خۆراک'}">
            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
            <span>${isEn ? 'Print Plan' : 'چاپکردنی پلان'}</span>
          </button>
          <button onclick="profile('${esc(m.MemberCode)}')" class="px-2 py-1 rounded-lg text-purple-600 hover:bg-purple-50 font-bold text-xs transition">${isEn ? 'Portal' : 'پڕۆفایل'}</button>
          <button onclick="removeMember('${esc(m.MemberCode)}')" class="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-bold text-xs transition">${isEn ? 'Delete' : 'سڕینەوە'}</button>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="9" class="p-6 text-center text-slate-400">${isEn ? 'No members found' : 'هیچ یاریزانێک نەدۆزرایەوە'}</td></tr>`;
  lucide.createIcons();
}

function openMember(m = {}) {
  stopCamera();
  const isEn = currentAppLanguage === 'en';
  $('modalTitle').textContent = m.MemberCode 
    ? (isEn ? 'Edit Member Details' : 'دەستکاریکردنی بەشداربوو') 
    : (isEn ? '+ Add New Member' : 'زیادکردنی بەشداربووی نوێ');
  
  const defaultSub = subscriptionTypes[0] || { Name: 'مانگانە ئاسایی', DurationDays: 30, Price: 40000 };
  const currentSubName = m.SubscriptionType || defaultSub.Name;
  const currentPrice = m.SubscriptionPrice !== undefined ? m.SubscriptionPrice : defaultSub.Price;
  const currentDiscount = m.Discount || 0;
  const currentFinal = Math.max(currentPrice - currentDiscount, 0);

  $('modalBody').innerHTML = `
    <form onsubmit="saveMember(event)" class="grid md:grid-cols-2 gap-3.5">
      ${field('MemberCode', isEn ? 'Member Code (auto-generated if empty)' : 'کۆدی بەشداربوو (خۆی دروست دەبێت ئەگەر بەتاڵ بێت)', m.MemberCode || '', m.MemberCode ? 'readonly class="bg-slate-100"' : 'placeholder="MEM-XXXX"')}
      ${field('FullName', isEn ? 'Full Name *' : 'ناوی سیانی *', m.FullName || '', `required placeholder="${isEn ? 'Full Name' : 'ناوی تەواو'}"`)}
      ${field('Phone', isEn ? 'Phone Number' : 'ژمارەی مۆبایل', m.Phone || '', 'placeholder="0770xxxxxxx"')}
      <label class="text-sm font-medium text-slate-700">
        <span class="block mb-1">${isEn ? 'Gender' : 'ڕەگەز'}</span>
        <select name="Gender" class="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500">
          <option value="نێر" ${m.Gender === 'نێر' ? 'selected' : ''}>${isEn ? 'Male' : 'نێر'}</option>
          <option value="مێ" ${m.Gender === 'مێ' ? 'selected' : ''}>${isEn ? 'Female' : 'مێ'}</option>
        </select>
      </label>

      <!-- جۆری بەشداریکردن لە سێتینگەوە -->
      <label class="text-sm font-medium text-slate-700">
        <span class="block mb-1 font-bold text-indigo-700">${isEn ? 'Membership Type (from Settings) *' : 'جۆری بەشداری (لە سێتینگەوە) *'}</span>
        <select id="mSubType" name="SubscriptionType" onchange="onSubTypeChange()" class="w-full border-2 border-indigo-200 bg-indigo-50/40 rounded-xl p-3 font-bold focus:ring-2 focus:ring-indigo-500">
          ${subscriptionTypes.map(st => `
            <option value="${esc(st.Name)}" data-price="${st.Price}" data-days="${st.DurationDays}" ${st.Name === currentSubName ? 'selected' : ''}>
              ${esc(st.Name)} (${Number(st.Price).toLocaleString()} IQD - ${st.DurationDays} ${isEn ? 'Days' : 'ڕۆژ'})
            </option>
          `).join('')}
        </select>
      </label>

      <!-- نرخ و داشکاندن -->
      <div class="grid grid-cols-2 gap-2">
        <label class="text-sm font-medium text-slate-700">
          <span class="block mb-1">${isEn ? 'Base Price' : 'نرخی بنەڕەتی'}</span>
          <input id="mSubPrice" name="SubscriptionPrice" value="${currentPrice}" oninput="calcFinalPrice()" type="number" class="w-full border rounded-xl p-3 bg-slate-50 font-bold">
        </label>
        <label class="text-sm font-medium text-slate-700">
          <span class="block mb-1 text-emerald-700 font-bold">${isEn ? 'Discount (IQD)' : 'داشکاندن (IQD)'}</span>
          <input id="mDiscount" name="Discount" value="${currentDiscount}" oninput="calcFinalPrice()" type="number" class="w-full border-2 border-emerald-300 rounded-xl p-3 font-bold text-emerald-800" placeholder="0">
        </label>
      </div>

      <div class="md:col-span-2 bg-slate-50 p-3 rounded-xl border flex justify-between items-center text-sm">
        <span>${isEn ? 'Final Price after discount:' : 'نرخی کۆتایی دوای داشکاندن:'}</span>
        <b id="mFinalDisplay" class="text-lg text-indigo-600 font-black">${currentFinal.toLocaleString()} IQD</b>
        <input type="hidden" id="mFinalPrice" name="FinalPrice" value="${currentFinal}">
      </div>

      <!-- دەستپێک و بەسەرچوون -->
      <label class="text-sm font-medium text-slate-700">
        <span class="block mb-1">${isEn ? 'Start Date' : 'بەرواری دەستپێک'}</span>
        <input id="mStartDate" name="StartDate" value="${m.StartDate || new Date().toISOString().slice(0, 10)}" onchange="calcExpiryDate()" type="date" class="w-full border rounded-xl p-3">
      </label>

      <label class="text-sm font-medium text-slate-700">
        <span class="block mb-1 font-bold text-indigo-700">${isEn ? 'Expiry Date (auto-calculated from type)' : 'بەرواری بەسەرچوون (خۆکار لەسەر ئەساسی جۆری بەشداری)'}</span>
        <input id="mExpiryDate" name="ExpiryDate" value="${m.ExpiryDate || ''}" type="date" class="w-full border-2 border-indigo-200 rounded-xl p-3 font-bold bg-indigo-50/20">
      </label>

      ${field('BirthDate', isEn ? 'Birth Date' : 'بەرواری لەدایکبوون', m.BirthDate || '', 'type="date"')}
      ${field('HeightCm', isEn ? 'Height (cm)' : 'باڵا (cm)', m.HeightCm || '', 'type="number"')}
      ${field('InitialWeightKg', isEn ? 'Initial Weight (kg)' : 'کێشی سەرەتایی (kg)', m.InitialWeightKg || '', 'type="number" step="0.1"')}
      ${field('CurrentWeightKg', isEn ? 'Current Weight (kg)' : 'کێشی ئێستا (kg)', m.CurrentWeightKg || '', 'type="number" step="0.1"')}

      <label class="text-sm font-medium text-slate-700">
        <span class="block mb-1">${isEn ? 'Workout Plan' : 'پلانی ڕاهێنان'}</span>
        <select name="PlanId" class="w-full border border-slate-200 rounded-xl p-3">
          <option value="">${isEn ? '-- Not Assigned --' : '-- دیارینەکراوە --'}</option>
          ${plans.map(p => `<option value="${esc(p.PlanId)}" ${m.PlanId === p.PlanId ? 'selected' : ''}>${esc(p.PlanName)}</option>`).join('')}
        </select>
      </label>

      <!-- پلانی خۆراک (Diet Plan) -->
      <label class="text-sm font-medium text-slate-700">
        <span class="block mb-1 font-bold text-emerald-700">${isEn ? 'Diet Plan' : 'پلانی خۆراک (Diet Plan)'}</span>
        <select id="mDietSelect" name="DietPlanName" onchange="onDietPlanChange()" class="w-full border-2 border-emerald-200 rounded-xl p-3 font-semibold bg-emerald-50/20 focus:ring-2 focus:ring-emerald-500">
          <option value="" data-id="">${isEn ? '-- No Diet Plan --' : '-- بێ پلانی خۆراک --'}</option>
          ${dietPlans.map(dp => `
            <option value="${esc(dp.PlanName)}" data-id="${esc(dp.PlanId)}" ${(m.DietPlanId === dp.PlanId || m.DietPlanName === dp.PlanName) ? 'selected' : ''}>
              ${esc(dp.PlanName)} (${dp.TotalCalories || dp.TargetCalories ? (dp.TotalCalories || dp.TargetCalories) + ' kcal' : ''})
            </option>
          `).join('')}
        </select>
        <input type="hidden" id="mDietPlanId" name="DietPlanId" value="${esc(m.DietPlanId || '')}">
      </label>

      <!-- ڕاهێنەری تایبەت بۆ بەشداربوو -->
      <label class="text-sm font-medium text-slate-700">
        <span class="block mb-1 font-bold text-indigo-700">${isEn ? 'Personal Trainer' : 'ڕاهێنەری تایبەت (Trainer)'}</span>
        <select id="mTrainerSelect" name="TrainerName" onchange="onTrainerChange()" class="w-full border-2 border-indigo-200 rounded-xl p-3 font-semibold focus:ring-2 focus:ring-indigo-500 bg-indigo-50/20">
          <option value="" data-id="">${isEn ? '-- Not Assigned --' : '-- دیارینەکراوە --'}</option>
          ${staffList.map(s => `
            <option value="${esc(s.FullName)}" data-id="${esc(s.StaffId)}" ${(m.TrainerName === s.FullName || m.TrainerId === s.StaffId) ? 'selected' : ''}>
              ${esc(s.FullName)} (${esc(s.Role)})
            </option>
          `).join('')}
        </select>
        <input type="hidden" id="mTrainerId" name="TrainerId" value="${esc(m.TrainerId || '')}">
      </label>

      <label class="text-sm font-medium text-slate-700">
        <span class="block mb-1">${isEn ? 'Membership Status' : 'دۆخ (Status)'}</span>
        <select name="Status" class="w-full border border-slate-200 rounded-xl p-3">
          <option value="Active" ${m.Status === 'Active' ? 'selected' : ''}>${isEn ? 'Active' : 'چالاک (Active)'}</option>
          <option value="Expired" ${m.Status === 'Expired' ? 'selected' : ''}>${isEn ? 'Expired' : 'بەسەرچوو (Expired)'}</option>
        </select>
      </label>

      <!-- گرتنی وێنە بە کامێرا -->
      <div class="md:col-span-2 border-2 border-dashed border-indigo-200 p-4 rounded-2xl bg-indigo-50/30">
        <span class="block text-sm font-bold text-slate-800 mb-2">${isEn ? 'Member Photo' : 'وێنەی بەشداربوو'}</span>
        <div class="flex flex-col sm:flex-row items-center gap-4">
          <img id="mPhotoPreview" src="${m.PhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" class="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-md">
          <div class="flex-1 space-y-2 w-full">
            <input id="mPhotoUrl" name="PhotoUrl" value="${esc(m.PhotoUrl || '')}" placeholder="${isEn ? 'Photo URL or take with camera...' : 'لینکی وێنە یان دەیگرین...'}" class="w-full border rounded-xl p-2.5 text-xs text-slate-700" oninput="$('mPhotoPreview').src=this.value">
            <div class="flex flex-wrap gap-2">
              <button type="button" onclick="startCamera()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow transition">
                <i data-lucide="camera" class="w-4 h-4"></i>
                <span>${isEn ? '📸 Take Photo with Camera' : '📸 گرتنی وێنە بە کامێرا'}</span>
              </button>
              <button type="button" onclick="capturePhoto()" id="btnCapture" class="hidden px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow transition">
                ${isEn ? '✓ Done (Capture)' : '✓ تەواو (گرتنی وێنە)'}
              </button>
              <button type="button" onclick="stopCamera()" id="btnStopCam" class="hidden px-3 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs">
                ${isEn ? 'Close Camera' : 'داخستنی کامێرا'}
              </button>
            </div>
          </div>
        </div>
        <div id="camContainer" class="hidden mt-3 text-center">
          <video id="webcam" autoplay playsinline class="w-full max-w-sm mx-auto rounded-2xl border-2 border-indigo-500 shadow-lg"></video>
          <canvas id="camCanvas" class="hidden"></canvas>
        </div>
      </div>

      <div class="md:col-span-2 pt-3 flex gap-3">
        <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3.5 rounded-xl shadow-md transition">
          ${isEn ? 'Save to Excel Database' : 'پاشەکەوتکردن لە Excel'}
        </button>
        <button type="button" onclick="closeModal()" class="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold transition">
          ${isEn ? 'Cancel' : 'پەشیمانبوونەوە'}
        </button>
      </div>
    </form>
  `;

  if (!m.ExpiryDate) calcExpiryDate();
  $('modal').classList.replace('hidden', 'flex');
  lucide.createIcons();
}

function onSubTypeChange() {
  const sel = $('mSubType');
  const opt = sel.options[sel.selectedIndex];
  if (opt) {
    const price = opt.dataset.price || 0;
    $('mSubPrice').value = price;
    calcFinalPrice();
    calcExpiryDate();
  }
}

function calcFinalPrice() {
  const p = Number($('mSubPrice')?.value) || 0;
  const d = Number($('mDiscount')?.value) || 0;
  const finalVal = Math.max(p - d, 0);
  if ($('mFinalDisplay')) $('mFinalDisplay').textContent = finalVal.toLocaleString() + ' IQD';
  if ($('mFinalPrice')) $('mFinalPrice').value = finalVal;
}

function calcExpiryDate() {
  const sel = $('mSubType');
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  const days = Number(opt?.dataset.days) || 30;

  const startStr = $('mStartDate')?.value || new Date().toISOString().slice(0, 10);
  const startDate = new Date(startStr);
  startDate.setDate(startDate.getDate() + days);

  if ($('mExpiryDate')) {
    $('mExpiryDate').value = startDate.toISOString().slice(0, 10);
  }
}

async function startCamera() {
  const container = $('camContainer');
  const video = $('webcam');
  try {
    currentMediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480 } });
    video.srcObject = currentMediaStream;
    container.classList.remove('hidden');
    $('btnCapture').classList.remove('hidden');
    $('btnStopCam').classList.remove('hidden');
  } catch (err) {
    alert('نەتوانرا کامێرا بکرێتەوە: ' + err.message);
  }
}

function capturePhoto() {
  const video = $('webcam');
  const canvas = $('camCanvas');
  canvas.width = video.videoWidth || 320;
  canvas.height = video.videoHeight || 320;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

  $('mPhotoPreview').src = dataUrl;
  $('mPhotoUrl').value = dataUrl;
  stopCamera();
}

function stopCamera() {
  if (currentMediaStream) {
    currentMediaStream.getTracks().forEach(t => t.stop());
    currentMediaStream = null;
  }
  if ($('camContainer')) $('camContainer').classList.add('hidden');
  if ($('btnCapture')) $('btnCapture').classList.add('hidden');
  if ($('btnStopCam')) $('btnStopCam').classList.add('hidden');
}

let currentEditingMember = null;

function editMember(m) {
  currentEditingMember = m;
  stopCamera();

  // Switch to full-page subview
  $('membersListView')?.classList.add('hidden');
  $('memberEditSubView')?.classList.remove('hidden');

  // Breadcrumb & title
  if ($('subViewMemberCodeBadge')) $('subViewMemberCodeBadge').textContent = m.MemberCode || 'MEM-XXXX';
  if ($('subViewMemberName')) $('subViewMemberName').textContent = m.FullName || 'ناوی تەواو';

  // Basic fields
  if ($('mevMemberCode')) $('mevMemberCode').value = m.MemberCode || '';
  if ($('mevFullName')) $('mevFullName').value = m.FullName || '';
  if ($('mevPhone')) $('mevPhone').value = m.Phone || '';
  if ($('mevGender')) $('mevGender').value = m.Gender || 'نێر';
  if ($('mevPhotoUrl')) $('mevPhotoUrl').value = m.PhotoUrl || '';
  if ($('mevPhotoPreview')) $('mevPhotoPreview').src = m.PhotoUrl || 'https://placehold.co/96x96?text=User';

  // Subscription types dropdown
  if ($('mevSubscriptionType')) {
    $('mevSubscriptionType').innerHTML = subscriptionTypes.map(st => `
      <option value="${esc(st.Name)}" data-price="${st.Price}" data-days="${st.DurationDays}" ${st.Name === m.SubscriptionType ? 'selected' : ''}>
        ${esc(st.Name)} (${Number(st.Price).toLocaleString()} IQD - ${st.DurationDays} ڕۆژ)
      </option>
    `).join('');
  }

  const defaultSub = subscriptionTypes[0] || { Price: 40000, DurationDays: 30 };
  if ($('mevSubscriptionPrice')) $('mevSubscriptionPrice').value = m.SubscriptionPrice !== undefined ? m.SubscriptionPrice : defaultSub.Price;
  if ($('mevDiscount')) $('mevDiscount').value = m.Discount || 0;
  calcSubViewFinalPrice();

  if ($('mevStartDate')) $('mevStartDate').value = m.StartDate ? m.StartDate.substring(0, 10) : '';
  if ($('mevExpiryDate')) $('mevExpiryDate').value = m.ExpiryDate ? m.ExpiryDate.substring(0, 10) : '';
  if ($('mevWeight')) $('mevWeight').value = m.CurrentWeightKg || '';
  if ($('mevHeight')) $('mevHeight').value = m.HeightCm || '';
  if ($('mevStatus')) $('mevStatus').value = m.Status || 'Active';

  // Workout Plans dropdown
  if ($('mevPlanId')) {
    $('mevPlanId').innerHTML = `<option value="">-- هیچ پلانێک --</option>` + plans.map(p => `
      <option value="${esc(p.PlanId || p.Id || p.Name)}" ${(p.PlanId === m.PlanId || p.Name === m.PlanId) ? 'selected' : ''}>
        ${esc(p.Name || p.PlanName || p.PlanId)}
      </option>
    `).join('');
  }

  // Diet Plans dropdown
  if ($('mevDietPlanId')) {
    $('mevDietPlanId').innerHTML = `<option value="">-- هیچ سیستەمێکی خۆراک --</option>` + dietPlans.map(d => `
      <option value="${esc(d.DietPlanId || d.PlanId || d.PlanName)}" ${(d.DietPlanId === m.DietPlanId || d.PlanName === m.DietPlanId) ? 'selected' : ''}>
        ${esc(d.PlanName || d.DietPlanId)} (${d.TargetCalories || d.TotalCalories || 2000} kcal)
      </option>
    `).join('');
  }

  // Trainers dropdown
  const trainers = (staffList || []).filter(s => s.Role === 'ڕاهێنەر' || s.Role === 'Trainer' || !s.Role);
  if ($('mevTrainerName')) {
    $('mevTrainerName').innerHTML = `<option value="">-- سەرپەرشتیاری گشتی --</option>` + (trainers.length ? trainers : staffList).map(s => `
      <option value="${esc(s.FullName)}" ${s.FullName === m.TrainerName ? 'selected' : ''}>${esc(s.FullName)} (${esc(s.Role || 'ستاف')})</option>
    `).join('');
  }

  if ($('mevNotes')) $('mevNotes').value = m.Notes || '';

  // Set default date for adding weight
  if ($('subViewNewWeightDate')) $('subViewNewWeightDate').value = new Date().toISOString().substring(0, 10);
  if ($('subViewNewWeightInput')) $('subViewNewWeightInput').value = m.CurrentWeightKg || '';

  // Load the 3 history sections
  loadMemberSubViewHistory(m.MemberCode);
  lucide.createIcons();
}

function closeMemberEditView() {
  $('memberEditSubView')?.classList.add('hidden');
  $('membersListView')?.classList.remove('hidden');
  currentEditingMember = null;
  stopCamera();
}

function onSubViewSubTypeChange() {
  const sel = $('mevSubscriptionType');
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  if (!opt) return;

  const price = opt.dataset.price;
  const days = Number(opt.dataset.days) || 30;

  if (price !== undefined && $('mevSubscriptionPrice')) {
    $('mevSubscriptionPrice').value = price;
  }

  // Recalculate expiry date from start date
  const startVal = $('mevStartDate')?.value;
  const baseDate = startVal ? new Date(startVal) : new Date();
  baseDate.setDate(baseDate.getDate() + days);
  if ($('mevExpiryDate')) {
    $('mevExpiryDate').value = baseDate.toISOString().substring(0, 10);
  }

  calcSubViewFinalPrice();
}

function calcSubViewFinalPrice() {
  const p = Number($('mevSubscriptionPrice')?.value) || 0;
  const d = Number($('mevDiscount')?.value) || 0;
  if ($('mevFinalPrice')) {
    $('mevFinalPrice').value = Math.max(p - d, 0);
  }
}

function onSubViewPhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    if ($('mevPhotoPreview')) $('mevPhotoPreview').src = e.target.result;
    if ($('mevPhotoUrl')) $('mevPhotoUrl').value = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveMemberSubView(e) {
  e.preventDefault();
  stopCamera();
  const form = e.target;
  const o = Object.fromEntries(new FormData(form));

  try {
    await call('updateMember', o);
    alert('دەستکارییەکانی بەشداربوو بە سەرکەوتوویی لە فایلی Excel تۆمار کران!');
    await loadAll();
    // Update local cached member
    const updated = members.find(x => x.MemberCode === o.MemberCode);
    if (updated) {
      currentEditingMember = updated;
      if ($('subViewMemberName')) $('subViewMemberName').textContent = updated.FullName;
      loadMemberSubViewHistory(updated.MemberCode);
    }
  } catch(err) {
    alert('هەڵە لە نوێکردنەوە: ' + (err.message || err));
  }
}

async function loadMemberSubViewHistory(memberCode) {
  try {
    const profile = await call('getMemberProfile', memberCode);
    const m = profile.member || currentEditingMember || {};
    const attList = profile.attendanceHistory || [];
    const weightList = profile.weightHistory || [];

    const isEn = currentAppLanguage === 'en';

    // 1. Render Attendance History Table
    const attBody = $('subViewAttendanceRows');
    if ($('subViewAttTotalBadge')) {
      $('subViewAttTotalBadge').textContent = isEn ? `${attList.length} times attended` : `${attList.length} جار ئامادەبووە`;
    }
    if (attBody) {
      if (!attList.length) {
        attBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400">${isEn ? 'No attendance records available for this member' : 'هیچ تۆمارێکی ئامادەبوون بۆ ئەم بەشداربووە بەردەست نییە'}</td></tr>`;
      } else {
        attBody.innerHTML = attList.map(a => {
          const isPresent = a.Status === 'ئامادەیە لە هۆڵ' || a.Status === 'In Gym';
          return `
            <tr class="hover:bg-slate-50 transition">
              <td class="p-3 font-semibold text-slate-800">${fmt(a.Date)}</td>
              <td class="p-3 font-mono font-bold text-emerald-700">${esc(a.CheckInTime || '—')}</td>
              <td class="p-3 font-mono text-slate-500">${esc(a.CheckOutTime || '—')}</td>
              <td class="p-3 font-semibold text-slate-700">${esc(a.DurationMinutes ? (a.DurationMinutes + (isEn ? ' min' : ' خولەک')) : (isPresent ? (isEn ? 'In gym' : 'لە ناو هۆڵە') : '—'))}</td>
              <td class="p-3 text-center">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${isPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}">
                  ${isPresent ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>' : ''}
                  <span>${esc(isPresent ? (isEn ? 'In Gym' : 'ئامادەیە لە هۆڵ') : (isEn ? 'Attended' : 'ئامادەبوو'))}</span>
                </span>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // 2. Render Subscription & Renewals
    if ($('subViewSubTypeName')) $('subViewSubTypeName').textContent = m.SubscriptionType || (isEn ? 'Monthly' : 'مانگانە');
    if ($('subViewSubStatusBadge')) {
      const isActive = m.Status === 'Active';
      $('subViewSubStatusBadge').innerHTML = `
        <span class="px-2.5 py-0.5 rounded-full text-xs font-black ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
          ${isActive ? (isEn ? 'Active' : 'چالاک (Active)') : (isEn ? 'Expired' : 'بەسەرچوو (Expired)')}
        </span>
      `;
    }
    if ($('subViewSubDaysLeft')) {
      const exp = m.ExpiryDate ? new Date(m.ExpiryDate) : null;
      if (exp && !isNaN(exp)) {
        const diff = Math.ceil((exp - new Date()) / (1000 * 60 * 60 * 24));
        $('subViewSubDaysLeft').textContent = diff > 0 
          ? (isEn ? `${diff} days left` : `${diff} ڕۆژ ماوە`) 
          : (diff === 0 
              ? (isEn ? 'Expires today' : 'ئەمڕۆ بەسەردەچێت') 
              : (isEn ? `Expired ${Math.abs(diff)} days ago` : `${Math.abs(diff)} ڕۆژ پێش ئێستا بەسەرچووە`));
        $('subViewSubDaysLeft').className = diff > 3 ? 'text-base text-amber-950 font-black' : 'text-base text-rose-600 font-black';
      } else {
        $('subViewSubDaysLeft').textContent = '—';
      }
    }
    const finalPrice = m.FinalPrice !== '' && m.FinalPrice !== undefined ? m.FinalPrice : m.SubscriptionPrice || 0;
    if ($('subViewSubPaidAmount')) $('subViewSubPaidAmount').textContent = Number(finalPrice).toLocaleString() + ' IQD';

    const subBody = $('subViewSubscriptionRows');
    if (subBody) {
      subBody.innerHTML = `
        <tr class="hover:bg-slate-50 transition">
          <td class="p-3 font-bold text-slate-900">${esc(m.SubscriptionType || (isEn ? 'Monthly' : 'مانگانە'))}</td>
          <td class="p-3 text-slate-600">${fmt(m.StartDate)}</td>
          <td class="p-3 font-bold text-slate-800">${fmt(m.ExpiryDate)}</td>
          <td class="p-3 font-mono font-bold text-emerald-700">${Number(finalPrice).toLocaleString()} IQD</td>
          <td class="p-3 text-slate-500">${Number(m.Discount || 0).toLocaleString()} IQD</td>
          <td class="p-3 text-center">
            <span class="px-2 py-0.5 rounded-full text-xs font-bold ${m.Status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
              ${m.Status === 'Active' ? (isEn ? 'Active' : 'چالاک') : (isEn ? 'Expired' : 'بەسەرچوو')}
            </span>
          </td>
        </tr>
      `;
    }

    // 3. Render Weight History Table
    const weightBody = $('subViewWeightHistoryRows');
    if (weightBody) {
      if (!weightList.length) {
        weightBody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">${isEn ? 'No previous weight records for this member' : 'هیچ تۆمارێکی پێشووی کێش بۆ ئەم یاریزانە نییە'}</td></tr>`;
      } else {
        weightBody.innerHTML = weightList.map((w, idx) => {
          const prev = weightList[idx + 1];
          let diffHtml = '<span class="text-slate-400">—</span>';
          if (prev && prev.WeightKg) {
            const diff = Number((Number(w.WeightKg) - Number(prev.WeightKg)).toFixed(1));
            if (diff > 0) {
              diffHtml = `<span class="text-rose-600 font-bold font-mono">+${diff} kg ↑</span>`;
            } else if (diff < 0) {
              diffHtml = `<span class="text-emerald-600 font-bold font-mono">${diff} kg ↓</span>`;
            } else {
              diffHtml = `<span class="text-slate-500 font-mono">0.0 kg</span>`;
            }
          }
          return `
            <tr class="hover:bg-slate-50 transition">
              <td class="p-3 font-semibold text-slate-700">${fmt(w.Date)}</td>
              <td class="p-3 font-mono font-black text-indigo-700 text-sm">${w.WeightKg} kg</td>
              <td class="p-3">${diffHtml}</td>
              <td class="p-3 text-slate-500">${esc(w.Note || '—')}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch(err) {
    console.error('loadMemberSubViewHistory error:', err);
  }
}

async function saveWeightFromSubView(e) {
  e.preventDefault();
  if (!currentEditingMember || !currentEditingMember.MemberCode) return;
  const wInput = $('subViewNewWeightInput');
  const dInput = $('subViewNewWeightDate');
  const nInput = $('subViewNewWeightNote');

  const weight = Number(wInput?.value);
  if (!weight) return;

  try {
    await call('addWeightLog', {
      MemberCode: currentEditingMember.MemberCode,
      WeightKg: weight,
      Date: dInput?.value || new Date().toISOString(),
      Note: nInput?.value || ''
    });
    alert('کێشی نوێ بە سەرکەوتوویی لە مێژووی کێش پاشەکەوت کرا!');
    if ($('mevWeight')) $('mevWeight').value = weight;
    if (nInput) nInput.value = '';
    await loadAll();
    loadMemberSubViewHistory(currentEditingMember.MemberCode);
  } catch(err) {
    alert('هەڵە لە تۆمارکردنی کێش: ' + (err.message || err));
  }
}

async function quickRenewSubscriptionSubView() {
  if (!currentEditingMember || !currentEditingMember.MemberCode) return;
  const m = currentEditingMember;
  if (!confirm(`ئایا دڵنیایت لە نوێکردنەوەی بەشداری بۆ ${m.FullName} بۆ خولێکی تر؟`)) return;

  try {
    const curExp = m.ExpiryDate ? new Date(m.ExpiryDate) : new Date();
    const base = curExp > new Date() ? curExp : new Date();
    const st = subscriptionTypes.find(x => x.Name === m.SubscriptionType) || subscriptionTypes[0] || { DurationDays: 30 };
    base.setDate(base.getDate() + (Number(st.DurationDays) || 30));

    const updated = {
      ...m,
      StartDate: new Date().toISOString(),
      ExpiryDate: base.toISOString(),
      Status: 'Active'
    };

    await call('updateMember', updated);
    alert('ئابوونەی بەشداربوو بە سەرکەوتوویی بۆ خولێکی تر نوێکرایەوە!');
    await loadAll();
    editMember(updated);
  } catch(err) {
    alert('هەڵە لە نوێکردنەوە: ' + (err.message || err));
  }
}

async function saveMember(e) {
  e.preventDefault();
  stopCamera();
  const o = Object.fromEntries(new FormData(e.target));
  try {
    const isExisting = o.MemberCode && members.some(x => x.MemberCode === o.MemberCode);
    if (isExisting) {
      await call('updateMember', o);
    } else {
      await call('addMember', o);
    }
    closeModal();
    await loadAll();
    alert('زانیارییەکان بە سەرکەوتوویی لە فایلی Excel تۆمار کران!');
  } catch (x) {
    alert('هەڵە لە پاشەکەوتکردن: ' + (x.message || x));
  }
}

async function removeMember(c) {
  if (!confirm(`ئایا دڵنیایت لە سڕینەوەی ئەم بەشداربووە (${c}) لە ناو فایلی Excel؟`)) return;
  try {
    await call('deleteMember', c);
    await loadAll();
    alert('بەشداربوو بە سەرکەوتوویی سڕایەوە');
  } catch (err) {
    alert('هەڵە: ' + err.message);
  }
}

// ==========================================
// چێک ئینی خێرا (Quick Check-in Dialog Modal)
// ==========================================
let currentQcFilter = 'all';

function quickCheckin() {
  openQuickCheckinModal();
}

function openQuickCheckinModal() {
  const modal = $('quickCheckinModal');
  if (!modal) return;
  modal.classList.replace('hidden', 'flex');
  if ($('qcSearchInput')) $('qcSearchInput').value = '';
  setQcFilter('all');
  lucide.createIcons();
}

function closeQuickCheckinModal() {
  const modal = $('quickCheckinModal');
  if (modal) modal.classList.replace('flex', 'hidden');
}

function setQcFilter(filter) {
  currentQcFilter = filter;
  ['all', 'inside', 'outside'].forEach(f => {
    const btn = $(`qcFilterBtn-${f}`);
    if (btn) {
      if (f === filter) {
        btn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-sm transition';
      } else {
        btn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
      }
    }
  });
  renderQuickCheckinList();
}

function renderQuickCheckinList() {
  const container = $('qcMembersList');
  if (!container) return;

  const q = ($('qcSearchInput')?.value || '').toLowerCase().trim();
  
  // Create attendance lookup from todayAttendanceList
  const attMap = {};
  (todayAttendanceList || []).forEach(a => {
    attMap[String(a.MemberCode).toLowerCase().trim()] = a;
  });

  const memberItems = members.map(m => {
    const code = String(m.MemberCode || '').trim();
    const att = attMap[code.toLowerCase()];
    const isInside = att && (!att.CheckOutTime || att.Status === 'ئامادەیە لە هۆڵ');
    return {
      member: m,
      att: att,
      isInside: Boolean(isInside)
    };
  });

  // Filter
  const filtered = memberItems.filter(item => {
    const m = item.member;
    const matchSearch = ((m.FullName || '') + ' ' + (m.MemberCode || '') + ' ' + (m.Phone || '')).toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (currentQcFilter === 'inside') return item.isInside;
    if (currentQcFilter === 'outside') return !item.isInside;
    return true;
  });

  const isEn = currentAppLanguage === 'en';

  if ($('qcSummaryCount')) {
    const insideCount = memberItems.filter(x => x.isInside).length;
    $('qcSummaryCount').textContent = isEn 
      ? `${filtered.length} Members (${insideCount} in gym)`
      : `${filtered.length} بەشداربوو (${insideCount} لە هۆڵدان)`;
  }

  if (!filtered.length) {
    container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">${isEn ? 'No members found matching filter' : 'هیچ بەشداربوویەک بەم مەرجە نەدۆزرایەوە'}</div>`;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const m = item.member;
    const att = item.att;
    const isInside = item.isInside;

    return `
      <div class="p-3 bg-white hover:bg-slate-50 border rounded-2xl flex items-center justify-between gap-3 transition">
        <div class="flex items-center gap-3 min-w-0">
          <img src="${m.PhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" class="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0" onerror="this.src='https://placehold.co/96x96?text=User'">
          <div class="truncate">
            <div class="flex items-center gap-2">
              <b class="text-xs font-bold text-slate-900 truncate">${esc(m.FullName)}</b>
              <span class="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">${esc(m.MemberCode)}</span>
            </div>
            <div class="flex items-center gap-2 mt-0.5 text-[11px]">
              <span class="text-slate-400 font-mono">${esc(m.Phone || (isEn ? 'No Phone' : 'بێ تەلەفۆن'))}</span>
              <span class="text-slate-300">•</span>
              <span class="text-slate-500 font-semibold">${esc(m.SubscriptionType || (isEn ? 'Monthly' : 'مانگانە'))}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <span class="px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 ${isInside ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}">
            <span class="w-2 h-2 rounded-full ${isInside ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}"></span>
            <span>${isInside ? (isEn ? `In Gym (${att?.CheckInTime || ''})` : `لە هۆڵدایە (${att?.CheckInTime || ''})`) : (isEn ? 'Outside' : 'لە دەرەوەیە')}</span>
          </span>

          ${isInside ? `
            <button onclick="performQuickCheckInOut('${esc(m.MemberCode)}', 'checkout')" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-sm">
              <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
              <span>${isEn ? 'Check Out' : 'چێک ئاوت'}</span>
            </button>
          ` : `
            <button onclick="performQuickCheckInOut('${esc(m.MemberCode)}', 'checkin')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-sm">
              <i data-lucide="check" class="w-3.5 h-3.5"></i>
              <span>${isEn ? 'Check In' : 'چێک ئین'}</span>
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

async function performQuickCheckInOut(memberCode, action) {
  try {
    const res = await call('kioskCheckInOut', memberCode, action, 'Manual Dialog Quick Action');
    await renderTodayAttendance();
    renderQuickCheckinList();
    if ($('kAttendance')) $('kAttendance').textContent = todayAttendanceList.length;
  } catch(err) {
    alert('هەڵە لە تۆمارکردن: ' + (err.message || err));
  }
}

function profile(c) {
  window.open('/member?code=' + encodeURIComponent(c), '_blank');
}

function openMemberPortalFromSubView() {
  if (currentEditingMember && currentEditingMember.MemberCode) {
    profile(currentEditingMember.MemberCode);
  }
}

function printMemberPlanFromSubView() {
  if (currentEditingMember && currentEditingMember.MemberCode) {
    printMemberPlan(currentEditingMember.MemberCode);
  }
}

async function printMemberPlan(memberCode) {
  const m = members.find(x => String(x.MemberCode).toLowerCase() === String(memberCode).toLowerCase()) || currentEditingMember;
  if (!m) {
    alert('بەشداربوو نەدۆزرایەوە');
    return;
  }

  // Find Workout Plan
  let workoutPlan = plans.find(p => p.PlanId === m.PlanId || p.Id === m.PlanId || p.Name === m.PlanId);
  let workoutDays = [];
  if (workoutPlan && workoutPlan.DaysJson) {
    try { workoutDays = JSON.parse(workoutPlan.DaysJson); } catch(e) {}
  }

  // Find Diet Plan
  let dietPlan = dietPlans.find(d => d.DietPlanId === m.DietPlanId || d.PlanId === m.DietPlanId || d.PlanName === m.DietPlanId);
  let dietMeals = [];
  let extraMacros = [];
  if (dietPlan && dietPlan.MealsJson) {
    try { dietMeals = JSON.parse(dietPlan.MealsJson); } catch(e) {}
  }
  if (dietPlan && dietPlan.ExtraMacrosJson) {
    try { extraMacros = typeof dietPlan.ExtraMacrosJson === 'string' ? JSON.parse(dietPlan.ExtraMacrosJson) : dietPlan.ExtraMacrosJson; } catch(e) {}
  }

  const gymName = $('sidebarGymName')?.textContent || 'Smart Gym Pro';
  const isEn = currentAppLanguage === 'en';

  const w = window.open('', '_blank', 'width=950,height=900');
  if (!w) {
    alert('تکایە رێگە بدە بە Pop-up لە براوسەرەکەتدا بۆ ئەوەی پەڕەی چاپکردن بکرێتەوە');
    return;
  }

  w.document.write(`
<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'ku'}" dir="${isEn ? 'ltr' : 'rtl'}">
<head>
  <meta charset="UTF-8">
  <title>${esc(m.FullName)} — ${isEn ? 'Workout & Nutrition Program' : 'بەرنامەی ڕاهێنان و خۆراک'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;600;700;900&family=Inter:wght@400;600;700;900&display=swap');
    body {
      font-family: ${isEn ? "'Inter', sans-serif" : "'Vazirmatn', sans-serif"};
      background: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 24px;
    }
    .print-container {
      max-width: 860px;
      margin: 0 auto;
      background: #fff;
      padding: 32px;
      border-radius: 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .gym-brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .gym-logo {
      width: 48px;
      height: 48px;
      background: #4f46e5;
      color: #fff;
      border-radius: 14px;
      display: grid;
      place-items: center;
      font-size: 24px;
      font-weight: 900;
    }
    .member-card {
      display: flex;
      align-items: center;
      gap: 20px;
      background: #f1f5f9;
      border-radius: 16px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .member-photo {
      width: 64px;
      height: 64px;
      border-radius: 14px;
      object-fit: cover;
      border: 2px solid #fff;
    }
    .member-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      flex: 1;
      font-size: 12px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 900;
      color: #1e1b4b;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 2px solid #cbd5e1;
      padding-bottom: 8px;
      margin-top: 28px;
      margin-bottom: 16px;
    }
    .day-box {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 14px;
      background: #fafafa;
    }
    .day-header {
      font-weight: 800;
      font-size: 14px;
      color: #4338ca;
      margin-bottom: 10px;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      padding: 8px 10px;
      text-align: ${isEn ? 'left' : 'right'};
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
    }
    .macro-chips {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .macro-chip {
      padding: 10px;
      border-radius: 12px;
      text-align: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .macro-val {
      font-size: 16px;
      font-weight: 900;
      display: block;
      margin-top: 4px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #64748b;
    }
    .print-btn-bar {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
    }
    .btn {
      padding: 10px 20px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      font-weight: 700;
      font-size: 13px;
    }
    .btn-print { background: #4f46e5; color: #fff; }
    .btn-close { background: #e2e8f0; color: #334155; }
    @media print {
      body { background: #fff; padding: 0; }
      .print-container { border: none; box-shadow: none; padding: 0; }
      .print-btn-bar { display: none; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="btn btn-print" onclick="window.print()">🖨️ ${isEn ? 'Print / Save as PDF' : 'چاپکردن / خەزنکردن وەک PDF'}</button>
    <button class="btn btn-close" onclick="window.close()">${isEn ? 'Close' : 'داخستن'}</button>
  </div>

  <div class="print-container">
    <div class="header">
      <div class="gym-brand">
        <div class="gym-logo">🏋️</div>
        <div>
          <h1 style="margin:0; font-size: 20px; font-weight: 900;">${esc(gymName)}</h1>
          <span style="font-size: 11px; color: #64748b;">${isEn ? 'Personal Fitness & Nutrition Sheet' : 'فۆڕمی تایبەتی ڕاهێنان و سیستەمی خۆراک'}</span>
        </div>
      </div>
      <div style="text-align: ${isEn ? 'right' : 'left'}; font-size: 11px; color: #64748b;">
        <div><b>${isEn ? 'Date:' : 'بەروار:'}</b> ${new Date().toLocaleDateString()}</div>
        <div><b>${isEn ? 'Code:' : 'کۆدی یاریزان:'}</b> <span style="font-family: monospace; font-weight: bold; color: #4338ca;">${esc(m.MemberCode)}</span></div>
      </div>
    </div>

    <!-- Member Details Card -->
    <div class="member-card">
      <img src="${m.PhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" class="member-photo" onerror="this.src='https://placehold.co/96x96?text=User'">
      <div class="member-grid">
        <div>
          <span style="color:#64748b; font-size:10px; display:block;">${isEn ? 'Full Name' : 'ناوی تەواو'}</span>
          <b style="font-size: 13px; color:#0f172a;">${esc(m.FullName)}</b>
        </div>
        <div>
          <span style="color:#64748b; font-size:10px; display:block;">${isEn ? 'Subscription' : 'جۆری بەشداری'}</span>
          <b>${esc(m.SubscriptionType || 'مانگانە')}</b>
        </div>
        <div>
          <span style="color:#64748b; font-size:10px; display:block;">${isEn ? 'Current Weight' : 'کێشی ئێستا'}</span>
          <b style="font-family: monospace;">${m.CurrentWeightKg ? m.CurrentWeightKg + ' kg' : '—'}</b>
        </div>
        <div>
          <span style="color:#64748b; font-size:10px; display:block;">${isEn ? 'Assigned Trainer' : 'ڕاهێنەری تایبەت'}</span>
          <b>${esc(m.TrainerName || 'سەرپەرشتیاری هۆڵ')}</b>
        </div>
      </div>
    </div>

    <!-- Section 1: Workout Routine -->
    <div class="section-title">
      <span>🏋️ ${isEn ? 'Workout Routine (' + (workoutPlan ? (workoutPlan.Name || workoutPlan.PlanName) : 'Custom') + ')' : 'بەرنامەی ڕاهێنانی هۆڵ (' + (workoutPlan ? (workoutPlan.Name || workoutPlan.PlanName) : 'تایبەت') + ')'}</span>
    </div>

    ${workoutDays.length ? workoutDays.map((d, dIdx) => `
      <div class="day-box">
        <div class="day-header">${esc(d.day || `${isEn ? 'Day' : 'ڕۆژی'} ${dIdx + 1}`)}</div>
        <table>
          <thead>
            <tr>
              <th style="width: 35%;">${isEn ? 'Exercise Name' : 'ناوی ڕاهێنان'}</th>
              <th style="width: 20%;">${isEn ? 'Muscle Group' : 'بەشی ماسولکە'}</th>
              <th style="width: 15%;">${isEn ? 'Sets' : 'کۆمەڵە'}</th>
              <th style="width: 15%;">${isEn ? 'Reps' : 'دووبارە'}</th>
              <th style="width: 15%;">${isEn ? 'Trainer Notes' : 'تێبینی'}</th>
            </tr>
          </thead>
          <tbody>
            ${(d.exercises || []).map(ex => `
              <tr>
                <td><b>${esc(ex.Name || ex.name || 'ڕاهێنان')}</b></td>
                <td><span style="color:#475569;">${esc(ex.TargetMuscle || ex.muscle || '—')}</span></td>
                <td style="font-family: monospace; font-weight: bold;">${esc(ex.Sets || ex.sets || '4')}</td>
                <td style="font-family: monospace; font-weight: bold;">${esc(ex.Reps || ex.reps || '12')}</td>
                <td style="color:#64748b; font-size:11px;">${esc(ex.TrainerNotes || ex.notes || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('') : `<p style="color:#94a3b8; font-size:12px; font-style: italic;">${isEn ? 'No specific workout plan assigned.' : 'هیچ بەرنامەیەکی ڕاهێنان بۆ ئەم یاریزانە دیاری نەکراوە.'}</p>`}

    <!-- Section 2: Nutrition & Diet Plan -->
    <div class="section-title">
      <span>🥗 ${isEn ? 'Diet & Nutrition Plan (' + (dietPlan ? dietPlan.PlanName : 'Healthy Diet') + ')' : 'سیستەمی خۆراکی تەندروست (' + (dietPlan ? dietPlan.PlanName : 'ڕجیم') + ')'}</span>
    </div>

    ${dietPlan ? `
      <div class="macro-chips">
        <div class="macro-chip" style="border-color:#fde68a;">
          <span style="color:#b45309; font-size:10px; font-weight:bold;">${isEn ? 'Daily Calories' : 'کالۆری ڕۆژانە'}</span>
          <span class="macro-val" style="color:#92400e;">${dietPlan.TargetCalories || dietPlan.TotalCalories || 2000} kcal</span>
        </div>
        <div class="macro-chip" style="border-color:#fecdd3;">
          <span style="color:#be123c; font-size:10px; font-weight:bold;">${isEn ? 'Protein' : 'پرۆتین'}</span>
          <span class="macro-val" style="color:#9f1239;">${dietPlan.ProteinGrams || 150} g</span>
        </div>
        <div class="macro-chip" style="border-color:#bfdbfe;">
          <span style="color:#1d4ed8; font-size:10px; font-weight:bold;">${isEn ? 'Carbs' : 'کاربۆهیدرات'}</span>
          <span class="macro-val" style="color:#1e40af;">${dietPlan.CarbsGrams || 180} g</span>
        </div>
        <div class="macro-chip" style="border-color:#a7f3d0;">
          <span style="color:#047857; font-size:10px; font-weight:bold;">${isEn ? 'Fats' : 'چەوری'}</span>
          <span class="macro-val" style="color:#065f46;">${dietPlan.FatGrams || dietPlan.FatsGrams || 50} g</span>
        </div>
      </div>

      ${extraMacros.length ? `
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
          ${extraMacros.map(em => `
            <span style="padding:4px 10px; background:#f1f5f9; border-radius:8px; font-size:11px; font-weight:bold; color:#334155;">
              ${esc(em.name)}: <b style="color:#4338ca;">${esc(em.target)} ${esc(em.unit)}</b>
            </span>
          `).join('')}
        </div>
      ` : ''}

      ${dietMeals.map((m, mIdx) => `
        <div class="day-box" style="background:#f0fdf4; border-color:#bbf7d0;">
          <div class="day-header" style="color:#15803d; display:flex; justify-content:space-between;">
            <span>${esc(m.mealName || `${isEn ? 'Meal' : 'ژەمی'} ${mIdx + 1}`)} (${esc(m.time || '12:00')})</span>
            <span style="font-family: monospace;">${m.calories || 0} kcal</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 50%;">${isEn ? 'Food Item' : 'خواردن'}</th>
                <th style="width: 25%;">${isEn ? 'Serving / Amount' : 'بڕ / پێوانە'}</th>
                <th style="width: 25%;">${isEn ? 'Protein / Nutrition' : 'پرۆتین'}</th>
              </tr>
            </thead>
            <tbody>
              ${(Array.isArray(m.foods) ? m.foods : []).map(f => `
                <tr>
                  <td><b>${esc(f.name || f)}</b></td>
                  <td>${esc(f.amount || '—')}</td>
                  <td style="color:#15803d; font-weight:bold;">${esc(f.protein || '')} ${f.calories ? `(${f.calories} kcal)` : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    ` : `<p style="color:#94a3b8; font-size:12px; font-style: italic;">${isEn ? 'No diet plan assigned.' : 'سیستەمی خۆراک بۆ ئەم یاریزانە دیاری نەکراوە.'}</p>`}

    <div class="footer">
      <div>
        <b>${isEn ? 'Trainer Signature:' : 'واژۆی ڕاهێنەر:'}</b> ____________________
      </div>
      <div>
        <b>${isEn ? 'Gym Stamp:' : 'مۆری فەرمی هۆڵ:'}</b> ____________________
      </div>
    </div>
  </div>
</body>
</html>
  `);
  w.document.close();
}

// ==========================================
// پلانەکانی ڕاهێنان (Drag & Drop Plan Builder Page) و سیستەمی خۆراک (Diet Plans)
// ==========================================
let currentBuilderDays = [];

function switchPlansMainTab(tab) {
  const isWorkout = tab === 'workout';
  $('plansWorkoutView')?.classList.toggle('hidden', !isWorkout);
  $('plansDietView')?.classList.toggle('hidden', isWorkout);

  $('btnTabWorkoutPlans').className = isWorkout 
    ? 'px-5 py-2.5 rounded-2xl text-xs md:text-sm font-bold bg-white text-indigo-600 shadow-sm border border-slate-200 flex items-center gap-2'
    : 'px-5 py-2.5 rounded-2xl text-xs md:text-sm font-semibold text-slate-600 hover:bg-white/60 flex items-center gap-2';

  $('btnTabDietPlans').className = !isWorkout
    ? 'px-5 py-2.5 rounded-2xl text-xs md:text-sm font-bold bg-white text-emerald-600 shadow-sm border border-slate-200 flex items-center gap-2'
    : 'px-5 py-2.5 rounded-2xl text-xs md:text-sm font-semibold text-slate-600 hover:bg-white/60 flex items-center gap-2';

  if (!isWorkout) {
    renderDietPlans();
  }
}

function showPlansListView() {
  $('plansListSubView')?.classList.remove('hidden');
  $('planBuilderSubView')?.classList.add('hidden');
  renderPlans();
}

function renderPlans() {
  $('planCards').innerHTML = plans.length ? plans.map(p => {
    const planExercises = allExercises.filter(e => e.PlanId === p.PlanId);
    let daysArray = [];
    try { daysArray = JSON.parse(p.DaysJson || '[]'); } catch(e){}

    return `
      <div class="border border-slate-200 rounded-3xl p-5 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition">
        <div>
          <div class="flex items-start justify-between gap-2">
            <b class="text-base text-slate-900 font-bold">${esc(p.PlanName)}</b>
            <span class="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">${esc(p.PlanId)}</span>
          </div>
          <p class="text-xs text-slate-500 mt-2 line-clamp-2">${esc(p.Description || (currentAppLanguage === 'en' ? 'No description' : 'وەسف نییە'))}</p>
          
          <!-- ڕۆژەکانی پلان -->
          <div class="mt-3 flex flex-wrap gap-1.5">
            ${daysArray.map(d => `<span class="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-lg">${esc(d)}</span>`).join('')}
          </div>

          <div class="mt-3 text-xs text-slate-600">
            ${currentAppLanguage === 'en' ? 'Total Exercises:' : 'کۆی ڕاهێنانەکان:'} <b class="text-indigo-600">${planExercises.length}</b> ${currentAppLanguage === 'en' ? 'exercises' : 'ڕاهێنان'}
          </div>
        </div>
        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <button onclick="viewPlanExercises('${esc(p.PlanId)}', '${esc(p.PlanName)}')" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
            ${currentAppLanguage === 'en' ? 'View Exercises →' : 'بینینی ڕاهێنانەکان →'}
          </button>
          <div class="flex gap-2">
            <button onclick='openPlanBuilder(${JSON.stringify(p).replace(/'/g, "&apos;")})' class="px-3 py-1 rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 text-xs font-bold transition">
              ${currentAppLanguage === 'en' ? 'Edit (Page)' : 'ئیدیت (پەیج)'}
            </button>
            <button onclick="removePlan('${esc(p.PlanId)}')" class="px-3 py-1 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-bold transition">
              ${currentAppLanguage === 'en' ? 'Delete' : 'سڕینەوە'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('') : `<div class="p-6 text-slate-400 col-span-full">${currentAppLanguage === 'en' ? 'No workout plans created yet' : 'هیچ پلانێک دانەنراوە'}</div>`;
}

function openPlanModal(p = {}) {
  openPlanBuilder(p);
}

function openPlanBuilder(p = null) {
  $('plansListSubView')?.classList.add('hidden');
  $('planBuilderSubView')?.classList.remove('hidden');

  const isEn = currentAppLanguage === 'en';
  const isEdit = Boolean(p && p.PlanId);
  $('planBuilderTitleText').textContent = isEdit 
    ? (isEn ? `Edit Plan: ${p.PlanName}` : `دەستکاریکردنی: ${p.PlanName}`) 
    : (isEn ? 'Create New Workout Plan' : 'دروستکردنی پلانی نوێ');
  $('pbPlanId').value = isEdit ? p.PlanId : '';
  $('pbPlanName').value = isEdit ? p.PlanName : '';
  $('pbDescription').value = isEdit ? (p.Description || '') : '';

  let days = isEn 
    ? ['Day 1 (Chest & Triceps)', 'Day 2 (Back & Biceps)', 'Day 3 (Legs & Shoulders)'] 
    : ['ڕۆژی ١ (سنگ و ترایسێپس)', 'ڕۆژی ٢ (پشت و بایسێپس)', 'ڕۆژی ٣ (قاچ و شان)'];
  if (isEdit && p.DaysJson) {
    try {
      const parsed = JSON.parse(p.DaysJson);
      if (Array.isArray(parsed) && parsed.length) days = parsed;
    } catch(e) {}
  }

  currentBuilderDays = days;
  const planExercises = isEdit ? allExercises.filter(e => e.PlanId === p.PlanId) : [];
  renderPlanBuilderKanban(currentBuilderDays, planExercises);
}

function renderPlanBuilderKanban(days, exercises = []) {
  const container = $('pbDaysKanban');
  if (!container) return;
  const isEn = currentAppLanguage === 'en';

  container.innerHTML = days.map((dayName) => {
    const dayExercises = exercises.filter(e => e.Day === dayName);
    return `
      <div class="day-column bg-slate-50/80 rounded-2xl border border-slate-200/90 p-4 shadow-sm flex flex-col justify-between" data-day="${esc(dayName)}">
        <div>
          <!-- سەردێڕی ڕۆژەکە -->
          <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              <h4 class="font-bold text-sm text-slate-800 day-title">${esc(dayName)}</h4>
            </div>
            <div class="flex items-center gap-1">
              <button type="button" onclick="editDayTitle('${esc(dayName)}')" class="p-1 text-slate-400 hover:text-indigo-600 rounded transition" title="${isEn ? 'Rename Day' : 'گۆڕینی ناوی ڕۆژ'}">
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              </button>
              <button type="button" onclick="removeDayColumn('${esc(dayName)}')" class="p-1 text-slate-400 hover:text-rose-600 rounded transition" title="${isEn ? 'Delete Day' : 'سڕینەوەی ئەم ڕۆژە'}">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>

          <!-- لیستی ڕاهێنانەکانی ئەم ڕۆژە بە Drag & Drop -->
          <div class="day-exercises-list min-h-[120px] space-y-2.5 p-1 rounded-xl bg-slate-100/50" data-day="${esc(dayName)}">
            ${dayExercises.map(ex => getKanbanExerciseCardHtml(ex)).join('')}
          </div>
        </div>

        <!-- دوگمەی زیادکردنی ڕاهێنان بۆ ئەم ڕۆژە -->
        <button type="button" onclick="openAddExerciseToDayModal('${esc(dayName)}')" class="mt-3.5 w-full py-2.5 px-3 rounded-xl border border-dashed border-indigo-300 hover:border-indigo-500 bg-white hover:bg-indigo-50/50 text-indigo-700 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs">
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>${isEn ? '+ Add Exercise' : '+ زیادکردنی ڕاهێنان'}</span>
        </button>
      </div>
    `;
  }).join('');

  lucide.createIcons();
  initKanbanSortable();
}

function getKanbanExerciseCardHtml(ex) {
  const isEn = currentAppLanguage === 'en';
  return `
    <div class="exercise-card bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition cursor-grab active:cursor-grabbing"
         data-name="${esc(ex.Name || '')}"
         data-muscle="${esc(ex.TargetMuscle || '')}"
         data-sets="${esc(ex.Sets || '3')}"
         data-reps="${esc(ex.Reps || '12')}"
         data-video="${esc(ex.VideoUrl || '')}"
         data-notes="${esc(ex.TrainerNotes || '')}">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="drag-handle text-slate-400 hover:text-slate-600 cursor-grab p-0.5" title="${isEn ? 'Drag up/down or to another day' : 'ڕاکێشان بۆ سەرەوە/خوارەوە یان بۆ ڕۆژێکی تر'}">
            <i data-lucide="grip-vertical" class="w-4 h-4"></i>
          </span>
          <div>
            <b class="text-xs text-slate-900 block font-bold">${esc(ex.Name)}</b>
            ${ex.TargetMuscle ? `<span class="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">${esc(ex.TargetMuscle)}</span>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-1">
          ${ex.VideoUrl ? `<a href="${esc(ex.VideoUrl)}" target="_blank" class="p-1 text-rose-500 hover:text-rose-700" title="${isEn ? 'Watch Video' : 'بینینی ڤیدیۆ'}"><i data-lucide="play-circle" class="w-4 h-4"></i></a>` : ''}
          <button type="button" onclick="this.closest('.exercise-card').remove()" class="p-1 text-slate-300 hover:text-rose-600 rounded transition" title="${isEn ? 'Delete' : 'سڕینەوە'}">✕</button>
        </div>
      </div>
      <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span class="font-medium">${ex.Sets || 3} ${isEn ? 'Sets' : 'کۆمەڵە'} × ${ex.Reps || 12} ${isEn ? 'Reps' : 'جار'}</span>
        ${ex.TrainerNotes ? `<span class="text-indigo-600 text-[10px] truncate max-w-[100px]" title="${esc(ex.TrainerNotes)}">${esc(ex.TrainerNotes)}</span>` : ''}
      </div>
    </div>
  `;
}

function initKanbanSortable() {
  document.querySelectorAll('.day-exercises-list').forEach(el => {
    Sortable.create(el, {
      group: 'planKanbanGroup',
      animation: 180,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      emptyInsertThreshold: 10
    });
  });
}

function addNewDayColumnPrompt() {
  const isEn = currentAppLanguage === 'en';
  const currentCount = document.querySelectorAll('.day-column').length + 1;
  const promptText = isEn 
    ? 'Enter day title (e.g. Day 4 (Abs & Cardio)):' 
    : 'ناوی ڕۆژەکە بنووسە (بۆ نموونە: ڕۆژی ٤ (سک و کاردیۆ)):';
  const defaultVal = isEn ? `Day ${currentCount}` : `ڕۆژی ${currentCount}`;
  const name = prompt(promptText, defaultVal);
  if (!name || !name.trim()) return;

  const trimmed = name.trim();
  const container = $('pbDaysKanban');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'day-column bg-slate-50/80 rounded-2xl border border-slate-200/90 p-4 shadow-sm flex flex-col justify-between';
  div.dataset.day = trimmed;
  div.innerHTML = `
    <div>
      <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
          <h4 class="font-bold text-sm text-slate-800 day-title">${esc(trimmed)}</h4>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" onclick="editDayTitle('${esc(trimmed)}')" class="p-1 text-slate-400 hover:text-indigo-600 rounded transition" title="${isEn ? 'Rename Day' : 'گۆڕینی ناوی ڕۆژ'}">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
          </button>
          <button type="button" onclick="removeDayColumn('${esc(trimmed)}')" class="p-1 text-slate-400 hover:text-rose-600 rounded transition" title="${isEn ? 'Delete Day' : 'سڕینەوەی ئەم ڕۆژە'}">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
      <div class="day-exercises-list min-h-[120px] space-y-2.5 p-1 rounded-xl bg-slate-100/50" data-day="${esc(trimmed)}"></div>
    </div>
    <button type="button" onclick="openAddExerciseToDayModal('${esc(trimmed)}')" class="mt-3.5 w-full py-2.5 px-3 rounded-xl border border-dashed border-indigo-300 hover:border-indigo-500 bg-white hover:bg-indigo-50/50 text-indigo-700 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs">
      <i data-lucide="plus" class="w-4 h-4"></i>
      <span>${isEn ? '+ Add Exercise' : '+ زیادکردنی ڕاهێنان'}</span>
    </button>
  `;
  container.appendChild(div);
  lucide.createIcons();
  initKanbanSortable();
}

function editDayTitle(oldName) {
  const isEn = currentAppLanguage === 'en';
  const col = document.querySelector(`.day-column[data-day="${oldName}"]`);
  if (!col) return;
  const newName = prompt(isEn ? 'Enter new name for this day:' : 'ناوی نوێ بۆ ئەم ڕۆژە بنووسە:', oldName);
  if (!newName || !newName.trim()) return;

  const trimmed = newName.trim();
  col.dataset.day = trimmed;
  col.querySelector('.day-title').textContent = trimmed;
  col.querySelector('.day-exercises-list').dataset.day = trimmed;
}

function removeDayColumn(dayName) {
  const isEn = currentAppLanguage === 'en';
  const msg = isEn 
    ? `Are you sure you want to remove "${dayName}" and all its exercises?` 
    : `ئایا دڵنیایت لە سڕینەوەی "${dayName}" و هەموو ڕاهێنانەکانی ناو ئەم ڕۆژە؟`;
  if (!confirm(msg)) return;
  const col = document.querySelector(`.day-column[data-day="${dayName}"]`);
  if (col) col.remove();
}

function openAddExerciseToDayModal(dayName) {
  const isEn = currentAppLanguage === 'en';
  $('modalTitle').textContent = isEn ? `Add Exercise to: ${dayName}` : `زیادکردنی ڕاهێنان بۆ: ${dayName}`;
  $('modalBody').innerHTML = `
    <form onsubmit="confirmAddExerciseToDay(event, '${esc(dayName)}')" class="space-y-4">
      <!-- هەڵبژاردن لە کتێبخانەی سێتینگ -->
      <div class="p-3 bg-indigo-50/60 border border-indigo-200 rounded-2xl">
        <label class="block text-xs font-bold text-indigo-900 mb-1">${isEn ? 'Quick Select from Exercise Library:' : 'هەڵبژاردنی خێرا لە کتێبخانەی ڕاهێنانەکان:'}</label>
        <select onchange="onSelectLibraryExerciseQuick(this)" class="w-full border border-indigo-200 rounded-xl p-2.5 text-xs font-bold bg-white text-indigo-950">
          <option value="">${isEn ? '-- Or enter exercise name manually --' : '-- یان ناوی ڕاهێنان بە دەست بنووسە --'}</option>
          ${allExercises.map(lib => `
            <option value="${esc(lib.Name)}" data-muscle="${esc(lib.TargetMuscle)}" data-sets="${esc(lib.Sets)}" data-reps="${esc(lib.Reps)}" data-video="${esc(lib.VideoUrl || '')}" data-notes="${esc(lib.TrainerNotes || '')}">
              ${esc(lib.Name)} — (${esc(lib.TargetMuscle)})
            </option>
          `).join('')}
        </select>
      </div>

      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">${isEn ? 'Exercise Name *' : 'ناوی ڕاهێنان *'}</label>
          <input id="qExName" required class="w-full border rounded-xl p-2.5 text-xs font-bold" placeholder="${isEn ? 'e.g. Bench Press' : 'ناوی ڕاهێنان'}">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">${isEn ? 'Target Muscle' : 'بەشی ماسولکە'}</label>
          <input id="qExMuscle" class="w-full border rounded-xl p-2.5 text-xs" placeholder="${isEn ? 'Chest, Back, Legs...' : 'سنگ، پشت، قاچ...'}">
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">${isEn ? 'Sets' : 'کۆمەڵە (Sets)'}</label>
          <input id="qExSets" value="4" class="w-full border rounded-xl p-2.5 text-xs">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">${isEn ? 'Reps' : 'دووبارە (Reps)'}</label>
          <input id="qExReps" value="12" class="w-full border rounded-xl p-2.5 text-xs">
        </div>
      </div>

      <div>
        <label class="block text-xs font-bold text-slate-700 mb-1">${isEn ? 'Exercise Video URL' : 'لینکی ڤیدیۆی ڕاهێنان'}</label>
        <input id="qExVideo" class="w-full border rounded-xl p-2.5 text-xs" placeholder="https://youtube.com/...">
      </div>

      <div>
        <label class="block text-xs font-bold text-slate-700 mb-1">${isEn ? 'Trainer Notes' : 'تێبینی ڕاهێنەر'}</label>
        <input id="qExNotes" class="w-full border rounded-xl p-2.5 text-xs" placeholder="${isEn ? 'Target weight, rest interval...' : 'کێشی ئارەزوومەندانە، کاتی پشوو...'}">
      </div>

      <div class="pt-2 flex gap-3">
        <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3 rounded-xl text-xs transition">
          ${isEn ? '✓ Add to Day' : '✓ زیادکردن بۆ ڕۆژەکە'}
        </button>
        <button type="button" onclick="closeModal()" class="px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold transition">
          ${isEn ? 'Close' : 'داخستن'}
        </button>
      </div>
    </form>
  `;
  $('modal').classList.replace('hidden', 'flex');
}

function onSelectLibraryExerciseQuick(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) return;
  $('qExName').value = opt.value;
  $('qExMuscle').value = opt.dataset.muscle || '';
  $('qExSets').value = opt.dataset.sets || '4';
  $('qExReps').value = opt.dataset.reps || '12';
  $('qExVideo').value = opt.dataset.video || '';
  $('qExNotes').value = opt.dataset.notes || '';
}

function confirmAddExerciseToDay(e, dayName) {
  e.preventDefault();
  const name = $('qExName')?.value.trim();
  if (!name) return;

  const cardHtml = getKanbanExerciseCardHtml({
    Name: name,
    TargetMuscle: $('qExMuscle')?.value.trim() || '',
    Sets: $('qExSets')?.value.trim() || '4',
    Reps: $('qExReps')?.value.trim() || '12',
    VideoUrl: $('qExVideo')?.value.trim() || '',
    TrainerNotes: $('qExNotes')?.value.trim() || ''
  });

  const col = document.querySelector(`.day-column[data-day="${dayName}"] .day-exercises-list`);
  if (col) {
    col.insertAdjacentHTML('beforeend', cardHtml);
    lucide.createIcons();
  }
  closeModal();
}

async function savePlanBuilderUI() {
  const planName = $('pbPlanName')?.value.trim();
  if (!planName) {
    alert('تکایە ناوی پلان دیاری بکە!');
    $('pbPlanName')?.focus();
    return;
  }

  const columns = document.querySelectorAll('.day-column');
  if (!columns.length) {
    alert('تکایە بەلایەنی کەمەوە ڕۆژێک بۆ ئەم پلانە زیاد بکە!');
    return;
  }

  const daysList = [];
  const exercisesList = [];

  columns.forEach(col => {
    const dayName = col.dataset.day || col.querySelector('.day-title')?.textContent.trim();
    if (!dayName) return;
    daysList.push(dayName);

    const cards = col.querySelectorAll('.exercise-card');
    cards.forEach(card => {
      exercisesList.push({
        Name: card.dataset.name,
        Day: dayName,
        TargetMuscle: card.dataset.muscle,
        Sets: card.dataset.sets,
        Reps: card.dataset.reps,
        VideoUrl: card.dataset.video,
        TrainerNotes: card.dataset.notes
      });
    });
  });

  const planData = {
    PlanId: $('pbPlanId')?.value || undefined,
    PlanName: planName,
    Description: $('pbDescription')?.value.trim() || '',
    Days: daysList
  };

  try {
    await call('savePlanWithExercises', planData, exercisesList);
    alert('پلان و ڕاهێنانەکان بە سەرکەوتوویی لە ناو داتابەیسی Excel پاشەکەوت کران!');
    showPlansListView();
    await loadAll();
  } catch (err) {
    alert('هەڵە لە پاشەکەوتکردن: ' + (err.message || err));
  }
}

async function removePlan(planId) {
  if (!confirm(`ئایا دڵنیایت لە سڕینەوەی ئەم پلانە (${planId})؟`)) return;
  try {
    await call('deletePlan', planId);
    await loadAll();
    alert('پلان بە سەرکەوتوویی سڕایەوە');
  } catch (err) {
    alert('هەڵە: ' + err.message);
  }
}

async function viewPlanExercises(planId, planName) {
  try {
    const isEn = currentAppLanguage === 'en';
    const exercises = await call('getExercises', planId);
    $('modalTitle').textContent = (isEn ? 'Exercises: ' : 'ڕاهێنانەکانی: ') + planName;
    $('modalBody').innerHTML = `
      <div class="space-y-3">
        ${exercises.length ? exercises.map(ex => `
          <div class="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex items-center justify-between">
            <div>
              <b class="text-slate-800">${esc(ex.Name)}</b>
              <div class="text-xs text-slate-500 mt-1">${esc(ex.Day || '')} | ${isEn ? 'Target:' : 'بەش:'} ${esc(ex.TargetMuscle)} | ${isEn ? 'Sets:' : 'کۆمەڵە:'} ${ex.Sets} | ${isEn ? 'Reps:' : 'دووبارە:'} ${ex.Reps}</div>
              ${ex.TrainerNotes ? `<div class="text-xs text-indigo-600 mt-1">${isEn ? 'Notes:' : 'تێبینی:'} ${esc(ex.TrainerNotes)}</div>` : ''}
            </div>
            ${ex.VideoUrl ? `<a href="${esc(ex.VideoUrl)}" target="_blank" class="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200">${isEn ? 'Video ▶' : 'ڤیدیۆ ▶'}</a>` : ''}
          </div>
        `).join('') : `<p class="text-slate-400 text-center py-6">${isEn ? 'No exercises recorded for this plan' : 'هیچ ڕاهێنانێک بۆ ئەم پلانە تۆمار نەکراوە'}</p>`}
      </div>
      <div class="mt-5 text-left">
        <button onclick="closeModal()" class="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 rounded-xl text-sm font-semibold transition">${isEn ? 'Close' : 'داخستن'}</button>
      </div>
    `;
    $('modal').classList.replace('hidden', 'flex');
  } catch (err) {
    alert((currentAppLanguage === 'en' ? 'Error: ' : 'هەڵە: ') + err.message);
  }
}

// ==========================================
// سیستەمەکانی خۆراک و ڕجیم (Diet Plans)
// ==========================================
function renderDietPlans() {
  const container = $('dietPlansCards');
  if (!container) return;
  const isEn = currentAppLanguage === 'en';

  if (!dietPlans || !dietPlans.length) {
    container.innerHTML = `<div class="p-8 text-slate-400 col-span-full text-center border-2 border-dashed rounded-3xl bg-white/50">${isEn ? 'No diet plans created yet. You can create a new plan using the button above.' : 'هیچ سیستەمێکی خۆراک دانەنراوە، دەتوانیت لە ڕێگەی دوگمەی سەرەوە سیستەمی نوێ دروست بکەیت'}</div>`;
    return;
  }

  container.innerHTML = dietPlans.map(dp => {
    let meals = [];
    try { meals = JSON.parse(dp.MealsJson || '[]'); } catch(e){}

    return `
      <div class="border border-slate-200 rounded-3xl p-5 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition">
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <b class="text-base text-slate-900 block font-bold">${esc(dp.PlanName)}</b>
              <span class="text-xs text-emerald-600 font-bold">${esc(dp.Goal || (isEn ? 'Balanced' : 'هاوسەنگ'))}</span>
            </div>
            <span class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-mono font-bold">${dp.TargetCalories || dp.TotalCalories || 0} kcal</span>
          </div>

          <p class="text-xs text-slate-500 line-clamp-2">${esc(dp.Description || (isEn ? 'Healthy nutrition guide' : 'ڕێنمایی و ڕجیمی تەندروست'))}</p>

          <!-- ماکرۆسەکان -->
          <div class="grid grid-cols-3 gap-2 text-center p-3 bg-slate-50 rounded-2xl border text-xs">
            <div>
              <span class="text-[10px] text-slate-400 block font-semibold">${isEn ? 'Protein' : 'پرۆتین'}</span>
              <b class="text-indigo-600 font-black">${dp.ProteinGrams || 0}g</b>
            </div>
            <div>
              <span class="text-[10px] text-slate-400 block font-semibold">${isEn ? 'Carbs' : 'کاربۆهیدرات'}</span>
              <b class="text-amber-600 font-black">${dp.CarbsGrams || 0}g</b>
            </div>
            <div>
              <span class="text-[10px] text-slate-400 block font-semibold">${isEn ? 'Fats' : 'چەوری'}</span>
              <b class="text-rose-600 font-black">${dp.FatGrams || dp.FatsGrams || 0}g</b>
            </div>
          </div>

          <!-- ژەمەکان -->
          <div class="space-y-1.5 pt-1">
            <span class="text-[11px] font-bold text-slate-700 block">${isEn ? 'Meals in this plan' : 'ژەمەکانی ئەم پلانە'} (${meals.length}):</span>
            <div class="space-y-1 max-h-36 overflow-y-auto pr-1">
              ${meals.map(m => {
                const foodsSummary = Array.isArray(m.foods) ? m.foods.map(f => f.name || f).join('، ') : (m.foods || (isEn ? 'Standard meal' : 'ژەمی ئاسایی'));
                return `
                  <div class="p-2 rounded-xl bg-slate-50 border text-[11px] flex justify-between items-center">
                    <div class="truncate max-w-[180px]">
                      <b class="text-slate-800 block truncate">${esc(m.mealName || m.name || (isEn ? 'Meal' : 'ژەم'))}</b>
                      <span class="text-[10px] text-slate-400 block truncate">${esc(foodsSummary)}</span>
                    </div>
                    <span class="font-mono text-emerald-700 font-bold shrink-0">${m.calories || 0} kcal</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <button onclick='viewDietPlanModal(${JSON.stringify(dp).replace(/'/g, "&apos;")})' class="text-xs font-semibold text-emerald-600 hover:text-emerald-800">
            ${isEn ? 'View All Meals →' : 'بینینی تەواوی ژەمەکان →'}
          </button>
          <div class="flex gap-2">
            <button onclick='openDietPlanBuilder(${JSON.stringify(dp).replace(/'/g, "&apos;")})' class="px-3 py-1.5 rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 text-xs font-bold transition flex items-center gap-1">
              <i data-lucide="edit-3" class="w-3 h-3"></i>
              <span>${isEn ? 'Edit (Page)' : 'دەستکاری (پەیج)'}</span>
            </button>
            <button onclick="removeDietPlan('${esc(dp.DietPlanId || dp.PlanId)}')" class="px-2.5 py-1.5 rounded-xl text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-bold transition">
              ${isEn ? 'Delete' : 'سڕینەوە'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

let currentDietBuilderMeals = [];

function openDietPlanBuilder(dp = {}) {
  const isEn = currentAppLanguage === 'en';
  const isEdit = Boolean(dp.PlanId || dp.DietPlanId);
  const planId = dp.PlanId || dp.DietPlanId || '';
  
  $('dietPlansListSubView')?.classList.add('hidden');
  $('dietPlanBuilderSubView')?.classList.remove('hidden');

  if ($('dietPlanBuilderTitleText')) {
    $('dietPlanBuilderTitleText').textContent = isEdit 
      ? (isEn ? `Edit Diet Plan: ${dp.PlanName}` : `دەستکاریکردنی: ${dp.PlanName}`) 
      : (isEn ? 'Create New Diet Plan' : 'دروستکردنی پلانی خۆراکی نوێ');
  }

  $('dpbPlanId').value = planId;
  $('dpbPlanName').value = dp.PlanName || '';
  if ($('dpbGoal')) $('dpbGoal').value = dp.Goal || (isEn ? 'Weight Loss' : 'دابەزاندنی کێش');
  $('dpbDescription').value = dp.Description || '';
  $('dpbTotalCalories').value = dp.TargetCalories || dp.TotalCalories || 2000;
  $('dpbProteinGrams').value = dp.ProteinGrams || 150;
  $('dpbCarbsGrams').value = dp.CarbsGrams || 180;
  $('dpbFatsGrams').value = dp.FatGrams || dp.FatsGrams || 50;

  currentDietExtraMacros = [];
  if (dp.ExtraMacrosJson) {
    try {
      currentDietExtraMacros = typeof dp.ExtraMacrosJson === 'string' ? JSON.parse(dp.ExtraMacrosJson) : dp.ExtraMacrosJson;
    } catch(e) {}
  }
  renderDietExtraMacros();

  let meals = [];
  if (dp.MealsJson) {
    try { meals = JSON.parse(dp.MealsJson); } catch(e) {}
  }
  if (!meals.length) {
    meals = isEn ? [
      {
        mealName: 'Breakfast',
        time: '08:30',
        calories: 500,
        foods: [
          { name: 'Boiled Eggs', amount: '3 pcs', protein: '18g', calories: 210 },
          { name: 'Oatmeal with Milk', amount: '60g', protein: '12g', calories: 250 }
        ]
      },
      {
        mealName: 'Lunch',
        time: '13:30',
        calories: 700,
        foods: [
          { name: 'Grilled Chicken Breast', amount: '200g', protein: '46g', calories: 330 },
          { name: 'Basmati Rice', amount: '150g', protein: '4g', calories: 200 },
          { name: 'Green Salad & Olive Oil', amount: '1 bowl', protein: '2g', calories: 120 }
        ]
      },
      {
        mealName: 'Pre-Workout Snack',
        time: '16:30',
        calories: 250,
        foods: [
          { name: 'Banana', amount: '1 pc', protein: '1g', calories: 100 },
          { name: 'Black Coffee & Mixed Nuts', amount: '30g', protein: '5g', calories: 150 }
        ]
      },
      {
        mealName: 'Dinner',
        time: '20:30',
        calories: 550,
        foods: [
          { name: 'Tuna or Salmon Fish', amount: '150g', protein: '35g', calories: 280 },
          { name: 'Boiled Potatoes & Broccoli', amount: '150g', protein: '4g', calories: 180 }
        ]
      }
    ] : [
      {
        mealName: 'ژەمی بەیانیان (Breakfast)',
        time: '08:30',
        calories: 500,
        foods: [
          { name: 'هێلکەی کوڵاو', amount: '٣ دانە', protein: '18g', calories: 210 },
          { name: 'شۆفان لەگەڵ شیر', amount: '٦٠ گرام', protein: '12g', calories: 250 }
        ]
      },
      {
        mealName: 'ژەمی نیوەڕۆ (Lunch)',
        time: '13:30',
        calories: 700,
        foods: [
          { name: 'سنگی مریشکی برژاو', amount: '٢٠٠ گرام', protein: '46g', calories: 330 },
          { name: 'برنجی کوردی یان بەسمەتی', amount: '١٥٠ گرام', protein: '4g', calories: 200 },
          { name: 'زەڵاتەی سەوزە و ڕۆنی زەیتوون', amount: '١ قاپ', protein: '2g', calories: 120 }
        ]
      },
      {
        mealName: 'سووکەژەمی پێش ڕاهێنان (Pre-Workout)',
        time: '16:30',
        calories: 250,
        foods: [
          { name: 'مۆز', amount: '١ دانە', protein: '1g', calories: 100 },
          { name: 'قاوەی ڕەش و چەرەسات', amount: '٣٠ گرام', protein: '5g', calories: 150 }
        ]
      },
      {
        mealName: 'ژەمی ئێواران (Dinner)',
        time: '20:30',
        calories: 550,
        foods: [
          { name: 'ماسی تونە یان سەلمۆن', amount: '١٥٠ گرام', protein: '35g', calories: 280 },
          { name: 'پەتاتەی کوڵاو و برۆکلی', amount: '١٥٠ گرام', protein: '4g', calories: 180 }
        ]
      }
    ];
  }

  currentDietBuilderMeals = meals;
  renderDietBuilderMeals();
  lucide.createIcons();
}

function showDietPlansListView() {
  $('dietPlanBuilderSubView')?.classList.add('hidden');
  $('dietPlansListSubView')?.classList.remove('hidden');
  renderDietPlans();
  lucide.createIcons();
}

function renderDietBuilderMeals() {
  const container = $('dpbMealsContainer');
  if (!container) return;
  const isEn = currentAppLanguage === 'en';

  if (!currentDietBuilderMeals.length) {
    container.innerHTML = `<div class="p-8 text-center text-slate-400 col-span-full border-2 border-dashed rounded-3xl">${isEn ? 'No meals added. Click + Add Meal to begin.' : 'هیچ ژەمێک دانەنراوە، کلیک لە + زیادکردنی ژەم بکە'}</div>`;
    return;
  }

  container.innerHTML = currentDietBuilderMeals.map((m, mIdx) => {
    let foodsList = Array.isArray(m.foods) ? m.foods : [];
    if (typeof m.foods === 'string' && m.foods) {
      foodsList = m.foods.split(',').map(f => ({ name: f.trim(), amount: '', calories: 0, protein: '' }));
    }

    return `
      <div class="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm space-y-4 hover:shadow-md transition">
        <!-- سەرناوی ژەم، ڕۆژ و کات -->
        <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div class="flex items-center gap-2 flex-1 min-w-[180px]">
            <span class="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span>
            <input value="${esc(m.mealName || (isEn ? `Meal ${mIdx + 1}` : `ژەمی ${mIdx + 1}`))}" onchange="updateDietMealField(${mIdx}, 'mealName', this.value)" class="font-black text-sm text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-none p-1 rounded flex-1">
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <!-- فلتەری ڕۆژ بۆ ژەم (ڕۆژی ١، ٢... یان ڕۆژانی هەفتە) -->
            <select onchange="updateDietMealField(${mIdx}, 'day', this.value)" class="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl px-2 py-1 focus:outline-none">
              <option value="ڕۆژی ١" ${(m.day === 'ڕۆژی ١' || m.day === 'Day 1' || !m.day) ? 'selected' : ''}>${isEn ? 'Day 1' : 'ڕۆژی ١'}</option>
              <option value="ڕۆژی ٢" ${(m.day === 'ڕۆژی ٢' || m.day === 'Day 2') ? 'selected' : ''}>${isEn ? 'Day 2' : 'ڕۆژی ٢'}</option>
              <option value="ڕۆژی ٣" ${(m.day === 'ڕۆژی ٣' || m.day === 'Day 3') ? 'selected' : ''}>${isEn ? 'Day 3' : 'ڕۆژی ٣'}</option>
              <option value="ڕۆژی ٤" ${(m.day === 'ڕۆژی ٤' || m.day === 'Day 4') ? 'selected' : ''}>${isEn ? 'Day 4' : 'ڕۆژی ٤'}</option>
              <option value="ڕۆژی ٥" ${(m.day === 'ڕۆژی ٥' || m.day === 'Day 5') ? 'selected' : ''}>${isEn ? 'Day 5' : 'ڕۆژی ٥'}</option>
              <option value="ڕۆژی ٦" ${(m.day === 'ڕۆژی ٦' || m.day === 'Day 6') ? 'selected' : ''}>${isEn ? 'Day 6' : 'ڕۆژی ٦'}</option>
              <option value="ڕۆژی ٧" ${(m.day === 'ڕۆژی ٧' || m.day === 'Day 7') ? 'selected' : ''}>${isEn ? 'Day 7' : 'ڕۆژی ٧'}</option>
              <option value="هەموو ڕۆژەکان" ${(m.day === 'هەموو ڕۆژەکان' || m.day === 'All Days') ? 'selected' : ''}>${isEn ? 'All Days' : 'هەموو ڕۆژەکان'}</option>
            </select>
            <input type="time" value="${esc(m.time || '12:00')}" onchange="updateDietMealField(${mIdx}, 'time', this.value)" class="text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-slate-700">
            <button type="button" onclick="removeMealFromDietPlan(${mIdx})" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition" title="${isEn ? 'Delete Meal' : 'سڕینەوەی ئەم ژەمە'}">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- کالۆری ژەم -->
        <div class="flex items-center justify-between bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 text-xs">
          <span class="font-bold text-emerald-900">${isEn ? 'Calories in this meal:' : 'کالۆری ئەم ژەمە:'}</span>
          <div class="flex items-center gap-1">
            <input type="number" value="${m.calories || 0}" onchange="updateDietMealField(${mIdx}, 'calories', Number(this.value))" class="w-20 border border-emerald-300 rounded-lg p-1 text-center font-mono font-black text-emerald-800 bg-white text-xs">
            <span class="font-bold text-emerald-700">kcal</span>
          </div>
        </div>

        <!-- پێکهاتە خۆراکییەکان -->
        <div class="space-y-2">
          <span class="text-xs font-bold text-slate-600 block">${isEn ? 'Foods & Ingredients:' : 'پێکهاتە و خواردنەکان:'}</span>
          <div class="space-y-1.5">
            ${foodsList.map((f, fIdx) => `
              <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                <div class="flex-1 min-w-0">
                  <b class="text-slate-800 block truncate">${esc(f.name)}</b>
                  <div class="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                    ${f.amount ? `<span>${isEn ? 'Qty:' : 'بڕ:'} <b class="text-slate-700">${esc(f.amount)}</b></span>` : ''}
                    ${f.protein ? `<span>• ${isEn ? 'Protein:' : 'پرۆتین:'} <b class="text-indigo-600">${esc(f.protein)}</b></span>` : ''}
                    ${f.calories ? `<span>• <b class="text-emerald-700">${f.calories} kcal</b></span>` : ''}
                  </div>
                </div>
                <button type="button" onclick="removeFoodFromMeal(${mIdx}, ${fIdx})" class="text-slate-400 hover:text-rose-600 p-1" title="${isEn ? 'Delete' : 'سڕینەوە'}">
                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            `).join('')}
          </div>

          <!-- دوگمەی زیادکردنی خواردن بۆ ژەم (ڕێگای مۆداڵی مۆدێرن بەبێ prompt) -->
          <button type="button" onclick="openFoodPickerModal(${mIdx})" class="w-full py-2.5 border border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5 bg-white hover:bg-emerald-50/50 transition shadow-xs">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            <span>${isEn ? '+ Add Food to Meal (Ingredients)' : '+ زیادکردنی خواردن بۆ ئەم ژەمە (خۆراکەکان)'}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function updateDietMealField(idx, field, val) {
  if (currentDietBuilderMeals[idx]) {
    currentDietBuilderMeals[idx][field] = val;
    if (field === 'calories') autoRecalcDietMacros();
  }
}

function addNewMealToDietPlan() {
  const isEn = currentAppLanguage === 'en';
  const num = currentDietBuilderMeals.length + 1;
  currentDietBuilderMeals.push({
    mealName: isEn ? `Meal ${num}` : `ژەمی ${num}`,
    day: isEn ? 'Day 1' : 'ڕۆژی ١',
    time: '12:00',
    calories: 400,
    foods: []
  });
  renderDietBuilderMeals();
  autoRecalcDietMacros();
}

function removeMealFromDietPlan(idx) {
  currentDietBuilderMeals.splice(idx, 1);
  renderDietBuilderMeals();
  autoRecalcDietMacros();
}

// ==========================================
// مۆداڵی دەستنیشانکردنی خواردن (Food Picker Modal) - شوێنگرەوەی prompt
// ==========================================
let targetFoodPickerMealIdx = null;
let currentFoodPickerCat = 'all';
let currentFoodPickerTab = 'library';

function openFoodPickerModal(mIdx) {
  targetFoodPickerMealIdx = mIdx;
  switchFoodPickerTab('library');
  if ($('fpSearchInput')) $('fpSearchInput').value = '';
  if ($('fpSelectedName')) $('fpSelectedName').value = '';
  if ($('fpSelectedAmount')) $('fpSelectedAmount').value = '';
  if ($('fpSelectedCalories')) $('fpSelectedCalories').value = '';
  if ($('fpSelectedProtein')) $('fpSelectedProtein').value = '';
  filterFoodPickerCat('all');
  $('foodPickerModal')?.classList.replace('hidden', 'flex');
  lucide.createIcons();
}

function closeFoodPickerModal() {
  $('foodPickerModal')?.classList.replace('flex', 'hidden');
  targetFoodPickerMealIdx = null;
}

function switchFoodPickerTab(tab) {
  currentFoodPickerTab = tab;
  const isLib = tab === 'library';
  $('fpLibrarySection')?.classList.toggle('hidden', !isLib);
  if ($('fpTabBtn-library')) {
    $('fpTabBtn-library').className = isLib 
      ? 'flex-1 py-2 text-xs font-bold rounded-xl bg-white text-emerald-700 shadow-sm transition'
      : 'flex-1 py-2 text-xs font-bold rounded-xl text-slate-600 hover:text-slate-900 transition';
  }
  if ($('fpTabBtn-custom')) {
    $('fpTabBtn-custom').className = !isLib 
      ? 'flex-1 py-2 text-xs font-bold rounded-xl bg-white text-emerald-700 shadow-sm transition'
      : 'flex-1 py-2 text-xs font-bold rounded-xl text-slate-600 hover:text-slate-900 transition';
  }
}

function filterFoodPickerCat(cat) {
  currentFoodPickerCat = cat;
  document.querySelectorAll('.fp-cat-chip').forEach(btn => {
    const isSelected = (cat === 'all' && btn.textContent.includes('هەمووی')) || btn.textContent.includes(cat);
    btn.className = isSelected
      ? 'fp-cat-chip px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 text-white'
      : 'fp-cat-chip px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200';
  });
  renderFoodPickerList();
}

function renderFoodPickerList() {
  const container = $('fpFoodsList');
  if (!container) return;
  const q = ($('fpSearchInput')?.value || '').toLowerCase().trim();
  const list = foodItems || [];
  const filtered = list.filter(f => {
    const matchQ = (f.Name || '').toLowerCase().includes(q) || (f.Category || '').toLowerCase().includes(q);
    if (!matchQ) return false;
    if (currentFoodPickerCat === 'all') return true;
    return (f.Category || '').toLowerCase().includes(currentFoodPickerCat.toLowerCase());
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">هیچ خواردنێک بەم گەڕانە نەدۆزرایەوە، دەتوانیت لە خوارەوە بە دەست بنووسیت</div>`;
    return;
  }

  container.innerHTML = filtered.map(f => `
    <div onclick='selectFoodFromPicker(${JSON.stringify(f).replace(/'/g, "&apos;")})' class="p-2.5 rounded-xl border border-slate-200/80 bg-white hover:bg-emerald-50/60 hover:border-emerald-300 cursor-pointer transition flex items-center justify-between gap-3 text-xs">
      <div class="min-w-0">
        <b class="text-slate-900 block truncate">${esc(f.Name)}</b>
        <div class="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
          <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">${esc(f.Category || 'خواردن')}</span>
          <span>پێوانە: ${esc(f.ServingSize || '100g')}</span>
        </div>
      </div>
      <div class="text-left shrink-0">
        <b class="font-mono text-emerald-700 block">${f.Calories} kcal</b>
        <span class="text-[10px] text-indigo-600 font-bold">${f.Protein ? f.Protein + 'g Pro' : ''}</span>
      </div>
    </div>
  `).join('');
}

function selectFoodFromPicker(f) {
  if ($('fpSelectedName')) $('fpSelectedName').value = f.Name;
  if ($('fpSelectedAmount')) $('fpSelectedAmount').value = f.ServingSize || '100g';
  if ($('fpSelectedCalories')) $('fpSelectedCalories').value = f.Calories || 0;
  if ($('fpSelectedProtein')) $('fpSelectedProtein').value = f.Protein ? `${f.Protein}g` : '';
}

function confirmAddFoodToMeal() {
  if (targetFoodPickerMealIdx === null) return;
  const name = $('fpSelectedName')?.value.trim();
  if (!name) {
    alert('تکایە ناوی خواردن بنووسە یان لە لیستەکە هەڵبژێرە!');
    $('fpSelectedName')?.focus();
    return;
  }
  const cal = Number($('fpSelectedCalories')?.value) || 0;
  const amount = $('fpSelectedAmount')?.value.trim() || '';
  const protein = $('fpSelectedProtein')?.value.trim() || '';

  if (!currentDietBuilderMeals[targetFoodPickerMealIdx].foods) {
    currentDietBuilderMeals[targetFoodPickerMealIdx].foods = [];
  }

  currentDietBuilderMeals[targetFoodPickerMealIdx].foods.push({
    name,
    amount,
    calories: cal,
    protein
  });

  currentDietBuilderMeals[targetFoodPickerMealIdx].calories = 
    (Number(currentDietBuilderMeals[targetFoodPickerMealIdx].calories) || 0) + cal;

  renderDietBuilderMeals();
  autoRecalcDietMacros();
  closeFoodPickerModal();
}

function removeFoodFromMeal(mIdx, fIdx) {
  if (currentDietBuilderMeals[mIdx] && currentDietBuilderMeals[mIdx].foods) {
    currentDietBuilderMeals[mIdx].foods.splice(fIdx, 1);
    renderDietBuilderMeals();
  }
}

// ==========================================
// پێوەر و کارتی نوێ بۆ ماکرۆکانی پلانی خۆراک (Dynamic Extra Macros)
// ==========================================
let currentDietExtraMacros = [];

function openAddMacroCardModal() {
  if ($('amcName')) $('amcName').value = '';
  if ($('amcTarget')) $('amcTarget').value = '';
  if ($('amcUnit')) $('amcUnit').value = '';
  if ($('amcColor')) $('amcColor').value = 'cyan';
  $('addMacroCardModal')?.classList.replace('hidden', 'flex');
}

function closeAddMacroCardModal() {
  $('addMacroCardModal')?.classList.replace('flex', 'hidden');
}

function fillMacroPreset(name, target, unit, icon, color) {
  if ($('amcName')) $('amcName').value = name;
  if ($('amcTarget')) $('amcTarget').value = target;
  if ($('amcUnit')) $('amcUnit').value = unit;
  if ($('amcColor')) $('amcColor').value = color || 'cyan';
}

function confirmAddMacroCard() {
  const name = $('amcName')?.value.trim();
  if (!name) {
    alert('تکایە ناوی پێوەر بنووسە!');
    $('amcName')?.focus();
    return;
  }
  const target = $('amcTarget')?.value.trim() || '1';
  const unit = $('amcUnit')?.value.trim() || '';
  const color = $('amcColor')?.value || 'cyan';

  currentDietExtraMacros.push({
    name,
    target,
    unit,
    color
  });

  renderDietExtraMacros();
  closeAddMacroCardModal();
}

function removeDietExtraMacro(idx) {
  currentDietExtraMacros.splice(idx, 1);
  renderDietExtraMacros();
}

function renderDietExtraMacros() {
  const container = $('dpbExtraMacrosContainer');
  if (!container) return;
  if (!currentDietExtraMacros.length) {
    container.innerHTML = '';
    return;
  }

  const colorMap = {
    cyan: { bg: 'bg-cyan-50/80', border: 'border-cyan-200', text: 'text-cyan-950', badge: 'text-cyan-600' },
    emerald: { bg: 'bg-emerald-50/80', border: 'border-emerald-200', text: 'text-emerald-950', badge: 'text-emerald-600' },
    purple: { bg: 'bg-purple-50/80', border: 'border-purple-200', text: 'text-purple-950', badge: 'text-purple-600' },
    amber: { bg: 'bg-amber-50/80', border: 'border-amber-200', text: 'text-amber-950', badge: 'text-amber-600' },
    rose: { bg: 'bg-rose-50/80', border: 'border-rose-200', text: 'text-rose-950', badge: 'text-rose-600' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900', badge: 'text-slate-600' }
  };

  container.innerHTML = currentDietExtraMacros.map((m, idx) => {
    const c = colorMap[m.color] || colorMap.cyan;
    return `
      <div class="p-4 ${c.bg} rounded-2xl border ${c.border} relative group">
        <button type="button" onclick="removeDietExtraMacro(${idx})" class="absolute top-2 left-2 p-1 text-slate-400 hover:text-rose-600 rounded-lg transition" title="سڕینەوەی ئەم پێوەرە">
          <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
        <label class="block text-xs font-bold ${c.text} mb-1 flex items-center justify-between">
          <span class="truncate">${esc(m.name)}</span>
          <span class="text-[10px] ${c.badge} font-mono">${esc(m.unit)}</span>
        </label>
        <input type="text" value="${esc(m.target)}" onchange="currentDietExtraMacros[${idx}].target = this.value" class="w-full border ${c.border} rounded-xl p-2.5 font-mono font-black text-lg ${c.text} bg-white">
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function autoRecalcDietMacros() {
  let totalCal = 0;
  currentDietBuilderMeals.forEach(m => {
    totalCal += Number(m.calories) || 0;
  });
  if (totalCal > 0 && $('dpbTotalCalories')) {
    $('dpbTotalCalories').value = totalCal;
  }
}

async function saveDietPlanBuilderUI() {
  const planName = $('dpbPlanName')?.value.trim();
  if (!planName) {
    alert('تکایە ناوی پلانی خۆراک بنووسە!');
    $('dpbPlanName')?.focus();
    return;
  }

  const payload = {
    DietPlanId: $('dpbPlanId')?.value || undefined,
    PlanId: $('dpbPlanId')?.value || undefined,
    PlanName: planName,
    Goal: $('dpbGoal')?.value || 'دابەزاندنی کێش',
    Description: $('dpbDescription')?.value || '',
    TargetCalories: Number($('dpbTotalCalories')?.value) || 2000,
    TotalCalories: Number($('dpbTotalCalories')?.value) || 2000,
    ProteinGrams: Number($('dpbProteinGrams')?.value) || 150,
    CarbsGrams: Number($('dpbCarbsGrams')?.value) || 180,
    FatGrams: Number($('dpbFatsGrams')?.value) || 50,
    FatsGrams: Number($('dpbFatsGrams')?.value) || 50,
    MealsJson: JSON.stringify(currentDietBuilderMeals),
    ExtraMacrosJson: JSON.stringify(currentDietExtraMacros)
  };

  try {
    await call('saveDietPlan', payload);
    alert('سیستەمی خۆراک بە سەرکەوتوویی لە ناو فایلی Excel پاشەکەوت کرا!');
    dietPlans = await call('getDietPlans');
    showDietPlansListView();
  } catch(err) {
    alert('هەڵە لە پاشەکەوتکردن: ' + (err.message || err));
  }
}

async function removeDietPlan(id) {
  if (!confirm(`ئایا دڵنیایت لە سڕینەوەی ئەم سیستەمەی خۆراک؟`)) return;
  try {
    await call('deleteDietPlan', id);
    dietPlans = await call('getDietPlans');
    renderDietPlans();
    alert('سیستەمی خۆراک سڕایەوە');
  } catch(err) {
    alert('هەڵە: ' + err.message);
  }
}

function viewDietPlanModal(dp) {
  let meals = [];
  try { meals = JSON.parse(dp.MealsJson || '[]'); } catch(e){}
  const isEn = currentAppLanguage === 'en';

  $('modalTitle').textContent = isEn ? `Diet Plan: ${dp.PlanName}` : `سیستەمی خۆراک: ${dp.PlanName}`;
  $('modalBody').innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
        <div>
          <b class="text-sm text-emerald-900 block font-bold">${esc(dp.Goal || (isEn ? 'Balanced' : 'هاوسەنگ'))}</b>
          <p class="text-xs text-emerald-700 mt-0.5">${esc(dp.Description || (isEn ? 'Daily Guidelines' : 'ڕێنمایی ڕۆژانە'))}</p>
        </div>
        <div class="text-left font-mono">
          <span class="text-xs text-slate-500 block">${isEn ? 'Total Calories:' : 'کۆی کالۆری:'}</span>
          <b class="text-xl font-black text-emerald-700">${dp.TargetCalories || 0} kcal</b>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2 text-center p-3 bg-slate-50 rounded-2xl border text-xs">
        <div>
          <span class="text-slate-400 block">${isEn ? 'Protein' : 'پرۆتین'}</span>
          <b class="text-indigo-600 font-bold">${dp.ProteinGrams || 0} g</b>
        </div>
        <div>
          <span class="text-slate-400 block">${isEn ? 'Carbs' : 'کاربۆهیدرات'}</span>
          <b class="text-amber-600 font-bold">${dp.CarbsGrams || 0} g</b>
        </div>
        <div>
          <span class="text-slate-400 block">${isEn ? 'Fats' : 'چەوری'}</span>
          <b class="text-rose-600 font-bold">${dp.FatGrams || 0} g</b>
        </div>
      </div>

      <div class="space-y-2">
        <h4 class="font-bold text-xs text-slate-700">${isEn ? 'Daily Meals' : 'ژەمەکانی ڕۆژ'} (${meals.length}):</h4>
        ${meals.map(m => `
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
            <div class="flex justify-between items-center">
              <b class="text-slate-900 font-bold">${esc(m.mealName || m.name || (isEn ? 'Meal' : 'ژەم'))}</b>
              <span class="font-mono text-emerald-700 font-bold">${m.calories || 0} kcal | ${esc(m.time || '')}</span>
            </div>
            <p class="text-slate-600 text-[11px]">${esc(m.foods || '')}</p>
          </div>
        `).join('')}
      </div>

      <div class="text-left pt-2">
        <button onclick="closeModal()" class="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold transition">${isEn ? 'Close' : 'داخستن'}</button>
      </div>
    </div>
  `;
  $('modal').classList.replace('hidden', 'flex');
}

function onDietPlanChange() {
  const sel = $('mDietSelect');
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  if ($('mDietPlanId')) {
    $('mDietPlanId').value = opt?.dataset.id || '';
  }
}

// ==========================================
// داهات و خەرجی (Finances: Tabs, Filters, Recurring, Comparison)
// ==========================================
let currentFinanceFilter = 'all';
let currentFinanceTab = 'expenses';
let financeChartInstance = null;

function switchFinanceTab(tab) {
  currentFinanceTab = tab;
  ['expenses', 'members', 'sales', 'comparison'].forEach(t => {
    $(`ftab-${t}`)?.classList.toggle('hidden', t !== tab);
    const btn = $(`ftab-btn-${t}`);
    if (btn) {
      if (t === tab) {
        btn.className = 'px-4 py-2 rounded-xl text-xs md:text-sm font-bold bg-white text-indigo-600 shadow-sm border border-slate-200 flex items-center gap-2';
      } else {
        btn.className = 'px-4 py-2 rounded-xl text-xs md:text-sm font-semibold text-slate-600 hover:bg-white/60 flex items-center gap-2';
      }
    }
  });

  if (tab === 'comparison') {
    renderFinanceComparisonChart();
  }
}

function setFinanceFilter(f) {
  currentFinanceFilter = f;
  ['today', 'month', 'year', 'all'].forEach(k => {
    const btn = $(`fBtn-${k}`);
    if (btn) {
      if (k === f) {
        btn.className = 'f-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow transition';
      } else {
        btn.className = 'f-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
      }
    }
    const cbtn = $(`cBtn-${k}`);
    if (cbtn) {
      if (k === f) {
        cbtn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow transition';
      } else {
        cbtn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-white transition';
      }
    }
  });
  renderFinances();
}

async function renderFinances() {
  try {
    const fin = await call('getFinancialAnalytics', currentFinanceFilter);
    if ($('fSubRev')) $('fSubRev').textContent = (fin.subRevenue || 0).toLocaleString() + ' IQD';
    if ($('fStoreRev')) $('fStoreRev').textContent = (fin.storeRevenue || 0).toLocaleString() + ' IQD';
    if ($('fExpenses')) $('fExpenses').textContent = (fin.totalExpenses || 0).toLocaleString() + ' IQD';

    const netProfit = fin.netProfit || 0;
    const isProfit = netProfit >= 0;
    const isEn = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en');

    if ($('fNetProfit')) {
      $('fNetProfit').className = `text-2xl font-black mt-3 ${isProfit ? 'text-emerald-700' : 'text-rose-700'} flex items-center gap-1.5`;
    }

    if ($('fNetProfitValue')) {
      $('fNetProfitValue').textContent = Math.abs(netProfit).toLocaleString() + ' IQD';
      $('fNetProfitValue').className = isProfit ? 'text-emerald-700' : 'text-rose-700';
    } else if ($('fNetProfit')) {
      $('fNetProfit').textContent = (isProfit ? '' : '-') + Math.abs(netProfit).toLocaleString() + ' IQD';
    }

    if ($('fNetProfitArrowSymbol')) {
      $('fNetProfitArrowSymbol').textContent = isProfit ? '↑' : '↓';
      $('fNetProfitArrowSymbol').className = isProfit ? 'text-2xl font-black text-emerald-600' : 'text-2xl font-black text-rose-600';
    }

    if ($('fNetProfitCard')) {
      $('fNetProfitCard').className = `rounded-3xl p-5 shadow-sm border-2 ${isProfit ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/90' : 'border-rose-300 bg-gradient-to-br from-rose-50/90 via-white to-red-50/90'} relative overflow-hidden transition-all duration-300`;
    }

    if ($('fNetProfitArrowBadge')) {
      $('fNetProfitArrowBadge').className = `p-2.5 rounded-2xl ${isProfit ? 'bg-emerald-600 shadow-emerald-600/30' : 'bg-rose-600 shadow-rose-600/30'} text-white shadow-md flex items-center justify-center transition-all`;
      $('fNetProfitArrowBadge').innerHTML = `<i data-lucide="${isProfit ? 'trending-up' : 'trending-down'}" id="fNetProfitIcon" class="w-5 h-5"></i>`;
    }

    if ($('fNetProfitStatus')) {
      $('fNetProfitStatus').textContent = isProfit 
        ? (isEn ? '+ Net Profit (Revenue exceeds expenses)' : '+ قازانجی پوخت (داهات زیاترە)') 
        : (isEn ? '- Net Loss (Expenses exceed revenue)' : '- زیانی پوخت (خەرجی زیاترە)');
      $('fNetProfitStatus').className = `text-[11px] font-bold mt-1 ${isProfit ? 'text-emerald-700' : 'text-rose-700'}`;
    }

    if ($('compTotalIncome')) $('compTotalIncome').textContent = ((fin.subRevenue || 0) + (fin.storeRevenue || 0)).toLocaleString() + ' IQD';
    if ($('compTotalExpenses')) $('compTotalExpenses').textContent = (fin.totalExpenses || 0).toLocaleString() + ' IQD';
    if ($('compNetProfit')) $('compNetProfit').textContent = (fin.netProfit || 0).toLocaleString() + ' IQD';

    // Expenses list
    const expList = fin.expensesList || [];
    let totalExpQty = 0;
    let totalExpAmount = 0;

    $('expenseRows').innerHTML = expList.length ? expList.map(e => {
      const amt = Number(e.Amount) || 0;
      const qty = Number(e.Quantity) || 0;
      const uPrice = Number(e.UnitPrice) || 0;
      const uType = e.UnitType || (qty > 0 ? 'دانە' : 'گشتی / مقطوع');
      totalExpAmount += amt;
      totalExpQty += qty;

      return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 font-bold text-slate-900">${esc(e.Title)}</td>
        <td class="p-3"><span class="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600 font-medium">${esc(e.Category)}</span></td>
        <td class="p-3"><span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-bold">${esc(uType)}</span></td>
        <td class="p-3 font-mono font-bold text-slate-700">${qty > 0 ? qty.toLocaleString() : '-'}</td>
        <td class="p-3 font-mono text-slate-600">${uPrice > 0 ? uPrice.toLocaleString() + ' IQD' : '-'}</td>
        <td class="p-3 font-mono font-bold text-rose-600">${amt.toLocaleString()} IQD</td>
        <td class="p-3">
          ${e.IsRecurring === 'Yes' 
            ? (isEn 
                ? `<span class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[11px] font-bold">Recurring (${esc(e.Recurrence || 'Monthly')})</span>` 
                : `<span class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[11px] font-bold">دووبارە (${esc(e.Recurrence || 'مانگانە')})</span>`) 
            : (isEn ? '<span class="text-slate-400 text-xs">One-time</span>' : '<span class="text-slate-400 text-xs">یەکجار</span>')}
        </td>
        <td class="p-3 text-slate-500 text-xs">${fmt(e.Date)}</td>
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="editExpense('${esc(e.Id)}')" class="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1 transition">
              <i data-lucide="edit-3" class="w-3 h-3"></i>
              <span>${isEn ? 'Edit' : 'دەستکاری'}</span>
            </button>
            <button onclick="removeExpense('${esc(e.Id)}')" class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1 transition">
              <i data-lucide="trash-2" class="w-3 h-3"></i>
              <span>${isEn ? 'Delete' : 'سڕینەوە'}</span>
            </button>
          </div>
        </td>
      </tr>
      `;
    }).join('') : `<tr><td colspan="9" class="p-4 text-center text-slate-400">${isEn ? 'No expenses recorded in this period' : 'هیچ خەرجییەک لەم ماوەیەدا نییە'}</td></tr>`;

    // Update Expenses footer
    if ($('expTotalCount')) $('expTotalCount').textContent = `${expList.length} ${isEn ? 'expenses' : 'خەرجی'}`;
    if ($('expTotalQty')) $('expTotalQty').textContent = `${totalExpQty.toLocaleString()} ${isEn ? 'items' : 'دانە'}`;
    if ($('expTotalAmount')) $('expTotalAmount').textContent = `${totalExpAmount.toLocaleString()} IQD`;

    // Member Revenues list
    const memList = fin.memberIncomeList || [];
    let totalMemBasePrice = 0;
    let totalMemDiscount = 0;
    let totalMemPaidAmount = 0;

    $('memberIncomeRows').innerHTML = memList.length ? memList.map(m => {
      const basePrice = Number(m.SubscriptionPrice || 0);
      const discount = Number(m.Discount || 0);
      const paid = Number(m.FinalPrice !== '' && m.FinalPrice !== undefined ? m.FinalPrice : basePrice);
      totalMemBasePrice += basePrice;
      totalMemDiscount += discount;
      totalMemPaidAmount += paid;

      return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 font-mono font-bold text-indigo-600">${esc(m.MemberCode)}</td>
        <td class="p-3 font-bold text-slate-800">${esc(m.FullName)}</td>
        <td class="p-3"><span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold">${esc(m.SubscriptionType || (isEn ? 'Monthly' : 'مانگانە'))}</span></td>
        <td class="p-3 font-semibold text-slate-600 font-mono">${basePrice.toLocaleString()} IQD</td>
        <td class="p-3 text-emerald-600 font-semibold font-mono">${discount.toLocaleString()} IQD</td>
        <td class="p-3 font-bold text-emerald-700 font-mono">${paid.toLocaleString()} IQD</td>
        <td class="p-3 text-slate-500 text-xs">${fmt(m.StartDate)}</td>
      </tr>
      `;
    }).join('') : `<tr><td colspan="7" class="p-4 text-center text-slate-400">${isEn ? 'No membership revenue recorded' : 'هیچ داهاتێکی بەشداربوو تۆمار نەکراوە'}</td></tr>`;

    // Update Member Income footer
    if ($('memTotalCount')) $('memTotalCount').textContent = `${memList.length} ${isEn ? 'members' : 'بەشداربوو'}`;
    if ($('memTotalBasePrice')) $('memTotalBasePrice').textContent = `${totalMemBasePrice.toLocaleString()} IQD`;
    if ($('memTotalDiscount')) $('memTotalDiscount').textContent = `${totalMemDiscount.toLocaleString()} IQD`;
    if ($('memTotalPaidAmount')) $('memTotalPaidAmount').textContent = `${totalMemPaidAmount.toLocaleString()} IQD`;

    // Store Sales list
    const sales = fin.salesList || [];
    let totalSalesQty = 0;
    let totalSalesAmount = 0;

    $('salesHistoryRows').innerHTML = sales.length ? sales.map(s => {
      const qty = Number(s.Quantity) || 0;
      const total = Number(s.TotalPrice) || 0;
      totalSalesQty += qty;
      totalSalesAmount += total;

      return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3 font-bold text-slate-900">${esc(s.ItemName)}</td>
        <td class="p-3 text-slate-600">${esc(s.CustomerName || (isEn ? 'Cash' : 'کاش'))}</td>
        <td class="p-3 font-mono font-bold text-indigo-700">${qty}</td>
        <td class="p-3 text-slate-600 font-mono">${Number(s.UnitPrice || 0).toLocaleString()} IQD</td>
        <td class="p-3 font-bold text-emerald-600 font-mono">${total.toLocaleString()} IQD</td>
        <td class="p-3 text-slate-500 text-xs">${fmt(s.Date)}</td>
      </tr>
      `;
    }).join('') : `<tr><td colspan="6" class="p-4 text-center text-slate-400">${isEn ? 'No store sales recorded' : 'هیچ فرۆشتنێک تۆمار نەکراوە'}</td></tr>`;

    // Update Store Sales footer
    if ($('salesTotalCount')) $('salesTotalCount').textContent = `${sales.length} ${isEn ? 'sales' : 'فرۆش'}`;
    if ($('salesTotalQty')) $('salesTotalQty').textContent = `${totalSalesQty.toLocaleString()} ${isEn ? 'items' : 'دانە'}`;
    if ($('salesTotalAmount')) $('salesTotalAmount').textContent = `${totalSalesAmount.toLocaleString()} IQD`;

    // Recurring expenses list
    const recList = expenses.filter(e => e.IsRecurring === 'Yes');
    if ($('recurringExpensesList')) {
      $('recurringExpensesList').innerHTML = recList.length ? recList.map(r => `
        <div class="flex justify-between items-center p-2 rounded-xl bg-amber-100/60 border border-amber-200/80 text-[11px]">
          <div>
            <b class="text-amber-950">${esc(r.Title)}</b>
            <span class="block text-amber-700 text-[10px]">${isEn ? 'Amount:' : 'بڕ:'} ${Number(r.Amount).toLocaleString()} IQD (${esc(r.Recurrence || (isEn ? 'Monthly' : 'مانگانە'))})</span>
          </div>
          <span class="px-2 py-0.5 rounded bg-white text-amber-900 font-mono font-bold">${fmt(r.NextDueDate || r.Date)}</span>
        </div>
      `).join('') : `<span class="text-slate-400 text-[11px]">${isEn ? 'No recurring expenses scheduled' : 'هیچ خەرجییەکی دووبارەبووەوە دیاری نەکراوە'}</span>`;
    }

    if (currentFinanceTab === 'comparison') {
      renderFinanceComparisonChart(fin.monthlyTrends);
    }
    renderFinancialAdvice(fin);
    if (window.lucide) lucide.createIcons();
  } catch(e) {
    console.error('renderFinances error:', e);
  }
}

function renderFinanceComparisonChart(trends = null) {
  const canvas = $('financeComparisonChart');
  if (!canvas) return;
  const isEn = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en');

  if (financeChartInstance) {
    financeChartInstance.destroy();
  }

  const defaultTrends = [
    { month: '2026-05', income: 1800000, expenses: 650000, profit: 1150000 },
    { month: '2026-06', income: 2400000, expenses: 700000, profit: 1700000 },
    { month: '2026-07', income: 2900000, expenses: 800000, profit: 2100000 },
    { month: '2026-08', income: 3200000, expenses: 850000, profit: 2350000 },
    { month: '2026-09', income: 3600000, expenses: 950000, profit: 2650000 }
  ];

  const data = trends && trends.length ? trends : defaultTrends;

  financeChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.month),
      datasets: [
        {
          label: isEn ? 'Total Revenue (Subs + Store)' : 'کۆی داهات (داهات + فرۆشتن)',
          data: data.map(d => d.income),
          backgroundColor: 'rgba(99, 102, 241, 0.85)',
          borderRadius: 8
        },
        {
          label: isEn ? 'Total Expenses' : 'مەسروفات (خەرجییەکان)',
          data: data.map(d => d.expenses),
          backgroundColor: 'rgba(244, 63, 94, 0.85)',
          borderRadius: 8
        },
        {
          label: isEn ? 'Net Profit / Loss' : 'داهاتی پوخت (قازانج)',
          data: data.map(d => d.profit),
          type: 'line',
          borderColor: '#10b981',
          borderWidth: 3,
          fill: false,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top', rtl: !isEn }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function renderFinancialAdvice(fin) {
  const container = $('finAdviceList');
  const badge = $('finHealthBadge');
  if (!container) return;
  const isEn = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en');

  const totalIncome = (fin.subRevenue || 0) + (fin.storeRevenue || 0);
  const totalExpenses = (fin.totalExpenses || 0);
  const netProfit = (fin.netProfit || 0);
  const margin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;
  const storePercent = totalIncome > 0 ? Math.round(((fin.storeRevenue || 0) / totalIncome) * 100) : 0;
  const expRatio = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;

  // Set Health Badge
  if (badge) {
    if (netProfit > 0 && margin >= 50) {
      badge.textContent = isEn ? `Health: Excellent (Margin ${margin}%)` : `تەندروستی: نایاب (قازانج ${margin}%)`;
      badge.className = 'text-xs font-black px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    } else if (netProfit > 0 && margin >= 20) {
      badge.textContent = isEn ? `Health: Good (Margin ${margin}%)` : `تەندروستی: باش (قازانج ${margin}%)`;
      badge.className = 'text-xs font-black px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40';
    } else if (netProfit > 0) {
      badge.textContent = isEn ? `Health: Moderate (Margin ${margin}%)` : `تەندروستی: مامناوەند (قازانج ${margin}%)`;
      badge.className = 'text-xs font-black px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40';
    } else {
      badge.textContent = isEn ? 'Health: Needs Attention' : 'تەندروستی: پێویستی بە چاوخشاندنەوەیە';
      badge.className = 'text-xs font-black px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40';
    }
  }

  const adviceItems = [];

  // 1. Profit Margin & Overhead
  if (margin >= 50) {
    adviceItems.push({
      icon: 'trending-up',
      color: 'emerald',
      title: isEn ? 'Profit Margin is Excellent' : 'ڕێژەی قازانج لە ئاستێکی نایابە',
      desc: isEn ? `Net profit margin is ${margin}% of total revenue. Operating expenses are well-managed and business is growing.` : `ڕێژەی قازانجی پوخت %${margin}یە لە کۆی داهات. تێچووەکانت زۆر باش کۆنترۆڵ کراون و پڕۆژەکەت لە گەشەسەندندایە.`
    });
  } else if (margin >= 20) {
    adviceItems.push({
      icon: 'shield-alert',
      color: 'amber',
      title: isEn ? 'Profit Margin is Moderate' : 'ڕێژەی قازانج لە ئاستی مامناوەندە',
      desc: isEn ? `Profit margin is ${margin}%. Expenses represent ${expRatio}% of revenue. Review utilities and supplier costs to optimize cash flow.` : `ڕێژەی قازانج %${margin}یە. مەسروفات %${expRatio}ی کۆی داهات پێکدەهێنێت. پێداچوونەوە بە خەرجی کارەبا و کڕینی پێداویستییەکان بکە.`
    });
  } else {
    adviceItems.push({
      icon: 'alert-triangle',
      color: 'rose',
      title: isEn ? 'Warning: High Operating Expenses' : 'ئاگاداری: خەرجییەکان زۆر بەرزن',
      desc: isEn ? `Expenses are close to danger line (${expRatio}% of revenue). Reduce non-essential expenses or consider adjusting membership prices.` : `خەرجییەکان لە سنووری سوور نزیکن (%${expRatio}ی داهات). پێویستە خەرجییە ناپێویستەکان کەم بکرێنەوە یان نرخی ئابوونەکان بەرز بکرێتەوە.`
    });
  }

  // 2. Store vs Subscriptions
  if (storePercent < 20) {
    adviceItems.push({
      icon: 'shopping-bag',
      color: 'indigo',
      title: isEn ? 'Boost Store & POS Revenue' : 'فەرامۆشنەکردنی داهاتی فرۆشگا',
      desc: isEn ? `Store sales only represent ${storePercent}% of total revenue. Stocking protein supplements, vitamins, and energy drinks can boost store profit to over 30%.` : `فرۆشگا تەنها %${storePercent}ی داهاتی هۆڵ پێکدەهێنێت. هێنانی پرۆتین، ڤیتامین و ئاوی کانزایی دەتوانێت قازانجی فرۆشگا بۆ سەروو %٣٠ زیاد بکات.`
    });
  } else {
    adviceItems.push({
      icon: 'sparkles',
      color: 'emerald',
      title: isEn ? 'Store Revenue is Strong' : 'داهاتی فرۆشگا بەهێزە',
      desc: isEn ? `Store contributes a healthy ${storePercent}% of total revenue. Offering combo packages with long-term memberships will further increase sales.` : `فرۆشگای هۆڵ بەشدارییەکی زۆر باشی هەیە (%${storePercent}ی داهات). دابینکردنی داشکاندن بۆ کڕینی پاکێج و بەشدارییە درێژخایەنەکان ئەنجامی باشتری دەبێت.`
    });
  }

  // 3. Members Retention & Recurring Income
  adviceItems.push({
    icon: 'users',
    color: 'sky',
    title: isEn ? 'Member Retention Tip' : 'پێشنیار بۆ بەشداربووان',
    desc: isEn ? 'Offering 3-month renewal discounts ahead of subscription expiration encourages early renewals and prevents churn.' : 'دانانی ئۆفەری ٣ مانگە و داشکاندنی تایبەت لە بەرواری بەسەرچوونی ئابوونەکاندا، بەشداربووان هاندەدات پێشوەختە پارە نوێ بکەنەوە.'
  });

  container.innerHTML = adviceItems.map(item => `
    <div class="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1.5 hover:bg-white/15 transition">
      <div class="flex items-center gap-2">
        <span class="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
          <i data-lucide="${item.icon}" class="w-4 h-4"></i>
        </span>
        <b class="text-xs font-bold text-white">${esc(item.title)}</b>
      </div>
      <p class="text-[11px] text-slate-300 leading-relaxed">${esc(item.desc)}</p>
    </div>
  `).join('');
  lucide.createIcons();
}

function openExpenseModal(exp = {}) {
  const isEn = currentAppLanguage === 'en';
  const isEdit = Boolean(exp.Id);
  $('modalTitle').textContent = isEdit 
    ? (isEn ? `Edit Expense: ${exp.Title}` : `دەستکاریکردنی مەسروفات: ${exp.Title}`) 
    : (isEn ? '+ Record New Expense' : 'تۆمارکردنی مەسروفاتی نوێ');

  const unitType = exp.UnitType || 'گشتی';
  const isUnitItem = unitType !== 'گشتی';

  $('modalBody').innerHTML = `
    <form onsubmit="saveExpenseUI(event)" class="space-y-4">
      <input type="hidden" name="Id" value="${esc(exp.Id || '')}">
      <div>
        <label class="block text-sm font-semibold mb-1">${isEn ? 'Expense Title *' : 'ناونیشانی خەرجی *'}</label>
        <input name="Title" value="${esc(exp.Title || '')}" required class="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="${isEn ? 'e.g. Monthly rent, electricity bill, supplies purchase' : 'بۆ نموونە: کرێی مانگانە، پسوڵەی کارەبا، کڕینی پێداویستی'}">
      </div>

      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-semibold mb-1">${isEn ? 'Category' : 'پۆل / بەش'}</label>
          <select name="Category" class="w-full border rounded-xl p-3 font-semibold text-sm">
            <option value="کڕینی کاڵا و پێداویستی" ${exp.Category === 'کڕینی کاڵا و پێداویستی' ? 'selected' : ''}>${isEn ? 'Supplies & Items Purchase' : 'کڕینی کاڵا و پێداویستی'}</option>
            <option value="کرێی شوێن" ${exp.Category === 'کرێی شوێن' ? 'selected' : ''}>${isEn ? 'Gym Rent' : 'کرێی هۆڵ / شوێن'}</option>
            <option value="کارەبا و مۆلیدە" ${exp.Category === 'کارەبا و مۆلیدە' ? 'selected' : ''}>${isEn ? 'Electricity & Generator' : 'کارەبا و مۆلیدە'}</option>
            <option value="مووچەی کارمەندان" ${exp.Category === 'مووچەی کارمەندان' ? 'selected' : ''}>${isEn ? 'Staff Payroll' : 'مووچەی کارمەندان'}</option>
            <option value="ئاو و خزمەتگوزاری" ${exp.Category === 'ئاو و خزمەتگوزاری' ? 'selected' : ''}>${isEn ? 'Water & Utilities' : 'ئاو و خزمەتگوزاری'}</option>
            <option value="چاککردنەوەی ئامێرەکان" ${exp.Category === 'چاککردنەوەی ئامێرەکان' ? 'selected' : ''}>${isEn ? 'Equipment Maintenance' : 'چاککردنەوەی ئامێرەکان'}</option>
            <option value="دیکۆرات و بیناسازی" ${exp.Category === 'دیکۆرات و بیناسازی' ? 'selected' : ''}>${isEn ? 'Decoration & Renovation' : 'دیکۆرات و بیناسازی'}</option>
            <option value="گشتی" ${(!exp.Category || exp.Category === 'گشتی') ? 'selected' : ''}>${isEn ? 'General' : 'گشتی'}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">${isEn ? 'Expense / Packaging Type' : 'جۆری یەکە / پێوانە'}</label>
          <select id="expUnitTypeSelect" name="UnitType" onchange="toggleExpenseUnitFields(this.value)" class="w-full border rounded-xl p-3 font-semibold text-sm">
            <option value="گشتی" ${unitType === 'گشتی' ? 'selected' : ''}>${isEn ? 'Fixed / Bill (Rent, Electricity, Payroll...)' : 'گشتی / مقطوع (کرێ، کارەبا، مووچە، خزمەتگوزاری...)'}</option>
            <option value="دانە" ${unitType === 'دانە' ? 'selected' : ''}>${isEn ? 'By Piece (دانە)' : 'بەپێی دانە (Piece)'}</option>
            <option value="پاکەت" ${unitType === 'پاکەت' ? 'selected' : ''}>${isEn ? 'By Packet (پاکەت)' : 'بەپێی پاکەت (Packet)'}</option>
            <option value="سێت" ${unitType === 'سێت' ? 'selected' : ''}>${isEn ? 'By Set (سێت)' : 'بەپێی سێت (Set)'}</option>
            <option value="کارتۆن" ${unitType === 'کارتۆن' ? 'selected' : ''}>${isEn ? 'By Carton (کارتۆن)' : 'بەپێی کارتۆن (Carton)'}</option>
          </select>
        </div>
      </div>

      <!-- خانەکانی ژمارە و نرخی تاک (تەنها بۆ کاڵاکان) -->
      <div id="expUnitCalcFields" class="${isUnitItem ? '' : 'hidden'} p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl grid sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">${isEn ? 'Quantity / Count *' : 'ژمارە / دانە *'}</label>
          <input id="expQuantityInput" name="Quantity" type="number" min="1" value="${Number(exp.Quantity) || 1}" oninput="calcExpenseTotal()" class="w-full border rounded-xl p-2.5 text-sm bg-white font-bold" placeholder="1">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">${isEn ? 'Unit Price (IQD) *' : 'نرخی هەر یەک دانە / پاکەت (IQD) *'}</label>
          <input id="expUnitPriceInput" name="UnitPrice" type="number" min="0" value="${Number(exp.UnitPrice) || ''}" oninput="calcExpenseTotal()" class="w-full border rounded-xl p-2.5 text-sm bg-white font-bold" placeholder="10000">
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1">${isEn ? 'Total Amount (IQD) *' : 'کۆی گشتی خەرجی (IQD) *'}</label>
        <input id="expAmountInput" name="Amount" type="number" required value="${Number(exp.Amount) || ''}" class="w-full border rounded-xl p-3 font-black text-rose-700 text-base" placeholder="50000">
      </div>

      <!-- خەرجی دووبارەبووەوە (Recurring) -->
      <div class="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="expIsRecurring" name="IsRecurring" value="Yes" ${exp.IsRecurring === 'Yes' || exp.IsRecurring === true ? 'checked' : ''} onchange="$('recurringOptions').classList.toggle('hidden', !this.checked)" class="w-4 h-4 text-amber-600 rounded">
          <span class="text-xs font-bold text-amber-900">${isEn ? 'This is a recurring expense (like rent, salary, internet)' : 'ئەمە خەرجییەکی دووبارەبووەوەیە (وەک کرێ، مووچە، ئینتەرنێت)'}</span>
        </label>
        <div id="recurringOptions" class="${exp.IsRecurring === 'Yes' || exp.IsRecurring === true ? '' : 'hidden'} grid grid-cols-2 gap-2 pt-1 text-xs">
          <div>
            <label class="block text-slate-600 mb-1">${isEn ? 'Recurrence Interval:' : 'ماوەی دووبارەبوونەوە:'}</label>
            <select name="Recurrence" class="w-full border rounded-xl p-2 bg-white font-semibold">
              <option value="مانگانە" ${exp.Recurrence === 'مانگانە' ? 'selected' : ''}>${isEn ? 'Monthly' : 'مانگانە (Monthly)'}</option>
              <option value="ساڵانە" ${exp.Recurrence === 'ساڵانە' ? 'selected' : ''}>${isEn ? 'Yearly' : 'ساڵانە (Yearly)'}</option>
              <option value="هەفتانە" ${exp.Recurrence === 'هەفتانە' ? 'selected' : ''}>${isEn ? 'Weekly' : 'هەفتانە (Weekly)'}</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-600 mb-1">${isEn ? 'Next Due Date:' : 'بەرواری وادەی داهاتوو:'}</label>
            <input name="NextDueDate" type="date" value="${exp.NextDueDate ? String(exp.NextDueDate).slice(0, 10) : ''}" class="w-full border rounded-xl p-2 bg-white">
          </div>
        </div>
      </div>

      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-semibold mb-1">${isEn ? 'Date' : 'بەروار'}</label>
          <input name="Date" type="date" value="${exp.Date ? String(exp.Date).slice(0, 10) : new Date().toISOString().slice(0, 10)}" class="w-full border rounded-xl p-3 text-sm">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">${isEn ? 'Notes' : 'تێبینی'}</label>
          <input name="Note" value="${esc(exp.Note || '')}" class="w-full border rounded-xl p-3 text-sm" placeholder="${isEn ? 'Additional notes...' : 'تێبینی زیاتر...'}">
        </div>
      </div>

      <div class="pt-3 flex gap-3">
        <button type="submit" class="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold p-3.5 rounded-xl transition shadow-lg shadow-rose-600/25">${isEdit ? (isEn ? 'Update Expense' : 'نوێکردنەوەی خەرجی') : (isEn ? 'Save Expense' : 'پاشەکەوتکردنی خەرجی')}</button>
        <button type="button" onclick="closeModal()" class="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition">${isEn ? 'Close' : 'داخستن'}</button>
      </div>
    </form>
  `;
  $('modal').classList.replace('hidden', 'flex');
  lucide.createIcons();
}

function toggleExpenseUnitFields(val) {
  const isUnitItem = val !== 'گشتی';
  const container = $('expUnitCalcFields');
  if (container) container.classList.toggle('hidden', !isUnitItem);
  calcExpenseTotal();
}

function calcExpenseTotal() {
  const unitSelect = $('expUnitTypeSelect');
  if (!unitSelect || unitSelect.value === 'گشتی') return;
  const qty = Number($('expQuantityInput')?.value) || 1;
  const unitPrice = Number($('expUnitPriceInput')?.value) || 0;
  if ($('expAmountInput') && unitPrice > 0) {
    $('expAmountInput').value = qty * unitPrice;
  }
}

function editExpense(id) {
  const exp = expenses.find(e => String(e.Id).trim() === String(id).trim());
  if (!exp) {
    alert(currentAppLanguage === 'en' ? 'Expense not found' : 'ئەم مەسروفاتە نەدۆزرایەوە');
    return;
  }
  openExpenseModal(exp);
}

async function saveExpenseUI(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    await call('saveExpense', data);
    closeModal();
    await loadAll();
    alert(currentAppLanguage === 'en' ? 'Expense successfully saved to Excel!' : 'مەسروفات بە سەرکەوتوویی لە Excel پاشەکەوتکرا!');
  } catch (err) {
    alert('هەڵە: ' + err.message);
  }
}

async function removeExpense(id) {
  if (!confirm(currentAppLanguage === 'en' ? 'Are you sure you want to delete this expense?' : 'ئایا دڵنیایت لە سڕینەوەی ئەم مەسروفاتە؟')) return;
  try {
    await call('deleteExpense', id);
    await loadAll();
  } catch (err) {
    alert('هەڵە: ' + err.message);
  }
}

// ==========================================
// فرۆشگا بە سێکشن و بارکۆد سکانەر (Store & Barcode POS)
// ==========================================
let currentStoreCatFilter = 'all';
let currentStoreMainTab = 'items';

function switchStoreTab(tab) {
  currentStoreMainTab = tab;
  ['items', 'topSellers', 'expiring', 'inventory'].forEach(t => {
    $(`stab-${t}`)?.classList.toggle('hidden', t !== tab);
    const btn = $(`stab-btn-${t}`);
    if (btn) {
      if (t === tab) {
        btn.className = 'px-4 py-2 rounded-xl text-xs md:text-sm font-bold bg-white text-indigo-600 shadow-sm border border-slate-200 flex items-center gap-2';
      } else {
        btn.className = 'px-4 py-2 rounded-xl text-xs md:text-sm font-semibold text-slate-600 hover:bg-white/60 flex items-center gap-2';
      }
    }
  });

  if (tab === 'topSellers') renderTopSellingItems();
  if (tab === 'expiring') renderExpiringItems();
  if (tab === 'inventory') renderStoreInventory();
}

async function renderTopSellingItems() {
  const container = $('topSellersContainer');
  if (!container) return;

  try {
    const list = await call('getTopSellingItems');
    const isEn = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en');
    if (!list || !list.length) {
      container.innerHTML = `<div class="p-6 text-slate-400 col-span-full text-center">${isEn ? 'No sales recorded yet' : 'هیچ فرۆشتنێک تۆمار نەکراوە'}</div>`;
      return;
    }

    container.innerHTML = list.map((item, idx) => {
      const medals = isEn ? ['🥇 Top Seller', '🥈 2nd Place', '🥉 3rd Place'] : ['🥇 پڕفرۆشترین', '🥈 پلەی دووەم', '🥉 پلەی سێیەم'];
      const rankBadge = medals[idx] || `#${idx + 1}`;

      return `
        <div class="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 relative overflow-hidden">
          <div class="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center shrink-0 font-black text-sm">
            ${idx === 0 ? '🏆' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${idx+1}`))}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <b class="text-sm font-bold text-slate-900 truncate">${esc(item.Name)}</b>
              <span class="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-800 rounded font-bold">${rankBadge}</span>
            </div>
            <div class="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>${isEn ? 'Sold:' : 'فرۆشراوە:'} <b class="text-indigo-600 font-bold">${item.TotalQuantitySold} ${isEn ? 'pcs' : 'دانە'}</b></span>
              <span>${isEn ? 'Total Rev:' : 'کۆی داهات:'} <b class="text-emerald-700 font-bold">${Number(item.TotalRevenue).toLocaleString()} IQD</b></span>
            </div>
            <div class="mt-1 text-[11px] text-slate-400">
              ${isEn ? 'Stock remaining:' : 'ماوە لە مەخزەن:'} <span class="font-bold text-slate-700">${item.CurrentStock} ${isEn ? 'pcs' : 'دانە'}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch(e) {
    console.error('renderTopSellingItems error:', e);
  }
}

async function renderExpiringItems() {
  const tbody = $('expiringItemsRows');
  if (!tbody) return;
  const isEn = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en');

  try {
    const list = await call('getExpiringStoreItems');
    if (!list || !list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">${isEn ? 'No items near expiration' : 'هیچ کاڵایەک نزیک نییە لە بەسەرچوون'}</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(item => {
      let statusBadge = '';
      if (item.Status === 'Expired') {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">${isEn ? 'Expired' : 'بەسەرچووە (Expired)'}</span>`;
      } else if (item.DaysLeft <= 30) {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">${isEn ? 'Under 30 Days' : 'کەمتر لە ٣٠ ڕۆژ'}</span>`;
      } else {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-50 text-yellow-800">${isEn ? 'Expiring Soon' : 'نزیک لە بەسەرچوون'}</span>`;
      }

      return `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
          <td class="p-3.5 font-bold text-slate-900">${esc(item.Name)}</td>
          <td class="p-3.5"><span class="px-2 py-0.5 bg-slate-100 rounded text-xs">${esc(item.Category || (isEn ? 'General' : 'گشتی'))}</span></td>
          <td class="p-3.5 font-bold font-mono">${item.Stock} ${isEn ? 'pcs' : 'دانە'}</td>
          <td class="p-3.5 font-mono text-slate-600 text-xs">${fmt(item.ExpiryDate)}</td>
          <td class="p-3.5 font-bold font-mono ${item.DaysLeft <= 0 ? 'text-rose-600' : 'text-amber-600'}">
            ${item.DaysLeft <= 0 ? (isEn ? 'Expired' : 'بەسەرچووە') : `${item.DaysLeft} ${isEn ? 'Days' : 'ڕۆژ'}`}
          </td>
          <td class="p-3.5 text-center">${statusBadge}</td>
        </tr>
      `;
    }).join('');
  } catch(e) {
    console.error('renderExpiringItems error:', e);
  }
}

function renderStore() {
  const isEn = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en');
  const categories = Array.from(new Set(storeItems.map(i => i.Category || (isEn ? 'General' : 'گشتی'))));

  // Render Category Filter Tabs
  $('storeCategoryTabs').innerHTML = `
    <button onclick="filterStoreCat('all')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${currentStoreCatFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
      ${isEn ? 'All Items' : 'هەموو کاڵاکان'} (${storeItems.length})
    </button>
    ${categories.map(cat => `
      <button onclick="filterStoreCat('${esc(cat)}')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${currentStoreCatFilter === cat ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
        ${esc(cat)} (${storeItems.filter(i => (i.Category || (isEn ? 'General' : 'گشتی')) === cat).length})
      </button>
    `).join('')}
  `;

  // Filter items
  const displayCats = currentStoreCatFilter === 'all' ? categories : [currentStoreCatFilter];

  let html = '';
  displayCats.forEach(cat => {
    const itemsInCat = storeItems.filter(i => (i.Category || (isEn ? 'General' : 'گشتی')) === cat);
    if (!itemsInCat.length) return;

    html += `
      <div class="space-y-3">
        <div class="flex items-center gap-2 border-b border-slate-200 pb-2">
          <span class="w-3 h-3 rounded-full bg-indigo-600"></span>
          <h3 class="font-extrabold text-base text-slate-900">${esc(cat)}</h3>
          <span class="text-xs text-slate-400 font-semibold">(${itemsInCat.length} ${isEn ? 'items' : 'کاڵا'})</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          ${itemsInCat.map(item => `
            <div class="border border-slate-200 rounded-2xl p-3 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition">
              <div>
                <div class="relative overflow-hidden rounded-xl mb-2 bg-slate-50 border border-slate-100">
                  <img src="${item.Image || 'https://images.unsplash.com/photo-1559839914-ba2ce93cca83?w=150'}" class="w-full h-24 object-cover" onerror="this.src='https://placehold.co/150x100?text=Item'">
                  ${item.Barcode ? `<span class="absolute top-1.5 right-1.5 text-[9px] font-mono px-1.5 py-0.5 bg-black/60 backdrop-blur text-white rounded font-bold">${esc(item.Barcode)}</span>` : ''}
                </div>
                <b class="text-xs font-bold text-slate-900 block truncate" title="${esc(item.Name)}">${esc(item.Name)}</b>
                <div class="flex items-center justify-between mt-1 text-[11px]">
                  <span class="text-slate-400 font-medium">${isEn ? 'Stock' : 'مەخزەن'}:</span>
                  <span class="font-bold px-1.5 py-0.2 rounded text-[10px] ${Number(item.Stock) < 10 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}">${item.Stock}</span>
                </div>
                <div class="mt-1 font-black text-xs text-emerald-700">
                  ${Number(item.Price).toLocaleString()} IQD
                </div>
              </div>
              <div class="mt-2.5 pt-2 border-t border-slate-100">
                <button onclick="quickSellItem('${esc(item.Id)}')" class="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 shadow-sm transition">
                  <i data-lucide="shopping-cart" class="w-3.5 h-3.5"></i>
                  <span>${isEn ? 'Sell' : 'فرۆشتن'}</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  $('storeSectionsContainer').innerHTML = html || `<div class="p-6 text-slate-400">${isEn ? 'No items found' : 'هیچ کاڵایەک نەدۆزرایەوە'}</div>`;
  renderStoreInventory();
  lucide.createIcons();
}

function renderStoreInventory() {
  const tbody = $('inventoryTableRows');
  if (!tbody) return;
  const isEn = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en');
  const search = ($('inventorySearchInput')?.value || '').trim().toLowerCase();

  let filtered = storeItems || [];
  if (search) {
    filtered = filtered.filter(i => 
      (i.Name && i.Name.toLowerCase().includes(search)) || 
      (i.Barcode && String(i.Barcode).toLowerCase().includes(search)) ||
      (i.Category && i.Category.toLowerCase().includes(search))
    );
  }

  let totalItems = filtered.length;
  let totalStock = 0;
  let totalCost = 0;
  let totalRetail = 0;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-400">${isEn ? 'No items found in inventory' : 'هیچ کاڵایەک لە کۆگادا نەدۆزرایەوە'}</td></tr>`;
  } else {
    tbody.innerHTML = filtered.map(item => {
      const stock = Number(item.Stock) || 0;
      const cost = Number(item.Cost) || 0;
      const price = Number(item.Price) || 0;
      const margin = price - cost;
      totalStock += stock;
      totalCost += (cost * stock);
      totalRetail += (price * stock);

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="p-2.5">
            <img src="${item.Image || 'https://placehold.co/50x50?text=Item'}" class="w-10 h-10 object-cover rounded-lg border border-slate-100" onerror="this.src='https://placehold.co/50x50?text=Item'">
          </td>
          <td class="p-2.5 font-mono text-xs text-indigo-600 font-bold">${esc(item.Barcode || '-')}</td>
          <td class="p-2.5 font-bold text-slate-900 text-xs">${esc(item.Name)}</td>
          <td class="p-2.5"><span class="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-700">${esc(item.Category || (isEn ? 'General' : 'گشتی'))}</span></td>
          <td class="p-2.5 text-center font-mono font-bold text-xs ${stock < 10 ? 'text-rose-600' : 'text-slate-800'}">
            <span class="px-2 py-0.5 rounded ${stock < 10 ? 'bg-rose-50 border border-rose-200' : 'bg-slate-100'}">${stock.toLocaleString()}</span>
          </td>
          <td class="p-2.5 font-mono text-slate-600 text-xs">${cost > 0 ? cost.toLocaleString() + ' IQD' : '-'}</td>
          <td class="p-2.5 font-mono font-bold text-emerald-700 text-xs">${price.toLocaleString()} IQD</td>
          <td class="p-2.5 font-mono font-bold text-xs ${margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
            ${margin >= 0 ? '+' : ''}${margin.toLocaleString()} IQD
          </td>
          <td class="p-2.5 font-mono text-slate-500 text-xs">${fmt(item.ExpiryDate)}</td>
          <td class="p-2.5 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick='openStoreItemModal(${JSON.stringify(item).replace(/'/g, "&apos;")})' class="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1 transition">
                <i data-lucide="edit" class="w-3 h-3"></i>
                <span>${isEn ? 'Edit' : 'دەستکاری'}</span>
              </button>
              <button onclick="removeStoreItem('${esc(item.Id)}')" class="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1 transition">
                <i data-lucide="trash-2" class="w-3 h-3"></i>
                <span>${isEn ? 'Delete' : 'سڕینەوە'}</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Update Inventory Footer
  if ($('invTotalItemCount')) $('invTotalItemCount').textContent = `${totalItems} ${isEn ? 'items' : 'کاڵا'}`;
  if ($('invTotalStockCount')) $('invTotalStockCount').textContent = `${totalStock.toLocaleString()} ${isEn ? 'pcs' : 'دانە'}`;
  if ($('invTotalCostValue')) $('invTotalCostValue').textContent = `${totalCost.toLocaleString()} IQD`;
  if ($('invTotalRetailValue')) $('invTotalRetailValue').textContent = `${totalRetail.toLocaleString()} IQD`;
  if ($('invTotalPotentialProfit')) $('invTotalPotentialProfit').textContent = `+${(totalRetail - totalCost).toLocaleString()} IQD`;
  if (window.lucide) lucide.createIcons();
}

function filterStoreCat(cat) {
  currentStoreCatFilter = cat;
  renderStore();
}

// فرۆشتنی خێرا بە بارکۆد
async function sellByBarcode() {
  const code = $('storeBarcodeInput').value.trim();
  if (!code) return;

  const item = storeItems.find(i => String(i.Barcode || '').trim().toLowerCase() === code.toLowerCase());
  if (!item) {
    alert(`هیچ کاڵایەک بەم بارکۆدە (${code}) نەدۆزرایەوە!`);
    return;
  }

  const qty = prompt(`کاڵا دۆزرایەوە: ${item.Name} (${item.Price} IQD)\nچەند دانەی لێ دەفرۆشیت؟`, "1");
  if (!qty || isNaN(qty) || Number(qty) <= 0) return;

  try {
    await call('recordSale', {
      ItemId: item.Id,
      Barcode: item.Barcode,
      Quantity: Number(qty),
      CustomerName: 'کڕیاری بارکۆد (کاش)'
    });
    $('storeBarcodeInput').value = '';
    await loadAll();
    alert(`✓ ${qty} دانە لە (${item.Name}) بە سەرکەوتوویی فرۆشرا و لە مەخزەن کەمکرایەوە!`);
  } catch (err) {
    alert('هەڵە لە فرۆشتن: ' + err.message);
  }
}

function openStoreItemModal(item = {}) {
  const isEn = currentAppLanguage === 'en';
  $('modalTitle').textContent = item.Id 
    ? (isEn ? 'Edit Store Item' : 'دەستکاریکردنی کاڵا') 
    : (isEn ? '+ Add New Store Item' : 'زیادکردنی کاڵای نوێ بۆ فرۆشگا');
  $('modalBody').innerHTML = `
    <form onsubmit="saveStoreItemUI(event)" class="space-y-4">
      <input type="hidden" name="Id" value="${esc(item.Id || '')}">
      
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-semibold mb-1">${isEn ? 'Product Name *' : 'ناوی کاڵا *'}</label>
          <input name="Name" value="${esc(item.Name || '')}" required class="w-full border rounded-xl p-3" placeholder="${isEn ? 'e.g. Mineral Water, Protein Bar' : 'بۆ نموونە: ئاوی معدنی، پرۆتین بار'}">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">${isEn ? 'Category *' : 'بەش (Category) *'}</label>
          <select name="Category" class="w-full border rounded-xl p-3 font-semibold">
            <option value="خواردنەوە و ئاو" ${item.Category === 'خواردنەوە و ئاو' ? 'selected' : ''}>${isEn ? 'Beverages & Water' : 'خواردنەوە و ئاو'}</option>
            <option value="تەواوکەری خۆراکی (پرۆتین و پاودەر)" ${item.Category === 'تەواوکەری خۆراکی (پرۆتین و پاودەر)' ? 'selected' : ''}>${isEn ? 'Supplements (Protein & Powders)' : 'تەواوکەری خۆراکی (پرۆتین و پاودەر)'}</option>
            <option value="سووکە ژەم و پرۆتین بار" ${item.Category === 'سووکە ژەم و پرۆتین بار' ? 'selected' : ''}>${isEn ? 'Snacks & Protein Bars' : 'سووکە ژەم و پرۆتین بار'}</option>
            <option value="کەلوپەل و هیتر" ${item.Category === 'کەلوپەل و هیتر' ? 'selected' : ''}>${isEn ? 'Gear & Accessories' : 'کەلوپەل و هیتر'}</option>
          </select>
        </div>
      </div>

      <!-- بارکۆدی ئایتمەکە -->
      <div>
        <label class="block text-sm font-bold text-indigo-700 mb-1">${isEn ? 'Item Barcode *' : 'بارکۆدی کاڵا (Barcode) *'}</label>
        <div class="flex gap-2">
          <input id="itemBarcodeField" name="Barcode" value="${esc(item.Barcode || '')}" placeholder="${isEn ? 'Scan barcode or enter manually' : 'بارکۆد سکان بکە یان بنووسە'}" class="flex-1 border-2 border-indigo-200 rounded-xl p-3 font-mono font-bold">
          <button type="button" onclick="$('itemBarcodeField').value = Math.floor(1000000000 + Math.random() * 9000000000)" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl">
            ${isEn ? 'Generate Random' : 'دروستکردنی خۆکار'}
          </button>
        </div>
      </div>

      <!-- هەژمارکردنی تێچووی پاکەت بۆ دەرهێنانی تێچووی دانە -->
      <div class="p-3 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-2">
        <span class="block text-xs font-bold text-amber-900">${isEn ? 'Package Cost Calculator (Unit Cost = Box Cost ÷ Units):' : 'هەژمارکردنی تێچووی کڕین (تێچووی دانە = نرخی پاکەت ÷ دانە):'}</span>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label class="block text-slate-600 mb-1">${isEn ? 'Box/Package Cost (IQD):' : 'نرخی کڕینی پاکەت/کارتۆن (IQD):'}</label>
            <input id="pkgCost" name="PackageCost" type="number" value="${item.PackageCost || ''}" oninput="calcUnitCost()" class="w-full border rounded-xl p-2 font-bold bg-white" placeholder="30000">
          </div>
          <div>
            <label class="block text-slate-600 mb-1">${isEn ? 'Units in Box:' : 'ژمارەی دانە لە پاکەتدا:'}</label>
            <input id="pkgUnits" name="PackageUnits" type="number" value="${item.PackageUnits || ''}" oninput="calcUnitCost()" class="w-full border rounded-xl p-2 font-bold bg-white" placeholder="12">
          </div>
        </div>
        <div class="flex justify-between items-center text-xs pt-1">
          <span>${isEn ? 'Calculated Unit Cost:' : 'تێچووی هەر دانەیەک بۆ حسابات:'}</span>
          <b id="computedUnitCost" class="text-sm font-black text-rose-700">${Number(item.Cost || 0).toLocaleString()} IQD</b>
          <input type="hidden" id="unitCostInput" name="Cost" value="${item.Cost || 0}">
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-bold text-emerald-700 mb-1">${isEn ? 'Selling Price (IQD) *' : 'نرخی فرۆشتنی تاک (IQD) *'}</label>
          <input name="Price" type="number" value="${item.Price || 1000}" required class="w-full border-2 border-emerald-300 rounded-xl p-3 font-bold text-emerald-800">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">${isEn ? 'Current Stock (Units) *' : 'بڕی مەخزەن (دانە) *'}</label>
          <input name="Stock" type="number" value="${item.Stock || 50}" required class="w-full border rounded-xl p-3">
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1">${isEn ? 'Expiry Date' : 'بەرواری بەسەرچوون (Expiry Date)'}</label>
        <input name="ExpiryDate" type="date" value="${item.ExpiryDate || ''}" class="w-full border rounded-xl p-3 text-sm">
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1">${isEn ? 'Photo URL' : 'لینکی وێنە'}</label>
        <input name="Image" value="${esc(item.Image || '')}" class="w-full border rounded-xl p-3" placeholder="https://...">
      </div>

      <div class="pt-3 flex gap-3">
        <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3.5 rounded-xl transition">${isEn ? 'Save to Excel Database' : 'پاشەکەوتکردن لە Excel'}</button>
        <button type="button" onclick="closeModal()" class="px-6 py-3.5 bg-slate-100 rounded-xl font-semibold transition">${isEn ? 'Close' : 'داخستن'}</button>
      </div>
    </form>
  `;
  $('modal').classList.replace('hidden', 'flex');
}

function calcUnitCost() {
  const pkgCost = Number($('pkgCost')?.value) || 0;
  const pkgUnits = Number($('pkgUnits')?.value) || 1;
  const unit = (pkgCost > 0 && pkgUnits > 0) ? Math.round(pkgCost / pkgUnits) : 0;
  if ($('computedUnitCost')) $('computedUnitCost').textContent = unit.toLocaleString() + ' IQD';
  if ($('unitCostInput')) $('unitCostInput').value = unit;
}

async function saveStoreItemUI(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    await call('saveStoreItem', data);
    closeModal();
    await loadAll();
    alert('کاڵا بە سەرکەوتوویی لە Excel پاشەکەوت کرا!');
  } catch (err) {
    alert('هەڵە: ' + err.message);
  }
}

async function removeStoreItem(id) {
  if (!confirm('ئایا دڵنیایت لە سڕینەوەی ئەم کاڵایە لە فرۆشگا؟')) return;
  try {
    await call('deleteStoreItem', id);
    await loadAll();
  } catch (err) {
    alert('هەڵە: ' + err.message);
  }
}

function openSellModal(defaultItemId = '') {
  const isEn = currentAppLanguage === 'en';
  $('modalTitle').textContent = isEn ? '🛒 Point of Sale (POS)' : '🛒 فرۆشتنی کاڵا (POS)';
  $('modalBody').innerHTML = `
    <form onsubmit="recordSaleUI(event)" class="space-y-4">
      <div>
        <label class="block text-sm font-semibold mb-1">${isEn ? 'Select Product *' : 'کاڵا هەڵبژێرە *'}</label>
        <select id="saleItemId" name="ItemId" onchange="updateSalePrice()" class="w-full border rounded-xl p-3 font-bold" required>
          ${storeItems.map(i => `
            <option value="${esc(i.Id)}" data-price="${i.Price}" data-stock="${i.Stock}" ${i.Id === defaultItemId ? 'selected' : ''}>
              ${esc(i.Name)} — ${Number(i.Price).toLocaleString()} IQD ${isEn ? `(Stock: ${i.Stock} left)` : `(ماوە: ${i.Stock} دانە)`}
            </option>
          `).join('')}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-semibold mb-1">${isEn ? 'Quantity *' : 'ژمارەی دانە *'}</label>
          <input id="saleQty" name="Quantity" type="number" min="1" value="1" oninput="updateSalePrice()" class="w-full border rounded-xl p-3 font-bold" required>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">${isEn ? 'Total (IQD)' : 'کۆی گشتی (IQD)'}</label>
          <input id="saleTotal" readonly class="w-full border rounded-xl p-3 bg-slate-50 font-black text-emerald-700">
        </div>
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">${isEn ? 'Customer (Member or Cash)' : 'کڕیار (بەشداربوو یان کاش)'}</label>
        <select name="MemberCode" class="w-full border rounded-xl p-3">
          <option value="">${isEn ? '-- Cash Customer (Walk-in) --' : '-- کڕیاری کاش (دەرەکی) --'}</option>
          ${members.map(m => `<option value="${esc(m.MemberCode)}">${esc(m.FullName)} (${esc(m.MemberCode)})</option>`).join('')}
        </select>
      </div>
      <div class="pt-3 flex gap-3">
        <button type="submit" class="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black p-3.5 rounded-xl shadow transition">
          ${isEn ? '✓ Complete Sale & Save' : '✓ تەواوکردنی فرۆشتن و تۆمارکردن'}
        </button>
        <button type="button" onclick="closeModal()" class="px-6 py-3.5 bg-slate-100 rounded-xl font-semibold transition">${isEn ? 'Close' : 'داخستن'}</button>
      </div>
    </form>
  `;
  updateSalePrice();
  $('modal').classList.replace('hidden', 'flex');
}

function quickSellItem(itemId) {
  openSellModal(itemId);
}

function updateSalePrice() {
  const sel = $('saleItemId');
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  const price = Number(opt?.dataset.price) || 0;
  const qty = Number($('saleQty')?.value) || 1;
  if ($('saleTotal')) $('saleTotal').value = (price * qty).toLocaleString() + ' IQD';
}

async function recordSaleUI(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    await call('recordSale', data);
    closeModal();
    await loadAll();
    alert('فرۆشتنەکە بە سەرکەوتوویی تۆمارکرا و مەخزەن لە Excel کەمکرایەوە!');
  } catch (err) {
    alert('هەڵە: ' + err.message);
  }
}

// ==========================================
// ستاف و کارمەندان (Staff Management)
// ==========================================
function renderStaff() {
  const isEn = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en');
  const roleMap = {
    'بەڕێوەبەری گشتی': 'General Manager',
    'General Manager': 'General Manager',
    'ڕاهێنەر': 'Trainer',
    'Trainer': 'Trainer',
    'وەرگرتن (Reception)': 'Receptionist',
    'Receptionist': 'Receptionist',
    'ژمێریار': 'Accountant',
    'Accountant': 'Accountant',
    'کارمەندی فرۆشگا': 'Store Keeper',
    'Store Keeper': 'Store Keeper',
    'ستاف': 'Staff',
    'Staff': 'Staff',
    'ئەدمین': 'Admin',
    'Admin': 'Admin'
  };
  const permMap = {
    'dashboard': isEn ? 'Dashboard' : 'داشبۆرد',
    'members': isEn ? 'Members' : 'بەشداربووان',
    'plans': isEn ? 'Plans' : 'پلانەکان',
    'finances': isEn ? 'Finances' : 'داهات و خەرجی',
    'store': isEn ? 'Store' : 'فرۆشگا',
    'kiosk': isEn ? 'Kiosk' : 'کیۆسک',
    'staff': isEn ? 'Staff' : 'ستاف',
    'settings': isEn ? 'Settings' : 'ڕێکخستن'
  };

  $('staffRows').innerHTML = staffList.length ? staffList.map(s => {
    let perms = [];
    try { perms = JSON.parse(s.PermissionsJson || '[]'); } catch(e){}

    const roleLabel = isEn ? (roleMap[s.Role] || s.Role) : s.Role;

    return `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 font-mono text-xs font-bold text-indigo-600">${esc(s.StaffId)}</td>
        <td class="p-3.5 font-bold text-slate-800">${esc(s.FullName)}</td>
        <td class="p-3.5"><span class="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg text-xs">${esc(roleLabel)}</span></td>
        <td class="p-3.5 text-xs text-slate-500">${esc(s.Phone || '—')}</td>
        <td class="p-3.5 font-bold text-slate-900">${Number(s.MonthlySalary || 0).toLocaleString()} IQD</td>
        <td class="p-3.5">
          <div class="flex flex-wrap gap-1">
            ${perms.map(p => `<span class="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded">${esc(permMap[p] || p)}</span>`).join('')}
          </div>
        </td>
        <td class="p-3.5">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${s.Status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}">
            ${s.Status === 'Active' ? (isEn ? 'Active' : 'چالاک') : (isEn ? 'Inactive' : 'ناچالاک')}
          </span>
        </td>
        <td class="p-3.5 text-center whitespace-nowrap">
          <button onclick='openStaffModal(${JSON.stringify(s).replace(/'/g, "&apos;")})' class="text-indigo-600 font-bold text-xs px-2">${isEn ? 'Edit' : 'ئیدیت'}</button>
          <button onclick="removeStaff('${esc(s.StaffId)}')" class="text-rose-600 font-bold text-xs px-2">${isEn ? 'Delete' : 'سڕینەوە'}</button>
        </td>
      </tr>
    `;
  }).join('') : `<tr><td colspan="8" class="p-6 text-center text-slate-400">${isEn ? 'No staff members registered' : 'هیچ کارمەندێک تۆمار نەکراوە'}</td></tr>`;
}

function openStaffModal(s = {}) {
  const isEn = currentAppLanguage === 'en';
  $('modalTitle').textContent = s.StaffId 
    ? (isEn ? 'Edit Staff Member' : 'دەستکاریکردنی کارمەند') 
    : (isEn ? '+ Add New Staff Member' : 'زیادکردنی کارمەندی نوێ');
  let perms = ['dashboard', 'members'];
  if (s.PermissionsJson) {
    try { perms = JSON.parse(s.PermissionsJson); } catch(e){}
  }

  const allPermsList = [
    { key: 'dashboard', label: isEn ? 'Dashboard & Analytics' : 'داشبۆرد و ئامارەکان' },
    { key: 'members', label: isEn ? 'Members Management' : 'بەڕێوەبردنی بەشداربووان' },
    { key: 'plans', label: isEn ? 'Workout & Diet Plans' : 'پلانەکانی ڕاهێنان' },
    { key: 'finances', label: isEn ? 'Finances & Revenue' : 'داهات و خەرجی' },
    { key: 'store', label: isEn ? 'Store & POS' : 'فرۆشگا و POS' },
    { key: 'kiosk', label: isEn ? 'Kiosk Display' : 'شاشەی کیۆسک' },
    { key: 'staff', label: isEn ? 'Staff & Team' : 'بەڕێوەبردنی ستاف' },
    { key: 'settings', label: isEn ? 'Settings' : 'ڕێکخستنەکان' }
  ];

  $('modalBody').innerHTML = `
    <form onsubmit="saveStaffUI(event)" class="space-y-4">
      <input type="hidden" name="StaffId" value="${esc(s.StaffId || '')}">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-semibold mb-1">${isEn ? 'Full Name *' : 'ناوی تەواو *'}</label>
          <input name="FullName" value="${esc(s.FullName || '')}" required class="w-full border rounded-xl p-3" placeholder="${isEn ? 'Full Name' : 'ناوی سیانی'}">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">${isEn ? 'Phone Number' : 'مۆبایل'}</label>
          <input name="Phone" value="${esc(s.Phone || '')}" class="w-full border rounded-xl p-3" placeholder="0770xxxxxxx">
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-semibold mb-1">${isEn ? 'Role / Position *' : 'ڕۆڵ / پێگە *'}</label>
          <select name="Role" class="w-full border rounded-xl p-3 font-semibold">
            <option value="ڕاهێنەر (Trainer)" ${s.Role === 'ڕاهێنەر (Trainer)' ? 'selected' : ''}>${isEn ? 'Trainer' : 'ڕاهێنەر (Trainer)'}</option>
            <option value="ڕیسێپشن (Receptionist)" ${s.Role === 'ڕیسێپشن (Receptionist)' ? 'selected' : ''}>${isEn ? 'Receptionist' : 'ڕیسێپشن (Receptionist)'}</option>
            <option value="بەڕێوەبەر (Manager)" ${s.Role === 'بەڕێوەبەر (Manager)' ? 'selected' : ''}>${isEn ? 'Manager' : 'بەڕێوەبەر (Manager)'}</option>
            <option value="ژمێریار (Accountant)" ${s.Role === 'ژمێریار (Accountant)' ? 'selected' : ''}>${isEn ? 'Accountant' : 'ژمێریار (Accountant)'}</option>
            <option value="بەرپرسی فرۆشگا" ${s.Role === 'بەرپرسی فرۆشگا' ? 'selected' : ''}>${isEn ? 'Store Keeper' : 'بەرپرسی فرۆشگا'}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">${isEn ? 'Monthly Salary (IQD)' : 'مووچەی مانگانە (IQD)'}</label>
          <input name="MonthlySalary" type="number" value="${s.MonthlySalary || 500000}" class="w-full border rounded-xl p-3 font-bold">
        </div>
      </div>

      <!-- ناوی بەکارهێنەر و وشەی نهێنی بۆ لۆگین -->
      <div class="grid grid-cols-2 gap-3 p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100">
        <div>
          <label class="block text-xs font-bold text-indigo-900 mb-1">${isEn ? 'Username *' : 'ناوی بەکارهێنەر (Username) *'}</label>
          <input name="Username" value="${esc(s.Username || '')}" required class="w-full border border-indigo-200 rounded-xl p-2.5 font-mono font-bold text-sm bg-white" placeholder="username">
        </div>
        <div>
          <label class="block text-xs font-bold text-indigo-900 mb-1" id="lblStaffModalPass">${isEn ? 'Password *' : 'وشەی نهێنی (Password) *'}</label>
          <div class="relative">
            <input id="staffModalPassword" name="Password" type="password" value="${esc(s.Password || '')}" ${s.StaffId ? `placeholder="${isEn ? 'Leave empty to keep unchanged' : 'ئەگەر نەیگۆڕیت بەتاڵی بهێڵەرەوە'}"` : 'required placeholder="••••••"'} class="w-full border border-indigo-200 rounded-xl p-2.5 pl-9 text-sm bg-white font-mono">
            <button type="button" onclick="toggleStaffPasswordVisibility()" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition" title="Show / Hide">
              <i data-lucide="eye" id="staffPassEyeIcon" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- پێرمیشنەکانی کارمەند -->
      <div class="border-t pt-3">
        <label class="block text-sm font-bold text-slate-800 mb-2">${isEn ? 'Section Permissions:' : 'دەسەڵاتەکانی بەشەکان (Permissions):'}</label>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          ${allPermsList.map(p => `
            <label class="flex items-center gap-2 p-2 bg-slate-50 border rounded-xl cursor-pointer">
              <input type="checkbox" name="Permissions" value="${p.key}" ${perms.includes(p.key) ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded">
              <span class="font-semibold text-slate-700">${p.label}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="pt-3 flex gap-3">
        <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3.5 rounded-xl transition">${isEn ? 'Save Staff' : 'پاشەکەوتکردنی کارمەند'}</button>
        <button type="button" onclick="closeModal()" class="px-6 py-3.5 bg-slate-100 rounded-xl font-semibold transition">${isEn ? 'Close' : 'داخستن'}</button>
      </div>
    </form>
  `;
  $('modal').classList.replace('hidden', 'flex');
  lucide.createIcons();
}

async function saveStaffUI(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const selectedPerms = Array.from(form.querySelectorAll('input[name="Permissions"]:checked')).map(cb => cb.value);

  const staffData = {
    StaffId: formData.get('StaffId') || undefined,
    FullName: formData.get('FullName'),
    Phone: formData.get('Phone'),
    Role: formData.get('Role'),
    MonthlySalary: Number(formData.get('MonthlySalary')) || 0,
    Username: formData.get('Username'),
    Password: formData.get('Password'),
    Permissions: selectedPerms
  };

  try {
    await call('saveStaff', staffData);
    closeModal();
    await loadAll();
    alert('کارمەند بە سەرکەوتوویی لە Excel پاشەکەوت کرا!');
  } catch (err) {
    alert('هەڵە: ' + err.message);
  }
}

async function removeStaff(id) {
  if (!confirm('ئایا دڵنیایت لە سڕینەوەی ئەم کارمەندە؟')) return;
  try {
    await call('deleteStaff', id);
    await loadAll();
    alert('کارمەند سڕایەوە');
  } catch (err) {
    alert('هەڵە: ' + err.message);
  }
}

function toggleStaffPasswordVisibility() {
  const input = $('staffModalPassword');
  const icon = $('staffPassEyeIcon');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    if (icon) icon.setAttribute('data-lucide', 'eye');
  }
  lucide.createIcons();
}

// ==========================================
// ڕێکخستنەکان (Settings & Exercise Library)
// ==========================================
function switchSettingsTab(tab) {
  ['general', 'subscriptions', 'exercises', 'backup'].forEach(t => {
    $(`set-tab-${t}`)?.classList.add('hidden');
    const btn = $(`tab-btn-${t}`);
    if (btn) {
      btn.className = 'px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-white/50 flex items-center gap-1.5';
    }
  });

  $(`set-tab-${tab}`)?.classList.remove('hidden');
  const activeBtn = $(`tab-btn-${tab}`);
  if (activeBtn) {
    activeBtn.className = 'px-4 py-2 rounded-xl text-sm font-bold bg-white text-indigo-600 shadow-sm border border-slate-200 flex items-center gap-1.5';
  }
}

let dynamicPhones = [];
let dynamicSocials = [];

function setAppLanguage(lang) {
  applyAppLanguage(lang);
  updateLanguageButtonsState(lang);
}

function updateLanguageButtonsState(lang) {
  const isEn = lang === 'en';
  const btnKu = $('langBtnKu');
  const btnEn = $('langBtnEn');
  if (btnKu && btnEn) {
    if (isEn) {
      btnEn.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-sm transition';
      btnKu.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition';
    } else {
      btnKu.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-sm transition';
      btnEn.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition';
    }
  }
}

function initSettingsDynamicFields() {
  // Phones
  try {
    if (appSettings.PhonesJson) {
      dynamicPhones = JSON.parse(appSettings.PhonesJson);
    } else if (appSettings.Phone) {
      dynamicPhones = [{ label: 'سەرەکی', phone: appSettings.Phone }];
    } else {
      dynamicPhones = [{ label: 'سەرەکی', phone: '' }];
    }
  } catch(e) {
    dynamicPhones = [{ label: 'سەرەکی', phone: appSettings.Phone || '' }];
  }
  renderDynamicPhones();

  // Socials
  try {
    if (appSettings.SocialsJson) {
      dynamicSocials = JSON.parse(appSettings.SocialsJson);
    } else {
      dynamicSocials = [
        { platform: 'Instagram', url: appSettings.Instagram || '', enabled: !!appSettings.Instagram },
        { platform: 'Facebook', url: appSettings.Facebook || '', enabled: !!appSettings.Facebook },
        { platform: 'TikTok', url: appSettings.TikTok || '', enabled: !!appSettings.TikTok }
      ];
    }
  } catch(e) {
    dynamicSocials = [
      { platform: 'Instagram', url: appSettings.Instagram || '', enabled: true },
      { platform: 'Facebook', url: appSettings.Facebook || '', enabled: true },
      { platform: 'TikTok', url: appSettings.TikTok || '', enabled: true }
    ];
  }
  renderDynamicSocials();
}

function renderDynamicPhones() {
  const container = $('dynamicPhonesContainer');
  if (!container) return;
  const isEn = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en');
  if (!dynamicPhones.length) {
    dynamicPhones = [{ label: isEn ? 'Primary' : 'سەرەکی', phone: '' }];
  }

  container.innerHTML = dynamicPhones.map((p, idx) => `
    <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2 shadow-xs">
      <input type="text" value="${esc(p.label || '')}" oninput="dynamicPhones[${idx}].label = this.value" placeholder="${isEn ? 'Label' : 'جۆر'}" class="w-24 sm:w-28 border border-slate-200 rounded-lg p-1.5 text-xs font-semibold">
      <input type="text" value="${esc(p.phone || '')}" oninput="dynamicPhones[${idx}].phone = this.value" placeholder="0770xxxxxxx" class="flex-1 border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold">
      ${dynamicPhones.length > 1 ? `
        <button type="button" onclick="removePhoneRow(${idx})" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition" title="${isEn ? 'Delete' : 'سڕینەوە'}">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      ` : ''}
    </div>
  `).join('');
  if (window.lucide) lucide.createIcons();
}

function addPhoneRow() {
  const isEn = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en');
  dynamicPhones.push({ label: isEn ? 'Branch' : 'لق', phone: '' });
  renderDynamicPhones();
}

function removePhoneRow(idx) {
  dynamicPhones.splice(idx, 1);
  renderDynamicPhones();
}

function renderDynamicSocials() {
  const container = $('dynamicSocialsContainer');
  if (!container) return;
  const isEn = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en');

  container.innerHTML = dynamicSocials.map((s, idx) => `
    <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2 shadow-xs">
      <div class="w-24 shrink-0">
        <select onchange="dynamicSocials[${idx}].platform = this.value" class="w-full border border-slate-200 rounded-lg p-1.5 text-xs font-bold bg-slate-50">
          <option value="Instagram" ${s.platform === 'Instagram' ? 'selected' : ''}>Instagram</option>
          <option value="Facebook" ${s.platform === 'Facebook' ? 'selected' : ''}>Facebook</option>
          <option value="TikTok" ${s.platform === 'TikTok' ? 'selected' : ''}>TikTok</option>
          <option value="Snapchat" ${s.platform === 'Snapchat' ? 'selected' : ''}>Snapchat</option>
          <option value="YouTube" ${s.platform === 'YouTube' ? 'selected' : ''}>YouTube</option>
          <option value="Telegram" ${s.platform === 'Telegram' ? 'selected' : ''}>Telegram</option>
          <option value="Website" ${s.platform === 'Website' ? 'selected' : ''}>Website</option>
        </select>
      </div>
      <input type="text" value="${esc(s.url || '')}" oninput="dynamicSocials[${idx}].url = this.value" placeholder="${isEn ? 'Account link or username...' : 'لینک یان ناوی هەژمار...'}" class="flex-1 border border-slate-200 rounded-lg p-1.5 text-xs">
      
      <!-- On/Off Switch -->
      <label class="relative inline-flex items-center cursor-pointer shrink-0" title="${s.enabled ? (isEn ? 'Active' : 'چالاکە') : (isEn ? 'Inactive' : 'ناچالاکە')}">
        <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="dynamicSocials[${idx}].enabled = this.checked; renderDynamicSocials();" class="sr-only peer">
        <div class="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
      </label>

      <button type="button" onclick="removeSocialRow(${idx})" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition" title="${isEn ? 'Delete' : 'سڕینەوە'}">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
      </button>
    </div>
  `).join('');
  if (window.lucide) lucide.createIcons();
}

function addSocialRow() {
  dynamicSocials.push({ platform: 'Instagram', url: '', enabled: true });
  renderDynamicSocials();
}

function removeSocialRow(idx) {
  dynamicSocials.splice(idx, 1);
  renderDynamicSocials();
}

function renderSettings() {
  if ($('sGymName') && appSettings.GymName) $('sGymName').value = appSettings.GymName;
  if ($('sLogo') && appSettings.GymLogo) $('sLogo').value = appSettings.GymLogo;
  if ($('sKioskBackgroundUrl') && appSettings.KioskBackgroundUrl) $('sKioskBackgroundUrl').value = appSettings.KioskBackgroundUrl;
  if ($('sCurrency') && appSettings.Currency) $('sCurrency').value = appSettings.Currency;
  if ($('sExchangeRate') && appSettings.ExchangeRate) $('sExchangeRate').value = appSettings.ExchangeRate;
  if ($('sWhatsApp') && appSettings.WhatsApp) $('sWhatsApp').value = appSettings.WhatsApp;
  if ($('sAddress') && appSettings.Address) $('sAddress').value = appSettings.Address;
  if ($('sWorkHours') && appSettings.WorkHours) $('sWorkHours').value = appSettings.WorkHours;
  if ($('sBio') && appSettings.Bio) $('sBio').value = appSettings.Bio;
  if ($('sAutoBackupFreq') && appSettings.AutoBackupFreq) $('sAutoBackupFreq').value = appSettings.AutoBackupFreq;
  if ($('sAutoBackupNotify') && appSettings.AutoBackupNotify) $('sAutoBackupNotify').value = appSettings.AutoBackupNotify;
  const isEn = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en');
  if ($('sLastBackupDate') && appSettings.LastBackupDate) $('sLastBackupDate').textContent = fmt(appSettings.LastBackupDate) + (isEn ? ' (Backed up)' : ' (پاشەکەوت کراوە)');

  updateLanguageButtonsState(currentAppLanguage);
  initSettingsDynamicFields();
  updateCloudBadge();

  $('subTypeRows').innerHTML = subscriptionTypes.map(st => `
    <tr class="hover:bg-slate-50">
      <td class="p-3 font-mono font-bold text-xs text-indigo-600">${esc(st.Id)}</td>
      <td class="p-3 font-bold">${esc(st.Name)}</td>
      <td class="p-3">${st.DurationDays} ${isEn ? 'Days' : 'ڕۆژ'}</td>
      <td class="p-3 font-bold text-emerald-700">${Number(st.Price).toLocaleString()} IQD</td>
      <td class="p-3 text-xs text-slate-500">${esc(st.Description || '—')}</td>
      <td class="p-3 text-center whitespace-nowrap">
        <button onclick='openSubTypeModal(${JSON.stringify(st).replace(/'/g, "&apos;")})' class="text-indigo-600 font-bold px-1.5">${isEn ? 'Edit' : 'ئیدیت'}</button>
        <button onclick="removeSubType('${esc(st.Id)}')" class="text-rose-600 font-bold px-1.5">${isEn ? 'Delete' : 'سڕینەوە'}</button>
      </td>
    </tr>
  `).join('');

  $('exerciseLibraryRows').innerHTML = allExercises.map(ex => `
    <tr class="hover:bg-slate-50">
      <td class="p-3 font-bold">${esc(ex.Name)}</td>
      <td class="p-3"><span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold">${esc(ex.TargetMuscle)}</span></td>
      <td class="p-3 text-xs">${ex.Sets} ${isEn ? 'Sets' : 'کۆمەڵە'} / ${ex.Reps} ${isEn ? 'Reps' : 'دووبارە'}</td>
      <td class="p-3 text-xs">${ex.VideoUrl ? `<a href="${esc(ex.VideoUrl)}" target="_blank" class="text-red-600 hover:underline">${isEn ? 'Video ▶' : 'ڤیدیۆ ▶'}</a>` : '—'}</td>
      <td class="p-3 text-center whitespace-nowrap">
        <button onclick='openExerciseModal(${JSON.stringify(ex).replace(/'/g, "&apos;")})' class="text-indigo-600 font-bold px-1.5">${isEn ? 'Edit' : 'ئیدیت'}</button>
        <button onclick="removeExercise('${esc(ex.ExerciseId)}')" class="text-rose-600 font-bold px-1.5">${isEn ? 'Delete' : 'سڕینەوە'}</button>
      </td>
    </tr>
  `).join('');
}

function downloadCSV(filename, csvContent) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// هەناردەکردنی هەموو باکئەپەکان بە فایلی Excel (.xlsx) بەپێی داواکاری بەکارهێنەر
function exportMembersExcel() {
  if (!members || !members.length) {
    alert('هیچ بەشداربوویەک نییە بۆ هەناردەکردن');
    return;
  }
  const data = members.map(m => ({
    'کۆدی بەشداربوو (Code)': m.MemberCode || '',
    'ناوی تەواو (FullName)': m.FullName || '',
    'مۆبایل (Phone)': m.Phone || '',
    'ڕەگەز (Gender)': m.Gender || '',
    'جۆری بەشداری (SubscriptionType)': m.SubscriptionType || '',
    'نرخی بنەڕەتی (Price IQD)': Number(m.SubscriptionPrice || 0),
    'داشکاندن (Discount IQD)': Number(m.Discount || 0),
    'نرخی کۆتایی (FinalPrice IQD)': Number(m.FinalPrice !== '' && m.FinalPrice !== undefined ? m.FinalPrice : m.SubscriptionPrice || 0),
    'دەستپێک (StartDate)': fmt(m.StartDate),
    'بەسەرچوون (ExpiryDate)': fmt(m.ExpiryDate),
    'دۆخ (Status)': m.Status || '',
    'باڵا (Height cm)': m.HeightCm || '',
    'کێشی ئێستا (CurrentWeight kg)': m.CurrentWeightKg || '',
    'ڕاهێنەری تایبەت (Trainer)': m.TrainerName || '',
    'سیستەمی خۆراک (Diet Plan)': m.DietPlanName || '',
    'پلانی ڕاهێنان (Workout Plan)': m.PlanId || ''
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');
  XLSX.writeFile(wb, `Gym_Members_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportFinancesExcel() {
  if (!expenses.length && !members.length) {
    alert('هیچ داتایەکی دارایی نییە بۆ هەناردەکردن');
    return;
  }
  const wb = XLSX.utils.book_new();

  // Expenses Sheet
  const expData = expenses.map(e => ({
    'ناونیشان (Title)': e.Title || '',
    'جۆر (Category)': e.Category || '',
    'بڕی پارە (Amount IQD)': Number(e.Amount || 0),
    'بەروار (Date)': fmt(e.Date),
    'دووبارەبوونەوە (IsRecurring)': e.IsRecurring === 'Yes' || e.IsRecurring === true ? 'بەڵێ' : 'نەخێر',
    'ماوە (Recurrence)': e.Recurrence || '',
    'تێبینی (Note)': e.Note || ''
  }));
  const wsExp = XLSX.utils.json_to_sheet(expData.length ? expData : [{ Message: 'هیچ مەسروفاتێک نییە' }]);
  XLSX.utils.book_append_sheet(wb, wsExp, 'مەسروفات (Expenses)');

  // Income Sheet
  const incData = members.map(m => {
    const finalPrice = m.FinalPrice !== '' && m.FinalPrice !== undefined ? m.FinalPrice : m.SubscriptionPrice || 0;
    return {
      'بەشداربوو (Member)': `${m.FullName || ''} (${m.MemberCode || ''})`,
      'جۆری بەشداری (SubscriptionType)': m.SubscriptionType || '',
      'بڕی وەرگیراو (Received IQD)': Number(finalPrice),
      'بەرواری دەستپێک (StartDate)': fmt(m.StartDate)
    };
  });
  const wsInc = XLSX.utils.json_to_sheet(incData.length ? incData : [{ Message: 'هیچ داهاتێک نییە' }]);
  XLSX.utils.book_append_sheet(wb, wsInc, 'داهاتی ئابوونە (Income)');

  XLSX.writeFile(wb, `Gym_Finances_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportSalesExcel() {
  if (!storeSales || !storeSales.length) {
    alert('هیچ فرۆشتنێک نییە بۆ هەناردەکردن');
    return;
  }
  const data = storeSales.map(s => ({
    'کۆدی فرۆشتن (SaleId)': s.SaleId || '',
    'ناوی کاڵا (ItemName)': s.ItemName || '',
    'دانە (Quantity)': Number(s.Quantity || 0),
    'نرخی تاک (UnitPrice IQD)': Number(s.UnitPrice || 0),
    'کۆی گشتی (TotalPrice IQD)': Number(s.TotalPrice || 0),
    'کڕیار (Customer)': s.CustomerName || 'کاش',
    'بەروار (Date)': fmt(s.Date)
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Store Sales');
  XLSX.writeFile(wb, `Gym_Store_Sales_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportMembersCSV() { exportMembersExcel(); }
function exportFinancesCSV() { exportFinancesExcel(); }
function exportSalesCSV() { exportSalesExcel(); }

async function saveAutoBackupSettings() {
  const freq = $('sAutoBackupFreq')?.value || 'monthly';
  const notify = $('sAutoBackupNotify')?.value || 'enabled';
  try {
    await call('saveSettings', {
      AutoBackupFreq: freq,
      AutoBackupNotify: notify,
      LastBackupDate: new Date().toISOString()
    });
    alert('ڕێکخستنی باکئەپی خۆکارانە بە سەرکەوتوویی لە Excel پاشەکەوت کرا!');
  } catch(e) {
    alert('هەڵە: ' + e.message);
  }
}

function updateCloudBadge() {
  const badge = $('cloudStatusBadge');
  const input = $('sCloudApiUrl');
  if (!badge) return;
  const currentUrl = localStorage.getItem('gym_api_url') || (typeof GYM_API_URL !== 'undefined' ? GYM_API_URL : '');
  if (input && !input.value) input.value = currentUrl;
  if (currentUrl) {
    badge.textContent = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en') ? 'Connected: Google Cloud' : 'بەستراوە بە: گووگڵ شیت (Cloud)';
    badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800';
  } else if (typeof google !== 'undefined' && google.script && google.script.run) {
    badge.textContent = 'Google Apps Script (Native)';
    badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800';
  } else {
    badge.textContent = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en') ? 'Local Server (Active)' : 'سێرڤەری ناوخۆیی (چالاکە)';
    badge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800';
  }
}

async function testAndSaveCloudApi() {
  const url = ($('sCloudApiUrl')?.value || '').trim();
  if (!url) {
    alert(typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en' ? 'Please enter a valid Google Apps Script Web App URL.' : 'تکایە لینکی Web App بنووسە.');
    return;
  }
  const prev = localStorage.getItem('gym_api_url');
  try {
    localStorage.setItem('gym_api_url', url);
    const test = await call('getSettings');
    if (test) {
      alert(typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en' ? 'Successfully connected to Google Sheets cloud server!' : 'بە سەرکەوتوویی پەیوەندی بە سێرڤەری Google Sheets بەسترا!');
      updateCloudBadge();
    }
  } catch (err) {
    if (prev) localStorage.setItem('gym_api_url', prev);
    else localStorage.removeItem('gym_api_url');
    alert((typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en' ? 'Connection failed: ' : 'پەیوەندی سەرکەوتوو نەبوو: ') + (err.message || err));
  }
}

function resetToLocalApi() {
  localStorage.removeItem('gym_api_url');
  if ($('sCloudApiUrl')) $('sCloudApiUrl').value = '';
  updateCloudBadge();
  alert(typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en' ? 'Reset to local server mode.' : 'سیستەم گەڕێندرایەوە بۆ سێرڤەری ناوخۆیی.');
}

function openSubTypeModal(st = {}) {
  const isEn = currentAppLanguage === 'en';
  $('modalTitle').textContent = st.Id 
    ? (isEn ? 'Edit Membership Type' : 'دەستکاریکردنی جۆری بەشداری') 
    : (isEn ? '+ Create New Membership Type' : 'دروستکردنی جۆری نوێی بەشداری');
  $('modalBody').innerHTML = `
    <form onsubmit="saveSubTypeUI(event)" class="space-y-4">
      <input type="hidden" name="Id" value="${esc(st.Id || '')}">
      <div>
        <label class="block text-sm font-semibold mb-1">${isEn ? 'Membership Name *' : 'ناوی بەشداری *'}</label>
        <input name="Name" value="${esc(st.Name || '')}" required class="w-full border rounded-xl p-3" placeholder="${isEn ? 'e.g. Monthly VIP, 3 Months' : 'بۆ نموونە: مانگانە VIP، ٣ مانگە'}">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-semibold mb-1">${isEn ? 'Duration (Days) *' : 'ماوە بە ڕۆژ *'}</label>
          <input name="DurationDays" type="number" value="${st.DurationDays || 30}" required class="w-full border rounded-xl p-3">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">${isEn ? 'Base Price (IQD) *' : 'نرخی بنەڕەتی (IQD) *'}</label>
          <input name="Price" type="number" value="${st.Price || 40000}" required class="w-full border rounded-xl p-3">
        </div>
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">${isEn ? 'Description & Benefits' : 'وەسف و تایبەتمەندییەکان'}</label>
        <textarea name="Description" rows="2" class="w-full border rounded-xl p-3" placeholder="${isEn ? 'Description...' : ''}">${esc(st.Description || '')}</textarea>
      </div>
      <div class="pt-3 flex gap-3">
        <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3.5 rounded-xl transition">${isEn ? 'Save to Excel Database' : 'پاشەکەوتکردن لە Excel'}</button>
        <button type="button" onclick="closeModal()" class="px-6 py-3.5 bg-slate-100 rounded-xl font-semibold transition">${isEn ? 'Close' : 'داخستن'}</button>
      </div>
    </form>
  `;
  $('modal').classList.replace('hidden', 'flex');
}

async function saveSubTypeUI(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    await call('saveSubscriptionType', data);
    closeModal();
    await loadAll();
    alert('جۆری بەشداری نوێ پاشەکەوت کرا!');
  } catch (err) {
    alert('هەڵە: ' + err.message);
  }
}

async function removeSubType(id) {
  if (!confirm('ئایا دڵنیایت لە سڕینەوەی ئەم جۆرەی بەشداری؟')) return;
  try {
    await call('deleteSubscriptionType', id);
    await loadAll();
  } catch (err) {
    alert('هەڵە: ' + err.message);
  }
}

// دروستکردنی ڕاهێنان لەگەڵ درۆپداونی تێروتەسەلی ماسولکەکان
function openExerciseModal(ex = {}) {
  const isEn = currentAppLanguage === 'en';
  $('modalTitle').textContent = ex.ExerciseId 
    ? (isEn ? 'Edit Exercise' : 'دەستکاریکردنی ڕاهێنان') 
    : (isEn ? '+ Add New Exercise to Library' : 'زیادکردنی ڕاهێنانی نوێ بۆ کتێبخانە');
  $('modalBody').innerHTML = `
    <form onsubmit="saveExerciseUI(event)" class="space-y-4">
      <input type="hidden" name="ExerciseId" value="${esc(ex.ExerciseId || '')}">
      <div>
        <label class="block text-sm font-semibold mb-1">${isEn ? 'Exercise Name *' : 'ناوی ڕاهێنان *'}</label>
        <input name="Name" value="${esc(ex.Name || '')}" required class="w-full border rounded-xl p-3" placeholder="${isEn ? 'e.g. Barbell Bench Press, Lat Pulldown' : 'بۆ نموونە: باڕبێڵ بێنچ پرێس، لات پوڵ داون'}">
      </div>
      <div>
        <label class="block text-sm font-bold text-indigo-700 mb-1">${isEn ? 'Target Muscle Group *' : 'بەشی ماسولکەی لەش (وردەکاری ئەندامەکانی لەش) *'}</label>
        ${getMuscleDropdownHtml(ex.TargetMuscle || '')}
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div>
          <label class="block text-xs font-semibold mb-1">${isEn ? 'Sets' : 'کۆمەڵە (Sets)'}</label>
          <input name="Sets" value="${esc(ex.Sets || '4')}" class="w-full border rounded-xl p-2.5">
        </div>
        <div>
          <label class="block text-xs font-semibold mb-1">${isEn ? 'Reps' : 'دووبارە (Reps)'}</label>
          <input name="Reps" value="${esc(ex.Reps || '12')}" class="w-full border rounded-xl p-2.5">
        </div>
        <div>
          <label class="block text-xs font-semibold mb-1">${isEn ? 'Rest' : 'پشوو (Rest)'}</label>
          <input name="Rest" value="${esc(ex.Rest || '60s')}" class="w-full border rounded-xl p-2.5">
        </div>
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">${isEn ? 'YouTube Video URL' : 'لینکی ڤیدیۆی یوتیوب'}</label>
        <input name="VideoUrl" value="${esc(ex.VideoUrl || '')}" class="w-full border rounded-xl p-3" placeholder="https://youtube.com/...">
      </div>
      <div>
        <label class="block text-sm font-semibold mb-1">${isEn ? 'Trainer Notes' : 'تێبینی ڕاهێنەر'}</label>
        <textarea name="TrainerNotes" rows="2" class="w-full border rounded-xl p-3" placeholder="${isEn ? 'Form cues, safety instructions...' : ''}">${esc(ex.TrainerNotes || '')}</textarea>
      </div>
      <div class="pt-3 flex gap-3">
        <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3.5 rounded-xl transition">${isEn ? 'Save to Excel Database' : 'پاشەکەوتکردن لە Excel'}</button>
        <button type="button" onclick="closeModal()" class="px-6 py-3.5 bg-slate-100 rounded-xl font-semibold transition">${isEn ? 'Close' : 'داخستن'}</button>
      </div>
    </form>
  `;
  $('modal').classList.replace('hidden', 'flex');
}

async function saveExerciseUI(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    await call('saveExercise', data);
    closeModal();
    await loadAll();
    alert('ڕاهێنان بە سەرکەوتوویی لە کتێبخانەی Excel تۆمارکرا!');
  } catch (err) {
    alert('هەڵە: ' + err.message);
  }
}

async function removeExercise(id) {
  if (!confirm('ئایا دڵنیایت لە سڕینەوەی ئەم ڕاهێنانە؟')) return;
  try {
    await call('deleteExercise', id);
    await loadAll();
  } catch (err) {
    alert('هەڵە: ' + err.message);
  }
}

async function saveSettingsUI() {
  const primaryPhone = dynamicPhones.find(p => p.phone && p.phone.trim())?.phone || '';
  const insta = dynamicSocials.find(s => s.platform === 'Instagram')?.url || '';
  const fb = dynamicSocials.find(s => s.platform === 'Facebook')?.url || '';
  const tiktok = dynamicSocials.find(s => s.platform === 'TikTok')?.url || '';

  const settings = {
    GymName: $('sGymName')?.value || '',
    GymLogo: $('sLogo')?.value || '',
    KioskBackgroundUrl: $('sKioskBackgroundUrl')?.value || '',
    Currency: $('sCurrency')?.value || 'IQD',
    ExchangeRate: $('sExchangeRate')?.value || '150000',
    Phone: primaryPhone,
    PhonesJson: JSON.stringify(dynamicPhones),
    WhatsApp: $('sWhatsApp')?.value || '',
    Address: $('sAddress')?.value || '',
    WorkHours: $('sWorkHours')?.value || '',
    Bio: $('sBio')?.value || '',
    Instagram: insta,
    Facebook: fb,
    TikTok: tiktok,
    SocialsJson: JSON.stringify(dynamicSocials)
  };
  try {
    await call('saveSettings', settings);
    alert(currentAppLanguage === 'en' ? 'Settings and gym info saved successfully to Excel!' : 'ڕێکخستنەکان و زانیاری دەربارەی هۆڵ بە سەرکەوتوویی لە ناو Excel پاشەکەوت کران!');
    await loadAll();
  } catch (err) {
    alert('هەڵە: ' + err.message);
  }
}

function onTrainerChange() {
  const sel = $('mTrainerSelect');
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  if ($('mTrainerId')) {
    $('mTrainerId').value = opt?.dataset.id || '';
  }
}

// ==========================================
// خشتەی ئامادەبووەکانی ئەمڕۆ (Today's Attendance)
// ==========================================
let todayAttendanceList = [];

async function renderTodayAttendance() {
  try {
    todayAttendanceList = await call('getTodayAttendance');
    const count = todayAttendanceList.length;
    const isEn = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en');
    if ($('todayAttCountBadge')) $('todayAttCountBadge').textContent = isEn ? `${count} Present` : `${count} ئامادەبوو`;
    if ($('kAttendance')) $('kAttendance').textContent = count;

    const tbody = $('todayAttendanceTableBody');
    if (!tbody) return;

    if (!count) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-slate-400">${isEn ? 'No members checked in today' : 'هیچ یاریزانێک بۆ ئەمڕۆ تۆمار نەکراوە'}</td></tr>`;
      return;
    }

    tbody.innerHTML = todayAttendanceList.map(a => {
      const isPresent = a.Status === 'ئامادەیە لە هۆڵ';
      let statusLabel = esc(a.Status);
      if (isEn) {
        if (a.Status === 'ئامادەیە لە هۆڵ') statusLabel = 'In Gym';
        else if (a.Status === 'دەرچووە') statusLabel = 'Checked Out';
      }
      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="p-3.5">
            <div class="flex items-center gap-2.5">
              <img src="${a.PhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" class="w-9 h-9 rounded-xl object-cover border border-slate-200 shadow-sm" onerror="this.src='https://placehold.co/96x96?text=User'">
              <div>
                <b class="text-slate-800 text-xs block">${esc(a.FullName)}</b>
                <span class="text-[11px] text-slate-400">${esc(a.Phone || '')}</span>
              </div>
            </div>
          </td>
          <td class="p-3.5 font-mono text-xs font-bold text-indigo-600">${esc(a.MemberCode)}</td>
          <td class="p-3.5"><span class="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold">${esc(a.SubscriptionType || (isEn ? 'Monthly' : 'مانگانە'))}</span></td>
          <td class="p-3.5 text-xs text-slate-600 font-semibold">${esc(a.TrainerName || '—')}</td>
          <td class="p-3.5 font-mono text-xs text-emerald-700 font-bold">${esc(a.CheckInTime)}</td>
          <td class="p-3.5 font-mono text-xs text-slate-500">${esc(a.CheckOutTime || '—')}</td>
          <td class="p-3.5 text-center">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${isPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}">
              ${isPresent ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>' : ''}
              <span>${statusLabel}</span>
            </span>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('renderTodayAttendance error:', err);
  }
}

// ==========================================
// ئاگادارییەکان (Notifications Management)
// ==========================================
let notificationsList = [];

function toggleNotifMemberSelect() {
  const t = $('notifTargetType')?.value;
  const w = $('notifMemberSelectWrapper');
  if (t === 'member') {
    w?.classList.remove('hidden');
    if ($('notifTargetMember')) {
      $('notifTargetMember').innerHTML = members.map(m => `
        <option value="${esc(m.MemberCode)}">${esc(m.FullName)} (${esc(m.MemberCode)})</option>
      `).join('');
    }
  } else {
    w?.classList.add('hidden');
  }
}

async function renderNotifications() {
  try {
    notificationsList = await call('getNotifications');
    const tbody = $('notificationRows');
    if (!tbody) return;
    const isEn = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en');

    if (!notificationsList.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-slate-400">${isEn ? 'No notifications sent yet' : 'هیچ ئاگادارییەک نەنێردراوە'}</td></tr>`;
      return;
    }

    tbody.innerHTML = notificationsList.map(n => {
      const isAll = n.TargetType === 'all';
      const targetLabel = isAll ? (isEn ? '📢 All Members' : '📢 گشت بەشداربووان') : `👤 ${esc(n.TargetMemberCode)}`;
      return `
        <tr class="hover:bg-slate-50 border-b border-slate-100">
          <td class="p-3.5 font-bold text-slate-900">${esc(n.Title)}</td>
          <td class="p-3.5 text-slate-600 max-w-xs truncate">${esc(n.Message)}</td>
          <td class="p-3.5"><span class="px-2.5 py-1 rounded-lg text-xs font-bold ${isAll ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}">${targetLabel}</span></td>
          <td class="p-3.5 text-xs text-slate-400 font-mono">${fmt(n.CreatedAt)}</td>
          <td class="p-3.5 text-center">
            <button onclick="removeNotification('${esc(n.NotificationId)}')" class="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-bold transition">
              ${isEn ? 'Delete' : 'سڕینەوە'}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('renderNotifications error:', err);
  }
}

async function sendNotificationUI(e) {
  e.preventDefault();
  const title = $('notifTitle').value.trim();
  const message = $('notifMessage').value.trim();
  const targetType = $('notifTargetType').value;
  const targetMemberCode = targetType === 'member' ? $('notifTargetMember').value : '';

  if (!title || !message) return;

  try {
    await call('createNotification', {
      Title: title,
      Message: message,
      TargetType: targetType,
      TargetMemberCode: targetMemberCode
    });
    $('notifTitle').value = '';
    $('notifMessage').value = '';
    $('notifTargetType').value = 'all';
    toggleNotifMemberSelect();
    await renderNotifications();
    alert('ئاگاداری بە سەرکەوتوویی لە فایلی Excel تۆمار کرا و بۆ بەشداربووان دەردەکەوێت!');
  } catch (err) {
    alert('هەڵە لە ناردنی ئاگاداری: ' + err.message);
  }
}

async function removeNotification(id) {
  if (!confirm('ئایا دڵنیایت لە سڕینەوەی ئەم ئاگادارییە؟')) return;
  try {
    await call('deleteNotification', id);
    await renderNotifications();
    alert('ئاگادارییەکە سڕایەوە');
  } catch (err) {
    alert('هەڵە: ' + err.message);
  }
}

// ==========================================
// چوونەژوورەوەی ئەدمین و دەسەڵاتەکان (Auth)
// ==========================================
let currentStaffUser = null;

function checkAuth() {
  const saved = localStorage.getItem('gymAdminUser');
  if (saved) {
    try {
      currentStaffUser = JSON.parse(saved);
      $('loginView').classList.add('hidden');
      $('app').classList.remove('hidden');
      updateHeaderUser();
      applyUserPermissions();
      loadAll();
      return;
    } catch(e) {
      localStorage.removeItem('gymAdminUser');
    }
  }
  $('app').classList.add('hidden');
  $('loginView').classList.remove('hidden');
  lucide.createIcons();
}

function updateHeaderUser() {
  if (!currentStaffUser) return;
  const isEn = (typeof currentAppLanguage !== 'undefined' && currentAppLanguage === 'en');
  const roleMap = {
    'بەڕێوەبەری گشتی': 'General Manager',
    'General Manager': 'General Manager',
    'ڕاهێنەر': 'Trainer',
    'Trainer': 'Trainer',
    'وەرگرتن (Reception)': 'Receptionist',
    'Receptionist': 'Receptionist',
    'ژمێریار': 'Accountant',
    'Accountant': 'Accountant',
    'کارمەندی فرۆشگا': 'Store Keeper',
    'Store Keeper': 'Store Keeper',
    'ستاف': 'Staff',
    'Staff': 'Staff',
    'ئەدمین': 'Admin',
    'Admin': 'Admin'
  };
  let displayRole = currentStaffUser.Role || (isEn ? 'Staff' : 'ستاف');
  if (isEn && roleMap[displayRole]) {
    displayRole = roleMap[displayRole];
  } else if (!isEn && !roleMap[displayRole]) {
    for (const [k, v] of Object.entries(roleMap)) {
      if (v === displayRole) { displayRole = k; break; }
    }
  }
  let displayName = currentStaffUser.FullName || currentStaffUser.Username || (isEn ? 'Manager' : 'بەڕێوەبەر');
  if (isEn && displayName === 'بەڕێوەبەر') displayName = 'Manager';

  if ($('headerUserName')) $('headerUserName').textContent = displayName;
  if ($('headerUserRole')) $('headerUserRole').textContent = displayRole;
  if ($('headerUserAvatar')) $('headerUserAvatar').textContent = (displayName || 'A').slice(0, 1).toUpperCase();
}

function applyUserPermissions() {
  if (!currentStaffUser) return;
  const perms = currentStaffUser.Permissions || [];
  const isManager = (currentStaffUser.Role || '').includes('Manager') || currentStaffUser.Username === 'admin';
  document.querySelectorAll('nav .nav').forEach(btn => {
    const v = btn.dataset.v;
    if (isManager || perms.includes(v)) {
      btn.style.display = '';
    } else {
      btn.style.display = 'none';
    }
  });
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const u = $('loginUsername').value.trim();
  const p = $('loginPassword').value.trim();
  $('loginError').textContent = '';
  try {
    const staff = await call('staffLogin', u, p);
    localStorage.setItem('gymAdminUser', JSON.stringify(staff));
    currentStaffUser = staff;
    $('loginView').classList.add('hidden');
    $('app').classList.remove('hidden');
    updateHeaderUser();
    applyUserPermissions();
    await loadAll();
  } catch(err) {
    $('loginError').textContent = err.message || 'ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە';
  }
}

function fillAdminLogin(u, p) {
  $('loginUsername').value = u;
  $('loginPassword').value = p;
  $('loginError').textContent = '';
}

function adminLogout() {
  localStorage.removeItem('gymAdminUser');
  currentStaffUser = null;
  location.reload();
}

function closeModal() {
  stopCamera();
  $('modal').classList.replace('flex', 'hidden');
}

function fmt(v) {
  if (!v) return '—';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toISOString().slice(0, 10);
  } catch(e) {
    return v;
  }
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function field(n, l, v = '', extra = '') {
  return `<label class="text-sm font-medium text-slate-700">
    <span class="block mb-1">${l}</span>
    <input name="${n}" value="${esc(v)}" ${extra} class="w-full border border-slate-200 rounded-xl p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500">
  </label>`;
}

// ==========================================
// زمانی سیستەم (English & Kurdish Support)
// ==========================================
let currentAppLanguage = localStorage.getItem('gymAppLanguage') || 'ku';

const APP_TRANSLATIONS = {
  ku: {
    appTitle: 'Gym Pro — سیستەمی پێشکەوتووی بەڕێوەبردنی هۆڵ',
    langBtnText: 'English',
    sidebarGymSubText: 'سیستەمی هۆڵ (Excel Database)',
    navDashboard: 'داشبۆرد',
    navMembers: 'بەشداربووان',
    navPlans: 'پلان و خۆراک',
    navFinances: 'داهات و خەرجی',
    navStore: 'فرۆشگا و POS',
    navStaff: 'ستاف و کارمەندان',
    navNotifications: 'ئاگادارییەکان',
    navCheckin: 'پەڕەی چێک ئین',
    navMemberPortal: 'پۆڕتاڵی یاریزان',
    navSettings: 'ڕێکخستنەکان',
    navLogout: 'چوونەدەرەوە',
    titles: {
      dashboard: 'داشبۆرد',
      members: 'بەشداربووان',
      plans: 'پلانەکانی ڕاهێنان و خۆراک',
      finances: 'داهات و خەرجی',
      store: 'فرۆشگا و POS',
      staff: 'ستاف و کارمەندان',
      notifications: 'ئاگادارییەکان (Notifications)',
      settings: 'ڕێکخستنەکان و باکئەپ'
    },
    subtitles: {
      dashboard: 'بەڕێوەبردنی هۆڵ، داهات، فرۆشگا، ستاف و ئاگادارییەکان',
      members: 'تۆمارکردن، دەستکاریکردن و بەدواداچوونی یاریزانان',
      plans: 'پلانی وەرزشی و ڕجیمی خۆراکی تەندروست بۆ بەشداربووان',
      finances: 'شیکاری داهات، مەسروفات، فرۆشتن و بەراوردکاری',
      store: 'بەڕێوەبردنی مەخزەن، فرۆشتن بە بارکۆد، پڕفرۆشترینەکان',
      staff: 'هەژمارەکان، مووچە و دەسەڵاتەکانی ستافی هۆڵ',
      notifications: 'ناردنی پەیام و ئاگاداری بۆ ئەپی یاریزانان',
      settings: 'زانیاری هۆڵ، جۆری بەشداری، کتێبخانەی ڕاهێنان و باکئەپ'
    },
    login: {
      title: 'چوونەژوورەوەی ستاف',
      subtitle: 'سیستەمی بەڕێوەبردنی هۆڵ و ژمێریاری',
      userLabel: 'ناوی بەکارهێنەر (Username)',
      passLabel: 'وشەی نهێنی (Password)',
      submitBtn: 'چوونەژوورەوە بۆ داشبۆرد',
      demoAccounts: 'هەژمارە ئامادەکراوەکان لە Excel:'
    },
    kpi: {
      members: 'کۆی بەشداربووان',
      todayRev: 'داهاتی ئەمڕۆ (ڕۆژانە)',
      gym: 'هۆڵ:',
      store: 'فرۆشگا:',
      monthRev: 'کۆی داهاتی مانگ',
      todayAtt: 'ئامادەبوونی ئەمڕۆ',
      attTrend: 'ڕەوتی ئامادەبوون (Attendance Trend)',
      growth: 'گەشەی بەشداربووان (Members Growth)',
      attTitle: 'ئامادەبووەکانی ئەمڕۆ (خشتەی هاتن و چوون)',
      attSub: 'لیستی ئەو یاریزانانەی ئەمڕۆ لەڕێی کیۆسک یان ئەدمین تۆمار کراون',
      thAttMember: 'بەشداربوو',
      thAttCode: 'کۆد',
      thAttSub: 'جۆری بەشداری',
      thAttTrainer: 'ڕاهێنەر',
      thAttIn: 'کاتی هاتن (Check-In)',
      thAttOut: 'کاتی دەرچوون (Check-Out)',
      thAttStatus: 'دۆخ',
      quickActions: 'کردارە خێراکان',
      newMember: '+ بەشداربووی نوێ',
      quickCheckin: '✓ Quick Check-in (ئامادەبوون)',
      quickSale: '🛒 فرۆشتنی خێرای فرۆشگا',
      quickExpense: '+ تۆمارکردنی مەسروفات'
    },
    members: {
      searchPlaceholder: 'گەڕان بە ناو یان کۆد...',
      addBtn: 'زیادکردنی بەشداربوو',
      thPhotoCode: 'وێنە / کۆد',
      thName: 'ناو',
      thSub: 'جۆری بەشداری',
      thPriceDisc: 'نرخ / داشکاندن',
      thWeight: 'کێش',
      thPlan: 'پلانی ڕاهێنان',
      thExpiry: 'بەسەرچوون',
      thStatus: 'دۆخ',
      thActions: 'کردارەکان'
    },
    subview: {
      bcMembers: 'بەشداربووان',
      bcEdit: 'دەستکاریکردنی بەشداربوو',
      btnPrintPlan: 'چاپکردنی پلان (PDF / Print)',
      btnPortal: 'پۆڕتاڵی یاریزان',
      btnClose: 'گەڕانەوە',
      formTitle: 'زانیارییە سەرەکییەکانی بەشداربوو',
      photo: 'وێنەی بەشداربوو',
      upload: 'هەڵبژاردنی وێنە',
      cam: 'کامێرا',
      name: 'ناوی تەواو *',
      phone: 'ژمارەی مۆبایل',
      gender: 'ڕەگەز',
      subType: 'جۆری بەشداری (Subscription Type) *',
      price: 'نرخی بنەڕەتی (IQD)',
      discount: 'داشکاندن (IQD)',
      final: 'کۆی کۆتایی بۆ وەرگرتن (IQD)',
      start: 'بەرواری دەستپێکردن',
      expiry: 'بەرواری بەسەرچوون',
      weight: 'کێشی ئێستا (kg)',
      height: 'باڵا (cm)',
      status: 'دۆخی بەشداری',
      wPlan: 'پلانی ڕاهێنان (Workout Plan)',
      dPlan: 'سیستەمی خۆراک (Diet Plan)',
      trainer: 'ڕاهێنەری تایبەت (Trainer)',
      notes: 'تێبینی و ڕێنمایی',
      cancel: 'پاشگەزبوونەوە',
      save: 'پاشەکەوتکردنی دەستکارییەکان',
      attTitle: '١- خشتەی ئامادەبوونی ئەم بەشداربووە (کەی هاتووە و کەی ڕۆشتووە)',
      attSub: 'تەواوی مێژووی هاتن و دەرچوونی ئەم یاریزانە لە هۆڵ بە بەروار و کات',
      subTitle: '٢- بەشی ئابوونە و نوێکردنەوەکانی بەشداربوو',
      subSub: 'دۆخی ئابوونەی ئێستا و مێژووی نوێکردنەوە و بڕی پارەی دراو',
      renewBtn: '+ نوێکردنەوەی ئابوونە بۆ مانگێکی تر',
      curType: 'جۆری بەشداری',
      curStatus: 'دۆخی بەشداری',
      daysLeft: 'ڕۆژانی ماوە',
      paidAmount: 'بڕی دراو',
      weightTitle: '٣- خشتە و مێژووی کێشی بەشداربوو (Weight History)',
      weightSub: 'تۆمارەکانی کێش، تێبینییەکان و شیکاری گۆڕانکاری کێشی لەش',
      addWeight: 'کێشی نوێ (kg):',
      addWeightDate: 'بەروار:',
      addWeightNote: 'تێبینی:'
    },
    subviewExtra: {
      thAttDate: 'بەروار (Date)',
      thAttIn: 'کاتی هاتن (Check-In)',
      thAttOut: 'کاتی چوونەدەرەوە (Check-Out)',
      thAttDuration: 'ماوەی مانەوە لە هۆڵ',
      thAttStatus: 'دۆخ',
      thSubPlan: 'جۆری بەشداری',
      thSubStart: 'بەرواری دەستپێک',
      thSubEnd: 'بەرواری بەسەرچوون',
      thSubPrice: 'نرخی وەرگیراو',
      thSubDisc: 'داشکاندن',
      thSubStatus: 'دۆخ',
      btnSaveWeight: '+ تۆمارکردنی کێش',
      weightNotePlaceholder: 'پێوانی بەیانیان، پاش ڕاهێنان...',
      thWeightDate: 'بەرواری پێوان',
      thWeightKg: 'کێش (kg)',
      thWeightDiff: 'گۆڕانکاری بەراورد بە پێشوو',
      thWeightNote: 'تێبینی'
    },
    plans: {
      tabWorkout: 'بەرنامەکانی ڕاهێنان (Workout Plans)',
      tabDiet: 'سیستەمەکانی خۆراک و ڕجیم (Diet Plans)',
      workoutTitle: 'پلانەکانی ڕاهێنان',
      workoutSub: 'بەڕێوەبردن، دابەشکردنی ڕۆژەکان و بەستنەوەی بە ڕاهێنانەکان',
      newWorkoutBtn: '+ دروستکردنی پلانی نوێ (پەیج)',
      bcWorkout: 'پلانەکانی ڕاهێنان',
      newPlanTitle: 'دروستکردنی پلانی نوێ',
      cancelBtn: 'پاشگەزبوونەوە',
      savePlanBtn: 'پاشەکەوتکردنی پلان لە Excel',
      planNameLabel: 'ناوی پلان *',
      planNamePlaceholder: 'بۆ نموونە: پلانی دابەزاندنی کێش یان هایپەرتڕۆفی',
      planDescLabel: 'وەسفی کورت دەربارەی پلان',
      planDescPlaceholder: 'ئامانج و تایبەتمەندی و تێبینی گشتی ئەم پلانە بنووسە...',
      kanbanTitle: 'ڕۆژەکانی ڕاهێنان و دیاریکردنی ڕاهێنانەکان (Drag & Drop)',
      kanbanSub: 'دەتوانیت ڕاهێنانەکان لە ڕۆژێکەوە بۆ ڕۆژێکی تر ڕابکێشیت (Drag & Drop) یان ڕیزبەندییان بگۆڕیت',
      addDayBtn: '+ زیادکردنی ڕۆژ',
      dietTitle: 'سیستەمەکانی خۆراک و ڕجیم (Diet & Nutrition)',
      dietSub: 'بەڕێوەبردنی سیستەمی خۆراکی تەواو بەپێی کالۆری، ماکرۆس، و ژەمەکان بۆ بەشداربووان',
      newDietBtn: '+ دروستکردنی پلانی خۆراکی نوێ (پەیج)',
      bcDiet: 'سیستەمەکانی خۆراک',
      newDietTitle: 'دروستکردنی پلانی خۆراکی نوێ',
      saveDietBtn: 'پاشەکەوتکردنی پلانی خۆراک لە Excel',
      dietNameLabel: 'ناوی پلانی خۆراک *',
      dietNamePlaceholder: 'بۆ نموونە: پلانی کەت و دابەزاندنی چەوری',
      dietGoalLabel: 'ئامانجی بەرنامەکە (Goal)',
      dietDescLabel: 'وەسفی کورت',
      dietDescPlaceholder: 'تێبینی گشتی و شێوازی جێبەجێکردن...'
    },
    finances: {
      subRev: 'داهاتی ئابوونەی هۆڵ',
      storeRev: 'داهاتی فرۆشگا (Store)',
      expenses: 'کۆی مەسروفات (خەرجی)',
      netProfit: 'داهاتی پوخت (قازانج)',
      subBadge: 'ئابوونە و بەشدارییەکان',
      storeBadge: 'فرۆشتنی کەلوپەل و خواردنەوەکان',
      expBadge: 'کرێ، مووچە و پێداویستییەکان',
      btnToday: 'ئەمڕۆ (Today)',
      btnMonth: 'ئەم مانگە (This Month)',
      btnYear: 'ئەمساڵ (This Year)',
      btnAll: 'هەمووی (All)',
      tabExpenses: 'تۆماری مەسروفات (Expenses)',
      tabMembers: 'داهاتی بەشداربووان (Memberships)',
      tabSales: 'فرۆشتنی کاڵا (Store Sales)',
      tabComparison: 'بەراوردکاری دارایی (Analytics & Comparison)'
    },
    financesExtra: {
      expensesTitle: 'لیستی مەسروفات و خەرجییەکان',
      expensesSub: 'کرێ، کارەبا، مووچە و پێداویستییەکان لەگەڵ خەرجی دووبارەبووەوە',
      newExpenseBtn: '+ خەرجی نوێ',
      thExpTitle: 'ناونیشان',
      thExpCategory: 'جۆر',
      thExpAmount: 'بڕ (IQD)',
      thExpRecurring: 'دووبارەبوونەوە (Recurring)',
      thExpDate: 'بەروار',
      thExpAction: 'کردار',
      membersIncomeTitle: 'داهاتی ئابوونە و بەشدارییەکان',
      thIncMemberCode: 'کۆدی یاریزان',
      thIncFullName: 'ناوی تەواو',
      thIncSubType: 'جۆری بەشداری',
      thIncPrice: 'نرخ',
      thIncDiscount: 'داشکاندن',
      thIncPaid: 'پارەی وەرگیراو',
      thIncStartDate: 'بەرواری دەستپێک',
      salesTitle: 'مێژووی فرۆشتنی کاڵاکانی فرۆشگا',
      newSaleBtn: '+ فرۆشتنی نوێ',
      thSaleItemName: 'ناوی کاڵا',
      thSaleCustomer: 'کڕیار',
      thSaleQuantity: 'دانە',
      thSaleUnitPrice: 'نرخی یەکە',
      thSaleTotal: 'کۆی گشتی',
      thSaleDate: 'بەروار',
      compTitle: 'بەراوردکاری و شیتاڵکاری نێوان داهات، فرۆشتن و مەسروفات',
      compSub: 'بەراوردکردنی ڕێژەی قازانج و داهاتەکان بەپێی کات',
      compChartTitle: 'چارتی بەراوردکاری مانگانەی داهات و مەسروفات'
    },
    store: {
      title: 'فرۆشگای هۆڵ (Store & Barcode POS)',
      subtitle: 'کاڵاکان بەپێی بەشەکان، سکانی بارکۆد، پڕفرۆشترینەکان، و کاڵا نزیک لە بەسەرچووەکان',
      manualSell: '🛒 فرۆشتن بە دەست',
      newItem: '+ کاڵای نوێ',
      tabItems: 'سەرجەم کاڵاکان و POS',
      tabTopSellers: '🔥 زۆرترین فرۆشراوەکان (Top Sellers)',
      tabExpiring: '⏳ نزیک لە بەسەرچوون (Expiring Items)',
      barcodePlaceholder: '📷 بارکۆد لێبدە یان بە ئامێری بارکۆد سکانی بکە و Enter دابگرە...',
      sellBarcodeBtn: 'فرۆشتنی بارکۆد',
      topSellersTitle: 'ڕیزبەندی پڕفرۆشترین کاڵاکانی هۆڵ (Best Sellers)',
      topSellersSub: 'ئەو کاڵایانەی زۆرترین خواست و زۆرترین داهاتیان هەبووە',
      expiringTitle: 'لیستی کاڵاکانی نزیک لە بەسەرچوون و بەسەرچووەکان',
      expiringSub: 'چاودێری ڕێکەوتی بەسەرچوونی تەواوکەرە خۆراکییەکان، خواردنەوە و پرۆتینەکان',
      thItemName: 'کاڵا',
      thItemCategory: 'جۆر',
      thItemStock: 'مەخزەن (مەوجود)',
      thItemExpiry: 'بەرواری بەسەرچوون',
      thItemDaysLeft: 'ڕۆژی ماوە',
      thItemStatus: 'دۆخ'
    },
    staff: {
      title: 'ستاف و کارمەندانی هۆڵ (Staff & Roles)',
      subtitle: 'بەڕێوەبردنی کارمەندان، مووچە، و دەسەڵاتەکانی بەشەکانی سیستەم',
      newStaffBtn: '+ کارمەندی نوێ',
      thCode: 'کۆد',
      thName: 'ناوی سیانی',
      thRole: 'ڕۆڵ / پلە',
      thPhone: 'مۆبایل',
      thSalary: 'مووچەی مانگانە',
      thPerms: 'دەسەڵاتەکان (Permissions)',
      thStatus: 'دۆخ',
      thAction: 'کردار'
    },
    notifications: {
      newNotifTitle: 'ناردنی ئاگاداری نوێ',
      lblTitle: 'سەردێڕی ئاگاداری *',
      titlePlaceholder: 'بۆ نموونە: پشووی فەرمی، نوێکردنەوەی پلان',
      lblMsg: 'دەقی ئاگاداری *',
      msgPlaceholder: 'دەقی تەواوی پەیامەکە بنووسە...',
      lblTarget: 'ئاراستەکردن بۆ (کێ پێی بگات؟) *',
      targetAll: '📢 گشت بەشداربووان (Broadcast)',
      targetMember: '👤 بەشداربووی دیاریکراو (Specific Member)',
      lblSelectMember: 'بەشداربوو هەڵبژێرە:',
      sendBtn: 'ناردنی ئاگاداری بۆ Excel',
      sentTitle: 'ئاگادارییە نێردراوەکان (Sent Notifications)',
      sentSub: 'ئەو ئاگادارییانەی لە ناو سیستەم و پۆڕتاڵی یاریزانان دەردەکەون',
      thTitle: 'سەردێڕ',
      thMsg: 'دەقی ئاگاداری',
      thTarget: 'ئاراستەکراو',
      thDate: 'بەروار',
      thAction: 'کردار'
    },
    settings: {
      tabGeneral: 'زانیارییە گشتییەکان و ئەباوت',
      tabSubscriptions: 'جۆرەکانی بەشداریکردن',
      tabExercises: 'کتێبخانەی ڕاهێنانەکان',
      tabBackup: 'داگرتن و باکئەپی داتاکان',
      generalTitle: 'ڕێکخستنی ناوی هۆڵ و زانیاری دەربارەی ئێمە (About Us)',
      gymName: 'ناوی هۆڵ',
      currency: 'دراو (Currency)',
      logoUrl: 'لینکی وێنەی لۆگۆ',
      kioskBg: 'وێنەی باکگراوەندی پەڕەی چێک ئین (Kiosk Background Image URL)',
      bio: 'وەسف دەربارەی هۆڵ (About / Bio) بۆ ئەپی بەشداربوو',
      phone: 'ژمارەی مۆبایل',
      whatsapp: 'ژمارەی واتسئەپ (WhatsApp)',
      address: 'ناونیشانی هۆڵ (Location / Address)',
      workHours: 'کاتژمێرەکانی کارکردن (Working Hours)',
      social: 'تۆڕە کۆمەڵایەتییەکان:',
      saveSettingsBtn: 'پاشەکەوتکردنی زانیارییەکان لە Excel',
      subTypesTitle: 'جۆرەکانی بەشداریکردن',
      subTypesSub: 'ئەم بەشانە لە درۆپداونی زیادکردنی بەشداربووی نوێ بەکاردێن',
      newSubTypeBtn: '+ جۆری نوێ',
      thStCode: 'کۆد',
      thStName: 'ناوی بەشداری',
      thStDuration: 'ماوە (ڕۆژ)',
      thStPrice: 'نرخی بنەڕەتی (IQD)',
      thStDesc: 'وەسف',
      thStAction: 'کردار',
      exTitle: 'کتێبخانەی ڕاهێنانەکان (Exercise Library)',
      exSub: 'دروستکردنی ڕاهێنان بۆ بەستنەوەی ڕاستەوخۆ بە پلانەکان',
      newExBtn: '+ ڕاهێنانی نوێ',
      thExName: 'ناوی ڕاهێنان',
      thExMuscle: 'بەشی ماسولکە',
      thExSetsReps: 'کۆمەڵە / دووبارە',
      thExVideo: 'ڤیدیۆ',
      thExAction: 'کردار',
      backupTitle: 'داگرتن و باکئەپی داتاکان (Export & Database Backup)',
      backupSub: 'داگرتنی ڕاستەوخۆی فایلی Excel یان ناردن و پاشەکەوتکردنی خۆکارانەی مانگانە و ساڵانە',
      manualBackupTitle: 'داگرتنی دەستی (Direct Manual Downloads)',
      downloadDbBtn: 'داگرتنی فایلی Excel<br><span class="text-[10px] text-emerald-600 font-mono">(gym_database.xlsx)</span>',
      autoBackupTitle: 'ڕێکخستنی باکئەپی خۆکارانە (مانگانە / ساڵانە)',
      autoBackupFreq: 'شێوازی باکئەپ و هەناردەکردن:',
      freqMonthly: 'مانگانە (لە کۆتایی هەر مانگێک هەناردە دەکرێت)',
      freqYearly: 'ساڵانە (لە کۆتایی هەر ساڵێک باکئەپی تەواو دەکرێت)',
      freqWeekly: 'هەفتانە (لە کۆتایی هەموو هەفتەیەک)',
      freqManual: 'تەنها بە دەست (Manual Only)',
      autoBackupNotify: 'ئاگادارکردنەوەی خۆکارانە (Auto-Prompt / Alert):',
      notifyEnabled: 'چالاکە — لەسەر شاشە بیرهێنانەوە نیشان بدە',
      notifyDisabled: 'ناچالاکە',
      lastBackupLabel: 'دواین باکئەپ و پاشەکەوتی فایلی Excel:',
      saveAutoBackupBtn: 'پاشەکەوتکردنی ڕێکخستنی باکئەپ'
    },
    qc: {
      title: 'ئامادەبوونی بەشداربووان (Check-in & Check-out)',
      subtitle: 'چێک ئین و چێک ئاوتی دەستی بۆ بەشداربووانی هۆڵ بە یەک کلیک',
      filterAll: 'هەموو بەشداربووان',
      filterInside: '🟢 لە هۆڵدان',
      filterOutside: '⚪ لە دەرەوەن',
      search: 'گەڕان بەپێی ناو، کۆد، یان مۆبایل...',
      close: 'داخستن'
    }
  },
  en: {
    appTitle: 'Gym Pro — Advanced Gym Management System',
    langBtnText: 'کوردی',
    sidebarGymSubText: 'Gym System (Excel Database)',
    navDashboard: 'Dashboard',
    navMembers: 'Members',
    navPlans: 'Plans & Nutrition',
    navFinances: 'Finances',
    navStore: 'Store & POS',
    navStaff: 'Staff & Team',
    navNotifications: 'Notifications',
    navCheckin: 'Check-in Page',
    navMemberPortal: 'Member Portal',
    navSettings: 'Settings',
    navLogout: 'Log Out',
    titles: {
      dashboard: 'Dashboard',
      members: 'Members',
      plans: 'Workout & Diet Plans',
      finances: 'Finances & Accounting',
      store: 'Store & POS',
      staff: 'Staff & Team',
      notifications: 'Notifications',
      settings: 'Settings & Backup'
    },
    subtitles: {
      dashboard: 'Overview of gym operations, revenues, store, staff & notifications',
      members: 'Registration, management and attendance history',
      plans: 'Custom workout routines & tailored nutrition programs',
      finances: 'Income, operating expenses, sales history & analytics',
      store: 'Inventory management, barcode point-of-sale & restock alerts',
      staff: 'User accounts, permissions, roles and monthly payroll',
      notifications: 'Broadcast announcements and direct member alerts',
      settings: 'Gym details, memberships, exercise library and backups'
    },
    login: {
      title: 'Staff Sign-In',
      subtitle: 'Gym Management & Accounting System',
      userLabel: 'Username',
      passLabel: 'Password',
      submitBtn: 'Sign In to Dashboard',
      demoAccounts: 'Ready accounts from Excel database:'
    },
    kpi: {
      members: 'Total Members',
      todayRev: "Today's Revenue (Daily)",
      gym: 'Gym:',
      store: 'Store:',
      monthRev: 'Monthly Revenue',
      todayAtt: "Today's Attendance",
      attTrend: 'Attendance Trend',
      growth: 'Members Growth',
      attTitle: "Today's Attendance (Check-in & Check-out)",
      attSub: 'List of members checked in today via kiosk or admin',
      thAttMember: 'Member',
      thAttCode: 'Code',
      thAttSub: 'Membership',
      thAttTrainer: 'Trainer',
      thAttIn: 'Check-In Time',
      thAttOut: 'Check-Out Time',
      thAttStatus: 'Status',
      quickActions: 'Quick Actions',
      newMember: '+ New Member',
      quickCheckin: '✓ Quick Check-in',
      quickSale: '🛒 Quick Store Sale',
      quickExpense: '+ Record Expense'
    },
    members: {
      searchPlaceholder: 'Search by name or code...',
      addBtn: 'Add Member',
      thPhotoCode: 'Photo / Code',
      thName: 'Name',
      thSub: 'Membership Type',
      thPriceDisc: 'Price / Discount',
      thWeight: 'Weight',
      thPlan: 'Workout Plan',
      thExpiry: 'Expiry Date',
      thStatus: 'Status',
      thActions: 'Actions'
    },
    subview: {
      bcMembers: 'Members',
      bcEdit: 'Edit Member',
      btnPrintPlan: 'Print Plan (PDF / Print)',
      btnPortal: 'Member Portal',
      btnClose: 'Back',
      formTitle: 'Member Details',
      photo: 'Member Photo',
      upload: 'Choose Photo',
      cam: 'Camera',
      name: 'Full Name *',
      phone: 'Phone Number',
      gender: 'Gender',
      subType: 'Subscription Type *',
      price: 'Base Price (IQD)',
      discount: 'Discount (IQD)',
      final: 'Total Price (IQD)',
      start: 'Start Date',
      expiry: 'Expiry Date',
      weight: 'Current Weight (kg)',
      height: 'Height (cm)',
      status: 'Membership Status',
      wPlan: 'Workout Plan',
      dPlan: 'Diet Plan',
      trainer: 'Personal Trainer',
      notes: 'Notes & Instructions',
      cancel: 'Cancel',
      save: 'Save Changes',
      attTitle: '1- Attendance History (Check-in & Check-out Logs)',
      attSub: 'Complete log of entry and exit times at the gym',
      subTitle: '2- Subscription & Renewal History',
      subSub: 'Active plan status and past subscription payment records',
      renewBtn: '+ Renew Subscription for 1 Month',
      curType: 'Active Subscription',
      curStatus: 'Membership Status',
      daysLeft: 'Remaining Days',
      paidAmount: 'Paid Amount',
      weightTitle: '3- Weight & BMI History',
      weightSub: 'Weight track records, notes and progress analytics',
      addWeight: 'New Weight (kg):',
      addWeightDate: 'Date:',
      addWeightNote: 'Notes:'
    },
    subviewExtra: {
      thAttDate: 'Date',
      thAttIn: 'Check-In Time',
      thAttOut: 'Check-Out Time',
      thAttDuration: 'Gym Duration',
      thAttStatus: 'Status',
      thSubPlan: 'Subscription Plan',
      thSubStart: 'Start Date',
      thSubEnd: 'Expiry Date',
      thSubPrice: 'Charged Amount',
      thSubDisc: 'Discount',
      thSubStatus: 'Status',
      btnSaveWeight: '+ Record Weight',
      weightNotePlaceholder: 'Morning check, post-workout...',
      thWeightDate: 'Measurement Date',
      thWeightKg: 'Weight (kg)',
      thWeightDiff: 'Progress vs Previous',
      thWeightNote: 'Notes'
    },
    plans: {
      tabWorkout: 'Workout Plans',
      tabDiet: 'Diet & Nutrition Plans',
      workoutTitle: 'Workout Plans',
      workoutSub: 'Manage routines, assign days and connect to exercise library',
      newWorkoutBtn: '+ Create New Plan (Page)',
      bcWorkout: 'Workout Plans',
      newPlanTitle: 'Create Workout Plan',
      cancelBtn: 'Cancel',
      savePlanBtn: 'Save Plan to Excel',
      planNameLabel: 'Plan Name *',
      planNamePlaceholder: 'e.g., Weight Loss or Hypertrophy Routine',
      planDescLabel: 'Short Description',
      planDescPlaceholder: 'Goals, routine guidelines and notes...',
      kanbanTitle: 'Workout Days & Exercises (Drag & Drop)',
      kanbanSub: 'Drag exercises between days or reorder within routines',
      addDayBtn: '+ Add Day',
      dietTitle: 'Diet & Nutrition Plans',
      dietSub: 'Comprehensive nutrition programs with calories, macros, and scheduled meals',
      newDietBtn: '+ Create New Diet Plan (Page)',
      bcDiet: 'Diet Plans',
      newDietTitle: 'Create Diet Plan',
      saveDietBtn: 'Save Diet Plan to Excel',
      dietNameLabel: 'Diet Plan Name *',
      dietNamePlaceholder: 'e.g., Lean Cut & Fat Loss Program',
      dietGoalLabel: 'Program Goal',
      dietDescLabel: 'Short Description',
      dietDescPlaceholder: 'General notes and meal instructions...'
    },
    finances: {
      subRev: 'Gym Membership Revenue',
      storeRev: 'Store Revenue',
      expenses: 'Total Expenses',
      netProfit: 'Net Profit / Loss',
      subBadge: 'Memberships & Renewals',
      storeBadge: 'Supplements & Beverages',
      expBadge: 'Rent, Salaries & Utilities',
      btnToday: 'Today',
      btnMonth: 'This Month',
      btnYear: 'This Year',
      btnAll: 'All Time',
      tabExpenses: 'Expenses Log',
      tabMembers: 'Membership Revenue',
      tabSales: 'Store Sales',
      tabComparison: 'Analytics & Comparison'
    },
    financesExtra: {
      expensesTitle: 'Expenses & Overhead Log',
      expensesSub: 'Rent, electricity, salaries, equipment & recurring overheads',
      newExpenseBtn: '+ New Expense',
      thExpTitle: 'Title',
      thExpCategory: 'Category',
      thExpAmount: 'Amount (IQD)',
      thExpRecurring: 'Recurring',
      thExpDate: 'Date',
      thExpAction: 'Action',
      membersIncomeTitle: 'Membership & Renewal Revenue',
      thIncMemberCode: 'Member Code',
      thIncFullName: 'Full Name',
      thIncSubType: 'Membership Type',
      thIncPrice: 'Base Price',
      thIncDiscount: 'Discount',
      thIncPaid: 'Paid Amount',
      thIncStartDate: 'Start Date',
      salesTitle: 'Store Sales History',
      newSaleBtn: '+ New Sale',
      thSaleItemName: 'Product Name',
      thSaleCustomer: 'Customer',
      thSaleQuantity: 'Qty',
      thSaleUnitPrice: 'Unit Price',
      thSaleTotal: 'Total',
      thSaleDate: 'Date',
      compTitle: 'Financial Comparison & Analytics',
      compSub: 'Track profit margins, operational overheads and monthly revenue',
      compChartTitle: 'Monthly Income vs Expenses Comparison Chart'
    },
    store: {
      title: 'Gym Store & Barcode POS',
      subtitle: 'Categorized inventory, barcode scanning, best sellers, and expiry alerts',
      manualSell: '🛒 Manual Sale',
      newItem: '+ New Product',
      tabItems: 'All Items & POS',
      tabTopSellers: '🔥 Top Sellers',
      tabExpiring: '⏳ Expiring Items',
      barcodePlaceholder: '📷 Scan barcode with scanner or type and press Enter...',
      sellBarcodeBtn: 'Scan & Sell',
      topSellersTitle: 'Top Selling Products (Best Sellers)',
      topSellersSub: 'Products with highest customer demand and revenue',
      expiringTitle: 'Near-Expiry & Expired Inventory',
      expiringSub: 'Monitor expiry dates for supplements, drinks and protein snacks',
      thItemName: 'Product',
      thItemCategory: 'Category',
      thItemStock: 'Stock',
      thItemExpiry: 'Expiry Date',
      thItemDaysLeft: 'Days Left',
      thItemStatus: 'Status'
    },
    staff: {
      title: 'Staff & Team (Staff & Roles)',
      subtitle: 'Manage gym personnel, salaries, access credentials and permissions',
      newStaffBtn: '+ New Staff Member',
      thCode: 'Code',
      thName: 'Full Name',
      thRole: 'Role',
      thPhone: 'Phone',
      thSalary: 'Monthly Salary',
      thPerms: 'Permissions',
      thStatus: 'Status',
      thAction: 'Action'
    },
    notifications: {
      newNotifTitle: 'Send New Notification',
      lblTitle: 'Notification Title *',
      titlePlaceholder: 'e.g., Holiday Notice, Routine Update',
      lblMsg: 'Notification Message *',
      msgPlaceholder: 'Write the complete notification message...',
      lblTarget: 'Recipient Target *',
      targetAll: '📢 All Members (Broadcast)',
      targetMember: '👤 Specific Member',
      lblSelectMember: 'Select Member:',
      sendBtn: 'Send Notification to Excel',
      sentTitle: 'Sent Notifications',
      sentSub: 'Notifications broadcasted to members and shown on their portal',
      thTitle: 'Title',
      thMsg: 'Message',
      thTarget: 'Target',
      thDate: 'Date',
      thAction: 'Action'
    },
    settings: {
      tabGeneral: 'General Info & About',
      tabSubscriptions: 'Membership Types',
      tabExercises: 'Exercise Library',
      tabBackup: 'Data Backup & Export',
      generalTitle: 'Gym Information & About Us',
      gymName: 'Gym Name',
      currency: 'Currency',
      logoUrl: 'Logo Image URL',
      kioskBg: 'Kiosk Background Image URL',
      bio: 'About / Gym Bio for Member App',
      phone: 'Phone Number',
      whatsapp: 'WhatsApp Number',
      address: 'Location / Address',
      workHours: 'Working Hours',
      social: 'Social Media Accounts:',
      saveSettingsBtn: 'Save Settings to Excel',
      subTypesTitle: 'Membership Packages',
      subTypesSub: 'These subscription types appear when registering new members',
      newSubTypeBtn: '+ New Package',
      thStCode: 'Code',
      thStName: 'Plan Name',
      thStDuration: 'Duration (Days)',
      thStPrice: 'Base Price (IQD)',
      thStDesc: 'Description',
      thStAction: 'Action',
      exTitle: 'Exercise Library',
      exSub: 'Create reusable exercises to build workout plan routines',
      newExBtn: '+ New Exercise',
      thExName: 'Exercise Name',
      thExMuscle: 'Target Muscle',
      thExSetsReps: 'Sets / Reps',
      thExVideo: 'Video Demo',
      thExAction: 'Action',
      backupTitle: 'Export & Database Backup',
      backupSub: 'Direct manual Excel download or automated monthly/yearly database backup',
      manualBackupTitle: 'Direct Manual Downloads',
      downloadDbBtn: 'Download Database<br><span class="text-[10px] text-emerald-600 font-mono">(gym_database.xlsx)</span>',
      autoBackupTitle: 'Automated Backup Settings',
      autoBackupFreq: 'Backup Frequency:',
      freqMonthly: 'Monthly (exported at the end of each month)',
      freqYearly: 'Yearly (full database archived annually)',
      freqWeekly: 'Weekly (every weekend)',
      freqManual: 'Manual Only',
      autoBackupNotify: 'Automated Alert Prompt:',
      notifyEnabled: 'Enabled — show on-screen backup reminder',
      notifyDisabled: 'Disabled',
      lastBackupLabel: 'Last Backup on Excel Database:',
      saveAutoBackupBtn: 'Save Backup Settings'
    },
    qc: {
      title: 'Member Attendance (Check-in & Check-out)',
      subtitle: 'One-click check-in and check-out dialog for all members',
      filterAll: 'All Members',
      filterInside: '🟢 In Gym',
      filterOutside: '⚪ Outside',
      search: 'Search by name, code, or phone...',
      close: 'Close'
    }
  }
};

function toggleAppLanguage() {
  const nextLang = currentAppLanguage === 'ku' ? 'en' : 'ku';
  applyAppLanguage(nextLang);
}

function applyAppLanguage(lang) {
  currentAppLanguage = lang;
  localStorage.setItem('gymAppLanguage', lang);

  const html = document.getElementById('appHtml');
  const isEn = lang === 'en';
  const t = APP_TRANSLATIONS[lang] || APP_TRANSLATIONS.ku;

  if (html) {
    html.setAttribute('lang', lang);
    html.setAttribute('dir', isEn ? 'ltr' : 'rtl');
  }

  if ($('adminAppTitle')) $('adminAppTitle').textContent = t.appTitle;
  if ($('appLangBtnText')) $('appLangBtnText').textContent = t.langBtnText;

  // Sidebar navigation texts
  if ($('sidebarGymSubText')) $('sidebarGymSubText').textContent = t.sidebarGymSubText;
  if ($('navDashboardText')) $('navDashboardText').textContent = t.navDashboard;
  if ($('navMembersText')) $('navMembersText').textContent = t.navMembers;
  if ($('navPlansText')) $('navPlansText').textContent = t.navPlans;
  if ($('navFinancesText')) $('navFinancesText').textContent = t.navFinances;
  if ($('navStoreText')) $('navStoreText').textContent = t.navStore;
  if ($('navStaffText')) $('navStaffText').textContent = t.navStaff;
  if ($('navNotificationsText')) $('navNotificationsText').textContent = t.navNotifications;
  if ($('navCheckinPageText')) $('navCheckinPageText').textContent = t.navCheckin;
  if ($('navMemberPortalText')) $('navMemberPortalText').textContent = t.navMemberPortal;
  if ($('navLogoutText')) $('navLogoutText').textContent = t.navLogout;
  if ($('navSettingsText')) $('navSettingsText').textContent = t.navSettings;

  // Current active view title & subtitle
  const activeView = document.querySelector('.view.active')?.id || 'dashboard';
  if ($('pageTitle') && t.titles[activeView]) $('pageTitle').textContent = t.titles[activeView];
  if ($('pageSubTitle') && t.subtitles[activeView]) $('pageSubTitle').textContent = t.subtitles[activeView];

  // Login View
  if (t.login) {
    if ($('lblLoginTitle')) $('lblLoginTitle').textContent = t.login.title;
    if ($('lblLoginSub')) $('lblLoginSub').textContent = t.login.subtitle;
    if ($('lblLoginUser')) $('lblLoginUser').textContent = t.login.userLabel;
    if ($('lblLoginPass')) $('lblLoginPass').textContent = t.login.passLabel;
    if ($('btnLoginSubmit')) $('btnLoginSubmit').textContent = t.login.submitBtn;
    if ($('lblLoginDemo')) $('lblLoginDemo').textContent = t.login.demoAccounts;
  }

  // Dashboard KPIs
  if ($('lblKpiMembers')) $('lblKpiMembers').textContent = t.kpi.members;
  if ($('lblKpiTodayRev')) $('lblKpiTodayRev').innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> ${t.kpi.todayRev}`;
  if ($('lblKpiTodayGym')) $('lblKpiTodayGym').textContent = t.kpi.gym;
  if ($('lblKpiTodayStore')) $('lblKpiTodayStore').textContent = t.kpi.store;
  if ($('lblKpiMonthRev')) $('lblKpiMonthRev').textContent = t.kpi.monthRev;
  if ($('lblKpiMonthGym')) $('lblKpiMonthGym').textContent = t.kpi.gym;
  if ($('lblKpiMonthStore')) $('lblKpiMonthStore').textContent = t.kpi.store;
  if ($('lblKpiTodayAtt')) $('lblKpiTodayAtt').textContent = t.kpi.todayAtt;
  if ($('lblAttTrend')) $('lblAttTrend').textContent = t.kpi.attTrend;
  if ($('lblMemberGrowth')) $('lblMemberGrowth').textContent = t.kpi.growth;
  if ($('lblTodayAttTitle')) $('lblTodayAttTitle').textContent = t.kpi.attTitle;
  if ($('lblTodayAttSub')) $('lblTodayAttSub').textContent = t.kpi.attSub;
  if ($('thAttMember')) $('thAttMember').textContent = t.kpi.thAttMember;
  if ($('thAttCode')) $('thAttCode').textContent = t.kpi.thAttCode;
  if ($('thAttSub')) $('thAttSub').textContent = t.kpi.thAttSub;
  if ($('thAttTrainer')) $('thAttTrainer').textContent = t.kpi.thAttTrainer;
  if ($('thAttIn')) $('thAttIn').textContent = t.kpi.thAttIn;
  if ($('thAttOut')) $('thAttOut').textContent = t.kpi.thAttOut;
  if ($('thAttStatus')) $('thAttStatus').textContent = t.kpi.thAttStatus;
  if ($('lblQuickActions')) $('lblQuickActions').textContent = t.kpi.quickActions;
  if ($('btnQuickNewMember')) $('btnQuickNewMember').textContent = t.kpi.newMember;
  if ($('btnQuickCheckin')) $('btnQuickCheckin').textContent = t.kpi.quickCheckin;
  if ($('btnQuickSale')) $('btnQuickSale').textContent = t.kpi.quickSale;
  if ($('btnQuickExpense')) $('btnQuickExpense').textContent = t.kpi.quickExpense;

  // Members View
  if ($('btnAddMemberBtnText')) $('btnAddMemberBtnText').textContent = t.members.addBtn;
  if ($('memberSearch')) $('memberSearch').placeholder = t.members.searchPlaceholder;
  if ($('thMemPhotoCode')) $('thMemPhotoCode').textContent = t.members.thPhotoCode;
  if ($('thMemName')) $('thMemName').textContent = t.members.thName;
  if ($('thMemSub')) $('thMemSub').textContent = t.members.thSub;
  if ($('thMemPriceDisc')) $('thMemPriceDisc').textContent = t.members.thPriceDisc;
  if ($('thMemWeight')) $('thMemWeight').textContent = t.members.thWeight;
  if ($('thMemPlan')) $('thMemPlan').textContent = t.members.thPlan;
  if ($('thMemExpiry')) $('thMemExpiry').textContent = t.members.thExpiry;
  if ($('thMemStatus')) $('thMemStatus').textContent = t.members.thStatus;
  if ($('thMemActions')) $('thMemActions').textContent = t.members.thActions;

  // Edit Member Subview
  if ($('bcMembersLabel')) $('bcMembersLabel').textContent = t.subview.bcMembers;
  if ($('bcEditMemberLabel')) $('bcEditMemberLabel').textContent = t.subview.bcEdit;
  if ($('btnSubViewPrintPlanText')) $('btnSubViewPrintPlanText').textContent = t.subview.btnPrintPlan;
  if ($('btnSubViewPortalText')) $('btnSubViewPortalText').textContent = t.subview.btnPortal;
  if ($('btnSubViewCloseText')) $('btnSubViewCloseText').textContent = t.subview.btnClose;
  if ($('lblSubViewFormTitle')) $('lblSubViewFormTitle').textContent = t.subview.formTitle;
  if ($('lblSubViewPhoto')) $('lblSubViewPhoto').textContent = t.subview.photo;
  if ($('lblSubViewUpload')) $('lblSubViewUpload').textContent = t.subview.upload;
  if ($('lblSubViewCam')) $('lblSubViewCam').textContent = t.subview.cam;
  if ($('lblSubViewName')) $('lblSubViewName').textContent = t.subview.name;
  if ($('lblSubViewPhone')) $('lblSubViewPhone').textContent = t.subview.phone;
  if ($('lblSubViewGender')) $('lblSubViewGender').textContent = t.subview.gender;
  if ($('lblSubViewSubType')) $('lblSubViewSubType').textContent = t.subview.subType;
  if ($('lblSubViewPrice')) $('lblSubViewPrice').textContent = t.subview.price;
  if ($('lblSubViewDiscount')) $('lblSubViewDiscount').textContent = t.subview.discount;
  if ($('lblSubViewFinal')) $('lblSubViewFinal').textContent = t.subview.final;
  if ($('lblSubViewStart')) $('lblSubViewStart').textContent = t.subview.start;
  if ($('lblSubViewExpiry')) $('lblSubViewExpiry').textContent = t.subview.expiry;
  if ($('lblSubViewWeight')) $('lblSubViewWeight').textContent = t.subview.weight;
  if ($('lblSubViewHeight')) $('lblSubViewHeight').textContent = t.subview.height;
  if ($('lblSubViewStatus')) $('lblSubViewStatus').textContent = t.subview.status;
  if ($('lblSubViewWPlan')) $('lblSubViewWPlan').textContent = t.subview.wPlan;
  if ($('lblSubViewDPlan')) $('lblSubViewDPlan').textContent = t.subview.dPlan;
  if ($('lblSubViewTrainer')) $('lblSubViewTrainer').textContent = t.subview.trainer;
  if ($('lblSubViewNotes')) $('lblSubViewNotes').textContent = t.subview.notes;
  if ($('btnCancelEditSubView')) $('btnCancelEditSubView').textContent = t.subview.cancel;
  if ($('btnSaveEditSubView')) $('btnSaveEditSubView').textContent = t.subview.save;
  if ($('lblSubViewAttTitle')) $('lblSubViewAttTitle').textContent = t.subview.attTitle;
  if ($('lblSubViewAttSub')) $('lblSubViewAttSub').textContent = t.subview.attSub;
  if ($('lblSubViewSubTitle')) $('lblSubViewSubTitle').textContent = t.subview.subTitle;
  if ($('lblSubViewSubSub')) $('lblSubViewSubSub').textContent = t.subview.subSub;
  if ($('btnSubViewRenewText')) $('btnSubViewRenewText').textContent = t.subview.renewBtn;
  if ($('lblSubCurrentType')) $('lblSubCurrentType').textContent = t.subview.curType;
  if ($('lblSubCurrentStatus')) $('lblSubCurrentStatus').textContent = t.subview.curStatus;
  if ($('lblSubDaysLeft')) $('lblSubDaysLeft').textContent = t.subview.daysLeft;
  if ($('lblSubPaidAmount')) $('lblSubPaidAmount').textContent = t.subview.paidAmount;
  if ($('lblSubViewWeightTitle')) $('lblSubViewWeightTitle').textContent = t.subview.weightTitle;
  if ($('lblSubViewWeightSub')) $('lblSubViewWeightSub').textContent = t.subview.weightSub;
  if ($('lblSubAddWeight')) $('lblSubAddWeight').textContent = t.subview.addWeight;
  if ($('lblSubAddWeightDate')) $('lblSubAddWeightDate').textContent = t.subview.addWeightDate;
  if ($('lblSubAddWeightNote')) $('lblSubAddWeightNote').textContent = t.subview.addWeightNote;

  // Subview extra table headers
  if (t.subviewExtra) {
    if ($('thSubAttDate')) $('thSubAttDate').textContent = t.subviewExtra.thAttDate;
    if ($('thSubAttIn')) $('thSubAttIn').textContent = t.subviewExtra.thAttIn;
    if ($('thSubAttOut')) $('thSubAttOut').textContent = t.subviewExtra.thAttOut;
    if ($('thSubAttDuration')) $('thSubAttDuration').textContent = t.subviewExtra.thAttDuration;
    if ($('thSubAttStatus')) $('thSubAttStatus').textContent = t.subviewExtra.thAttStatus;

    if ($('thSubSubPlan')) $('thSubSubPlan').textContent = t.subviewExtra.thSubPlan;
    if ($('thSubSubStart')) $('thSubSubStart').textContent = t.subviewExtra.thSubStart;
    if ($('thSubSubEnd')) $('thSubSubEnd').textContent = t.subviewExtra.thSubEnd;
    if ($('thSubSubPrice')) $('thSubSubPrice').textContent = t.subviewExtra.thSubPrice;
    if ($('thSubSubDisc')) $('thSubSubDisc').textContent = t.subviewExtra.thSubDisc;
    if ($('thSubSubStatus')) $('thSubSubStatus').textContent = t.subviewExtra.thSubStatus;

    if ($('btnSubSaveWeightText')) $('btnSubSaveWeightText').textContent = t.subviewExtra.btnSaveWeight;
    if ($('subViewNewWeightNote')) $('subViewNewWeightNote').placeholder = t.subviewExtra.weightNotePlaceholder;
    if ($('thSubWeightDate')) $('thSubWeightDate').textContent = t.subviewExtra.thWeightDate;
    if ($('thSubWeightKg')) $('thSubWeightKg').textContent = t.subviewExtra.thWeightKg;
    if ($('thSubWeightDiff')) $('thSubWeightDiff').textContent = t.subviewExtra.thWeightDiff;
    if ($('thSubWeightNote')) $('thSubWeightNote').textContent = t.subviewExtra.thWeightNote;
  }

  // Plans View
  if (t.plans) {
    if ($('txtTabWorkoutPlans')) $('txtTabWorkoutPlans').textContent = t.plans.tabWorkout;
    if ($('txtTabDietPlans')) $('txtTabDietPlans').textContent = t.plans.tabDiet;
    if ($('lblWorkoutPlansTitle')) $('lblWorkoutPlansTitle').textContent = t.plans.workoutTitle;
    if ($('lblWorkoutPlansSub')) $('lblWorkoutPlansSub').textContent = t.plans.workoutSub;
    if ($('btnNewWorkoutPlanPageText')) $('btnNewWorkoutPlanPageText').textContent = t.plans.newWorkoutBtn;
    if ($('bcWorkoutPlansText')) $('bcWorkoutPlansText').textContent = t.plans.bcWorkout;
    if ($('planBuilderTitleText')) $('planBuilderTitleText').textContent = t.plans.newPlanTitle;
    if ($('btnCancelWorkoutPlanText')) $('btnCancelWorkoutPlanText').textContent = t.plans.cancelBtn;
    if ($('btnSaveWorkoutPlanText')) $('btnSaveWorkoutPlanText').textContent = t.plans.savePlanBtn;
    if ($('lblWorkoutPlanName')) $('lblWorkoutPlanName').textContent = t.plans.planNameLabel;
    if ($('pbPlanName')) $('pbPlanName').placeholder = t.plans.planNamePlaceholder;
    if ($('lblWorkoutPlanDesc')) $('lblWorkoutPlanDesc').textContent = t.plans.planDescLabel;
    if ($('pbDescription')) $('pbDescription').placeholder = t.plans.planDescPlaceholder;
    if ($('lblKanbanDaysTitle')) $('lblKanbanDaysTitle').textContent = t.plans.kanbanTitle;
    if ($('lblKanbanDaysSub')) $('lblKanbanDaysSub').textContent = t.plans.kanbanSub;
    if ($('btnAddDayColumnText')) $('btnAddDayColumnText').textContent = t.plans.addDayBtn;

    if ($('dietPlansTitle')) $('dietPlansTitle').textContent = t.plans.dietTitle;
    if ($('dietPlansSubtitle')) $('dietPlansSubtitle').textContent = t.plans.dietSub;
    if ($('btnNewDietPlanPageText')) $('btnNewDietPlanPageText').textContent = t.plans.newDietBtn;
    if ($('bcDietPlansText')) $('bcDietPlansText').textContent = t.plans.bcDiet;
    if ($('dietPlanBuilderTitleText')) $('dietPlanBuilderTitleText').textContent = t.plans.newDietTitle;
    if ($('btnCancelDietPlanText')) $('btnCancelDietPlanText').textContent = t.plans.cancelBtn;
    if ($('btnSaveDietPlanText')) $('btnSaveDietPlanText').textContent = t.plans.saveDietBtn;
    if ($('lblDietPlanName')) $('lblDietPlanName').textContent = t.plans.dietNameLabel;
    if ($('dpbPlanName')) $('dpbPlanName').placeholder = t.plans.dietNamePlaceholder;
    if ($('lblDietPlanGoal')) $('lblDietPlanGoal').textContent = t.plans.dietGoalLabel;
    if ($('lblDietPlanDesc')) $('lblDietPlanDesc').textContent = t.plans.dietDescLabel;
    if ($('dpbDescription')) $('dpbDescription').placeholder = t.plans.dietDescPlaceholder;
  }

  // Finances
  if ($('lblFSubRev')) $('lblFSubRev').textContent = t.finances.subRev;
  if ($('lblFStoreRev')) $('lblFStoreRev').textContent = t.finances.storeRev;
  if ($('lblFExpenses')) $('lblFExpenses').textContent = t.finances.expenses;
  if ($('lblFNetProfit')) $('lblFNetProfit').textContent = t.finances.netProfit;
  if ($('lblFSubBadge')) $('lblFSubBadge').textContent = t.finances.subBadge;
  if ($('lblFStoreBadge')) $('lblFStoreBadge').textContent = t.finances.storeBadge;
  if ($('lblFExpBadge')) $('lblFExpBadge').textContent = t.finances.expBadge;
  if ($('fBtn-today')) $('fBtn-today').textContent = t.finances.btnToday;
  if ($('fBtn-month')) $('fBtn-month').textContent = t.finances.btnMonth;
  if ($('fBtn-year')) $('fBtn-year').textContent = t.finances.btnYear;
  if ($('fBtn-all')) $('fBtn-all').textContent = t.finances.btnAll;
  if ($('ftab-btn-expenses')) $('ftab-btn-expenses').innerHTML = `<i data-lucide="receipt" class="w-4 h-4"></i><span>${t.finances.tabExpenses}</span>`;
  if ($('ftab-btn-members')) $('ftab-btn-members').innerHTML = `<i data-lucide="users" class="w-4 h-4"></i><span>${t.finances.tabMembers}</span>`;
  if ($('ftab-btn-sales')) $('ftab-btn-sales').innerHTML = `<i data-lucide="shopping-cart" class="w-4 h-4"></i><span>${t.finances.tabSales}</span>`;
  if ($('ftab-btn-comparison')) $('ftab-btn-comparison').innerHTML = `<i data-lucide="bar-chart-3" class="w-4 h-4"></i><span>${t.finances.tabComparison}</span>`;

  // Finances extra table headers
  if (t.financesExtra) {
    if ($('lblFinExpensesTitle')) $('lblFinExpensesTitle').textContent = t.financesExtra.expensesTitle;
    if ($('lblFinExpensesSub')) $('lblFinExpensesSub').textContent = t.financesExtra.expensesSub;
    if ($('btnNewExpenseText')) $('btnNewExpenseText').textContent = t.financesExtra.newExpenseBtn;
    if ($('thExpTitle')) $('thExpTitle').textContent = t.financesExtra.thExpTitle;
    if ($('thExpCategory')) $('thExpCategory').textContent = t.financesExtra.thExpCategory;
    if ($('thExpAmount')) $('thExpAmount').textContent = t.financesExtra.thExpAmount;
    if ($('thExpRecurring')) $('thExpRecurring').textContent = t.financesExtra.thExpRecurring;
    if ($('thExpDate')) $('thExpDate').textContent = t.financesExtra.thExpDate;
    if ($('thExpAction')) $('thExpAction').textContent = t.financesExtra.thExpAction;

    if ($('lblFinMembersIncomeTitle')) $('lblFinMembersIncomeTitle').textContent = t.financesExtra.membersIncomeTitle;
    if ($('thIncMemberCode')) $('thIncMemberCode').textContent = t.financesExtra.thIncMemberCode;
    if ($('thIncFullName')) $('thIncFullName').textContent = t.financesExtra.thIncFullName;
    if ($('thIncSubType')) $('thIncSubType').textContent = t.financesExtra.thIncSubType;
    if ($('thIncPrice')) $('thIncPrice').textContent = t.financesExtra.thIncPrice;
    if ($('thIncDiscount')) $('thIncDiscount').textContent = t.financesExtra.thIncDiscount;
    if ($('thIncPaid')) $('thIncPaid').textContent = t.financesExtra.thIncPaid;
    if ($('thIncStartDate')) $('thIncStartDate').textContent = t.financesExtra.thIncStartDate;

    if ($('lblFinSalesTitle')) $('lblFinSalesTitle').textContent = t.financesExtra.salesTitle;
    if ($('btnNewSaleText')) $('btnNewSaleText').textContent = t.financesExtra.newSaleBtn;
    if ($('thSaleItemName')) $('thSaleItemName').textContent = t.financesExtra.thSaleItemName;
    if ($('thSaleCustomer')) $('thSaleCustomer').textContent = t.financesExtra.thSaleCustomer;
    if ($('thSaleQuantity')) $('thSaleQuantity').textContent = t.financesExtra.thSaleQuantity;
    if ($('thSaleUnitPrice')) $('thSaleUnitPrice').textContent = t.financesExtra.thSaleUnitPrice;
    if ($('thSaleTotal')) $('thSaleTotal').textContent = t.financesExtra.thSaleTotal;
    if ($('thSaleDate')) $('thSaleDate').textContent = t.financesExtra.thSaleDate;

    if ($('lblFinCompTitle')) $('lblFinCompTitle').textContent = t.financesExtra.compTitle;
    if ($('lblFinCompSub')) $('lblFinCompSub').textContent = t.financesExtra.compSub;
    if ($('lblFinCompChartTitle')) $('lblFinCompChartTitle').textContent = t.financesExtra.compChartTitle;
  }

  // Store
  if (t.store) {
    if ($('lblStoreTitle')) $('lblStoreTitle').textContent = t.store.title;
    if ($('lblStoreSub')) $('lblStoreSub').textContent = t.store.subtitle;
    if ($('btnManualSellText')) $('btnManualSellText').textContent = t.store.manualSell;
    if ($('btnNewItemText')) $('btnNewItemText').textContent = t.store.newItem;
    if ($('stab-btn-items-text')) $('stab-btn-items-text').textContent = t.store.tabItems;
    if ($('stab-btn-topSellers-text')) $('stab-btn-topSellers-text').textContent = t.store.tabTopSellers;
    if ($('stab-btn-expiring-text')) $('stab-btn-expiring-text').textContent = t.store.tabExpiring;
    if ($('storeBarcodeInput')) $('storeBarcodeInput').placeholder = t.store.barcodePlaceholder;
    if ($('btnSellByBarcodeText')) $('btnSellByBarcodeText').textContent = t.store.sellBarcodeBtn;
    if ($('lblStoreTopSellersTitle')) $('lblStoreTopSellersTitle').textContent = t.store.topSellersTitle;
    if ($('lblStoreTopSellersSub')) $('lblStoreTopSellersSub').textContent = t.store.topSellersSub;
    if ($('lblStoreExpiringTitle')) $('lblStoreExpiringTitle').textContent = t.store.expiringTitle;
    if ($('lblStoreExpiringSub')) $('lblStoreExpiringSub').textContent = t.store.expiringSub;
    if ($('thExpItemName')) $('thExpItemName').textContent = t.store.thItemName;
    if ($('thExpItemCategory')) $('thExpItemCategory').textContent = t.store.thItemCategory;
    if ($('thExpItemStock')) $('thExpItemStock').textContent = t.store.thItemStock;
    if ($('thExpItemExpiry')) $('thExpItemExpiry').textContent = t.store.thItemExpiry;
    if ($('thExpItemDaysLeft')) $('thExpItemDaysLeft').textContent = t.store.thItemDaysLeft;
    if ($('thExpItemStatus')) $('thExpItemStatus').textContent = t.store.thItemStatus;
  }

  // Staff
  if (t.staff) {
    if ($('lblStaffSectionTitle')) $('lblStaffSectionTitle').textContent = t.staff.title;
    if ($('lblStaffSectionSub')) $('lblStaffSectionSub').textContent = t.staff.subtitle;
    if ($('btnNewStaffText')) $('btnNewStaffText').textContent = t.staff.newStaffBtn;
    if ($('thStaffCode')) $('thStaffCode').textContent = t.staff.thCode;
    if ($('thStaffName')) $('thStaffName').textContent = t.staff.thName;
    if ($('thStaffRole')) $('thStaffRole').textContent = t.staff.thRole;
    if ($('thStaffPhone')) $('thStaffPhone').textContent = t.staff.thPhone;
    if ($('thStaffSalary')) $('thStaffSalary').textContent = t.staff.thSalary;
    if ($('thStaffPerms')) $('thStaffPerms').textContent = t.staff.thPerms;
    if ($('thStaffStatus')) $('thStaffStatus').textContent = t.staff.thStatus;
    if ($('thStaffAction')) $('thStaffAction').textContent = t.staff.thAction;
  }

  // Notifications
  if (t.notifications) {
    if ($('lblNewNotifTitle')) $('lblNewNotifTitle').textContent = t.notifications.newNotifTitle;
    if ($('lblNotifTitleField')) $('lblNotifTitleField').textContent = t.notifications.lblTitle;
    if ($('notifTitle')) $('notifTitle').placeholder = t.notifications.titlePlaceholder;
    if ($('lblNotifMsgField')) $('lblNotifMsgField').textContent = t.notifications.lblMsg;
    if ($('notifMessage')) $('notifMessage').placeholder = t.notifications.msgPlaceholder;
    if ($('lblNotifTargetField')) $('lblNotifTargetField').textContent = t.notifications.lblTarget;
    if ($('optNotifAll')) $('optNotifAll').textContent = t.notifications.targetAll;
    if ($('optNotifMember')) $('optNotifMember').textContent = t.notifications.targetMember;
    if ($('lblNotifTargetMember')) $('lblNotifTargetMember').textContent = t.notifications.lblSelectMember;
    if ($('btnSendNotifText')) $('btnSendNotifText').textContent = t.notifications.sendBtn;
    if ($('lblSentNotifsTitle')) $('lblSentNotifsTitle').textContent = t.notifications.sentTitle;
    if ($('lblSentNotifsSub')) $('lblSentNotifsSub').textContent = t.notifications.sentSub;
    if ($('thNotifTitle')) $('thNotifTitle').textContent = t.notifications.thTitle;
    if ($('thNotifMsg')) $('thNotifMsg').textContent = t.notifications.thMsg;
    if ($('thNotifTarget')) $('thNotifTarget').textContent = t.notifications.thTarget;
    if ($('thNotifDate')) $('thNotifDate').textContent = t.notifications.thDate;
    if ($('thNotifAction')) $('thNotifAction').textContent = t.notifications.thAction;
  }

  // Settings
  if (t.settings) {
    if ($('tab-btn-general')) $('tab-btn-general').textContent = t.settings.tabGeneral;
    if ($('tab-btn-subscriptions')) $('tab-btn-subscriptions').textContent = t.settings.tabSubscriptions;
    if ($('tab-btn-exercises')) $('tab-btn-exercises').textContent = t.settings.tabExercises;
    if ($('tab-btn-backup-text')) $('tab-btn-backup-text').textContent = t.settings.tabBackup;

    if ($('lblGeneralSettingsTitle')) $('lblGeneralSettingsTitle').textContent = t.settings.generalTitle;
    if ($('lblGymNameSetting')) $('lblGymNameSetting').textContent = t.settings.gymName;
    if ($('lblCurrencySetting')) $('lblCurrencySetting').textContent = t.settings.currency;
    if ($('lblGymLogo')) $('lblGymLogo').textContent = t.settings.logoUrl;
    if ($('lblKioskBgSetting')) $('lblKioskBgSetting').textContent = t.settings.kioskBg;
    if ($('lblGymBio')) $('lblGymBio').textContent = t.settings.bio;
    if ($('lblGymPhoneSetting')) $('lblGymPhoneSetting').textContent = t.settings.phone;
    if ($('lblGymWhatsAppSetting')) $('lblGymWhatsAppSetting').textContent = t.settings.whatsapp;
    if ($('lblGymAddressSetting')) $('lblGymAddressSetting').textContent = t.settings.address;
    if ($('lblGymWorkHoursSetting')) $('lblGymWorkHoursSetting').textContent = t.settings.workHours;
    if ($('lblGymSocialSetting')) $('lblGymSocialSetting').textContent = t.settings.social;
    if ($('btnSaveSettingsText')) $('btnSaveSettingsText').textContent = t.settings.saveSettingsBtn;

    if ($('lblSubTypesTitle')) $('lblSubTypesTitle').textContent = t.settings.subTypesTitle;
    if ($('lblSubTypesSub')) $('lblSubTypesSub').textContent = t.settings.subTypesSub;
    if ($('btnNewSubTypeText')) $('btnNewSubTypeText').textContent = t.settings.newSubTypeBtn;
    if ($('thStCode')) $('thStCode').textContent = t.settings.thStCode;
    if ($('thStName')) $('thStName').textContent = t.settings.thStName;
    if ($('thStDuration')) $('thStDuration').textContent = t.settings.thStDuration;
    if ($('thStPrice')) $('thStPrice').textContent = t.settings.thStPrice;
    if ($('thStDesc')) $('thStDesc').textContent = t.settings.thStDesc;
    if ($('thStAction')) $('thStAction').textContent = t.settings.thStAction;

    if ($('lblExerciseLibraryTitle')) $('lblExerciseLibraryTitle').textContent = t.settings.exTitle;
    if ($('lblExerciseLibrarySub')) $('lblExerciseLibrarySub').textContent = t.settings.exSub;
    if ($('btnNewExerciseText')) $('btnNewExerciseText').textContent = t.settings.newExBtn;
    if ($('thExName')) $('thExName').textContent = t.settings.thExName;
    if ($('thExMuscle')) $('thExMuscle').textContent = t.settings.thExMuscle;
    if ($('thExSetsReps')) $('thExSetsReps').textContent = t.settings.thExSetsReps;
    if ($('thExVideo')) $('thExVideo').textContent = t.settings.thExVideo;
    if ($('thExAction')) $('thExAction').textContent = t.settings.thExAction;

    if ($('lblBackupTitle')) $('lblBackupTitle').textContent = t.settings.backupTitle;
    if ($('lblBackupSub')) $('lblBackupSub').textContent = t.settings.backupSub;
    if ($('lblManualBackupTitle')) $('lblManualBackupTitle').textContent = t.settings.manualBackupTitle;
    if ($('btnDownloadDbText')) $('btnDownloadDbText').innerHTML = t.settings.downloadDbBtn;
    if ($('lblAutoBackupTitle')) $('lblAutoBackupTitle').textContent = t.settings.autoBackupTitle;
    if ($('lblAutoBackupFreq')) $('lblAutoBackupFreq').textContent = t.settings.autoBackupFreq;
    if ($('optBackupMonthly')) $('optBackupMonthly').textContent = t.settings.freqMonthly;
    if ($('optBackupYearly')) $('optBackupYearly').textContent = t.settings.freqYearly;
    if ($('optBackupWeekly')) $('optBackupWeekly').textContent = t.settings.freqWeekly;
    if ($('optBackupManual')) $('optBackupManual').textContent = t.settings.freqManual;
    if ($('lblAutoBackupNotify')) $('lblAutoBackupNotify').textContent = t.settings.autoBackupNotify;
    if ($('optNotifyEnabled')) $('optNotifyEnabled').textContent = t.settings.notifyEnabled;
    if ($('optNotifyDisabled')) $('optNotifyDisabled').textContent = t.settings.notifyDisabled;
    if ($('lblLastBackup')) $('lblLastBackup').textContent = t.settings.lastBackupLabel;
    if ($('btnSaveAutoBackupText')) $('btnSaveAutoBackupText').textContent = t.settings.saveAutoBackupBtn;
  }

  // Quick checkin dialog texts
  if ($('qcModalTitle')) $('qcModalTitle').textContent = t.qc.title;
  if ($('qcModalSubtitle')) $('qcModalSubtitle').textContent = t.qc.subtitle;
  if ($('qcSearchInput')) $('qcSearchInput').placeholder = t.qc.search;
  if ($('qcFilterBtn-all')) $('qcFilterBtn-all').textContent = t.qc.filterAll;
  if ($('qcFilterBtn-inside')) $('qcFilterBtn-inside').textContent = t.qc.filterInside;
  if ($('qcFilterBtn-outside')) $('qcFilterBtn-outside').textContent = t.qc.filterOutside;
  if ($('btnCloseQcModal')) $('btnCloseQcModal').textContent = t.qc.close;

  // Export buttons
  if ($('btnExpMembersText')) {
    $('btnExpMembersText').innerHTML = isEn 
      ? `Export Members<br><span class="text-[10px] text-indigo-600 font-mono">(Members .xlsx)</span>`
      : `هەناردەی بەشداربووان<br><span class="text-[10px] text-indigo-600 font-mono">(Members .xlsx)</span>`;
  }
  if ($('btnExpFinancesText')) {
    $('btnExpFinancesText').innerHTML = isEn 
      ? `Export Finances<br><span class="text-[10px] text-rose-600 font-mono">(Finances .xlsx)</span>`
      : `هەناردەی مەسروفات و داهات<br><span class="text-[10px] text-rose-600 font-mono">(Finances .xlsx)</span>`;
  }
  if ($('btnExpSalesText')) {
    $('btnExpSalesText').innerHTML = isEn 
      ? `Export Store Sales<br><span class="text-[10px] text-amber-600 font-mono">(Sales .xlsx)</span>`
      : `هەناردەی فرۆشتنی کاڵا<br><span class="text-[10px] text-amber-600 font-mono">(Sales .xlsx)</span>`;
  }

  // Update dynamic elements
  updateHeaderUser();
  if (typeof members !== 'undefined' && members.length) renderMembers();
  if (typeof todayAttendanceList !== 'undefined') renderTodayAttendance();
  if (typeof renderFinances === 'function') renderFinances();
  if (typeof renderStore === 'function') renderStore();
  if (typeof renderStaff === 'function') renderStaff();
  if (typeof renderNotifications === 'function') renderNotifications();
  if (typeof renderSettings === 'function') renderSettings();
  if (typeof renderPlanCards === 'function') renderPlanCards();
  if (typeof renderDietPlans === 'function') renderDietPlans();
  if (typeof currentEditingMember !== 'undefined' && currentEditingMember && currentEditingMember.MemberCode) {
    loadMemberSubViewHistory(currentEditingMember.MemberCode);
  }

  lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', () => {
  applyAppLanguage(currentAppLanguage);
  checkAuth();
});
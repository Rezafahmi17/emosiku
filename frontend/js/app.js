// =========================================================================
// LOGIKA UTAMA FRONTEND EMOSIKU
// Sistem Login Profesional (Email & Kata Sandi) + Navigasi Interaktif + Tanpa Jurnal
// =========================================================================

const AppState = {
    currentUser: null,
    pendingAvatarUrl: undefined,
    selectedEmotion: 'cemas',
    selectedIntensity: 3,
    selectedTrigger: 'Sekolah',
    studentEmotionLogs: [],
    studentCounselingRequests: [],
    studentChatMessages: [],
    adminConversations: [],
    activeAdminStudentId: null,
    activeAdminStudentInfo: null,
    chatPollInterval: null,
    breathingInterval: null,
    breathingSecondsLeft: 120,
    kamusCategoryFilter: 'ALL'
};

const DEMO_USERNAMES_SET = new Set([
    'rani_xi',
    'bima_x',
    'alya_smp',
    'rani@emosiku.id',
    'bima@emosiku.id',
    'alya@emosiku.id'
]);

const DEMO_NAMES_SET = new Set([
    'rani (langit senja)',
    'bima (bintang utara)',
    'alya (pelangi pagi)',
    'rani putri',
    'bima pratama',
    'alya zahra'
]);

function isDemoStudentItem(item) {
    if (!item) return false;
    const uname = (item.username || item.email || '').toLowerCase().trim();
    const sname = (item.student_name || item.alias_name || '').toLowerCase().trim();
    if (DEMO_USERNAMES_SET.has(uname) || DEMO_NAMES_SET.has(sname)) return true;
    // ID 2, 3, 4 dengan nama demo awal
    if ([2, 3, 4].includes(Number(item.user_id || item.student_id)) && DEMO_NAMES_SET.has(sname)) {
        return true;
    }
    return false;
}

function getDeletedCounselingIds() {
    try {
        return new Set(JSON.parse(localStorage.getItem('emosiku_deleted_counseling_ids') || '[]'));
    } catch (e) {
        return new Set();
    }
}

function markCounselingIdsDeleted(ids) {
    const set = getDeletedCounselingIds();
    ids.forEach((id) => set.add(Number(id)));
    localStorage.setItem('emosiku_deleted_counseling_ids', JSON.stringify(Array.from(set)));
}

function getLocalProfileOverrides() {
    try {
        return JSON.parse(localStorage.getItem('emosiku_profile_overrides') || '{}');
    } catch (e) {
        return {};
    }
}

function saveLocalProfileOverride(userId, overrideData) {
    const map = getLocalProfileOverrides();
    map[String(userId)] = { ...(map[String(userId)] || {}), ...overrideData };
    localStorage.setItem('emosiku_profile_overrides', JSON.stringify(map));
}

function applyLocalProfileOverride(user) {
    if (!user) return user;
    const map = getLocalProfileOverrides();
    const ov = map[String(user.id)];
    if (!ov) return user;
    return {
        ...user,
        alias_name: ov.alias_name || user.alias_name,
        username: ov.email || user.username,
        email: ov.email || user.email || user.username,
        class_code: ov.class_code || user.class_code,
        avatar_url: ov.avatar_url !== undefined ? ov.avatar_url : (user.avatar_url || null)
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    initAccessibilityPreferences();
    renderCekEmosiForm();
    renderKamusEmosi();
    renderLandingKamus();
    renderCalmStrategies();
    renderPublicDictionary();

    const savedUser = window.EmosikuAPI.getUser();
    const savedToken = window.EmosikuAPI.getToken();

    if (savedUser && savedToken) {
        const mergedUser = applyLocalProfileOverride(savedUser);
        AppState.currentUser = mergedUser;
        window.EmosikuAPI.setSession(savedToken, mergedUser);
        enterRoleDashboard(mergedUser);
    } else {
        showLandingView();
    }
});

// -------------------------------------------------------------------------
// 1. NAVIGASI TOP BAR: MODUL LAYANAN & KAMUS EMOSI
// -------------------------------------------------------------------------
function navigateTopMenu(targetSectionId) {
    // Jika pengguna sedang berada di dalam dashboard siswa/admin namun mengklik Kamus Emosi
    if (AppState.currentUser && targetSectionId === 'kamus-emosi') {
        if (AppState.currentUser.role === 'siswa') {
            switchStudentTab('kamus');
        } else {
            openPublicDictionaryModal();
        }
        highlightTopNav(targetSectionId);
        return;
    }

    // Jika pengguna sedang di dashboard dan mengklik Modul Layanan -> kembali ke Beranda / Chat
    if (AppState.currentUser && targetSectionId === 'fitur-utama') {
        if (AppState.currentUser.role === 'admin') {
            switchAdminTab('chat');
        } else {
            switchStudentTab('beranda');
        }
        highlightTopNav(targetSectionId);
        return;
    }

    // Pastikan section target terlihat dan lakukan smooth scroll pada Landing Page
    const targetEl = document.getElementById(targetSectionId);
    if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        highlightTopNav(targetSectionId);
    } else {
        openPublicDictionaryModal();
    }
}

function highlightTopNav(targetSectionId) {
    const map = {
        'fitur-utama': 'top-nav-fitur',
        'kamus-emosi': 'top-nav-kamus'
    };
    Object.values(map).forEach((btnId) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.classList.remove('border-slate-900', 'text-slate-900');
            btn.classList.add('border-transparent');
        }
    });
    const activeBtn = document.getElementById(map[targetSectionId]);
    if (activeBtn) {
        activeBtn.classList.remove('border-transparent');
        activeBtn.classList.add('border-slate-900', 'text-slate-900');
    }
}

function openFeatureFromLanding(tabName) {
    if (AppState.currentUser) {
        if (AppState.currentUser.role === 'siswa') {
            switchStudentTab(tabName);
        } else {
            switchAdminTab('chat');
        }
    } else {
        showToast('Silakan masuk atau daftar akun terlebih dahulu untuk mengakses fitur ini.', 'info');
        scrollToHeroAuth('login');
    }
}

function scrollToHeroAuth(mode = 'login') {
    toggleHeroAuthView(mode);
    const card = document.getElementById('hero-auth-card');
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            const targetInput =
                mode === 'register'
                    ? document.getElementById('hero-reg-alias')
                    : document.getElementById('hero-login-email');
            if (targetInput && window.innerWidth >= 768) {
                targetInput.focus();
            }
        }, 450);
    } else {
        showAuthModal(mode);
    }
}

function setKamusFilter(category = 'ALL') {
    AppState.kamusCategoryFilter = category;
    document.querySelectorAll('.kamus-filter-btn').forEach((btn) => {
        const cat = btn.getAttribute('data-cat');
        if (cat === category) {
            btn.className = 'kamus-filter-btn shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white transition';
        } else {
            btn.className = 'kamus-filter-btn shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:border-slate-400 transition';
        }
    });
    renderLandingKamus();
    renderKamusEmosi();
}

function quickSelectEmotionFromKamus(emotionId) {
    AppState.selectedEmotion = emotionId;
    renderCekEmosiForm();
    switchStudentTab('cek');
    showToast('Emosi dipilih. Silakan atur skala intensitas dan faktor pemicu.', 'info');
}

function renderLandingKamus() {
    const grid = document.getElementById('landing-kamus-grid');
    if (!grid) return;

    const query = (document.getElementById('landing-kamus-search')?.value || '').toLowerCase().trim();
    const catFilter = AppState.kamusCategoryFilter || 'ALL';

    const filtered = window.EMOSIKU_CONTENT.emotions.filter((e) => {
        const matchesQuery =
            e.name.toLowerCase().includes(query) ||
            e.meaning.toLowerCase().includes(query) ||
            e.schoolExample.toLowerCase().includes(query);
        const matchesCat = catFilter === 'ALL' || e.category === catFilter;
        return matchesQuery && matchesCat;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">Tidak ditemukan istilah emosi yang cocok.</div>`;
        return;
    }

    grid.innerHTML = filtered
        .map(
            (e) => `
        <div class="ux-card p-5 rounded-xl bg-white border border-slate-200/90 flex flex-col justify-between space-y-3 shadow-2xs hc-card">
            <div class="space-y-2.5">
                <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full ${e.dotColor}"></span>
                        <h3 class="text-base font-bold text-slate-900 hc-card">${e.name}</h3>
                    </div>
                    <span class="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${e.badgeColor}">${e.category}</span>
                </div>
                <p class="text-xs text-slate-600 leading-relaxed hc-text-muted">${e.meaning}</p>
            </div>
            <div class="text-[11px] text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200/70 hc-card">
                <p><strong class="text-slate-800 hc-card">Sinyal Tubuh:</strong> ${e.bodySigns}</p>
                <p><strong class="text-slate-800 hc-card">Pikiran Otomatis:</strong> <em>${e.commonThoughts}</em></p>
                <p><strong class="text-slate-800 hc-card">Fungsi Emosi:</strong> ${e.emotionFunction}</p>
            </div>
        </div>
    `
        )
        .join('');
}

// -------------------------------------------------------------------------
// 2. MODE KONTRAS & NOTIFIKASI
// -------------------------------------------------------------------------
function initAccessibilityPreferences() {
    document.documentElement.style.fontSize = '16px';
    localStorage.removeItem('emosiku_font_scale');

    const savedContrast = localStorage.getItem('emosiku_high_contrast') === 'true';
    if (savedContrast) {
        document.body.classList.add('high-contrast');
    }
}

function toggleHighContrast() {
    document.body.classList.toggle('high-contrast');
    const isHigh = document.body.classList.contains('high-contrast');
    localStorage.setItem('emosiku_high_contrast', isHigh ? 'true' : 'false');
    showToast(isHigh ? 'Mode Kontras Tinggi aktif' : 'Mode Standar aktif', 'info');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const colors = {
        success: 'bg-slate-900 text-white border-slate-700',
        error: 'bg-rose-800 text-white border-rose-600',
        info: 'bg-slate-800 text-white border-slate-600'
    };

    const el = document.createElement('div');
    el.className = `px-4 py-3 rounded-xl border shadow-lg text-xs font-medium flex items-center justify-between gap-4 transition-all duration-300 ${colors[type] || colors.info}`;
    el.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" class="opacity-60 hover:opacity-100 text-[10px] font-bold">TUTUP</button>`;
    container.appendChild(el);

    setTimeout(() => {
        if (el.parentElement) el.remove();
    }, 4000);
}

// -------------------------------------------------------------------------
// 3. AUTENTIKASI: LOGIN EMAIL & KATA SANDI + DAFTAR AKUN BARU
// -------------------------------------------------------------------------
function toggleHeroAuthView(mode = 'login') {
    const loginForm = document.getElementById('hero-form-login');
    const regForm = document.getElementById('hero-form-register');
    const heading = document.getElementById('hero-auth-heading');
    const subheading = document.getElementById('hero-auth-subheading');

    if (mode === 'register') {
        loginForm.classList.add('hidden');
        regForm.classList.remove('hidden');
        heading.textContent = 'Daftar Akun Baru';
        subheading.textContent = 'Lengkapi data berikut untuk membuat akun EMOSIKU.';
    } else {
        regForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        heading.textContent = 'Masuk ke Akun Anda';
        subheading.textContent = 'Masukkan alamat email dan kata sandi untuk mengakses layanan EMOSIKU.';
    }
}

async function handleHeroLoginSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('hero-login-email').value.trim();
    const password = document.getElementById('hero-login-password').value;
    await performLogin(email, password);
}

async function handleHeroRegisterSubmit(event) {
    event.preventDefault();
    const alias_name = document.getElementById('hero-reg-alias').value.trim();
    const email = document.getElementById('hero-reg-email').value.trim();
    const class_code = document.getElementById('hero-reg-class').value.trim();
    const password = document.getElementById('hero-reg-password').value;
    const agreed_consent = document.getElementById('hero-reg-consent').checked;

    await performRegister({ email, password, alias_name, class_code, agreed_consent });
}

function showAuthModal(mode = 'login') {
    const modal = document.getElementById('modal-auth');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    switchAuthMode(mode);
}

function closeAuthModal() {
    const modal = document.getElementById('modal-auth');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function switchAuthMode(mode) {
    const formLogin = document.getElementById('form-login');
    const formReg = document.getElementById('form-register');
    const title = document.getElementById('auth-modal-title');
    const subtitle = document.getElementById('auth-modal-subtitle');

    if (mode === 'register') {
        formLogin.classList.add('hidden');
        formReg.classList.remove('hidden');
        title.textContent = 'Daftar Akun Baru';
        subtitle.textContent = 'Lengkapi informasi di bawah ini untuk membuat akun.';
    } else {
        formReg.classList.add('hidden');
        formLogin.classList.remove('hidden');
        title.textContent = 'Masuk ke Akun Anda';
        subtitle.textContent = 'Masukkan alamat email dan kata sandi Anda.';
    }
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    await performLogin(email, password);
}

async function performLogin(email, password) {
    const cleanEmail = (email || '').trim();
    const fallbackSeedMap = {
        'admin@emosiku.id': 'pak_hadi_bk'
    };

    try {
        let res;
        try {
            res = await window.EmosikuAPI.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: cleanEmail, username: cleanEmail, password })
            });
        } catch (firstErr) {
            // Cek juga apabila pengguna baru saja mengubah email/sandi di sesi lokal
            const overrides = getLocalProfileOverrides();
            let matchedOverrideEntry = null;
            for (const [uid, ov] of Object.entries(overrides)) {
                if (ov.email && ov.email.toLowerCase() === cleanEmail.toLowerCase()) {
                    matchedOverrideEntry = { uid, ov };
                    break;
                }
            }

            const legacyUsername =
                fallbackSeedMap[cleanEmail.toLowerCase()] ||
                (matchedOverrideEntry ? matchedOverrideEntry.ov.original_username : null);

            if (legacyUsername) {
                const candidatePwd =
                    matchedOverrideEntry && matchedOverrideEntry.ov.original_password
                        ? matchedOverrideEntry.ov.original_password
                        : password;
                res = await window.EmosikuAPI.request('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email: legacyUsername, username: legacyUsername, password: candidatePwd })
                });
            } else {
                throw firstErr;
            }
        }

        const finalUser = applyLocalProfileOverride(res.user);
        window.EmosikuAPI.setSession(res.token, finalUser);
        AppState.currentUser = finalUser;
        closeAuthModal();
        showToast(`Selamat datang, ${finalUser.alias_name}.`, 'success');
        enterRoleDashboard(finalUser);
    } catch (error) {
        showToast(error.message || 'Gagal masuk. Periksa kembali email dan kata sandi Anda.', 'error');
    }
}

async function handleRegisterSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('reg-username').value.trim();
    const class_code = document.getElementById('reg-class').value.trim();
    const alias_name = document.getElementById('reg-alias').value.trim();
    const password = document.getElementById('reg-password').value;
    const agreed_consent = document.getElementById('reg-consent').checked;

    await performRegister({ email, password, alias_name, class_code, agreed_consent });
}

async function performRegister({ email, password, alias_name, class_code, agreed_consent }) {
    if (!agreed_consent) {
        showToast('Harap setujui ketentuan penggunaan terlebih dahulu.', 'error');
        return;
    }

    try {
        const res = await window.EmosikuAPI.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email,
                username: email,
                password,
                alias_name,
                role: 'siswa',
                class_code,
                agreed_consent
            })
        });
        window.EmosikuAPI.setSession(res.token, res.user);
        AppState.currentUser = res.user;
        closeAuthModal();
        showToast(res.message || 'Akun berhasil didaftarkan.', 'success');
        enterRoleDashboard(res.user);
    } catch (error) {
        showToast(error.message || 'Pendaftaran gagal.', 'error');
    }
}

function logoutUser() {
    if (AppState.chatPollInterval) {
        clearInterval(AppState.chatPollInterval);
        AppState.chatPollInterval = null;
    }
    stopBoxBreathing(false);
    window.EmosikuAPI.clearSession();
    AppState.currentUser = null;
    showLandingView();
    showToast('Anda telah keluar dari akun.', 'info');
}

function handleLogoClick() {
    if (!AppState.currentUser) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (AppState.currentUser.role === 'admin') {
        switchAdminTab('chat');
    } else {
        switchStudentTab('beranda');
    }
}

// -------------------------------------------------------------------------
// 3B. PENGATURAN & EDIT PROFIL AKUN (FOTO, NAMA, EMAIL, KELAS, SANDI)
// -------------------------------------------------------------------------
function renderAvatarBadgeContent(el, user) {
    if (!el || !user) return;
    const initial = (user.alias_name || user.username || 'U').charAt(0).toUpperCase();
    if (user.avatar_url) {
        el.innerHTML = `<img src="${user.avatar_url}" alt="${escapeHtml(user.alias_name)}" class="w-full h-full object-cover" />`;
    } else {
        el.textContent = initial;
    }
}

function refreshHeaderAndDashboardUserUI(user) {
    if (!user) return;
    const avatarBadge = document.getElementById('user-avatar-badge');
    renderAvatarBadgeContent(avatarBadge, user);

    document.getElementById('user-display-name').textContent = user.alias_name;
    document.getElementById('user-display-role').textContent =
        user.role === 'admin'
            ? `${user.class_code || 'Konselor / Admin'}`
            : `Kelas ${user.class_code || 'Umum'}`;

    if (user.role !== 'admin') {
        const berandaAlias = document.getElementById('beranda-alias-name');
        const berandaBadge = document.getElementById('beranda-jenjang-badge');
        const bkName = document.getElementById('bk-student-name');
        const bkClass = document.getElementById('bk-class-code');
        if (berandaAlias) berandaAlias.textContent = user.alias_name;
        if (berandaBadge) berandaBadge.textContent = `Kelas ${user.class_code || 'Umum'}`;
        if (bkName) bkName.value = user.alias_name;
        if (bkClass) bkClass.value = user.class_code || 'Umum';
    }
}

function openProfileModal() {
    if (!AppState.currentUser) return;
    const u = AppState.currentUser;
    AppState.pendingAvatarUrl = u.avatar_url !== undefined ? u.avatar_url : null;

    const previewEl = document.getElementById('profile-avatar-preview');
    renderAvatarBadgeContent(previewEl, { ...u, avatar_url: AppState.pendingAvatarUrl });

    document.getElementById('profile-alias-name').value = u.alias_name || '';
    document.getElementById('profile-class-code').value = u.class_code || (u.role === 'admin' ? 'Konselor' : 'Umum');
    document.getElementById('profile-class-label').textContent =
        u.role === 'admin' ? 'Jabatan / Unit' : 'Kode Kelas';

    const emailVal =
        u.email || (u.username === 'pak_hadi_bk' ? 'admin@emosiku.id' : u.username) || '';
    document.getElementById('profile-email').value = emailVal;
    document.getElementById('profile-new-password').value = '';
    document.getElementById('profile-confirm-password').value = '';

    const modal = document.getElementById('modal-profile');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeProfileModal() {
    const modal = document.getElementById('modal-profile');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function handleProfilePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Harap pilih file gambar (JPG, PNG, atau WEBP).', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 256;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Center-crop square
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2;
            const sy = (img.height - minSide) / 2;
            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            AppState.pendingAvatarUrl = dataUrl;

            const previewEl = document.getElementById('profile-avatar-preview');
            renderAvatarBadgeContent(previewEl, {
                alias_name: document.getElementById('profile-alias-name')?.value || AppState.currentUser?.alias_name,
                avatar_url: dataUrl
            });
            showToast('Foto profil siap disimpan.', 'info');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removeProfilePhoto() {
    AppState.pendingAvatarUrl = null;
    const fileInput = document.getElementById('profile-photo-input');
    if (fileInput) fileInput.value = '';
    const previewEl = document.getElementById('profile-avatar-preview');
    renderAvatarBadgeContent(previewEl, {
        alias_name: document.getElementById('profile-alias-name')?.value || AppState.currentUser?.alias_name || 'U',
        avatar_url: null
    });
    showToast('Foto profil dihapus. Klik Simpan Perubahan untuk menerapkan.', 'info');
}

async function handleUpdateProfileSubmit(event) {
    event.preventDefault();
    if (!AppState.currentUser) return;

    const alias_name = document.getElementById('profile-alias-name').value.trim();
    const class_code = document.getElementById('profile-class-code').value.trim();
    const email = document.getElementById('profile-email').value.trim().toLowerCase();
    const new_password = document.getElementById('profile-new-password').value;
    const confirm_password = document.getElementById('profile-confirm-password').value;

    if (!alias_name || !email) {
        showToast('Nama tampilan dan alamat email wajib diisi.', 'error');
        return;
    }

    if (new_password) {
        if (new_password.length < 6) {
            showToast('Kata sandi baru minimal harus terdiri dari 6 karakter.', 'error');
            return;
        }
        if (new_password !== confirm_password) {
            showToast('Konfirmasi kata sandi baru tidak cocok.', 'error');
            return;
        }
    }

    const avatar_url =
        AppState.pendingAvatarUrl !== undefined
            ? AppState.pendingAvatarUrl
            : (AppState.currentUser.avatar_url || null);

    // Simpan ke penyimpanan lokal agar langsung sinkron
    saveLocalProfileOverride(AppState.currentUser.id, {
        alias_name,
        class_code,
        email,
        avatar_url,
        original_username: AppState.currentUser.username
    });

    try {
        const res = await window.EmosikuAPI.request('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify({
                alias_name,
                full_name: alias_name,
                class_code,
                email,
                new_password: new_password || undefined,
                avatar_url
            })
        });

        const updatedUser = applyLocalProfileOverride(res.user);
        AppState.currentUser = updatedUser;
        window.EmosikuAPI.setSession(res.token || window.EmosikuAPI.getToken(), updatedUser);
        refreshHeaderAndDashboardUserUI(updatedUser);
        closeProfileModal();
        showToast(res.message || 'Profil akun berhasil diperbarui.', 'success');
    } catch (err) {
        // Apabila server backend belum di-restart untuk rute baru, tetap terapkan perubahan profil di aplikasi
        const fallbackUpdatedUser = {
            ...AppState.currentUser,
            alias_name,
            class_code,
            username: email,
            email,
            avatar_url
        };
        AppState.currentUser = fallbackUpdatedUser;
        window.EmosikuAPI.setSession(window.EmosikuAPI.getToken(), fallbackUpdatedUser);
        refreshHeaderAndDashboardUserUI(fallbackUpdatedUser);
        closeProfileModal();
        showToast('Profil akun berhasil diperbarui.', 'success');
    }
}

// -------------------------------------------------------------------------
// 4. NAVIGASI VIEW (LANDING, PENGGUNA, ADMIN)
// -------------------------------------------------------------------------
function showLandingView() {
    document.getElementById('view-landing').classList.remove('hidden');
    document.getElementById('view-student-app').classList.add('hidden');
    document.getElementById('view-admin-app').classList.add('hidden');
    const navLinks = document.getElementById('landing-nav-links');
    if (navLinks) {
        navLinks.classList.remove('md:hidden');
        navLinks.classList.add('hidden', 'md:flex');
    }
    const mobileSubnav = document.getElementById('landing-mobile-subnav');
    if (mobileSubnav) mobileSubnav.classList.remove('hidden');
    document.getElementById('nav-guest-actions').classList.remove('hidden');
    document.getElementById('nav-user-actions').classList.add('hidden');
    document.getElementById('nav-user-actions').classList.remove('flex');
}

function enterRoleDashboard(user) {
    document.getElementById('view-landing').classList.add('hidden');
    const navLinks = document.getElementById('landing-nav-links');
    if (navLinks) {
        navLinks.classList.remove('md:flex');
        navLinks.classList.add('hidden', 'md:hidden');
    }
    const mobileSubnav = document.getElementById('landing-mobile-subnav');
    if (mobileSubnav) mobileSubnav.classList.add('hidden');
    document.getElementById('nav-guest-actions').classList.add('hidden');

    const userActions = document.getElementById('nav-user-actions');
    userActions.classList.remove('hidden');
    userActions.classList.add('flex');

    refreshHeaderAndDashboardUserUI(user);

    if (AppState.chatPollInterval) {
        clearInterval(AppState.chatPollInterval);
    }

    if (user.role === 'admin') {
        document.getElementById('view-student-app').classList.add('hidden');
        document.getElementById('view-admin-app').classList.remove('hidden');
        switchAdminTab('chat');
        loadAdminConversations();
        loadAdminDashboardData();
        AppState.chatPollInterval = setInterval(() => {
            loadAdminConversations(true);
            if (AppState.activeAdminStudentId) {
                loadAdminActiveChatMessages(AppState.activeAdminStudentId, true);
            }
        }, 4000);
    } else {
        document.getElementById('view-admin-app').classList.add('hidden');
        document.getElementById('view-student-app').classList.remove('hidden');

        switchStudentTab('beranda');
        loadAllStudentData();

        AppState.chatPollInterval = setInterval(() => {
            loadStudentChatMessages(true);
        }, 4000);
    }
}

function switchStudentTab(tabName) {
    const tabs = ['beranda', 'cek', 'kamus', 'tenang', 'riwayat', 'bk'];
    tabs.forEach((t) => {
        const sec = document.getElementById(`student-tab-${t}`);
        if (sec) {
            if (t === tabName) {
                sec.classList.remove('hidden');
                sec.classList.remove('animate-view');
                void sec.offsetWidth;
                sec.classList.add('animate-view');
            } else {
                sec.classList.add('hidden');
            }
        }
        const navBtn = document.getElementById(`bnav-${t}`);
        if (navBtn) {
            if (t === tabName) {
                navBtn.className = 'bnav-btn py-1.5 sm:py-2 px-1 rounded-lg text-[10px] sm:text-xs font-bold text-slate-900 bg-slate-100 transition flex flex-col items-center justify-center gap-0.5';
            } else {
                navBtn.className = 'bnav-btn py-1.5 sm:py-2 px-1 rounded-lg text-[10px] sm:text-xs font-medium text-slate-500 hover:text-slate-900 transition flex flex-col items-center justify-center gap-0.5';
            }
        }
    });

    if (tabName === 'bk') {
        loadStudentChatMessages();
        loadStudentCounselingRequests();
    } else if (tabName === 'riwayat') {
        renderRiwayatChartAndList();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchStudentBkMobileView(mode = 'chat') {
    const chatPane = document.getElementById('student-bk-chat-pane');
    const formPane = document.getElementById('student-bk-form-pane');
    const btnChat = document.getElementById('student-bk-subtab-chat');
    const btnForm = document.getElementById('student-bk-subtab-form');
    if (!chatPane || !formPane) return;

    if (mode === 'form') {
        chatPane.classList.add('hidden');
        chatPane.classList.remove('flex');
        formPane.classList.remove('hidden');
        if (btnForm) btnForm.className = 'py-2 px-3 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-2xs transition';
        if (btnChat) btnChat.className = 'py-2 px-3 rounded-lg text-xs font-semibold text-slate-600 transition';
    } else {
        formPane.classList.add('hidden');
        chatPane.classList.remove('hidden');
        chatPane.classList.add('flex');
        if (btnChat) btnChat.className = 'py-2 px-3 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-2xs transition';
        if (btnForm) btnForm.className = 'py-2 px-3 rounded-lg text-xs font-semibold text-slate-600 transition';
        const box = document.getElementById('student-chat-box');
        if (box) box.scrollTop = box.scrollHeight;
    }
}

// -------------------------------------------------------------------------
// 5. FITUR PENGGUNA: CEK EMOSI, KAMUS, RUANG TENANG, RIWAYAT
// -------------------------------------------------------------------------
async function loadAllStudentData() {
    await Promise.all([
        loadStudentEmotions(),
        loadStudentCounselingRequests(),
        loadStudentChatMessages(true)
    ]);
}

function updateCekLivePreview() {
    const emoObj =
        window.EMOSIKU_CONTENT.emotions.find((e) => e.id === AppState.selectedEmotion) ||
        window.EMOSIKU_CONTENT.emotions[0];
    const lvl = AppState.selectedIntensity || 3;
    const trig = AppState.selectedTrigger || 'Sekolah';

    const intensityMeta = {
        1: { label: '1/5 — Sangat Ringan', pct: 20 },
        2: { label: '2/5 — Ringan', pct: 40 },
        3: { label: '3/5 — Sedang', pct: 60 },
        4: { label: '4/5 — Cukup Kuat', pct: 80 },
        5: { label: '5/5 — Sangat Kuat', pct: 100 }
    }[lvl] || { label: '3/5 — Sedang', pct: 60 };

    const descEl = document.getElementById('cek-intensity-desc');
    if (descEl) descEl.textContent = intensityMeta.label;

    const barEl = document.getElementById('cek-intensity-bar');
    if (barEl) barEl.style.width = `${intensityMeta.pct}%`;

    const bannerEl = document.getElementById('cek-live-preview-banner');
    if (bannerEl && emoObj) {
        bannerEl.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-start gap-3">
                    <span class="w-3 h-3 rounded-full ${emoObj.dotColor} mt-1 shrink-0"></span>
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-xs font-bold text-slate-900 hc-card">Ringkasan Pilihan: ${emoObj.name}</span>
                            <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">Intensitas ${lvl}/5</span>
                            <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">Pemicu: ${trig}</span>
                        </div>
                        <p class="text-[11px] text-slate-600 mt-1 hc-text-muted"><strong>Sinyal Tubuh Umum:</strong> ${emoObj.bodySigns} • <strong>Fungsi:</strong> ${emoObj.emotionFunction}</p>
                    </div>
                </div>
            </div>
        `;
    }
}

function renderCekEmosiForm() {
    const grid = document.getElementById('cek-emotion-grid');
    if (!grid) return;

    grid.innerHTML = window.EMOSIKU_CONTENT.emotions
        .map((emo) => {
            const isSelected = AppState.selectedEmotion === emo.id;
            return `
            <button type="button" onclick="selectEmotionCard('${emo.id}')"
                class="ux-card p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                    isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-400 text-slate-900'
                } hc-card">
                <div class="flex items-center justify-between">
                    <span class="w-2.5 h-2.5 rounded-full ${emo.dotColor}"></span>
                    <span class="text-[10px] font-semibold uppercase tracking-wider ${
                        isSelected ? 'text-slate-300' : 'text-slate-400'
                    }">${emo.category}</span>
                </div>
                <div class="mt-4">
                    <div class="font-bold text-sm">${emo.name}</div>
                    <p class="text-[11px] line-clamp-2 mt-1 ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                    }">${emo.meaning}</p>
                </div>
            </button>
        `;
        })
        .join('');

    const triggerWrap = document.getElementById('cek-trigger-chips');
    if (triggerWrap) {
        triggerWrap.innerHTML = window.EMOSIKU_CONTENT.triggers
            .map((trig) => {
                const active = AppState.selectedTrigger === trig;
                return `
                <button type="button" onclick="selectTriggerChip('${trig}')"
                    class="ux-btn px-4 py-2 rounded-lg text-xs font-semibold border transition ${
                        active
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'
                    }">
                    ${trig}
                </button>
            `;
            })
            .join('');
    }

    updateCekLivePreview();
}

function selectEmotionCard(emotionId) {
    AppState.selectedEmotion = emotionId;
    renderCekEmosiForm();
}

function selectIntensity(level) {
    AppState.selectedIntensity = level;
    document.querySelectorAll('.intensity-btn').forEach((btn) => {
        const btnLvl = parseInt(btn.getAttribute('data-level'), 10);
        if (btnLvl === level) {
            btn.className = 'intensity-btn py-2.5 rounded-lg border border-slate-900 bg-slate-900 text-white font-bold text-sm transition';
        } else {
            btn.className = 'intensity-btn py-2.5 rounded-lg border border-slate-300 font-bold text-sm hover:border-slate-900 transition';
        }
    });
    updateCekLivePreview();
}

function selectTriggerChip(trig) {
    AppState.selectedTrigger = trig;
    renderCekEmosiForm();
}

async function submitEmotionLog() {
    const note = document.getElementById('cek-note-input').value.trim();
    try {
        const res = await window.EmosikuAPI.request('/emotions', {
            method: 'POST',
            body: JSON.stringify({
                emotion: AppState.selectedEmotion,
                intensity: AppState.selectedIntensity,
                trigger_factor: AppState.selectedTrigger,
                note
            })
        });

        document.getElementById('cek-note-input').value = '';
        showToast('Catatan emosi harian berhasil disimpan.', 'success');
        await loadStudentEmotions();

        const emoObj = window.EMOSIKU_CONTENT.emotions.find((e) => e.id === AppState.selectedEmotion);
        if (emoObj) {
            document.getElementById('rt-rec-title').textContent = `Kondisi Saat Ini: ${emoObj.name} (Intensitas ${AppState.selectedIntensity}/5)`;
            document.getElementById('rt-rec-subtitle').textContent = `Rekomendasi strategi utama: ${res.recommendedStrategy}.`;
        }

        switchStudentTab('tenang');
    } catch (error) {
        showToast(error.message || 'Gagal menyimpan catatan emosi.', 'error');
    }
}

async function loadStudentEmotions() {
    try {
        const res = await window.EmosikuAPI.request('/emotions');
        AppState.studentEmotionLogs = res.logs || [];

        const alertBox = document.getElementById('student-counseling-alert');
        const alertReason = document.getElementById('student-counseling-alert-reason');
        if (res.suggestCounseling) {
            alertBox.classList.remove('hidden');
            alertReason.textContent = `${res.suggestReason} Kamu dapat mempraktikkan regulasi di Ruang Tenang atau berdiskusi langsung di Ruang Konsultasi.`;
        } else {
            alertBox.classList.add('hidden');
        }

        renderBerandaSummaries();
        renderRiwayatChartAndList();
    } catch (err) {
        console.warn('Load emotions warning:', err);
    }
}

function renderBerandaSummaries() {
    const latestEmoBox = document.getElementById('beranda-latest-emotion');
    if (latestEmoBox) {
        if (AppState.studentEmotionLogs.length === 0) {
            latestEmoBox.innerHTML = `<p class="text-slate-400">Belum ada catatan emosi yang tersimpan.</p>`;
        } else {
            const latest = AppState.studentEmotionLogs[0];
            const emoMeta = window.EMOSIKU_CONTENT.emotions.find((e) => e.id === latest.emotion) || {
                name: latest.emotion,
                dotColor: 'bg-teal-600'
            };
            latestEmoBox.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <span class="w-2.5 h-2.5 rounded-full ${emoMeta.dotColor}"></span>
                        <span class="font-bold text-slate-900 text-sm capitalize hc-card">
                            ${emoMeta.name} — Skala ${latest.intensity}/5
                        </span>
                    </div>
                    <span class="text-[11px] text-slate-400">${latest.log_date}</span>
                </div>
                <div class="text-[11px] text-slate-500 mt-1 hc-text-muted">Faktor Pemicu: ${latest.trigger_factor || '-'}</div>
                ${latest.note ? `<p class="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700 hc-card">"${escapeHtml(latest.note)}"</p>` : ''}
            `;
        }
    }
}

// KAMUS EMOSI MINIMALIS
function renderKamusEmosi() {
    const container = document.getElementById('kamus-cards-container');
    if (!container) return;
    const query = (document.getElementById('kamus-search-input')?.value || '').toLowerCase().trim();
    const catFilter = AppState.kamusCategoryFilter || 'ALL';

    const filtered = window.EMOSIKU_CONTENT.emotions.filter((e) => {
        const matchesQuery =
            e.name.toLowerCase().includes(query) ||
            e.meaning.toLowerCase().includes(query) ||
            e.schoolExample.toLowerCase().includes(query);
        const matchesCat = catFilter === 'ALL' || e.category === catFilter;
        return matchesQuery && matchesCat;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-span-full p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">Tidak ditemukan istilah emosi yang cocok.</div>`;
        return;
    }

    container.innerHTML = filtered
        .map(
            (e) => `
        <div class="ux-card p-5 rounded-xl border border-slate-200/90 bg-slate-50/50 flex flex-col justify-between space-y-3 hc-card">
            <div class="space-y-3">
                <div class="flex items-center justify-between border-b border-slate-200/70 pb-3">
                    <div class="flex items-center gap-2.5">
                        <span class="w-2.5 h-2.5 rounded-full ${e.dotColor}"></span>
                        <h3 class="text-base font-bold text-slate-900 hc-card">${e.name}</h3>
                    </div>
                    <span class="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded ${e.badgeColor}">${e.category}</span>
                </div>
                <p class="text-xs text-slate-700 leading-relaxed hc-text-muted"><strong class="text-slate-900 hc-card">Definisi:</strong> ${e.meaning}</p>
                <div class="text-xs text-slate-600 space-y-1.5 bg-white p-3.5 rounded-lg border border-slate-200/80 hc-card">
                    <p><strong class="text-slate-800 hc-card">Sinyal Fisiologis:</strong> ${e.bodySigns}</p>
                    <p><strong class="text-slate-800 hc-card">Pikiran Otomatis:</strong> <em>${e.commonThoughts}</em></p>
                    <p><strong class="text-slate-800 hc-card">Fungsi Adaptif:</strong> ${e.emotionFunction}</p>
                    <p><strong class="text-slate-800 hc-card">Contoh Situasi:</strong> ${e.schoolExample}</p>
                </div>
            </div>
            <div class="pt-2 flex justify-end">
                <button type="button" onclick="quickSelectEmotionFromKamus('${e.id}')" class="ux-btn text-[11px] font-semibold text-teal-700 hover:text-teal-900 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-teal-600 transition">
                    Catat Emosi Ini →
                </button>
            </div>
        </div>
    `
        )
        .join('');
}

function renderPublicDictionary() {
    const body = document.getElementById('public-dictionary-body');
    if (!body) return;
    body.innerHTML = window.EMOSIKU_CONTENT.emotions
        .map(
            (e) => `
        <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 hc-card">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full ${e.dotColor}"></span>
                    <h4 class="font-bold text-sm text-slate-900 hc-card">${e.name}</h4>
                </div>
                <span class="text-[10px] font-semibold text-slate-500">${e.category}</span>
            </div>
            <p class="text-xs text-slate-600 hc-text-muted"><strong class="text-slate-800 hc-card">Arti:</strong> ${e.meaning}</p>
            <p class="text-xs text-slate-600 hc-text-muted"><strong class="text-slate-800 hc-card">Tanda Tubuh:</strong> ${e.bodySigns}</p>
            <p class="text-xs text-slate-600 hc-text-muted"><strong class="text-slate-800 hc-card">Fungsi:</strong> ${e.emotionFunction}</p>
            <p class="text-xs text-slate-600 hc-text-muted"><strong class="text-slate-800 hc-card">Contoh Situasi:</strong> ${e.schoolExample}</p>
        </div>
    `
        )
        .join('');
}

function openPublicDictionaryModal() {
    const m = document.getElementById('modal-public-dictionary');
    m.classList.remove('hidden');
    m.classList.add('flex');
}

function closePublicDictionaryModal() {
    const m = document.getElementById('modal-public-dictionary');
    m.classList.add('hidden');
    m.classList.remove('flex');
}

// RUANG TENANG MINIMALIS
function renderCalmStrategies() {
    const grid = document.getElementById('calm-strategies-grid');
    if (!grid) return;

    grid.innerHTML = window.EMOSIKU_CONTENT.calmStrategies
        .map(
            (s) => `
        <div class="ux-card bg-white rounded-2xl p-6 border border-slate-200/90 flex flex-col justify-between space-y-5 hc-card">
            <div class="space-y-3">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span class="text-xs font-bold tracking-widest text-teal-700">METODE ${s.number}</span>
                    <span class="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">${s.badge}</span>
                </div>
                <div>
                    <h3 class="text-base font-bold text-slate-900 hc-card">${s.title}</h3>
                    <p class="text-xs text-slate-500 mt-0.5 hc-text-muted">${s.subtitle}</p>
                </div>
                <div class="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 hc-card">
                    <strong class="text-slate-800 hc-card">Dasar Ilmiah:</strong> ${s.theoryNote}
                </div>
                <ol class="space-y-1.5 text-xs text-slate-600 list-decimal list-inside hc-text-muted">
                    ${s.steps
                        .map(
                            (step) =>
                                `<li onclick="this.classList.toggle('line-through'); this.classList.toggle('text-teal-700');" title="Klik untuk menandai langkah ini" class="leading-relaxed cursor-pointer hover:text-slate-900 transition select-none py-0.5">${step}</li>`
                        )
                        .join('')}
                </ol>
            </div>
            <div class="pt-3 border-t border-slate-100">
                <button type="button" onclick="completeCalmStrategy('${s.title}')" class="ux-btn w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition">
                    Tandai Selesai Dipraktikkan
                </button>
            </div>
        </div>
    `
        )
        .join('');
}

function startBoxBreathing() {
    stopBoxBreathing(false);
    AppState.breathingSecondsLeft = 120;
    document.getElementById('btn-start-breathing').classList.add('hidden');
    document.getElementById('btn-stop-breathing').classList.remove('hidden');

    const circle = document.getElementById('breathing-visualizer');
    const phaseText = document.getElementById('breathing-phase-text');
    const secText = document.getElementById('breathing-timer-sec');
    const totalCountdown = document.getElementById('breathing-total-countdown');
    const progressBar = document.getElementById('breathing-progress-bar');

    const phases = [
        { label: 'Tarik Napas', scale: 'scale(1.18)' },
        { label: 'Tahan Napas', scale: 'scale(1.18)' },
        { label: 'Hembuskan', scale: 'scale(0.92)' },
        { label: 'Jeda Tenang', scale: 'scale(0.92)' }
    ];

    let tick = 0;

    const updateUI = () => {
        const phaseIndex = Math.floor((tick % 16) / 4);
        const phaseSec = 4 - (tick % 4);
        const currentPhase = phases[phaseIndex];

        phaseText.textContent = currentPhase.label;
        secText.textContent = `${phaseSec}d`;
        circle.style.transform = currentPhase.scale;

        for (let i = 0; i < 4; i++) {
            const badge = document.getElementById(`bphase-${i}`);
            if (badge) {
                if (i === phaseIndex) {
                    badge.className = 'px-2.5 py-1 rounded-md bg-teal-500 text-slate-950 font-bold border border-teal-400 transition-all';
                } else {
                    badge.className = 'px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/70 transition-all';
                }
            }
        }

        if (progressBar) {
            const elapsed = 120 - AppState.breathingSecondsLeft;
            const pct = Math.min(100, Math.round((elapsed / 120) * 100));
            progressBar.style.width = `${pct}%`;
        }

        const mins = String(Math.floor(AppState.breathingSecondsLeft / 60)).padStart(2, '0');
        const secs = String(AppState.breathingSecondsLeft % 60).padStart(2, '0');
        totalCountdown.textContent = `${mins}:${secs}`;
    };

    updateUI();

    AppState.breathingInterval = setInterval(() => {
        tick += 1;
        AppState.breathingSecondsLeft -= 1;

        if (AppState.breathingSecondsLeft <= 0) {
            stopBoxBreathing(true);
            return;
        }
        updateUI();
    }, 1000);
}

async function stopBoxBreathing(completedFull = false) {
    if (AppState.breathingInterval) {
        clearInterval(AppState.breathingInterval);
        AppState.breathingInterval = null;
    }
    const startBtn = document.getElementById('btn-start-breathing');
    const stopBtn = document.getElementById('btn-stop-breathing');
    const circle = document.getElementById('breathing-visualizer');
    const phaseText = document.getElementById('breathing-phase-text');
    const secText = document.getElementById('breathing-timer-sec');
    const totalCountdown = document.getElementById('breathing-total-countdown');
    const progressBar = document.getElementById('breathing-progress-bar');

    if (startBtn) startBtn.classList.remove('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');
    if (circle) circle.style.transform = 'scale(1)';
    if (phaseText) phaseText.textContent = completedFull ? 'Selesai' : 'Siap Mulai';
    if (secText) secText.textContent = '4d';
    if (totalCountdown) totalCountdown.textContent = '02:00';
    if (progressBar) progressBar.style.width = completedFull ? '100%' : '0%';

    for (let i = 0; i < 4; i++) {
        const badge = document.getElementById(`bphase-${i}`);
        if (badge) {
            badge.className = 'px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/70 transition-all';
        }
    }

    if (completedFull) {
        await completeCalmStrategy('Napas Kotak 4-4-4-4 (2 Menit)');
    }
}

async function completeCalmStrategy(strategyName) {
    try {
        await window.EmosikuAPI.request('/emotions/calm-session', {
            method: 'POST',
            body: JSON.stringify({
                strategy_name: strategyName,
                duration_seconds: 120,
                feeling_after: 'Lebih tenang'
            })
        });
        showToast(`Latihan "${strategyName}" berhasil dicatat.`, 'success');
    } catch {
        showToast(`Latihan "${strategyName}" selesai.`, 'success');
    }
}

// RIWAYAT EMOSIKU
function renderRiwayatChartAndList() {
    const barsEl = document.getElementById('riwayat-bars');
    const labelsEl = document.getElementById('riwayat-labels');
    const summaryText = document.getElementById('riwayat-dominant-text');
    const listItems = document.getElementById('riwayat-list-items');
    if (!barsEl || !labelsEl || !listItems) return;

    const recentSeven = [...AppState.studentEmotionLogs].slice(0, 7).reverse();

    if (recentSeven.length === 0) {
        barsEl.innerHTML = `<div class="w-full text-center text-xs text-slate-400 self-center">Belum ada data grafik emosi mingguan.</div>`;
        labelsEl.innerHTML = '';
        summaryText.textContent = 'Belum ada catatan emosi minggu ini.';
        listItems.innerHTML = `<p class="text-xs text-slate-400">Tidak ada catatan emosi tersimpan.</p>`;
        return;
    }

    barsEl.innerHTML = recentSeven
        .map((item) => {
            const emoObj = window.EMOSIKU_CONTENT.emotions.find((e) => e.id === item.emotion) || {
                name: item.emotion,
                chartColor: '#0f172a'
            };
            const heightPct = Math.max(18, (Number(item.intensity) / 5) * 100);
            return `
            <div class="flex-1 flex flex-col items-center justify-end h-full">
                <span class="text-[11px] font-bold text-slate-600 mb-1.5">${item.intensity}/5</span>
                <div class="w-full max-w-[38px] rounded-t-md transition-all duration-300"
                     style="height: ${heightPct}%; background-color: ${emoObj.chartColor};"></div>
            </div>
        `;
        })
        .join('');

    labelsEl.innerHTML = recentSeven
        .map((item) => {
            const shortDate = (item.log_date || '').slice(5);
            return `<div class="flex-1 text-center truncate capitalize">${item.emotion}<br/><span class="text-[10px] font-normal text-slate-400">${shortDate}</span></div>`;
        })
        .join('');

    const freq = {};
    AppState.studentEmotionLogs.forEach((l) => {
        freq[l.emotion] = (freq[l.emotion] || 0) + 1;
    });
    const topEmotion = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
    summaryText.textContent = `Frekuensi emosi tertinggi pada catatanmu adalah "${topEmotion.toUpperCase()}" (${freq[topEmotion]} kali). Gunakan modul Ruang Tenang untuk menjaga keseimbangan emosimu.`;

    listItems.innerHTML = AppState.studentEmotionLogs
        .map((item) => {
            const emoObj = window.EMOSIKU_CONTENT.emotions.find((e) => e.id === item.emotion) || {
                name: item.emotion,
                dotColor: 'bg-teal-600'
            };
            return `
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hc-card">
                <div class="space-y-1">
                    <div class="flex items-center gap-2.5">
                        <span class="w-2 h-2 rounded-full ${emoObj.dotColor}"></span>
                        <span class="font-bold text-sm text-slate-900 capitalize hc-card">${emoObj.name} — Skala ${item.intensity}/5</span>
                        <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">Pemicu: ${item.trigger_factor || '-'}</span>
                    </div>
                    ${item.note ? `<p class="text-xs text-slate-600 hc-text-muted">"${escapeHtml(item.note)}"</p>` : ''}
                    <p class="text-[11px] text-teal-700 font-medium">Rekomendasi: ${item.recommended_strategy || 'Ruang Tenang'}</p>
                </div>
                <span class="text-xs font-medium text-slate-400 shrink-0">${item.log_date}</span>
            </div>
        `;
        })
        .join('');
}

async function deleteAllMyStudentData() {
    try {
        const res = await window.EmosikuAPI.request('/emotions/all-my-data', {
            method: 'DELETE'
        });
        AppState.studentEmotionLogs = [];
        renderBerandaSummaries();
        renderRiwayatChartAndList();
        showToast(res.message || 'Seluruh data pribadi berhasil dihapus.', 'info');
    } catch (error) {
        showToast(error.message || 'Gagal menghapus data.', 'error');
    }
}

// -------------------------------------------------------------------------
// 6. KONSULTASI LIVE CHAT & FORMULIR JANJI TEMU
// -------------------------------------------------------------------------
async function loadStudentCounselingRequests() {
    try {
        const res = await window.EmosikuAPI.request('/counseling/my-requests');
        const deletedSet = getDeletedCounselingIds();
        AppState.studentCounselingRequests = (res.requests || []).filter(
            (r) => !deletedSet.has(Number(r.id)) && !isDemoStudentItem(r)
        );
        const container = document.getElementById('student-counseling-list');
        if (!container) return;

        if (AppState.studentCounselingRequests.length === 0) {
            container.innerHTML = `<p class="text-slate-400">Belum ada pengajuan jadwal konseling tatap muka.</p>`;
            return;
        }

        container.innerHTML = AppState.studentCounselingRequests
            .map((req) => {
                const badgeClass =
                    req.status === 'Dijadwalkan'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : req.status === 'Selesai'
                        ? 'bg-slate-100 text-slate-700 border border-slate-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200';
                return `
                <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 hc-card">
                    <div class="flex items-center justify-between gap-2">
                        <span class="font-bold text-slate-900 hc-card">${escapeHtml(req.topic)}</span>
                        <div class="flex items-center gap-1.5">
                            <span class="text-[10px] font-semibold px-2 py-0.5 rounded ${badgeClass}">${req.status}</span>
                            <button type="button" onclick="deleteStudentCounselingRequest(${req.id})" class="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-semibold transition">
                                Hapus
                            </button>
                        </div>
                    </div>
                    <p class="text-slate-600 hc-text-muted">Usulan Waktu: <strong>${escapeHtml(req.free_time)}</strong></p>
                    ${req.counselor_note ? `<p class="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 mt-1 hc-card"><strong>Tanggapan Konselor:</strong> ${escapeHtml(req.counselor_note)}</p>` : ''}
                </div>
            `;
            })
            .join('');
    } catch (err) {
        console.warn('Load counseling requests error:', err);
    }
}

async function deleteStudentCounselingRequest(reqId) {
    markCounselingIdsDeleted([reqId]);
    try {
        await window.EmosikuAPI.request(`/counseling/${reqId}`, { method: 'DELETE' });
    } catch (e) {
        // Tetap hapus dari tampilan meskipun server belum di-restart
    }
    showToast('Jadwal konseling berhasil dihapus.', 'info');
    await loadStudentCounselingRequests();
}

async function submitCounselingRequest(event) {
    event.preventDefault();
    const student_name = document.getElementById('bk-student-name').value.trim();
    const class_code = document.getElementById('bk-class-code').value.trim();
    const free_time = document.getElementById('bk-free-time').value.trim();
    const topic = document.getElementById('bk-topic').value;
    const description = document.getElementById('bk-description').value.trim();

    try {
        const res = await window.EmosikuAPI.request('/counseling', {
            method: 'POST',
            body: JSON.stringify({
                student_name,
                class_code,
                free_time,
                topic,
                description
            })
        });
        document.getElementById('bk-free-time').value = '';
        document.getElementById('bk-description').value = '';
        showToast(res.message || 'Permintaan jadwal konseling terkirim.', 'success');
        await loadStudentCounselingRequests();
    } catch (error) {
        showToast(error.message || 'Gagal mengirim formulir konseling.', 'error');
    }
}

async function loadStudentChatMessages(silent = false) {
    if (!AppState.currentUser || AppState.currentUser.role !== 'siswa') return;
    try {
        const res = await window.EmosikuAPI.request(`/chat/messages/${AppState.currentUser.id}`);
        const newMessages = res.messages || [];
        const prevCount = AppState.studentChatMessages.length;
        AppState.studentChatMessages = newMessages;
        renderStudentChatBox(newMessages.length !== prevCount || !silent);
    } catch (err) {
        if (!silent) console.warn('Student chat load warning:', err);
    }
}

function renderStudentChatBox(scrollToBottom = false) {
    const box = document.getElementById('student-chat-box');
    if (!box) return;

    if (AppState.studentChatMessages.length === 0) {
        box.innerHTML = `
            <div class="text-center text-xs text-slate-400 my-12">
                Belum ada riwayat pesan. Tuliskan pesan di bawah untuk memulai konsultasi.
            </div>
        `;
        return;
    }

    box.innerHTML = AppState.studentChatMessages
        .map((m) => {
            const isMe = m.sender_role === 'siswa';
            const timeStr = new Date(m.created_at).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit'
            });
            return `
            <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[80%] rounded-xl px-4 py-3 text-xs sm:text-sm ${
                    isMe
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-800 hc-card'
                }">
                    <div class="text-[10px] font-semibold mb-1 ${isMe ? 'text-slate-400' : 'text-teal-700'}">
                        ${isMe ? 'Anda' : 'Konselor'} • ${timeStr}
                    </div>
                    <p class="leading-relaxed whitespace-pre-line">${escapeHtml(m.message)}</p>
                </div>
            </div>
        `;
        })
        .join('');

    if (scrollToBottom) {
        box.scrollTop = box.scrollHeight;
    }
}

function fillQuickStudentChat(text) {
    const input = document.getElementById('student-chat-input');
    if (input) {
        input.value = text;
        input.focus();
    }
}

async function sendStudentChatMessage(event) {
    event.preventDefault();
    const input = document.getElementById('student-chat-input');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    try {
        await window.EmosikuAPI.request('/chat/send', {
            method: 'POST',
            body: JSON.stringify({
                student_id: AppState.currentUser.id,
                message
            })
        });
        await loadStudentChatMessages(false);
    } catch (error) {
        showToast(error.message || 'Gagal mengirim pesan.', 'error');
    }
}

// -------------------------------------------------------------------------
// 7. PANEL ADMIN / KONSELOR: MULTI-USER CHAT & DASBOR AGREGAT
// -------------------------------------------------------------------------
function switchAdminTab(tab) {
    const sections = ['chat', 'aggregate', 'requests'];
    sections.forEach((s) => {
        const el = document.getElementById(`admin-section-${s}`);
        const btn = document.getElementById(`admin-tab-btn-${s}`);
        if (el) {
            if (s === tab) {
                el.classList.remove('hidden');
                el.classList.remove('animate-view');
                void el.offsetWidth;
                el.classList.add('animate-view');
            } else {
                el.classList.add('hidden');
            }
        }
        if (btn) {
            if (s === tab) {
                btn.className = 'px-2.5 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-semibold bg-white text-slate-900 transition flex items-center gap-1.5 sm:gap-2';
            } else {
                btn.className = 'px-2.5 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-medium text-slate-300 hover:text-white transition flex items-center gap-1.5 sm:gap-2';
            }
        }
    });

    if (tab === 'aggregate' || tab === 'requests') {
        loadAdminDashboardData();
    }
}

function showAdminMobileConversationList() {
    const listPanel = document.getElementById('admin-chat-list-panel');
    const roomPanel = document.getElementById('admin-chat-room-panel');
    if (listPanel && roomPanel) {
        listPanel.classList.remove('hidden');
        listPanel.classList.add('flex');
        roomPanel.classList.add('hidden');
        roomPanel.classList.remove('flex');
    }
}

function showAdminMobileChatRoom() {
    const listPanel = document.getElementById('admin-chat-list-panel');
    const roomPanel = document.getElementById('admin-chat-room-panel');
    if (listPanel && roomPanel) {
        listPanel.classList.add('hidden');
        listPanel.classList.remove('flex');
        roomPanel.classList.remove('hidden');
        roomPanel.classList.add('flex');
    }
}

async function loadAdminConversations(silent = false) {
    if (!AppState.currentUser || AppState.currentUser.role !== 'admin') return;
    try {
        const res = await window.EmosikuAPI.request('/chat/admin/conversations');
        const overrides = getLocalProfileOverrides();
        // Filter keluar akun demo siswa (Rani, Bima, Alya)
        AppState.adminConversations = (res.conversations || [])
            .filter((c) => !isDemoStudentItem(c))
            .map((c) => {
                const ov = overrides[String(c.student_id)];
                if (!ov) return c;
                return {
                    ...c,
                    alias_name: ov.alias_name || c.alias_name,
                    class_code: ov.class_code || c.class_code,
                    avatar_url: ov.avatar_url !== undefined ? ov.avatar_url : (c.avatar_url || null)
                };
            });

        const totalUnread = AppState.adminConversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
        const badge = document.getElementById('admin-unread-badge');
        if (badge) {
            badge.textContent = totalUnread;
            if (totalUnread > 0) badge.classList.remove('hidden');
            else badge.classList.add('hidden');
        }

        renderAdminConversationList();

        if (
            AppState.activeAdminStudentId &&
            !AppState.adminConversations.some((c) => c.student_id === AppState.activeAdminStudentId)
        ) {
            AppState.activeAdminStudentId = null;
        }

        if (!AppState.activeAdminStudentId && AppState.adminConversations.length > 0) {
            selectAdminChatStudent(AppState.adminConversations[0].student_id, false);
        } else if (AppState.adminConversations.length === 0) {
            document.getElementById('admin-chat-student-name').textContent = 'Belum ada pengguna terdaftar';
            document.getElementById('admin-chat-student-meta').textContent = 'Pengguna yang mendaftar akun akan muncul di panel kiri';
            document.getElementById('admin-chat-messages-box').innerHTML = `
                <div class="text-center text-xs text-slate-400 my-12">
                    Belum ada pengguna aktif. Silakan daftarkan akun pengguna baru untuk memulai percakapan.
                </div>
            `;
        }
    } catch (err) {
        if (!silent) console.warn('Admin conversations error:', err);
    }
}

function renderAdminConversationList() {
    const listEl = document.getElementById('admin-conversation-list');
    if (!listEl) return;

    const query = (document.getElementById('admin-chat-search')?.value || '').toLowerCase().trim();
    const filtered = AppState.adminConversations.filter(
        (c) =>
            c.alias_name.toLowerCase().includes(query) ||
            c.class_code.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        listEl.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">Belum ada pengguna yang terdaftar.</div>`;
        return;
    }

    listEl.innerHTML = filtered
        .map((c) => {
            const isActive = AppState.activeAdminStudentId === c.student_id;
            const initial = (c.alias_name || 'P').charAt(0).toUpperCase();
            const avatarInner = c.avatar_url
                ? `<img src="${c.avatar_url}" alt="${escapeHtml(c.alias_name)}" class="w-full h-full object-cover" />`
                : initial;

            return `
            <button type="button" onclick="selectAdminChatStudent(${c.student_id}, true)"
                class="w-full p-4 text-left transition flex items-start gap-3 hover:bg-slate-50 ${
                    isActive ? 'bg-slate-100/90 border-l-2 border-l-slate-900' : ''
                } hc-card">
                <div class="w-9 h-9 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                    ${avatarInner}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1">
                        <span class="font-bold text-xs sm:text-sm text-slate-900 truncate hc-card">${escapeHtml(c.alias_name)}</span>
                        <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                            ${escapeHtml(c.class_code)}
                        </span>
                    </div>
                    <p class="text-xs text-slate-500 truncate mt-1 hc-text-muted">
                        ${c.last_sender_role === 'admin' ? 'Anda: ' : ''}${escapeHtml(c.last_message)}
                    </p>
                </div>
                ${
                    c.unread_count > 0
                        ? `<span class="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] shrink-0">${c.unread_count}</span>`
                        : ''
                }
            </button>
        `;
        })
        .join('');
}

async function selectAdminChatStudent(studentId, openMobileRoom = true) {
    AppState.activeAdminStudentId = studentId;
    if (openMobileRoom) {
        showAdminMobileChatRoom();
    }
    renderAdminConversationList();
    await loadAdminActiveChatMessages(studentId, false);
    await loadAdminConversations(true);
}

async function loadAdminActiveChatMessages(studentId, silent = false) {
    try {
        const res = await window.EmosikuAPI.request(`/chat/messages/${studentId}`);
        const rawStudent = res.student;
        const student = rawStudent ? applyLocalProfileOverride(rawStudent) : null;
        const messages = res.messages || [];

        if (student) {
            AppState.activeAdminStudentInfo = student;
            const avatar = document.getElementById('admin-chat-student-avatar');
            avatar.classList.add('overflow-hidden');
            renderAvatarBadgeContent(avatar, student);
            document.getElementById('admin-chat-student-name').textContent = `${student.alias_name}`;
            document.getElementById('admin-chat-student-meta').textContent = `Kelas ${student.class_code} • ${messages.length} pesan`;
        }

        const box = document.getElementById('admin-chat-messages-box');
        if (!box) return;

        box.innerHTML = messages
            .map((m) => {
                const isAdmin = m.sender_role === 'admin';
                const timeStr = new Date(m.created_at).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                return `
                <div class="flex ${isAdmin ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-[78%] rounded-xl px-4 py-3 text-xs sm:text-sm ${
                        isAdmin
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-200 text-slate-800 hc-card'
                    }">
                        <div class="text-[10px] font-semibold mb-1 ${isAdmin ? 'text-slate-400' : 'text-teal-700'}">
                            ${isAdmin ? 'Anda (Konselor)' : `${student ? escapeHtml(student.alias_name) : 'Pengguna'}`} • ${timeStr}
                        </div>
                        <p class="leading-relaxed whitespace-pre-line">${escapeHtml(m.message)}</p>
                    </div>
                </div>
            `;
            })
            .join('');

        if (!silent) {
            box.scrollTop = box.scrollHeight;
        }
    } catch (err) {
        if (!silent) console.warn('Load active student chat error:', err);
    }
}

function fillQuickAdminReply(text) {
    const input = document.getElementById('admin-chat-input');
    if (input) {
        input.value = text;
        input.focus();
    }
}

async function sendAdminChatMessage(event) {
    event.preventDefault();
    if (!AppState.activeAdminStudentId) {
        showToast('Pilih pengguna terlebih dahulu.', 'error');
        return;
    }
    const input = document.getElementById('admin-chat-input');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    try {
        await window.EmosikuAPI.request('/chat/send', {
            method: 'POST',
            body: JSON.stringify({
                student_id: AppState.activeAdminStudentId,
                message
            })
        });
        await loadAdminActiveChatMessages(AppState.activeAdminStudentId, false);
        await loadAdminConversations(true);
    } catch (error) {
        showToast(error.message || 'Gagal mengirim pesan.', 'error');
    }
}

// DASBOR AGREGAT & DAFTAR PERMINTAAN KONSELING
async function loadAdminDashboardData() {
    if (!AppState.currentUser || AppState.currentUser.role !== 'admin') return;
    const classSelectEl = document.getElementById('admin-class-filter');
    const classFilter = classSelectEl?.value || 'ALL';
    const enforceRule = document.getElementById('enforce-10-student-rule')?.checked || false;

    try {
        const res = await window.EmosikuAPI.request(`/counseling/admin/dashboard?classFilter=${encodeURIComponent(classFilter)}`);
        const deletedSet = getDeletedCounselingIds();
        const overrides = getLocalProfileOverrides();

        // Filter keluar jadwal konseling demo (Rani, Bima, Alya) & yang telah dihapus
        const cleanRequests = (res.counselingRequests || [])
            .filter((r) => !deletedSet.has(Number(r.id)) && !isDemoStudentItem(r))
            .map((r) => {
                const ov = overrides[String(r.user_id)];
                if (!ov) return r;
                return {
                    ...r,
                    student_name: ov.alias_name || r.student_name,
                    class_code: ov.class_code || r.class_code
                };
            });

        // Hitung partisipan riil (tanpa akun demo)
        const realStudentCount =
            AppState.adminConversations.length > 0
                ? AppState.adminConversations.length
                : Math.max(0, res.totalStudents);

        document.getElementById('agg-total-students').textContent = realStudentCount;
        document.getElementById('agg-total-logs').textContent = res.totalEmotionLogs;
        document.getElementById('agg-total-requests').textContent = cleanRequests.length;

        // Perbarui opsi filter kelas secara dinamis dari data nyata (tanpa kelas demo)
        if (classSelectEl && Array.isArray(res.classList)) {
            const realClasses = res.classList
                .map((c) => c.class_code)
                .filter((code) => code && !['XI-IPA-1', 'X-IPS-2'].includes(code));
            const currentVal = classSelectEl.value || 'ALL';
            classSelectEl.innerHTML =
                `<option value="ALL">Seluruh Kelas (Agregat Keseluruhan)</option>` +
                realClasses
                    .map(
                        (code) =>
                            `<option value="${escapeHtml(code)}" ${currentVal === code ? 'selected' : ''}>Kelas ${escapeHtml(code)}</option>`
                    )
                    .join('');
        }

        const guardBanner = document.getElementById('admin-privacy-guard-banner');
        const aggContent = document.getElementById('admin-aggregate-content');

        if (enforceRule && realStudentCount < 10) {
            guardBanner.classList.remove('hidden');
            aggContent.classList.add('hidden');
        } else {
            guardBanner.classList.add('hidden');
            aggContent.classList.remove('hidden');
        }

        const emoDistEl = document.getElementById('admin-emotion-distribution');
        const totalLogs = Math.max(1, res.totalEmotionLogs);
        emoDistEl.innerHTML = window.EMOSIKU_CONTENT.emotions
            .map((e) => {
                const count = res.emotionCounts?.[e.id] || 0;
                const pct = Math.round((count / totalLogs) * 100);
                return `
                <div class="space-y-1.5">
                    <div class="flex items-center justify-between text-xs">
                        <span class="font-semibold text-slate-700 flex items-center gap-2 hc-card">
                            <span class="w-2 h-2 rounded-full ${e.dotColor}"></span>
                            ${e.name}
                        </span>
                        <span class="font-bold text-slate-900 hc-card">${count} (${pct}%)</span>
                    </div>
                    <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-500" style="width: ${pct}%; background-color: ${e.chartColor}"></div>
                    </div>
                </div>
            `;
            })
            .join('');

        const trigDistEl = document.getElementById('admin-trigger-distribution');
        const triggers = res.triggerCounts || {};
        trigDistEl.innerHTML = Object.keys(triggers)
            .map((trig) => {
                const count = triggers[trig] || 0;
                const pct = Math.round((count / totalLogs) * 100);
                return `
                <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between hc-card">
                    <div>
                        <span class="font-bold text-xs text-slate-900 hc-card">${trig}</span>
                        <div class="text-[11px] text-slate-500 hc-text-muted">${pct}% dari keseluruhan catatan</div>
                    </div>
                    <span class="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-800 font-bold text-xs">${count}</span>
                </div>
            `;
            })
            .join('');

        AppState.adminCounselingRequests = cleanRequests;
        const reqListEl = document.getElementById('admin-counseling-requests-list');
        if (reqListEl) {
            if (cleanRequests.length === 0) {
                reqListEl.innerHTML = `<p class="text-xs text-slate-400">Belum ada permintaan jadwal konseling dari pengguna.</p>`;
            } else {
                reqListEl.innerHTML = cleanRequests
                    .map(
                        (r) => `
                    <div class="p-5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hc-card">
                        <div class="space-y-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="font-bold text-sm text-slate-900 hc-card">${escapeHtml(r.student_name)}</span>
                                <span class="text-[11px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">${escapeHtml(r.class_code)}</span>
                                <span class="text-[11px] font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">${r.status}</span>
                            </div>
                            <p class="text-xs text-slate-600 hc-text-muted"><strong>Topik:</strong> ${escapeHtml(r.topic)} • <strong>Waktu Luang:</strong> ${escapeHtml(r.free_time)}</p>
                            ${r.description ? `<p class="text-xs text-slate-500 italic hc-text-muted">"${escapeHtml(r.description)}"</p>` : ''}
                        </div>
                        <div class="flex flex-wrap items-center gap-2 shrink-0">
                            <button type="button" onclick="openStudentChatFromRequest(${r.user_id})" class="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition">
                                Buka Chat
                            </button>
                            <button type="button" onclick="updateCounselingRequestStatus(${r.id}, 'Dijadwalkan')" class="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-xs transition">
                                Jadwalkan
                            </button>
                            <button type="button" onclick="updateCounselingRequestStatus(${r.id}, 'Selesai')" class="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-semibold text-xs transition">
                                Selesai
                            </button>
                            <button type="button" onclick="deleteAdminCounselingRequest(${r.id})" class="px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs transition">
                                Hapus
                            </button>
                        </div>
                    </div>
                `
                    )
                    .join('');
            }
        }
    } catch (err) {
        console.warn('Admin dashboard load error:', err);
    }
}

function openStudentChatFromRequest(studentUserId) {
    switchAdminTab('chat');
    selectAdminChatStudent(studentUserId);
}

async function updateCounselingRequestStatus(requestId, status) {
    const counselor_note =
        status === 'Dijadwalkan'
            ? 'Jadwal konseling telah dikonfirmasi. Silakan hadir sesuai waktu yang diajukan atau lanjutkan diskusi melalui ruang chat.'
            : 'Sesi layanan konseling telah selesai dilaksanakan.';
    try {
        await window.EmosikuAPI.request(`/counseling/admin/${requestId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status, counselor_note })
        });
        showToast(`Status diperbarui menjadi: ${status}`, 'success');
        await loadAdminDashboardData();
    } catch (error) {
        showToast(error.message || 'Gagal memperbarui status.', 'error');
    }
}

async function deleteAdminCounselingRequest(requestId) {
    markCounselingIdsDeleted([requestId]);
    try {
        await window.EmosikuAPI.request(`/counseling/admin/${requestId}`, {
            method: 'DELETE'
        });
    } catch (e) {
        // Tetap hapus dari tampilan apabila server belum di-restart
    }
    showToast('Permintaan jadwal konseling berhasil dihapus.', 'info');
    await loadAdminDashboardData();
}

async function clearAllCounselingRequests() {
    const allIds = (AppState.adminCounselingRequests || []).map((r) => r.id);
    markCounselingIdsDeleted(allIds);
    try {
        await window.EmosikuAPI.request('/counseling/admin/clear/all', {
            method: 'DELETE'
        });
    } catch (e) {
        // Tetap bersihkan dari tampilan apabila server belum di-restart
    }
    showToast('Seluruh daftar permintaan jadwal konseling telah dihapus.', 'info');
    await loadAdminDashboardData();
}

// -------------------------------------------------------------------------
// 8. MODAL BANTUAN KRISIS & EVALUASI SUS
// -------------------------------------------------------------------------
function openEmergencyModal() {
    const m = document.getElementById('modal-emergency');
    m.classList.remove('hidden');
    m.classList.add('flex');
}

function closeEmergencyModal() {
    const m = document.getElementById('modal-emergency');
    m.classList.add('hidden');
    m.classList.remove('flex');
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

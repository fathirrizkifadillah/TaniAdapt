/**
 * Client Authentication & Profile Service for TaniAdapt.
 * Connects to PostgreSQL-backed API with offline local storage sync.
 */

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  user_type: 'petani' | 'farm_organisasi';
  created_at?: string;
}

export interface UserProfileData {
  user_id?: number;
  commodity: string;
  location_name: string;
  latitude: number;
  longitude: number;
  planting_date: string;
  hst: number;
  farm_area_ha: number;
  organization_name?: string;
  updated_at?: string;
}

const AUTH_USER_KEY = 'taniadapt_auth_user';
const AUTH_PROFILE_KEY = 'taniadapt_auth_profile';
const UI_MODE_KEY = 'taniadapt_ui_mode';

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(AUTH_USER_KEY) || sessionStorage.getItem(AUTH_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function getStoredProfile(): UserProfileData | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(AUTH_PROFILE_KEY) || sessionStorage.getItem(AUTH_PROFILE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function getStoredUIMode(): 'default' | 'pro' {
  if (typeof window === 'undefined') return 'default';
  const mode = sessionStorage.getItem(UI_MODE_KEY) || localStorage.getItem(UI_MODE_KEY);
  return mode === 'pro' ? 'pro' : 'default';
}

export function setStoredUIMode(mode: 'default' | 'pro'): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(UI_MODE_KEY, mode);
    localStorage.setItem(UI_MODE_KEY, mode);
  }
}

export function saveAuthSession(user: AuthUser, profile: UserProfileData | null): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    if (profile) {
      localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
      sessionStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
    }
  }
}

export function clearAuthSession(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(AUTH_PROFILE_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_PROFILE_KEY);
    sessionStorage.removeItem('taniadapt_demo_guest');
    localStorage.removeItem('taniadapt_demo_guest');
  }
}

const ACCOUNTS_DB_KEY = 'taniadapt_accounts_store';

interface StoredAccount {
  user: AuthUser;
  passwordHash: string;
  profile: UserProfileData;
}

function getStoredAccounts(): StoredAccount[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(ACCOUNTS_DB_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveStoredAccount(account: StoredAccount): void {
  if (typeof window === 'undefined') return;
  const accounts = getStoredAccounts().filter(a => a.user.email.toLowerCase() !== account.user.email.toLowerCase());
  accounts.push(account);
  localStorage.setItem(ACCOUNTS_DB_KEY, JSON.stringify(accounts));
}

export async function loginUser(email: string, password: string): Promise<{ success: boolean; user?: AuthUser; profile?: UserProfileData; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.user) {
      saveAuthSession(data.user, data.profile);
      saveStoredAccount({ user: data.user, passwordHash: password, profile: data.profile });
      return { success: true, user: data.user, profile: data.profile };
    }
    if (data.error) {
      return { success: false, error: data.error };
    }
  } catch (err: any) {
    console.warn('Network error on login:', err);
  }

  // Offline fallback to stored accounts
  const normalizedEmail = email.trim().toLowerCase();
  const accounts = getStoredAccounts();
  const matched = accounts.find(a => a.user.email.toLowerCase() === normalizedEmail);

  if (matched && matched.passwordHash === password) {
    saveAuthSession(matched.user, matched.profile);
    return { success: true, user: matched.user, profile: matched.profile };
  }

  return { success: false, error: 'Email atau kata sandi tidak cocok.' };
}

export async function registerUser(
  email: string,
  password: string,
  fullName: string,
  userType: 'petani' | 'farm_organisasi',
  profile: Partial<UserProfileData>
): Promise<{ success: boolean; user?: AuthUser; profile?: UserProfileData; error?: string }> {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        user_type: userType,
        profile,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.user) {
      saveAuthSession(data.user, data.profile);
      saveStoredAccount({ user: data.user, passwordHash: password, profile: data.profile });
      return { success: true, user: data.user, profile: data.profile };
    }
    if (data.error) {
      return { success: false, error: data.error };
    }
  } catch (err: any) {
    console.warn('Network error on register:', err);
  }

  return { success: false, error: 'Tidak dapat terhubung ke server database TaniAdapt. Pastikan koneksi aktif.' };
}

export async function updateUserProfile(userId: number, profile: Partial<UserProfileData>): Promise<{ success: boolean; profile?: UserProfileData; error?: string }> {
  try {
    const res = await fetch('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, profile }),
    });

    if (res.ok) {
      const data = await res.json();
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(data.profile));
      }
      return { success: true, profile: data.profile };
    }
  } catch {
    // Static hosting fallback
  }

  const existingProfile = getStoredProfile() || {
    user_id: userId,
    commodity: 'cabai',
    location_name: 'Lembang, Jawa Barat',
    latitude: -6.8167,
    longitude: 107.6167,
    planting_date: new Date().toISOString().split('T')[0],
    hst: 35,
    farm_area_ha: 1
  };

  const mergedProfile: UserProfileData = {
    ...existingProfile,
    ...profile,
    updated_at: new Date().toISOString()
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(mergedProfile));
  }
  return { success: true, profile: mergedProfile };
}


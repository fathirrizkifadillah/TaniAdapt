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
  const raw = localStorage.getItem(AUTH_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function getStoredProfile(): UserProfileData | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(AUTH_PROFILE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function getStoredUIMode(): 'default' | 'pro' {
  if (typeof window === 'undefined') return 'default';
  const mode = localStorage.getItem(UI_MODE_KEY);
  return mode === 'pro' ? 'pro' : 'default';
}

export function setStoredUIMode(mode: 'default' | 'pro'): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(UI_MODE_KEY, mode);
  }
}

export function saveAuthSession(user: AuthUser, profile: UserProfileData | null): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    if (profile) {
      localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
    }
  }
}

export function clearAuthSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_PROFILE_KEY);
  }
}

export async function loginUser(email: string, password: string): Promise<{ success: boolean; user?: AuthUser; profile?: UserProfileData; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Gagal masuk akun' };
    }

    saveAuthSession(data.user, data.profile);
    return { success: true, user: data.user, profile: data.profile };
  } catch (err: any) {
    // Offline resilience check
    const localUser = getStoredUser();
    if (localUser && localUser.email.toLowerCase() === email.toLowerCase()) {
      return { success: true, user: localUser, profile: getStoredProfile() || undefined };
    }
    return { success: false, error: 'Gagal terhubung ke server auth: ' + err.message };
  }
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

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Gagal mendaftar akun' };
    }

    saveAuthSession(data.user, data.profile);
    return { success: true, user: data.user, profile: data.profile };
  } catch (err: any) {
    return { success: false, error: 'Gagal terhubung ke server: ' + err.message };
  }
}

export async function updateUserProfile(userId: number, profile: Partial<UserProfileData>): Promise<{ success: boolean; profile?: UserProfileData; error?: string }> {
  try {
    const res = await fetch('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, profile }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Gagal memperbarui profil' };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(data.profile));
    }
    return { success: true, profile: data.profile };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

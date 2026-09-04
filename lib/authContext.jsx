'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext(null);

// Helper to normalize Indonesian WhatsApp numbers to 628xxx format
export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, ''); // keep only digits
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '628' + cleaned.slice(1);
  }
  return cleaned;
}

// Simple SHA-256 hash using Web Crypto API
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_wasap_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wasap_user_session');
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to restore session:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Login with Username OR WhatsApp Number + Password
  async function login(identifier, password) {
    const trimmedId = identifier.trim();
    const cleanPhone = normalizePhoneNumber(trimmedId);
    const passwordHash = await hashPassword(password);

    // Search user by username OR phone_number
    let query = supabase.from('users').select('*');
    if (/^\d+$/.test(cleanPhone)) {
      query = query.or(`phone_number.eq.${cleanPhone},username.eq.${trimmedId}`);
    } else {
      query = query.eq('username', trimmedId);
    }

    const { data: users, error } = await query;
    if (error) throw new Error(error.message);

    if (!users || users.length === 0) {
      throw new Error('Akun tidak ditemukan. Silakan periksa username atau nomor WhatsApp.');
    }

    const foundUser = users[0];
    if (foundUser.password_hash !== passwordHash) {
      throw new Error('Password salah. Silakan coba lagi.');
    }

    const userSession = {
      id: foundUser.id,
      username: foundUser.username,
      phone_number: foundUser.phone_number,
      role: foundUser.role || 'user',
      created_at: foundUser.created_at,
    };

    setUser(userSession);
    localStorage.setItem('wasap_user_session', JSON.stringify(userSession));
    return userSession;
  }

  // Register new account
  async function register(username, phoneNumber, password) {
    const cleanUsername = username.trim().toLowerCase();
    const cleanPhone = normalizePhoneNumber(phoneNumber);

    if (!cleanUsername || cleanUsername.length < 3) {
      throw new Error('Username minimal 3 karakter.');
    }
    if (!cleanPhone || cleanPhone.length < 9) {
      throw new Error('Nomor WhatsApp tidak valid.');
    }
    if (!password || password.length < 4) {
      throw new Error('Password minimal 4 karakter.');
    }

    // Check if username or phone is already taken
    const { data: existingUsers, error: checkErr } = await supabase
      .from('users')
      .select('id, username, phone_number')
      .or(`username.eq.${cleanUsername},phone_number.eq.${cleanPhone}`);

    if (checkErr && checkErr.code !== 'PGRST116') {
      console.error('Check user error:', checkErr);
    }

    if (existingUsers && existingUsers.length > 0) {
      const match = existingUsers[0];
      if (match.username.toLowerCase() === cleanUsername) {
        throw new Error('Username ini sudah dipakai. Silakan pilih username lain.');
      }
      if (match.phone_number === cleanPhone) {
        throw new Error('Nomor WhatsApp ini sudah terdaftar. Silakan login.');
      }
    }

    // Check total users count (first user automatically becomes 'admin')
    const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const assignedRole = (count === 0 || cleanUsername === 'admin') ? 'admin' : 'user';

    const passwordHash = await hashPassword(password);

    const { data: newUser, error: insertErr } = await supabase
      .from('users')
      .insert([
        {
          username: cleanUsername,
          phone_number: cleanPhone,
          password_hash: passwordHash,
          role: assignedRole,
        },
      ])
      .select()
      .single();

    if (insertErr) throw new Error(insertErr.message);

    const userSession = {
      id: newUser.id,
      username: newUser.username,
      phone_number: newUser.phone_number,
      role: newUser.role || assignedRole,
      created_at: newUser.created_at,
    };

    setUser(userSession);
    localStorage.setItem('wasap_user_session', JSON.stringify(userSession));
    return userSession;
  }

  // Logout
  function logout() {
    setUser(null);
    localStorage.removeItem('wasap_user_session');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  user_id: number;
  name: string;
  email: string;
  role: string;
  phone: string;
  status: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      // ✅ LOGIN
      login: async (email, password) => {
        try {
          const res = await fetch("http://localhost:8000/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
          });

          const data = await res.json();

          if (!res.ok) {
            console.error("Login failed:", data);
            return false;
          }

          // 🚨 STRICT VALIDATION
          if (
            !data.access_token ||
            !data.user ||
            typeof data.user.user_id !== "number" ||
            !data.user.role
          ) {
            console.error("Invalid login response:", data);
            return false;
          }

          // 🔥 Normalize role (avoid "Customer" vs "customer" bugs)
          const normalizedUser = {
            ...data.user,
            role: data.user.role.toLowerCase(),
          };

          set({
            user: normalizedUser,
            token: data.access_token,
            isAuthenticated: true,
          });

          return true;

        } catch (err) {
          console.error("Login error:", err);
          return false;
        }
      },

      // ✅ LOGOUT
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: "medease-auth",

      // 🧠 AUTO CLEANUP if corrupted storage
      onRehydrateStorage: () => (state) => {
        if (!state?.token || !state?.user) {
          state?.logout();
        }
      },
    }
  )
);
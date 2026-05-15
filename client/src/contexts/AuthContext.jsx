import React, { createContext, useContext, useState, useCallback } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

const TOKEN_KEY = "zakat_jwt";
const ROLE_KEY  = "zakat_role";
const ADDR_KEY  = "zakat_address";

export function AuthProvider({ children }) {
  const [token,       setToken]       = useState(() => localStorage.getItem(TOKEN_KEY));
  const [role,        setRole]        = useState(() => localStorage.getItem(ROLE_KEY));
  const [userAddress, setUserAddress] = useState(() => localStorage.getItem(ADDR_KEY));

  const login = useCallback(async (address, signer) => {
    const { data: { nonce } } = await api.get(`/auth/nonce/${address}`);
    const signature = await signer.signMessage(nonce);
    const { data }  = await api.post("/auth/verify", { address, signature });

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(ROLE_KEY,  data.role);
    localStorage.setItem(ADDR_KEY,  data.walletAddress);
    setToken(data.token);
    setRole(data.role);
    setUserAddress(data.walletAddress);

    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(ADDR_KEY);
    setToken(null);
    setRole(null);
    setUserAddress(null);
  }, []);

  const isAuthenticated = Boolean(token);

  return (
    <AuthContext.Provider value={{ token, role, userAddress, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

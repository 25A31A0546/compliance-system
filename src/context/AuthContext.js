import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

export const USERS_BY_ROLE = {
  officer: {
    id: 'OFF-402',
    name: 'Inspector A. Sharma',
    title: 'Legal Metrology Field Inspector',
    badgeNumber: 'LM-KA-4029',
    zone: 'Zone 4 - Enforcement Division',
    role: 'officer',
  },
  supervisor: {
    id: 'SUP-101',
    name: 'Director V. Raman',
    title: 'Chief Enforcement Supervisor',
    badgeNumber: 'LM-HQ-1012',
    zone: 'Headquarters - Audit & Compliance',
    role: 'supervisor',
  },
};

export function AuthProvider({ children }) {
  // Role can be 'officer', 'supervisor', or null
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);

  const login = (selectedRole) => {
    const profile = USERS_BY_ROLE[selectedRole] || {
      id: 'USER-001',
      name: selectedRole === 'officer' ? 'Inspector Officer' : 'Review Supervisor',
      role: selectedRole,
    };
    setRole(selectedRole);
    setUser(profile);
  };

  const logout = () => {
    setRole(null);
    setUser(null);
  };

  const switchRole = (newRole) => {
    login(newRole);
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        user,
        login,
        logout,
        switchRole,
        isOfficer: role === 'officer',
        isSupervisor: role === 'supervisor',
      }}
    >
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

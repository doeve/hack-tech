import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // Auth
  user: null,
  accessToken: null,
  setAuth: (user, token) => set({ user, accessToken: token }),
  logout: () => set({ user: null, accessToken: null }),

  // Session
  session: null,
  setSession: (s) => set({ session: s }),

  // Position (updated by WebSocket)
  position: { x_m: 20, y_m: 30, heading_deg: 0, drift_radius_m: 0, source: 'manual_set' },
  setPosition: (p) => set({ position: p }),

  // Airport
  airport: null,
  pois: [],
  navGraph: { nodes: [], edges: [] },
  setAirport: (a) => set({ airport: a }),
  setPois: (p) => set({ pois: p }),
  setNavGraph: (g) => set({ navGraph: g }),

  // Route
  route: null,
  currentStepIndex: 0,
  setRoute: (r) => set({ route: r, currentStepIndex: 0 }),
  advanceStep: () => set((s) => ({ currentStepIndex: s.currentStepIndex + 1 })),

  // Identity
  biometricId: null,
  documentId: null,
  verificationToken: null,
  setBiometricId: (id) => set({ biometricId: id }),
  setDocumentId:  (id) => set({ documentId: id }),
  setVerificationToken: (t) => set({ verificationToken: t }),

  // Accessibility
  accessProfile: {
    nav_mode: 'standard',
    haptics_enabled: true,
    haptic_intensity: 1.0,
    tts_enabled: false,
    ar_enabled: true,
    avoid_stairs: false,
  },
  setAccessProfile: (p) => set({ accessProfile: p }),

  // Demo
  isReplaying: false,
  setReplaying: (v) => set({ isReplaying: v }),
}))

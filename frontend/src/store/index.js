import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useStore = create(
  persist(
    (set, get) => ({
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
      positionConfirmed: false,
      setPosition: (p) => set({ position: p }),
      setPositionConfirmed: (v) => set({ positionConfirmed: v }),

      // Airport
      airport: null,
      pois: [],
      navGraph: { nodes: [], edges: [] },
      setAirport: (a) => set({ airport: a }),
      setPois: (p) => set({ pois: p }),
      setNavGraph: (g) => set({ navGraph: g }),
      floorWalls: [],  // [{x1,y1,x2,y2}] in normalized 0..1 coords, parsed from SVG
      setFloorWalls: (w) => set({ floorWalls: w }),
      floorSvgDims: null, // {w, h} from SVG viewBox — used to compute aspect-correct bounds
      setFloorSvgDims: (d) => set({ floorSvgDims: d }),

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
      setDocumentId: (id) => set({ documentId: id }),
      setVerificationToken: (t) => set({ verificationToken: t }),

      // Accessibility
      accessProfile: {
        nav_mode: 'standard',
        haptics_enabled: true,
        haptic_intensity: 1.0,
        tts_enabled: false,
        tts_speed: 1.0,
        ar_enabled: true,
        avoid_stairs: false,
      },
      setAccessProfile: (p) => set({ accessProfile: p }),

      // Onboarding
      onboardingComplete: false,
      setOnboardingComplete: (v) => set({ onboardingComplete: v }),

      // Journey (auto-navigation through mandatory POIs)
      journeyPlan: null,    // [{poi_id, name, category, x_m, y_m}, ...]
      journeyStepIndex: 0,
      journeyFlight: null,  // the flight being journeyed to
      setJourneyPlan: (plan, flight) => set({ journeyPlan: plan, journeyStepIndex: 0, journeyFlight: flight }),
      advanceJourneyStep: () => set((s) => ({ journeyStepIndex: s.journeyStepIndex + 1 })),
      clearJourney: () => set({ journeyPlan: null, journeyStepIndex: 0, journeyFlight: null }),

      // Demo
      isReplaying: false,
      setReplaying: (v) => set({ isReplaying: v }),

      // ── Identity: Face Verification ─
      faceVerifiedThisSession: false,
      setFaceVerifiedThisSession: (v) => set({ faceVerifiedThisSession: v }),
    }),
    {
      name: 'skyguide-store',
      partialize: (state) => ({
        // Only persist auth + identity state — not transient data
        user: state.user,
        accessToken: state.accessToken,
        biometricId: state.biometricId,
        documentId: state.documentId,
        accessProfile: state.accessProfile,
        onboardingComplete: state.onboardingComplete,
      }),
    }
  )
)

"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import {
  type EngineState,
  type UserProfile,
  type SwipeDirection,
  type Insight,
  type Recommendation,
  type DriftState,
  RECOMMENDATIONS,
  createEngine,
  applySwipe,
  applyInsight,
  applyVoiceIntent,
  detectInsight,
  reSurface,
  driftState,
  dismissInsightAsBusy,
} from "@/lib/engine";
import { compressCognitiveState } from "@/lib/cognitive";
import { type VoiceReading } from "@/lib/voice";

export interface CoachMessage {
  role: "user" | "coach";
  text: string;
}

const INSIGHT_COOLDOWN_MS = 4000;

export function useEngine() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [state, setState] = useState<EngineState | null>(null);
  const [activeInsight, setActiveInsight] = useState<Insight | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [reading, setReading] = useState<VoiceReading | null>(null);
  const lastInsightAt = useRef(0);
  // When the current top card was first shown — lets us measure dwell time
  // (timeToSwipeMs) without any change to the card UI. A fast skip on a long
  // card is treated as a format rejection, not a topic rejection (Fix 1).
  const cardShownAt = useRef(0);

  // Drift state drives the fatigue-aware router and the (optional) cooldown UI.
  const drift: DriftState = useMemo(
    () => (state ? driftState(state.history) : "healthy"),
    [state]
  );

  // Compressed Cognitive State — rebuilt from scratch each turn (never
  // appended), so it stays O(1) in session length. Drives the wellbeing radar
  // and the corrective-pivot banner.
  const ccs = useMemo(
    () => (state && profile ? compressCognitiveState(state.history, profile, RECOMMENDATIONS) : null),
    [state, profile]
  );

  const start = useCallback((p: UserProfile) => {
    setProfile(p);
    setState(createEngine(p));
    cardShownAt.current = Date.now();
  }, []);

  const swipe = useCallback(
    (card: Recommendation, direction: SwipeDirection) => {
      if (!state || !profile) return;
      const now = Date.now();
      // Dwell on the top card since it was shown. Guarded so the very first
      // swipe (or a rehydrated session) doesn't report a bogus multi-hour dwell.
      const shownAt = cardShownAt.current;
      const timeToSwipeMs = shownAt > 0 ? now - shownAt : undefined;
      cardShownAt.current = now;

      const next = applySwipe(state, card, direction, profile, timeToSwipeMs);
      setState(next);

      if (now - lastInsightAt.current > INSIGHT_COOLDOWN_MS) {
        const insight = detectInsight(next, profile);
        if (insight) {
          setActiveInsight(insight);
          lastInsightAt.current = now;
        }
      }
    },
    [state, profile]
  );

  const resurface = useCallback(
    (cardId: string) => {
      if (!state || !profile) return;
      setState(reSurface(state, cardId, profile));
    },
    [state, profile]
  );

  const applyActiveInsight = useCallback(() => {
    if (!state || !profile || !activeInsight) return;
    setState(applyInsight(state, activeInsight, profile));
    setActiveInsight(null);
    cardShownAt.current = Date.now(); // back to the deck; restart the dwell clock
    setToast("Recommendations updated");
    setTimeout(() => setToast(null), 2200);
  }, [state, profile, activeInsight]);

  // "That's not it — I'm just busy": keep the interest the engine thought was
  // fading, and don't nag about it again. Pairs with Fix 1 (fast skips already
  // avoid eroding the topic weight in the first place).
  const dismissAsBusy = useCallback(() => {
    if (!state || !profile || !activeInsight) return;
    setState(dismissInsightAsBusy(state, activeInsight, profile));
    setActiveInsight(null);
    cardShownAt.current = Date.now();
    setToast("Kept — we'll ease off, not drop it");
    setTimeout(() => setToast(null), 2200);
  }, [state, profile, activeInsight]);

  // The conversational coach: a spoken/typed transcript is extracted into a
  // VoiceReading that visibly re-weights the engine, and the coach replies with
  // a curiosity-inducing question grounded in that reading.
  const converse = useCallback(
    (transcript: string) => {
      if (!state || !profile || !transcript.trim()) return;
      const text = transcript.trim();
      setMessages((m) => [...m, { role: "user", text }]);
      const { state: next, reading: r } = applyVoiceIntent(state, text, profile);
      setState(next);
      setReading(r);
      setMessages((m) => [...m, { role: "coach", text: r.coachReply }]);
    },
    [state, profile]
  );

  const dismissInsight = useCallback(() => {
    if (!state || !activeInsight) return;
    setState({
      ...state,
      dismissedInsights: new Set(Array.from(state.dismissedInsights).concat(activeInsight.id)),
    });
    setActiveInsight(null);
    cardShownAt.current = Date.now();
  }, [state, activeInsight]);

  return {
    profile,
    state,
    ccs,
    drift,
    activeInsight,
    toast,
    messages,
    reading,
    start,
    swipe,
    resurface,
    converse,
    applyActiveInsight,
    dismissInsight,
    dismissAsBusy,
  };
}

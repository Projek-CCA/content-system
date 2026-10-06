import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { finishOpenRouterSignIn, type ProviderId } from '../lib/ai';
import { useAppState } from './AppState';
import { usePersistentState } from './usePersistentState';

type Keys = Partial<Record<ProviderId, string>>;

interface AiStateValue {
  provider: ProviderId;
  setProvider: (provider: ProviderId) => void;
  models: Partial<Record<ProviderId, string>>;
  setModel: (provider: ProviderId, model: string) => void;
  keys: Keys;
  setKey: (provider: ProviderId, key: string) => void;
  forgetKey: (provider: ProviderId) => void;
  /** Keep keys after the tab closes (localStorage) or only for this session. */
  remember: boolean;
  setRemember: (remember: boolean) => void;
  /** Ready to generate: the chosen provider has a key and a model. */
  ready: boolean;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

const AiStateContext = createContext<AiStateValue | null>(null);
const KEYS_STORAGE = 'cim.ai.keys';

function readKeys(): Keys {
  for (const store of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const raw = store().getItem(KEYS_STORAGE);
      if (raw) return JSON.parse(raw) as Keys;
    } catch {
      // Storage blocked: keys live in memory for this visit.
    }
  }
  return {};
}

function writeKeys(keys: Keys, remember: boolean) {
  const [keep, drop] = remember ? [window.localStorage, window.sessionStorage] : [window.sessionStorage, window.localStorage];
  try {
    drop.removeItem(KEYS_STORAGE);
    if (Object.keys(keys).length) keep.setItem(KEYS_STORAGE, JSON.stringify(keys));
    else keep.removeItem(KEYS_STORAGE);
  } catch {
    // Not critical.
  }
}

export function AiStateProvider({ children }: { children: ReactNode }) {
  const { notify } = useAppState();
  const [provider, setProvider] = usePersistentState<ProviderId>('ai.provider', 'anthropic');
  const [models, setModels] = usePersistentState<Partial<Record<ProviderId, string>>>('ai.models', {});
  const [remember, setRemember] = usePersistentState<boolean>('ai.remember', true);
  const [keys, setKeys] = useState<Keys>(readKeys);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => writeKeys(keys, remember), [keys, remember]);

  // Coming back from the OpenRouter sign-in page with ?code=...
  useEffect(() => {
    finishOpenRouterSignIn()
      .then((key) => {
        if (!key) return;
        setKeys((prev) => ({ ...prev, openrouter: key }));
        setProvider('openrouter');
        setSettingsOpen(true);
        notify('Connected to OpenRouter');
      })
      .catch((error: Error) => {
        setSettingsOpen(true);
        notify(error.message);
      });
    // Runs once on load.
  }, []);

  const setKey = useCallback((p: ProviderId, key: string) => setKeys((prev) => ({ ...prev, [p]: key.trim() })), []);
  const forgetKey = useCallback(
    (p: ProviderId) =>
      setKeys((prev) => {
        const next = { ...prev };
        delete next[p];
        return next;
      }),
    [],
  );

  const value = useMemo<AiStateValue>(
    () => ({
      provider,
      setProvider,
      models,
      setModel: (p, model) => setModels((prev) => ({ ...prev, [p]: model })),
      keys,
      setKey,
      forgetKey,
      remember,
      setRemember,
      ready: Boolean(keys[provider] && models[provider]),
      settingsOpen,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
    }),
    [provider, setProvider, models, setModels, keys, setKey, forgetKey, remember, setRemember, settingsOpen],
  );

  return <AiStateContext.Provider value={value}>{children}</AiStateContext.Provider>;
}

export function useAiState(): AiStateValue {
  const value = useContext(AiStateContext);
  if (!value) throw new Error('useAiState must be used inside <AiStateProvider>');
  return value;
}

import { useEffect, useState } from 'react';
import { listModels, pickDefaultModel, PROVIDER_ORDER, PROVIDERS, type ProviderId, startOpenRouterSignIn } from '../lib/ai';
import { useAiState } from '../state/AiState';
import { usePersistentState } from '../state/usePersistentState';
import { Icon } from './Icon';
import { Modal } from './Modal';

/** Connect your own AI account: a key for Claude, ChatGPT or Gemini, or OpenRouter. */
export function AiSettings() {
  const ai = useAiState();
  if (!ai.settingsOpen) return null;
  return (
    <Modal title="Connect your AI" onClose={ai.closeSettings} wide>
      <div className="ai-settings">
        <p className="muted">
          Use your own AI account to write full scripts from any idea. Your key stays in this browser and requests go straight from
          your browser to the provider. You pay the provider directly, usually a few cents per script.
        </p>

        <div className="segmented ai-settings__tabs" role="tablist" aria-label="AI provider">
          {PROVIDER_ORDER.map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={ai.provider === id}
              className={ai.provider === id ? 'is-on' : ''}
              onClick={() => ai.setProvider(id)}
            >
              {PROVIDERS[id].label}
              {ai.keys[id] && ai.models[id] && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>

        <ProviderPanel key={ai.provider} provider={ai.provider} />

        <label className="check">
          <input type="checkbox" checked={ai.remember} onChange={(e) => ai.setRemember(e.target.checked)} /> Remember my keys on this device
        </label>
        <p className="small muted">
          Turn this off on a shared computer: keys are then forgotten when you close the tab. Never paste someone else's key, and
          don't share your key with anyone.
        </p>
      </div>
    </Modal>
  );
}

function ProviderPanel({ provider }: { provider: ProviderId }) {
  const ai = useAiState();
  const info = PROVIDERS[provider];
  const savedKey = ai.keys[provider] ?? '';
  const [draft, setDraft] = useState(savedKey);
  const [show, setShow] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<{ kind: 'idle' | 'loading' | 'ok' | 'error'; message?: string }>({ kind: 'idle' });

  const connect = async (key: string) => {
    if (!key.trim()) return;
    setStatus({ kind: 'loading' });
    try {
      const ids = await listModels(provider, key.trim());
      if (!ids.length) throw new Error('No usable models were found on this account.');
      setModels(ids);
      ai.setKey(provider, key);
      const current = ai.models[provider];
      if (!current || !ids.includes(current)) ai.setModel(provider, pickDefaultModel(provider, ids) ?? ids[0]);
      setStatus({ kind: 'ok' });
    } catch (error) {
      setStatus({ kind: 'error', message: (error as Error).message });
    }
  };

  // Load the model list for a key that is already saved.
  useEffect(() => {
    if (savedKey) connect(savedKey);
    // Only when the panel opens for this provider.
  }, []);

  const model = ai.models[provider] ?? '';

  return (
    <div className="ai-provider">
      {provider === 'openrouter' && (
        <div className="ai-provider__signin">
          <button className="btn btn--primary" onClick={() => startOpenRouterSignIn()}>
            <Icon name="user" /> {savedKey ? 'Sign in again with OpenRouter' : 'Sign in with OpenRouter'}
          </button>
          <span className="muted small">
            One account for Claude, ChatGPT, Gemini and more. You'll approve access on OpenRouter and come straight back here.
          </span>
          <div className="ai-provider__or">
            <span>or paste an OpenRouter key</span>
          </div>
        </div>
      )}

      <label className="field">
        <span>
          {info.company} API key{' '}
          <a href={info.keyUrl} target="_blank" rel="noreferrer" className="small">
            Get a key
          </a>
        </span>
        <div className="ai-provider__key">
          <input
            id={`ai-key-${provider}`}
            type={show ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={draft}
            placeholder={info.keyPlaceholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && connect(draft)}
          />
          <button type="button" className="btn btn--small btn--ghost" onClick={() => setShow(!show)}>
            {show ? 'Hide' : 'Show'}
          </button>
          <button type="button" className="btn btn--small" disabled={!draft.trim() || status.kind === 'loading'} onClick={() => connect(draft)}>
            {status.kind === 'loading' ? 'Checking...' : 'Connect'}
          </button>
        </div>
        {provider !== 'openrouter' && (
          <small className="muted">
            This needs a {info.company} developer (API) account with billing. A {info.label} chat subscription alone doesn't include
            an API key.
          </small>
        )}
      </label>

      {status.kind === 'error' && <p className="report report--error">{status.message}</p>}

      {(status.kind === 'ok' || (savedKey && model)) && (
        <div className="ai-provider__connected">
          <span className="ai-status is-on">
            <Icon name="check" size={14} /> Connected to {info.label}
          </span>
          <label className="field field--inline">
            <span>Model</span>
            {models.length ? (
              <select value={model} onChange={(e) => ai.setModel(provider, e.target.value)}>
                {models.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            ) : (
              <input value={model} onChange={(e) => ai.setModel(provider, e.target.value)} />
            )}
          </label>
          <button
            className="btn btn--small btn--ghost"
            onClick={() => {
              ai.forgetKey(provider);
              setDraft('');
              setModels([]);
              setStatus({ kind: 'idle' });
            }}
          >
            Forget key
          </button>
        </div>
      )}
    </div>
  );
}

/** Header button showing whether AI is connected. Loud until it is. */
export function AiButton() {
  const ai = useAiState();
  const info = PROVIDERS[ai.provider];
  return (
    <button className={`ai-chip ${ai.ready ? 'is-on' : 'is-cta'}`} onClick={ai.openSettings} title="Connect your own AI account">
      {ai.ready ? <span className="ai-chip__dot" aria-hidden="true" /> : <Icon name="sparkle" size={18} />}
      <span>{ai.ready ? `AI: ${info.label}` : 'Connect AI'}</span>
    </button>
  );
}

/** Invitation to connect AI, shown on Build and Batch until connected (or dismissed). */
export function AiCallout() {
  const ai = useAiState();
  const [dismissed, setDismissed] = usePersistentState('ai.calloutDismissed', false);
  if (ai.ready || dismissed) return null;
  return (
    <section className="ai-callout" aria-label="Write scripts with AI">
      <span className="ai-callout__icon" aria-hidden="true">
        <Icon name="sparkle" size={22} />
      </span>
      <div className="ai-callout__text">
        <strong>Turn any idea into a full script with AI</strong>
        <span>Hooks, scenes, shot list and caption in your language. Connect your Claude, ChatGPT, Gemini or OpenRouter account.</span>
      </div>
      <div className="ai-callout__actions">
        <button className="btn btn--primary" onClick={ai.openSettings}>
          <Icon name="sparkle" /> Connect AI
        </button>
        <button className="btn btn--ghost btn--small" onClick={() => setDismissed(true)}>
          Not now
        </button>
      </div>
    </section>
  );
}

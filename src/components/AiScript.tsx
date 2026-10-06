import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { Profile, Selection } from '../data/types';
import { generate, isAbort, PROVIDERS } from '../lib/ai';
import { AI_SYSTEM_PROMPT, briefToAiPrompt, type IdeaBrief } from '../lib/brief';
import { copyText } from '../lib/export';
import { useAiState } from '../state/AiState';
import { useAppState } from '../state/AppState';
import { Icon } from './Icon';

type Status = 'idle' | 'writing' | 'done' | 'error';

/** "Write the full script with AI" for the current idea, streamed from the user's own AI account. */
export function AiScript({ brief, profile, selection, variant }: { brief: IdeaBrief; profile: Profile; selection: Selection; variant: number }) {
  const ai = useAiState();
  const { saved, saveIdea, updateSaved, isSaved, notify } = useAppState();
  const [status, setStatus] = useState<Status>('idle');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // A different idea means a different script.
  const ideaKey = `${brief.key}|${profile.focus}|${profile.points}|${profile.language}`;
  useEffect(() => {
    abortRef.current?.abort();
    setStatus('idle');
    setText('');
    setError('');
  }, [ideaKey]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const write = async () => {
    if (!ai.ready) {
      ai.openSettings();
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('writing');
    setText('');
    setError('');
    try {
      const result = await generate({
        provider: ai.provider,
        key: ai.keys[ai.provider]!,
        model: ai.models[ai.provider]!,
        system: AI_SYSTEM_PROMPT,
        prompt: briefToAiPrompt(brief, profile),
        onText: (delta) => setText((prev) => prev + delta),
        signal: controller.signal,
      });
      setText(result);
      setStatus('done');
    } catch (err) {
      if (isAbort(err)) {
        setStatus((s) => (s === 'writing' ? 'done' : s));
        return;
      }
      setError((err as Error).message);
      setStatus('error');
    }
  };

  const saveWithScript = () => {
    const existing = saved.find((idea) => idea.key === brief.key);
    if (existing) updateSaved(existing.id, { notes: existing.notes ? `${existing.notes}\n\n${text}` : text });
    else saveIdea(selection, variant, text);
    notify('Saved with the script');
  };

  const label = PROVIDERS[ai.provider].label;

  if (status === 'idle') {
    return (
      <div className="ai-script ai-script--idle">
        <button className="btn btn--accent" onClick={write}>
          <Icon name="sparkle" /> Write the full script with AI
        </button>
        <span className="muted small">
          {ai.ready ? `Uses your ${label} account (${ai.models[ai.provider]}).` : 'Connect your own Claude, ChatGPT, Gemini or OpenRouter account.'}
        </span>
      </div>
    );
  }

  return (
    <section className="ai-script" aria-live="polite">
      <div className="ai-script__head">
        <h3>
          <Icon name="sparkle" size={16} /> AI script
          <span className="muted small"> · {label}</span>
        </h3>
        <div className="ai-script__actions">
          {status === 'writing' ? (
            <button className="btn btn--small" onClick={() => abortRef.current?.abort()}>
              Stop
            </button>
          ) : (
            <>
              <button className="btn btn--small" onClick={write}>
                <Icon name="refresh" size={14} /> Rewrite
              </button>
              {text && (
                <>
                  <button className="btn btn--small" onClick={async () => notify((await copyText(text)) ? 'Script copied' : 'Could not copy')}>
                    <Icon name="copy" size={14} /> Copy
                  </button>
                  <button className="btn btn--small" onClick={saveWithScript}>
                    <Icon name={isSaved(selection) ? 'bookmarkFilled' : 'bookmark'} size={14} /> Save with idea
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
      {status === 'writing' && !text && <p className="muted small ai-script__wait">Writing your script...</p>}
      {error && (
        <div className="report report--error">
          <span>{error}</span>
          <button className="link-btn" onClick={ai.openSettings}>
            Open AI settings
          </button>
        </div>
      )}
      {text && (
        <div className={`ai-script__body ${status === 'writing' ? 'is-writing' : ''}`}>
          <ScriptText text={text} />
        </div>
      )}
      {status === 'done' && <p className="muted small">AI can get facts wrong. Check anything marked [VERIFY] before you film.</p>}
    </section>
  );
}

/** Minimal, safe rendering of the AI's markdown-style text (headings, lists, bold). */
export function ScriptText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((item, i) => <li key={i}>{inline(item)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push(<h4 key={blocks.length}>{inline(heading[1])}</h4>);
    } else if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
    } else if (line.trim() === '' || /^-{3,}$/.test(line.trim())) {
      flush();
    } else {
      flush();
      blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  }
  flush();
  return <>{blocks}</>;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  );
}

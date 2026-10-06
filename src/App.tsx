import { AiButton, AiSettings } from './components/AiSettings';
import { BatchView } from './components/BatchView';
import { BuildView } from './components/BuildView';
import { ConfirmDialog } from './components/ConfirmDialog';
import { CustomiseView } from './components/CustomiseView';
import { Icon, type IconName } from './components/Icon';
import { ItemDetail } from './components/ItemDetail';
import { LibraryView } from './components/LibraryView';
import { ContentFocus, ProfileBar } from './components/ProfileBar';
import { SavedView } from './components/SavedView';
import { type View, useAppState } from './state/AppState';

const TABS: { id: View; label: string; icon: IconName; intro: string }[] = [
  { id: 'build', label: 'Build', icon: 'grid', intro: 'Pick one from each column, or hit Randomise. Lock the picks you like and roll the rest.' },
  { id: 'batch', label: 'Batch', icon: 'list', intro: 'Generate a week or a month of unique ideas in one click.' },
  { id: 'saved', label: 'Saved', icon: 'bookmark', intro: 'Your shortlisted ideas, from idea to posted.' },
  { id: 'library', label: 'Library', icon: 'search', intro: 'Every style in the matrix: what it is, what it looks like and how to do it.' },
  { id: 'customise', label: 'Customise', icon: 'edit', intro: 'Add columns and items, and plug in your own visual examples.' },
];

export function App() {
  const { view, setView, saved, toast } = useAppState();
  const tab = TABS.find((t) => t.id === view)!;

  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <button className="brand" onClick={() => setView('build')} aria-label="Content Idea Matrix home">
            <span className="brand__mark" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="brand__text">
              <strong>CIM</strong>
              <span>Content Idea Matrix</span>
            </span>
          </button>
          <AiButton />
          <nav className="tabs" aria-label="Sections">
            {TABS.map((t) => (
              <button key={t.id} className={`tab ${view === t.id ? 'is-active' : ''}`} onClick={() => setView(t.id)} aria-current={view === t.id ? 'page' : undefined}>
                <Icon name={t.icon} size={16} />
                <span>{t.label}</span>
                {t.id === 'saved' && saved.length > 0 && <span className="tab__badge">{saved.length}</span>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="page">
        <p className="page__intro">{tab.intro}</p>
        {(view === 'build' || view === 'batch') && (
          <>
            <ProfileBar />
            <ContentFocus />
          </>
        )}
        {view === 'build' && <BuildView />}
        {view === 'batch' && <BatchView />}
        {view === 'saved' && <SavedView />}
        {view === 'library' && <LibraryView />}
        {view === 'customise' && <CustomiseView />}
      </main>

      <ItemDetail />
      <AiSettings />
      <ConfirmDialog />
      <div className={`toast ${toast ? 'is-visible' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}

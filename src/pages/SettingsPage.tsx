import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';

type InstallPrompt = Event & { prompt: () => Promise<void> };

export function SettingsPage() {
  const {
    snapshot,
    mode,
    savedAt,
    profiles,
    activeId,
    switchProfile,
    renameProfile,
    removeProfile,
    saveCategory,
    deleteCategory,
    syncing,
  } = useStore();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [install, setInstall] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const addCategory = async () => {
    setError('');
    try {
      await saveCategory({ name });
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add category.');
    }
  };

  const rename = async (id: string) => {
    setError('');
    try {
      await saveCategory({ id, name: draft });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename.');
    }
  };

  const remove = async (id: string) => {
    setError('');
    try {
      await deleteCategory(id);
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.');
    }
  };

  const synced =
    savedAt == null
      ? mode === 'preview'
        ? 'Not saved'
        : 'Not synced yet'
      : `Synced ${new Date(savedAt).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        })}`;

  return (
    <main className="page">
      <p className="kicker">Settings</p>
      <h1 className="title">Profiles</h1>
      <p className="lede">Each profile is a separate Google Sheet. Switching loads that sheet’s events and expenses.</p>
      {mode === 'preview' && (
        <div className="card">
          <h3>Sample data</h3>
          <p className="meta">{synced}</p>
        </div>
      )}
      {profiles.length === 0 ? (
        <div className="empty">
          <p>No sheets connected yet.</p>
          <Link className="btn" to="/setup">
            Add a profile
          </Link>
        </div>
      ) : (
        <div className="stack tight">
          {profiles.map((profile) => {
            const active = profile.id === activeId && mode === 'sheets';
            return (
              <div className={active ? 'card is-on' : 'card'} key={profile.id}>
                {renaming === profile.id ? (
                  <form
                    className="add-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setError('');
                      try {
                        renameProfile(profile.id, profileName);
                        setRenaming(null);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Could not rename.');
                      }
                    }}
                  >
                    <input
                      className="input"
                      value={profileName}
                      maxLength={40}
                      onChange={(event) => setProfileName(event.target.value)}
                    />
                    <button className="btn slim" type="submit">
                      Save
                    </button>
                  </form>
                ) : (
                  <button
                    className="line-name"
                    type="button"
                    onClick={() => {
                      switchProfile(profile.id);
                    }}
                  >
                    {profile.name}
                  </button>
                )}
                <p className="meta">
                  {active ? `Active · ${synced}` : 'Tap to switch'}
                  {active && snapshot.spreadsheetName ? ` · ${snapshot.spreadsheetName}` : ''}
                </p>
                {active && snapshot.spreadsheetUrl && (
                  <a className="text-link" href={snapshot.spreadsheetUrl} target="_blank" rel="noreferrer">
                    Open spreadsheet
                  </a>
                )}
                <div className="row-actions">
                  <button
                    className="text-btn"
                    type="button"
                    onClick={() => {
                      setRenaming(profile.id);
                      setProfileName(profile.name);
                    }}
                  >
                    Rename
                  </button>
                  <Link className="text-btn" to={`/setup?profile=${profile.id}`}>
                    Edit
                  </Link>
                  {confirmRemove === profile.id ? (
                    <button className="text-btn danger" type="button" onClick={() => removeProfile(profile.id)}>
                      Confirm remove
                    </button>
                  ) : (
                    <button className="text-btn" type="button" onClick={() => setConfirmRemove(profile.id)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <Link className="btn ghost" to="/setup">
            Add a profile
          </Link>
        </div>
      )}

      <div className="section-head">
        <h2>Categories</h2>
      </div>
      <form
        className="add-row"
        onSubmit={(event) => {
          event.preventDefault();
          void addCategory();
        }}
      >
        <input
          className="input"
          placeholder="New category"
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
        />
        <button className="btn slim" type="submit" disabled={syncing || !name.trim()}>
          Add
        </button>
      </form>
      <div className="stack tight">
        {snapshot.categories.map((category) => (
          <div className="line" key={category.id}>
            {editing === category.id ? (
              <form
                className="add-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  void rename(category.id);
                }}
              >
                <input className="input" value={draft} maxLength={40} onChange={(event) => setDraft(event.target.value)} />
                <button className="btn slim" type="submit">
                  Save
                </button>
              </form>
            ) : (
              <>
                <button
                  className="line-name"
                  type="button"
                  onClick={() => {
                    setEditing(category.id);
                    setDraft(category.name);
                  }}
                >
                  {category.name}
                </button>
                {pendingDelete === category.id ? (
                  <button className="text-btn danger" type="button" onClick={() => void remove(category.id)}>
                    Confirm
                  </button>
                ) : (
                  <button className="text-btn" type="button" onClick={() => setPendingDelete(category.id)}>
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
      <p className="meta pad">Tap a category to rename it. Categories used by expenses can be renamed, not deleted.</p>

      <div className="section-head">
        <h2>Install</h2>
      </div>
      {install ? (
        <button
          className="btn"
          type="button"
          onClick={() => {
            void install.prompt();
            setInstall(null);
          }}
        >
          Install app
        </button>
      ) : (
        <p className="lede">
          In Chrome on Android, use the browser menu and choose Install app. On iPhone, use Share, then Add to Home
          Screen.
        </p>
      )}
    </main>
  );
}

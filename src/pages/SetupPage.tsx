import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../store';

export function SetupPage() {
  const { profiles, connect, startPreview, mode } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const profileId = params.get('profile') ?? '';
  const editing = profiles.find((profile) => profile.id === profileId);
  const [name, setName] = useState(editing?.name ?? '');
  const [webAppUrl, setWebAppUrl] = useState(editing?.webAppUrl ?? '');
  const [token, setToken] = useState(editing?.token ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const profile = profiles.find((item) => item.id === profileId);
    setName(profile?.name ?? '');
    setWebAppUrl(profile?.webAppUrl ?? '');
    setToken(profile?.token ?? '');
    // Prefill only when opening a different profile, not on later store updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await connect({
        webAppUrl,
        token,
        name,
        profileId: editing ? editing.id : undefined,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect.');
      setSaving(false);
    }
  };

  const title = editing ? 'Edit profile' : profiles.length ? 'Add a profile' : 'Your sheet, on your phone.';

  return (
    <main className="app page setup">
      <p className="kicker">Expenses</p>
      <h1 className="title">{title}</h1>
      <p className="lede">
        Each profile is one Google Sheet. The web app URL and API token stay in this browser, and you can switch
        profiles later.
      </p>

      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="field">
          <span>Profile name</span>
          <input
            className="input"
            maxLength={40}
            placeholder="Personal, Family, Trip"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Web app URL</span>
          <input
            className="input"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="https://script.google.com/macros/s/…/exec"
            value={webAppUrl}
            onChange={(event) => setWebAppUrl(event.target.value)}
          />
        </label>
        <label className="field">
          <span>API token</span>
          <input
            className="input"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="From the Setup tab"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Connecting…' : editing ? 'Save profile' : 'Connect sheet'}
        </button>
      </form>
      {profiles.length > 0 && (
        <button className="text-btn left pad" type="button" onClick={() => navigate('/settings')}>
          Back to profiles
        </button>
      )}

      {mode !== 'preview' && (
        <button
          className="text-btn left pad"
          type="button"
          onClick={() => {
            startPreview();
            navigate('/');
          }}
        >
          Look around with sample data
        </button>
      )}
      {mode === 'preview' && (
        <button className="text-btn left pad" type="button" onClick={() => navigate('/')}>
          Back to sample data
        </button>
      )}

      <ol className="steps">
        <li>Create a Google Sheet. Go to Extensions → Apps Script.</li>
        <li>Replace the sample code with the file in this project, <code>apps-script/Code.gs</code>. Save.</li>
        <li>Reload the sheet. Open the Expense tracker menu and choose Set up sheets. Allow access.</li>
        <li>
          Deploy → New deployment → gear icon → Web app. Execute as <strong>Me</strong>. Who has access:{' '}
          <strong>Anyone</strong>.
        </li>
        <li>Copy the web app URL (it ends in /exec). Copy the API token from the Setup tab, cell B2.</li>
        <li>Paste both above. After later script edits, redeploy as a new version. The URL stays the same.</li>
      </ol>
    </main>
  );
}

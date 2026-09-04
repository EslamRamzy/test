'use client';

import type { SiteSettingRow } from '@portfolio/shared';
import { useEffect, useState } from 'react';
import { useToast } from '@/features/admin/components/ToastProvider';
import { useBulkUpdateSettings, useSettings } from '@/features/admin/settings/client';

function inputForSetting(
  setting: SiteSettingRow,
  value: string | null,
  onChange: (value: string | null) => void,
): React.JSX.Element {
  const id = `setting-${setting.key}`;
  if (setting.valueType === 'BOOLEAN') {
    return (
      <div className="form-check form-switch">
        <input
          type="checkbox"
          className="form-check-input"
          id={id}
          checked={value === 'true'}
          onChange={(event) => onChange(event.target.checked ? 'true' : 'false')}
        />
      </div>
    );
  }
  if (setting.valueType === 'NUMBER') {
    return (
      <input
        id={id}
        type="number"
        className="form-control"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      />
    );
  }
  return (
    <textarea
      id={id}
      className="form-control"
      rows={setting.valueType === 'JSON' ? 3 : 1}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
    />
  );
}

/**
 * `GET|PATCH /admin/settings` (doc03 §5: "GET grouped", "PATCH bulk") —
 * one bulk save across every group, matching the API's own shape rather
 * than a save button per group. `valueType` (STRING/NUMBER/BOOLEAN/JSON,
 * `SiteSetting`'s own column) picks the input control; the server's own
 * `validateValueForType` is still the real gate (doc07 §6: never trust the
 * client alone), this just avoids a NUMBER setting round-tripping as
 * obviously-wrong input.
 */
export default function SettingsPage(): React.JSX.Element {
  const { show } = useToast();
  const settingsQuery = useSettings();
  const bulkUpdate = useBulkUpdateSettings();
  const [values, setValues] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!settingsQuery.data) return;
    const initial: Record<string, string | null> = {};
    for (const group of settingsQuery.data) {
      for (const setting of group.settings) initial[setting.key] = setting.value;
    }
    setValues(initial);
  }, [settingsQuery.data]);

  function handleSave(): void {
    const entries = Object.entries(values).map(([key, value]) => ({ key, value }));
    if (entries.length === 0) return;
    bulkUpdate.mutate(entries, {
      onSuccess: () => show({ message: 'Settings saved.', variant: 'success' }),
      onError: () => show({ message: 'Couldn’t save settings.', variant: 'danger' }),
    });
  }

  if (settingsQuery.isPending) return <p className="text-body-secondary">Loading…</p>;
  if (settingsQuery.isError) {
    return <div className="alert alert-danger">Couldn’t load settings.</div>;
  }

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">Settings</h1>
      {settingsQuery.data.length === 0 ? (
        <p className="text-body-secondary">No settings recorded yet.</p>
      ) : (
        settingsQuery.data.map((group) => (
          <section key={group.groupName} className="mb-4">
            <h2 className="h6 text-uppercase text-body-secondary mb-3">{group.groupName}</h2>
            {group.settings.map((setting) => (
              <div className="row mb-3 align-items-start" key={setting.key}>
                <label htmlFor={`setting-${setting.key}`} className="col-sm-3 col-form-label">
                  {setting.key}
                  {setting.isPublic && <span className="badge text-bg-info ms-2">Public</span>}
                </label>
                <div className="col-sm-9">
                  {inputForSetting(setting, values[setting.key] ?? null, (value) =>
                    setValues((current) => ({ ...current, [setting.key]: value })),
                  )}
                </div>
              </div>
            ))}
          </section>
        ))
      )}
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleSave}
        disabled={bulkUpdate.isPending || settingsQuery.data.length === 0}
      >
        {bulkUpdate.isPending ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  );
}

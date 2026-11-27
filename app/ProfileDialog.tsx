"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { PROFILE_FIELDS, type Profile, sanitizeProfile } from "./profile";

type Props = {
  open: boolean;
  profile: Profile | null;
  onSave: (profile: Profile | null) => void;
  onClose: () => void;
};

// 「わたしの状況」の登録画面（モーダルダイアログ）
export function ProfileDialog({ open, profile, onSave, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Profile>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setDraft(profile ?? {});
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, profile]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave(sanitizeProfile(draft));
  }

  function handleClear() {
    if (!window.confirm("登録した「わたしの状況」をこの端末から削除しますか？")) return;
    onSave(null);
  }

  return (
    <dialog
      ref={dialogRef}
      className="profile-dialog"
      aria-labelledby="profile-title"
      onClose={onClose}
    >
      <form className="profile-form" onSubmit={handleSubmit}>
        <h2 id="profile-title" className="profile-title">
          わたしの状況
        </h2>
        <p className="profile-lead">
          登録しておくと、毎回説明しなくてもあなたの状況に合わせて回答します。すべて任意です。分かる項目だけ入力してください。
        </p>
        <p className="profile-lead">
          内容はこの端末（ブラウザ）の中にだけ保存され、質問するときに回答の作成のためだけに送信されます。氏名・生年月日・詳しい住所・マイナンバーなど、個人を特定できる情報は入力しないでください。
        </p>

        {PROFILE_FIELDS.map((f) => {
          const id = `profile-${f.key}`;
          const value = draft[f.key] ?? "";
          const set = (v: string) => setDraft((d) => ({ ...d, [f.key]: v }));
          return (
            <div key={f.key} className="profile-field">
              <label htmlFor={id} className="profile-label">
                {f.label}
              </label>
              {f.options ? (
                <select
                  id={id}
                  className="select-field"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                >
                  <option value="">未選択</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={id}
                  className="text-field"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={f.placeholder}
                  maxLength={f.maxLength}
                  autoComplete="off"
                />
              )}
            </div>
          );
        })}

        <div className="profile-actions">
          {profile && (
            <button type="button" className="button-danger" onClick={handleClear}>
              登録を削除
            </button>
          )}
          <button type="button" className="header-button" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="button-primary">
            保存
          </button>
        </div>
      </form>
    </dialog>
  );
}

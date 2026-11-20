import { useId } from 'react';
import { BackupSection } from './BackupSection';
import { SETTINGS_TEXTS } from './texts';
import styles from './settings.module.css';

// Ajustes (spec 007 §6.1, plan §6.8): the backup and the medical notice of P-1.
export function SettingsPage() {
  const noticeId = useId();
  return (
    <>
      <title>Ajustes · Gym</title>
      <h1>{SETTINGS_TEXTS.title}</h1>
      <BackupSection />
      <section className={styles.section} aria-labelledby={noticeId}>
        <h2 id={noticeId}>{SETTINGS_TEXTS.notice}</h2>
        <p className={styles.text}>{SETTINGS_TEXTS.noticeText}</p>
      </section>
    </>
  );
}

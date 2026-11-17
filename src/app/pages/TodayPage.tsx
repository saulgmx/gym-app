import styles from './pages.module.css';

// Empty "Hoy" page (spec 000 §6); content arrives with the plan in phase 1.
export function TodayPage() {
  return (
    <>
      <title>Hoy · Gym</title>
      <h1>Hoy</h1>
      <p className={styles.empty}>Aún no hay un plan cargado.</p>
    </>
  );
}

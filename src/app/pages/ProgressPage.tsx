import styles from './pages.module.css';

// Empty "Progreso" page (spec 000 §6).
export function ProgressPage() {
  return (
    <>
      <title>Progreso · Gym</title>
      <h1>Progreso</h1>
      <p className={styles.empty}>Aún no hay entrenamientos registrados.</p>
    </>
  );
}

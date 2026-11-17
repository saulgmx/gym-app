import { Link } from 'react-router';
import styles from './pages.module.css';

// Empty full-screen session page (spec 000 §6). Route params are validated in phase 2 (spec 000 §7).
export function SessionPage() {
  return (
    <main className={styles.fullScreen}>
      <title>Sesión · Gym</title>
      <h1>Sesión</h1>
      <Link to="/" className={styles.backLink}>
        Volver a Hoy
      </Link>
    </main>
  );
}

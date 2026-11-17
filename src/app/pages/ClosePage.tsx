import { Link } from 'react-router';
import styles from './pages.module.css';

// Empty full-screen close page (spec 000 §6).
export function ClosePage() {
  return (
    <main className={styles.fullScreen}>
      <title>Cierre de sesión · Gym</title>
      <h1>Cierre de sesión</h1>
      <Link to="/" className={styles.backLink}>
        Volver a Hoy
      </Link>
    </main>
  );
}

// Every page of the skeleton (spec 000 §6), shared by the e2e specs.
export const PAGES = [
  { path: '/', heading: 'Hoy' },
  { path: '/progreso', heading: 'Progreso' },
  { path: '/ajustes', heading: 'Ajustes' }, // spec 007, decision 18 (e)
  { path: '/sesion/w1/0', heading: 'Sesión' },
  { path: '/sesion/w1/cierre', heading: 'Cierre de sesión' },
] as const;

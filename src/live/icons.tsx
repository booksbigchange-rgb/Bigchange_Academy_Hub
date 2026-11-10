/** Small decorative line icons for the live app's menu. Inline SVG (allowed by the Content Security Policy); hidden from screen readers. */
const PATHS: Record<string, string> = {
  Overview: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  Students: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6',
  Guardians: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM17 11a3 3 0 1 0 0-6M2.5 20c0-3 3-5.5 6.5-5.5s6.5 2.5 6.5 5.5M16 14.6c3 .3 5.5 2.4 5.5 5.4',
  Courses: 'M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0zM12 5.5V19',
  Classes: 'M3 5h18v11H3zM8 20h8M12 16v4',
  Attendance: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M8.5 15l2 2 4-4',
  Fees: 'M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10v4M18 10v4',
  Notices: 'M4 10v4h3l6 4V6L7 10zM16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11',
  'My children': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3.3 3.6-6 8-6s8 2.7 8 6',
  'My classes': 'M3 5h18v11H3zM8 20h8M12 16v4',
  Payments: 'M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
};
export function NavIcon({ name }: { name: string }) {
  return <svg className="nav-svg" aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={PATHS[name] ?? PATHS.Overview} /></svg>;
}

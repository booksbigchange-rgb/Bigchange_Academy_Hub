import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { myStaffRow, type StaffMember } from './api';
import LiveTeacherProfile from './LiveTeacherProfile';
import type { Data } from './shared';

/** A teacher's own profile: their classes, lessons this month, attendance still to finish. Only their own data is readable. */
export default function LiveMyProfile({ client, email, data }: { client: SupabaseClient; email: string; data: Data }) {
  const [me, setMe] = useState<StaffMember | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    myStaffRow(client).then(row => {
      if (!live) return;
      setMe({ user_id: '', email, staff_id: row.id, display_name: row.display_name, role: row.role, active: row.active,
        class_count: data.classes.filter(c => c.teacher_staff_id === row.id).length, last_sign_in_at: null });
    }).catch(e => { if (live) setError(e instanceof Error ? e.message : 'Could not load your profile'); });
    return () => { live = false; };
  }, [client, email, data.classes]);
  return <section className="panel operations" aria-label="My profile">
    <span className="eyebrow">MY PROFILE</span><h2>My classes and lessons</h2>
    <p className="quiet">Your classes, the lessons you held this month, and lessons where attendance is not complete yet (finish them on the Attendance screen).</p>
    {error && <p className="ops-feedback" role="alert">{error}</p>}
    {!me && !error && <p role="status">Loading…</p>}
    {me && <LiveTeacherProfile member={me} data={data} self />}
  </section>;
}

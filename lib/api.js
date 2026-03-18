// Offline mock API: returns static data and never calls network.

export async function apiFetch(path, { method = 'GET', body, token } = {}) {
  const clean = String(path).replace(/^\/+/, '');

  // Auth
  if (clean === 'login') {
    return { token: 'offline-demo-token' };
  }

  // Attendance today
  if (clean.startsWith('employee-attendance/')) {
    return {
      status: 'submitted',
      in: '09:00',
      out: '18:00',
      site: 'Main Office'
    };
  }

  // Attendance update (check-in/out)
  if (clean === 'employee-attendance' && (method === 'POST' || method === 'PUT')) {
    return { ok: true };
  }

  // History
  if (clean === 'employee-attendance-history') {
    return [];
  }

  // Schedule
  if (clean.startsWith('schedule')) {
    return [
      { id: 'sch1', project: 'Site A', taskDate: '2026-03-20', officeTime: '09:00', siteTime: '10:30', status: 'Planned' }
    ];
  }

  // Tasks
  if (clean.startsWith('tasks')) {
    if (method === 'PUT') return { ok: true };
    return [
      { id: 'task1', title: 'Daily Report', status: 'pending' },
      { id: 'task2', title: 'Safety Checklist', status: 'pending' }
    ];
  }

  // Default
  return {};
}

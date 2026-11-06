'use client';

/**
 * Tasks & Projects screen — Kanban board, list view, calendar view.
 * Source: upload/task-projects.html.
 *
 * Features:
 * - Kanban board with 4 columns (To Do, In Progress, In Review, Done)
 *   and drag-and-drop cards between columns.
 * - List view (table with Task/Status/Assignee/Due Date/Priority).
 * - Calendar view (month grid with task pills, color-coded by tag).
 * - Sidebar with view switcher + project list (color dots).
 * - Create Task modal, Create Project modal, Invite Member modal.
 * - Avatar group with invite button.
 * - All state in React, no inline styles.
 */
import { useState, type DragEvent } from 'react';
import styles from './TasksProjects.module.css';

interface Task {
  id: string;
  project: string;
  title: string;
  desc: string;
  status: 'todo' | 'progress' | 'review' | 'done';
  tag: 'design' | 'dev' | 'marketing' | 'urgent';
  assignee: string;
  date: string;
  checklist: string;
  urgent?: boolean;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

interface Member {
  name: string;
  initials: string;
  role: string;
  email: string;
  color: string;
}

const INITIAL_PROJECTS: Project[] = [
  { id: 'p1', name: 'Studio Redesign', color: '#6b1e28' },
  { id: 'p2', name: 'Q4 Campaign', color: '#0e5e6f' },
  { id: 'p3', name: 'Supplier Onboarding', color: '#1e5a38' },
];

const INITIAL_TASKS: Task[] = [
  { id: 't1', project: 'p1', title: 'Update Studio sidebar icons to match new branding', desc: 'Replace all Material Icons with the new custom SVG set provided by the design team.', status: 'todo', tag: 'design', assignee: 'SM', date: '2024-10-28', checklist: '0/3' },
  { id: 't2', project: 'p1', title: "Fix bug: Variant modal doesn't close on Escape key", desc: 'When pressing Escape inside the variant selection modal, it should close the modal and return focus to the canvas.', status: 'todo', tag: 'dev', assignee: 'JD', date: '2024-10-26', checklist: '0/0', urgent: true },
  { id: 't3', project: 'p1', title: 'Draft email announcement for new supplier integration', desc: 'Create the copy and select the hero image for the newsletter blast.', status: 'todo', tag: 'marketing', assignee: '+3', date: '2024-10-28', checklist: '0/0' },
  { id: 't4', project: 'p1', title: 'Implement supplier API webhook for real-time stock updates', desc: 'Connect the Printify webhook to update the local database whenever stock changes.', status: 'progress', tag: 'dev', assignee: 'AL', date: '2024-10-30', checklist: '2/5' },
  { id: 't5', project: 'p1', title: 'Design the empty state for "My Orders" view', desc: "Create an illustration and helpful CTA for users who haven't placed an order yet.", status: 'progress', tag: 'design', assignee: 'SM', date: '2024-10-25', checklist: '0/0' },
  { id: 't6', project: 'p1', title: 'Refactor checkout flow to support multi-supplier cart', desc: 'The checkout logic currently assumes a single supplier.', status: 'review', tag: 'dev', assignee: 'JD', date: '2024-11-02', checklist: '5/5' },
  { id: 't7', project: 'p1', title: 'Finalize the new color palette for the Studio UI', desc: 'Primary, secondary, and neutral colors have been selected.', status: 'done', tag: 'design', assignee: 'SM', date: '2024-10-20', checklist: '0/0' },
  { id: 't8', project: 'p1', title: 'Set up staging environment for UAT testing', desc: 'Deployed the latest build to staging.', status: 'done', tag: 'dev', assignee: 'AL', date: '2024-10-18', checklist: '0/0' },
];

const INITIAL_MEMBERS: Member[] = [
  { name: 'John Doe', initials: 'JD', role: 'Admin', email: 'john@unsaid.com', color: '#0e5e6f' },
  { name: 'Sarah Miller', initials: 'SM', role: 'Editor', email: 'sarah@unsaid.com', color: '#6b1e28' },
  { name: 'Alex Lee', initials: 'AL', role: 'Editor', email: 'alex@unsaid.com', color: '#1e5a38' },
  { name: 'Team Placeholder', initials: '+3', role: 'Viewer', email: 'team@unsaid.com', color: '#a85a00' },
];

const AVATAR_COLORS: Record<string, string> = {
  JD: '#0e5e6f',
  SM: '#6b1e28',
  AL: '#1e5a38',
  '+3': '#a85a00',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  progress: 'In Progress',
  review: 'In Review',
  done: 'Done',
};

const TAG_CLASSES: Record<string, string> = {
  design: styles.tagDesign,
  dev: styles.tagDev,
  marketing: styles.tagMarketing,
  urgent: styles.tagUrgent,
};

const COLUMNS = [
  { id: 'todo' as const, label: 'To Do' },
  { id: 'progress' as const, label: 'In Progress' },
  { id: 'review' as const, label: 'In Review' },
  { id: 'done' as const, label: 'Done' },
];

const PROJECT_COLORS = ['#6b1e28', '#0e5e6f', '#1e5a38', '#a85a00', '#1d2a44'];

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getAssigneeName(initials: string): string {
  const map: Record<string, string> = { JD: 'John Doe', SM: 'Sarah Miller', AL: 'Alex Lee', '+3': 'Team' };
  return map[initials] || initials;
}

interface TasksProjectsScreenProps {
  onToast: (msg: string) => void;
}

export default function TasksProjectsScreen({ onToast }: TasksProjectsScreenProps) {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [currentProject, setCurrentProject] = useState('p1');
  const [currentView, setCurrentView] = useState<'board' | 'list' | 'calendar'>('board');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Modals
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Task form
  const [taskForm, setTaskForm] = useState({
    title: '',
    desc: '',
    assignee: 'JD',
    date: '',
    tag: 'design' as Task['tag'],
    status: 'todo' as Task['status'],
  });

  // Project form
  const [projectName, setProjectName] = useState('');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Editor');

  const projectTasks = tasks.filter((t) => t.project === currentProject);
  const currentProjectName = projects.find((p) => p.id === currentProject)?.name ?? '';

  // ── Drag and drop ──
  const handleDragStart = (e: DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: DragEvent, newStatus: Task['status']) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId') || draggedTaskId;
    if (!taskId) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    setDraggedTaskId(null);
    onToast(`Task moved to ${STATUS_LABELS[newStatus]}.`);
  };

  const handleCreateTask = () => {
    if (!taskForm.title.trim()) {
      onToast('Please enter a task title.');
      return;
    }
    const newTask: Task = {
      id: `t${Date.now()}`,
      project: currentProject,
      title: taskForm.title,
      desc: taskForm.desc,
      status: taskForm.status,
      tag: taskForm.tag,
      assignee: taskForm.assignee,
      date: taskForm.date,
      checklist: '0/0',
    };
    setTasks((prev) => [...prev, newTask]);
    setTaskForm({ title: '', desc: '', assignee: 'JD', date: '', tag: 'design', status: 'todo' });
    setTaskModalOpen(false);
    onToast('Task created successfully!');
  };

  const handleCreateProject = () => {
    if (!projectName.trim()) {
      onToast('Please enter a project name.');
      return;
    }
    const newProject: Project = {
      id: `p${Date.now()}`,
      name: projectName,
      color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
    };
    setProjects((prev) => [...prev, newProject]);
    setProjectName('');
    setProjectModalOpen(false);
    setCurrentProject(newProject.id);
    onToast(`Project "${newProject.name}" created.`);
  };

  const handleSendInvite = () => {
    if (!inviteEmail.trim()) {
      onToast('Please enter an email address.');
      return;
    }
    const name = inviteEmail.split('@')[0].replace('.', ' ');
    const initials = name
      .split(' ')
      .map((n) => n[0]?.toUpperCase())
      .join('')
      .slice(0, 2);
    const color = '#' + Math.floor(Math.random() * 16777215).toString(16).slice(0, 6);
    setMembers((prev) => [...prev, { name, initials, role: inviteRole, email: inviteEmail, color }]);
    setInviteEmail('');
    setInviteModalOpen(false);
    onToast(`Invite sent to ${inviteEmail} as ${inviteRole}.`);
  };

  // ── Calendar rendering ──
  const year = 2024;
  const month = 9; // October (0-indexed)
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={styles.root}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarSection}>Views</div>
        <button
          type="button"
          className={`${styles.sidebarItem} ${currentView === 'board' ? styles.sidebarItemActive : ''}`}
          onClick={() => setCurrentView('board')}
        >
          <span className={`material-symbols-outlined ${styles.sidebarItemIcon}`}>dashboard</span>
          Board
        </button>
        <button
          type="button"
          className={`${styles.sidebarItem} ${currentView === 'list' ? styles.sidebarItemActive : ''}`}
          onClick={() => setCurrentView('list')}
        >
          <span className={`material-symbols-outlined ${styles.sidebarItemIcon}`}>list</span>
          List
        </button>
        <button
          type="button"
          className={`${styles.sidebarItem} ${currentView === 'calendar' ? styles.sidebarItemActive : ''}`}
          onClick={() => setCurrentView('calendar')}
        >
          <span className={`material-symbols-outlined ${styles.sidebarItemIcon}`}>calendar_today</span>
          Calendar
        </button>

        <div className={styles.sidebarSection}>
          Projects
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setProjectModalOpen(true)}
          >
            <span className={`material-symbols-outlined ${styles.addBtnIcon}`}>add</span>
          </button>
        </div>
        <div className={styles.projectList}>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${styles.projectItem} ${p.id === currentProject ? styles.projectItemActive : ''}`}
              onClick={() => setCurrentProject(p.id)}
            >
              <div className={styles.projectDot} style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
      </aside>

      {/* Main area */}
      <main className={styles.mainArea}>
        {/* Board header */}
        <div className={styles.boardHeader}>
          <div className={styles.boardTitleRow}>
            <h1 className={styles.boardTitle}>{currentProjectName}</h1>
            <div className={styles.boardActions}>
              <button type="button" className={styles.btnIcon} title="Search" onClick={() => onToast('Search opened')}>
                <span className="material-symbols-outlined">search</span>
              </button>
              <button type="button" className={styles.btnIcon} title="Filter" onClick={() => onToast('Filter menu opened')}>
                <span className="material-symbols-outlined">filter_list</span>
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setTaskModalOpen(true)}>
                <span className="material-symbols-outlined">add</span>
                Add Task
              </button>
            </div>
          </div>

          <div className={styles.boardFilters}>
            <button type="button" className={styles.filterPill} onClick={() => onToast('Filter by Assignee')}>
              <span className={`material-symbols-outlined ${styles.filterPillIcon}`}>person</span>
              Assignee
            </button>
            <button type="button" className={styles.filterPill} onClick={() => onToast('Filter by Priority')}>
              <span className={`material-symbols-outlined ${styles.filterPillIcon}`}>flag</span>
              Priority
            </button>
            <button type="button" className={styles.filterPill} onClick={() => onToast('Filter by Due Date')}>
              <span className={`material-symbols-outlined ${styles.filterPillIcon}`}>calendar_today</span>
              Due Date
            </button>

            <div className={styles.avatarGroup}>
              {members.map((m) => (
                <div key={m.initials} className={styles.avatar} style={{ background: m.color }}>
                  {m.initials}
                </div>
              ))}
              <button type="button" className={styles.inviteBtn} onClick={() => setInviteModalOpen(true)}>
                <span className={`material-symbols-outlined ${styles.inviteBtnIcon}`}>person_add</span>
                Invite
              </button>
            </div>
          </div>
        </div>

        {/* Board view */}
        {currentView === 'board' && (
          <div className={styles.kanbanBoard}>
            {COLUMNS.map((col) => {
              const colTasks = projectTasks.filter((t) => t.status === col.id);
              return (
                <div
                  key={col.id}
                  className={styles.kanbanColumn}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, col.id)}
                >
                  <div className={styles.columnHeader}>
                    <div className={styles.columnTitle}>
                      {col.label}
                      <span className={styles.columnCount}>{colTasks.length}</span>
                    </div>
                    <div className={styles.columnActions}>
                      <span
                        className={`material-symbols-outlined ${styles.columnActionIcon}`}
                        onClick={() => {
                          setTaskForm((prev) => ({ ...prev, status: col.id }));
                          setTaskModalOpen(true);
                        }}
                      >
                        add
                      </span>
                      <span className={`material-symbols-outlined ${styles.columnActionIcon}`}>more_horiz</span>
                    </div>
                  </div>
                  <div className={styles.kanbanCards}>
                    {colTasks.map((t) => (
                      <div
                        key={t.id}
                        className={styles.kanbanCard}
                        draggable
                        onDragStart={(e) => handleDragStart(e, t.id)}
                      >
                        <div className={styles.cardTags}>
                          <span className={`${styles.tag} ${TAG_CLASSES[t.tag]}`}>{t.tag}</span>
                          {t.urgent && <span className={`${styles.tag} ${styles.tagUrgent}`}>Urgent</span>}
                        </div>
                        <h4 className={styles.cardTitle}>{t.title}</h4>
                        <p className={styles.cardDesc}>{t.desc}</p>
                        <div className={styles.cardFooter}>
                          <div className={styles.cardMeta}>
                            {t.date && (
                              <span>
                                <span className={`material-symbols-outlined ${styles.cardMetaIcon}`}>calendar_today</span>
                                {formatDate(t.date)}
                              </span>
                            )}
                            {t.checklist !== '0/0' && (
                              <span>
                                <span className={`material-symbols-outlined ${styles.cardMetaIcon}`}>checklist</span>
                                {t.checklist}
                              </span>
                            )}
                          </div>
                          <div className={styles.cardAssignee}>
                            <div className={`${styles.avatar} ${styles.avatarSm}`} style={{ background: AVATAR_COLORS[t.assignee] || '#666' }}>
                              {t.assignee}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List view */}
        {currentView === 'list' && (
          <div className={styles.listView}>
            <table className={styles.listTable}>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Due Date</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {projectTasks.map((t) => (
                  <tr key={t.id}>
                    <td><b>{t.title}</b></td>
                    <td>
                      <span className={`${styles.tag} ${TAG_CLASSES[t.status === 'done' ? 'design' : t.status === 'progress' ? 'dev' : 'marketing']}`}>
                        {STATUS_LABELS[t.status]}
                      </span>
                    </td>
                    <td>
                      <div className={styles.listAssigneeCell}>
                        <div className={`${styles.avatar} ${styles.avatarSm}`} style={{ background: AVATAR_COLORS[t.assignee] || '#666' }}>
                          {t.assignee}
                        </div>
                        {getAssigneeName(t.assignee)}
                      </div>
                    </td>
                    <td>{t.date ? formatDate(t.date) : '—'}</td>
                    <td>
                      <span className={`${styles.tag} ${TAG_CLASSES[t.tag]}`}>{t.tag}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Calendar view */}
        {currentView === 'calendar' && (
          <div className={styles.calendarView}>
            <div className={styles.calendarHeader}>
              <h2 className={styles.calendarTitle}>October 2024</h2>
              <div className={styles.calendarNav}>
                <button type="button" className={styles.btnIcon} onClick={() => onToast('Previous month')}>
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button type="button" className={styles.btnIcon} onClick={() => onToast('Next month')}>
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
            <div className={styles.calendarGrid}>
              {dayNames.map((d) => (
                <div key={d} className={styles.calendarDayHeader}>{d}</div>
              ))}
              {Array.from({ length: firstDay }, (_, i) => (
                <div key={`empty-${i}`} className={`${styles.calendarCell} ${styles.calendarCellEmpty}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayTasks = projectTasks.filter((t) => t.date === dateStr);
                const isToday = day === 24;
                return (
                  <div key={day} className={styles.calendarCell}>
                    <div className={`${styles.calendarDate} ${isToday ? styles.calendarDateToday : ''}`}>
                      {day}
                    </div>
                    {dayTasks.map((t) => (
                      <div
                        key={t.id}
                        className={`${styles.calendarTask} ${TAG_CLASSES[t.tag] ? styles[`calendarTask${t.tag.charAt(0).toUpperCase() + t.tag.slice(1)}`] : ''}`}
                        title={t.title}
                        onClick={() => onToast(`Task: ${t.title}`)}
                      >
                        {t.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── Task modal ── */}
      {taskModalOpen && (
        <div className={styles.overlay} onClick={() => setTaskModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Create New Task</h2>
              <button type="button" className={styles.btnIconBorderless} onClick={() => setTaskModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Task Title</label>
                <input
                  className={styles.formInput}
                  type="text"
                  placeholder="e.g., Update product info accordion content"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Add more details..."
                  value={taskForm.desc}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, desc: e.target.value }))}
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Assignee</label>
                  <select
                    className={styles.formSelect}
                    value={taskForm.assignee}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, assignee: e.target.value }))}
                  >
                    <option value="JD">John Doe</option>
                    <option value="SM">Sarah Miller</option>
                    <option value="AL">Alex Lee</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Due Date</label>
                  <input
                    className={styles.formInput}
                    type="date"
                    value={taskForm.date}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Priority</label>
                  <select
                    className={styles.formSelect}
                    value={taskForm.tag}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, tag: e.target.value as Task['tag'] }))}
                  >
                    <option value="design">Design</option>
                    <option value="dev">Dev</option>
                    <option value="marketing">Marketing</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Status</label>
                  <select
                    className={styles.formSelect}
                    value={taskForm.status}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, status: e.target.value as Task['status'] }))}
                  >
                    <option value="todo">To Do</option>
                    <option value="progress">In Progress</option>
                    <option value="review">In Review</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setTaskModalOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleCreateTask}>Create Task</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Project modal ── */}
      {projectModalOpen && (
        <div className={styles.overlay} onClick={() => setProjectModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Create New Project</h2>
              <button type="button" className={styles.btnIconBorderless} onClick={() => setProjectModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Project Name</label>
                <input
                  className={styles.formInput}
                  type="text"
                  placeholder="e.g., Q1 Marketing Campaign"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setProjectModalOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleCreateProject}>Create Project</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite modal ── */}
      {inviteModalOpen && (
        <div className={styles.overlay} onClick={() => setInviteModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Invite to Project</h2>
              <button type="button" className={styles.btnIconBorderless} onClick={() => setInviteModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email Address</label>
                <input
                  className={styles.formInput}
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Role</label>
                <select
                  className={styles.formSelect}
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="Admin">Admin</option>
                  <option value="Editor">Editor</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>
              <h4 className={styles.membersTitle}>Current Members</h4>
              <div className={styles.memberList}>
                {members.map((m) => (
                  <div key={m.email} className={styles.memberRow}>
                    <div className={`${styles.avatar} ${styles.memberAvatar}`} style={{ background: m.color }}>
                      {m.initials}
                    </div>
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>{m.name}</span>
                      <span className={styles.memberEmail}>{m.email}</span>
                    </div>
                    <div className={styles.memberRole}>{m.role}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setInviteModalOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSendInvite}>Send Invite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

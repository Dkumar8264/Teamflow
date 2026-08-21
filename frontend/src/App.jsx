import React from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';

const features = ['Projects', 'Team roles', 'Kanban tasks', 'Comments', 'Notifications', 'Real-time sync'];
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
const authStorageKey = 'teamflow_auth';

const columnDefinitions = [
  { id: 'todo', title: 'TO DO' },
  { id: 'in_progress', title: 'IN PROGRESS' },
  { id: 'review', title: 'REVIEW' },
  { id: 'done', title: 'DONE' }
];

const initialRoadmap = [
  { id: 1, title: 'Auth setup', timeline: 'Week 1-2', status: 'DONE' },
  { id: 2, title: 'Projects CRUD', timeline: 'Week 3', status: 'ACTIVE' },
  { id: 3, title: 'Tasks and Kanban', timeline: 'Week 4', status: 'PLANNED' },
  { id: 4, title: 'Real-time collaboration', timeline: 'Week 5', status: 'PLANNED' },
  { id: 5, title: 'Polish and deploy', timeline: 'Week 6-8', status: 'PLANNED' }
];

const getErrorMessage = (payload, fallback) => {
  if (payload?.errors?.length > 0) {
    return payload.errors.join(', ');
  }

  return payload?.message || fallback;
};

const apiRequest = async (path, { body, method = 'GET', token } = {}) => {
  if (path !== '/auth/signup' && path !== '/auth/login' && !token) {
    throw new Error('Please log in again');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    throw new Error(getErrorMessage(payload, 'Request failed'));
  }

  return payload;
};

const getDocumentId = (item) => item?._id || item?.id;

const getProjectProgress = (projectId, tasks) => {
  const projectTasks = tasks.filter((task) => getDocumentId(task.project) === projectId || task.project === projectId);

  if (projectTasks.length === 0) {
    return 0;
  }

  const doneTasks = projectTasks.filter((task) => task.status === 'done').length;
  return Math.round((doneTasks / projectTasks.length) * 100);
};

const normalizeMember = (member) => ({
  id: getDocumentId(member),
  name: member.name,
  email: member.email,
  role: member.role
});

const normalizeProject = (project, tasks = []) => ({
  id: getDocumentId(project),
  name: project.name,
  description: project.description || '',
  owner: project.members?.find((member) => member.role === 'owner')?.name || project.owner?.name || 'Owner',
  progress: getProjectProgress(getDocumentId(project), tasks),
  team: project.team || (project.members || []).map(normalizeMember)
});

const normalizeTask = (task) => ({
  id: getDocumentId(task),
  title: task.title,
  project: task.project?.name || task.projectName || 'Project',
  projectId: getDocumentId(task.project) || task.project,
  status: task.status || 'todo'
});

const buildColumns = (tasks) =>
  columnDefinitions.map((column) => ({
    ...column,
    tasks: tasks.filter((task) => task.status === column.id).map(normalizeTask)
  }));

const getAuthToken = (auth) => auth?.token || auth?.accessToken || '';

function App() {
  const [auth, setAuth] = React.useState(() => {
    const storedAuth = window.localStorage.getItem(authStorageKey);
    return storedAuth ? JSON.parse(storedAuth) : null;
  });
  const [projects, setProjects] = React.useState([]);
  const [tasks, setTasks] = React.useState([]);
  const [columns, setColumns] = React.useState(buildColumns([]));
  const [invitations, setInvitations] = React.useState([]);
  const [roadmap, setRoadmap] = React.useState(initialRoadmap);
  const [activeProjectId, setActiveProjectId] = React.useState(null);
  const [toast, setToast] = React.useState('SYSTEM ONLINE');
  const [isLoading, setIsLoading] = React.useState(false);
  const token = getAuthToken(auth);
  const currentUser = auth?.user && token ? auth.user : null;

  const activeProject = projects.find((project) => project.id === activeProjectId) || projects[0];

  React.useEffect(() => {
    if (!activeProject && projects.length > 0) {
      setActiveProjectId(projects[0].id);
    }
  }, [activeProject, projects]);

  const showToast = (message) => setToast(message.toUpperCase());

  const loadWorkspace = React.useCallback(async (authToken = token) => {
    if (!authToken) {
      return;
    }

    setIsLoading(true);

    try {
      const [projectsPayload, tasksPayload] = await Promise.all([
        apiRequest('/projects', { token: authToken }),
        apiRequest('/tasks', { token: authToken })
      ]);
      const nextTasks = tasksPayload.tasks || [];
      const nextProjects = (projectsPayload.projects || []).map((project) => normalizeProject(project, nextTasks));

      setTasks(nextTasks);
      setColumns(buildColumns(nextTasks));
      setProjects(nextProjects);
      setActiveProjectId((current) => current || nextProjects[0]?.id || null);
      showToast('Workspace synced');
    } catch (error) {
      showToast(error.message || 'Workspace sync failed');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    if (token) {
      loadWorkspace(token);
    }
  }, [loadWorkspace, token]);

  React.useEffect(() => {
    if (auth?.user && !token) {
      setAuth(null);
      window.localStorage.removeItem(authStorageKey);
      showToast('Please log in again');
    }
  }, [auth, token]);

  const saveAuth = (payload) => {
    const nextAuth = {
      token: payload.token,
      refreshToken: payload.refreshToken,
      user: payload.user
    };

    setAuth(nextAuth);
    window.localStorage.setItem(authStorageKey, JSON.stringify(nextAuth));
    return nextAuth;
  };

  const signup = async ({ name, email, password }) => {
    const payload = await apiRequest('/auth/signup', {
      method: 'POST',
      body: { name, email, password }
    });
    const nextAuth = saveAuth(payload);

    showToast(`Welcome ${payload.user.name}`);
    await loadWorkspace(nextAuth.token);
    return { ok: true };
  };

  const login = async ({ email, password }) => {
    const payload = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    const nextAuth = saveAuth(payload);

    showToast(`Welcome back ${payload.user.name}`);
    await loadWorkspace(nextAuth.token);
    return { ok: true };
  };

  const logout = () => {
    setAuth(null);
    setProjects([]);
    setTasks([]);
    setColumns(buildColumns([]));
    setActiveProjectId(null);
    window.localStorage.removeItem(authStorageKey);
    showToast('Logged out');
  };

  const addProject = async ({ name, description }) => {
    try {
      const payload = await apiRequest('/projects', {
        method: 'POST',
        token,
        body: { name, description }
      });
      const project = normalizeProject(payload.project, tasks);

      setProjects((current) => [project, ...current]);
      setActiveProjectId(project.id);
      showToast(`${name} created`);
      return true;
    } catch (error) {
      showToast(error.message || 'Project create failed');
      return false;
    }
  };

  const deleteProject = async (projectId) => {
    const project = projects.find((item) => item.id === projectId);

    try {
      await apiRequest(`/projects/${projectId}`, { method: 'DELETE', token });
      const nextProjects = projects.filter((item) => item.id !== projectId);
      const nextTasks = tasks.filter((task) => getDocumentId(task.project) !== projectId && task.project !== projectId);

      setTasks(nextTasks);
      setColumns(buildColumns(nextTasks));
      setProjects(nextProjects);
      setActiveProjectId(nextProjects[0]?.id || null);
      showToast(`${project?.name || 'Project'} deleted`);
    } catch (error) {
      showToast(error.message || 'Project delete failed');
    }
  };

  const inviteMember = async ({ projectId = activeProjectId, name, email }) => {
    const project = projects.find((item) => item.id === projectId);

    if (!project) {
      showToast('Project not found');
      return false;
    }

    let emailResult;

    try {
      emailResult = await apiRequest('/invitations/send', {
        method: 'POST',
        token,
        body: {
          name,
          email,
          projectId,
          projectName: project.name
        }
      });
    } catch (error) {
      showToast(error.message || 'Invitation email failed');
      return false;
    }

    try {
      const memberPayload = await apiRequest(`/projects/${projectId}/members`, {
        method: 'POST',
        token,
        body: { name, email }
      });

      setProjects((current) =>
        current.map((item) => (item.id === projectId ? normalizeProject(memberPayload.project, tasks) : item))
      );
    } catch (error) {
      showToast(error.message || 'Member add failed');
      return false;
    }

    const invitation = {
      id: Date.now(),
      name,
      email,
      project: project.name,
      message: `You got an invitation to join ${project.name} on TeamFlow.`,
      emailMode: emailResult.email.mode
    };

    setInvitations((current) => [invitation, ...current]);
    showToast(emailResult.message);
    return true;
  };

  const deleteMember = async (projectId, memberId) => {
    const project = projects.find((item) => item.id === projectId);
    const member = project?.team.find((item) => item.id === memberId);

    try {
      const payload = await apiRequest(`/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
        token
      });

      setProjects((current) =>
        current.map((item) => (item.id === projectId ? normalizeProject(payload.project, tasks) : item))
      );
      showToast(`${member?.name || 'Member'} removed`);
    } catch (error) {
      showToast(error.message || 'Member remove failed');
    }
  };

  const addTask = async ({ title }) => {
    if (!activeProject) {
      showToast('Create a project first');
      return false;
    }

    try {
      const payload = await apiRequest('/tasks', {
        method: 'POST',
        token,
        body: { title, projectId: activeProject.id, status: 'todo' }
      });
      const nextTasks = [payload.task, ...tasks];

      setTasks(nextTasks);
      setColumns(buildColumns(nextTasks));
      setProjects((current) => current.map((project) => normalizeProject(project, nextTasks)));
      showToast(`${title} added`);
      return true;
    } catch (error) {
      showToast(error.message || 'Task add failed');
      return false;
    }
  };

  const deleteTask = async (taskId) => {
    let taskTitle = 'Task';
    const task = tasks.find((item) => getDocumentId(item) === taskId);

    if (task) {
      taskTitle = task.title;
    }

    try {
      await apiRequest(`/tasks/${taskId}`, { method: 'DELETE', token });
      const nextTasks = tasks.filter((item) => getDocumentId(item) !== taskId);

      setTasks(nextTasks);
      setColumns(buildColumns(nextTasks));
      setProjects((current) => current.map((project) => normalizeProject(project, nextTasks)));
      showToast(`${taskTitle} deleted`);
    } catch (error) {
      showToast(error.message || 'Task delete failed');
    }
  };

  const addRoadmapItem = ({ title, timeline, status }) => {
    setRoadmap((current) => [{ id: Date.now(), title, timeline, status }, ...current]);
    showToast(`${title} added`);
  };

  const updateRoadmapStatus = (itemId, status) => {
    const item = roadmap.find((roadmapItem) => roadmapItem.id === itemId);
    setRoadmap((current) =>
      current.map((roadmapItem) => (roadmapItem.id === itemId ? { ...roadmapItem, status } : roadmapItem))
    );
    showToast(`${item?.title || 'Roadmap item'} -> ${status}`);
  };

  const deleteRoadmapItem = (itemId) => {
    const item = roadmap.find((roadmapItem) => roadmapItem.id === itemId);
    setRoadmap((current) => current.filter((roadmapItem) => roadmapItem.id !== itemId));
    showToast(`${item?.title || 'Roadmap item'} deleted`);
  };

  const moveTaskToColumn = async (taskId, targetColumnId) => {
    const columnIndex = columns.findIndex((column) => column.tasks.some((task) => task.id === taskId));
    const targetIndex = columns.findIndex((column) => column.id === targetColumnId);

    if (columnIndex < 0 || targetIndex < 0 || columnIndex === targetIndex) {
      return;
    }

    if (targetIndex < columnIndex && !window.confirm('Are you sure you want to move this task back?')) {
      return;
    }

    const task = tasks.find((item) => getDocumentId(item) === taskId);

    try {
      const payload = await apiRequest(`/tasks/${taskId}`, {
        method: 'PATCH',
        token,
        body: { status: targetColumnId }
      });
      const nextTasks = tasks.map((item) => (getDocumentId(item) === taskId ? payload.task : item));

      setTasks(nextTasks);
      setColumns(buildColumns(nextTasks));
      setProjects((current) => current.map((project) => normalizeProject(project, nextTasks)));
      showToast(`${task?.title || 'Task'} -> ${columns[targetIndex].title}`);
    } catch (error) {
      showToast(error.message || 'Task move failed');
    }
  };

  if (currentUser && isLoading && projects.length === 0) {
    return (
      <main className="tf-page">
        <AppHeader currentUser={currentUser} onLogout={logout} onToast={showToast} />
        <section className="tf-empty">
          <h1>Loading workspace.</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="tf-page">
      <AppHeader currentUser={currentUser} onLogout={logout} onToast={showToast} />
      <Routes>
        <Route
          path="/signup"
          element={
            currentUser ? (
              <Navigate to="/" replace />
            ) : (
              <SignupPage onSignup={signup} />
            )
          }
        />
        <Route
          path="/login"
          element={
            currentUser ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage onLogin={login} />
            )
          }
        />
        <Route
          path="/"
          element={currentUser ? (activeProject ? (
            <DashboardPage
              activeProject={activeProject}
              columns={columns}
              features={features}
              invitations={invitations}
              moveTaskToColumn={moveTaskToColumn}
              onAddTask={addTask}
              projects={projects}
              setActiveProjectId={setActiveProjectId}
              showToast={showToast}
              toast={toast}
            />
          ) : (
            <Navigate to="/projects" replace />
          )
          ) : (
            <Navigate to="/signup" replace />
          )}
        />
        <Route
          path="/board"
          element={currentUser ? (activeProject ? (
            <BoardPage
              activeProject={activeProject}
              columns={columns}
              deleteTask={deleteTask}
              moveTaskToColumn={moveTaskToColumn}
              onAddTask={addTask}
              projects={projects}
              toast={toast}
            />
          ) : (
            <Navigate to="/projects" replace />
          )
          ) : (
            <Navigate to="/signup" replace />
          )}
        />
        <Route
          path="/projects"
          element={currentUser ? (
            <ProjectsPage
              activeProjectId={activeProjectId}
              invitations={invitations}
              onAddProject={addProject}
              onDeleteMember={deleteMember}
              onDeleteProject={deleteProject}
              onInviteMember={inviteMember}
              projects={projects}
              setActiveProjectId={setActiveProjectId}
              toast={toast}
            />
          ) : (
            <Navigate to="/signup" replace />
          )}
        />
        <Route
          path="/team"
          element={currentUser ? (activeProject ? (
            <TeamPage
              activeProjectId={activeProjectId}
              invitations={invitations}
              onDeleteMember={deleteMember}
              onInviteMember={inviteMember}
              projects={projects}
              setActiveProjectId={setActiveProjectId}
              toast={toast}
            />
          ) : (
            <Navigate to="/projects" replace />
          )
          ) : (
            <Navigate to="/signup" replace />
          )}
        />
        <Route
          path="/roadmap"
          element={currentUser ? (
            <RoadmapPage
              onAddRoadmapItem={addRoadmapItem}
              onDeleteRoadmapItem={deleteRoadmapItem}
              onUpdateRoadmapStatus={updateRoadmapStatus}
              roadmap={roadmap}
              toast={toast}
            />
          ) : (
            <Navigate to="/signup" replace />
          )}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}

function AppHeader({ currentUser, onLogout, onToast }) {
  return (
    <header className="tf-header">
      <Link className="tf-logo" to="/" onClick={() => onToast('TeamFlow dashboard')}>
        TEAMFLOW
      </Link>
      {currentUser ? (
        <>
          <nav className="tf-nav" aria-label="Dashboard sections">
            <Link className="tf-chip tf-chip-white" to="/projects">
              Projects
            </Link>
            <Link className="tf-chip tf-chip-white" to="/board">
              Board
            </Link>
            <Link className="tf-chip tf-chip-white" to="/team">
              Team
            </Link>
            <Link className="tf-chip tf-chip-white" to="/roadmap">
              Roadmap
            </Link>
          </nav>
          <div className="tf-auth-actions">
            <span>{currentUser.name}</span>
            <button className="tf-chip tf-chip-white" onClick={onLogout} type="button">
              Logout
            </button>
            <Link className="tf-chip tf-chip-lime" to="/projects">
              New project
            </Link>
          </div>
        </>
      ) : (
        <div className="tf-auth-actions">
          <Link className="tf-chip tf-chip-white" to="/login">
            Login
          </Link>
          <Link className="tf-chip tf-chip-lime" to="/signup">
            Sign up
          </Link>
        </div>
      )}
    </header>
  );
}

function SignupPage({ onSignup }) {
  const navigate = useNavigate();
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      setError('Enter a name, valid email, and password with at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSignup({ name, email, password });
      navigate('/');
    } catch (apiError) {
      setError(apiError.message || 'Signup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="tf-auth-page">
      <div className="tf-auth-copy">
        <p className="tf-eyebrow">START WITH SIGNUP</p>
        <h1>CREATE ACCOUNT.</h1>
        <p>Sign up first, then log in to access projects, board, team, and roadmap.</p>
      </div>

      <form className="tf-auth-card" onSubmit={handleSubmit}>
        <h2>Sign up</h2>
        {error && <p className="tf-form-error">{error}</p>}
        <Field label="Full name" name="name" placeholder="Deepak Kumar" />
        <Field label="Email address" name="email" placeholder="deepak@example.com" type="email" />
        <Field label="Password" name="password" placeholder="Minimum 8 characters" type="password" />
        <div className="tf-form-actions">
          <button className="tf-button tf-button-lime small" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Creating...' : 'Create account'}
          </button>
          <Link className="tf-button tf-button-white small" to="/login">
            Login
          </Link>
        </div>
      </form>
    </section>
  );
}

function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');

    setIsSubmitting(true);
    setError('');

    try {
      await onLogin({ email, password });
      navigate('/');
    } catch (apiError) {
      setError(apiError.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="tf-auth-page">
      <div className="tf-auth-copy">
        <p className="tf-eyebrow">LOGIN TO TEAMFLOW</p>
        <h1>WELCOME BACK.</h1>
        <p>Use the account you created on the signup page to enter the dashboard.</p>
      </div>

      <form className="tf-auth-card" onSubmit={handleSubmit}>
        <h2>Login</h2>
        {error && <p className="tf-form-error">{error}</p>}
        <Field label="Email address" name="email" placeholder="deepak@example.com" type="email" />
        <Field label="Password" name="password" placeholder="Your password" type="password" />
        <div className="tf-form-actions">
          <button className="tf-button tf-button-lime small" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
          <Link className="tf-button tf-button-white small" to="/signup">
            Sign up
          </Link>
        </div>
      </form>
    </section>
  );
}

function DashboardPage({
  activeProject,
  columns,
  features,
  invitations,
  moveTaskToColumn,
  onAddTask,
  projects,
  setActiveProjectId,
  showToast,
  toast
}) {
  const [panel, setPanel] = React.useState(null);
  const taskCount = columns.reduce((count, column) => count + column.tasks.length, 0);
  const navigate = useNavigate();

  return (
    <>
      <section className="tf-hero">
        <div className="tf-hero-copy">
          <p className="tf-eyebrow">MERN PROJECT MANAGEMENT PLATFORM</p>
          <h1>
            PLAN.
            <br />
            TRACK.
            <br />
            COLLAB.
          </h1>
          <p className="tf-hero-text">
            TeamFlow brings projects, Kanban tasks, members, comments, notifications, and real-time updates into one
            portfolio-ready collaboration dashboard.
          </p>
          <div className="tf-actions">
            <button className="tf-button tf-button-lime" onClick={() => setPanel('task')} type="button">
              Add task
            </button>
            <button className="tf-button tf-button-white" onClick={() => navigate('/projects')} type="button">
              Manage projects
            </button>
          </div>
        </div>

        <aside className="tf-status-card">
          <div className="tf-status-head">
            <span>{toast}</span>
            <strong>{activeProject.progress}%</strong>
          </div>
          <h2>{activeProject.name}</h2>
          <p>Owner: {activeProject.owner}</p>
          <div className="tf-meter" aria-label={`${activeProject.progress}% progress`}>
            <span style={{ width: `${activeProject.progress}%` }} />
          </div>
          <div className="tf-stats">
            <div>
              <span>PROJECTS</span>
              <strong>{projects.length}</strong>
            </div>
            <div>
              <span>TASKS</span>
              <strong>{taskCount}</strong>
            </div>
            <div>
              <span>MEMBERS</span>
              <strong>{activeProject.team.length}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="tf-shell">
        <aside className="tf-sidebar">
          <div className="tf-panel">
            <div className="tf-panel-head">
              <h2>Projects</h2>
              <Link to="/projects">OPEN</Link>
            </div>
            <div className="tf-project-list">
              {projects.map((project) => (
                <button
                  className={`tf-project ${activeProject.id === project.id ? 'is-active' : ''}`}
                  key={project.id}
                  onClick={() => {
                    setActiveProjectId(project.id);
                    showToast(`${project.name} selected`);
                  }}
                  type="button"
                >
                  <strong>{project.name}</strong>
                  <span>{project.owner} / {project.team.length} members</span>
                </button>
              ))}
            </div>
          </div>

          <InvitePanel invitations={invitations} />
        </aside>

        <Board columns={columns} moveTaskToColumn={moveTaskToColumn} onNewTask={() => setPanel('task')} />
      </section>

      <section className="tf-features">
        {features.map((feature) => (
          <span key={feature}>{feature}</span>
        ))}
      </section>

      {panel === 'task' && (
        <TaskModal onClose={() => setPanel(null)} onSubmit={async (payload) => {
          const saved = await onAddTask(payload);
          if (saved) {
            setPanel(null);
          }
        }} />
      )}
    </>
  );
}

function ProjectsPage({
  activeProjectId,
  invitations,
  onAddProject,
  onDeleteMember,
  onDeleteProject,
  onInviteMember,
  projects,
  setActiveProjectId,
  toast
}) {
  const [panel, setPanel] = React.useState(null);
  const [memberProjectId, setMemberProjectId] = React.useState(activeProjectId);

  const selectedProject = projects.find((project) => project.id === activeProjectId) || projects[0];

  const openMemberPanel = (projectId) => {
    setMemberProjectId(projectId);
    setPanel('member');
  };

  return (
    <>
      <section className="tf-projects-page">
        <div className="tf-projects-hero">
          <div>
            <p className="tf-eyebrow">PROJECTS ROUTE /PROJECTS</p>
            <h1>PROJECT CONTROL.</h1>
            <p>View projects, add projects, delete projects, and add teammates to each project.</p>
          </div>
          <div className="tf-actions">
            <button className="tf-button tf-button-lime" onClick={() => setPanel('project')} type="button">
              Add project
            </button>
            <Link className="tf-button tf-button-white" to="/">
              Back to board
            </Link>
          </div>
        </div>

        <div className="tf-projects-grid">
          <section className="tf-panel tf-projects-list-panel">
            <div className="tf-panel-head">
              <h2>All projects</h2>
              <span>{projects.length}</span>
            </div>
            <div className="tf-project-table">
              {projects.length === 0 && (
                <article className="tf-project-row">
                  <button className="tf-project-row-main" onClick={() => setPanel('project')} type="button">
                    <strong>No projects yet</strong>
                    <span>Create your first project to unlock board and team workflows.</span>
                  </button>
                </article>
              )}
              {projects.map((project) => (
                <article className={`tf-project-row ${selectedProject?.id === project.id ? 'is-active' : ''}`} key={project.id}>
                  <button
                    className="tf-project-row-main"
                    onClick={() => setActiveProjectId(project.id)}
                    type="button"
                  >
                    <strong>{project.name}</strong>
                    <span>{project.owner} / {project.team.length} members / {project.progress}%</span>
                  </button>
                  <div className="tf-row-actions">
                    <button onClick={() => openMemberPanel(project.id)} type="button">
                      Add member
                    </button>
                    <button disabled={projects.length === 1} onClick={() => onDeleteProject(project.id)} type="button">
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {selectedProject ? (
            <aside className="tf-panel">
              <div className="tf-panel-head">
                <h2>{selectedProject.name}</h2>
                <span>{toast}</span>
              </div>
              <div className="tf-project-detail">
                <p>Owner: {selectedProject.owner}</p>
                <div className="tf-meter">
                  <span style={{ width: `${selectedProject.progress || 0}%` }} />
                </div>
                <button className="tf-button tf-button-lime small" onClick={() => openMemberPanel(selectedProject.id)} type="button">
                  Add team member
                </button>
              </div>

              <div className="tf-project-team">
                <h3>Project team</h3>
                {selectedProject.team.map((member) => (
                  <span className="tf-member" key={member.id}>
                    {member.name}
                    <small>{member.email}</small>
                    <button aria-label={`Delete ${member.name}`} onClick={() => onDeleteMember(selectedProject.id, member.id)} type="button">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </aside>
          ) : (
            <aside className="tf-panel">
              <div className="tf-panel-head">
                <h2>Start here</h2>
                <span>{toast}</span>
              </div>
              <div className="tf-project-detail">
                <p>Create a project first. Tasks and teammates will connect to that project.</p>
                <button className="tf-button tf-button-lime small" onClick={() => setPanel('project')} type="button">
                  Add project
                </button>
              </div>
            </aside>
          )}
        </div>
      </section>

      <InvitePanel invitations={invitations} compact />

      {panel === 'project' && (
        <ProjectModal onClose={() => setPanel(null)} onSubmit={async (payload) => {
          const saved = await onAddProject(payload);
          if (saved) {
            setPanel(null);
          }
        }} />
      )}

      {panel === 'member' && (
        <MemberModal
          onClose={() => setPanel(null)}
          onSubmit={async (payload) => {
            const sent = await onInviteMember({ ...payload, projectId: memberProjectId });
            if (sent) {
              setPanel(null);
            }
          }}
          projectName={projects.find((project) => project.id === memberProjectId)?.name || 'this project'}
        />
      )}
    </>
  );
}

function BoardPage({ activeProject, columns, deleteTask, moveTaskToColumn, onAddTask, projects, toast }) {
  const [panel, setPanel] = React.useState(null);
  const taskCount = columns.reduce((count, column) => count + column.tasks.length, 0);

  return (
    <>
      <section className="tf-projects-page">
        <div className="tf-projects-hero">
          <div>
            <p className="tf-eyebrow">BOARD ROUTE /BOARD</p>
            <h1>KANBAN CONTROL.</h1>
            <p>Add tasks, move tasks between stages, and delete tasks from the workflow.</p>
          </div>
          <div className="tf-actions">
            <button className="tf-button tf-button-lime" onClick={() => setPanel('task')} type="button">
              Add task
            </button>
            <Link className="tf-button tf-button-white" to="/projects">
              Projects
            </Link>
          </div>
        </div>

        <section className="tf-board tf-board-full">
          <div className="tf-board-head">
            <div>
              <p className="tf-eyebrow dark">ACTIVE PROJECT: {activeProject.name}</p>
              <h2>{taskCount} tasks across {projects.length} projects</h2>
            </div>
            <span className="tf-status-pill">{toast}</span>
          </div>

          <div className="tf-columns">
            {columns.map((column, columnIndex) => (
              <article className="tf-column" key={column.id}>
                <div className="tf-column-head">
                  <h3>{column.title}</h3>
                  <span>{column.tasks.length}</span>
                </div>
                <div className="tf-task-list">
                  {column.tasks.map((task) => (
                    <TaskCard
                      columnId={column.id}
                      columns={columns}
                      deleteTask={deleteTask}
                      key={task.id}
                      moveTaskToColumn={moveTaskToColumn}
                      task={task}
                    />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      {panel === 'task' && (
        <TaskModal onClose={() => setPanel(null)} onSubmit={async (payload) => {
          const saved = await onAddTask(payload);
          if (saved) {
            setPanel(null);
          }
        }} />
      )}
    </>
  );
}

function TeamPage({ activeProjectId, invitations, onDeleteMember, onInviteMember, projects, setActiveProjectId, toast }) {
  const [panel, setPanel] = React.useState(null);
  const [memberProjectId, setMemberProjectId] = React.useState(activeProjectId);
  const selectedProject = projects.find((project) => project.id === activeProjectId) || projects[0];
  const totalMembers = projects.reduce((count, project) => count + project.team.length, 0);

  const openInvite = (projectId) => {
    setMemberProjectId(projectId);
    setPanel('member');
  };

  return (
    <>
      <section className="tf-projects-page">
        <div className="tf-projects-hero">
          <div>
            <p className="tf-eyebrow">TEAM ROUTE /TEAM</p>
            <h1>TEAM CONTROL.</h1>
            <p>Add members by email, remove members, and switch between project teams.</p>
          </div>
          <button className="tf-button tf-button-lime" onClick={() => openInvite(selectedProject.id)} type="button">
            Invite member
          </button>
        </div>

        <div className="tf-projects-grid">
          <section className="tf-panel">
            <div className="tf-panel-head">
              <h2>Project teams</h2>
              <span>{totalMembers}</span>
            </div>
            <div className="tf-project-table">
              {projects.map((project) => (
                <article className={`tf-project-row ${selectedProject.id === project.id ? 'is-active' : ''}`} key={project.id}>
                  <button className="tf-project-row-main" onClick={() => setActiveProjectId(project.id)} type="button">
                    <strong>{project.name}</strong>
                    <span>{project.team.length} members</span>
                  </button>
                  <div className="tf-row-actions">
                    <button onClick={() => openInvite(project.id)} type="button">
                      Add member
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="tf-panel">
            <div className="tf-panel-head">
              <h2>{selectedProject.name}</h2>
              <span>{toast}</span>
            </div>
            <div className="tf-project-team">
              <h3>Members</h3>
              {selectedProject.team.map((member) => (
                <span className="tf-member" key={member.id}>
                  {member.name}
                  <small>{member.email}</small>
                  <button aria-label={`Delete ${member.name}`} onClick={() => onDeleteMember(selectedProject.id, member.id)} type="button">
                    ×
                  </button>
                </span>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <InvitePanel invitations={invitations} compact />

      {panel === 'member' && (
        <MemberModal
          onClose={() => setPanel(null)}
          onSubmit={async (payload) => {
            const sent = await onInviteMember({ ...payload, projectId: memberProjectId });
            if (sent) {
              setPanel(null);
            }
          }}
          projectName={projects.find((project) => project.id === memberProjectId)?.name || 'this project'}
        />
      )}
    </>
  );
}

function RoadmapPage({ onAddRoadmapItem, onDeleteRoadmapItem, onUpdateRoadmapStatus, roadmap, toast }) {
  const [panel, setPanel] = React.useState(null);

  return (
    <>
      <section className="tf-projects-page">
        <div className="tf-projects-hero">
          <div>
            <p className="tf-eyebrow">ROADMAP ROUTE /ROADMAP</p>
            <h1>ROADMAP CONTROL.</h1>
            <p>Add milestones, update milestone status, and delete roadmap items.</p>
          </div>
          <button className="tf-button tf-button-lime" onClick={() => setPanel('roadmap')} type="button">
            Add milestone
          </button>
        </div>

        <section className="tf-panel tf-roadmap-panel">
          <div className="tf-panel-head">
            <h2>Development timeline</h2>
            <span>{toast}</span>
          </div>
          <div className="tf-roadmap-list">
            {roadmap.map((item) => (
              <article className="tf-roadmap-item" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.timeline}</span>
                </div>
                <select value={item.status} onChange={(event) => onUpdateRoadmapStatus(item.id, event.target.value)}>
                  <option value="PLANNED">PLANNED</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DONE">DONE</option>
                </select>
                <button onClick={() => onDeleteRoadmapItem(item.id)} type="button">
                  Delete
                </button>
              </article>
            ))}
          </div>
        </section>
      </section>

      {panel === 'roadmap' && (
        <RoadmapModal onClose={() => setPanel(null)} onSubmit={(payload) => {
          onAddRoadmapItem(payload);
          setPanel(null);
        }} />
      )}
    </>
  );
}

function Board({ columns, moveTaskToColumn, onNewTask }) {
  return (
    <section className="tf-board">
      <div className="tf-board-head">
        <div>
          <p className="tf-eyebrow dark">KANBAN BOARD</p>
          <h2>Move tasks from idea to done.</h2>
        </div>
        <button className="tf-button tf-button-lime small" onClick={onNewTask} type="button">
          New task
        </button>
      </div>

      <div className="tf-columns">
        {columns.map((column, columnIndex) => (
          <article className="tf-column" key={column.id}>
            <div className="tf-column-head">
              <h3>{column.title}</h3>
              <span>{column.tasks.length}</span>
            </div>
            <div className="tf-task-list">
              {column.tasks.map((task) => (
                <TaskCard
                  columnId={column.id}
                  columns={columns}
                  key={task.id}
                  moveTaskToColumn={moveTaskToColumn}
                  task={task}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TaskCard({ columnId, columns, deleteTask, moveTaskToColumn, task }) {
  return (
    <div className="tf-task">
      <strong>{task.title}</strong>
      <span>{task.project}</span>
      <div className="tf-task-actions">
        <label>
          Status
          <select value={columnId} onChange={(event) => moveTaskToColumn(task.id, event.target.value)}>
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.title}
              </option>
            ))}
          </select>
        </label>
        {deleteTask && (
          <button onClick={() => deleteTask(task.id)} type="button">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function InvitePanel({ compact = false, invitations }) {
  return (
    <div className={`tf-panel ${compact ? 'tf-invite-wide' : ''}`}>
      <div className="tf-panel-head">
        <h2>Invites</h2>
        <span>{invitations.length}</span>
      </div>
      <div className="tf-invite-list">
        {invitations.map((invite) => (
          <article className="tf-invite" key={invite.id}>
            <strong>{invite.name}</strong>
            <span>{invite.email}</span>
            <p>{invite.message}</p>
            {invite.emailMode && <em>{invite.emailMode === 'smtp' ? 'Email sent' : 'Email preview'}</em>}
          </article>
        ))}
      </div>
    </div>
  );
}

function ProjectModal({ onClose, onSubmit }) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  return (
    <Modal>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const name = String(formData.get('name') || '').trim();
          const description = String(formData.get('description') || '').trim();

          if (name) {
            setIsSubmitting(true);
            await onSubmit({ name, description });
            setIsSubmitting(false);
          }
        }}
      >
        <h2>Create project</h2>
        <Field label="Project name" name="name" placeholder="New workspace" />
        <Field label="Description" name="description" placeholder="Project goals" />
        <PanelActions disabled={isSubmitting} onClose={onClose} submitLabel={isSubmitting ? 'Creating...' : 'Create'} />
      </form>
    </Modal>
  );
}

function MemberModal({ onClose, onSubmit, projectName }) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  return (
    <Modal>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const name = String(formData.get('name') || '').trim();
          const email = String(formData.get('email') || '').trim().toLowerCase();

          if (name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setIsSubmitting(true);
            await onSubmit({ name, email });
            setIsSubmitting(false);
          }
        }}
      >
        <h2>Add member</h2>
        <Field label="Member name" name="name" placeholder="Teammate name" />
        <Field label="Email address" name="email" placeholder="teammate@example.com" type="email" />
        <p className="tf-form-note">Sends: “You got an invitation to join {projectName} on TeamFlow.”</p>
        <PanelActions disabled={isSubmitting} onClose={onClose} submitLabel={isSubmitting ? 'Inviting...' : 'Invite'} />
      </form>
    </Modal>
  );
}

function TaskModal({ onClose, onSubmit }) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  return (
    <Modal>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const title = String(formData.get('title') || '').trim();

          if (title) {
            setIsSubmitting(true);
            await onSubmit({ title });
            setIsSubmitting(false);
          }
        }}
      >
        <h2>Add task</h2>
        <Field label="Task title" name="title" placeholder="Create task" />
        <PanelActions disabled={isSubmitting} onClose={onClose} submitLabel={isSubmitting ? 'Adding...' : 'Add task'} />
      </form>
    </Modal>
  );
}

function RoadmapModal({ onClose, onSubmit }) {
  return (
    <Modal>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const title = String(formData.get('title') || '').trim();
          const timeline = String(formData.get('timeline') || '').trim();
          const status = String(formData.get('status') || 'PLANNED');

          if (title && timeline) {
            onSubmit({ title, timeline, status });
          }
        }}
      >
        <h2>Add milestone</h2>
        <Field label="Milestone" name="title" placeholder="Deploy TeamFlow" />
        <Field label="Timeline" name="timeline" placeholder="Week 6" />
        <label className="tf-field">
          Status
          <select name="status" defaultValue="PLANNED">
            <option value="PLANNED">PLANNED</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DONE">DONE</option>
          </select>
        </label>
        <PanelActions onClose={onClose} submitLabel="Add milestone" />
      </form>
    </Modal>
  );
}

function Modal({ children }) {
  return (
    <div className="tf-modal-backdrop">
      <section className="tf-modal">{children}</section>
    </div>
  );
}

function Field({ label, name, placeholder, type = 'text' }) {
  return (
    <label className="tf-field">
      {label}
      <input name={name} placeholder={placeholder} type={type} />
    </label>
  );
}

function PanelActions({ disabled = false, onClose, submitLabel }) {
  return (
    <div className="tf-form-actions">
      <button className="tf-button tf-button-lime small" disabled={disabled} type="submit">
        {submitLabel}
      </button>
      <button className="tf-button tf-button-white small" onClick={onClose} type="button">
        Close
      </button>
    </div>
  );
}

export default App;

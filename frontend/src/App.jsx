import React from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { doGoogleSignIn, doSignOut } from './services/firebaseAuth';
import {
  apiRequest,
  clearAccessToken,
  restoreSession,
  setAccessToken,
  setSessionLostHandler
} from './services/apiClient';

const features = ['Projects', 'Team roles', 'Kanban tasks', 'Comments', 'Notifications', 'Real-time sync'];

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

/**
 * Firebase error codes are not user-facing copy. Google sign-in is the only Firebase
 * path left in the app, but signup/login catch blocks run this too so a stray Firebase
 * error can never reach the UI as a raw code.
 */
const firebaseErrorMessages = {
  'auth/email-already-in-use': 'That email is already registered. Log in instead.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/weak-password': 'Choose a password with at least 8 characters.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the Google popup. Allow popups and retry.',
  'auth/account-exists-with-different-credential':
    'An account with that email already exists. Sign in with your password.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.'
};

const mapFirebaseError = (error) =>
  firebaseErrorMessages[error?.code] || error?.message || 'Authentication failed';

const getDocumentId = (item) => item?._id || item?.id;
const getReferenceId = (item) => (typeof item === 'string' ? item : item?._id || item?.id || item?.uid);

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
  userId: getReferenceId(member.user),
  name: member.name,
  email: member.email,
  role: member.role
});

const normalizeProject = (project, tasks = []) => ({
  id: getDocumentId(project),
  name: project.name,
  description: project.description || '',
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  owner: project.members?.find((member) => member.role === 'owner')?.name || project.owner?.name || 'Owner',
  progress: getProjectProgress(getDocumentId(project), tasks),
  team: project.team || (project.members || []).map(normalizeMember)
});

const normalizeTask = (task) => ({
  id: getDocumentId(task),
  title: task.title,
  project: task.project?.name || task.projectName || 'Project',
  projectId: getDocumentId(task.project) || task.project,
  assignee: task.assignedTo
    ? {
        id: getReferenceId(task.assignedTo),
        name: task.assignedTo.name || 'Assigned',
        email: task.assignedTo.email || ''
      }
    : null,
  status: task.status || 'todo',
  priority: task.priority || 'medium',
  createdAt: task.createdAt,
  updatedAt: task.updatedAt
});

const buildColumns = (tasks) =>
  columnDefinitions.map((column) => ({
    ...column,
    tasks: tasks.filter((task) => task.status === column.id).map(normalizeTask)
  }));

const getUniqueMemberCount = (projects) => {
  const members = new Set();

  projects.forEach((project) => {
    project.team.forEach((member) => {
      members.add(member.email || member.id || member.name);
    });
  });

  return members.size;
};

const getRecentActivity = (projects, tasks) => {
  const taskEvents = tasks.map((task) => ({
    id: `task-${getDocumentId(task)}`,
    label: task.status === 'done' ? 'Task completed' : 'Task updated',
    title: task.title,
    meta: task.project?.name || 'Project task',
    date: task.updatedAt || task.createdAt
  }));
  const projectEvents = projects.map((project) => ({
    id: `project-${project.id}`,
    label: 'Project active',
    title: project.name,
    meta: `${project.team.length} members`,
    date: project.updatedAt || project.createdAt
  }));

  return [...taskEvents, ...projectEvents]
    .filter((event) => event.date)
    .sort((left, right) => new Date(right.date) - new Date(left.date))
    .slice(0, 5);
};

const formatActivityDate = (date) =>
  new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));

function App() {
  /**
   * The signed-in user IS the session. The access token itself lives in apiClient's
   * module scope — never in state, never in localStorage — so there is nothing here for
   * an XSS payload to read.
   */
  const [currentUser, setCurrentUser] = React.useState(null);
  // Held until restoreSession() settles, otherwise every reload flashes the signup page
  // before the refresh cookie has had a chance to produce a token.
  const [isRestoringSession, setIsRestoringSession] = React.useState(true);
  // Set only for local accounts awaiting verification, so the verify screen can prefill
  // the address. Google sign-in never sets it.
  const [pendingVerification, setPendingVerification] = React.useState(null);
  const [projects, setProjects] = React.useState([]);
  const [tasks, setTasks] = React.useState([]);
  const [columns, setColumns] = React.useState(buildColumns([]));
  const [invitations, setInvitations] = React.useState([]);
  const [notifications, setNotifications] = React.useState([]);
  const [roadmap, setRoadmap] = React.useState(initialRoadmap);
  const [activeProjectId, setActiveProjectId] = React.useState(null);
  const [toast, setToast] = React.useState('SYSTEM ONLINE');
  const [isLoading, setIsLoading] = React.useState(false);
  const currentUserId = getDocumentId(currentUser) || null;

  const activeProject = projects.find((project) => project.id === activeProjectId) || projects[0];

  React.useEffect(() => {
    if (!activeProject && projects.length > 0) {
      setActiveProjectId(projects[0].id);
    }
  }, [activeProject, projects]);

  const showToast = React.useCallback((message) => setToast(String(message).toUpperCase()), []);

  const adoptSession = React.useCallback((payload) => {
    setAccessToken(payload.token);
    setCurrentUser(payload.user);
    setPendingVerification(null);
    return payload;
  }, []);

  const clearSession = React.useCallback(() => {
    clearAccessToken();
    setCurrentUser(null);
    setProjects([]);
    setTasks([]);
    setColumns(buildColumns([]));
    setNotifications([]);
    setInvitations([]);
    setActiveProjectId(null);
  }, []);

  // Trades the httpOnly refresh cookie for an access token on load, so a reload keeps
  // the user signed in without any token having been persisted in the browser.
  React.useEffect(() => {
    let cancelled = false;

    restoreSession()
      .then((payload) => {
        if (!cancelled && payload) {
          adoptSession(payload);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRestoringSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adoptSession]);

  // A refresh that fails mid-session means the session is genuinely over (expired,
  // logged out elsewhere, or password changed). Drop to the login screen rather than
  // letting every subsequent request fail silently.
  React.useEffect(() => {
    setSessionLostHandler(() => {
      clearSession();
      showToast('Session expired. Please log in again.');
    });

    return () => setSessionLostHandler(null);
  }, [clearSession, showToast]);

  const loadWorkspace = React.useCallback(async () => {
    setIsLoading(true);

    try {
      const [projectsPayload, tasksPayload, notificationsPayload] = await Promise.all([
        apiRequest('/projects'),
        apiRequest('/tasks'),
        apiRequest('/notifications')
      ]);
      const nextTasks = tasksPayload.tasks || [];
      const nextProjects = (projectsPayload.projects || []).map((project) => normalizeProject(project, nextTasks));

      setTasks(nextTasks);
      setColumns(buildColumns(nextTasks));
      setProjects(nextProjects);
      setNotifications(notificationsPayload.notifications || []);
      setActiveProjectId((current) => current || nextProjects[0]?.id || null);
      showToast('Workspace synced');
    } catch (error) {
      showToast(error.message || 'Workspace sync failed');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Keyed on the user id rather than the user object so re-renders do not refetch.
  React.useEffect(() => {
    if (currentUserId) {
      loadWorkspace();
    }
  }, [currentUserId, loadWorkspace]);

  const signup = async ({ name, email, password }) => {
    const payload = await apiRequest('/auth/signup', {
      method: 'POST',
      body: { name, email, password }
    });

    // The backend withholds a session until the address is verified, so there is no
    // token to adopt here. The caller routes to the verification screen.
    setPendingVerification({ email: payload.email || email });
    showToast('Check your email to verify your account');
    return { needsVerification: true };
  };

  const login = async ({ email, password }) => {
    try {
      const payload = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password }
      });

      adoptSession(payload);
      showToast(`Welcome back ${payload.user.name}`);
      return { needsVerification: false };
    } catch (error) {
      if (error.code === 'EMAIL_NOT_VERIFIED') {
        setPendingVerification({ email });
        showToast('Verify your email to continue');
        return { needsVerification: true };
      }

      throw error;
    }
  };

  /**
   * Google sign-in. Firebase is only the identity broker: the ID token it mints is
   * verified server-side, and the session the app runs on is the backend's own.
   *
   * Google has already attested the address, so this path never sets
   * `pendingVerification` — a Google user cannot land on the verification screen.
   */
  const googleSignIn = async () => {
    let idToken;

    try {
      const result = await doGoogleSignIn();
      // getIdToken() is the public API for the signed JWT. `user.accessToken` is an SDK
      // internal and must not be used.
      idToken = await result.user.getIdToken();
    } catch (error) {
      throw new Error(mapFirebaseError(error));
    }

    const payload = await apiRequest('/auth/google', {
      method: 'POST',
      body: { idToken }
    });

    adoptSession(payload);
    showToast(`Welcome ${payload.user.name}`);
    return { needsVerification: false };
  };

  // Verifying proves control of the mailbox, so the backend returns a session here and
  // the user lands straight in the workspace.
  const verifyEmailToken = React.useCallback(
    async (verificationToken) => {
      const payload = await apiRequest('/auth/verify-email', {
        method: 'POST',
        body: { token: verificationToken }
      });

      adoptSession(payload);
      showToast(`Email verified. Welcome ${payload.user.name}`);
    },
    [adoptSession, showToast]
  );

  const resendVerification = async (email) => {
    const payload = await apiRequest('/auth/resend-verification', {
      method: 'POST',
      body: { email }
    });

    showToast('Verification email requested');
    return payload.message;
  };

  const requestPasswordReset = async (email) => {
    const payload = await apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: { email }
    });

    showToast('Password reset requested');
    return payload.message;
  };

  const resetPassword = async ({ token: resetToken, password }) => {
    const payload = await apiRequest('/auth/reset-password', {
      method: 'POST',
      body: { token: resetToken, password }
    });

    // The reset revoked every session server-side, so any local one is already dead.
    clearSession();
    showToast('Password updated');
    return payload.message;
  };

  const logout = async () => {
    try {
      // Revokes the refresh token family and clears the cookie server-side.
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (_error) {
      // The local session is discarded either way.
    }

    try {
      // Only Google users have a Firebase session to end, and it may already be gone.
      await doSignOut();
    } catch (_error) {
      // Not fatal — the app session is what matters.
    }

    clearSession();
    showToast('Logged out');
  };

  const addProject = async ({ name, description }) => {
    try {
      const payload = await apiRequest('/projects', {
        method: 'POST',
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
      await apiRequest(`/projects/${projectId}`, { method: 'DELETE' });
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

    try {
      const memberPayload = await apiRequest(`/projects/${projectId}/members`, {
        method: 'POST',
        body: { name, email }
      });

      setProjects((current) =>
        current.map((item) => (item.id === projectId ? normalizeProject(memberPayload.project, tasks) : item))
      );
    } catch (error) {
      showToast(error.message || 'Member add failed');
      return false;
    }

    let emailResult;

    try {
      emailResult = await apiRequest('/invitations/send', {
        method: 'POST',
        body: {
          name,
          email,
          projectId,
          projectName: project.name
        }
      });
    } catch (error) {
      emailResult = {
        message: error.message || 'Member added, email delivery failed',
        email: {
          mode: 'failed',
          delivered: false
        }
      };
    }

    const invitation = {
      id: Date.now(),
      name,
      email,
      project: project.name,
      message: `You got an invitation to join ${project.name} on TeamFlow.`,
      emailMode: emailResult.email?.mode || 'failed'
    };

    setInvitations((current) => [invitation, ...current]);
    showToast(emailResult.message || `${name} added`);
    return true;
  };

  const deleteMember = async (projectId, memberId) => {
    const project = projects.find((item) => item.id === projectId);
    const member = project?.team.find((item) => item.id === memberId);

    try {
      const payload = await apiRequest(`/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE'
      });

      setProjects((current) =>
        current.map((item) => (item.id === projectId ? normalizeProject(payload.project, tasks) : item))
      );
      showToast(`${member?.name || 'Member'} removed`);
    } catch (error) {
      showToast(error.message || 'Member remove failed');
    }
  };

  const addTask = async ({ assignedTo, title }) => {
    if (!activeProject) {
      showToast('Create a project first');
      return false;
    }

    try {
      const payload = await apiRequest('/tasks', {
        method: 'POST',
        body: { title, assignedTo: assignedTo || null, projectId: activeProject.id, status: 'todo' }
      });
      const nextTasks = [payload.task, ...tasks];
      const assignee = activeProject.team.find((member) => member.userId === assignedTo);

      setTasks(nextTasks);
      setColumns(buildColumns(nextTasks));
      setProjects((current) => current.map((project) => normalizeProject(project, nextTasks)));
      if (payload.notification && getReferenceId(payload.notification.recipient) === getReferenceId(currentUser)) {
        setNotifications((current) => [payload.notification, ...current]);
      }
      showToast(assignee ? `${title} assigned to ${assignee.name}` : `${title} added`);
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
      await apiRequest(`/tasks/${taskId}`, { method: 'DELETE' });
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

  // Shown while the refresh cookie is being exchanged. Rendering the routes here would
  // briefly redirect a signed-in user to /signup before the token arrives.
  if (isRestoringSession) {
    return (
      <main className="tf-page">
        <AppHeader currentUser={null} onLogout={logout} onToast={showToast} />
        <section className="tf-empty">
          <h1>Restoring session.</h1>
        </section>
      </main>
    );
  }

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
              <SignupPage onGoogleSignIn={googleSignIn} onSignup={signup} />
            )
          }
        />
        <Route
          path="/login"
          element={
            currentUser ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage onGoogleSignIn={googleSignIn} onLogin={login} />
            )
          }
        />
        {/*
          Reachable while signed out — these carry single-use tokens from an email, so
          they are never gated on currentUser.
        */}
        <Route
          path="/verify-email"
          element={
            <VerifyEmailPage
              onResend={resendVerification}
              onVerifyToken={verifyEmailToken}
              pendingEmail={pendingVerification?.email || ''}
            />
          }
        />
        <Route
          path="/forgot-password"
          element={<ForgotPasswordPage onRequestReset={requestPasswordReset} />}
        />
        <Route path="/reset-password" element={<ResetPasswordPage onResetPassword={resetPassword} />} />
        <Route
          path="/"
          element={currentUser ? (activeProject ? (
            <DashboardPage
              activeProject={activeProject}
              columns={columns}
              features={features}
              invitations={invitations}
              moveTaskToColumn={moveTaskToColumn}
              notifications={notifications}
              onAddTask={addTask}
              projects={projects}
              setActiveProjectId={setActiveProjectId}
              showToast={showToast}
              tasks={tasks}
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

/**
 * Shared Google button. Takes its disabled state from the host page so it greys out
 * while the email/password form is submitting, and vice versa.
 */
function GoogleButton({ disabled, label, onClick }) {
  return (
    <button
      className="tf-google-button"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span aria-hidden="true" className="tf-google-mark">
        G
      </span>
      {label}
    </button>
  );
}

function AuthDivider() {
  return (
    <p className="tf-auth-divider">
      <span>or</span>
    </p>
  );
}

function SignupPage({ onGoogleSignIn, onSignup }) {
  const navigate = useNavigate();
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isGoogleBusy, setIsGoogleBusy] = React.useState(false);
  const isBusy = isSubmitting || isGoogleBusy;

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
      const result = await onSignup({ name, email, password });

      // Signup does not return a session — the address has to be verified first.
      navigate(result?.needsVerification ? '/verify-email' : '/');
    } catch (apiError) {
      setError(mapFirebaseError(apiError) || 'Signup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setIsGoogleBusy(true);
    setError('');

    try {
      await onGoogleSignIn();
      navigate('/');
    } catch (authError) {
      setError(mapFirebaseError(authError) || 'Google sign-in failed');
    } finally {
      setIsGoogleBusy(false);
    }
  };

  return (
    <section className="tf-auth-page">
      <div className="tf-auth-copy">
        <p className="tf-eyebrow">START WITH SIGNUP</p>
        <h1>CREATE ACCOUNT.</h1>
        <p>Sign up with Google for instant access, or use email and confirm your address.</p>
      </div>

      <form className="tf-auth-card" onSubmit={handleSubmit}>
        <h2>Sign up</h2>
        {error && <p className="tf-form-error">{error}</p>}

        <GoogleButton
          disabled={isBusy}
          label={isGoogleBusy ? 'Opening Google...' : 'Continue with Google'}
          onClick={handleGoogle}
        />
        <AuthDivider />

        <Field autoComplete="name" disabled={isBusy} label="Full name" name="name" placeholder="Deepak Kumar" />
        <Field
          autoComplete="email"
          disabled={isBusy}
          label="Email address"
          name="email"
          placeholder="deepak@example.com"
          type="email"
        />
        <Field
          autoComplete="new-password"
          disabled={isBusy}
          label="Password"
          name="password"
          placeholder="Minimum 8 characters"
          type="password"
        />
        <div className="tf-form-actions">
          <button className="tf-button tf-button-lime small" disabled={isBusy} type="submit">
            {isSubmitting ? 'Creating...' : 'Create account'}
          </button>
          <Link className="tf-button tf-button-white small" to="/login">
            Login
          </Link>
        </div>
        <p className="tf-auth-meta">
          We email a verification link before your account is active.
        </p>
      </form>
    </section>
  );
}

function LoginPage({ onGoogleSignIn, onLogin }) {
  const navigate = useNavigate();
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isGoogleBusy, setIsGoogleBusy] = React.useState(false);
  const isBusy = isSubmitting || isGoogleBusy;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');

    setIsSubmitting(true);
    setError('');

    try {
      const result = await onLogin({ email, password });

      // An unverified account is a valid password on an inactive login, so route to the
      // verification screen rather than showing a dead end.
      navigate(result?.needsVerification ? '/verify-email' : '/');
    } catch (apiError) {
      setError(mapFirebaseError(apiError) || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setIsGoogleBusy(true);
    setError('');

    try {
      await onGoogleSignIn();
      navigate('/');
    } catch (authError) {
      setError(mapFirebaseError(authError) || 'Google sign-in failed');
    } finally {
      setIsGoogleBusy(false);
    }
  };

  return (
    <section className="tf-auth-page">
      <div className="tf-auth-copy">
        <p className="tf-eyebrow">LOGIN TO TEAMFLOW</p>
        <h1>WELCOME BACK.</h1>
        <p>Continue with Google, or sign in with the email and password you registered.</p>
      </div>

      <form className="tf-auth-card" onSubmit={handleSubmit}>
        <h2>Login</h2>
        {error && <p className="tf-form-error">{error}</p>}

        <GoogleButton
          disabled={isBusy}
          label={isGoogleBusy ? 'Opening Google...' : 'Continue with Google'}
          onClick={handleGoogle}
        />
        <AuthDivider />

        <Field
          autoComplete="email"
          disabled={isBusy}
          label="Email address"
          name="email"
          placeholder="deepak@example.com"
          type="email"
        />
        <Field
          autoComplete="current-password"
          disabled={isBusy}
          label="Password"
          name="password"
          placeholder="Your password"
          type="password"
        />
        <div className="tf-form-actions">
          <button className="tf-button tf-button-lime small" disabled={isBusy} type="submit">
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
          <Link className="tf-button tf-button-white small" to="/signup">
            Sign up
          </Link>
        </div>
        <p className="tf-auth-meta">
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
      </form>
    </section>
  );
}

/**
 * Two jobs in one screen:
 *  - with `?token=` in the URL (the emailed link), it redeems the token and signs in
 *  - without one, it is the holding screen shown right after signup
 */
function VerifyEmailPage({ onResend, onVerifyToken, pendingEmail }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token') || '';
  const [status, setStatus] = React.useState(urlToken ? 'verifying' : 'waiting');
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [isResending, setIsResending] = React.useState(false);
  const [email, setEmail] = React.useState(pendingEmail);

  /**
   * Guards against a second redemption of the same token. Verification tokens are
   * single-use, and StrictMode double-invokes effects in development — without this the
   * second call would fail and report "invalid link" on a verification that succeeded.
   */
  const redeemedTokenRef = React.useRef('');

  React.useEffect(() => {
    if (!urlToken || redeemedTokenRef.current === urlToken) {
      return;
    }

    redeemedTokenRef.current = urlToken;
    setStatus('verifying');

    onVerifyToken(urlToken)
      .then(() => {
        setStatus('verified');
        navigate('/', { replace: true });
      })
      .catch((verifyError) => {
        setStatus('failed');
        setError(verifyError.message || 'This link could not be verified.');
      });
  }, [navigate, onVerifyToken, urlToken]);

  const handleResend = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter the email address you signed up with.');
      return;
    }

    setIsResending(true);
    setError('');
    setNotice('');

    try {
      const message = await onResend(cleanEmail);
      setNotice(message || 'If that address needs verification, a new link is on its way.');
    } catch (resendError) {
      setError(resendError.message || 'Could not send the email. Try again shortly.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <section className="tf-auth-page">
      <div className="tf-auth-copy">
        <p className="tf-eyebrow">ONE STEP LEFT</p>
        <h1>{status === 'failed' ? 'LINK EXPIRED.' : 'CHECK YOUR EMAIL.'}</h1>
        <p>
          {status === 'verifying'
            ? 'Confirming your link. This only takes a moment.'
            : 'We sent a verification link to your inbox. Open it to activate your account and sign in.'}
        </p>
      </div>

      <div className="tf-auth-card">
        <h2>Verify email</h2>
        {error && <p className="tf-form-error">{error}</p>}
        {notice && <p className="tf-form-note">{notice}</p>}

        {status === 'verifying' ? (
          <p className="tf-form-note">Verifying your link...</p>
        ) : (
          <>
            <label className="tf-field">
              Email address
              <input
                autoComplete="email"
                disabled={isResending}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="deepak@example.com"
                type="email"
                value={email}
              />
            </label>
            <div className="tf-form-actions">
              <button
                className="tf-button tf-button-lime small"
                disabled={isResending}
                onClick={handleResend}
                type="button"
              >
                {isResending ? 'Sending...' : 'Resend email'}
              </button>
              <Link className="tf-button tf-button-white small" to="/login">
                I have verified, continue
              </Link>
            </div>
            <p className="tf-auth-meta">
              Links expire after 24 hours. Requesting a new one invalidates the old link.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function ForgotPasswordPage({ onRequestReset }) {
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setNotice('');

    try {
      const message = await onRequestReset(email);
      setNotice(message || 'If an account exists for that address, a reset link is on its way.');
    } catch (apiError) {
      setError(apiError.message || 'Could not send the reset email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="tf-auth-page">
      <div className="tf-auth-copy">
        <p className="tf-eyebrow">PASSWORD HELP</p>
        <h1>RESET ACCESS.</h1>
        <p>Enter your email and we will send a link to choose a new password.</p>
      </div>

      <form className="tf-auth-card" onSubmit={handleSubmit}>
        <h2>Forgot password</h2>
        {error && <p className="tf-form-error">{error}</p>}
        {notice && <p className="tf-form-note">{notice}</p>}
        <Field
          autoComplete="email"
          disabled={isSubmitting}
          label="Email address"
          name="email"
          placeholder="deepak@example.com"
          type="email"
        />
        <div className="tf-form-actions">
          <button className="tf-button tf-button-lime small" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </button>
          <Link className="tf-button tf-button-white small" to="/login">
            Back to login
          </Link>
        </div>
        <p className="tf-auth-meta">Reset links expire after 15 minutes and work only once.</p>
      </form>
    </section>
  );
}

function ResetPasswordPage({ onResetPassword }) {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token') || '';
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDone, setIsDone] = React.useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get('password') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');

    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Both passwords must match.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onResetPassword({ token: resetToken, password });
      setIsDone(true);
    } catch (apiError) {
      setError(apiError.message || 'Could not reset your password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="tf-auth-page">
      <div className="tf-auth-copy">
        <p className="tf-eyebrow">CHOOSE A NEW PASSWORD</p>
        <h1>{isDone ? 'PASSWORD SET.' : 'NEW PASSWORD.'}</h1>
        <p>
          {isDone
            ? 'Your password is updated and every existing session was signed out. Log in to continue.'
            : 'Pick something you have not used elsewhere. This also signs out every other session.'}
        </p>
      </div>

      <form className="tf-auth-card" onSubmit={handleSubmit}>
        <h2>Reset password</h2>
        {error && <p className="tf-form-error">{error}</p>}

        {isDone ? (
          <>
            <p className="tf-form-note">Password updated. Sign in with your new password.</p>
            <div className="tf-form-actions">
              <Link className="tf-button tf-button-lime small" to="/login">
                Go to login
              </Link>
            </div>
          </>
        ) : !resetToken ? (
          <>
            <p className="tf-form-note">
              This page needs the link from your reset email. Request a new one to continue.
            </p>
            <div className="tf-form-actions">
              <Link className="tf-button tf-button-lime small" to="/forgot-password">
                Request a reset link
              </Link>
            </div>
          </>
        ) : (
          <>
            <Field
              autoComplete="new-password"
              disabled={isSubmitting}
              label="New password"
              name="password"
              placeholder="Minimum 8 characters"
              type="password"
            />
            <Field
              autoComplete="new-password"
              disabled={isSubmitting}
              label="Confirm password"
              name="confirmPassword"
              placeholder="Repeat your new password"
              type="password"
            />
            <div className="tf-form-actions">
              <button className="tf-button tf-button-lime small" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Saving...' : 'Set new password'}
              </button>
              <Link className="tf-button tf-button-white small" to="/login">
                Cancel
              </Link>
            </div>
          </>
        )}
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
  notifications,
  onAddTask,
  projects,
  setActiveProjectId,
  showToast,
  tasks,
  toast
}) {
  const [panel, setPanel] = React.useState(null);
  const taskCount = columns.reduce((count, column) => count + column.tasks.length, 0);
  const completedTaskCount = tasks.filter((task) => task.status === 'done').length;
  const openTaskCount = Math.max(taskCount - completedTaskCount, 0);
  const totalMemberCount = getUniqueMemberCount(projects);
  const activeProjectTasks = tasks.filter((task) => getDocumentId(task.project) === activeProject.id || task.project === activeProject.id);
  const recentActivity = getRecentActivity(projects, tasks);
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
              <span>OPEN TASKS</span>
              <strong>{openTaskCount}</strong>
            </div>
            <div>
              <span>DONE</span>
              <strong>{completedTaskCount}</strong>
            </div>
            <div>
              <span>MEMBERS</span>
              <strong>{totalMemberCount}</strong>
            </div>
          </div>
          <div className="tf-dashboard-strip">
            <div>
              <span>Active project tasks</span>
              <strong>{activeProjectTasks.length}</strong>
            </div>
            <div>
              <span>Invites sent</span>
              <strong>{invitations.length}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="tf-dashboard-grid">
        <article className="tf-panel">
          <div className="tf-panel-head">
            <h2>Workspace metrics</h2>
            <span>{toast}</span>
          </div>
          <div className="tf-metric-grid">
            <div>
              <span>Total tasks</span>
              <strong>{taskCount}</strong>
              <p>{completedTaskCount} completed</p>
            </div>
            <div>
              <span>Team members</span>
              <strong>{totalMemberCount}</strong>
              <p>Across {projects.length} projects</p>
            </div>
            <div>
              <span>Completion</span>
              <strong>{taskCount ? Math.round((completedTaskCount / taskCount) * 100) : 0}%</strong>
              <p>{openTaskCount} still open</p>
            </div>
          </div>
        </article>

        <article className="tf-panel">
          <div className="tf-panel-head">
            <h2>Recent activity</h2>
            <span>{recentActivity.length}</span>
          </div>
          <div className="tf-activity-list">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div className="tf-activity" key={activity.id}>
                  <span>{activity.label}</span>
                  <strong>{activity.title}</strong>
                  <p>{activity.meta} / {formatActivityDate(activity.date)}</p>
                </div>
              ))
            ) : (
              <div className="tf-activity">
                <span>No activity yet</span>
                <strong>Create a project or task</strong>
                <p>Your dashboard will update here.</p>
              </div>
            )}
          </div>
        </article>
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
          <NotificationsPanel notifications={notifications} />
        </aside>

        <Board columns={columns} moveTaskToColumn={moveTaskToColumn} onNewTask={() => setPanel('task')} />
      </section>

      <section className="tf-features">
        {features.map((feature) => (
          <span key={feature}>{feature}</span>
        ))}
      </section>

      {panel === 'task' && (
        <TaskModal activeProject={activeProject} onClose={() => setPanel(null)} onSubmit={async (payload) => {
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
        <TaskModal activeProject={activeProject} onClose={() => setPanel(null)} onSubmit={async (payload) => {
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
      {task.assignee && <span>Assigned to {task.assignee.name}</span>}
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

function NotificationsPanel({ notifications }) {
  return (
    <div className="tf-panel">
      <div className="tf-panel-head">
        <h2>Notifications</h2>
        <span>{notifications.length}</span>
      </div>
      <div className="tf-invite-list">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <article className="tf-invite" key={getDocumentId(notification)}>
              <strong>{notification.type === 'task_assigned' ? 'Task assigned' : 'Notification'}</strong>
              <span>{notification.actor?.name || 'TeamFlow'}</span>
              <p>{notification.message}</p>
            </article>
          ))
        ) : (
          <article className="tf-invite">
            <strong>No notifications</strong>
            <p>Assigned tasks will appear here.</p>
          </article>
        )}
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

function TaskModal({ activeProject, onClose, onSubmit }) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const assignableMembers = (activeProject?.team || []).filter((member) => member.userId);

  return (
    <Modal>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const title = String(formData.get('title') || '').trim();
          const assignedTo = String(formData.get('assignedTo') || '').trim();

          if (title) {
            setIsSubmitting(true);
            await onSubmit({ assignedTo, title });
            setIsSubmitting(false);
          }
        }}
      >
        <h2>Add task</h2>
        <Field label="Task title" name="title" placeholder="Create task" />
        <label className="tf-field">
          Assign to
          <select name="assignedTo" defaultValue="">
            <option value="">Unassigned</option>
            {assignableMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
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

function Field({ autoComplete, defaultValue, disabled = false, label, name, placeholder, type = 'text' }) {
  return (
    <label className="tf-field">
      {label}
      <input
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        placeholder={placeholder}
        type={type}
      />
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

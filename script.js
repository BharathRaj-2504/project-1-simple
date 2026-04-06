/**
 * script.js — TaskFlow To-Do List
 *
 * Two-page SPA:
 *   Page 1 (page-list)  → Task list, stats, filters, sort
 *   Page 2 (page-add)   → Add / Edit task form
 *
 * Features:
 *  - Navigate between list view and add/edit-task view
 *  - Add tasks with name, date, and time
 *  - Edit existing tasks (pre-fills the form)
 *  - Mark tasks as completed (strike-through effect)
 *  - Delete tasks with slide-out animation
 *  - Persist tasks in localStorage
 *  - Sort tasks by date/time or creation order
 *  - Filter tasks: All | Pending | Completed | Overdue
 *  - Highlight overdue tasks automatically
 *  - Auto-refresh overdue status every minute
 */

'use strict';

/* ─────────────────────────────────────────
   1. DOM References
───────────────────────────────────────── */

// Pages
const pageList = document.getElementById('page-list');
const pageAdd  = document.getElementById('page-add');

// Navigation buttons
const goToAddBtn  = document.getElementById('go-to-add');
const goToListBtn = document.getElementById('go-to-list');
const cancelBtn   = document.getElementById('cancel-btn');

// Form elements
const taskNameInput  = document.getElementById('task-name');
const taskDateInput  = document.getElementById('task-date');
const taskTimeInput  = document.getElementById('task-time');
const addBtn         = document.getElementById('add-btn');
const errorMsg       = document.getElementById('error-msg');
const formPageTitle  = document.getElementById('form-page-title');
const submitBtnText  = document.getElementById('submit-btn-text');

// Task list area
const taskList   = document.getElementById('task-list');
const emptyState = document.getElementById('empty-state');

// Controls
const sortSelect = document.getElementById('sort-select');
const filterBtns = document.querySelectorAll('.filter-btn');

// Stats counters
const totalCount   = document.getElementById('total-count');
const pendingCount = document.getElementById('pending-count');
const doneCount    = document.getElementById('done-count');
const overdueCount = document.getElementById('overdue-count');

/* ─────────────────────────────────────────
   2. Application State
───────────────────────────────────────── */

let tasks         = [];     // Array of task objects
let currentFilter = 'all';  // Active filter tab
let editingTaskId = null;   // ID of task being edited (null = add mode)

/* ─────────────────────────────────────────
   3. Page Navigation
───────────────────────────────────────── */

/**
 * Show the Add Task page (fresh/empty form).
 */
function showAddPage() {
  editingTaskId = null;  // Clear any previous edit state

  // Set form to "Add" mode
  formPageTitle.textContent = 'New Task';
  submitBtnText.textContent = 'Save Task';

  // Clear inputs and pre-fill date
  taskNameInput.value = '';
  taskDateInput.value = '';
  taskTimeInput.value = '';
  setDefaultDate();
  clearError();

  // Switch pages with animation
  pageList.classList.add('page-hidden');
  pageAdd.classList.remove('page-hidden');
  pageAdd.style.animation = 'none';
  void pageAdd.offsetWidth;
  pageAdd.style.animation = '';

  taskNameInput.focus();
}

/**
 * Show the Edit Task page (pre-filled with existing task data).
 * @param {string} id - ID of the task to edit.
 */
function showEditPage(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  editingTaskId = id;  // Store which task we're editing

  // Set form to "Edit" mode
  formPageTitle.textContent = 'Edit Task';
  submitBtnText.textContent = 'Update Task';

  // Pre-fill the form with the task's current values
  taskNameInput.value = task.name;
  taskDateInput.value = task.date || '';
  taskTimeInput.value = task.time || '';
  clearError();

  // Switch pages with animation
  pageList.classList.add('page-hidden');
  pageAdd.classList.remove('page-hidden');
  pageAdd.style.animation = 'none';
  void pageAdd.offsetWidth;
  pageAdd.style.animation = '';

  taskNameInput.focus();
}

/**
 * Show the List page and reset the form state.
 */
function showListPage() {
  editingTaskId = null;  // Clear edit state

  pageAdd.classList.add('page-hidden');
  pageList.classList.remove('page-hidden');
  pageList.style.animation = 'none';
  void pageList.offsetWidth;
  pageList.style.animation = '';

  // Reset form
  taskNameInput.value = '';
  taskDateInput.value = '';
  taskTimeInput.value = '';
  clearError();

  renderTasks();
}

/* ─────────────────────────────────────────
   4. localStorage Helpers
───────────────────────────────────────── */

/** Load tasks from localStorage (returns empty array if nothing saved). */
function loadTasks() {
  try {
    const saved = localStorage.getItem('taskflow-tasks');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

/** Save the current tasks array to localStorage. */
function saveTasks() {
  localStorage.setItem('taskflow-tasks', JSON.stringify(tasks));
}

/* ─────────────────────────────────────────
   5. Utility Functions
───────────────────────────────────────── */

/** Generate a unique ID for each task. */
function generateId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Determine if a task is overdue.
 * Completed tasks and tasks without a date are never overdue.
 */
function isOverdue(task) {
  if (task.completed || !task.date) return false;
  const now = new Date();
  const deadlineStr = task.time
    ? `${task.date}T${task.time}:00`
    : `${task.date}T23:59:59`;
  return new Date(deadlineStr) < now;
}

/** Format a date string (YYYY-MM-DD) to a human-readable label. */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** Format a 24h time string (HH:MM) to 12-hour AM/PM. */
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period  = h >= 12 ? 'PM' : 'AM';
  const hour    = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

/** Pre-fill the date input with today's date. */
function setDefaultDate() {
  const today = new Date();
  const yyyy  = today.getFullYear();
  const mm    = String(today.getMonth() + 1).padStart(2, '0');
  const dd    = String(today.getDate()).padStart(2, '0');
  taskDateInput.value = `${yyyy}-${mm}-${dd}`;
}

/* ─────────────────────────────────────────
   6. Sorting
───────────────────────────────────────── */

/** Return a sorted copy of the tasks array. */
function sortTasks(list) {
  const mode = sortSelect.value;
  return [...list].sort((a, b) => {
    if (mode === 'datetime') {
      const maxDate = new Date(8640000000000000);
      const dtA = a.date ? new Date(`${a.date}T${a.time || '00:00'}`) : maxDate;
      const dtB = b.date ? new Date(`${b.date}T${b.time || '00:00'}`) : maxDate;
      return dtA - dtB;
    }
    if (mode === 'newest') return b.createdAt - a.createdAt;
    if (mode === 'oldest') return a.createdAt - b.createdAt;
    return 0;
  });
}

/* ─────────────────────────────────────────
   7. Filtering
───────────────────────────────────────── */

/** Filter tasks based on the active filter tab. */
function filterTasks(list) {
  switch (currentFilter) {
    case 'pending':   return list.filter(t => !t.completed && !isOverdue(t));
    case 'completed': return list.filter(t => t.completed);
    case 'overdue':   return list.filter(t => isOverdue(t));
    default:          return list;
  }
}

/* ─────────────────────────────────────────
   8. Stats Update
───────────────────────────────────────── */

/** Recalculate and update the stats counters. */
function updateStats() {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.completed).length;
  const overdue = tasks.filter(t => isOverdue(t)).length;
  const pending = total - done - overdue;

  totalCount.textContent   = total;
  pendingCount.textContent = Math.max(pending, 0);
  doneCount.textContent    = done;
  overdueCount.textContent = overdue;
}

/* ─────────────────────────────────────────
   9. Render Tasks
───────────────────────────────────────── */

/** Clear and re-render the task list. */
function renderTasks() {
  taskList.innerHTML = '';

  const sorted   = sortTasks(tasks);
  const filtered = filterTasks(sorted);

  // Toggle empty state
  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
  }

  // Build a card for each visible task
  filtered.forEach((task, index) => {
    const li = createTaskElement(task);
    li.style.animationDelay = `${index * 0.05}s`;
    taskList.appendChild(li);
  });

  updateStats();
}

/**
 * Build and return a <li> element for a single task.
 * @param {Object} task
 * @returns {HTMLLIElement}
 */
function createTaskElement(task) {
  const overdue   = isOverdue(task);
  const completed = task.completed;

  // ── Card wrapper ──
  const li = document.createElement('li');
  li.className = `task-item${completed ? ' completed' : ''}${overdue ? ' overdue' : ''}`;
  li.dataset.id = task.id;

  // ── Circular checkbox ──
  const checkBtn = document.createElement('button');
  checkBtn.className = `task-check${completed ? ' checked' : ''}`;
  checkBtn.setAttribute('aria-label', completed ? 'Mark as incomplete' : 'Mark as complete');
  checkBtn.setAttribute('title', completed ? 'Mark as incomplete' : 'Mark as complete');
  checkBtn.addEventListener('click', () => toggleTask(task.id));

  // ── Task body ──
  const body = document.createElement('div');
  body.className = 'task-body';

  const nameEl = document.createElement('p');
  nameEl.className = 'task-name';
  nameEl.textContent = task.name;

  const metaEl = document.createElement('div');
  metaEl.className = 'task-meta';

  if (task.date) {
    const dateBadge = document.createElement('span');
    dateBadge.className = 'meta-tag';
    dateBadge.innerHTML = `<span class="meta-icon">📅</span> ${formatDate(task.date)}`;
    metaEl.appendChild(dateBadge);
  }

  if (task.time) {
    const timeBadge = document.createElement('span');
    timeBadge.className = 'meta-tag';
    timeBadge.innerHTML = `<span class="meta-icon">🕐</span> ${formatTime(task.time)}`;
    metaEl.appendChild(timeBadge);
  }

  if (overdue) {
    const overdueBadge = document.createElement('span');
    overdueBadge.className = 'overdue-badge';
    overdueBadge.textContent = '⚠ Overdue';
    metaEl.appendChild(overdueBadge);
  }

  body.appendChild(nameEl);
  body.appendChild(metaEl);

  // ── Action buttons: toggle, edit, delete ──
  const actionsEl = document.createElement('div');
  actionsEl.className = 'task-actions';

  // Toggle complete
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'btn-action btn-toggle';
  toggleBtn.innerHTML = completed ? '↩' : '✓';
  toggleBtn.setAttribute('aria-label', completed ? 'Undo completion' : 'Complete task');
  toggleBtn.setAttribute('title', completed ? 'Undo completion' : 'Complete task');
  toggleBtn.addEventListener('click', () => toggleTask(task.id));

  // Edit button
  const editBtn = document.createElement('button');
  editBtn.className = 'btn-action btn-edit';
  editBtn.innerHTML = '✏️';
  editBtn.setAttribute('aria-label', 'Edit task');
  editBtn.setAttribute('title', 'Edit task');
  editBtn.addEventListener('click', () => showEditPage(task.id));

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-action btn-delete';
  deleteBtn.innerHTML = '🗑';
  deleteBtn.setAttribute('aria-label', 'Delete task');
  deleteBtn.setAttribute('title', 'Delete task');
  deleteBtn.addEventListener('click', () => deleteTask(task.id));

  actionsEl.appendChild(toggleBtn);
  actionsEl.appendChild(editBtn);
  actionsEl.appendChild(deleteBtn);

  // ── Assemble ──
  li.appendChild(checkBtn);
  li.appendChild(body);
  li.appendChild(actionsEl);

  return li;
}

/* ─────────────────────────────────────────
   10. Task Actions (Add / Update / Toggle / Delete)
───────────────────────────────────────── */

/**
 * Handle the Save/Update button click.
 * If editingTaskId is set → update that task.
 * Otherwise → create a new task.
 */
function saveTask() {
  const name = taskNameInput.value.trim();
  const date = taskDateInput.value;
  const time = taskTimeInput.value;

  // ── Validation ──
  if (!name) {
    showError('⚠ Please enter a task name.');
    taskNameInput.focus();
    return;
  }

  clearError();

  if (editingTaskId) {
    // ── UPDATE existing task ──
    tasks = tasks.map(task => {
      if (task.id === editingTaskId) {
        return { ...task, name, date, time };
      }
      return task;
    });
  } else {
    // ── ADD new task ──
    const newTask = {
      id:        generateId(),
      name,
      date,
      time,
      completed: false,
      createdAt: Date.now(),
    };
    tasks.unshift(newTask);
  }

  saveTasks();
  showListPage();   // Navigate back to the list
}

/** Toggle a task's completed status. */
function toggleTask(id) {
  tasks = tasks.map(task =>
    task.id === id ? { ...task, completed: !task.completed } : task
  );
  saveTasks();
  renderTasks();
}

/** Delete a task with a slide-out animation. */
function deleteTask(id) {
  const li = taskList.querySelector(`[data-id="${id}"]`);

  if (li) {
    li.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    li.style.opacity    = '0';
    li.style.transform  = 'translateX(40px) scale(0.95)';

    setTimeout(() => {
      tasks = tasks.filter(task => task.id !== id);
      saveTasks();
      renderTasks();
    }, 250);
  } else {
    tasks = tasks.filter(task => task.id !== id);
    saveTasks();
    renderTasks();
  }
}

/* ─────────────────────────────────────────
   11. Error Messaging
───────────────────────────────────────── */

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('visible');
}

function clearError() {
  errorMsg.textContent = '';
  errorMsg.classList.remove('visible');
}

/* ─────────────────────────────────────────
   12. Event Listeners
───────────────────────────────────────── */

// ── Navigation ──
goToAddBtn.addEventListener('click', showAddPage);
goToListBtn.addEventListener('click', showListPage);
cancelBtn.addEventListener('click', showListPage);

// ── Form submission ──
addBtn.addEventListener('click', saveTask);

taskNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveTask();
});

taskNameInput.addEventListener('input', clearError);

// ── Sort & Filter ──
sortSelect.addEventListener('change', renderTasks);

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

/* ─────────────────────────────────────────
   13. Auto-refresh Overdue Status
───────────────────────────────────────── */

setInterval(renderTasks, 60_000);

/* ─────────────────────────────────────────
   14. Initialise Application
───────────────────────────────────────── */

(function init() {
  tasks = loadTasks();
  renderTasks();
})();
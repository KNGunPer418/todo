'use strict';

(() => {
  const STORAGE_KEY = 'todo-app.v1';
  const FILTER_KEY = 'todo-app.filter';

  /** @type {{id: string, title: string, completed: boolean, due: string, createdAt: number}[]} */
  let todos = load(STORAGE_KEY, []);
  let filter = load(FILTER_KEY, 'all');

  const $ = (sel) => document.querySelector(sel);
  const form = $('#new-todo-form');
  const titleInput = $('#new-todo-title');
  const dueInput = $('#new-todo-due');
  const list = $('#todo-list');
  const empty = $('#empty');
  const toggleAll = $('#toggle-all');
  const count = $('#count');
  const summary = $('#summary');
  const clearCompleted = $('#clear-completed');
  const template = $('#todo-item-template');
  const filterButtons = document.querySelectorAll('.filters button');

  // ---- storage ----
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
      localStorage.setItem(FILTER_KEY, JSON.stringify(filter));
    } catch {
      // ストレージが使えない環境ではメモリ上のみで動作
    }
  }

  // ---- helpers ----
  const newId = () =>
    (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  function todayStr() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatDue(due) {
    if (!due) return '';
    const today = todayStr();
    const [y, m, d] = due.split('-').map(Number);
    const label = `${m}/${d}`;
    if (due === today) return `期限: 今日 (${label})`;
    if (due < today) return `期限切れ: ${y}/${label}`;
    return `期限: ${y}/${label}`;
  }

  function visibleTodos() {
    if (filter === 'active') return todos.filter((t) => !t.completed);
    if (filter === 'completed') return todos.filter((t) => t.completed);
    return todos;
  }

  // ---- render ----
  function render() {
    const today = todayStr();
    const items = visibleTodos();
    list.replaceChildren(
      ...items.map((todo) => {
        const li = template.content.firstElementChild.cloneNode(true);
        li.dataset.id = todo.id;
        li.classList.toggle('is-completed', todo.completed);
        li.classList.toggle('is-overdue', !!todo.due && todo.due < today);
        li.classList.toggle('is-today', todo.due === today);
        li.querySelector('.todo-check').checked = todo.completed;
        li.querySelector('.todo-title').textContent = todo.title;
        li.querySelector('.todo-due').textContent = formatDue(todo.due);
        return li;
      })
    );

    const remaining = todos.filter((t) => !t.completed).length;
    const done = todos.length - remaining;

    empty.hidden = items.length > 0;
    empty.textContent =
      todos.length === 0 ? 'TODOはありません' : filter === 'active' ? '未完了のTODOはありません' : '完了済みのTODOはありません';

    count.textContent = `残り ${remaining} 件`;
    summary.textContent = todos.length ? `${done} / ${todos.length} 完了` : '';
    clearCompleted.hidden = done === 0;
    toggleAll.checked = todos.length > 0 && remaining === 0;
    toggleAll.disabled = todos.length === 0;

    filterButtons.forEach((b) => b.classList.toggle('is-active', b.dataset.filter === filter));
  }

  function commit() {
    save();
    render();
  }

  // ---- actions ----
  function addTodo(title, due) {
    todos.push({ id: newId(), title, completed: false, due: due || '', createdAt: Date.now() });
    commit();
  }

  function updateTodo(id, patch) {
    todos = todos.map((t) => (t.id === id ? { ...t, ...patch } : t));
    commit();
  }

  function removeTodo(id) {
    todos = todos.filter((t) => t.id !== id);
    commit();
  }

  function startEdit(li) {
    const id = li.dataset.id;
    const todo = todos.find((t) => t.id === id);
    if (!todo || li.querySelector('.todo-edit')) return;

    const titleEl = li.querySelector('.todo-title');
    const input = document.createElement('input');
    input.className = 'todo-edit';
    input.type = 'text';
    input.maxLength = 200;
    input.value = todo.title;
    input.setAttribute('aria-label', 'TODOを編集');
    titleEl.replaceWith(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    let finished = false;
    const finish = (keep) => {
      if (finished) return;
      finished = true;
      const value = input.value.trim();
      if (!keep) return render();
      if (value === '') return removeTodo(id);
      updateTodo(id, { title: value });
    };

    input.addEventListener('keydown', (e) => {
      if (e.isComposing) return; // 日本語変換中の Enter は無視
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
  }

  // ---- events ----
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;
    addTodo(title, dueInput.value);
    titleInput.value = '';
    dueInput.value = '';
    titleInput.focus();
  });

  list.addEventListener('change', (e) => {
    if (!e.target.classList.contains('todo-check')) return;
    const li = e.target.closest('.todo-item');
    updateTodo(li.dataset.id, { completed: e.target.checked });
  });

  list.addEventListener('click', (e) => {
    if (!e.target.classList.contains('todo-delete')) return;
    removeTodo(e.target.closest('.todo-item').dataset.id);
  });

  list.addEventListener('dblclick', (e) => {
    if (!e.target.classList.contains('todo-title')) return;
    startEdit(e.target.closest('.todo-item'));
  });

  toggleAll.addEventListener('change', () => {
    const completed = toggleAll.checked;
    todos = todos.map((t) => ({ ...t, completed }));
    commit();
  });

  clearCompleted.addEventListener('click', () => {
    todos = todos.filter((t) => !t.completed);
    commit();
  });

  filterButtons.forEach((btn) =>
    btn.addEventListener('click', () => {
      filter = btn.dataset.filter;
      commit();
    })
  );

  // 他のタブでの変更を反映
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      todos = load(STORAGE_KEY, []);
      render();
    }
  });

  if (!['all', 'active', 'completed'].includes(filter)) filter = 'all';
  if (!Array.isArray(todos)) todos = [];
  render();
})();

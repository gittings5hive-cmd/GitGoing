const STORAGE_KEY = 'gitgoing-tasks';

let tasks = [];
let activeFilter = 'all';
let priorityFilter = 'all';
let searchQuery = '';

// Track which task a file-input click targets
let attachTargetId = null;
// Count active drag-enter events to handle nested elements
let dragDepth = 0;

function loadTasks() {
    try {
        tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        tasks = [];
    }
}

function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function createId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function addTask() {
    const titleInput = document.getElementById('task-input');
    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }

    const task = {
        id: createId(),
        title,
        priority: document.getElementById('task-priority').value,
        due: document.getElementById('task-due').value,
        tag: document.getElementById('task-tag').value.trim(),
        done: false,
        createdAt: Date.now(),
        images: [],
    };

    tasks.unshift(task);
    saveTasks();

    titleInput.value = '';
    document.getElementById('task-tag').value = '';
    document.getElementById('task-due').value = '';
    document.getElementById('task-priority').value = 'medium';
    titleInput.focus();
    render();
}

function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) { task.done = !task.done; saveTasks(); render(); }
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    render();
}

function clearDone() {
    tasks = tasks.filter(t => !t.done);
    saveTasks();
    render();
}

function formatDue(dateStr) {
    if (!dateStr) {return null;}
    const [y, m, d] = dateStr.split('-').map(Number);
    const due = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = due < today;
    const label = due.toLocaleDateString(undefined, {
        month: 'short', day: 'numeric',
        year: due.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
    return { label, overdue };
}

function filteredTasks() {
    return tasks.filter(task => {
        if (activeFilter === 'active' && task.done) {return false;}
        if (activeFilter === 'done' && !task.done) {return false;}
        if (priorityFilter !== 'all' && task.priority !== priorityFilter) {return false;}
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!task.title.toLowerCase().includes(q) &&
                !(task.tag && task.tag.toLowerCase().includes(q))) {return false;}
        }
        return true;
    });
}

// ── Image handling ──────────────────────────────────────────────────────────

const MAX_DIM = 1400;
const MAX_FILE_MB = 10;

function resizeAndStore(id, file) {
    if (!file.type.startsWith('image/')) {
        alert('Only image files can be attached.');
        return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
        alert(`Image must be under ${MAX_FILE_MB} MB.`);
        return;
    }
    const task = tasks.find(t => t.id === id);
    if (!task) {return;}

    const reader = new FileReader();
    reader.onload = e => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            if (!task.images) {task.images = [];}
            task.images.push(dataUrl);
            saveTasks();
            render();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removeImage(taskId, imgIndex) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.images) {return;}
    task.images.splice(imgIndex, 1);
    saveTasks();
    render();
}

// ── Lightbox ────────────────────────────────────────────────────────────────

function openLightbox(src) {
    const lb = document.getElementById('lightbox');
    document.getElementById('lightbox-img').src = src;
    lb.classList.remove('hidden');
    lb.focus();
}

function closeLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
    document.getElementById('lightbox-img').src = '';
}

// ── Render ──────────────────────────────────────────────────────────────────

function render() {
    const list = document.getElementById('task-list');
    const emptyState = document.getElementById('empty-state');
    const visible = filteredTasks();
    list.innerHTML = '';

    visible.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item priority-${task.priority}${task.done ? ' done' : ''}`;
        li.dataset.id = task.id;

        // Per-task drag-and-drop
        li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('drag-over'); });
        li.addEventListener('dragleave', e => { if (!li.contains(e.relatedTarget)) {li.classList.remove('drag-over');} });
        li.addEventListener('drop', e => {
            e.preventDefault();
            e.stopPropagation();
            li.classList.remove('drag-over');
            hideDragOverlay();
            const file = e.dataTransfer.files[0];
            if (file) {resizeAndStore(task.id, file);}
        });

        // Checkbox
        const checkbox = document.createElement('div');
        checkbox.className = 'task-checkbox';
        checkbox.setAttribute('role', 'checkbox');
        checkbox.setAttribute('aria-checked', task.done ? 'true' : 'false');
        checkbox.setAttribute('tabindex', '0');
        checkbox.addEventListener('click', () => toggleTask(task.id));
        checkbox.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') {toggleTask(task.id);} });

        // Body
        const body = document.createElement('div');
        body.className = 'task-body';

        const titleEl = document.createElement('div');
        titleEl.className = 'task-title';
        titleEl.textContent = task.title;

        const meta = document.createElement('div');
        meta.className = 'task-meta';

        const priBadge = document.createElement('span');
        priBadge.className = `badge badge-${task.priority}`;
        priBadge.textContent = task.priority;
        meta.appendChild(priBadge);

        if (task.due) {
            const dueMeta = formatDue(task.due);
            const dueBadge = document.createElement('span');
            dueBadge.className = `badge badge-due${dueMeta.overdue && !task.done ? ' overdue' : ''}`;
            dueBadge.textContent = dueMeta.label;
            meta.appendChild(dueBadge);
        }

        if (task.tag) {
            const tagBadge = document.createElement('span');
            tagBadge.className = 'badge badge-tag';
            tagBadge.textContent = task.tag;
            meta.appendChild(tagBadge);
        }

        body.appendChild(titleEl);
        body.appendChild(meta);

        // Image thumbnails
        const images = task.images || [];
        if (images.length > 0) {
            const thumbRow = document.createElement('div');
            thumbRow.className = 'thumb-row';
            images.forEach((src, idx) => {
                const wrap = document.createElement('div');
                wrap.className = 'thumb-wrap';

                const img = document.createElement('img');
                img.className = 'thumb-img';
                img.src = src;
                img.alt = `Attachment ${idx + 1}`;
                img.addEventListener('click', () => openLightbox(src));

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'thumb-remove';
                removeBtn.setAttribute('aria-label', 'Remove image');
                removeBtn.textContent = '✕';
                removeBtn.addEventListener('click', e => { e.stopPropagation(); removeImage(task.id, idx); });

                wrap.appendChild(img);
                wrap.appendChild(removeBtn);
                thumbRow.appendChild(wrap);
            });
            body.appendChild(thumbRow);
        }

        // Attach drop-zone hint (shown when no images, or always as add-more)
        const attachZone = document.createElement('div');
        attachZone.className = `attach-zone${images.length > 0 ? ' attach-zone--more' : ''}`;
        attachZone.setAttribute('role', 'button');
        attachZone.setAttribute('tabindex', '0');
        attachZone.setAttribute('aria-label', 'Attach image');
        attachZone.innerHTML = images.length === 0
            ? '<span class="attach-icon">📎</span><span class="attach-label">Attach image · click or drag here</span>'
            : '<span class="attach-icon">+</span>';
        attachZone.addEventListener('click', () => triggerFileInput(task.id));
        attachZone.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') {triggerFileInput(task.id);} });
        // Also accept drops directly on the zone
        attachZone.addEventListener('dragover', e => e.preventDefault());
        attachZone.addEventListener('drop', e => {
            e.preventDefault();
            e.stopPropagation();
            li.classList.remove('drag-over');
            hideDragOverlay();
            const file = e.dataTransfer.files[0];
            if (file) {resizeAndStore(task.id, file);}
        });
        body.appendChild(attachZone);

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'task-delete';
        delBtn.setAttribute('aria-label', 'Delete task');
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', () => deleteTask(task.id));

        li.appendChild(checkbox);
        li.appendChild(body);
        li.appendChild(delBtn);
        list.appendChild(li);
    });

    emptyState.classList.toggle('hidden', visible.length > 0);

    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-active').textContent = total - done;
    document.getElementById('stat-done').textContent = done;
}

// ── File input trigger ──────────────────────────────────────────────────────

function triggerFileInput(id) {
    attachTargetId = id;
    document.getElementById('file-input').click();
}

// ── Global drag-over overlay ────────────────────────────────────────────────

function showDragOverlay() {
    document.getElementById('drag-overlay').classList.remove('hidden');
}

function hideDragOverlay() {
    dragDepth = 0;
    document.getElementById('drag-overlay').classList.add('hidden');
    document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
}

// ── DOMContentLoaded ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    render();

    document.getElementById('add-task-btn').addEventListener('click', addTask);
    document.getElementById('task-input').addEventListener('keydown', e => { if (e.key === 'Enter') {addTask();} });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            render();
        });
    });

    document.getElementById('priority-filter').addEventListener('change', e => { priorityFilter = e.target.value; render(); });
    document.getElementById('search-input').addEventListener('input', e => { searchQuery = e.target.value; render(); });
    document.getElementById('clear-done-btn').addEventListener('click', clearDone);

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.getAttribute('aria-controls')));
    });

    // Hidden file input
    const fileInput = document.getElementById('file-input');
    fileInput.addEventListener('change', () => {
        if (fileInput.files[0] && attachTargetId) {resizeAndStore(attachTargetId, fileInput.files[0]);}
        fileInput.value = '';
        attachTargetId = null;
    });

    // Lightbox
    document.getElementById('lightbox').addEventListener('click', closeLightbox);
    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);

    document.addEventListener('keydown', e => { if (e.key === 'Escape') {closeLightbox();} });

    // Global drag-into-window overlay
    document.addEventListener('dragenter', e => {
        if (!e.dataTransfer.types.includes('Files')) {return;}
        dragDepth++;
        showDragOverlay();
    });
    document.addEventListener('dragleave', () => {
        dragDepth--;
        if (dragDepth <= 0) {hideDragOverlay();}
    });
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
        e.preventDefault();
        hideDragOverlay();
    });
});

// ── Tabs ─────────────────────────────────────────────────────────────────────

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function switchTab(panelId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const active = btn.getAttribute('aria-controls') === panelId;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('hidden', panel.id !== panelId);
    });
    if (panelId === 'tab-summary') {renderSummary();}
}

function renderSummary() {
    const open = tasks
        .filter(t => !t.done)
        .sort((a, b) => {
            const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
            if (pd !== 0) {return pd;}
            if (!a.due && !b.due) {return 0;}
            if (!a.due) {return 1;}
            if (!b.due) {return -1;}
            return a.due.localeCompare(b.due);
        });

    const tbody = document.getElementById('summary-tbody');
    const empty = document.getElementById('summary-empty');
    const table = document.getElementById('summary-table');
    tbody.innerHTML = '';

    if (open.length === 0) {
        table.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
    }

    table.classList.remove('hidden');
    empty.classList.add('hidden');

    open.forEach((task, i) => {
        const tr = document.createElement('tr');

        const tdNum = document.createElement('td');
        tdNum.className = 'tbl-num';
        tdNum.textContent = i + 1;

        const tdTitle = document.createElement('td');
        tdTitle.textContent = task.title;

        const tdPri = document.createElement('td');
        const priBadge = document.createElement('span');
        priBadge.className = `tbl-pri tbl-pri-${task.priority}`;
        priBadge.textContent = task.priority;
        tdPri.appendChild(priBadge);

        const tdDue = document.createElement('td');
        tdDue.className = 'tbl-due';
        if (task.due) {
            const dueMeta = formatDue(task.due);
            tdDue.textContent = dueMeta.label;
            if (dueMeta.overdue) {tdDue.classList.add('overdue');}
        } else {
            tdDue.textContent = '—';
            tdDue.style.color = '#ccc';
        }

        const tdTag = document.createElement('td');
        tdTag.className = 'tbl-tag';
        tdTag.textContent = task.tag || '—';
        if (!task.tag) {tdTag.style.color = '#ccc';}

        tr.append(tdNum, tdTitle, tdPri, tdDue, tdTag);
        tbody.appendChild(tr);
    });
}

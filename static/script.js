document.addEventListener('DOMContentLoaded', () => {
    const sqlInput = document.getElementById('sqlInput');
    const runBtn = document.getElementById('runBtn');
    const clearBtn = document.getElementById('clearBtn');
    const resultsContainer = document.querySelector('.table-container');
    const statusText = document.getElementById('statusText');
    const historyList = document.getElementById('historyList');
    const errorToast = document.getElementById('errorToast');

    // --- API Service Wrapper ---
    const API = {
        async getHistory() {
            const res = await fetch('/api/history');
            return await res.json();
        },
        async addHistory(sql) {
            await fetch('/api/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql })
            });
        },
        async deleteHistory(id) {
            await fetch(`/api/history/${id}`, { method: 'DELETE' });
        },
        async getQuickAccess() {
            const res = await fetch('/api/quick_access');
            return await res.json();
        },
        async addQuickAccess(name, sql) {
            const res = await fetch('/api/quick_access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, sql })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to save');
            }
        },
        async deleteQuickAccess(id) {
            await fetch(`/api/quick_access/${id}`, { method: 'DELETE' });
        },
        async updateQuickAccess(id, name, sql) {
            const res = await fetch(`/api/quick_access/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, sql })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update');
            }
        },
        async reorderQuickAccess(ids) {
            await fetch('/api/quick_access/reorder', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
        }
    };

    // Initialize Data
    loadHistory();
    loadQuickAccess();

    // --- Collapsible History Logic ---
    const historyHeader = document.getElementById('historyHeader');

    // Load state
    const isHistoryCollapsed = localStorage.getItem('rcsl_history_collapsed') === 'true';
    if (isHistoryCollapsed) {
        historyList.classList.add('collapsed');
        historyHeader.classList.add('collapsed');
    }

    historyHeader.addEventListener('click', () => {
        const isCollapsed = historyList.classList.toggle('collapsed');
        historyHeader.classList.toggle('collapsed', isCollapsed);
        localStorage.setItem('rcsl_history_collapsed', isCollapsed);
    });

    // Check for migration
    checkAndMigrateData();

    // Event Listeners
    runBtn.addEventListener('click', executeQuery);

    // Ctrl+Enter to run
    sqlInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            executeQuery();
        }
    });

    clearBtn.addEventListener('click', () => {
        sqlInput.value = '';
        sqlInput.focus();
    });

    // --- Main Logic ---

    function executeQuery() {
        const sql = sqlInput.value.trim();
        if (!sql) return;

        // UI Loading State
        setLoading(true);
        resultsContainer.innerHTML = '';
        statusText.textContent = 'Running query...';

        // Store current SQL for editable grid detection
        currentQuerySQL = sql;

        fetch('/api/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql })
        })
            .then(response => response.json())
            .then(async data => {
                setLoading(false);

                if (data.error) {
                    showError(data.error);
                    statusText.textContent = 'Error executing query';
                } else {
                    renderTable(data.data);

                    // Add to backend history
                    await API.addHistory(sql);
                    loadHistory(); // Reload list

                    statusText.textContent = `Query executed successfully.`;
                }
            })
            .catch(err => {
                setLoading(false);
                showError('Network error or server unavailable.');
                console.error(err);
            });
    }

    // --- Rendering ---

    // State for editable grid
    let currentTableName = null;
    let currentQuerySQL = null;

    function renderTable(data) {
        if (!data || data.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <p>No results returned</p>
                </div>`;
            return;
        }

        // Check types
        if (typeof data === 'string') {
            resultsContainer.innerHTML = `<pre style="padding: 1rem;">${data}</pre>`;
            return;
        }

        if (!Array.isArray(data)) {
            resultsContainer.innerHTML = `<pre style="padding: 1rem;">${JSON.stringify(data, null, 2)}</pre>`;
            return;
        }

        // Check if editable
        const tableName = parseTableNameFromSQL(currentQuerySQL);
        // Case-insensitive ID check
        const idColumn = data.length > 0 ? Object.keys(data[0]).find(k => k.toLowerCase() === 'id') : null;
        const hasIdColumn = !!idColumn;

        // Robust Implicit Join Check
        // Extract content between FROM and next keyword or end of string
        const lowerSQL = currentQuerySQL.toLowerCase();
        const fromClauseMatch = currentQuerySQL.match(/FROM\s+([\s\S]+?)(?:\s+(?:WHERE|GROUP|ORDER|LIMIT|HAVING|WINDOW|UNION)|$|;)/i);
        const fromContent = fromClauseMatch ? fromClauseMatch[1] : '';
        const isImplicitJoin = fromContent.includes(',');

        let readOnlyReason = null;
        if (!tableName) readOnlyReason = "Cannot parse table name";
        else if (!hasIdColumn) readOnlyReason = "No 'id' column";
        else if (lowerSQL.includes('join')) readOnlyReason = "JOIN detected";
        else if (isImplicitJoin) readOnlyReason = "Multiple tables detected";
        else if (lowerSQL.includes('group by')) readOnlyReason = "GROUP BY detected";

        const isEditable = !readOnlyReason;

        if (isEditable) {
            currentTableName = tableName;
            renderEditableTable(data, tableName, idColumn);
        } else {
            currentTableName = null;
            renderReadOnlyTable(data, readOnlyReason);
        }
    }

    function renderReadOnlyTable(data, reason) {
        // Toolbar for Read Only explanation
        if (reason) {
            const toolbar = document.createElement('div');
            toolbar.className = 'editable-toolbar';
            toolbar.style.background = 'rgba(255, 255, 255, 0.05)';
            toolbar.style.borderColor = 'var(--border)';
            toolbar.innerHTML = `
                <span class="edit-mode-badge" style="color: var(--text-secondary)">
                    🔒 Read Only (${reason})
                </span>
                <span style="margin-left:auto; font-size:0.8rem; color:var(--text-secondary);">Double-click row for details</span>
            `;
            resultsContainer.appendChild(toolbar);
        }

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        // Headers
        const headers = Object.keys(data[0]);
        const headerRow = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // Body
        data.forEach(row => {
            const tr = document.createElement('tr');

            // Double click to show details
            tr.addEventListener('dblclick', (e) => {
                if (e.target.isContentEditable || e.target.closest('.editable-cell') || e.target.closest('button')) return;
                showRowDetailModal(row);
            });

            headers.forEach(h => {
                const td = document.createElement('td');
                const val = row[h];
                td.textContent = (val === null) ? 'NULL' : val;
                td.title = (val === null) ? 'NULL' : val; // Tooltip for truncated text
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        resultsContainer.appendChild(table);
    }

    function renderEditableTable(data, tableName, idColumnName) {
        const headers = Object.keys(data[0]);

        // Create toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'editable-toolbar';
        toolbar.innerHTML = `
            <span class="edit-mode-badge">✏️ Edit Mode: ${escapeHtml(tableName)}</span>
            <button class="btn btn-primary btn-sm" id="addRowBtn" style="margin-left: auto;">+ Add Row</button>
        `;
        resultsContainer.appendChild(toolbar);

        const table = document.createElement('table');
        table.className = 'editable-table';
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        // Headers (Move Actions to Start)
        const headerRow = document.createElement('tr');

        // Actions Column First
        const actionTh = document.createElement('th');
        actionTh.textContent = 'Actions';
        actionTh.style.width = '80px';
        headerRow.appendChild(actionTh);

        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // Body
        data.forEach(row => {
            const tr = document.createElement('tr');
            const rowId = row[idColumnName]; // Use detected column name
            tr.dataset.id = rowId;

            // Double click to show details
            tr.addEventListener('dblclick', (e) => {
                if (e.target.isContentEditable || e.target.closest('.editable-cell') || e.target.closest('button')) return;
                showRowDetailModal(row);
            });

            // Actions Column First
            const actionTd = document.createElement('td');
            actionTd.style.display = 'flex';
            actionTd.style.gap = '4px';

            actionTd.innerHTML = `
                <button class="btn-icon btn-duplicate" title="Duplicate Row">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path>
                    </svg>
                </button>
                <button class="btn-icon btn-delete" title="Delete Row">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            `;

            // Duplicate Handler
            actionTd.querySelector('.btn-duplicate').addEventListener('click', (e) => {
                e.stopPropagation();
                showAddRowModal(tableName, headers, row); // Pass current row as defaults
            });

            // Delete Handler
            actionTd.querySelector('.btn-delete').addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent row double click
                handleRowDelete(rowId, tableName, idColumnName);
            });
            tr.appendChild(actionTd);

            headers.forEach(h => {
                const td = document.createElement('td');
                const val = row[h];
                td.textContent = (val === null) ? '' : val;
                td.dataset.column = h;
                td.dataset.originalValue = (val === null) ? '' : val;
                td.title = (val === null) ? '' : val; // Tooltip

                // Make non-id cells editable
                if (h.toLowerCase() !== 'id') {
                    td.contentEditable = true;
                    td.classList.add('editable-cell');

                    // Handle blur (save on focus out)
                    td.addEventListener('blur', () => handleCellEdit(td, rowId, h, tableName, idColumnName));

                    // Handle Enter key
                    td.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            td.blur();
                        }
                    });
                }
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        resultsContainer.appendChild(table);

        // Add Row button handler
        document.getElementById('addRowBtn').addEventListener('click', () => showAddRowModal(tableName, headers));
    }

    // ... existing parseTableNameFromSQL ...

    // ... existing handleCellEdit ...

    // ... existing handleRowDelete ...

    function showAddRowModal(tableName, headers) {
        // Filter out id (auto-generated) and created_at/log_time (default values)
        const editableColumns = headers.filter(h =>
            h !== 'id' && !h.includes('created_at') && !h.includes('log_time') && !h.includes('timestamp')
        );

        // Create modal content with Grid Layout
        let formHtml = `<div class="form-grid">`;
        formHtml += editableColumns.map(col => `
            <div class="form-group">
                <label>${col}</label>
                <input type="text" data-column="${col}" placeholder="Enter ${col}">
            </div>
        `).join('');
        formHtml += `</div>`;

        // Reuse existing modal structure
        const modal = document.getElementById('quickAccessModal');
        modal.querySelector('.modal-header h3').textContent = `Add New Row to ${tableName} `;
        modal.querySelector('.modal-body').innerHTML = formHtml;

        // Auto focus first input
        setTimeout(() => {
            const firstInput = modal.querySelector('input');
            if (firstInput) firstInput.focus();
        }, 100);

        // Setup Insert Handler
        setupModalButton(async () => {
            const inputs = modal.querySelectorAll('.modal-body input');
            const values = {};
            inputs.forEach(input => {
                values[input.dataset.column] = input.value.trim();
            });

            await handleRowInsert(tableName, values);
            showModal(false);

            // Refresh the table
            executeQuery();
        });

        document.getElementById('saveQuickAccessBtn').textContent = 'Insert';
        showModal(true);
    }

    function showRowDetailModal(row) {
        const modal = document.getElementById('quickAccessModal');
        modal.querySelector('.modal-header h3').textContent = `Row Details`;

        let html = `<div class="detail-view-list">`;
        for (const [key, value] of Object.entries(row)) {
            html += `
                <div class="detail-item">
                    <span class="detail-key">${escapeHtml(key)}</span>
                    <span class="detail-value">${(value === null) ? '<span style="color:var(--text-secondary); font-style:italic;">NULL</span>' : escapeHtml(String(value))}</span>
                </div>
             `;
        }
        html += `</div>`;

        modal.querySelector('.modal-body').innerHTML = html;

        // Hide footer button or change to "Close"
        const savedBtnText = document.getElementById('saveQuickAccessBtn').textContent;
        // We can just hide the footer button functionality by replacing it with a close action
        setupModalButton(() => showModal(false));
        document.getElementById('saveQuickAccessBtn').textContent = 'Close';

        showModal(true);
    }

    function parseTableNameFromSQL(sql) {
        if (!sql) return null;
        // Match: SELECT ... FROM table_name
        // Use [\s\S] instead of . to match newlines
        // Updated regex to include dots for schema.table support
        const match = sql.match(/SELECT[\s\S]+?FROM\s+[`]?([\w.-]+)[`]?/i);
        return match ? match[1] : null;
    }

    async function handleCellEdit(td, rowId, columnName, tableName, idColumnName) {
        const newValue = td.textContent.trim();
        const oldValue = td.dataset.originalValue;

        if (newValue === oldValue) return; // No change

        // Generate UPDATE SQL
        const escapedValue = newValue.replace(/'/g, "''"); // Escape single quotes
        // Treat empty string as NULL (better for varied column types)
        const sqlValue = newValue === '' ? 'NULL' : `'${escapedValue}'`;

        const updateSQL = `UPDATE ${tableName} SET ${columnName} = ${sqlValue} WHERE ${idColumnName} = ${rowId} `;

        try {
            td.classList.add('saving');
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: updateSQL })
            });
            const result = await response.json();

            if (result.error) {
                showError(result.error);
                td.textContent = oldValue; // Revert
            } else {
                td.dataset.originalValue = newValue; // Update original
                td.classList.add('saved');
                setTimeout(() => td.classList.remove('saved'), 1000);
                statusText.textContent = `Updated ${columnName} for id = ${rowId}`;
            }
        } catch (err) {
            showError('Failed to update: ' + err.message);
            td.textContent = oldValue; // Revert
        } finally {
            td.classList.remove('saving');
        }
    }

    async function handleRowDelete(rowId, tableName, idColumnName) {
        if (!confirm(`Are you sure you want to delete row with ${idColumnName} = ${rowId}?`)) return;

        const deleteSQL = `DELETE FROM ${tableName} WHERE ${idColumnName} = ${rowId} `;

        try {
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: deleteSQL })
            });
            const result = await response.json();

            if (result.error) {
                showError(result.error);
            } else {
                // Remove row from DOM
                const row = resultsContainer.querySelector(`tr[data-id="${rowId}"]`);
                if (row) row.remove();
                statusText.textContent = `Deleted row id=${rowId} from ${tableName}`;
            }
        } catch (err) {
            showError('Failed to delete: ' + err.message);
        }
    }

    function showAddRowModal(tableName, headers, defaultValues = {}) {
        // Filter out id (auto-generated) and created_at/log_time (default values)
        const editableColumns = headers.filter(h =>
            h.toLowerCase() !== 'id' && !h.includes('created_at') && !h.includes('log_time') && !h.includes('timestamp')
        );

        // Create modal content
        let formHtml = editableColumns.map(col => `
            <div class="form-group">
                <label>${col}</label>
                <input type="text" data-column="${col}" value="${escapeHtml(String(defaultValues[col] || ''))}" placeholder="Enter ${col}">
            </div>
        `).join('');

        // Reuse existing modal structure
        const modal = document.getElementById('quickAccessModal');
        const title = Object.keys(defaultValues).length > 0 ? `Duplicate Row in ${tableName}` : `Add New Row to ${tableName}`;
        modal.querySelector('.modal-header h3').textContent = title;
        modal.querySelector('.modal-body').innerHTML = formHtml;

        // Setup Insert Handler
        setupModalButton(async () => {
            const inputs = modal.querySelectorAll('.modal-body input');
            const values = {};
            inputs.forEach(input => {
                values[input.dataset.column] = input.value.trim();
            });

            // Allow empty fields (will be treated as NULL later if needed)

            await handleRowInsert(tableName, values);
            showModal(false);

            // Refresh the table
            executeQuery();
        });

        document.getElementById('saveQuickAccessBtn').textContent = 'Insert';
        showModal(true);
    }

    async function handleRowInsert(tableName, values) {
        const columns = Object.keys(values).join(', ');

        // Handle NULLs for empty strings
        const escapedValues = Object.values(values).map(v => {
            if (v === '') return 'NULL';
            return `'${v.replace(/'/g, "''")}'`;
        }).join(', ');

        const insertSQL = `INSERT INTO ${tableName} (${columns}) VALUES (${escapedValues})`;

        try {
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: insertSQL })
            });
            const result = await response.json();

            if (result.error) {
                showError(result.error);
            } else {
                statusText.textContent = `Inserted new row into ${tableName}`;
            }
        } catch (err) {
            showError('Failed to insert: ' + err.message);
        }
    }

    async function loadHistory() {
        try {
            const history = await API.getHistory();
            renderHistoryList(history);
        } catch (err) {
            console.error('Failed to load history', err);
        }
    }

    function renderHistoryList(history) {
        historyList.innerHTML = '';
        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-query">${escapeHtml(item.sql)}</div>
                <div class="history-meta">
                    <span>${new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
                <button class="icon-btn delete-btn" title="Remove">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            `;

            div.addEventListener('click', () => {
                sqlInput.value = item.sql;
                sqlInput.focus();
            });

            // Delete History Item
            const delBtn = div.querySelector('.delete-btn');
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await API.deleteHistory(item.id);
                loadHistory();
            });

            historyList.appendChild(div);
        });
    }

    // --- Quick Access Logic (v3 - API Linked) ---
    const addTableBtn = document.getElementById('addTableBtn');
    const quickAccessList = document.getElementById('quickAccessList');

    // Modal Elements
    const modalOverlay = document.getElementById('quickAccessModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const saveQuickAccessBtn = document.getElementById('saveQuickAccessBtn');
    const qaNameInput = document.getElementById('qaNameInput');
    const qaSqlInput = document.getElementById('qaSqlInput');

    async function loadQuickAccess() {
        try {
            const items = await API.getQuickAccess();
            renderQuickAccessList(items);
        } catch (e) {
            console.error("Failed to load quick access", e);
        }
    }

    // --- Drag and Drop Logic ---
    let draggedItem = null;

    function renderQuickAccessList(items) {
        quickAccessList.innerHTML = '';
        if (!items || items.length === 0) {
            quickAccessList.innerHTML = '<div style="padding:0.5rem; color:var(--text-secondary); font-size:0.8rem; font-style:italic;">No items added</div>';
            return;
        }

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'quick-table-item';
            div.draggable = true; // Enable drag
            div.dataset.id = item.id;
            div.innerHTML = `
                <span>${escapeHtml(item.name)}</span>
                <div class="actions">
                    <button class="icon-btn edit-qa-btn" title="Edit">
                       <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button class="icon-btn delete-btn" title="Remove">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            `;

            // Click to inspect (ignore actions container)
            div.addEventListener('click', (e) => {
                if (e.target.closest('.actions')) return;
                sqlInput.value = item.sql;
                executeQuery();
            });

            // Edit button
            const editBtn = div.querySelector('.edit-qa-btn');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                setupModalButton(handleSaveQuickAccess); // Restore QA handler

                editingQuickAccessId = item.id;
                qaNameInput.value = item.name;
                qaSqlInput.value = item.sql;
                document.querySelector('.modal-header h3').textContent = 'Edit Quick Access';
                document.getElementById('saveQuickAccessBtn').textContent = 'Update';
                showModal(true);
            });

            // Delete button
            const delBtn = div.querySelector('.delete-btn');
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm(`Delete "${item.name}"?`)) return;
                await API.deleteQuickAccess(item.id);
                loadQuickAccess();
            });

            // --- Drag Events ---
            div.addEventListener('dragstart', (e) => {
                draggedItem = div;
                div.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';

                // Fix: Ghost image might be the element itself which is now faded due to .dragging
                // We can clone it or just let browser handle it. The previous setDragImage(div, 0, 0) caused issues if div was hidden/moved.
                // Removing explicit setDragImage usually works better for simple cases, or we clone:
                // var clone = div.cloneNode(true);
                // clone.style.position = "absolute";
                // clone.style.top = "-1000px";
                // document.body.appendChild(clone);
                // e.dataTransfer.setDragImage(clone, 0, 0);
                // setTimeout(() => document.body.removeChild(clone), 0);
            });

            div.addEventListener('dragend', () => {
                draggedItem = null;
                div.classList.remove('dragging');
                document.querySelectorAll('.quick-table-item').forEach(i => i.classList.remove('drag-over'));

                // Save new order
                saveNewOrder();
            });

            div.addEventListener('dragover', (e) => {
                e.preventDefault();
                const afterElement = getDragAfterElement(quickAccessList, e.clientY);
                const currentContainer = quickAccessList;
                if (!draggedItem) return;

                if (afterElement == null) {
                    currentContainer.appendChild(draggedItem);
                } else {
                    currentContainer.insertBefore(draggedItem, afterElement);
                }
            });

            // Prevent default to allow drop
            div.addEventListener('drop', (e) => {
                e.preventDefault();
            });

            div.addEventListener('dragenter', () => div.classList.add('drag-over'));
            div.addEventListener('dragleave', () => div.classList.remove('drag-over'));

            quickAccessList.appendChild(div);
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.quick-table-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    async function saveNewOrder() {
        const items = document.querySelectorAll('.quick-table-item');
        const ids = Array.from(items).map(item => parseInt(item.dataset.id));

        try {
            await API.reorderQuickAccess(ids);
        } catch (e) {
            console.error('Failed to save order', e);
            showError('Failed to save new order');
        }
    }

    // Modal Helpers to manage button listeners
    function setupModalButton(handler) {
        const saveBtn = document.getElementById('saveQuickAccessBtn');
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', handler);
        return newSaveBtn;
    }

    async function handleSaveQuickAccess() {
        const name = qaNameInput.value.trim();
        const sql = qaSqlInput.value.trim();

        if (!name || !sql) {
            showError('Please fill in all fields');
            return;
        }

        try {
            const btn = document.getElementById('saveQuickAccessBtn');
            btn.textContent = 'Saving...';
            btn.disabled = true;

            if (editingQuickAccessId) {
                await API.updateQuickAccess(editingQuickAccessId, name, sql);
            } else {
                await API.addQuickAccess(name, sql);
            }
            showModal(false);
            loadQuickAccess();
        } catch (err) {
            showError(err.message);
        } finally {
            const btn = document.getElementById('saveQuickAccessBtn');
            btn.textContent = editingQuickAccessId ? 'Update' : 'Save';
            btn.disabled = false;
        }
    }

    // Modal Logic
    let editingQuickAccessId = null;

    addTableBtn.addEventListener('click', () => {
        setupModalButton(handleSaveQuickAccess);

        editingQuickAccessId = null;
        qaNameInput.value = '';
        qaSqlInput.value = '';
        document.querySelector('.modal-header h3').textContent = 'Add Quick Access';
        document.getElementById('saveQuickAccessBtn').textContent = 'Save';
        showModal(true);
        qaNameInput.focus();
    });

    function showModal(show) {
        modalOverlay.classList.toggle('visible', show);
    }

    closeModalBtn.addEventListener('click', () => showModal(false));
    cancelModalBtn.addEventListener('click', () => showModal(false));

    saveQuickAccessBtn.addEventListener('click', async () => {
        const name = qaNameInput.value.trim();
        const sql = qaSqlInput.value.trim();

        if (!name || !sql) {
            showError('Please fill in all fields');
            return;
        }

        try {
            if (editingQuickAccessId) {
                await API.updateQuickAccess(editingQuickAccessId, name, sql);
            } else {
                await API.addQuickAccess(name, sql);
            }
            showModal(false);
            loadQuickAccess();
        } catch (err) {
            showError(err.message);
        }
    });

    // --- Helpers ---

    function setLoading(isLoading) {
        if (isLoading) {
            runBtn.disabled = true;
            runBtn.innerHTML = '<div class="spinner"></div> Running...';
        } else {
            runBtn.disabled = false;
            runBtn.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Run Query';
        }
    }

    function showError(msg) {
        errorToast.textContent = msg;
        errorToast.classList.add('visible');
        setTimeout(() => {
            errorToast.classList.remove('visible');
        }, 5000);
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // --- Migration Logic ---
    async function checkAndMigrateData() {
        // Check if we have already migrated (using a simple flag in localStorage)
        if (localStorage.getItem('rcsl_migrated_to_sqlite')) return;

        console.log("Checking for data to migrate...");
        let migratedCount = 0;

        // 1. Migrate Quick Access
        const localQuick = JSON.parse(localStorage.getItem('rcsl_quick_tables') || '[]');
        if (localQuick.length > 0) {
            for (const item of localQuick) {
                // Handle v1 (string) vs v2 (object)
                const name = (typeof item === 'string') ? item : item.name;
                const sql = (typeof item === 'string') ? `SELECT * FROM ${item} LIMIT 50` : item.sql;

                try {
                    await API.addQuickAccess(name, sql);
                    migratedCount++;
                } catch (e) {
                    console.warn(`Skipping duplicate or error during migration: ${name}`);
                }
            }
        }

        // 2. Migrate History (Limit to 50)
        const localHistory = JSON.parse(localStorage.getItem('rcsl_sql_history') || '[]');
        if (localHistory.length > 0) {
            // Reverse to add oldest first (so newest ends up at top of ID or list)
            // But our API adds to DB. ID increments.
            // If we add [Newest, ..., Oldest], Newest gets ID 1.
            // When we fetch 'ORDER BY id DESC', we get ID 1 (Newest) last. 
            // So we should add Oldest first (ID 1), Newest last (ID 50).
            // localHistory is [Newest, ..., Oldest]

            const historyToAdd = localHistory.slice(0, 50).reverse();
            for (const item of historyToAdd) {
                await API.addHistory(item.sql);
                migratedCount++;
            }
        }

        if (migratedCount > 0) {
            showError(`Migrated ${migratedCount} items to new database.`);
            // Mark as done
            localStorage.setItem('rcsl_migrated_to_sqlite', 'true');
            // Clean up old keys if desired, or keep as backup
            // localStorage.removeItem('rcsl_quick_tables');
            // localStorage.removeItem('rcsl_sql_history');
        }

        // Refresh views
        loadHistory();
        loadQuickAccess();
    }


    // --- Fullscreen Logic ---
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const resultsSection = document.getElementById('resultsSection');

    fullscreenBtn.addEventListener('click', () => {
        resultsSection.classList.toggle('fullscreen');
        const isFullscreen = resultsSection.classList.contains('fullscreen');
        if (isFullscreen) {
            fullscreenBtn.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            fullscreenBtn.title = "Exit Fullscreen";
        } else {
            fullscreenBtn.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>';
            fullscreenBtn.title = "Toggle Fullscreen";
        }
    });

});

document.addEventListener('DOMContentLoaded', () => {
    // 1. 身份验证
    const password = sessionStorage.getItem('admin-token');
    if (!password) {
        // 👇👇👇 **核心修改点** 👇👇👇
        // 从旧的 '/admin/login.html' 改为新的正确路径
        window.location.href = '/dashboard-xyz789/login.html'; 
        return;
    }

    // --- 2. 状态管理 ---
    let allKeysCache = [];
    let currentPage = 1;
    const itemsPerPage = 10;
    
    // --- 新增辅助函数：判断密钥是否处于激活状态 (兼容 'used' 和 'web_used') ---
    const isKeyUsed = (status) => status === 'used' || status === 'web_used';

    // --- 3. DOM元素获取 ---
    const pages = { home: document.getElementById('page-home'), create: document.getElementById('page-create'), view: document.getElementById('page-view'), config: document.getElementById('page-config') };
    const sidebarLinks = document.querySelectorAll('.sidebar-link[data-page]');
    const logoutBtn = document.getElementById('logoutBtn');
    const statsTotalKeys = document.getElementById('stats-total-keys');
    const statsUsedKeys = document.getElementById('stats-used-keys');
    const statsUnusedKeys = document.getElementById('stats-unused-keys');
    const generatedKeysDisplay = document.getElementById('generatedKeysDisplay');
    const generateSingleBtn = document.getElementById('generateSingleBtn');
    const generateBatchBtn = document.getElementById('generateBatchBtn');
    const batchQuantityInput = document.getElementById('batchQuantityInput');
    const copyKeysBtn = document.getElementById('copyKeysBtn');
    const generatorStatus = document.getElementById('generatorStatus');
    const keysTableBody = document.getElementById('keys-table-body');
    const keysTableStatus = document.getElementById('keys-table-status');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageStartSpan = document.getElementById('pageStartSpan');
    const pageEndSpan = document.getElementById('pageEndSpan');
    const totalItemsSpan = document.getElementById('totalItemsSpan');
    const feishuLinkInput = document.getElementById('feishuLinkInput');
    const saveFeishuBtn = document.getElementById('saveFeishuBtn');
    const feishuStatus = document.getElementById('feishuStatus');
    const shortcutLinkInput = document.getElementById('shortcutLinkInput');
    const saveShortcutBtn = document.getElementById('saveShortcutBtn');
    const shortcutStatus = document.getElementById('shortcutStatus');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const selectedCountSpan = document.getElementById('selectedCount');

    // --- 4. 核心功能函数 ---
    const showLoading = (element, message = "...") => {
        if (element) element.textContent = message;
    };

    const loadHomePage = async () => {
        showLoading(statsTotalKeys);
        showLoading(statsUsedKeys);
        showLoading(statsUnusedKeys);
        try {
            const result = await DataStore.getStats(password);
            if (result.success) {
                statsTotalKeys.textContent = result.data.totalKeys;
                statsUsedKeys.textContent = result.data.usedKeys;
                statsUnusedKeys.textContent = result.data.totalKeys - result.data.usedKeys;
            } else { throw new Error(result.message); }
        } catch(error) {
            [statsTotalKeys, statsUsedKeys, statsUnusedKeys].forEach(el => el.textContent = 'N/A');
        }
    };
    
    const loadConfigPage = async () => {
        feishuLinkInput.value = '加载中...';
        shortcutLinkInput.value = '加载中...';
        try {
            const result = await DataStore.getAdminConfig(password);
            if (result.success) {
                feishuLinkInput.value = result.data.FEISHU_TEMPLATE_LINK || '';
                shortcutLinkInput.value = result.data.SHORTCUT_ICLOUD_LINK || '';
            } else { throw new Error(result.message); }
        } catch(error) {
            feishuStatus.textContent = `加载失败: ${error.message}`;
            feishuStatus.style.color = 'red';
        }
    };
    
    const renderCurrentPage = () => {
        keysTableBody.innerHTML = '';
        keysTableStatus.textContent = '';
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const keysForCurrentPage = allKeysCache.slice(startIndex, endIndex);

        if (allKeysCache.length === 0) {
            keysTableStatus.textContent = '没有找到任何密钥。';
            return;
        }
        if (keysForCurrentPage.length === 0) {
             keysTableStatus.innerHTML = `此页无数据。<br> (共 ${allKeysCache.length} 条记录)`;
             return;
        }
        keysForCurrentPage.forEach(key => {
            // --- 核心修复点：使用 isKeyUsed 函数判断激活状态 ---
            const isUsed = isKeyUsed(key.validation_status); 
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-4"><input type="checkbox" class="key-checkbox h-4 w-4 text-blue-600" data-key-value="${key.key_value}"></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-800">${key.key_value}</td>
                <td class="px-6 py-4"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isUsed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${isUsed ? '已激活' : '未激活'}</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(key.created_at).toLocaleString()}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium flex items-center gap-4">
                    <button title="复制" data-key-value="${key.key_value}" class="copy-btn text-gray-500 hover:text-blue-600">复制</button>
                    <button title="重置" data-key-value="${key.key_value}" class="reset-btn text-gray-500 hover:text-blue-600 disabled:text-gray-300" ${!isUsed ? 'disabled' : ''}>重置</button>
                    <button title="删除" data-key-value="${key.key_value}" class="delete-btn text-gray-500 hover:text-red-600">删除</button>
                </td>
            `;
            keysTableBody.appendChild(tr);
        });
    };

    const updatePaginationControls = () => {
        const totalItems = allKeysCache.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage + 1;
        const endIndex = Math.min(currentPage * itemsPerPage, totalItems);
        pageStartSpan.textContent = totalItems > 0 ? startIndex : 0;
        pageEndSpan.textContent = endIndex;
        totalItemsSpan.textContent = totalItems;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    };

    const updateDeleteButtonState = () => {
        const selectedCheckboxes = document.querySelectorAll('.key-checkbox:checked');
        const count = selectedCheckboxes.length;
        selectedCountSpan.textContent = count;
        deleteSelectedBtn.disabled = count === 0;
        const allCheckboxesOnPage = document.querySelectorAll('.key-checkbox');
        selectAllCheckbox.checked = allCheckboxesOnPage.length > 0 && count === allCheckboxesOnPage.length;
    };

    const loadViewPage = async () => {
        keysTableBody.innerHTML = '';
        keysTableStatus.textContent = '正在加载密钥列表...';
        try {
            const result = await DataStore.getAllKeys(password);
            if (result.success) {
                allKeysCache = result.data;
                currentPage = 1;
                renderCurrentPage();
                updatePaginationControls();
                updateDeleteButtonState();
            } else { throw new Error(result.message); }
        } catch(error) {
             keysTableStatus.textContent = `加载失败: ${error.message}`;
        }
    };
    
    const showPage = (pageId) => {
        const effectivePageId = pages[pageId] ? pageId : 'home';
        Object.values(pages).forEach(page => page.classList.remove('active'));
        pages[effectivePageId].classList.add('active');
        sidebarLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === effectivePageId) link.classList.add('active');
        });
        if (effectivePageId === 'home') loadHomePage();
        if (effectivePageId === 'view') loadViewPage();
        if (effectivePageId === 'config') loadConfigPage();
    };

    // --- 5. 事件监听器绑定 ---
    sidebarLinks.forEach(link => link.addEventListener('click', () => showPage(link.dataset.page)));
    logoutBtn.addEventListener('click', () => { sessionStorage.removeItem('admin-token'); window.location.href = '/dashboard-xyz789/login.html'; });

    const setGeneratorStatus = (message, isError = false) => {
        generatorStatus.textContent = message;
        generatorStatus.style.color = isError ? 'red' : 'green';
        setTimeout(() => { generatorStatus.textContent = ''; }, 3000);
    };

    const handleGeneration = async (quantity) => {
        generateSingleBtn.disabled = true;
        generateBatchBtn.disabled = true;
        setGeneratorStatus(`正在生成并保存 ${quantity} 个密钥...`);
        try {
            const result = await DataStore.generateAndSaveKeys(quantity, password);
            if (result.success) {
                generatedKeysDisplay.value = result.generatedKeys.join('\n');
                setGeneratorStatus(`成功保存 ${result.added_count} 个新密钥！`);
                copyKeysBtn.disabled = result.added_count === 0;
            } else { throw new Error(result.message); }
        } catch (error) {
            setGeneratorStatus(`操作失败: ${error.message}`, true);
        }
        generateSingleBtn.disabled = false;
        generateBatchBtn.disabled = false;
    };

    generateSingleBtn.addEventListener('click', () => handleGeneration(1));
    generateBatchBtn.addEventListener('click', () => handleGeneration(parseInt(batchQuantityInput.value, 10) || 10));
    
    copyKeysBtn.addEventListener('click', () => {
        if (!generatedKeysDisplay.value) return;
        navigator.clipboard.writeText(generatedKeysDisplay.value).then(() => {
            const originalText = copyKeysBtn.textContent;
            copyKeysBtn.textContent = '已复制!';
            setTimeout(() => { copyKeysBtn.textContent = originalText; }, 2000);
        });
    });

    keysTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('key-checkbox')) {
            updateDeleteButtonState();
            return;
        }
        const keyValue = target.dataset.keyValue;
        if (!keyValue) return;
        if (target.classList.contains('copy-btn')) {
            navigator.clipboard.writeText(keyValue).then(() => alert('密钥已复制!'));
        }
        if (target.classList.contains('reset-btn')) {
            if (confirm(`您确定要重置密钥 "${keyValue}" 吗？`)) {
                const result = await DataStore.resetKey(keyValue, password);
                if (result.success) loadViewPage(); else alert(`重置失败: ${result.message}`);
            }
        }
        if (target.classList.contains('delete-btn')) {
            if (confirm(`您确定要删除密钥 "${keyValue}" 吗？此操作不可撤销。`)) {
                const result = await DataStore.deleteKey(keyValue, password);
                if (result.success) loadViewPage(); else alert(`删除失败: ${result.message}`);
            }
        }
    });

    selectAllCheckbox.addEventListener('click', () => {
        const allCheckboxesOnPage = document.querySelectorAll('.key-checkbox');
        allCheckboxesOnPage.forEach(checkbox => checkbox.checked = selectAllCheckbox.checked);
        updateDeleteButtonState();
    });

    deleteSelectedBtn.addEventListener('click', async () => {
        const selectedCheckboxes = document.querySelectorAll('.key-checkbox:checked');
        const keysToDelete = Array.from(selectedCheckboxes).map(cb => cb.dataset.keyValue);
        if (keysToDelete.length === 0) return;
        if (confirm(`您确定要删除选中的 ${keysToDelete.length} 个密钥吗？此操作不可撤销。`)) {
            const result = await DataStore.batchDeleteKeys(keysToDelete, password);
            if(result.success) {
                alert(result.message);
                loadViewPage();
            } else {
                alert(`删除失败: ${result.message}`);
            }
        }
    });

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderCurrentPage();
            updatePaginationControls();
        }
    });
    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(allKeysCache.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderCurrentPage();
            updatePaginationControls();
        }
    });
    
    const setConfigStatus = (el, message, isError) => {
        el.textContent = message;
        el.style.color = isError ? 'red' : 'green';
        setTimeout(() => { el.textContent = ''; }, 3000);
    };

    saveFeishuBtn.addEventListener('click', async () => {
        const url = feishuLinkInput.value.trim();
        if(!url) { setConfigStatus(feishuStatus, '链接不能为空', true); return; }
        const result = await DataStore.saveAdminConfig('feishu', url, password);
        setConfigStatus(feishuStatus, result.message, !result.success);
    });

    saveShortcutBtn.addEventListener('click', async () => {
        const url = shortcutLinkInput.value.trim();
        if(!url) { setConfigStatus(shortcutStatus, '链接不能为空', true); return; }
        const result = await DataStore.saveAdminConfig('shortcut', url, password);
        setConfigStatus(shortcutStatus, result.message, !result.success);
    });

    // --- 6. 初始化 ---
    showPage('home');
});
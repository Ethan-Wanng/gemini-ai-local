// 全局变量，用于存储 SSE 连接的 reader，以便在需要时取消
let sseReader = null;
// 标记是否自动滚动
let autoScroll = true;

// 添加这个新函数
function updateInputCentering() {
    const chatContainer = document.getElementById('chat-container');
    const body = document.body;
    // 检查聊天容器是否存在，并且是否没有子元素（或者更严格地，没有 .message 元素）
    const isEmpty = !chatContainer || chatContainer.children.length === 0 || !chatContainer.querySelector('.message');

    if (isEmpty) {
        body.classList.add('input-centered');
    } else {
        body.classList.remove('input-centered');
    }
}

// Theme Toggle Functionality
document.addEventListener("DOMContentLoaded", function () {
    const themeToggle = document.getElementById("theme-toggle");
    const body = document.body;

    // Function to set theme
    function setTheme(themeName) {
        localStorage.setItem('theme', themeName);
        body.className = themeName;
    }

    // Function to toggle theme
    function toggleTheme() {
        if (localStorage.getItem('theme') === 'dark-theme') {
            setTheme('light-theme');
        } else {
            setTheme('dark-theme');
        }
        updateThemeButton();
    }

    // Function to update theme button icon
    function updateThemeButton() {
        if (localStorage.getItem('theme') === 'dark-theme') {
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
    }

    // Initial theme setup
    if (localStorage.getItem('theme') === 'dark-theme') {
        setTheme('dark-theme');
    } else {
        setTheme('light-theme');
    }
    updateThemeButton();

    // Event listener for theme toggle button
    themeToggle.addEventListener('click', function () {
        toggleTheme();
    });

    const historyToggleButton = document.getElementById('history-toggle-btn');
    const bodyElement = document.body; // 或者使用 document.getElementById('main-container');

    if (historyToggleButton) {
        historyToggleButton.addEventListener('click', async () => {
            bodyElement.classList.toggle('history-visible');

            try {
                const historyResponse = await fetch("/historyList", {method: "GET"});
                if (!historyResponse.ok) {
                    console.error(`History API error: ${historyResponse.status}`);
                    return;
                }
                const historyData = await historyResponse.json();
                updateHistoryList(historyData);
            } catch (error) {
                console.error("Error loading history on page load:", error);
            }
            // 重要：当布局改变后，重新计算聊天容器的高度
            // 使用 setTimeout 确保浏览器有时间应用 CSS 类并完成重排 (reflow)
            setTimeout(() => {
                adjustChatContainerHeight();
                // 如果聊天内容很多，可能需要再次滚动到底部
                const chatContainer = document.getElementById('chat-container');
                if (chatContainer && autoScroll) { // 检查是否需要自动滚动
                    scrollToBottom(chatContainer);
                }
            }, 310); // 延迟时间略大于 CSS 过渡时间
        });
    }

    // 初始调整聊天容器高度
    adjustChatContainerHeight();
    window.addEventListener('resize', adjustChatContainerHeight);
});

// 调整聊天容器高度的函数
function adjustChatContainerHeight() {
    const body = document.body;
    const chatContainer = document.getElementById('chat-container');

    if (body.classList.contains('input-centered')) {
        if (chatContainer) {
            chatContainer.style.height = ''; // 清除可能残留的高度样式
        }
        return;
    }

    // 原有的非居中状态下的高度计算逻辑
    const inputContainer = document.getElementById('input-container');
    const mainContainer = document.getElementById('main-container');

    if (!chatContainer || !inputContainer || !mainContainer) return;

    // 确保 chatContainer 是可见的才计算
    if (window.getComputedStyle(chatContainer).display === 'none') return;

    const availableHeight = mainContainer.clientHeight; // 使用 mainContainer 或 chat-area 的高度
    const inputHeight = inputContainer.offsetHeight;
    const padding = 5; // 调整上下留白

    // 只有在非居中时才设置高度
    chatContainer.style.height = `${availableHeight - inputHeight - padding}px`;
}

async function setSessionID() {
    try {
        const response = await fetch("/lastSessionID", {method: "GET"});
        if (!response.ok) {
            console.error(`last session id API error: ${response.status}`);
            return;
        }
        const id = await response.text();
        sessionStorage.setItem("sessionId", id);
    } catch (error) {
        console.error("Failed to fetch session ID:", error);
    }
}

// Get initial model value from select element
const modelSelect = document.getElementById("model-select");
let selectedModel = modelSelect ? modelSelect.value : "gemini-2.0-flash";

function changeModel() {
    const modelSelect = document.getElementById("model-select");
    if (!modelSelect) return;

    selectedModel = modelSelect.value;
    console.log("Selected model:", selectedModel);

    fetch("/switchModel?model=" + encodeURIComponent(selectedModel), {
        method: "GET",
    })
        .then(response => {
            if (!response.ok) {
                console.error("Failed to switch model:", response.status);
                // Revert to previous selection
                modelSelect.value = selectedModel;
                return;
            }
            console.log("Model switched successfully");
        })
        .catch(error => {
            console.error("Error switching model:", error);
            // Revert to previous selection
            modelSelect.value = selectedModel;
        });
}

let uploadedFiles = [];

function handlePaste(event) {
    const fileInput = document.getElementById("file-input");
    const textarea = document.getElementById("user-input");
    const clipboardData = event.clipboardData || window.clipboardData;

    // 1. 处理文件
    if (clipboardData.files && clipboardData.files.length > 0) {
        // 创建新的 FileList 对象，包含现有文件和新粘贴的文件
        const existingFiles = uploadedFiles || [];
        const newFiles = Array.from(clipboardData.files);
        uploadedFiles = [...existingFiles, ...newFiles];

        // 更新文件显示
        handleFiles(uploadedFiles);

        // 更新 fileInput（如果存在）
        if (fileInput) {
            const dt = new DataTransfer();
            uploadedFiles.forEach(file => dt.items.add(file));
            fileInput.files = dt.files;
        }
    }

    // 2. 处理文本（如果有）
    const text = clipboardData.getData("text");
    if (text && textarea) {
        // 阻止默认行为，手动插入文本
        event.preventDefault();
        // 在光标处插入文本
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        textarea.value = value.slice(0, start) + text + value.slice(end);
        // 移动光标到插入文本后
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        // 触发高度自适应
        adjustTextareaHeight(textarea);
    }
}

function handleFiles(files) {
    const chatContainer = document.getElementById("chat-container");
    const uploadedInfoDiv = document.getElementById("uploaded-files-info") || document.createElement("div");
    const fileInput = document.getElementById("file-input");

    if (files.length === 0) {
        // 如果文件列表为空（无论是初始状态还是删除后）
        if (uploadedInfoDiv) {
            // 如果文件预览区域存在，则清空内容并隐藏它
            uploadedInfoDiv.innerHTML = '';
            uploadedInfoDiv.style.display = "none";
        }
        // 直接返回，不再检查 hasContent 或隐藏 chatContainer
        // 确保全局 uploadedFiles 也同步清空
        uploadedFiles = [];
        // (可选) 清理文件输入控件的值，虽然 DataTransfer 会处理，但以防万一
        if (fileInput) fileInput.value = "";
        return;
    }

    chatContainer.style.display = "block";
    uploadedInfoDiv.id = "uploaded-files-info";
    uploadedInfoDiv.style.display = "block";

    // 清空现有内容，重新渲染
    uploadedInfoDiv.innerHTML = '';

    // 添加标题和文件计数
    const headerContainer = document.createElement("div");
    headerContainer.className = "files-header";
    headerContainer.style.display = "flex";
    headerContainer.style.justifyContent = "space-between";
    headerContainer.style.alignItems = "center";
    headerContainer.style.marginBottom = "10px";
    headerContainer.style.borderBottom = "1px solid var(--border-color)";
    headerContainer.style.paddingBottom = "8px";

    const fileIcon = document.createElement("i");
    fileIcon.className = "fas fa-paperclip";
    fileIcon.style.marginRight = "8px";

    const fileCountDisplay = document.createElement("div");
    fileCountDisplay.className = "file-count-display";
    fileCountDisplay.style.fontWeight = "bold";
    fileCountDisplay.style.display = "flex";
    fileCountDisplay.style.alignItems = "center";
    fileCountDisplay.innerHTML = `${fileIcon.outerHTML} 已选择 ${files.length} 个文件`;

    headerContainer.appendChild(fileCountDisplay);

    // 计算总文件大小
    const filesToProcess = Array.from(files); // Create a copy
    const totalSize = filesToProcess.reduce((sum, file) => sum + file.size, 0);
    const totalSizeDisplay = document.createElement("div");
    totalSizeDisplay.className = "total-size-display";
    totalSizeDisplay.textContent = `总大小: ${formatFileSize(totalSize)}`;
    headerContainer.appendChild(totalSizeDisplay);

    uploadedInfoDiv.appendChild(headerContainer);

    // 创建文件列表容器
    const filesListContainer = document.createElement("div");
    filesListContainer.className = "files-list-container";
    filesListContainer.style.maxHeight = "200px";
    filesListContainer.style.overflowY = "auto";
    filesListContainer.style.padding = "5px";
    filesListContainer.style.marginBottom = "10px";

    filesToProcess.forEach((file, index) => {
        const fileContainer = document.createElement("div");
        fileContainer.className = "file-info-container";
        fileContainer.dataset.fileIndex = String(index);
        fileContainer.style.display = "flex";
        fileContainer.style.alignItems = "center";
        fileContainer.style.justifyContent = "space-between";
        fileContainer.style.padding = "8px";
        fileContainer.style.margin = "5px 0";
        fileContainer.style.backgroundColor = "var(--bg-color)";
        fileContainer.style.borderRadius = "6px";
        fileContainer.style.border = "1px solid var(--border-color)";

        // 文件信息区域 (左侧)
        const fileInfoLeft = document.createElement("div");
        fileInfoLeft.style.display = "flex";
        fileInfoLeft.style.alignItems = "center";

        // 添加文件类型图标
        const fileTypeIcon = document.createElement("i");
        fileTypeIcon.className = getFileIcon(file.type);
        fileTypeIcon.style.fontSize = "18px";
        fileTypeIcon.style.marginRight = "10px";
        fileInfoLeft.appendChild(fileTypeIcon);

        // 文件预览/信息
        if (file.type.startsWith("image/")) {
            const thumbnailContainer = document.createElement("div");
            thumbnailContainer.style.width = "40px";
            thumbnailContainer.style.height = "40px";
            thumbnailContainer.style.marginRight = "10px";
            thumbnailContainer.style.overflow = "hidden";
            thumbnailContainer.style.borderRadius = "4px";

            const imgPreview = document.createElement("img");
            imgPreview.style.width = "100%";
            imgPreview.style.height = "100%";
            imgPreview.style.objectFit = "cover";

            const reader = new FileReader();
            reader.onload = (e) => {
                imgPreview.src = e.target.result;
            };
            reader.readAsDataURL(file);

            thumbnailContainer.appendChild(imgPreview);
            fileInfoLeft.appendChild(thumbnailContainer);
        }

        const fileDetails = document.createElement("div");
        fileDetails.style.display = "flex";
        fileDetails.style.flexDirection = "column";

        const fileName = document.createElement("div");
        fileName.textContent = file.name;
        fileName.style.fontSize = "14px";
        fileName.style.fontWeight = "500";
        fileDetails.appendChild(fileName);

        const fileSize = document.createElement("div");
        fileSize.textContent = formatFileSize(file.size);
        fileSize.style.fontSize = "12px";
        fileSize.style.color = "var(--text-secondary-color)";
        fileDetails.appendChild(fileSize);

        fileInfoLeft.appendChild(fileDetails);
        fileContainer.appendChild(fileInfoLeft);

        // 删除按钮 (右侧)
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "file-delete-btn";
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        deleteBtn.title = "移除文件";
        deleteBtn.style.border = "none";
        deleteBtn.style.background = "transparent";
        deleteBtn.style.color = "var(--text-secondary-color)";
        deleteBtn.style.fontSize = "16px";
        deleteBtn.style.cursor = "pointer";
        deleteBtn.style.transition = "color 0.2s";
        deleteBtn.onmouseover = () => {
            deleteBtn.style.color = "var(--error-color, #f44336)";
        };
        deleteBtn.onmouseout = () => {
            deleteBtn.style.color = "var(--text-secondary-color)";
        };

        deleteBtn.onclick = () => {
            const fileIndex = parseInt(fileContainer.dataset.fileIndex);

            if (!isNaN(fileIndex) && fileIndex >= 0) {
                const uploadedIndex = uploadedFiles.findIndex(uf => uf === filesToProcess[fileIndex]);

                if (uploadedIndex > -1) {
                    uploadedFiles.splice(uploadedIndex, 1);

                    // Update file input
                    const dt = new DataTransfer();
                    uploadedFiles.forEach(f => dt.items.add(f));
                    fileInput.files = dt.files;
                }

                fileContainer.remove();
                handleFiles(uploadedFiles);
            }
        };

        fileContainer.appendChild(deleteBtn);
        filesListContainer.appendChild(fileContainer);
    });

    uploadedInfoDiv.appendChild(filesListContainer);

    // 模拟上传准备的进度条
    const progressContainerWrapper = document.createElement("div");
    progressContainerWrapper.style.marginTop = "10px";

    const progressLabel = document.createElement("div");
    progressLabel.textContent = "准备上传中...";
    progressLabel.style.fontSize = "12px";
    progressLabel.style.marginBottom = "5px";
    progressContainerWrapper.appendChild(progressLabel);

    const progressContainer = document.createElement("div");
    progressContainer.className = "file-upload-progress";
    progressContainer.style.height = "6px";
    progressContainer.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
    progressContainer.style.borderRadius = "3px";
    progressContainer.style.overflow = "hidden";

    const progressBar = document.createElement("div");
    progressBar.className = "file-upload-progress-bar";
    progressBar.style.height = "100%";
    progressBar.style.width = "0%";
    progressBar.style.backgroundColor = "var(--button-bg-color)";
    progressBar.style.transition = "width 0.2s";

    progressContainer.appendChild(progressBar);
    progressContainerWrapper.appendChild(progressContainer);
    uploadedInfoDiv.appendChild(progressContainerWrapper);

    // 模拟文件准备进度
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 5;
        progressBar.style.width = `${progress}%`;
        if (progress >= 100) {
            clearInterval(progressInterval);
            progressLabel.textContent = "准备完成";
            setTimeout(() => {
                progressContainerWrapper.style.display = "none";
            }, 500);
        }
    }, 50);

    // Append uploadedInfoDiv to the chat container only once
    if (!chatContainer.contains(uploadedInfoDiv)) {
        chatContainer.appendChild(uploadedInfoDiv);
    }

    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 将文件添加到上传队列
    uploadedFiles = [...filesToProcess];
}

function formatFileSize(size) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let index = 0;
    let sizeInUnit = size;
    while (sizeInUnit >= 1024 && index < units.length - 1) {
        sizeInUnit /= 1024;
        index++;
    }
    return `${sizeInUnit.toFixed(2)} ${units[index]}`;
}

let originalHeight = ""
let isStopped = false;

async function sendMessage(isReply) {
    const inputField = document.getElementById("user-input");
    const chatContainer = document.getElementById("chat-container");
    const fileInput = document.getElementById("file-input");
    const uploadedFilesInfo = document.getElementById("uploaded-files-info");

    const userMessage = inputField.value.trim();

    // 从inputField的dataset中获取content_id（如果存在）
    const content_id = parseInt(inputField.dataset.content_id || "0");
    if (userMessage || (fileInput && fileInput.files.length > 0)) {
        chatContainer.style.display = "block"; // 确保聊天容器可见
        // 可能需要立即或稍后调整高度
        adjustChatContainerHeight();
    }

    if (!userMessage) {
        return;
    }

    // 保存当前输入框高度，供后续比较
    originalHeight = inputField.style.height;

    // 处理输入框内容和文件
    adjustTextareaHeight()
    let files = fileInput?.files
    let fileBase64s = [];  // Store image objects

    // Process images if files exist
    if (files && files.length > 0) {

        const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
        const maxSize = 200 * 1024 * 1024; // 200MB in bytes

        if (totalSize > maxSize) {
            alert("文件总大小不能超过200MB。");
            return;
        }

        for (let i = 0; i < files.length; i++) {
            const reader = new FileReader();
            reader.readAsDataURL(files[i]);
            await new Promise((resolve) => {
                reader.onload = function () {
                    // 从 Data URL 中提取 MIME 类型
                    const result = reader.result;
                    const match = result.match(/^data:([^;]+);/);
                    const mimeType = match ? match[1] : files[i].type;
                    const mediaTypes = ['image/', 'video/', 'audio/'];
                    const isMediaFile = mediaTypes.some(type => mimeType.startsWith(type));
                    const isSupportedFile = getFileIcon(mimeType) !== "far fa-file";
                    // Check if video file is not supported for certain models
                    if (mimeType.startsWith('video/') && selectedModel === 'gemini-2.0-flash-thinking-exp') {
                        alert("当前模型不支持视频文件输入。");
                        return;
                    }
                    if (!isMediaFile && !isSupportedFile) {
                        alert("不支持上传此类型文件。");
                        return;
                    }
                    fileBase64s.push({
                        mimeType: mimeType,
                        data: result.split(',')[1] // 去掉前缀部分
                    });
                    resolve();
                };
            });
        }
    }

    chatContainer.style.display = "block";
    const conversationContainer = createConversationContainer(userMessage, fileBase64s);
    chatContainer.appendChild(conversationContainer);

    scrollToBottom(chatContainer);
    if (uploadedFilesInfo) {
        uploadedFilesInfo.innerHTML = ""
        uploadedFilesInfo.style.display = "none"; // Hide the file info container
    }
    // Create and show AI message container immediately
    const {aiConversationContainer, aiMessageElement, aiMessageElementOnCopy} = createAIMessageElements(chatContainer);
    aiMessageElement.textContent = "AI is thinking...";

    // 调整容器高度
    adjustChatContainerHeight();

    // 清空输入字段并重置高度
    inputField.value = ""; // Clear the input field

    // 完全重置输入框高度
    inputField.style.height = ''; // 清空内联样式高度
    inputField.style.height = '40px'; // 设置回默认高度
    inputField.style.overflowY = 'hidden'; // 隐藏滚动条

    // 重置content_id，防止影响下一次普通发送
    if (!isReply) {
        inputField.dataset.content_id = "";
    }

    changeModel()
    const saveButton = document.getElementById("send-button")
    try {
        let sessionId = getSessionId();
        let flag = !sessionId;
        const abortController = new AbortController();
        const chatResponse = await fetchChatResponse(userMessage, sessionId, content_id, fileBase64s, isReply, {signal: abortController.signal});
        if (!chatResponse.ok) {
            if (chatResponse.status === 429) {
                throw new Error('发生了错误，请切换模型并刷新重试');
            }
            throw new Error(`Chat API error: ${chatResponse.status} - ${await getErrorMessage(chatResponse)}`);
        }
        // 变成 Stop 按钮
        saveButton.innerHTML = `<i class="fas fa-stop"></i>`;
        isStopped = true;

        saveButton.onclick = async () => {
            if (isStopped) {
                // 发送 stop 信号到后端
                await fetch("/stop", {method: "POST"});
                setTimeout(() => {
                    abortController.abort();
                }, 1000);

                isStopped = false;
            } else {
                await sendMessage(false);
            }
        };

        await handleChatResponse(chatResponse, aiMessageElement, aiMessageElementOnCopy, chatContainer, userMessage);

        if (flag) {
            await handleNewSession(userMessage, sessionId);
        }

        await updateHistoryListFromServer();

        const response = await fetch(`/getTwoLastContent/${sessionId}`, {method: 'GET'});
        if (!response.ok) {
            throw new Error(`获取content id 失败: ${response.status}`);
        }
        const data = await response.json();
        conversationContainer.dataset.content_id = data.userContentId;
        aiConversationContainer.dataset.content_id = data.aiContentId;
        // 在完成后再次调整高度
        adjustChatContainerHeight();

    } catch (error) {
        console.error("发送消息时出错:", error); // 改进错误日志
        handleError(conversationContainer, error);
    } finally {
        fileInput.value = ""

        // 再次确保输入框高度重置
        inputField.style.height = ''; // 清空内联样式高度
        inputField.style.height = '40px'; // 设置回默认高度
        inputField.style.overflowY = 'hidden'; // 隐藏滚动条

        // 再次确保调整高度
        setTimeout(adjustChatContainerHeight, 200);
        // 变回提交按钮
        saveButton.innerHTML = `<i class="fas fa-paper-plane"></i>`;
        isStopped = false;

        if (!isReply && selectedModel === "gemini-2.0-flash-exp") {
            await loadHistoryById(getSessionId(), "");
        }
    }
}

function createConversationContainer(userMessage, fileBase64s = []) {
    const conversationContainer = document.createElement("div");
    conversationContainer.className = "conversation";

    const userMessageElement = document.createElement("div");
    userMessageElement.className = "message user-message";
    userMessageElement.style.whiteSpace = "pre-wrap";
    if (fileBase64s.length > 0) {
        const filesContainer = document.createElement("div");
        filesContainer.className = "files-container";

        // 直接遍历原始的 fileBase64s 数组
        fileBase64s.forEach(file => { // <--- 使用 fileBase64s 而不是 sortedFiles
            const mimeType = file.mimeType || file.type; // 注意: sendMessage 中用的是 mimeType，这里统一一下
            fileUI(filesContainer, file, mimeType);
        });

        userMessageElement.appendChild(filesContainer);
    }

    // Create wrapper for message content and edit button
    const messageWrapper = document.createElement("div");
    messageWrapper.className = "message-wrapper";

    // Add edit button
    const editButtonDiv = document.createElement("div");
    const editButton = document.createElement("button");
    editButton.className = "edit-message-btn";
    editButton.innerHTML = '<i class="fas fa-edit"></i>';
    editButton.onclick = () => editMessage(userMessageElement, userMessage, fileBase64s);
    editButtonDiv.appendChild(editButton);

    // Add copy userMessage button
    const copyButton = document.createElement("button");
    copyButton.className = "modern-copy-button";
    copyButton.innerHTML = '<i class="fas fa-copy"></i>';
    copyButton.onclick = () => copyMessage(userMessageElement, userMessage, fileBase64s);
    editButtonDiv.appendChild(copyButton);

    // Handle the text message
    const textDiv = document.createElement("div");
    textDiv.className = "message-text";
    textDiv.textContent = userMessage;

    messageWrapper.appendChild(textDiv);
    messageWrapper.appendChild(editButtonDiv);
    userMessageElement.appendChild(messageWrapper);

    conversationContainer.appendChild(userMessageElement);
    return conversationContainer;
}

// Helper to read File as Base64 Data URL
function readFileAsBase64(file) {
    // Add a log to see when it's called
    console.log(`Attempting to read file: ${file.name}, type: ${file.type}, size: ${file.size}`);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            console.log(`Successfully read file: ${file.name}`);
            resolve(event.target.result); // result is the Data URL
        };

        reader.onerror = (event) => {
            // **** Log the specific error from the reader ****
            console.error(`FileReader error occurred for file: ${file.name}`);
            console.error("FileReader error object:", event.target.error); // THIS IS KEY
            // Reject with the actual error object for better debugging upstream
            reject(event.target.error || new Error(`Unknown FileReader error for ${file.name}`));
        };

        reader.onabort = () => {
            console.warn(`File reading aborted for: ${file.name}`);
            reject(new Error(`File reading aborted for ${file.name}`));
        };

        try {
            reader.readAsDataURL(file);
        } catch (e) {
            // Catch synchronous errors during the read call itself (rare)
            console.error(`Error initiating FileReader.readAsDataURL for ${file.name}:`, e);
            reject(e);
        }
    });
}

async function copyMessage(userMessageElement, userMessage, fileBase64s) {
    // 检查浏览器是否支持 Clipboard API 和 ClipboardItem
    if (!navigator.clipboard || !window.ClipboardItem) {
        // 只复制文本的降级方案
        if (userMessage) {
            navigator.clipboard.writeText(userMessage)
                .then(() => {
                    showCopyFeedback(userMessageElement, true);
                })
                .catch(() => {
                    showCopyFeedback(userMessageElement, false);
                });
        } else {
            alert("您的浏览器不支持复制文件，且无文本内容可复制。");
        }
        return;
    }

    try {
        // 准备要放入 ClipboardItem 的数据
        const clipboardItemsData = {};
        if (userMessage && userMessage.trim() !== '') {
            clipboardItemsData['text/plain'] = new Blob([userMessage], {type: 'text/plain'});
        }

        // 2. 添加文件数据 (如果存在)
        if (fileBase64s && fileBase64s.length > 0) {
            console.log(`Preparing ${fileBase64s.length} file(s) for clipboard...`);
            for (const fileData of fileBase64s) {
                if (fileData.data && fileData.mimeType) {
                    try {
                        // 将 base64 转换为 Blob
                        const blob = base64ToBlob(fileData.data, fileData.mimeType);
                        clipboardItemsData[fileData.mimeType] = blob;
                    } catch (e) {
                        console.error(`无法处理文件 (MIME: ${fileData.mimeType}):`, e);
                        // 可以选择性地通知用户哪个文件失败了
                        alert(`处理文件（类型：${fileData.mimeType}）时出错，该文件未被复制。`);
                    }
                } else {
                    console.warn("跳过无效的文件数据:", fileData);
                }
            }
        }

        // 检查是否有任何内容可以复制
        if (Object.keys(clipboardItemsData).length === 0) {
            console.log("Nothing to copy.");
            alert("没有可复制的内容（无文本或有效文件）。");
            return;
        }

        const clipboardItem = new ClipboardItem(clipboardItemsData);
        await navigator.clipboard.write([clipboardItem]);
        showCopyFeedback(userMessageElement, true);
    } catch (err) {
        showCopyFeedback(userMessageElement, false);
    }
}

// 统一的按钮反馈函数
function showCopyFeedback(userMessageElement, success) {
    // 查找复制按钮
    const copyBtn = userMessageElement.querySelector('.copy-message-btn');
    if (!copyBtn) return;
    const originalText = copyBtn.innerHTML;
    if (success) {
        copyBtn.innerHTML = '<i class="fas fa-check"></i> 已复制';
        copyBtn.style.backgroundColor = "rgba(76, 175, 80, 0.2)";
        copyBtn.style.color = "#4CAF50";
    } else {
        copyBtn.innerHTML = '<i class="fas fa-times"></i> 复制失败';
        copyBtn.style.backgroundColor = "rgba(244, 67, 54, 0.2)";
        copyBtn.style.color = "#f44336";
    }
    setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.style.backgroundColor = "";
        copyBtn.style.color = "";
    }, 1000);
}

/**
 * Replaces a user message element with an editing interface, including clickable media/document previews.
 *
 * @param {HTMLElement} messageElement The user message div to replace.
 * @param {string} originalText The original text content of the message.
 * @param {Array<{data: string, mimeType: string}>} originalFilesData Array of original file objects.
 */
async function editMessage(messageElement, originalText, originalFilesData = []) {
    // ... (editContainer, textarea, filesPreviewContainer setup - no changes) ...
    const editContainer = document.createElement("div");
    editContainer.className = "edit-container";
    editContainer.style.border = "1px solid var(--border-color)";
    editContainer.style.padding = "10px";
    editContainer.style.marginTop = "5px";
    editContainer.style.borderRadius = "8px";
    editContainer.style.backgroundColor = "var(--input-bg-color)";

    const textarea = document.createElement("textarea");
    textarea.className = "edit-textarea";
    textarea.value = originalText;
    textarea.style.width = "100%";
    textarea.style.minHeight = "60px";
    textarea.style.resize = "vertical";
    textarea.style.marginBottom = "10px";
    textarea.style.backgroundColor = "var(--bg-color)";
    textarea.style.color = "var(--text-color)";
    textarea.style.border = "1px solid var(--border-color)";
    textarea.addEventListener('input', () => adjustTextareaHeight(textarea));

    const filesPreviewContainer = document.createElement("div");
    filesPreviewContainer.className = "edit-files-preview";
    filesPreviewContainer.style.marginBottom = "10px";
    filesPreviewContainer.style.maxHeight = "150px";
    filesPreviewContainer.style.overflowY = "auto";
    filesPreviewContainer.style.padding = "5px";
    filesPreviewContainer.style.border = "1px dashed var(--border-color)";
    filesPreviewContainer.style.borderRadius = "4px";

    let currentFiles = [];
    let fileCounter = 0;

    function renderEditFileItem(fileObject) {
        const fileDiv = document.createElement("div");
        fileDiv.className = "edit-file-item";
        // ... styles ...
        fileDiv.style.display = "flex";
        fileDiv.style.alignItems = "center";
        fileDiv.style.justifyContent = "space-between";
        fileDiv.style.padding = "5px 8px";
        fileDiv.style.marginBottom = "5px";
        fileDiv.style.backgroundColor = "var(--bg-color)";
        fileDiv.style.borderRadius = "4px";
        fileDiv.style.border = "1px solid var(--border-color)";

        const fileInfo = document.createElement("div");
        fileInfo.style.display = "flex";
        fileInfo.style.alignItems = "center";
        fileInfo.style.overflow = "hidden";
        fileInfo.style.flexGrow = "1";
        fileInfo.style.marginRight = "5px";

        let previewElement;
        const isImage = fileObject.mimeType.startsWith('image/');
        const isVideo = fileObject.mimeType.startsWith('video/');
        const isAudio = fileObject.mimeType.startsWith('audio/'); // Added check for audio
        const isPdf = fileObject.mimeType === 'application/pdf';
        const isText = fileObject.mimeType.startsWith('text/');
        // Update canPreview to exclude audio for the *edit list click*
        const canPreview = isImage || isVideo || isPdf || isText;

        // Create Preview Element
        if (isImage) {
            previewElement = document.createElement("img");
            // ... image setup ...
            previewElement.src = fileObject.dataUrl;
            previewElement.alt = "Preview";
            previewElement.style.width = "32px";
            previewElement.style.height = "32px";
            previewElement.style.objectFit = "cover";
            previewElement.style.marginRight = "8px";
            previewElement.style.borderRadius = "3px";
            previewElement.style.flexShrink = "0";
        } else {
            previewElement = document.createElement("i");
            let iconClass = "far fa-file"; // Default
            if (isVideo) iconClass = "far fa-file-video";
            else if (isAudio) iconClass = "far fa-file-audio"; // Use specific audio icon
            else iconClass = getFileIcon(fileObject.mimeType); // Use helper for others

            previewElement.className = `${iconClass} file-preview-icon`;
            // ... icon styles ...
            previewElement.style.marginRight = "8px";
            previewElement.style.fontSize = "1.6em";
            previewElement.style.width = "25px";
            previewElement.style.textAlign = "center";
            previewElement.style.color = "var(--text-secondary-color)";
            previewElement.style.flexShrink = "0";
        }

        // Add Click Handler ONLY if previewable (Image, Video, PDF, Text)
        if (canPreview) {
            previewElement.style.cursor = 'pointer';
            previewElement.title = '点击预览';
            previewElement.onclick = (event) => {
                event.stopPropagation();
                console.log(`Preview clicked for: ${fileObject.name}, type: ${fileObject.mimeType}`);
                if (isImage) createMediaModal(fileObject.dataUrl, 'image');
                else if (isVideo) createMediaModal(fileObject.dataUrl, 'video');
                else if (isPdf || isText) {
                    const base64Data = fileObject.dataUrl.split(',')[1];
                    if (base64Data) createDocumentModal(base64Data, fileObject.mimeType);
                    else {
                        console.error("Could not extract base64 data for document preview.");
                        alert("无法准备文档预览数据。");
                    }
                }
                // No action needed here for audio click
            };
        } else {
            // Make non-previewable icons (like audio) have default cursor
            previewElement.style.cursor = 'default';
        }
        fileInfo.appendChild(previewElement);


        // Details Container (Name + Size)
        const detailsDiv = document.createElement('div');
        detailsDiv.style.display = 'flex';
        detailsDiv.style.flexDirection = 'column';
        detailsDiv.style.overflow = 'hidden';

        // Conditionally add Name (SHOW for Audio, hide for image/video)
        // This condition correctly includes Audio
        if (!isImage && !isVideo) {
            const nameSpan = document.createElement("span");
            nameSpan.textContent = fileObject.name; // Use the actual name here
            // ... nameSpan styles ...
            nameSpan.style.fontSize = "13px";
            nameSpan.style.whiteSpace = "nowrap";
            nameSpan.style.overflow = "hidden";
            nameSpan.style.textOverflow = "ellipsis";
            nameSpan.title = fileObject.name;
            detailsDiv.appendChild(nameSpan);
        }

        // Always add Size
        const sizeSpan = document.createElement("span");
        sizeSpan.textContent = `${formatFileSize(fileObject.size)}`;
        // ... sizeSpan styles ...
        sizeSpan.style.fontSize = "11px";
        sizeSpan.style.color = "var(--text-secondary-color)";
        if (isImage || isVideo) sizeSpan.style.marginTop = "2px"; // Adjust alignment if name hidden
        detailsDiv.appendChild(sizeSpan);

        fileInfo.appendChild(detailsDiv);

        // Remove Button (no changes)
        const removeBtn = document.createElement("button");
        // ... removeBtn setup ...
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.title = "移除文件";
        removeBtn.className = "edit-file-remove-btn";
        removeBtn.style.border = "none";
        removeBtn.style.background = "transparent";
        removeBtn.style.color = "var(--text-secondary-color)";
        removeBtn.style.cursor = "pointer";
        removeBtn.style.fontSize = "14px";
        removeBtn.style.padding = "0 5px";
        removeBtn.style.flexShrink = "0";
        removeBtn.onclick = (event) => {
            event.stopPropagation();
            const index = currentFiles.findIndex(f => f.id === fileObject.id);
            if (index > -1) {
                currentFiles.splice(index, 1);
                fileDiv.remove();
            }
        };


        fileDiv.appendChild(fileInfo);
        fileDiv.appendChild(removeBtn);
        filesPreviewContainer.appendChild(fileDiv);
    }

    originalFilesData.forEach((fileData, index) => {
        const blob = base64ToBlob(fileData.data, fileData.mimeType);
        const fileObject = {
            dataUrl: `data:${fileData.mimeType};base64,${fileData.data}`,
            mimeType: fileData.mimeType,
            name: `original_file_${index}.${getFileType(fileData.mimeType).toLowerCase() || 'bin'}`, // Use helper for extension
            size: blob.size,
            isOriginal: true,
            id: `orig_${fileCounter++}`
        };
        currentFiles.push(fileObject);
        renderEditFileItem(fileObject);
    });

    async function handleNewFiles(filesToAdd) {
        for (const file of filesToAdd) {
            const existing = currentFiles.find(f => f.name === file.name && f.size === file.size);
            if (existing) continue;

            try {
                const dataUrl = await readFileAsBase64(file);
                const fileObject = {
                    dataUrl: dataUrl,
                    mimeType: file.type,
                    name: file.name,
                    size: file.size,
                    isOriginal: false,
                    id: `new_${fileCounter++}`
                };
                currentFiles.push(fileObject);
                renderEditFileItem(fileObject);
            } catch (error) {
                console.error(`Failed to process file: ${file.name}`, error);
                let errorMessage = `无法读取文件 ${file.name}.`;
                if (error && error.message) errorMessage += ` 原因: ${error.message}`;
                alert(errorMessage);
            }
        }
        if (fileInput) fileInput.value = "";
    }

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.className = "edit-file-input";
    fileInput.style.display = "block";
    fileInput.style.marginTop = "10px";
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) handleNewFiles(e.target.files);
    };

    textarea.addEventListener('paste', (event) => {
        if (event.clipboardData && event.clipboardData.files.length > 0) {
            event.preventDefault();
            handleNewFiles(event.clipboardData.files);
        }
    });

    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "edit-buttons";
    buttonsContainer.style.marginTop = "15px";
    buttonsContainer.style.display = "flex";
    buttonsContainer.style.justifyContent = "flex-end";

    const saveButton = document.createElement("button");
    saveButton.className = "save-edit-btn";
    saveButton.textContent = "提交";
    saveButton.style.marginLeft = "10px";
    saveButton.onclick = async () => { /* ... save logic ... */
        if (isStopped) {
            // 发送 stop 信号到后端
            await fetch("/stop", {method: "POST"});
            setTimeout(() => {
                abortController.abort();
            }, 1000);
        } else {
            const chatContainer = document.getElementById("chat-container");
            const globalFileInput = document.getElementById("file-input");
            const inputField = document.getElementById("user-input");
            const newText = textarea.value.trim();
            const conversation = messageElement.closest('.conversation');
            const content_id = conversation ? conversation.dataset.content_id : null;

            if (!newText && currentFiles.length === 0) {
                alert("请输入消息内容或添加文件。");
                return;
            }

            const dt = new DataTransfer();
            let totalSize = 0;
            for (const fileObj of currentFiles) {
                const blob = base64ToBlob(fileObj.dataUrl, fileObj.mimeType);
                const file = new File([blob], fileObj.name, {type: fileObj.mimeType});
                dt.items.add(file);
                totalSize += file.size;
            }

            const maxSize = 200 * 1024 * 1024;
            if (totalSize > maxSize) {
                alert(`文件总大小 (${formatFileSize(totalSize)}) 超过了 200MB 限制。请移除一些文件。`);
                return;
            }

            inputField.value = newText;
            if (content_id) inputField.dataset.content_id = content_id; else inputField.dataset.content_id = "";
            globalFileInput.files = dt.files;

            editContainer.remove();
            autoScroll = true;
            await sendMessage(true);
            await loadHistoryById(getSessionId(), "");
            if (chatContainer) scrollToBottom(chatContainer);
        }
    };

    const cancelButton = document.createElement("button");
    cancelButton.className = "cancel-edit-btn";
    cancelButton.textContent = "取消";
    cancelButton.onclick = () => {
        messageElement.innerHTML = '';
        updateMessage(messageElement, originalText, originalFilesData);
        editContainer.remove();
    };

    buttonsContainer.appendChild(cancelButton);
    buttonsContainer.appendChild(saveButton);
    editContainer.appendChild(textarea);
    editContainer.appendChild(filesPreviewContainer);
    editContainer.appendChild(fileInput);
    editContainer.appendChild(buttonsContainer);
    messageElement.innerHTML = '';
    messageElement.appendChild(editContainer);
    adjustTextareaHeight(textarea);
    textarea.focus();
}

function updateMessage(messageElement, newText, newFiles) {
    const messageWrapper = document.createElement("div");
    messageWrapper.className = "message-wrapper";

    const textDiv = document.createElement("div");
    textDiv.className = "message-text";
    textDiv.textContent = newText;

    const editButtonDiv = document.createElement("div");
    const editButton = document.createElement("button");
    editButton.className = "edit-message-btn";
    editButton.innerHTML = '<i class="fas fa-edit"></i>';
    editButtonDiv.appendChild(editButton);
    editButton.onclick = () => editMessage(messageElement, newText, newFiles);

    // Add copy userMessage button
    const copyButton = document.createElement("button");
    copyButton.className = "modern-copy-button";
    copyButton.innerHTML = '<i class="fas fa-copy"></i>';
    copyButton.onclick = () => copyMessage(messageElement, newText, newFiles);
    editButtonDiv.appendChild(copyButton);

    messageWrapper.appendChild(textDiv);
    messageWrapper.appendChild(editButtonDiv);
    messageElement.appendChild(messageWrapper);

    if (newFiles.length > 0) {
        const filesContainer = document.createElement("div");
        filesContainer.className = "files-container";

        newFiles.forEach(file => {
            const container = document.createElement("div");
            container.className = "file-container";
            fileUI(container, file, file.mimeType);
            filesContainer.appendChild(container);
        });

        messageElement.appendChild(filesContainer);
    }
}

async function fetchChatResponse(userMessage, sessionId, content_id, fileBase64s, isReply, options = {}) {
    return fetch("/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            message: userMessage,
            session_id: sessionId || 0,
            content_id: content_id || 0,
            files: fileBase64s,
            is_reply: !!isReply // 确保是布尔值
        }),
        signal: options.signal
    });
}

async function getErrorMessage(response) {
    const errorData = await response.json();
    return errorData.message || 'Unknown error';
}

function createAIMessageElements(chatContainer) {
    const aiConversationContainer = document.createElement("div");
    aiConversationContainer.className = "conversation";

    const aiMessageElement = document.createElement("div");
    aiMessageElement.className = "message ai-message";

    const loadingIndicator = document.createElement("div");
    loadingIndicator.className = "loading-indicator";
    loadingIndicator.innerHTML = `
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
    `;

    aiMessageElement.appendChild(loadingIndicator);
    aiMessageElement.appendChild(document.createTextNode("AI思考中..."));

    const aiMessageElementOnCopy = document.createElement("span");

    aiConversationContainer.appendChild(aiMessageElement);
    chatContainer.appendChild(aiConversationContainer);
    return {aiConversationContainer, aiMessageElement, aiMessageElementOnCopy};
}

async function handleChatResponse(chatResponse, aiMessageElement, aiMessageElementOnCopy, chatContainer, userMessage) {
    sseReader = chatResponse.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let partialResponse = "";

    autoScroll = true;
    setupScrollListener(chatContainer);

    try {
        while (true) {
            const {done, value} = await sseReader.read();
            if (done) break;
            const text = decoder.decode(value);
            partialResponse += text;
            aiMessageElement.innerHTML = marked.parse(partialResponse);
            hljs.highlightAll();
            aiMessageElementOnCopy.textContent = partialResponse;
            if (autoScroll) {
                scrollToBottom(chatContainer);
            }
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            throw error;
        }
    } finally {
        addActionButtons(aiMessageElement, partialResponse);
        enableCodeCopy();
    }
}

function setupScrollListener(chatContainer) {
    if (!chatContainer) return
    const scrollToBottomButton = document.getElementById("scroll-to-bottom");

    chatContainer.addEventListener("wheel", (event) => {
        // 稍微放宽判断是否在底部的条件，允许一些误差（例如 10 像素）
        const isAtBottom = chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + 10;

        if (event.deltaY < 0) { // 向上滚动
            autoScroll = false;
            scrollToBottomButton.style.display = "block";
        } else if (!isAtBottom) { // 向下滚动 且 不在底部
            autoScroll = false;
            scrollToBottomButton.style.display = "block";
        } else {  // 向下滚动 且 在底部
            autoScroll = true;
            scrollToBottomButton.style.display = "none";
        }
    });

    scrollToBottomButton.addEventListener("click", () => {
        autoScroll = true;
        scrollToBottom(chatContainer); // 立即滚动到底部
        scrollToBottomButton.style.display = "none";
    });
}

async function handleNewSession(userMessage, sessionId) {
    await setSessionID();
    sessionId = getSessionId();
    const titleResponse = await fetch("/generateTitle", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message: userMessage, session_id: sessionId}),
    });

    if (!titleResponse.ok) {
        console.error(`Title API error: ${titleResponse.status}`);
        // Use first 40 characters of userMessage as title
        return;
    }

    try {
        const titleData = await titleResponse.json();
        let title = titleData.text.replace(/\n/g, "");
        while (Array.from(title).length < 40) {
            title += ' ';
        }
        document.title = title
    } catch (titleError) {
        console.error("解析标题失败:", titleError);
    }
}

async function updateHistoryListFromServer() {
    const historyResponse = await fetch("/historyList", {method: "GET"});
    if (!historyResponse.ok) {
        console.error(`History API error: ${historyResponse.status}`);
        return;
    }
    try {
        const historyData = await historyResponse.json();
        updateHistoryList(historyData);
    } catch (historyError) {
        console.error("解析历史记录失败:", historyError);
    }
}

function handleError(conversationContainer, error) {
    const aiMessageElement = conversationContainer.querySelector(".ai-message");

    // 移除加载指示器
    const loadingIndicator = aiMessageElement.querySelector(".loading-indicator");
    if (loadingIndicator) {
        loadingIndicator.remove();
    }

    // 创建错误提示元素
    const errorElement = document.createElement("div");
    errorElement.className = "error-message";

    const errorIcon = document.createElement("i");
    errorIcon.className = "fas fa-exclamation-circle";
    errorElement.appendChild(errorIcon);

    const errorText = document.createElement("span");
    errorText.textContent = " " + (error.message || "发生了一个错误，请稍后再试");
    errorElement.appendChild(errorText);

    // 添加重试按钮
    const retryButton = document.createElement("button");
    retryButton.className = "retry-button";
    retryButton.innerHTML = '<i class="fas fa-redo-alt"></i> 重试';
    retryButton.onclick = () => {
        // 获取用户消息内容
        const userMessageElement = conversationContainer.querySelector(".user-message");
        const userMessageText = userMessageElement.querySelector(".message-text")?.textContent || "";

        // 删除当前错误的对话
        conversationContainer.remove();

        // 重新发送消息
        const inputField = document.getElementById("user-input");
        inputField.value = userMessageText;
        sendMessage(false);
    };

    errorElement.appendChild(retryButton);
    aiMessageElement.innerHTML = '';
    aiMessageElement.appendChild(errorElement);
}

function scrollToBottom(container) {
    if (!container) {
        container = document.getElementById("chat-container")
    }
    if (autoScroll) {
        // 使用requestAnimationFrame确保DOM更新后再滚动
        requestAnimationFrame(() => {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        });
    }
}

function enableCodeCopy() {
    document.querySelectorAll("pre").forEach((codeBlock) => {
        // 创建复制按钮
        const copyButton = document.createElement("button");
        copyButton.className = "modern-copy-button";
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';

        // 设置代码块的父容器为相对定位
        const codeContainer = document.createElement("div");
        codeContainer.style.position = "relative";
        codeContainer.appendChild(copyButton);
        codeContainer.appendChild(codeBlock.cloneNode(true)); // 克隆代码块

        // 替换原始代码块为容器
        codeBlock.parentElement.replaceChild(codeContainer, codeBlock);

        // 添加点击事件
        copyButton.onclick = () => {
            navigator.clipboard.writeText(codeBlock.textContent)
                .then(() => {
                    copyButton.textContent = "复制成功!";
                    setTimeout(() => (copyButton.textContent = "复制"), 1500);
                })
                .catch(() => {
                    copyButton.textContent = "复制失败";
                    setTimeout(() => (copyButton.textContent = "复制"), 1500);
                });
        };
    });
}

// 创建AI回复后添加操作按钮（重新回答、复制内容）
function addActionButtons(aiMessageElement, messageText) {
    // 创建操作按钮容器
    const actionButtons = document.createElement("div");
    actionButtons.className = "action-buttons";

    // 创建重新回答按钮
    const reanswer = document.createElement("button");
    reanswer.className = "reanswer-btn";
    reanswer.innerHTML = '<i class="fas fa-redo-alt"></i>';
    reanswer.onclick = async function (e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        scrollToBottom(document.getElementById("chat-container"));
        try {
            // 获取当前聊天窗口
            const conversationContainer = aiMessageElement.closest('.conversation');
            if (!conversationContainer) {
                console.error("找不到对话容器");
                return;
            }

            // 查找前一个对话容器
            const previousConversation = conversationContainer.previousElementSibling;
            if (!previousConversation) {
                console.error("找不到前一个对话容器");
                return;
            }

            // 获取用户问题
            const userMessageElement = previousConversation.querySelector('.user-message');
            if (!userMessageElement) {
                console.error("找不到用户消息元素");
                return;
            }

            // 获取用户消息文本
            const messageTextElement = userMessageElement.querySelector('.message-text');
            let userMessageText = "";
            if (messageTextElement) {
                userMessageText = messageTextElement.textContent.trim();
            } else {
                console.error("找不到消息文本元素");
                return;
            }

            // 获取content_id
            const content_id = previousConversation.dataset.content_id;

            // 设置输入字段
            const userInput = document.getElementById("user-input");
            userInput.value = userMessageText;

            // 调整输入框高度以适应文本
            adjustTextareaHeight(userInput);

            if (content_id) {
                userInput.dataset.content_id = content_id;
            }

            // 处理文件
            const fileContainers = userMessageElement.querySelectorAll('.file-container');
            const fileInput = document.getElementById("file-input");

            if (fileContainers && fileContainers.length > 0) {
                const dataTransfer = new DataTransfer();

                fileContainers.forEach((container) => {

                    // 检查媒体元素
                    const mediaElement = container.querySelector('img, video, audio');
                    if (mediaElement) {
                        const src = mediaElement.src;
                        console.log("找到媒体元素，src:", src.substring(0, 50) + "...");

                        // 确保src是data URL格式
                        if (src.startsWith('data:')) {
                            try {
                                const base64Data = src.split(',')[1];
                                const mimeType = src.match(/^data:(.*?);/)[1];
                                const blob = base64ToBlob(base64Data, mimeType);
                                const file = new File([blob], `file.${mimeType.split('/')[1]}`, {type: mimeType});
                                dataTransfer.items.add(file);
                                console.log("成功添加媒体文件");
                            } catch (err) {
                                console.error("处理媒体文件出错:", err);
                            }
                        }
                    } else {
                        // 处理其他文件类型(文本，PDF等)
                        const fileLink = container.querySelector('a');
                        if (fileLink && fileLink.href.startsWith('data:')) {
                            try {
                                const mimeType = fileLink.href.split(';')[0].split(':')[1];
                                const base64Data = fileLink.href.split(',')[1];
                                const blob = base64ToBlob(base64Data, mimeType);
                                const file = new File([blob], `file.${getFileType(mimeType).toLowerCase()}`, {type: mimeType});
                                dataTransfer.items.add(file);
                                console.log("成功添加文件链接");
                            } catch (err) {
                                console.error("处理文件链接出错:", err);
                            }
                        }
                    }
                });

                // 设置文件输入
                if (dataTransfer.files.length > 0) {
                    fileInput.files = dataTransfer.files;
                    // 更新全局uploadedFiles
                    uploadedFiles = Array.from(dataTransfer.files);
                    // 显示文件信息
                    handleFiles(uploadedFiles);
                }
            }

            // 删除当前对话容器
            conversationContainer.remove();
            // 调用发送消息函数
            await sendMessage(true);
            await loadHistoryById(getSessionId(), "");
        } catch (error) {
            console.error("重新回答时发生错误:", error);
        }
    };

    // 创建复制对话内容按钮
    const copyContent = document.createElement("button");
    copyContent.className = "copy-content-btn";
    copyContent.innerHTML = '<i class="fas fa-copy"></i>';
    copyContent.onclick = async function (e) {
        e.preventDefault();
        e.stopPropagation();

        // 检查Clipboard API和ClipboardItem支持
        if (navigator.clipboard && window.ClipboardItem) {
            try {
                // 复制为纯文本和Markdown（如果需要可扩展为HTML）
                const clipboardItemsData = {
                    'text/plain': new Blob([messageText], {type: 'text/plain'})
                };

                // 获取所有文件数据(图片、视频、音频等)
                const fileContainers = aiMessageElement.querySelectorAll('.file-container');
                if (fileContainers && fileContainers.length > 0) {
                    for (const container of fileContainers) {
                        const mediaElement = container.querySelector('img, video, audio');
                        if (mediaElement) {
                            const src = mediaElement.src;
                            if (src.startsWith('data:')) {
                                const mimeType = src.match(/^data:(.*?);/)[1];
                                const base64Data = src.split(',')[1];
                                const blob = base64ToBlob(base64Data, mimeType);
                                clipboardItemsData[mimeType] = blob;
                            }
                        } else {
                            const fileLink = container.querySelector('a');
                            if (fileLink && fileLink.href.startsWith('data:')) {
                                const mimeType = fileLink.href.split(';')[0].split(':')[1];
                                const base64Data = fileLink.href.split(',')[1];
                                const blob = base64ToBlob(base64Data, mimeType);
                                clipboardItemsData[mimeType] = blob;
                            }
                        }
                    }
                }

                const clipboardItem = new ClipboardItem(clipboardItemsData);
                await navigator.clipboard.write([clipboardItem]);
                const originalText = copyContent.innerHTML;
                copyContent.innerHTML = '<i class="fas fa-check"></i> 已复制';
                copyContent.style.backgroundColor = "rgba(76, 175, 80, 0.2)";
                copyContent.style.color = "#4CAF50";
                setTimeout(() => {
                    copyContent.innerHTML = originalText;
                    copyContent.style.backgroundColor = "";
                    copyContent.style.color = "";
                }, 2000);
            } catch (err) {
                console.error('复制失败: ', err);
                copyContent.innerHTML = '<i class="fas fa-times"></i> 复制失败';
                setTimeout(() => {
                    copyContent.innerHTML = '<i class="fas fa-copy"></i>';
                }, 2000);
            }
        } else {
            // 降级方案:仅复制文本
            navigator.clipboard.writeText(messageText)
                .then(() => {
                    const originalText = copyContent.innerHTML;
                    copyContent.innerHTML = '<i class="fas fa-check"></i> 已复制(仅文字)';
                    copyContent.style.backgroundColor = "rgba(76, 175, 80, 0.2)";
                    copyContent.style.color = "#4CAF50";
                    setTimeout(() => {
                        copyContent.innerHTML = originalText;
                        copyContent.style.backgroundColor = "";
                        copyContent.style.color = "";
                    }, 2000);
                })
                .catch(err => {
                    console.error('复制失败: ', err);
                    copyContent.innerHTML = '<i class="fas fa-times"></i> 复制失败';
                    setTimeout(() => {
                        copyContent.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 2000);
                });
        }
    };

    // 将按钮添加到容器中
    actionButtons.appendChild(copyContent);
    actionButtons.appendChild(reanswer);

    // 将按钮容器添加到AI消息元素中
    aiMessageElement.appendChild(actionButtons);
}

// Helper to convert Base64 Data URL or base64 string to Blob
function base64ToBlob(base64Input, mimeType) {
    let base64 = base64Input;
    // Check if it's a Data URL and extract base64 part
    if (base64Input.startsWith('data:')) {
        base64 = base64Input.split(',')[1];
    }

    if (!base64) {
        console.error("Invalid base64 data provided to base64ToBlob:", base64Input.substring(0, 50) + '...');
        return new Blob([], {type: mimeType});
    }
    try {
        const byteString = atob(base64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], {type: mimeType});
    } catch (e) {
        console.error("Error decoding base64 string in base64ToBlob:", e);
        return new Blob([], {type: mimeType});
    }
}

document.addEventListener('keydown', function (event) {
    // const textarea = document.getElementById('user-input');
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // 阻止默认的换行行为
        document.getElementById('send-button').click();
    } // Shift+Enter 会使用默认的换行行为
});

const textarea = document.getElementById('user-input');
if (textarea) {
    // Add input event listener
    textarea.addEventListener('input', function () {
        adjustTextareaHeight(this);
    });

    // Add keydown event listener for special keys
    textarea.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            document.getElementById('send-button').click();
        }
        // Allow Shift+Enter for new lines
        if (event.key === 'Enter' && event.shiftKey) {
            setTimeout(() => adjustTextareaHeight(this), 0);
        }
    });
}

function adjustTextareaHeight(textarea) {
    // 如果没有传入参数，则使用默认的文本区域
    const textareaElement = textarea || document.getElementById("user-input");
    if (!textareaElement) return;

    // 获取文本内容
    const textContent = textareaElement.value.trim();

    // 如果文本为空，重置为默认高度
    if (!textContent) {
        textareaElement.style.height = '44px';
        textareaElement.style.overflowY = 'hidden';
        return;
    }

    // 调整高度
    textareaElement.style.height = '5px';
    const scrollHeight = textareaElement.scrollHeight; // 稍微减少边距调整
    const maxHeight = 200; // 增加最大高度从120px到200px
    textareaElement.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    textareaElement.style.overflowY = scrollHeight > maxHeight ? 'scroll' : 'hidden';

    // 调整文本区域高度后，也调整聊天容器的高度
    setTimeout(maintainChatHeight, 0);
}

// 聊天容器高度维护函数
function maintainChatHeight() {
    const chatContainer = document.getElementById("chat-container");
    if (!chatContainer) return;

    // 获取保存的初始高度，如果有的话
    if (chatContainer.dataset.initialHeight) {
        chatContainer.style.height = `${chatContainer.dataset.initialHeight}px`;
    } else {
        // 如果没有初始高度，则调用完整的调整函数
        adjustChatContainerHeight();
    }
}

async function updateChatUI(id, historyData) {
    const chatContainer = document.getElementById("chat-container");
    chatContainer.style.display = "block"
    chatContainer.innerHTML = ""; // 清空现有内容

    let lastUserMessage = ""; // 用于存储最近一条用户消息
    // 遍历内容数组
    historyData.contents.forEach(content => {
        const conversationContainer = document.createElement("div");
        conversationContainer.className = "conversation";
        conversationContainer.dataset.content_id = content.content_id; // Add content ID as data attribute

        const messageElement = document.createElement("div");
        messageElement.className = `message ${content.role === "user" ? "user-message" : "ai-message"}`;

        let flag = false;
        if (content.role === "user") {
            messageElement.style.whiteSpace = "pre-wrap"; // 保留换行和空格

            const messageWrapper = document.createElement("div");
            messageWrapper.className = "message-wrapper";

            let inlineDataArray = [];
            content.parts.forEach(part => {
                if (part.text && !flag) {
                    const textDiv = document.createElement("div");
                    textDiv.className = "message-text";
                    textDiv.textContent = part.text;
                    messageWrapper.appendChild(textDiv);

                    // Add edit button
                    const editButtonDiv = document.createElement("div");
                    const editButton = document.createElement("button");
                    editButton.className = "edit-message-btn";
                    editButton.innerHTML = '<i class="fas fa-edit"></i>';
                    editButtonDiv.appendChild(editButton);

                    // Add copy userMessage button
                    const copyUserMessageButton = document.createElement("button");
                    copyUserMessageButton.className = "modern-copy-button";
                    copyUserMessageButton.innerHTML = '<i class="fas fa-copy"></i>';
                    editButtonDiv.appendChild(copyUserMessageButton);
                    // 收集所有的 inlineData
                    content.parts.forEach(p => {
                        if (p.inlineData) {
                            inlineDataArray.push(p.inlineData);
                        }
                    });

                    editButton.onclick = () => editMessage(messageElement, part.text, inlineDataArray);
                    copyUserMessageButton.onclick = () => copyMessage(messageElement, part.text, inlineDataArray);
                    messageWrapper.appendChild(editButtonDiv);
                    messageElement.appendChild(messageWrapper);
                    lastUserMessage = part.text;
                    flag = true;
                }
                if (part.inlineData) {
                    const container = document.createElement("div");
                    container.className = "file-container";
                    fileUI(container, part.inlineData, part.inlineData.mimeType);
                    messageElement.appendChild(container);
                }
            });
            conversationContainer.appendChild(messageElement);
        } else if (content.role === "model") {
            const aiMessageElementOnCopy = document.createElement("div");
            aiMessageElementOnCopy.className = "message copy ai-message";
            aiMessageElementOnCopy.style.display = "none";

            let aiText = "";
            content.parts.forEach(part => {
                if (part.text) {
                    const parsedText = marked.parse(part.text);
                    const textWrapper = document.createElement("div");
                    textWrapper.innerHTML = parsedText;
                    messageElement.appendChild(textWrapper);

                    aiMessageElementOnCopy.textContent += part.text;
                    aiText += part.text;
                }
                if (part.inlineData) {
                    const container = document.createElement("div");
                    container.className = "file-container";
                    fileUI(container, part.inlineData, part.inlineData.mimeType);
                    messageElement.appendChild(container);
                }
            });


            // 手动执行代码高亮
            const codeBlocks = messageElement.querySelectorAll('pre code');
            codeBlocks.forEach(block => {
                hljs.highlightElement(block);
            });

            chatContainer.scrollTop = chatContainer.scrollHeight;
            conversationContainer.appendChild(messageElement);

            // 使用新的按钮添加方式
            addActionButtons(messageElement, aiText);
        }
        chatContainer.appendChild(conversationContainer);
    });

    // 滚动条保持在底部
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 启用代码块复制功能
    enableCodeCopy();

    // 调整聊天容器高度
    adjustChatContainerHeight();
}

function fileUI(container, fileData, mimeType) {
    if (!fileData || !fileData.data || !mimeType) {
        console.error("Invalid data passed to fileUI:", fileData, mimeType);
        container.textContent = "[无效文件数据]";
        container.style.color = 'red';
        return;
    }
    const base64Data = fileData.data;
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    container.innerHTML = ''; // Clear previous content

    if (mimeType.startsWith('image/')) {
        // ... (image handling - no changes) ...
        const imgContainer = document.createElement("div");
        imgContainer.className = "image-thumbnail-container";
        const img = document.createElement("img");
        img.src = dataUrl;
        img.className = "image-thumbnail";
        img.alt = "图片预览";
        img.loading = "lazy";
        img.onclick = () => createMediaModal(img.src, 'image');
        imgContainer.appendChild(img);
        container.appendChild(imgContainer);

    } else if (mimeType.startsWith('video/')) {
        // ... (video handling - no changes) ...
        const videoContainer = document.createElement("div");
        videoContainer.className = "video-container";
        videoContainer.style.maxWidth = "300px"; // Or adjust as needed
        videoContainer.style.margin = "10px 0";
        const video = document.createElement("video");
        video.src = dataUrl;
        video.controls = true;
        video.style.width = "100%"; // Videos usually handle width well
        video.style.borderRadius = "8px";
        video.style.border = "1px solid var(--border-color)";
        video.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
        video.style.display = 'block'; // Ensure block display
        video.style.cursor = "pointer";
        video.onclick = (e) => {
            if (e.target === video) createMediaModal(video.src, 'video');
        };
        videoContainer.appendChild(video);
        container.appendChild(videoContainer);

    } else if (mimeType.startsWith('audio/')) {
        // --- Audio Handling with Improved Sizing ---
        const audioDisplayContainer = document.createElement("div");
        audioDisplayContainer.className = "audio-display-container";
        audioDisplayContainer.style.margin = "10px 0";
        audioDisplayContainer.style.padding = "10px";
        audioDisplayContainer.style.borderRadius = "8px";
        audioDisplayContainer.style.border = "1px solid var(--border-color)";
        audioDisplayContainer.style.backgroundColor = "var(--bg-color-secondary, rgba(0, 0, 0, 0.03))"; // Use secondary bg if available
        audioDisplayContainer.style.boxSizing = "border-box"; // Include padding in width calc

        // ** Sizing constraints for the container **
        audioDisplayContainer.style.minWidth = "280px"; // Minimum width needed for controls (adjust if needed)
        audioDisplayContainer.style.maxWidth = "100%";  // Don't exceed parent width

        // Header: Icon and Filename
        const audioHeader = document.createElement("div");
        audioHeader.style.display = "flex";
        audioHeader.style.alignItems = "center";
        audioHeader.style.marginBottom = "8px";

        const audioIcon = document.createElement("i");
        audioIcon.className = "fas fa-music"; // Or far fa-file-audio
        audioIcon.style.marginRight = "10px";
        audioIcon.style.color = "var(--text-secondary-color)";
        audioIcon.style.fontSize = "1.2em";
        audioHeader.appendChild(audioIcon);

        const fileExtension = getFileType(mimeType);
        const fileNameSpan = document.createElement("span");
        fileNameSpan.textContent = `audio.${fileExtension}`;
        fileNameSpan.style.fontSize = "14px";
        fileNameSpan.style.fontWeight = "500";
        fileNameSpan.style.overflow = "hidden";
        fileNameSpan.style.whiteSpace = "nowrap";
        fileNameSpan.style.textOverflow = "ellipsis";
        // Allow filename to shrink if needed, but prevent wrapping
        fileNameSpan.style.minWidth = '0';
        audioHeader.appendChild(fileNameSpan);

        audioDisplayContainer.appendChild(audioHeader);

        // Audio Element with Controls
        const audio = document.createElement("audio");
        audio.src = dataUrl;
        audio.controls = true;
        // ** Remove explicit width: 100% from audio element **
        // audio.style.width = "100%"; // REMOVED
        audio.style.display = "block"; // Keep block display
        audio.style.maxWidth = "100%"; // Ensure audio element itself doesn't overflow container


        audioDisplayContainer.appendChild(audio);
        container.appendChild(audioDisplayContainer);
        // --- End Audio Handling ---

    } else { // Handle other files (PDF, Text, Generic)
        // ... (handling for other files - minor change for consistency) ...
        const fileContainer = document.createElement("div");
        fileContainer.className = "file-link-container";
        fileContainer.style.display = "flex";
        fileContainer.style.alignItems = "center";
        fileContainer.style.padding = "8px 12px";
        fileContainer.style.margin = "8px 0";
        fileContainer.style.backgroundColor = "var(--bg-color)";
        fileContainer.style.border = "1px solid var(--border-color)";
        fileContainer.style.borderRadius = "6px";

        const fileIcon = document.createElement("i");
        fileIcon.className = getFileIcon(mimeType);
        fileIcon.style.marginRight = "10px";
        fileIcon.style.fontSize = "1.2em";
        fileIcon.style.color = "var(--text-secondary-color)";

        const fileName = document.createElement("span");
        fileName.textContent = `file.${getFileType(mimeType)}`; // Consistent naming
        fileName.style.marginRight = "auto";
        fileName.style.fontSize = "14px";
        fileName.style.overflow = "hidden";
        fileName.style.whiteSpace = "nowrap";
        fileName.style.textOverflow = "ellipsis";
        fileName.style.minWidth = '0'; // Allow shrinking

        const buttonsContainer = document.createElement("div");
        buttonsContainer.style.display = "flex";
        buttonsContainer.style.alignItems = "center";
        buttonsContainer.style.marginLeft = "10px";
        buttonsContainer.style.flexShrink = "0"; // Prevent buttons wrapping

        if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) {
            const previewButton = document.createElement("button");
            previewButton.className = "file-action-btn file-preview-btn";
            previewButton.innerHTML = '<i class="far fa-eye"></i>';
            previewButton.title = "预览";
            previewButton.onclick = () => createDocumentModal(base64Data, mimeType);
            buttonsContainer.appendChild(previewButton);
        }

        const downloadLink = document.createElement("a");
        downloadLink.href = dataUrl;
        downloadLink.download = `file.${getFileType(mimeType).toLowerCase()}`;
        downloadLink.className = "file-action-btn file-download-btn";
        downloadLink.innerHTML = '<i class="fas fa-download"></i>';
        downloadLink.title = "下载";
        buttonsContainer.appendChild(downloadLink);

        fileContainer.appendChild(fileIcon);
        fileContainer.appendChild(fileName);
        fileContainer.appendChild(buttonsContainer);
        container.appendChild(fileContainer);
    }
}

function createMediaModal(src, type) {
    const modal = document.createElement("div");
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.backgroundColor = "rgba(0,0,0,0.9)";
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";
    modal.style.zIndex = "1000";

    // 添加关闭按钮
    const closeButton = document.createElement("button");
    closeButton.innerHTML = "×";
    closeButton.style.position = "absolute";
    closeButton.style.top = "20px";
    closeButton.style.right = "20px";
    closeButton.style.backgroundColor = "transparent";
    closeButton.style.border = "none";
    closeButton.style.color = "white";
    closeButton.style.fontSize = "30px";
    closeButton.style.cursor = "pointer";
    closeButton.style.zIndex = "1001";
    closeButton.onclick = () => modal.remove();

    const mediaElement = type === 'image'
        ? document.createElement("img")
        : document.createElement("video");

    mediaElement.src = src;
    mediaElement.style.maxWidth = "90%";
    mediaElement.style.maxHeight = "90vh";
    mediaElement.style.objectFit = "contain";
    mediaElement.style.borderRadius = "4px";
    mediaElement.style.boxShadow = "0 0 20px rgba(0,0,0,0.5)";

    if (type === 'video') {
        mediaElement.controls = true;
    }

    modal.appendChild(closeButton);
    modal.appendChild(mediaElement);
    document.body.appendChild(modal);

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };
}

function createDocumentModal(base64Data, mimeType) {
    const modal = document.createElement("div");
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.backgroundColor = "rgba(0,0,0,0.9)";
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";
    modal.style.zIndex = "1000";

    // 添加关闭按钮
    const closeButton = document.createElement("button");
    closeButton.innerHTML = "×";
    closeButton.style.position = "absolute";
    closeButton.style.top = "20px";
    closeButton.style.right = "20px";
    closeButton.style.backgroundColor = "transparent";
    closeButton.style.border = "none";
    closeButton.style.color = "white";
    closeButton.style.fontSize = "30px";
    closeButton.style.cursor = "pointer";
    closeButton.style.zIndex = "1001";
    closeButton.onclick = () => modal.remove();

    const isDarkTheme = localStorage.getItem('theme') === 'dark-theme';

    if (mimeType === 'application/pdf') {
        const iframe = document.createElement("iframe");
        iframe.src = `data:${mimeType};base64,${base64Data}`;
        iframe.style.width = "80%";
        iframe.style.height = "80%";
        iframe.style.border = "none";
        iframe.style.borderRadius = "8px";
        iframe.style.backgroundColor = "white";
        iframe.style.boxShadow = "0 0 20px rgba(0,0,0,0.5)";
        modal.appendChild(iframe);
    } else {
        const textContainer = document.createElement("div");
        textContainer.style.backgroundColor = isDarkTheme ? '#2d2d2d' : 'white';
        textContainer.style.color = isDarkTheme ? '#e0e0e0' : 'black';
        textContainer.style.padding = "20px";
        textContainer.style.width = "70%";
        textContainer.style.height = "70%";
        textContainer.style.overflowY = "auto";
        textContainer.style.whiteSpace = "pre-wrap";
        textContainer.style.borderRadius = "8px";
        textContainer.style.boxShadow = isDarkTheme ?
            "0 4px 6px rgba(0, 0, 0, 0.5)" :
            "0 4px 6px rgba(0, 0, 0, 0.1)";
        textContainer.style.fontFamily = "monospace";
        textContainer.style.fontSize = "14px";
        textContainer.style.lineHeight = "1.5";

        // 正确解码UTF-8编码的base64文本
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        textContainer.textContent = new TextDecoder('utf-8').decode(bytes);

        modal.appendChild(textContainer);
    }

    modal.appendChild(closeButton);
    document.body.appendChild(modal);

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };
}

async function loadHistoryById(id, title) {
    try {
        document.body.classList.remove('input-centered');
        const response = await fetch(`/findHistory/${id}`, {method: 'PUT'});
        if (!response.ok) {
            throw new Error(`加载历史记录失败: ${response.status}`);
        }
        const historyData = await response.json();

        if (title !== "") {
            // 将title转换为字符串并去掉换行符
            title = String(title);
            title = title.replace(/\n/g, "");

            // 补充标题至40个字符
            while (Array.from(title).length < 40) {
                title += ' ';
            }
        }

        // 更新聊天界面
        await updateChatUI(id, historyData);

        // 存储当前对话的sessionId
        sessionStorage.setItem("sessionId", id);

        // 在历史记录中添加高亮效果
        highlightActiveHistory(id);
        // 在完成加载后调整高度
        setTimeout(() => {
            adjustChatContainerHeight();
            if (title !== "") {
                setupScrollListener(document.getElementById("chat-container"));
                scrollToBottom(document.getElementById("chat-container"));
                document.title = title
            }
        }, 200);
    } catch (error) {
        console.error("Failed to load history:", error);
    }
}

function highlightActiveHistory(id) {
    // 获取历史记录列表
    const historyList = document.getElementById("history-list");
    const historyItems = historyList.getElementsByTagName("li");

    // 遍历所有历史记录项，移除所有项的 'active' 类
    for (let item of historyItems) {
        item.classList.remove("active");
    }

    // 根据ID找到当前被点击的历史记录项，添加 'active' 类
    const activeItem = Array.from(historyItems).find(item => {
        return item.dataset.sessionId === id.toString(); // 查找匹配的sessionId
    });

    if (activeItem) {
        activeItem.classList.add("active"); // 为当前历史记录项添加active类
    }
}

function updateHistoryList(historyData) {
    const historyList = document.getElementById("history-list");
    historyList.innerHTML = ""; // 清空列表

    if (historyData && Array.isArray(historyData)) {
        historyData.forEach(item => {
            const li = document.createElement("li");
            li.dataset.sessionId = item.session_id;

            // 显示标题或"无消息"，并固定长度为40个字符
            const titleSpan = document.createElement("span");
            while (Array.from(item.title.replace(/\n/g, "")).length < 40) {
                item.title += ' ';
            }
            titleSpan.textContent = item.title;
            titleSpan.style.whiteSpace = "nowrap";
            li.appendChild(titleSpan);

            const actionSpan = document.createElement("span")
            actionSpan.className = "history-actions";
            const editButton = document.createElement("button");
            editButton.innerHTML = '<i class="fas fa-pencil-alt"></i>';

            editButton.className = "history-action-btn history-edit-btn";
            editButton.title = "编辑";
            editButton.addEventListener("click", (event) => {
                event.stopPropagation();
                console.log("Edit clicked for:", item.session_id);
                editHistory(item.session_id);
            });
            const deleteButton = document.createElement("button");
            deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';

            deleteButton.className = "history-action-btn history-delete-btn";
            deleteButton.title = "删除";
            deleteButton.addEventListener("click", (event) => {
                event.stopPropagation();
                console.log("Delete clicked for:", item.session_id);
                deleteHistory(item.session_id);
            });
            actionSpan.appendChild(editButton)
            actionSpan.appendChild(deleteButton);
            li.appendChild(actionSpan);

            // 点击列表项加载历史记录
            li.addEventListener("click", (event) => {
                loadHistoryById(item.session_id, item.title.toString());
            });

            historyList.appendChild(li);
        });
    } else {
        const li = document.createElement("li");
        li.textContent = "暂无历史记录";
        historyList.appendChild(li);
    }
}

// 删除历史记录函数
function deleteHistory(sessionId) {
    if (confirm("确定要删除该历史记录吗？")) {
        // 调用后端接口删除记录
        fetch(`/deleteHistory/${sessionId}`, {method: "DELETE"})
            .then(response => {
                if (response.ok) {
                    // 刷新历史记录列表
                    historyList().then()
                    const id = sessionStorage.getItem("sessionId")
                    if (sessionId == id) {
                        startNewConversation()
                    }
                } else {
                    alert("删除失败，请重试！");
                }
            })
            .catch(error => {
                console.error("删除时发生错误:", error);
                alert("删除时发生错误！");
            });
    }
}

// 编辑历史记录函数
function editHistory(sessionId) {
    const newTitle = prompt("请输入新的标题：");
    if (newTitle) {
        // 调用后端接口更新标题
        fetch(`/edit-history/${sessionId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({title: newTitle})
        })
            .then(response => {
                if (response.ok) {
                    // 刷新历史记录列表
                    historyList()
                } else {
                    alert("编辑失败，请重试！");
                }
            })
            .catch(error => {
                console.error("编辑时发生错误:", error);
                alert("编辑时发生错误！");
            });
    }
}

function getSessionId() {
    let sessionId = sessionStorage.getItem('sessionId');

    // 关键修改：如果 sessionId 不存在，则返回 0
    if (!sessionId) {
        return 0;
    }

    return parseInt(sessionId); // 仍然需要转换为整数
}

function startNewConversation() {
    // 重置本地会话 ID
    sessionStorage.removeItem('sessionId'); // 或生成一个新的唯一 ID并设置
    sessionStorage.setItem('sessionId', "");

    // 清空聊天区域内容
    const chatContainer = document.getElementById("chat-container");
    chatContainer.innerHTML = "";

    // Remove active class from history item (if any)
    const historyList = document.getElementById("history-list");
    if (historyList) {
        const historyItems = historyList.getElementsByTagName("li");
        for (let item of historyItems) {
            item.classList.remove("active");
        }
    }

    // 清除文件相关内容
    const fileInput = document.getElementById("file-input");
    if (fileInput) {
        fileInput.value = "";
    }
    const uploadedFilesInfo = document.getElementById("uploaded-files-info");
    if (uploadedFilesInfo) {
        uploadedFilesInfo.innerHTML = "";
        uploadedFilesInfo.style.display = "none";
    }
    uploadedFiles = []; // 清空全局文件数组

    updateInputCentering();

    const mainContainer = document.getElementById("main-container");
    const toggleHistoryBtn = document.getElementById("toggle-history-btn");
    if (mainContainer && mainContainer.classList.contains("show-history")) {
        mainContainer.classList.remove("show-history");
        if (toggleHistoryBtn) {
            toggleHistoryBtn.title = "显示历史记录";
            toggleHistoryBtn.innerHTML = '<i class="fas fa-history"></i>';
        }
        // 隐藏后重新计算高度
        setTimeout(adjustChatContainerHeight, 310);
    } else {
        // 即使没隐藏，也重新计算一下高度
        adjustChatContainerHeight();
    }

    chatContainer.style.display = "none";
    console.log("Conversation reset successfully.");
}

// 页面加载时默认不需要加载历史记录，因为它是隐藏的
window.onload = async () => {
    // 初始计算高度
    adjustChatContainerHeight();
    updateInputCentering();
};

async function historyList() {
    try {
        const historyResponse = await fetch("/historyList", {method: "GET"});
        if (!historyResponse.ok) {
            console.error(`History API error: ${historyResponse.status}`);
            return;
        }
        const historyData = await historyResponse.json();
        updateHistoryList(historyData);
    } catch (error) {
        console.error("Error loading history on page load:", error);
    }
}

document.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && event.ctrlKey) {
        document.getElementById('send-button').click();
    }
});

window.addEventListener("beforeunload", function () {
    setTimeout(() => {
        sessionStorage.setItem("sessionId", "");
    }, 0);
});

async function exportToMd() {
    const id = getSessionId();
    const resp = await fetch(`/share/${id}`, {method: 'POST'});
    if (!resp.ok) {
        console.error('导出失败', resp.statusText);
        return;
    }

    // 1. 读取为 Blob
    const blob = await resp.blob();
    // 2. 生成本地对象 URL
    const url = URL.createObjectURL(blob);

    // 3. 从头部解析文件名
    const disposition = resp.headers.get('Content-Disposition') || '';
    let filename = 'chat_transcript.md';

    // 优先匹配 filename*=UTF-8''xxx
    let match = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    if (match) {
        try {
            filename = decodeURIComponent(match[1]);
        } catch (e) {
            console.warn('filename* 解码失败，使用原始值', match[1]);
            filename = match[1];
        }
    } else {
        // 回退去匹配 filename="..."
        match = disposition.match(/filename\s*=\s*"([^"]+)"/i);
        if (match) {
            filename = match[1];
        }
    }

    // 4. 创建并点击下载链接
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 5. 释放资源
    URL.revokeObjectURL(url);
}

function getFileIcon(mimeType) {
    // 添加一个检查，以防 mimeType 为 null 或 undefined
    if (!mimeType) {
        return 'far fa-file'; // 或者返回一个特定的“未知”图标
    }

    if (mimeType.startsWith('image/')) {
        return 'far fa-file-image';
    } else if (mimeType.startsWith('video/')) {
        return 'far fa-file-video';
    } else if (mimeType.startsWith('audio/')) {
        return 'far fa-file-audio';
    } else if (mimeType === 'application/pdf') {
        return 'far fa-file-pdf';
    } else if (mimeType.includes('word') || mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return 'far fa-file-word';
    } else if (mimeType.includes('excel') || mimeType === 'application/vnd.ms-excel' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        return 'far fa-file-excel';
    } else if (mimeType === 'text/csv') {
        return 'far fa-file-csv';
    } else if (mimeType.includes('powerpoint') || mimeType === 'application/vnd.ms-powerpoint' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        return 'far fa-file-powerpoint';
    } else if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed' || mimeType === 'application/x-rar-compressed' || mimeType === 'application/x-7z-compressed' || mimeType === 'application/gzip' || mimeType === 'application/x-tar') { // **扩展: 更多压缩格式**
        return 'far fa-file-archive';
    } else if (mimeType === 'text/plain' || mimeType === 'text/rtf' || mimeType.includes('markdown') || mimeType === 'text/md') {
        return 'far fa-file-alt';
    } else if (
        mimeType === 'text/html' ||
        mimeType === 'application/xhtml+xml' ||
        mimeType === 'text/css' || // <--- 添加了 CSS 支持
        mimeType.includes('javascript') || // 涵盖 text/javascript, application/javascript 等
        mimeType.includes('python') ||     // 涵盖 text/x-python, application/x-python-code 等
        mimeType === 'application/json' || // 可选：添加 JSON 支持
        mimeType.includes('xml') && mimeType !== 'application/xhtml+xml' // 可选：添加通用 XML 支持 (排除 XHTML)
    ) {
        return 'far fa-file-code'; // 将 HTML, CSS, JS, Python, JSON, XML 归为代码文件
    } else {
        return 'far fa-file'; // 默认图标
    }
}

function getFileType(mimeType) {
    if (!mimeType) return 'bin';
    const parts = mimeType.split('/');
    return parts[1] ? parts[1].replace(/[^a-z0-9]/gi, '').toLowerCase() : 'bin';
}
// 全局变量，用于存储 SSE 连接的 reader，以便在需要时取消
let sseReader = null;
// 标记是否自动滚动
let autoScroll = true;
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

    // 添加窗口大小调整监听
    adjustChatContainerHeight();

    // 添加窗口大小变化监听
    window.addEventListener('resize', adjustChatContainerHeight);
});

// 调整聊天容器高度的函数
function adjustChatContainerHeight() {
    const chatContainer = document.getElementById('chat-container');
    const inputContainer = document.getElementById('input-container');
    const mainContainer = document.getElementById('main-container');

    if (!chatContainer || !inputContainer || !mainContainer) return;

    // 计算可用高度
    const availableHeight = mainContainer.clientHeight;
    const inputHeight = inputContainer.offsetHeight;
    const padding = 20; // 留一些间距

    // 设置聊天容器高度
    chatContainer.style.height = `${availableHeight - inputHeight - padding + 5}px`;
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
    // Check if the paste event contains files
    if (event.clipboardData.files.length > 0) {
        event.preventDefault();
        handleFiles(event.clipboardData.files);
        const fileInput = document.getElementById("file-input");
        fileInput.files = event.clipboardData.files;
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

async function sendMessage(isReply) {
    const inputField = document.getElementById("user-input");
    const chatContainer = document.getElementById("chat-container");
    const fileInput = document.getElementById("file-input");
    const uploadedFilesInfo = document.getElementById("uploaded-files-info");

    const userMessage = inputField.value.trim();

    // 从inputField的dataset中获取content_id（如果存在）
    const content_id = parseInt(inputField.dataset.content_id || "0");

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
    const {aiMessageElement, aiMessageElementOnCopy} = createAIMessageElements(conversationContainer);
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

    try {
        let sessionId = getSessionId();
        let flag = !sessionId;

        const chatResponse = await fetchChatResponse(userMessage, sessionId, content_id, fileBase64s, isReply);
        if (!chatResponse.ok) {
            if (chatResponse.status === 429) {
                throw new Error('发生了错误，请切换模型并刷新重试');
            }
            throw new Error(`Chat API error: ${chatResponse.status} - ${await getErrorMessage(chatResponse)}`);
        }

        await handleChatResponse(chatResponse, aiMessageElement, aiMessageElementOnCopy, chatContainer, userMessage);

        if (flag) {
            await handleNewSession(userMessage, sessionId);
        }

        await updateHistoryListFromServer();
        await loadHistoryById(getSessionId(), "")

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
    }
}

function createConversationContainer(userMessage, fileBase64s = []) {
    const conversationContainer = document.createElement("div");
    conversationContainer.className = "conversation";

    const userMessageElement = document.createElement("div");
    userMessageElement.className = "message user-message";
    userMessageElement.style.whiteSpace = "pre-wrap";

    // Create wrapper for message content and edit button
    const messageWrapper = document.createElement("div");
    messageWrapper.className = "message-wrapper";

    // Add edit button
    const editButton = document.createElement("button");
    editButton.className = "edit-message-btn";
    editButton.innerHTML = '<i class="fas fa-edit"></i>';
    editButton.onclick = () => editMessage(userMessageElement, userMessage, fileBase64s);

    // Handle the text message
    const textDiv = document.createElement("div");
    textDiv.className = "message-text";
    textDiv.textContent = userMessage;

    messageWrapper.appendChild(textDiv);
    messageWrapper.appendChild(editButton);
    userMessageElement.appendChild(messageWrapper);

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

    conversationContainer.appendChild(userMessageElement);
    return conversationContainer;
}

function editMessage(messageElement, originalText, originalFiles = []) {
    const editContainer = document.createElement("div");
    editContainer.className = "edit-container";

    // Create textarea for text editing
    const textarea = document.createElement("textarea");
    textarea.className = "edit-textarea";
    textarea.value = originalText;
    textarea.style.width = "100%";
    textarea.style.minHeight = "60px";
    textarea.style.resize = "vertical";
    textarea.addEventListener('input', () => adjustTextareaHeight(textarea));

    // Create file input for new files
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.className = "edit-file-input";

    // Create buttons container
    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "edit-buttons";

    // Save button
    const saveButton = document.createElement("button");
    saveButton.className = "save-edit-btn";
    saveButton.textContent = "提交";
    saveButton.onclick = async () => {
        // Get the chat container for scrolling
        const chatContainer = document.getElementById("chat-container");

        // Set the input field value and prepare file handling
        const inputField = document.getElementById("user-input");
        inputField.value = textarea.value;

        // Get content_id from the parent conversation container
        const conversation = messageElement.closest('.conversation');
        inputField.dataset.content_id = conversation ? conversation.dataset.content_id : null;

        // Handle files
        const newFiles = await handleFileInput(fileInput);
        const dt = new DataTransfer();

        // Add existing files
        if (originalFiles && originalFiles.length > 0) {
            originalFiles.forEach(file => {
                const blob = base64ToBlob(file.data, file.mimeType);
                const existingFile = new File([blob], `file.${file.mimeType.split('/')[1]}`, {type: file.mimeType});
                dt.items.add(existingFile);
            });
        }

        // Add new files
        if (newFiles.length > 0) {
            newFiles.forEach(file => {
                const blob = base64ToBlob(file.data, file.mimeType);
                const newFile = new File([blob], `file.${file.mimeType.split('/')[1]}`, {type: file.mimeType});
                dt.items.add(newFile);
            });
        }

        // Set combined files to global file input
        document.getElementById("file-input").files = dt.files;

        // Remove edit container before sending message
        editContainer.remove();

        // Enable auto-scroll
        autoScroll = true;

        // Send message and scroll to bottom
        await sendMessage(true);
        scrollToBottom(chatContainer);
    };

    // Cancel button
    const cancelButton = document.createElement("button");
    cancelButton.className = "cancel-edit-btn";
    cancelButton.textContent = "取消";
    cancelButton.onclick = () => {
        messageElement.innerHTML = '';
        updateMessage(messageElement, originalText, originalFiles);
        editContainer.remove();
    };

    // Assemble edit container components
    buttonsContainer.appendChild(saveButton);
    buttonsContainer.appendChild(cancelButton);
    editContainer.appendChild(textarea);
    editContainer.appendChild(fileInput);
    editContainer.appendChild(buttonsContainer);

    // Replace original content with edit container
    messageElement.innerHTML = '';
    messageElement.appendChild(editContainer);

    // Adjust textarea height
    adjustTextareaHeight(textarea);
}

function updateMessage(messageElement, newText, newFiles) {
    const messageWrapper = document.createElement("div");
    messageWrapper.className = "message-wrapper";

    const textDiv = document.createElement("div");
    textDiv.className = "message-text";
    textDiv.textContent = newText;

    const editButton = document.createElement("button");
    editButton.className = "edit-message-btn";
    editButton.innerHTML = '<i class="fas fa-edit"></i>';
    editButton.onclick = () => editMessage(messageElement, newText, newFiles);

    messageWrapper.appendChild(textDiv);
    messageWrapper.appendChild(editButton);
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

async function handleFileInput(fileInput) {
    const files = Array.from(fileInput.files);
    const fileBase64s = [];

    for (const file of files) {
        const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });

        fileBase64s.push({
            mimeType: file.type,
            data: base64.split(',')[1]
        });
    }

    return fileBase64s;
}

async function fetchChatResponse(userMessage, sessionId, content_id, fileBase64s, isReply) {
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
    });
}

async function getErrorMessage(response) {
    const errorData = await response.json();
    return errorData.message || 'Unknown error';
}

function createAIMessageElements(conversationContainer) {
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

    conversationContainer.appendChild(aiMessageElement);
    return {aiMessageElement, aiMessageElementOnCopy};
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
        addActionButtons(aiMessageElement, userMessage);
        enableCodeCopy();
    }
}

function setupScrollListener(chatContainer) {
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
        document.getElementById("conversation-title").textContent = title || "AI Chat";
        document.getElementById("conversation-title").style.whiteSpace = "nowrap";
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
        copyButton.textContent = "复制";
        copyButton.style.position = "absolute";
        copyButton.style.right = "10px";
        copyButton.style.top = "10px";
        copyButton.style.zIndex = "10";
        copyButton.style.padding = "5px";
        copyButton.style.backgroundColor = "#007BFF";
        copyButton.style.color = "white";
        copyButton.style.border = "none";
        copyButton.style.borderRadius = "3px";
        copyButton.style.cursor = "pointer";

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
    reanswer.onclick = function (e) {
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

                fileContainers.forEach((container, index) => {

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
            sendMessage(true);
        } catch (error) {
            console.error("重新回答时发生错误:", error);
        }
    };

    // 创建复制对话内容按钮
    const copyContent = document.createElement("button");
    copyContent.className = "copy-content-btn";
    copyContent.innerHTML = '<i class="fas fa-copy"></i>';
    copyContent.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();

        // 复制AI回复内容到剪贴板
        navigator.clipboard.writeText(messageText)
            .then(() => {
                // 临时改变按钮文本表示复制成功
                const originalText = copyContent.innerHTML;
                copyContent.innerHTML = '<i class="fas fa-check"></i> 已复制';
                copyContent.style.backgroundColor = "rgba(76, 175, 80, 0.2)";
                copyContent.style.color = "#4CAF50";

                // 2秒后恢复原始文本
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
                    copyContent.innerHTML = '<i class="fas fa-copy"></i> 复制内容';
                }, 2000);
            });
    };

    // 将按钮添加到容器中
    actionButtons.appendChild(copyContent);
    actionButtons.appendChild(reanswer);

    // 将按钮容器添加到AI消息元素中
    aiMessageElement.appendChild(actionButtons);
}

function base64ToBlob(base64, mimeType) {
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], {type: mimeType});
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
        textareaElement.style.height = '';
        textareaElement.style.height = '40px';
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
                    const editButton = document.createElement("button");
                    editButton.className = "edit-message-btn";
                    editButton.innerHTML = '<i class="fas fa-edit"></i>';

                    // 收集所有的 inlineData
                    content.parts.forEach(p => {
                        if (p.inlineData) {
                            inlineDataArray.push(p.inlineData);
                        }
                    });

                    editButton.onclick = () => editMessage(messageElement, part.text, inlineDataArray);
                    messageWrapper.appendChild(editButton);
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
                    messageElement.innerHTML += marked.parse(part.text);
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

function fileUI(container, part, mimeType) {
    if (mimeType.startsWith('image/')) {
        // Handle images
        const imgContainer = document.createElement("div");
        imgContainer.className = "image-thumbnail-container";

        const img = document.createElement("img");
        img.src = `data:${mimeType};base64,${part.data}`;
        img.className = "image-thumbnail";
        img.alt = "Image preview";
        img.loading = "lazy"; // 延迟加载
        img.onclick = () => createMediaModal(img.src, 'image');

        imgContainer.appendChild(img);
        container.appendChild(imgContainer);
    } else if (mimeType.startsWith('video/')) {
        // Handle videos
        const videoContainer = document.createElement("div");
        videoContainer.className = "video-container";
        videoContainer.style.maxWidth = "300px";
        videoContainer.style.margin = "10px 0";

        const video = document.createElement("video");
        video.src = `data:${mimeType};base64,${part.data}`;
        video.controls = true;
        video.style.width = "100%";
        video.style.borderRadius = "8px";
        video.style.border = "1px solid var(--border-color)";
        video.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
        video.style.cursor = "pointer";
        video.onclick = (e) => {
            // 点击视频但不是控制按钮时，打开模态框
            if (e.target === video) {
                createMediaModal(video.src, 'video');
            }
        };

        videoContainer.appendChild(video);
        container.appendChild(videoContainer);
    } else if (mimeType.startsWith('audio/')) {
        // Handle audio
        const audioContainer = document.createElement("div");
        audioContainer.className = "audio-container";
        audioContainer.style.margin = "10px 0";
        audioContainer.style.padding = "10px";
        audioContainer.style.borderRadius = "8px";
        audioContainer.style.border = "1px solid var(--border-color)";
        audioContainer.style.backgroundColor = "rgba(0, 0, 0, 0.03)";

        const audioIcon = document.createElement("i");
        audioIcon.className = "fas fa-music";
        audioIcon.style.marginRight = "10px";
        audioIcon.style.color = "var(--text-color)";

        const audio = document.createElement("audio");
        audio.src = `data:${mimeType};base64,${part.data}`;
        audio.controls = true;
        audio.style.width = "calc(100% - 30px)";

        audioContainer.appendChild(audioIcon);
        audioContainer.appendChild(audio);
        container.appendChild(audioContainer);
    } else if (mimeType.startsWith('text/') || mimeType === 'application/pdf') {
        // Handle text files and PDFs
        const fileContainer = document.createElement("div");
        fileContainer.className = "file-link-container";

        const fileIcon = document.createElement("i");
        fileIcon.className = getFileIcon(mimeType);

        const fileName = document.createElement("span");
        fileName.textContent = getFileType(mimeType);
        fileName.style.marginRight = "auto";

        const buttonsContainer = document.createElement("div");
        buttonsContainer.style.display = "flex";

        const previewButton = document.createElement("button");
        previewButton.className = "file-preview-btn";
        previewButton.innerHTML = '<i class="far fa-eye"></i> 预览';
        previewButton.onclick = () => createDocumentModal(part.data, mimeType);

        const downloadLink = document.createElement("a");
        downloadLink.href = `data:${mimeType};base64,${part.data}`;
        downloadLink.download = `file.${getFileType(mimeType).toLowerCase()}`;
        downloadLink.className = "file-download-btn";
        downloadLink.innerHTML = '<i class="fas fa-download"></i> 下载';

        buttonsContainer.appendChild(previewButton);
        buttonsContainer.appendChild(downloadLink);

        fileContainer.appendChild(fileIcon);
        fileContainer.appendChild(fileName);
        fileContainer.appendChild(buttonsContainer);
        container.appendChild(fileContainer);
    } else {
        // Handle other files with download only
        const fileContainer = document.createElement("div");
        fileContainer.className = "file-link-container";

        const fileIcon = document.createElement("i");
        fileIcon.className = getFileIcon(mimeType);

        const fileName = document.createElement("span");
        fileName.textContent = getFileType(mimeType);
        fileName.style.marginRight = "auto";

        const downloadLink = document.createElement("a");
        downloadLink.href = `data:${mimeType};base64,${part.data}`;
        downloadLink.download = `file.${getFileType(mimeType).toLowerCase()}`;
        downloadLink.className = "file-download-btn";
        downloadLink.innerHTML = '<i class="fas fa-download"></i> 下载';

        fileContainer.appendChild(fileIcon);
        fileContainer.appendChild(fileName);
        fileContainer.appendChild(downloadLink);
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

            // 设置当前对话标题
            document.getElementById("conversation-title").textContent = title || "AI Chat";
            document.getElementById("conversation-title").style.whiteSpace = "nowrap";
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
            scrollToBottom(document.getElementById("chat-container"));
        }, 200);

        return true;
    } catch (error) {
        console.error("Failed to load history:", error);
        return false;
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

            // 省略号按钮（...）
            const moreButton = document.createElement("button");
            moreButton.innerHTML = "..."; // 使用三个点表示
            moreButton.style.marginRight = "10px"; // 按钮与标题之间的间距
            moreButton.addEventListener("click", (event) => {
                event.stopPropagation();

                const menu = document.createElement("div");
                menu.style.position = "absolute";
                menu.style.backgroundColor = "#1a1a2a";
                menu.style.border = "1px solid #ccc";
                menu.style.padding = "10px";
                menu.style.zIndex = "1000";
                menu.style.top = `${event.clientY}px`;
                menu.style.left = `${event.clientX}px`;

                const editOption = document.createElement("div");
                editOption.textContent = "编辑";
                editOption.className = "history-menu-item edit-option";  // 添加 class
                editOption.addEventListener("click", () => {
                    editHistory(item.session_id);
                    menu.remove(); // 关闭菜单
                });
                menu.appendChild(editOption);

                const deleteOption = document.createElement("div");
                deleteOption.textContent = "删除";
                deleteOption.className = "history-menu-item delete-option"; // 添加 class
                deleteOption.addEventListener("click", () => {
                    deleteHistory(item.session_id);
                    menu.remove(); // 关闭菜单
                });
                menu.appendChild(deleteOption);

                document.body.appendChild(menu);

                document.addEventListener("click", () => {
                    menu.remove();
                }, {once: true});
            });
            li.appendChild(moreButton);

            // 显示标题或"无消息"，并固定长度为40个字符
            const titleSpan = document.createElement("span");
            while (Array.from(item.title.replace(/\n/g, "")).length < 40) {
                item.title += ' ';
            }
            titleSpan.textContent = item.title;
            titleSpan.style.whiteSpace = "nowrap";
            li.appendChild(titleSpan);

            // 点击列表项加载历史记录
            li.addEventListener("click", (event) => {
                if (event.target === moreButton) return;
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
    document.getElementById("conversation-title").textContent = "AI Chat";

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

    // chatContainer.style.display = "none";
    console.log("Conversation reset successfully.");
}

// 页面加载时加载历史记录
window.onload = async () => {
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

const sidebar = document.getElementById('sidebar');

async function fetchFontAndConvertToBase64(fontURL) {
    try {
        const response = await fetch(fontURL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Data = reader.result;
                // IMPORTANT: Log the result to confirm it's valid.
                console.log("Font loaded and converted:", base64Data.substring(0, 50) + "..."); // Log first 50 chars
                resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error fetching or converting font:", error);
        return null; // Return null on error
    }
}

async function exportToPDF() {
    const pdf = new window.jspdf.jsPDF('p', 'pt', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;

    // 加载自定义字体
    const fontURL = '/templates/NotoSansSC-Regular.ttf';
    const base64FontData = await fetchFontAndConvertToBase64(fontURL);
    if (!base64FontData) {
        console.error("Failed to fetch or convert font.");
        alert('Failed to load font. Please try again.');
        return;
    }
    const base64FontString = base64FontData.split(',')[1];
    pdf.addFileToVFS('NotoSansSC-Regular.ttf', base64FontString);
    pdf.addFont('NotoSansSC-Regular.ttf', 'NotoSansSC', 'normal');
    pdf.setFont('NotoSansSC');

    // 设置基础样式
    const lineHeight = 15; // 每行高度
    pdf.setFontSize(12);

    const chatContainer = document.getElementById("chat-container");
    const titleElement = document.getElementById("conversation-title");

    if (!chatContainer || !titleElement) {
        alert('HTML elements not found.');
        return;
    }

    // 获取标题用于文件名，但不显示在 PDF 内容中
    const title = titleElement.textContent.trim().normalize('NFKC');

    // 计算当前页剩余行数
    function getRemainingLines() {
        return Math.floor((pageHeight - margin - y) / lineHeight);
    }

    // 绘制文本并处理分页
    function drawTextWithPagination(lines, textColor) {
        let remainingLines = getRemainingLines();

        // 如果当前页没有足够空间，换页
        if (remainingLines <= 0) {
            pdf.addPage();
            y = margin; // 移除标题后，直接从 margin 开始
            remainingLines = getRemainingLines();
        }

        // 截取当前页能显示的行数
        const linesToDraw = lines.slice(0, remainingLines);
        const remainingTextLines = lines.slice(remainingLines);

        // 绘制当前页的文本
        pdf.setFontSize(12);
        pdf.setTextColor(...textColor); // 解构 textColor 数组为单独参数
        pdf.text(linesToDraw, margin, y);
        y += linesToDraw.length * lineHeight;

        // 如果还有剩余行，递归处理
        if (remainingTextLines.length > 0) {
            pdf.addPage();
            y = margin; // 移除标题后，直接从 margin 开始
            drawTextWithPagination(remainingTextLines, textColor);
        }
    }

    const conversations = chatContainer.getElementsByClassName("conversation");

    for (const conv of conversations) {
        // 用户消息
        const userMsg = conv.querySelector(".user-message");
        if (userMsg) {
            const userText = userMsg.innerText.trim().normalize('NFKC');
            const userLines = pdf.splitTextToSize(userText, pageWidth - 2 * margin);

            // 绘制用户消息（蓝色）
            drawTextWithPagination(userLines, [0, 0, 255]);
            y += 5; // 用户消息后加 5pt 间距
        }

        // AI 回复
        const aiMsg = conv.querySelector(".ai-message:not(.copy)") || conv.querySelector(".ai-message.copy");
        if (aiMsg) {
            const aiText = aiMsg.innerText.trim().normalize('NFKC');
            const aiLines = pdf.splitTextToSize(aiText, pageWidth - 2 * margin);

            // 绘制 AI 回复（绿色）
            drawTextWithPagination(aiLines, [0, 128, 0]);
            y += 10; // AI 回复后加 10pt 间距
        }

        // 对话之间的间距
        y += 5;

        // 如果接近页面底部，换页
        if (y > pageHeight - margin - 30) {
            pdf.addPage();
            y = margin; // 移除标题后，直接从 margin 开始
        }
    }

    // 使用标题作为文件名
    pdf.save(`${title}.pdf`);
}

function getFileIcon(mimeType) {
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
    } else if (mimeType.includes('powerpoint') || mimeType === 'application/vnd.ms-powerpoint' || mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        return 'far fa-file-powerpoint';
    } else if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') {
        return 'far fa-file-archive';
    } else if (mimeType === 'text/plain') {
        return 'far fa-file-alt';
    } else if (mimeType === 'text/html' || mimeType === 'application/xhtml+xml') {
        return 'far fa-file-code';
    } else if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('css')) {
        return 'far fa-file-code';
    } else {
        return 'far fa-file';
    }
}

function getFileType(mimeType) {
    return mimeType.split('/')[1].toUpperCase();
}
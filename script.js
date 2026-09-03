document.addEventListener("DOMContentLoaded", () => {
    /* =========================================================
       ZONO AI — COMPLETE FRONTEND
       Original Zono UI + current features
    ========================================================= */

    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    const menuButton = document.getElementById("menuButton");
    const closeButton = document.getElementById("closeSidebar");
    const newChatButton = document.getElementById("newChatButton");
    const deleteChatButton = document.getElementById("deleteChatButton");
    const chatHistory = document.getElementById("chatHistory");
    const chatArea = document.getElementById("chatArea");
    const welcome = document.getElementById("welcome");
    const attachButton = document.getElementById("attachButton");
    const screenshotButton = document.getElementById("screenshotButton");
    const fileInput = document.getElementById("fileInput");
    const messageInput = document.getElementById("messageInput");
    const voiceButton = document.getElementById("voiceButton");
    const sendButton = document.getElementById("sendButton");
    const attachmentPreview = document.getElementById("attachmentPreview");

    const API_BASE = "";
    const STORAGE_KEY = "zono_ai_chats_v5";
    const MAX_HISTORY = 10;
    const MAX_FILES = 5;
    const MAX_FILE_SIZE = 20 * 1024 * 1024;

    let chats = [];
    let activeChatId = null;
    let pendingFiles = [];
    let fileMode = "attach";
    let isSending = false;
    let mediaRecorder = null;
    let recordedChunks = [];
    let recordingStream = null;
    let isRecording = false;

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatZonoText(text) {
        let value = escapeHtml(text || "");
        value = value.replace(/^### (.+)$/gm, "<h3>$1</h3>");
        value = value.replace(/^## (.+)$/gm, "<h2>$1</h2>");
        value = value.replace(/^# (.+)$/gm, "<h1>$1</h1>");
        value = value.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        value = value.replace(/`([^`]+)`/g, "<code>$1</code>");
        value = value.replace(/^[-•] (.+)$/gm, "<li>$1</li>");
        value = value.replace(/(<li>.*?<\/li>)/gs, "<ul>$1</ul>");
        value = value.replace(/\n/g, "<br>");
        return value;
    }

    function saveChats() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
        } catch (error) {
            console.warn("Zono: Could not save chats.", error);
        }
    }

    function loadChats() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            chats = Array.isArray(saved) ? saved : [];
        } catch {
            chats = [];
        }

        if (!chats.length) {
            createChat(false);
        } else {
            activeChatId = chats[0].id;
            renderHistory();
            renderActiveChat();
        }
    }

    function createChat(save = true) {
        const chat = {
            id: uid(),
            title: "New Chat",
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        chats.unshift(chat);
        activeChatId = chat.id;

        if (save) saveChats();
        renderHistory();
        renderActiveChat();
        closeSidebarMobile();
        messageInput?.focus();
        return chat;
    }

    function getActiveChat() {
        return chats.find(chat => chat.id === activeChatId);
    }

    function selectChat(id) {
        if (!chats.some(chat => chat.id === id)) return;
        activeChatId = id;
        saveChats();
        renderHistory();
        renderActiveChat();
        closeSidebarMobile();
    }

    function updateChatTitle(chat, text) {
        if (!chat) return;
        const clean = String(text || "").replace(/\s+/g, " ").trim();
        if (!clean) return;
        chat.title = clean.length > 42 ? clean.slice(0, 42) + "…" : clean;
        chat.updatedAt = Date.now();
    }

    function renderHistory() {
        if (!chatHistory) return;
        chatHistory.innerHTML = "";

        chats.forEach(chat => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "history-item" + (chat.id === activeChatId ? " active" : "");
            button.textContent = chat.title || "New Chat";
            button.title = chat.title || "New Chat";
            button.addEventListener("click", () => selectChat(chat.id));
            chatHistory.appendChild(button);
        });
    }

    function deleteActiveChat() {
        if (!activeChatId) return;
        chats = chats.filter(chat => chat.id !== activeChatId);

        if (!chats.length) {
            createChat(false);
        } else {
            activeChatId = chats[0].id;
            saveChats();
            renderHistory();
            renderActiveChat();
        }
    }

    function openSidebarMobile() {
        sidebar?.classList.add("open");
        backdrop?.classList.add("show");
    }

    function closeSidebarMobile() {
        sidebar?.classList.remove("open");
        backdrop?.classList.remove("show");
    }

    function toggleSidebar() {
        if (sidebar?.classList.contains("open")) closeSidebarMobile();
        else openSidebarMobile();
    }

    function renderActiveChat() {
        if (!chatArea) return;
        chatArea.innerHTML = "";
        const chat = getActiveChat();

        if (!chat || !Array.isArray(chat.messages) || !chat.messages.length) {
            if (welcome) {
                welcome.style.display = "";
                chatArea.appendChild(welcome);
            }
            return;
        }

        if (welcome) welcome.style.display = "none";

        chat.messages.forEach(message => {
            addMessageToDOM(message.role, message.content, {
                files: message.files || [],
                imageUrl: message.imageUrl || null,
                scroll: false
            });
        });

        scrollToBottom();
    }

    function addMessageToDOM(role, content, options = {}) {
        const normalizedRole = role === "assistant" || role === "bot" ? "bot" : "user";
        const wrapper = document.createElement("div");
        wrapper.className = `message ${normalizedRole}`;

        const contentWrap = document.createElement("div");
        contentWrap.className = "message-content";

        const name = document.createElement("div");
        name.className = "message-name";
        name.textContent = normalizedRole === "user" ? "You" : "Zono";

        const bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.innerHTML = formatZonoText(content || "");

        contentWrap.appendChild(name);
        contentWrap.appendChild(bubble);

        if (Array.isArray(options.files) && options.files.length) {
            const fileRow = document.createElement("div");
            fileRow.className = "message-actions";
            options.files.forEach(file => {
                const tag = document.createElement("span");
                tag.className = "action-button";
                tag.textContent = `📎 ${file.name || "file"}`;
                fileRow.appendChild(tag);
            });
            contentWrap.appendChild(fileRow);
        }

        if (options.imageUrl) {
            const card = document.createElement("div");
            card.className = "ai-image-card";
            const img = document.createElement("img");
            img.src = options.imageUrl;
            img.alt = "Image generated by Zono";
            img.loading = "lazy";
            const caption = document.createElement("div");
            caption.textContent = "Generated by Zono";
            card.appendChild(img);
            card.appendChild(caption);
            contentWrap.appendChild(card);
        }

        if (normalizedRole === "bot") {
            const actions = document.createElement("div");
            actions.className = "message-actions";

            const copy = document.createElement("button");
            copy.className = "action-button";
            copy.type = "button";
            copy.textContent = "Copy";
            copy.addEventListener("click", async () => {
                try {
                    await navigator.clipboard.writeText(content || "");
                    copy.textContent = "Copied";
                    setTimeout(() => copy.textContent = "Copy", 1200);
                } catch {
                    copy.textContent = "Copy failed";
                }
            });

            const speak = document.createElement("button");
            speak.className = "action-button";
            speak.type = "button";
            speak.textContent = "Read aloud";
            speak.addEventListener("click", () => speakText(content || ""));

            actions.appendChild(copy);
            actions.appendChild(speak);
            contentWrap.appendChild(actions);
        }

        wrapper.appendChild(contentWrap);
        chatArea.appendChild(wrapper);
        if (options.scroll !== false) scrollToBottom();
        return wrapper;
    }

    function addTyping() {
        removeTyping();
        const wrapper = document.createElement("div");
        wrapper.className = "message bot";
        wrapper.id = "typingIndicator";

        const contentWrap = document.createElement("div");
        contentWrap.className = "message-content";

        const name = document.createElement("div");
        name.className = "message-name";
        name.textContent = "Zono";

        const typing = document.createElement("div");
        typing.className = "typing";
        typing.innerHTML = "<span></span><span></span><span></span>";

        contentWrap.appendChild(name);
        contentWrap.appendChild(typing);
        wrapper.appendChild(contentWrap);
        chatArea.appendChild(wrapper);
        scrollToBottom();
    }

    function removeTyping() {
        document.getElementById("typingIndicator")?.remove();
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
        });
    }

    function autoResize() {
        if (!messageInput) return;
        messageInput.style.height = "auto";
        messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + "px";
    }

    function isAllowedFile(file) {
        if (!file) return false;
        if ((file.type || "").startsWith("image/")) return true;
        return /\.(pdf|txt|doc|docx)$/i.test(file.name || "");
    }

    function getFileIcon(file) {
        const type = file?.type || "";
        const name = (file?.name || "").toLowerCase();
        if (type.startsWith("image/")) return "🖼️";
        if (name.endsWith(".pdf")) return "📕";
        if (name.endsWith(".doc") || name.endsWith(".docx")) return "📘";
        return "📄";
    }

    function prepareFiles(fileList) {
        for (const file of Array.from(fileList || [])) {
            if (pendingFiles.length >= MAX_FILES) {
                alert(`You can attach up to ${MAX_FILES} files.`);
                break;
            }
            if (file.size > MAX_FILE_SIZE) {
                alert(`${file.name} is larger than 20 MB.`);
                continue;
            }
            if (!isAllowedFile(file)) {
                alert(`${file.name} is not a supported file type.`);
                continue;
            }
            const duplicate = pendingFiles.some(existing =>
                existing.name === file.name && existing.size === file.size
            );
            if (!duplicate) pendingFiles.push(file);
        }
        renderAttachmentPreview();
    }

    function renderAttachmentPreview() {
        if (!attachmentPreview) return;
        attachmentPreview.innerHTML = "";

        pendingFiles.forEach((file, index) => {
            const item = document.createElement("div");
            item.className = "attachment";

            const label = document.createElement("span");
            label.textContent = `${getFileIcon(file)} ${file.name}`;

            const remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "×";
            remove.title = "Remove attachment";
            remove.addEventListener("click", () => {
                pendingFiles.splice(index, 1);
                renderAttachmentPreview();
            });

            item.appendChild(label);
            item.appendChild(remove);
            attachmentPreview.appendChild(item);
        });
    }

    function clearAttachments() {
        pendingFiles = [];
        if (fileInput) fileInput.value = "";
        renderAttachmentPreview();
    }

    async function captureDisplayScreenshot() {
        if (!navigator.mediaDevices?.getDisplayMedia) return false;
        let stream = null;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            const video = document.createElement("video");
            video.srcObject = stream;
            await video.play();
            await new Promise(resolve => setTimeout(resolve, 250));

            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

            const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
            if (!blob) return false;

            const file = new File([blob], `zono-screenshot-${Date.now()}.png`, { type: "image/png" });
            prepareFiles([file]);
            if (messageInput && !messageInput.value.trim()) {
                messageInput.value = "Read this screenshot and explain what it shows.";
                autoResize();
            }
            return true;
        } catch (error) {
            console.warn("Zono screenshot capture:", error);
            return false;
        } finally {
            stream?.getTracks().forEach(track => track.stop());
        }
    }

    function getRecordingMimeType() {
        const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
        for (const type of types) {
            if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) return type;
        }
        return "";
    }

    async function startVoiceRecording() {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            alert("Voice recording is not supported by this browser.");
            return;
        }

        try {
            recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = getRecordingMimeType();
            mediaRecorder = mimeType
                ? new MediaRecorder(recordingStream, { mimeType })
                : new MediaRecorder(recordingStream);
            recordedChunks = [];

            mediaRecorder.ondataavailable = event => {
                if (event.data?.size) recordedChunks.push(event.data);
            };
            mediaRecorder.onstop = finishVoiceRecording;
            mediaRecorder.start();

            isRecording = true;
            updateVoiceButton();
        } catch (error) {
            console.error("Zono microphone error:", error);
            alert("Microphone permission was not available.");
        }
    }

    function stopVoiceRecording() {
        if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    }

    function stopRecordingStream() {
        recordingStream?.getTracks().forEach(track => track.stop());
        recordingStream = null;
    }

    async function finishVoiceRecording() {
        isRecording = false;
        updateVoiceButton();
        stopRecordingStream();

        if (!recordedChunks.length) {
            mediaRecorder = null;
            return;
        }

        const mimeType = mediaRecorder?.mimeType || "audio/webm";
        const blob = new Blob(recordedChunks, { type: mimeType });
        recordedChunks = [];
        mediaRecorder = null;
        await transcribeAudio(blob);
    }

    async function transcribeAudio(blob) {
        try {
            const formData = new FormData();
            formData.append("audio", blob, "zono-voice.webm");

            const response = await fetch(`${API_BASE}/api/transcribe`, {
                method: "POST",
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Transcription failed.");

            const text = String(data.text || "").trim();
            if (text && messageInput) {
                messageInput.value = text;
                autoResize();
                messageInput.focus();
            }
        } catch (error) {
            console.error("Zono transcription error:", error);
            alert(error.message || "Voice transcription failed.");
        }
    }

    function updateVoiceButton() {
        if (!voiceButton) return;
        voiceButton.classList.toggle("recording", isRecording);
        voiceButton.title = isRecording ? "Stop recording" : "Voice input";
        const label = voiceButton.querySelector("span:last-child");
        if (label) label.textContent = isRecording ? "Stop" : "Voice";
    }

    async function toggleVoiceRecording() {
        if (isRecording) stopVoiceRecording();
        else await startVoiceRecording();
    }

    function detectSpeechLanguage(text) {
        if (/[\u0B80-\u0BFF]/u.test(text)) return "ta-IN";
        if (/[\u0900-\u097F]/u.test(text)) return "hi-IN";
        if (/[\u0C00-\u0C7F]/u.test(text)) return "te-IN";
        if (/[\u0D00-\u0D7F]/u.test(text)) return "ml-IN";
        if (/[\u0A80-\u0AFF]/u.test(text)) return "gu-IN";
        if (/[\u0B00-\u0B7F]/u.test(text)) return "or-IN";
        if (/[\u0A00-\u0A7F]/u.test(text)) return "pa-IN";
        if (/[\u0980-\u09FF]/u.test(text)) return "bn-IN";
        if (/[\u0400-\u04FF]/u.test(text)) return "ru-RU";
        if (/[\u4E00-\u9FFF]/u.test(text)) return "zh-CN";
        if (/[\u3040-\u30FF]/u.test(text)) return "ja-JP";
        if (/[\uAC00-\uD7AF]/u.test(text)) return "ko-KR";
        if (/[\u0600-\u06FF]/u.test(text)) return "ar-SA";
        return "en-US";
    }

    function speakText(text) {
        if (!("speechSynthesis" in window)) {
            alert("Speech playback is not supported by this browser.");
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.lang = detectSpeechLanguage(text);
        window.speechSynthesis.speak(utterance);
    }

    async function sendMessage() {
        if (isSending) return;

        const text = messageInput?.value.trim() || "";
        if (!text && !pendingFiles.length) return;

        let chat = getActiveChat();
        if (!chat) chat = createChat(true);

        const historyBeforeMessage = chat.messages
            .slice(-MAX_HISTORY)
            .map(item => ({
                role: item.role === "bot" ? "assistant" : item.role,
                content: String(item.content || "").slice(0, 5000)
            }));

        const displayText = text ||
            (fileMode === "screenshot"
                ? "Read this screenshot and explain what it shows."
                : "Please read this file and explain the important information.");

        const filesForMessage = pendingFiles.map(file => ({
            name: file.name,
            type: file.type || "application/octet-stream"
        }));

        chat.messages.push({
            role: "user",
            content: displayText,
            files: filesForMessage,
            timestamp: Date.now()
        });

        updateChatTitle(chat, text || filesForMessage[0]?.name || "New Chat");
        chat.updatedAt = Date.now();
        saveChats();
        renderHistory();
        renderActiveChat();
        addTyping();

        const filesToSend = pendingFiles.slice();
        clearAttachments();
        if (messageInput) messageInput.value = "";
        autoResize();

        isSending = true;
        if (sendButton) sendButton.disabled = true;
        if (voiceButton) voiceButton.disabled = true;

        try {
            const formData = new FormData();
            formData.append("message", text);
            formData.append("history", JSON.stringify(historyBeforeMessage));

            filesToSend.forEach(file => formData.append("files", file, file.name));

            const response = await fetch(`${API_BASE}/api/chat`, {
                method: "POST",
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "The server could not answer.");

            removeTyping();

            const answer = data.reply || data.text || "I couldn't generate an answer.";
            chat.messages.push({
                role: "bot",
                content: answer,
                imageUrl: data.imageUrl || data.image || null,
                timestamp: Date.now()
            });

            chat.updatedAt = Date.now();
            saveChats();
            renderActiveChat();
        } catch (error) {
            removeTyping();
            chat.messages.push({
                role: "bot",
                content: `Sorry, I couldn't complete that request.\n\n${error.message || "Something went wrong."}`,
                timestamp: Date.now()
            });
            saveChats();
            renderActiveChat();
        } finally {
            isSending = false;
            if (sendButton) sendButton.disabled = false;
            if (voiceButton) voiceButton.disabled = false;
            fileMode = "attach";
            messageInput?.focus();
        }
    }

    /* =========================================================
       EVENTS
    ========================================================= */

    menuButton?.addEventListener("click", toggleSidebar);
    closeButton?.addEventListener("click", closeSidebarMobile);
    backdrop?.addEventListener("click", closeSidebarMobile);

    newChatButton?.addEventListener("click", () => createChat(true));
    deleteChatButton?.addEventListener("click", deleteActiveChat);

    attachButton?.addEventListener("click", () => {
        fileMode = "attach";
        if (fileInput) {
            fileInput.multiple = true;
            fileInput.accept = "image/*,.pdf,.doc,.docx,.txt";
            fileInput.click();
        }
    });

    screenshotButton?.addEventListener("click", async () => {
        fileMode = "screenshot";
        const captured = await captureDisplayScreenshot();

        if (!captured && fileInput) {
            fileInput.multiple = false;
            fileInput.accept = "image/*";
            fileInput.click();
        }
    });

    fileInput?.addEventListener("change", event => {
        prepareFiles(event.target.files);
        if (fileMode === "screenshot" && pendingFiles.length && messageInput && !messageInput.value.trim()) {
            messageInput.value = "Read this screenshot and explain what it shows.";
            autoResize();
        }
        event.target.value = "";
    });

    voiceButton?.addEventListener("click", toggleVoiceRecording);
    sendButton?.addEventListener("click", sendMessage);

    messageInput?.addEventListener("input", autoResize);
    messageInput?.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    document.querySelectorAll(".suggestion").forEach(button => {
        button.addEventListener("click", () => {
            if (!messageInput) return;
            messageInput.value = button.dataset.prompt || "";
            autoResize();
            messageInput.focus();
        });
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeSidebarMobile();
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 820) closeSidebarMobile();
    });

    loadChats();
    autoResize();
    updateVoiceButton();
});

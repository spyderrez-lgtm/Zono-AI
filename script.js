/* =========================================================
   ZONO AI — FRONTEND
   PART 1/3
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =========================================================
       ELEMENTS
    ========================================================= */

    const sidebar =
        document.getElementById("sidebar");

    const backdrop =
        document.getElementById("sidebarBackdrop");

    const menuButton =
        document.getElementById("menuButton");

    const closeButton =
        document.getElementById("closeSidebar");

    const newChatButton =
        document.getElementById("newChatButton");

    const deleteChatButton =
        document.getElementById("deleteChatButton");

    const chatHistory =
        document.getElementById("chatHistory");

    const chatArea =
        document.getElementById("chatArea");

    const welcome =
        document.getElementById("welcome");

    const attachButton =
        document.getElementById("attachButton");

    const screenshotButton =
        document.getElementById("screenshotButton");

    const fileInput =
        document.getElementById("fileInput");

    const messageInput =
        document.getElementById("messageInput");

    const voiceButton =
        document.getElementById("voiceButton");

    const sendButton =
        document.getElementById("sendButton");

    const attachmentPreview =
        document.getElementById("attachmentPreview");


    /* =========================================================
       CONFIGURATION
    ========================================================= */

    const API_BASE = "";

    const STORAGE_KEY =
        "zono_ai_chats_v4";


    /* =========================================================
       STATE
    ========================================================= */

    let chats = [];

    let activeChatId = null;

    let pendingFiles = [];

    let fileMode = "attach";

    let recognition = null;

    let isSending = false;


    /* =========================================================
       UNIQUE CHAT ID
    ========================================================= */

    function uid() {
        return (
            Date.now().toString(36) +
            Math.random()
                .toString(36)
                .slice(2, 8)
        );
    }


    /* =========================================================
       HTML SAFETY
    ========================================================= */

    function escapeHtml(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    /* =========================================================
       ZONO RESPONSE FORMATTER
       
       Converts simple Markdown-style formatting into
       safe HTML.

       Supported:
       **bold**
       *italic*
       `code`
       • bullets
       - bullets
       numbered lists
       headings
       arrows
    ========================================================= */

    function formatZonoText(value) {

        let text =
            String(value ?? "")
                .replace(/\r\n/g, "\n")
                .trim();

        if (!text) {
            return "";
        }


        /* -----------------------------------------------------
           Escape HTML FIRST
        ----------------------------------------------------- */

        text =
            escapeHtml(text);


        /* -----------------------------------------------------
           HEADINGS
        ----------------------------------------------------- */

        text =
            text.replace(
                /^### (.+)$/gm,
                '<div class="zono-heading zono-heading-3">$1</div>'
            );

        text =
            text.replace(
                /^## (.+)$/gm,
                '<div class="zono-heading zono-heading-2">$1</div>'
            );

        text =
            text.replace(
                /^# (.+)$/gm,
                '<div class="zono-heading zono-heading-1">$1</div>'
            );


        /* -----------------------------------------------------
           BOLD
        ----------------------------------------------------- */

        text =
            text.replace(
                /\*\*(.+?)\*\*/g,
                "<strong>$1</strong>"
            );


        /* -----------------------------------------------------
           ITALIC
        ----------------------------------------------------- */

        text =
            text.replace(
                /(^|[^\*])\*([^*\n]+)\*(?!\*)/g,
                "$1<em>$2</em>"
            );


        /* -----------------------------------------------------
           INLINE CODE
        ----------------------------------------------------- */

        text =
            text.replace(
                /`([^`\n]+)`/g,
                "<code>$1</code>"
            );


        /* -----------------------------------------------------
           BULLET SYMBOLS
        ----------------------------------------------------- */

        text =
            text.replace(
                /^• (.+)$/gm,
                '<div class="zono-list-item"><span class="zono-bullet">•</span><span>$1</span></div>'
            );


        text =
            text.replace(
                /^- (.+)$/gm,
                '<div class="zono-list-item"><span class="zono-bullet">•</span><span>$1</span></div>'
            );


        text =
            text.replace(
                /^\* (.+)$/gm,
                '<div class="zono-list-item"><span class="zono-bullet">•</span><span>$1</span></div>'
            );


        /* -----------------------------------------------------
           NUMBERED LISTS
        ----------------------------------------------------- */

        text =
            text.replace(
                /^(\d+)\. (.+)$/gm,
                '<div class="zono-list-item"><span class="zono-number">$1.</span><span>$2</span></div>'
            );


        /* -----------------------------------------------------
           ARROWS
        ----------------------------------------------------- */

        text =
            text.replace(
                /^→ (.+)$/gm,
                '<div class="zono-arrow-item"><span class="zono-arrow">→</span><span>$1</span></div>'
            );


        /* -----------------------------------------------------
           PRESERVE NORMAL LINE BREAKS
        ----------------------------------------------------- */

        text =
            text.replace(
                /\n/g,
                "<br>"
            );


        /* -----------------------------------------------------
           CLEAN UP EXTRA BREAKS AROUND HTML BLOCKS
        ----------------------------------------------------- */

        text =
            text.replace(
                /(<br>){2,}(<div class="zono-)/g,
                "$2"
            );

        text =
            text.replace(
                /(<\/div>)(<br>){2,}/g,
                "$1"
            );


        return text;
    }


    /* =========================================================
       SAVE CHATS
    ========================================================= */

    function saveChats() {

        try {

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(chats)
            );

        } catch (error) {

            console.error(
                "Could not save chats:",
                error
            );
        }
    }


    /* =========================================================
       LOAD CHATS
    ========================================================= */

    function loadChats() {

        try {

            const saved =
                JSON.parse(
                    localStorage.getItem(
                        STORAGE_KEY
                    ) || "[]"
                );

            chats =
                Array.isArray(saved)
                    ? saved
                    : [];

        } catch (error) {

            console.error(
                "Could not load chats:",
                error
            );

            chats = [];
        }


        /* -----------------------------------------------------
           Create first chat automatically
        ----------------------------------------------------- */

        if (!chats.length) {

            createChat(false);

        } else {

            activeChatId =
                chats[0].id;

            renderHistory();

            renderActiveChat();
        }
    }


    /* =========================================================
       CREATE NEW CHAT
    ========================================================= */

    function createChat(save = true) {

        const chat = {

            id:
                uid(),

            title:
                "New Chat",

            messages:
                []
        };


        chats.unshift(chat);

        activeChatId =
            chat.id;


        if (save) {
            saveChats();
        }


        renderHistory();

        renderActiveChat();

        closeSidebarMobile();


        if (messageInput) {

            messageInput.focus();
        }
    }


    /* =========================================================
       GET ACTIVE CHAT
    ========================================================= */

    function getActiveChat() {

        return chats.find(
            chat =>
                chat.id ===
                activeChatId
        );
    }


    /* =========================================================
       DELETE ACTIVE CHAT
    ========================================================= */

    function deleteActiveChat() {

        const chat =
            getActiveChat();


        if (!chat) {
            return;
        }


        const chatTitle =
            chat.title ||
            "New Chat";


        const confirmed =
            window.confirm(
                `Delete "${chatTitle}"?\n\nThis chat will be permanently removed from this device.`
            );


        if (!confirmed) {
            return;
        }


        chats =
            chats.filter(
                item =>
                    item.id !==
                    chat.id
            );


        if (!chats.length) {

            createChat(true);

            return;
        }


        activeChatId =
            chats[0].id;


        saveChats();

        renderHistory();

        renderActiveChat();

        closeSidebarMobile();


        if (messageInput) {
            messageInput.focus();
        }
    }


    /* =========================================================
       RENDER CHAT HISTORY
    ========================================================= */

    function renderHistory() {

        chatHistory.innerHTML =
            "";


        chats.forEach(chat => {

            const button =
                document.createElement(
                    "button"
                );


            button.className =
                "history-item" +
                (
                    chat.id ===
                    activeChatId
                        ? " active"
                        : ""
                );


            button.type =
                "button";


            button.textContent =
                chat.title ||
                "New Chat";


            button.title =
                chat.title ||
                "New Chat";


            button.addEventListener(
                "click",
                () => {

                    activeChatId =
                        chat.id;

                    renderHistory();

                    renderActiveChat();

                    closeSidebarMobile();
                }
            );


            chatHistory.appendChild(
                button
            );
        });
    }


    /* =========================================================
       RENDER ACTIVE CHAT
    ========================================================= */

    function renderActiveChat() {

        const chat =
            getActiveChat();


        chatArea.innerHTML =
            "";


        if (
            !chat ||
            !chat.messages.length
        ) {

            chatArea.appendChild(
                welcome
            );

            return;
        }


        chat.messages.forEach(
            message => {

                addMessageToDOM(
                    message.role,
                    message.content,
                    {
                        files:
                            message.files ||
                            [],

                        imageUrl:
                            message.imageUrl ||
                            null,

                        persist:
                            false
                    }
                );
            }
        );


        scrollToBottom();
    }


    /* =========================================================
       SCROLL TO BOTTOM
    ========================================================= */

    function scrollToBottom() {

        requestAnimationFrame(
            () => {

                chatArea.scrollTop =
                    chatArea.scrollHeight;
            }
        );
    }


  closeSidebarMobile();
                }
            );

            chatHistory.appendChild(
                button
            );
        });
    }


    /* =========================================================
       RENDER ACTIVE CHAT
    ========================================================= */

    function renderActiveChat() {

        chatArea.innerHTML = "";

        const chat =
            getActiveChat();

        if (
            !chat ||
            !chat.messages ||
            chat.messages.length === 0
        ) {

            chatArea.appendChild(
                welcome
            );

            welcome.style.display = "flex";

            return;
        }

        welcome.style.display = "none";

        chat.messages.forEach(
            message => {

                addMessageToDOM(
                    message.role,
                    message.content,
                    message.imageUrl || null
                );

            }
        );

        scrollToBottom();
    }


    /* =========================================================
       SCROLL CHAT
    ========================================================= */

    function scrollToBottom() {

        requestAnimationFrame(() => {

            chatArea.scrollTop =
                chatArea.scrollHeight;

        });

    }


    /* =========================================================
       ADD MESSAGE TO CHAT
    ========================================================= */

    function addMessageToDOM(
        role,
        content,
        imageUrl = null
    ) {

        const message =
            document.createElement("div");

        message.className =
            `message ${role}`;

        const bubble =
            document.createElement("div");

        bubble.className =
            "bubble";


        /* -----------------------------------------------------
           BOT MESSAGE
           Supports:
           **bold**
           *italic*
           # headings
           • bullets
           1. numbered lists
           → arrows
           `code`
        ----------------------------------------------------- */

        if (role === "bot") {

            bubble.innerHTML =
                formatZonoText(
                    content || ""
                );

        } else {

            /*
             * User messages stay plain text.
             * This prevents typed HTML from being rendered.
             */

            bubble.textContent =
                content || "";

        }


        message.appendChild(
            bubble
        );


        /* =====================================================
           GENERATED IMAGE
        ===================================================== */

        if (imageUrl) {

            const imageCard =
                document.createElement("div");

            imageCard.className =
                "generated-image-card";

            const image =
                document.createElement("img");

            image.src =
                imageUrl;

            image.alt =
                "Generated image";

            image.loading =
                "lazy";

            imageCard.appendChild(
                image
            );

            message.appendChild(
                imageCard
            );

        }


        /* =====================================================
           BOT ACTIONS
        ===================================================== */

        if (role === "bot") {

            const actions =
                document.createElement("div");

            actions.className =
                "message-actions";


            /* -------------------------------------------------
               COPY
            ------------------------------------------------- */

            const copyButton =
                document.createElement("button");

            copyButton.type =
                "button";

            copyButton.className =
                "message-action";

            copyButton.title =
                "Copy response";

            copyButton.textContent =
                "Copy";

            copyButton.addEventListener(
                "click",
                async () => {

                    try {

                        await navigator.clipboard.writeText(
                            content || ""
                        );

                        copyButton.textContent =
                            "Copied";

                        setTimeout(() => {

                            copyButton.textContent =
                                "Copy";

                        }, 1500);

                    } catch {

                        copyButton.textContent =
                            "Copy failed";

                        setTimeout(() => {

                            copyButton.textContent =
                                "Copy";

                        }, 1500);

                    }

                }
            );


            /* -------------------------------------------------
               READ ALOUD
            ------------------------------------------------- */

            const readButton =
                document.createElement("button");

            readButton.type =
                "button";

            readButton.className =
                "message-action";

            readButton.title =
                "Read aloud";

            readButton.textContent =
                "Read aloud";

            readButton.addEventListener(
                "click",
                () => {

                    speakText(
                        content || ""
                    );

                }
            );


            actions.appendChild(
                copyButton
            );

            actions.appendChild(
                readButton
            );

            message.appendChild(
                actions
            );

        }


        chatArea.appendChild(
            message
        );

        scrollToBottom();

        return message;
    }


    /* =========================================================
       TYPING INDICATOR
    ========================================================= */

    function showTyping() {

        removeTyping();

        const typing =
            document.createElement("div");

        typing.className =
            "message bot typing-message";

        typing.id =
            "zonoTyping";


        const bubble =
            document.createElement("div");

        bubble.className =
            "bubble typing-bubble";


        const dot1 =
            document.createElement("span");

        const dot2 =
            document.createElement("span");

        const dot3 =
            document.createElement("span");

        dot1.className =
            "typing-dot";

        dot2.className =
            "typing-dot";

        dot3.className =
            "typing-dot";


        bubble.appendChild(
            dot1
        );

        bubble.appendChild(
            dot2
        );

        bubble.appendChild(
            dot3
        );


        typing.appendChild(
            bubble
        );

        chatArea.appendChild(
            typing
        );

        scrollToBottom();
    }


    function removeTyping() {

        const typing =
            document.getElementById(
                "zonoTyping"
            );

        if (typing) {

            typing.remove();

        }

    }


    /* =========================================================
       TEXTAREA AUTO RESIZE
    ========================================================= */

    function autoResize() {

        messageInput.style.height =
            "auto";

        messageInput.style.height =
            Math.min(
                messageInput.scrollHeight,
                180
            ) + "px";

    }


    /* =========================================================
       FILE → BASE64
    ========================================================= */

    function fileToBase64(file) {

        return new Promise(
            (resolve, reject) => {

                const reader =
                    new FileReader();

                reader.onload = () => {

                    resolve(
                        reader.result
                    );

                };

                reader.onerror = () => {

                    reject(
                        new Error(
                            "Could not read file."
                        )
                    );

                };

                reader.readAsDataURL(
                    file
                );

            }
        );

    }


    /* =========================================================
       PREPARE FILES
    ========================================================= */

    async function prepareFiles(
        files
    ) {

        const output = [];

        for (
            const file of files
        ) {

            try {

                const dataUrl =
                    await fileToBase64(
                        file
                    );

                output.push({

                    name:
                        file.name,

                    type:
                        file.type ||
                        "application/octet-stream",

                    size:
                        file.size,

                    data:
                        dataUrl

                });

            } catch (error) {

                console.error(
                    "File preparation error:",
                    error
                );

            }

        }

        return output;
    }


    /* =========================================================
       ATTACHMENT PREVIEW
    ========================================================= */

    function renderAttachmentPreview() {

        attachmentPreview.innerHTML =
            "";

        if (
            pendingFiles.length === 0
        ) {

            attachmentPreview.style.display =
                "none";

            return;
        }

        attachmentPreview.style.display =
            "flex";


        pendingFiles.forEach(
            (file, index) => {

                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "attachment-item";


                const info =
                    document.createElement(
                        "div"
                    );

                info.className =
                    "attachment-info";


                const name =
                    document.createElement(
                        "span"
                    );

                name.className =
                    "attachment-name";

                name.textContent =
                    file.name;


                const size =
                    document.createElement(
                        "span"
                    );

                size.className =
                    "attachment-size";

                size.textContent =
                    formatFileSize(
                        file.size
                    );


                info.appendChild(
                    name
                );

                info.appendChild(
                    size
                );


                const remove =
                    document.createElement(
                        "button"
                    );

                remove.type =
                    "button";

                remove.className =
                    "attachment-remove";

                remove.title =
                    "Remove file";

                remove.textContent =
                    "×";


                remove.addEventListener(
                    "click",
                    () => {

                        pendingFiles.splice(
                            index,
                            1
                        );

                        renderAttachmentPreview();

                    }
                );


                item.appendChild(
                    info
                );

                item.appendChild(
                    remove
                );


                attachmentPreview.appendChild(
                    item
                );

            }
        );

    }


    /* =========================================================
       FILE SIZE
    ========================================================= */

    function formatFileSize(
        bytes
    ) {

        if (!bytes) {
            return "0 B";
        }

        const units = [
            "B",
            "KB",
            "MB",
            "GB"
        ];

        let size =
            bytes;

        let unitIndex =
            0;

        while (
            size >= 1024 &&
            unitIndex <
                units.length - 1
        ) {

            size /= 1024;

            unitIndex++;

        }

        return (
            size.toFixed(
                size >= 10 ||
                unitIndex === 0
                    ? 0
                    : 1
            ) +
            " " +
            units[unitIndex]
        );

    }


    /* =========================================================
       CLEAR ATTACHMENTS
    ========================================================= */

    function clearAttachments() {

        pendingFiles =
            [];

        fileInput.value =
            "";

        renderAttachmentPreview();

    }


    /* =========================================================
       SEND MESSAGE
    ========================================================= */

    async function sendMessage(
        forcedMessage = null
    ) {

        if (isSending) {
            return;
        }

        const typedMessage =
            forcedMessage !== null
                ? String(forcedMessage)
                : messageInput.value.trim();

        const message =
            typedMessage.trim();

        if (
            !message &&
            pendingFiles.length === 0
        ) {
            return;
        }


        let chat =
            getActiveChat();

        if (!chat) {

            createChat();

            chat =
                getActiveChat();

        }


        /* =====================================================
           USER MESSAGE
        ===================================================== */

        if (message) {

            chat.messages.push({

                role:
                    "user",

                content:
                    message,

                timestamp:
                    Date.now()

            });

            if (
                chat.title ===
                "New Chat"
            ) {

                chat.title =
                    message.length > 35
                        ? message.slice(0, 35) + "..."
                        : message;

            }

        }


        const filesToSend =
            [...pendingFiles];

        messageInput.value =
            "";

        autoResize();

        clearAttachments();

        saveChats();

        renderHistory();

        renderActiveChat();

        showTyping();

        isSending =
            true;

        sendButton.disabled =
            true;


        try {

            const preparedFiles =
                await prepareFiles(
                    filesToSend
                );


            /* -------------------------------------------------
               KEEP HISTORY SMALL
               This helps prevent huge requests and rate-limit
               problems when a chat becomes very long.
            ------------------------------------------------- */

            const history =
                chat.messages
                    .slice(-12)
                    .map(item => ({

                        role:
                            item.role,

                        content:
                            item.content || ""

                    }));


            const response =
                await fetch(
                    API_BASE +
                    "/api/chat",
                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify({

                                message:
                                    message,

                                files:
                                    preparedFiles,

                                history:
                                    history

                            })

                    }
                );


            let data = {};

            try {

                data =
                    await response.json();

            } catch {

                data = {};

            }


            if (
                !response.ok
            ) {

                throw new Error(
                    data.error ||
                    `Request failed (${response.status})`
                );

            }


            removeTyping();


            const reply =
                data.reply ||
                "Sorry, I couldn't generate a response.";


            chat.messages.push({

                role:
                    "bot",

                content:
                    reply,

                imageUrl:
                    data.imageUrl ||
                    null,

                timestamp:
                    Date.now()

            });


            saveChats();

            renderActiveChat();

        } catch (error) {

            console.error(
                "Zono request error:",
                error
            );

            removeTyping();


            const errorText =
                error.message ||
                "Something went wrong.";


            chat.messages.push({

                role:
                    "bot",

                content:
                    "⚠️ Sorry, something went wrong. Please try again.",

                timestamp:
                    Date.now()

            });


            saveChats();

            renderActiveChat();

            console.error(
                "Detailed error:",
                errorText
            );

        } finally {

            isSending =
                false;

            sendButton.disabled =
                false;

            messageInput.focus();

        }

    }


    /* =========================================================
       TEXT TO SPEECH
    ========================================================= */

    function detectSpeechLanguage(
        text
    ) {

        const value =
            String(text || "").trim();

        if (!value) {
            return "";
        }


        /*
         * Unicode-based language detection.
         *
         * This does not guarantee perfect detection,
         * but gives the browser a useful language hint.
         */

        if (
            /[\u0B80-\u0BFF]/.test(value)
        ) {
            return "ta-IN";
        }

        if (
            /[\u0900-\u097F]/.test(value)
        ) {
            return "hi-IN";
        }

        if (
            /[\u0C00-\u0C7F]/.test(value)
        ) {
            return "te-IN";
        }

        if (
            /[\u0C80-\u0CFF]/.test(value)
        ) {
            return "kn-IN";
        }

        if (
            /[\u0D00-\u0D7F]/.test(value)
        ) {
            return "ml-IN";
        }

        if (
            /[\u0980-\u09FF]/.test(value)
        ) {
            return "bn-IN";
        }

        if (
            /[\u0A80-\u0AFF]/.test(value)
        ) {
            return "gu-IN";
        }

        if (
            /[\u0A00-\u0A7F]/.test(value)
        ) {
            return "pa-IN";
        }

        if (
            /[\u0600-\u06FF\u0750-\u077F]/.test(value)
        ) {
            return "ar";
        }

        if (
            /[\u4E00-\u9FFF]/.test(value)
        ) {
            return "zh";
        }

        if (
            /[\u3040-\u30FF]/.test(value)
        ) {
            return "ja";
        }

        if (
            /[\uAC00-\uD7AF]/.test(value)
        ) {
            return "ko";
        }

        if (
            /[\u0400-\u04FF]/.test(value)
        ) {
            return "ru";
        }

        return "en-US";

    }


    function speakText(
        text
    ) {

        if (
            !("speechSynthesis" in window)
        ) {

            alert(
                "Read aloud is not supported on this device."
            );

            return;

        }


        const cleanText =
            String(text || "").trim();

        if (!cleanText) {
            return;
        }


        window.speechSynthesis.cancel();


        const utterance =
            new SpeechSynthesisUtterance(
                cleanText
            );


        const language =
            detectSpeechLanguage(
                cleanText
            );

        if (language) {

            utterance.lang =
                language;

        }


        /*
         * Try to find a voice matching the
         * detected language.
         */

        const voices =
            window.speechSynthesis.getVoices();


        if (
            voices &&
            voices.length &&
            language
        ) {

            const languageBase =
                language
                    .split("-")[0]
                    .toLowerCase();


            const matchingVoice =
                voices.find(
                    voice =>
                        voice.lang
                            .toLowerCase()
                            .startsWith(
                                languageBase
                            )
                );


            if (matchingVoice) {

                utterance.voice =
                    matchingVoice;

            }

        }


        utterance.rate =
            1;

        utterance.pitch =
            1;


        window.speechSynthesis.speak(
            utterance
        );

    }


    /* =========================================================
       MULTILINGUAL VOICE INPUT
    ========================================================= */

    function setupVoice() {

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;


        if (!SpeechRecognition) {

            voiceButton.disabled =
                true;

            voiceButton.title =
                "Voice input is not supported by this browser.";

            return;

        }


        recognition =
            new SpeechRecognition();


        /*
         * Do not permanently lock Zono to Tamil or English.
         *
         * The browser's recognition engine determines the
         * languages it supports. Users can speak any supported
         * language.
         */

        recognition.lang =
            navigator.language ||
            "en-US";


        recognition.continuous =
            false;

        recognition.interimResults =
            true;

        recognition.maxAlternatives =
            3;


        let finalTranscript =
            "";


        recognition.onstart =
            () => {

                voiceButton.classList.add(
                    "recording"
                );

                voiceButton.title =
                    "Listening...";

            };


        recognition.onresult =
            event => {

                let interimTranscript =
                    "";


                for (
                    let i =
                        event.resultIndex;
                    i <
                        event.results.length;
                    i++
                ) {

                    const result =
                        event.results[i];


                    const transcript =
                        result[0]
                            .transcript;


                    if (
                        result.isFinal
                    ) {

                        finalTranscript +=
                            transcript;

                    } else {

                        interimTranscript +=
                            transcript;

                    }

                }


                const displayText =
                    (
                        finalTranscript +
                        interimTranscript
                    ).trim();


                if (displayText) {

                    messageInput.value =
                        displayText;

                    autoResize();

                }

            };


        recognition.onerror =
            event => {

                console.error(
                    "Voice recognition error:",
                    event.error
                );

            };


        recognition.onend =
            () => {

                voiceButton.classList.remove(
                    "recording"
                );

                voiceButton.title =
                    "Voice input";

                const spokenText =
                    messageInput.value.trim();


                if (
                    spokenText &&
                    !isSending
                ) {

                    sendMessage();

                }

            };

    }


    /* =========================================================
       VOICE BUTTON
    ========================================================= */

    function startVoiceInput() {

        if (!recognition) {

            setupVoice();

        }

        if (!recognition) {
            return;
        }


        try {

            recognition.stop();

        } catch {

            /* Ignore if already stopped */

        }


        /*
         * Use the device/browser language as the initial
         * recognition language.
         *
         * The recognition engine may support many languages,
         * but a browser SpeechRecognition instance generally
         * needs one language hint at a time.
         */

        recognition.lang =
            navigator.language ||
            "en-US";


        try {

            recognition.start();

        } catch (error) {

            console.error(
                "Could not start voice recognition:",
                error
            );

        }

    }


    /* =========================================================
       SIDEBAR
    ========================================================= */

    function openSidebar() {

        sidebar.classList.add(
            "open"
        );

        backdrop.classList.add(
            "show"
        );

    }


    function closeSidebarMobile() {

        sidebar.classList.remove(
            "open"
        );

        backdrop.classList.remove(
            "show"
        );

    }


    menuButton.addEventListener(
        "click",
        openSidebar
    );


    closeButton.addEventListener(
        "click",
        closeSidebarMobile
    );


    backdrop.addEventListener(
        "click",
        closeSidebarMobile
    );


    /* =========================================================
       NEW CHAT
    ========================================================= */

    newChatButton.addEventListener(
        "click",
        () => {

            createChat();

            renderHistory();

            renderActiveChat();

            closeSidebarMobile();

            messageInput.focus();

        }
    );


    /* =========================================================
       DELETE CHAT
    ========================================================= */

    deleteChatButton.addEventListener(
        "click",
        () => {

            deleteActiveChat();

        }
    );


    /* =========================================================
       ATTACH BUTTON
    ========================================================= */

    attachButton.addEventListener(
        "click",
        () => {

            fileMode =
                "attach";

            fileInput.click();

        }
    );


    /* =========================================================
       SCREENSHOT BUTTON
    ========================================================= */

    screenshotButton.addEventListener(
        "click",
        () => {

            fileMode =
                "screenshot";

            fileInput.click();

        }
    );


    /* =========================================================
       FILE SELECTION
    ========================================================= */

    fileInput.addEventListener(
        "change",
        () => {

            const selected =
                Array.from(
                    fileInput.files || []
                );


            if (
                !selected.length
            ) {
                return;
            }


            if (
                fileMode ===
                "screenshot"
            ) {

                const images =
                    selected.filter(
                        file =>
                            file.type.startsWith(
                                "image/"
                            )
                    );


                if (
                    images.length === 0
                ) {

                    alert(
                        "Please select an image screenshot."
                    );

                    fileInput.value =
                        "";

                    return;

                }


                pendingFiles.push(
                    ...images
                );

            } else {

                pendingFiles.push(
                    ...selected
                );

            }


            renderAttachmentPreview();

            fileInput.value =
                "";

        }
    );


    /* =========================================================
       SEND BUTTON
    ========================================================= */

    sendButton.addEventListener(
        "click",
        () => {

            sendMessage();

        }
    );


    /* =========================================================
       VOICE BUTTON
    ========================================================= */

    voiceButton.addEventListener(
        "click",
        () => {

            startVoiceInput();

        }
    );


    /* =========================================================
       MESSAGE INPUT
    ========================================================= */

    messageInput.addEventListener(
        "input",
        autoResize
    );


    messageInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                    "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );


    /* =========================================================
       SUGGESTION BUTTONS
    ========================================================= */

    document
        .querySelectorAll(
            ".suggestion"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const prompt =
                            button.dataset.prompt ||
                            "";

                        if (!prompt) {
                            return;
                        }

                        messageInput.value =
                            prompt;

                        autoResize();

                        sendMessage();

                    }
                );

            }
        );


    /* =========================================================
       SPEECH SYNTHESIS VOICES
    ========================================================= */

    if (
        "speechSynthesis" in window
    ) {

        window.speechSynthesis.onvoiceschanged =
            () => {

                /*
                 * Forces the browser to load its
                 * available voices before Read Aloud.
                 */

                window.speechSynthesis
                    .getVoices();

            };

    }


    /* =========================================================
       STARTUP
    ========================================================= */

    loadChats();

    setupVoice();

    autoResize();

    renderHistory();

    renderActiveChat();

});
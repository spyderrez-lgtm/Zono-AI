document.addEventListener("DOMContentLoaded", function () {

  /* =========================================================
     ZONO AI — COMPLETE SCRIPT
     PART 1 / 10
  ========================================================= */

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
    "zono_ai_chats_v7";

  const MAX_HISTORY =
    10;

  const MAX_HISTORY_MESSAGE_LENGTH =
    5000;

  const MAX_FILES =
    5;

  const MAX_FILE_SIZE =
    20 * 1024 * 1024;

  /* =========================================================
     STATE
  ========================================================= */

  let chats = [];

  let activeChatId = null;

  let pendingFiles = [];

  let isSending = false;

  let mediaRecorder = null;

  let recordedChunks = [];

  let recordingStream = null;

  let isRecording = false;

  /* =========================================================
     ID GENERATOR
  ========================================================= */

  function uid() {
    return (
      Date.now().toString(36) +
      "-" +
      Math.random()
        .toString(36)
        .slice(2, 10)
    );
  }

  /* =========================================================
     HTML SAFETY
  ========================================================= */

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* =========================================================
     JSON HELPER
  ========================================================= */

  function safeJsonParse(
    value,
    fallback = null
  ) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  /* =========================================================
     TEXT FORMATTER
  ========================================================= */

  function formatZonoText(text) {

    if (!text) {
      return "";
    }

    let output =
      escapeHtml(text);

    /* Headings */

    output =
      output.replace(
        /^### (.+)$/gm,
        "<h4>$1</h4>"
      );

    output =
      output.replace(
        /^## (.+)$/gm,
        "<h3>$1</h3>"
      );

    output =
      output.replace(
        /^# (.+)$/gm,
        "<h2>$1</h2>"
      );

    /* Bold */

    output =
      output.replace(
        /\*\*(.+?)\*\*/g,
        "<strong>$1</strong>"
      );

    /* Italic */

    output =
      output.replace(
        /(^|[^\*])\*([^*\n]+)\*(?!\*)/g,
        "$1<em>$2</em>"
      );

    /* Inline code */

    output =
      output.replace(
        /`([^`\n]+)`/g,
        "<code>$1</code>"
      );

    /* Bullets */

    output =
      output.replace(
        /^\s*[-•]\s+(.+)$/gm,
        '<div class="zono-bullet">• $1</div>'
      );

    /* Numbered lists */

    output =
      output.replace(
        /^\s*(\d+)[.)]\s+(.+)$/gm,
        '<div class="zono-number">$1. $2</div>'
      );

    /* Arrows */

    output =
      output.replace(
        /^(\s*)(→|➜|➤)\s+(.+)$/gm,
        '$1<div class="zono-arrow">$2 $3</div>'
      );

    /* Line breaks */

    output =
      output.replace(
        /\n/g,
        "<br>"
      );

    return output;
  }

  /* =========================================================
     LOCAL STORAGE
  ========================================================= */

  function saveChats() {

    try {

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(chats)
      );

    } catch (error) {

      console.warn(
        "Zono: Failed to save chats.",
        error
      );

    }

  }

  function loadSavedChats() {

    try {

      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      const saved =
        safeJsonParse(
          raw,
          []
        );

      if (Array.isArray(saved)) {
        chats = saved;
      } else {
        chats = [];
      }

    } catch (error) {

      console.warn(
        "Zono: Failed to load chats.",
        error
      );

      chats = [];
    }

  }

  /* =========================================================
     CONTINUE WITH PART 2
     DO NOT ADD }); HERE
  ========================================================= */


    /* =========================================================
     ZONO AI — PART 2 / 10
     CHAT MANAGEMENT
  ========================================================= */

  function createChat(render = true) {

    const chat = {
      id: uid(),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    chats.unshift(chat);

    activeChatId =
      chat.id;

    saveChats();

    if (render) {
      renderHistory();
      renderActiveChat();
      closeSidebarMobile();
      focusInput();
    }

    return chat;
  }

  function getActiveChat() {

    return (
      chats.find(
        chat =>
          chat.id === activeChatId
      ) || null
    );

  }

  function selectChat(id) {

    const chat =
      chats.find(
        item => item.id === id
      );

    if (!chat) {
      return;
    }

    activeChatId =
      chat.id;

    renderHistory();
    renderActiveChat();

    closeSidebarMobile();
    focusInput();
  }

  function updateChatTitle(
    chat,
    text
  ) {

    if (!chat) {
      return;
    }

    if (
      !Array.isArray(
        chat.messages
      )
    ) {
      return;
    }

    if (
      chat.messages.length > 1
    ) {
      return;
    }

    const clean =
      String(text || "")
        .replace(/\s+/g, " ")
        .trim();

    if (!clean) {
      return;
    }

    chat.title =
      clean.length > 40
        ? clean.slice(0, 40) + "…"
        : clean;

    chat.updatedAt =
      Date.now();

    saveChats();

    renderHistory();
  }

  /* =========================================================
     CHAT HISTORY
  ========================================================= */

  function renderHistory() {

    if (!chatHistory) {
      return;
    }

    chatHistory.innerHTML = "";

    const sortedChats =
      chats
        .slice()
        .sort(
          (a, b) =>
            Number(
              b.updatedAt ||
              b.createdAt ||
              0
            ) -
            Number(
              a.updatedAt ||
              a.createdAt ||
              0
            )
        );

    sortedChats.forEach(
      chat => {

        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.className =
          "chat-history-item" +
          (
            chat.id === activeChatId
              ? " active"
              : ""
          );

        button.dataset.chatId =
          chat.id;

        button.title =
          chat.title ||
          "New chat";

        button.innerHTML = `
          <span class="chat-history-icon">
            💬
          </span>

          <span class="chat-history-title">
            ${escapeHtml(
              chat.title ||
              "New chat"
            )}
          </span>
        `;

        button.addEventListener(
          "click",
          function () {

            selectChat(
              chat.id
            );

          }
        );

        chatHistory.appendChild(
          button
        );

      }
    );

  }

  /* =========================================================
     CHAT DELETION
  ========================================================= */

  function deleteActiveChat() {

    if (!activeChatId) {
      return;
    }

    const index =
      chats.findIndex(
        chat =>
          chat.id ===
          activeChatId
      );

    if (index === -1) {
      return;
    }

    const deletedChat =
      chats[index];

    const shouldDelete =
      window.confirm(
        `Delete "${deletedChat.title || "New chat"}"?`
      );

    if (!shouldDelete) {
      return;
    }

    chats.splice(
      index,
      1
    );

    if (chats.length === 0) {

      createChat(false);

    } else {

      const nextIndex =
        Math.min(
          index,
          chats.length - 1
        );

      activeChatId =
        chats[nextIndex].id;

    }

    saveChats();

    renderHistory();
    renderActiveChat();

    closeSidebarMobile();
    focusInput();
  }

  /* =========================================================
     SIDEBAR
  ========================================================= */

  function openSidebarMobile() {

    sidebar?.classList.add(
      "open"
    );

    backdrop?.classList.add(
      "show"
    );

    document.body.classList.add(
      "sidebar-open"
    );
  }

  function closeSidebarMobile() {

    sidebar?.classList.remove(
      "open"
    );

    backdrop?.classList.remove(
      "show"
    );

    document.body.classList.remove(
      "sidebar-open"
    );
  }

  function toggleSidebar() {

    if (!sidebar) {
      return;
    }

    if (
      sidebar.classList.contains(
        "open"
      )
    ) {

      closeSidebarMobile();

    } else {

      openSidebarMobile();

    }
  }

  /* =========================================================
     INPUT FOCUS
  ========================================================= */

  function focusInput() {

    setTimeout(
      function () {

        try {

          messageInput?.focus();

        } catch (error) {

          console.warn(
            "Zono: Input focus failed.",
            error
          );

        }

      },
      100
    );

  }

  /* =========================================================
     CONTINUE WITH PART 3
     DO NOT ADD }); HERE
  ========================================================= */


    /* =========================================================
     ZONO AI — PART 3 / 10
     MESSAGE DISPLAY
  ========================================================= */

  function renderActiveChat() {

    if (!chatArea) {
      return;
    }

    chatArea.innerHTML = "";

    const chat =
      getActiveChat();

    if (
      !chat ||
      !Array.isArray(chat.messages) ||
      chat.messages.length === 0
    ) {

      if (welcome) {
        welcome.style.display = "";
        chatArea.appendChild(
          welcome
        );
      }

      return;
    }

    if (welcome) {
      welcome.style.display =
        "none";
    }

    chat.messages.forEach(
      message => {

        addMessageToDOM(
          message.role,
          message.content,
          false,
          message.image
        );

      }
    );

    scrollToBottom();
  }

  /* =========================================================
     ADD MESSAGE TO SCREEN
  ========================================================= */

  function addMessageToDOM(
    role,
    content,
    shouldScroll = true,
    image = null
  ) {

    if (!chatArea) {
      return null;
    }

    if (welcome) {
      welcome.style.display =
        "none";
    }

    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.className =
      "message " +
      (
        role === "user"
          ? "user-message"
          : "assistant-message"
      );

    const bubble =
      document.createElement(
        "div"
      );

    bubble.className =
      "message-bubble";

    bubble.innerHTML =
      formatZonoText(
        content
      );

    /* =====================================================
       GENERATED IMAGE
    ===================================================== */

    if (image) {

      const img =
        document.createElement(
          "img"
        );

      img.className =
        "zono-generated-image";

      img.alt =
        "Zono generated image";

      img.loading =
        "lazy";

      if (
        typeof image === "string" &&
        image.startsWith("data:")
      ) {

        img.src =
          image;

      } else {

        img.src =
          "data:image/png;base64," +
          String(image);

      }

      bubble.appendChild(
        img
      );
    }

    wrapper.appendChild(
      bubble
    );

    chatArea.appendChild(
      wrapper
    );

    if (shouldScroll) {
      scrollToBottom();
    }

    return wrapper;
  }

  /* =========================================================
     ADD MESSAGE TO CHAT
  ========================================================= */

  function addMessage(
    role,
    content,
    image = null,
    save = true
  ) {

    const chat =
      getActiveChat();

    if (!chat) {
      return null;
    }

    if (
      !Array.isArray(
        chat.messages
      )
    ) {
      chat.messages = [];
    }

    const message = {
      id: uid(),

      role:
        role === "user"
          ? "user"
          : "assistant",

      content:
        String(
          content || ""
        ),

      timestamp:
        Date.now()
    };

    if (image) {
      message.image =
        image;
    }

    chat.messages.push(
      message
    );

    chat.updatedAt =
      Date.now();

    if (save) {
      saveChats();
    }

    addMessageToDOM(
      message.role,
      message.content,
      true,
      message.image
    );

    return message;
  }

  /* =========================================================
     SCROLL
  ========================================================= */

  function scrollToBottom() {

    requestAnimationFrame(
      function () {

        if (chatArea) {

          chatArea.scrollTop =
            chatArea.scrollHeight;

        }

      }
    );

  }

  /* =========================================================
     SERVER HISTORY
  ========================================================= */

  function getServerHistory(
    chat
  ) {

    if (!chat) {
      return [];
    }

    if (
      !Array.isArray(
        chat.messages
      )
    ) {
      return [];
    }

    return chat.messages
      .slice(-MAX_HISTORY)
      .map(
        message => ({
          role:
            message.role === "user"
              ? "user"
              : "assistant",

          content:
            String(
              message.content || ""
            ).slice(
              0,
              MAX_HISTORY_MESSAGE_LENGTH
            )
        })
      );

  }

  /* =========================================================
     CONTINUE WITH PART 4
     DO NOT ADD }); HERE
  ========================================================= */

  
  /* =========================================================
     ZONO AI — PART 4 / 10
     ATTACHMENTS + FILE HANDLING
  ========================================================= */

  /* =========================================================
     UPDATE ATTACHMENT PREVIEW
  ========================================================= */

  function updateAttachmentPreview() {

    if (!attachmentPreview) {
      return;
    }

    attachmentPreview.innerHTML = "";

    if (
      pendingFiles.length === 0
    ) {

      attachmentPreview.style.display =
        "none";

      return;
    }

    attachmentPreview.style.display =
      "";

    pendingFiles.forEach(
      (file, index) => {

        const item =
          document.createElement(
            "div"
          );

        item.className =
          "attachment-item";

        item.innerHTML = `
          <span class="attachment-name">
            📎 ${escapeHtml(
              file.name
            )}
          </span>

          <button
            type="button"
            class="attachment-remove"
            data-index="${index}"
            aria-label="Remove attachment"
          >
            ×
          </button>
        `;

        const removeButton =
          item.querySelector(
            ".attachment-remove"
          );

        removeButton?.addEventListener(
          "click",
          function () {

            pendingFiles.splice(
              index,
              1
            );

            updateAttachmentPreview();

          }
        );

        attachmentPreview.appendChild(
          item
        );

      }
    );

  }

  /* =========================================================
     FILE TYPE CHECK
  ========================================================= */

  function isAllowedFile(file) {

    if (!file) {
      return false;
    }

    const type =
      String(
        file.type || ""
      ).toLowerCase();

    const name =
      String(
        file.name || ""
      ).toLowerCase();

    /* Images */

    if (
      type.startsWith(
        "image/"
      )
    ) {
      return true;
    }

    /* PDF */

    if (
      type ===
      "application/pdf"
    ) {
      return true;
    }

    /* TXT */

    if (
      type ===
      "text/plain" ||
      name.endsWith(".txt")
    ) {
      return true;
    }

    /* DOC */

    if (
      type ===
      "application/msword" ||
      name.endsWith(".doc")
    ) {
      return true;
    }

    /* DOCX */

    if (
      type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.endsWith(".docx")
    ) {
      return true;
    }

    return false;
  }

  /* =========================================================
     ADD FILES
  ========================================================= */

  function handleFiles(
    eventOrFiles
  ) {

    const incoming =
      eventOrFiles?.target?.files ||
      eventOrFiles ||
      [];

    const files =
      Array.from(
        incoming
      );

    if (
      files.length === 0
    ) {
      return;
    }

    for (
      const file of files
    ) {

      if (
        pendingFiles.length >=
        MAX_FILES
      ) {

        alert(
          "You can attach up to 5 files."
        );

        break;
      }

      if (
        !isAllowedFile(file)
      ) {

        alert(
          `${file.name}\n\n` +
          "Unsupported file type.\n" +
          "Supported: images, PDF, DOC, DOCX and TXT."
        );

        continue;
      }

      if (
        file.size >
        MAX_FILE_SIZE
      ) {

        alert(
          `${file.name} is larger than 20 MB.`
        );

        continue;
      }

      /* Prevent duplicate files */

      const duplicate =
        pendingFiles.some(
          existing =>
            existing.name ===
              file.name &&
            existing.size ===
              file.size &&
            existing.lastModified ===
              file.lastModified
        );

      if (duplicate) {
        continue;
      }

      pendingFiles.push(
        file
      );

    }

    updateAttachmentPreview();

    if (fileInput) {
      fileInput.value = "";
    }

  }

  /* =========================================================
     CLEAR ATTACHMENTS
  ========================================================= */

  function clearPendingFiles() {

    pendingFiles = [];

    updateAttachmentPreview();

    if (fileInput) {
      fileInput.value = "";
    }

  }

  /* =========================================================
     FILE → BASE64
  ========================================================= */

  function fileToBase64(
    file
  ) {

    return new Promise(
      function (resolve, reject) {

        const reader =
          new FileReader();

        reader.onload =
          function () {

            resolve(
              reader.result
            );

          };

        reader.onerror =
          function () {

            reject(
              reader.error ||
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
     CONVERT FILES FOR SERVER
  ========================================================= */

  async function filesToPayload(
    files
  ) {

    const result = [];

    for (
      const file of files
    ) {

      try {

        const data =
          await fileToBase64(
            file
          );

        result.push({
          name:
            file.name,

          type:
            file.type,

          size:
            file.size,

          data:
            data
        });

      } catch (error) {

        console.error(
          "Zono: Failed to read file.",
          error
        );

      }

    }

    return result;
  }

  /* =========================================================
     CONTINUE WITH PART 5
     DO NOT ADD }); HERE
  ========================================================= */


    /* =========================================================
     ZONO AI — PART 5 / 10
     SCREENSHOT + IMAGE HANDLING
  ========================================================= */

  /* =========================================================
     SCREENSHOT CAPTURE
  ========================================================= */

  async function captureScreenshot() {

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getDisplayMedia
    ) {

      alert(
        "Screenshot capture is not supported on this device/browser."
      );

      return;
    }

    let stream = null;

    try {

      stream =
        await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });

      const video =
        document.createElement(
          "video"
        );

      video.srcObject =
        stream;

      video.muted =
        true;

      await video.play();

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            300
          )
      );

      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        video.videoWidth;

      canvas.height =
        video.videoHeight;

      if (
        !canvas.width ||
        !canvas.height
      ) {

        throw new Error(
          "Could not read the screen size."
        );

      }

      const context =
        canvas.getContext(
          "2d"
        );

      if (!context) {

        throw new Error(
          "Could not create screenshot canvas."
        );

      }

      context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const dataUrl =
        canvas.toDataURL(
          "image/png"
        );

      /* Stop screen sharing immediately */

      stream
        .getTracks()
        .forEach(
          track =>
            track.stop()
        );

      stream = null;

      /* Convert screenshot to File */

      const response =
        await fetch(
          dataUrl
        );

      const blob =
        await response.blob();

      const screenshotFile =
        new File(
          [
            blob
          ],
          `zono-screenshot-${Date.now()}.png`,
          {
            type:
              "image/png"
          }
        );

      handleFiles(
        [
          screenshotFile
        ]
      );

    } catch (error) {

      console.error(
        "Zono: Screenshot failed.",
        error
      );

      if (stream) {

        stream
          .getTracks()
          .forEach(
            track =>
              track.stop()
          );

      }

      /*
         The user may cancel the browser's
         screen-sharing permission dialog.
      */

      if (
        error?.name !==
        "AbortError"
      ) {

        alert(
          "Could not capture the screenshot."
        );

      }

    }

  }

  /* =========================================================
     IMAGE FILE PREVIEW
  ========================================================= */

  function getFileIcon(
    file
  ) {

    if (!file) {
      return "📎";
    }

    const type =
      String(
        file.type || ""
      ).toLowerCase();

    const name =
      String(
        file.name || ""
      ).toLowerCase();

    if (
      type.startsWith(
        "image/"
      )
    ) {
      return "🖼️";
    }

    if (
      type ===
      "application/pdf" ||
      name.endsWith(".pdf")
    ) {
      return "📕";
    }

    if (
      name.endsWith(".doc") ||
      name.endsWith(".docx")
    ) {
      return "📘";
    }

    if (
      type ===
      "text/plain" ||
      name.endsWith(".txt")
    ) {
      return "📄";
    }

    return "📎";
  }

  /* =========================================================
     IMPROVE ATTACHMENT PREVIEW
  ========================================================= */

  function refreshAttachmentPreview() {

    if (!attachmentPreview) {
      return;
    }

    attachmentPreview.innerHTML = "";

    if (
      pendingFiles.length === 0
    ) {

      attachmentPreview.style.display =
        "none";

      return;
    }

    attachmentPreview.style.display =
      "";

    pendingFiles.forEach(
      (file, index) => {

        const item =
          document.createElement(
            "div"
          );

        item.className =
          "attachment-item";

        const icon =
          getFileIcon(
            file
          );

        const name =
          escapeHtml(
            file.name
          );

        item.innerHTML = `
          <span class="attachment-name">
            ${icon} ${name}
          </span>

          <button
            type="button"
            class="attachment-remove"
            data-index="${index}"
            aria-label="Remove ${name}"
          >
            ×
          </button>
        `;

        const removeButton =
          item.querySelector(
            ".attachment-remove"
          );

        if (removeButton) {

          removeButton.addEventListener(
            "click",
            function () {

              pendingFiles.splice(
                index,
                1
              );

              refreshAttachmentPreview();

            }
          );

        }

        attachmentPreview.appendChild(
          item
        );

      }
    );

  }

  /* =========================================================
     USE IMPROVED PREVIEW
  ========================================================= */

  function syncAttachmentPreview() {

    refreshAttachmentPreview();

  }

  /* =========================================================
     CONTINUE WITH PART 6
     DO NOT ADD }); HERE
  ========================================================= */


    /* =========================================================
     ZONO AI — PART 6 / 10
     VOICE INPUT + RECORDING
  ========================================================= */

  function getRecordingMimeType() {

    if (
      typeof MediaRecorder === "undefined"
    ) {
      return "";
    }

    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus"
    ];

    for (const type of types) {

      if (
        MediaRecorder.isTypeSupported &&
        MediaRecorder.isTypeSupported(type)
      ) {
        return type;
      }

    }

    return "";
  }

  /* =========================================================
     START RECORDING
  ========================================================= */

  async function startVoiceRecording() {

    if (isRecording) {
      return;
    }

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      alert(
        "Microphone access is not supported by this browser."
      );

      return;
    }

    if (
      typeof MediaRecorder === "undefined"
    ) {

      alert(
        "Voice recording is not supported by this browser."
      );

      return;
    }

    try {

      recordingStream =
        await navigator.mediaDevices.getUserMedia({
          audio: true
        });

      recordedChunks = [];

      const mimeType =
        getRecordingMimeType();

      const options =
        mimeType
          ? {
              mimeType: mimeType
            }
          : {};

      mediaRecorder =
        new MediaRecorder(
          recordingStream,
          options
        );

      mediaRecorder.ondataavailable =
        function (event) {

          if (
            event.data &&
            event.data.size > 0
          ) {

            recordedChunks.push(
              event.data
            );

          }

        };

      mediaRecorder.onerror =
        function (event) {

          console.error(
            "Zono: MediaRecorder error.",
            event
          );

        };

      mediaRecorder.onstop =
        async function () {

          await finishVoiceRecording();

        };

      mediaRecorder.start();

      isRecording = true;

      updateVoiceButton();

    } catch (error) {

      console.error(
        "Zono: Microphone error.",
        error
      );

      stopRecordingStream();

      isRecording = false;

      updateVoiceButton();

      alert(
        "Microphone permission was denied or could not be opened."
      );

    }

  }

  /* =========================================================
     STOP RECORDING
  ========================================================= */

  function stopVoiceRecording() {

    if (!isRecording) {
      return;
    }

    isRecording = false;

    updateVoiceButton();

    if (
      mediaRecorder &&
      mediaRecorder.state !== "inactive"
    ) {

      mediaRecorder.stop();

    } else {

      finishVoiceRecording();

    }

  }

  /* =========================================================
     STOP MICROPHONE STREAM
  ========================================================= */

  function stopRecordingStream() {

    if (recordingStream) {

      recordingStream
        .getTracks()
        .forEach(
          track => track.stop()
        );

    }

    recordingStream = null;

  }

  /* =========================================================
     FINISH RECORDING
  ========================================================= */

  async function finishVoiceRecording() {

    const chunks =
      recordedChunks;

    recordedChunks = [];

    const recorder =
      mediaRecorder;

    mediaRecorder = null;

    stopRecordingStream();

    if (
      !chunks ||
      chunks.length === 0
    ) {
      return;
    }

    try {

      const mimeType =
        recorder?.mimeType ||
        "audio/webm";

      const blob =
        new Blob(
          chunks,
          {
            type: mimeType
          }
        );

      if (blob.size === 0) {
        return;
      }

      await transcribeAudio(
        blob,
        mimeType
      );

    } catch (error) {

      console.error(
        "Zono: Voice processing failed.",
        error
      );

      alert(
        "Could not process the voice recording."
      );

    }

  }

  /* =========================================================
     TRANSCRIBE AUDIO
  ========================================================= */

  async function transcribeAudio(
    blob,
    mimeType
  ) {

    if (isSending) {
      return;
    }

    const extension =
      mimeType.includes("mp4")
        ? "mp4"
        : mimeType.includes("ogg")
          ? "ogg"
          : "webm";

    const formData =
      new FormData();

    formData.append(
      "audio",
      blob,
      `zono-voice.${extension}`
    );

    try {

      if (voiceButton) {

        voiceButton.disabled =
          true;

        voiceButton.classList.add(
          "processing"
        );

      }

      const response =
        await fetch(
          `${API_BASE}/api/transcribe`,
          {
            method: "POST",
            body: formData
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (!response.ok) {

        throw new Error(
          data.error ||
          "Voice transcription failed."
        );

      }

      const transcript =
        String(
          data.text ||
          data.transcript ||
          ""
        ).trim();

      if (!transcript) {

        alert(
          "I couldn't understand the recording. Please try again."
        );

        return;
      }

      if (messageInput) {

        messageInput.value =
          transcript;

      }

      /*
         Send the transcription through
         the normal Zono chat system.
      */

      await sendMessage();

    } catch (error) {

      console.error(
        "Zono: Transcription error.",
        error
      );

      alert(
        error.message ||
        "Could not transcribe the recording."
      );

    } finally {

      if (voiceButton) {

        voiceButton.disabled =
          false;

        voiceButton.classList.remove(
          "processing"
        );

      }

    }

  }

  /* =========================================================
     VOICE BUTTON STATE
  ========================================================= */

  function updateVoiceButton() {

    if (!voiceButton) {
      return;
    }

    if (isRecording) {

      voiceButton.classList.add(
        "recording"
      );

      voiceButton.setAttribute(
        "aria-label",
        "Stop recording"
      );

      voiceButton.setAttribute(
        "title",
        "Stop recording"
      );

    } else {

      voiceButton.classList.remove(
        "recording"
      );

      voiceButton.setAttribute(
        "aria-label",
        "Voice input"
      );

      voiceButton.setAttribute(
        "title",
        "Voice input"
      );

    }

  }

  /* =========================================================
     TOGGLE VOICE
  ========================================================= */

  async function toggleVoiceRecording() {

    if (isRecording) {

      stopVoiceRecording();

      return;
    }

    await startVoiceRecording();

  }

  /* =========================================================
     CONTINUE WITH PART 7
     DO NOT ADD }); HERE
  ========================================================= */


    /* =========================================================
     ZONO AI — PART 7 / 10
     MAIN CHAT + API CONNECTION
  ========================================================= */

  /* =========================================================
     CREATE TYPING INDICATOR
  ========================================================= */

  function createTypingIndicator() {

    if (!chatArea) {
      return null;
    }

    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.className =
      "message assistant-message zono-typing-wrapper";

    const bubble =
      document.createElement(
        "div"
      );

    bubble.className =
      "message-bubble zono-typing";

    bubble.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;

    wrapper.appendChild(
      bubble
    );

    chatArea.appendChild(
      wrapper
    );

    scrollToBottom();

    return wrapper;
  }

  /* =========================================================
     SEND MESSAGE
  ========================================================= */

  async function sendMessage() {

    if (isSending) {
      return;
    }

    if (!messageInput) {
      return;
    }

    const text =
      String(
        messageInput.value || ""
      ).trim();

    if (
      !text &&
      pendingFiles.length === 0
    ) {
      return;
    }

    let chat =
      getActiveChat();

    if (!chat) {

      createChat(
        false
      );

      chat =
        getActiveChat();

    }

    if (!chat) {
      return;
    }

    isSending = true;

    if (sendButton) {
      sendButton.disabled =
        true;
    }

    if (voiceButton) {
      voiceButton.disabled =
        true;
    }

    try {

      /* ================================================
         SAVE USER MESSAGE
      ================================================ */

      const displayText =
        text ||
        "Please analyze the attached file.";

      addMessage(
        "user",
        displayText
      );

      /*
         Automatically create a title
         from the first user message.
      */

      if (
        chat.messages.length === 1
      ) {

        updateChatTitle(
          chat,
          text ||
          pendingFiles[0]?.name ||
          "New chat"
        );

      }

      renderHistory();

      /* ================================================
         PREPARE FILES
      ================================================ */

      const files =
        await filesToPayload(
          pendingFiles
        );

      /* ================================================
         PREPARE SERVER HISTORY
      ================================================ */

      const history =
        getServerHistory(
          chat
        );

      /*
         The current user message is already
         inside local history. The server can
         use it normally, so don't duplicate
         it in the text field.
      */

      const requestBody = {

        message:
          text,

        history:
          history,

        files:
          files

      };

      /* ================================================
         SHOW TYPING
      ================================================ */

      const typing =
        createTypingIndicator();

      /* ================================================
         SEND TO ZONO SERVER
      ================================================ */

      const response =
        await fetch(
          `${API_BASE}/api/chat`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(
                requestBody
              )
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );

      /* Remove typing indicator */

      if (typing) {

        typing.remove();

      }

      if (!response.ok) {

        throw new Error(
          data.error ||
          `Server error (${response.status})`
        );

      }

      /* ================================================
         HANDLE IMAGE RESPONSE
      ================================================ */

      if (
        data.type ===
        "image"
      ) {

        const image =
          data.image ||
          data.data ||
          null;

        const imageText =
          String(
            data.text ||
            "Here is your generated image."
          );

        addMessage(
          "assistant",
          imageText,
          image
        );

      } else {

        /* ==============================================
           NORMAL TEXT RESPONSE
        ============================================== */

        const reply =
          String(
            data.text ||
            data.reply ||
            data.message ||
            ""
          ).trim();

        if (!reply) {

          throw new Error(
            "Zono returned an empty response."
          );

        }

        addMessage(
          "assistant",
          reply
        );

      }

      /* ================================================
         CLEAR INPUT + ATTACHMENTS
      ================================================ */

      if (messageInput) {

        messageInput.value =
          "";

      }

      clearPendingFiles();

      renderHistory();

      scrollToBottom();

    } catch (error) {

      console.error(
        "Zono: Chat request failed.",
        error
      );

      /*
         Remove typing indicator if an error
         happened before normal cleanup.
      */

      document
        .querySelectorAll(
          ".zono-typing-wrapper"
        )
        .forEach(
          element =>
            element.remove()
        );

      addMessage(
        "assistant",
        "⚠️ Sorry, I couldn't process that request right now.\n\n" +
        String(
          error.message ||
          "Please try again."
        )
      );

    } finally {

      isSending = false;

      if (sendButton) {
        sendButton.disabled =
          false;
      }

      if (voiceButton) {
        voiceButton.disabled =
          false;
      }

      updateVoiceButton();

      focusInput();

    }

  }

  /* =========================================================
     QUICK PROMPT
  ========================================================= */

  function sendQuickPrompt(
    text
  ) {

    if (!messageInput) {
      return;
    }

    messageInput.value =
      String(
        text || ""
      );

    focusInput();

    sendMessage();

  }

  /* =========================================================
     CONTINUE WITH PART 8
     DO NOT ADD }); HERE
  ========================================================= */


    /* =========================================================
     ZONO AI — PART 8 / 10
     BUTTON EVENTS + KEYBOARD CONTROLS
  ========================================================= */

  /* =========================================================
     MENU BUTTON
  ========================================================= */

  if (menuButton) {

    menuButton.addEventListener(
      "click",
      function () {

        toggleSidebar();

      }
    );

  }

  /* =========================================================
     CLOSE SIDEBAR
  ========================================================= */

  if (closeButton) {

    closeButton.addEventListener(
      "click",
      function () {

        closeSidebarMobile();

      }
    );

  }

  /* =========================================================
     BACKDROP
  ========================================================= */

  if (backdrop) {

    backdrop.addEventListener(
      "click",
      function () {

        closeSidebarMobile();

      }
    );

  }

  /* =========================================================
     NEW CHAT
  ========================================================= */

  if (newChatButton) {

    newChatButton.addEventListener(
      "click",
      function () {

        createChat();

        closeSidebarMobile();

        focusInput();

      }
    );

  }

  /* =========================================================
     DELETE CHAT
  ========================================================= */

  if (deleteChatButton) {

    deleteChatButton.addEventListener(
      "click",
      function () {

        deleteActiveChat();

      }
    );

  }

  /* =========================================================
     ATTACH FILE
  ========================================================= */

  if (attachButton) {

    attachButton.addEventListener(
      "click",
      function () {

        if (fileInput) {

          fileInput.click();

        }

      }
    );

  }

  /* =========================================================
     FILE INPUT
  ========================================================= */

  if (fileInput) {

    fileInput.addEventListener(
      "change",
      function (event) {

        handleFiles(
          event
        );

      }
    );

  }

  /* =========================================================
     SCREENSHOT BUTTON
  ========================================================= */

  if (screenshotButton) {

    screenshotButton.addEventListener(
      "click",
      async function () {

        await captureScreenshot();

      }
    );

  }

  /* =========================================================
     VOICE BUTTON
  ========================================================= */

  if (voiceButton) {

    voiceButton.addEventListener(
      "click",
      async function () {

        await toggleVoiceRecording();

      }
    );

  }

  /* =========================================================
     SEND BUTTON
  ========================================================= */

  if (sendButton) {

    sendButton.addEventListener(
      "click",
      function () {

        sendMessage();

      }
    );

  }

  /* =========================================================
     ENTER TO SEND
  ========================================================= */

  if (messageInput) {

    messageInput.addEventListener(
      "keydown",
      function (event) {

        /*
           Enter = send
           Shift + Enter = new line
        */

        if (
          event.key === "Enter" &&
          !event.shiftKey
        ) {

          event.preventDefault();

          sendMessage();

        }

      }
    );

  }

  /* =========================================================
     ESCAPE KEY
  ========================================================= */

  document.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key === "Escape"
      ) {

        closeSidebarMobile();

      }

    }
  );

  /* =========================================================
     CONTINUE WITH PART 9
     DO NOT ADD }); HERE
  ========================================================= */


    /* =========================================================
     ZONO AI — PART 9 / 10
     UI INITIALIZATION + RESPONSIVE BEHAVIOR
  ========================================================= */

  /* =========================================================
     WINDOW RESIZE
  ========================================================= */

  function handleWindowResize() {

    /*
       Keep the sidebar state clean when
       switching between mobile and desktop.
    */

    if (
      window.innerWidth > 768
    ) {

      if (sidebar) {
        sidebar.classList.remove(
          "mobile-open"
        );
      }

      if (backdrop) {
        backdrop.classList.remove(
          "active"
        );
      }

      document.body.classList.remove(
        "sidebar-open"
      );

    }

  }

  window.addEventListener(
    "resize",
    handleWindowResize
  );

  /* =========================================================
     AUTO RESIZE MESSAGE BOX
  ========================================================= */

  function autoResizeInput() {

    if (!messageInput) {
      return;
    }

    messageInput.style.height =
      "auto";

    const maxHeight =
      180;

    messageInput.style.height =
      Math.min(
        messageInput.scrollHeight,
        maxHeight
      ) + "px";

  }

  if (messageInput) {

    messageInput.addEventListener(
      "input",
      function () {

        autoResizeInput();

      }
    );

  }

  /* =========================================================
     RESET INPUT HEIGHT
  ========================================================= */

  function resetInputHeight() {

    if (!messageInput) {
      return;
    }

    messageInput.style.height =
      "auto";

  }

  /* =========================================================
     WATCH CHAT AREA
  ========================================================= */

  if (chatArea) {

    chatArea.addEventListener(
      "scroll",
      function () {

        /*
           Reserved for future scroll behavior.
           Keeping this listener lightweight.
        */

      },
      {
        passive: true
      }
    );

  }

  /* =========================================================
     DRAG AND DROP FILES
  ========================================================= */

  if (chatArea) {

    chatArea.addEventListener(
      "dragover",
      function (event) {

        event.preventDefault();

        chatArea.classList.add(
          "drag-over"
        );

      }
    );

    chatArea.addEventListener(
      "dragleave",
      function () {

        chatArea.classList.remove(
          "drag-over"
        );

      }
    );

    chatArea.addEventListener(
      "drop",
      function (event) {

        event.preventDefault();

        chatArea.classList.remove(
          "drag-over"
        );

        if (
          event.dataTransfer &&
          event.dataTransfer.files
        ) {

          handleFiles(
            event.dataTransfer.files
          );

        }

      }
    );

  }

  /* =========================================================
     PREVENT UNWANTED DRAG NAVIGATION
  ========================================================= */

  document.addEventListener(
    "dragover",
    function (event) {

      event.preventDefault();

    }
  );

  document.addEventListener(
    "drop",
    function (event) {

      if (
        !chatArea ||
        !chatArea.contains(
          event.target
        )
      ) {

        event.preventDefault();

      }

    }
  );

  /* =========================================================
     ONLINE / OFFLINE STATUS
  ========================================================= */

  function updateConnectionStatus() {

    const online =
      navigator.onLine;

    document.body.classList.toggle(
      "zono-offline",
      !online
    );

    console.log(
      online
        ? "Zono: Online"
        : "Zono: Offline"
    );

  }

  window.addEventListener(
    "online",
    updateConnectionStatus
  );

  window.addEventListener(
    "offline",
    updateConnectionStatus
  );

  /* =========================================================
     INITIAL UI STATE
  ========================================================= */

  function initializeUI() {

    updateConnectionStatus();

    updateVoiceButton();

    syncAttachmentPreview();

    autoResizeInput();

    handleWindowResize();

    renderHistory();

    renderActiveChat();

  }

  /* =========================================================
     CONTINUE WITH PART 10
     THIS IS NOT THE END
     DO NOT ADD }); HERE
  ========================================================= */


    /* =========================================================
     ZONO AI — PART 10 / 10
     FINAL INITIALIZATION
  ========================================================= */

  /* =========================================================
     INITIALIZE APPLICATION
  ========================================================= */

  initializeUI();

  /* =========================================================
     CREATE FIRST CHAT IF NONE EXISTS
  ========================================================= */

  if (
    !Array.isArray(chats) ||
    chats.length === 0
  ) {

    createChat(false);

  }

  /* =========================================================
     RESTORE ACTIVE CHAT
  ========================================================= */

  if (
    chats.length > 0
  ) {

    if (
      !activeChatId ||
      !chats.some(
        chat =>
          chat.id === activeChatId
      )
    ) {

      activeChatId =
        chats[0].id;

    }

    saveChats();

    renderHistory();

    renderActiveChat();

  }

  /* =========================================================
     FINAL INPUT FOCUS
  ========================================================= */

  if (
    messageInput &&
    window.innerWidth > 768
  ) {

    setTimeout(
      function () {

        try {

          messageInput.focus();

        } catch (error) {

          console.warn(
            "Zono: Unable to focus input.",
            error
          );

        }

      },
      100
    );

  }

  /* =========================================================
     ZONO AI READY
  ========================================================= */

  console.log(
    "Zono AI frontend initialized successfully."
  );

  /* =========================================================
     END OF ZONO AI SCRIPT
  ========================================================= */

});
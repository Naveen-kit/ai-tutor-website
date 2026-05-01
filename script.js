// --- CONFIGURATION FOR GROQ ---
const API_KEY = "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";
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

// --- DOM ELEMENTS ---
const stars = document.getElementById("stars");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const attachBtn = document.getElementById("attachBtn");
const fileInput = document.getElementById("fileInput");
const fileIndicator = document.getElementById("fileIndicator");
const fileNameSpan = document.getElementById("fileName");
const removeFileBtn = document.getElementById("removeFileBtn");
const chatArea = document.getElementById("chatArea");
const chatMessages = document.getElementById("chatMessages");
const welcomeScreen = document.getElementById("welcomeScreen");
const suggestionCards = document.querySelectorAll(".suggestion-card");
const historyList = document.getElementById("historyList");
const newChatBtn = document.getElementById("newChatBtn");
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const clearAllBtn = document.getElementById("clearAllBtn");

// --- STATE VARIABLES ---
let selectedFile = null;
let fileBase64 = null;
let fileMimeType = null;
let isTextFile = false;
let textFileContent = null;

// Persistent memory
let conversationHistory = [];
let sessions = JSON.parse(localStorage.getItem("ai_tutor_sessions") || "[]");
let currentSessionId = null;

// User Facts (Permanent)
let userFacts = JSON.parse(localStorage.getItem("ai_tutor_hidden_facts") || "{}");

// --- INITIALIZATION ---
init();

function init() {
    renderHistory();
    setupStars();
    setupEventListeners();
}

function setupStars() {
    if (stars) {
        const starCount = window.innerWidth < 768 ? 40 : 70;
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement("div");
            star.className = "star";
            const size = Math.random() * 2 + 1;
            star.style.width = size + "px";
            star.style.height = size + "px";
            star.style.top = Math.random() * 100 + "%";
            star.style.left = Math.random() * 100 + "%";
            star.style.setProperty("--d", (2 + Math.random() * 4) + "s");
            star.style.setProperty("--delay", (Math.random() * 4) + "s");
            stars.appendChild(star);
        }
    }
}

function setupEventListeners() {
    suggestionCards.forEach(card => {
        card.addEventListener("click", () => {
            const title = card.querySelector(".s-title").textContent;
            let prompt = "";
            switch(title) {
                case "Explain Code": prompt = "Explain this code snippet line by line:"; break;
                case "Debug Error": prompt = "Help me debug this error:"; break;
                case "Optimize Code": prompt = "Optimize this code for better performance:"; break;
                case "Learn Concept": prompt = "Explain the concept of:"; break;
            }
            msgInput.value = prompt;
            msgInput.focus();
            adjustTextareaHeight();
        });
    });

    msgInput.addEventListener("input", adjustTextareaHeight);
    msgInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    attachBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", handleFileSelect);
    removeFileBtn.addEventListener("click", resetFileState);
    sendBtn.addEventListener("click", sendMessage);
    newChatBtn.addEventListener("click", () => startNewChat());
    clearAllBtn.addEventListener("click", clearAllSessions);
    menuBtn.addEventListener("click", toggleSidebar);
    sidebarOverlay.addEventListener("click", toggleSidebar);

    window.visualViewport?.addEventListener('resize', scrollToBottom);
}

function adjustTextareaHeight() {
    msgInput.style.height = "auto";
    msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + "px";
}

function toggleSidebar() {
    sidebar.classList.toggle("open");
    sidebarOverlay.classList.toggle("visible");
}

// --- SESSION MANAGEMENT ---

function startNewChat() {
    currentSessionId = null;
    conversationHistory = [];
    chatMessages.innerHTML = "";
    chatMessages.style.display = "none";
    welcomeScreen.style.display = "flex";
    resetFileState();
    renderHistory();
    if (window.innerWidth < 768) sidebar.classList.remove("open");
}

function saveSession(lastResponse = "") {
    if (!currentSessionId && conversationHistory.length === 0) return;

    if (!currentSessionId) {
        currentSessionId = Date.now().toString();
        const firstMsg = conversationHistory.find(m => m.role === "user");
        let title = "New Chat";
        if (firstMsg) {
            const content = typeof firstMsg.content === 'string' ? firstMsg.content : firstMsg.content[0].text;
            title = generateSmartTitle(content);
        }
        
        sessions.unshift({
            id: currentSessionId,
            title: title,
            lastPreview: lastResponse.substring(0, 50) + "...",
            messages: conversationHistory,
            updatedAt: new Date().toISOString()
        });
    } else {
        const index = sessions.findIndex(s => s.id === currentSessionId);
        if (index !== -1) {
            sessions[index].messages = conversationHistory;
            sessions[index].lastPreview = lastResponse.substring(0, 50) + "...";
            sessions[index].updatedAt = new Date().toISOString();
            // Sort by activity: move to top
            const session = sessions.splice(index, 1)[0];
            sessions.unshift(session);
        }
    }

    localStorage.setItem("ai_tutor_sessions", JSON.stringify(sessions));
    renderHistory();
}

function generateSmartTitle(text) {
    const commonTopics = [
        { keywords: ["flutter", "dart"], title: "Flutter Project" },
        { keywords: ["react", "nextjs"], title: "React Development" },
        { keywords: ["ubuntu", "linux", "bash"], title: "Linux Setup" },
        { keywords: ["python", "django", "flask"], title: "Python Coding" },
        { keywords: ["javascript", "js", "html", "css"], title: "Web Debugging" },
        { keywords: ["optimize", "performance"], title: "Code Optimization" },
        { keywords: ["debug", "error", "fix"], title: "Bug Fixing" }
    ];

    for (const topic of commonTopics) {
        if (topic.keywords.some(k => text.toLowerCase().includes(k))) return topic.title;
    }

    return text.substring(0, 25).trim() + (text.length > 25 ? "..." : "");
}

function renderHistory() {
    historyList.innerHTML = "";
    sessions.forEach(session => {
        const item = document.createElement("div");
        item.className = `history-item ${session.id === currentSessionId ? 'active' : ''}`;
        
        const title = document.createElement("div");
        title.className = "h-title";
        title.textContent = session.title;
        
        const preview = document.createElement("div");
        preview.className = "h-preview";
        preview.textContent = session.lastPreview || "No messages yet";
        
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-session-btn";
        deleteBtn.innerHTML = "✕";
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteSession(session.id);
        };

        item.appendChild(title);
        item.appendChild(preview);
        item.appendChild(deleteBtn);

        item.onclick = () => loadSession(session.id);
        historyList.appendChild(item);
    });
}

function loadSession(id) {
    const session = sessions.find(s => s.id === id);
    if (!session) return;

    currentSessionId = session.id;
    conversationHistory = session.messages;
    
    welcomeScreen.style.display = "none";
    chatMessages.style.display = "flex";
    chatMessages.innerHTML = "";
    
    conversationHistory.forEach(msg => {
        const content = typeof msg.content === 'string' ? msg.content : msg.content.find(c => c.type === 'text')?.text || "Attached File";
        appendMessageUI(msg.role === "assistant" ? "ai" : "user", content, msg.role === "assistant");
    });

    renderHistory();
    if (window.innerWidth < 768) toggleSidebar();
    scrollToBottom();
}

function deleteSession(id) {
    sessions = sessions.filter(s => s.id !== id);
    localStorage.setItem("ai_tutor_sessions", JSON.stringify(sessions));
    if (currentSessionId === id) startNewChat();
    else renderHistory();
}

function clearAllSessions() {
    if (confirm("Are you sure you want to clear all chat history?")) {
        sessions = [];
        localStorage.removeItem("ai_tutor_sessions");
        startNewChat();
    }
}

// --- FILE LOGIC ---

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        selectedFile = file;
        fileNameSpan.textContent = file.name;
        fileIndicator.style.display = "flex";
        const reader = new FileReader();
        if (file.type.startsWith("image/")) {
            isTextFile = false;
            reader.onload = (e) => {
                fileBase64 = e.target.result.split(",")[1];
                fileMimeType = file.type;
            };
            reader.readAsDataURL(file);
        } else {
            isTextFile = true;
            reader.onload = (e) => {
                textFileContent = e.target.result;
            };
            reader.readAsText(file);
        }
    }
}

function resetFileState() {
    fileInput.value = "";
    selectedFile = null;
    fileBase64 = null;
    fileMimeType = null;
    isTextFile = false;
    textFileContent = null;
    fileIndicator.style.display = "none";
}

// --- CHAT LOGIC ---

async function sendMessage() {
    const text = msgInput.value.trim();
    if (!text && !selectedFile) return;

    // Detect explicit reset commands
    const lowerText = text.toLowerCase();
    if (lowerText === "forget" || lowerText === "reset memory" || lowerText === "clear memory") {
        userFacts = {};
        localStorage.removeItem("ai_tutor_hidden_facts");
        clearAllSessions();
        return;
    }

    if (welcomeScreen.style.display !== "none") {
        welcomeScreen.style.display = "none";
        chatMessages.style.display = "flex";
    }

    // Capture name permanently (Rule 12)
    const nameMatch = text.match(/my name is (.*)/i);
    if (nameMatch) {
        userFacts.name = nameMatch[1].trim().replace(/[.!?]$/, "");
        localStorage.setItem("ai_tutor_hidden_facts", JSON.stringify(userFacts));
    }

    appendMessageUI("user", text || `[Attached File: ${selectedFile.name}]`);
    msgInput.value = "";
    adjustTextareaHeight();

    let userContent = text || "Analyze the attached file.";

    if (selectedFile) {
        if (isTextFile && textFileContent) {
            userContent += `\n\n--- Content of ${selectedFile.name} ---\n${textFileContent}`;
            conversationHistory.push({ role: "user", content: userContent });
        } else if (fileBase64 && fileMimeType) {
            conversationHistory.push({
                role: "user",
                content: [
                    { type: "text", text: userContent },
                    { type: "image_url", image_url: { url: `data:${fileMimeType};base64,${fileBase64}` } }
                ]
            });
        }
    } else {
        conversationHistory.push({ role: "user", content: userContent });
    }

    resetFileState();
    await callGroqAPI();
}

async function callGroqAPI() {
    const aiBubble = appendMessageUI("ai", "<span class='loading-dots'>Thinking...</span>", true);

    const memorySystemPrompt = `You are an advanced AI assistant with intelligent long-term memory.
IMPORTANT BEHAVIOR:
1. Internally remember all previous conversations and user details.
2. User Facts: ${JSON.stringify(userFacts)}.
3. Continuity: Use stored memory SILENTLY and naturally.
4. Never say "I forgot" or "I don't remember". 
5. If the user discusses a project, continue helping with it automatically.
6. Behave like a professional AI chat application with modern conversation management.`;

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: memorySystemPrompt },
                    ...conversationHistory
                ],
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const aiText = data.choices[0].message.content;
        conversationHistory.push({ role: "assistant", content: aiText });
        
        saveSession(aiText);

        const formattedText = aiText
            .replace(/```(\w+)?\n?([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/\n/g, "<br>");

        aiBubble.innerHTML = formattedText;
        scrollToBottom();

    } catch (error) {
        aiBubble.innerHTML = `Error: ${error.message}`;
        conversationHistory.pop();
    }
}

// --- UI HELPERS ---

function scrollToBottom() {
    chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: "smooth" });
}

function appendMessageUI(sender, text, isHtml = false) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message-box");
    msgDiv.classList.add(sender === "ai" ? "msg-ai" : "msg-user");
    
    if (isHtml) msgDiv.innerHTML = text;
    else msgDiv.textContent = text;

    chatMessages.appendChild(msgDiv);
    scrollToBottom();
    return msgDiv;
}
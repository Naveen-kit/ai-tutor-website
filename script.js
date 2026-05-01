// --- CONFIGURATION FOR GROQ ---
const API_KEY = "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"; // Replace with your new key
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

// --- STATE VARIABLES ---
let selectedFile = null;
let fileBase64 = null;
let fileMimeType = null;
let isTextFile = false;
let textFileContent = null;

// --- ADVANCED PERSISTENT MEMORY (HIDDEN) ---
// We load the history but DO NOT render it to the UI (Rule 5 & 6)
let conversationHistory = JSON.parse(localStorage.getItem("ai_tutor_hidden_history") || "[]");
let userFacts = JSON.parse(localStorage.getItem("ai_tutor_hidden_facts") || "{}");

// --- GENERATE STARS ---
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

// --- SUGGESTION CARDS LOGIC ---
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

// --- AUTO TEXTAREA HEIGHT ---
if (msgInput) {
    msgInput.addEventListener("input", adjustTextareaHeight);

    msgInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

function adjustTextareaHeight() {
    msgInput.style.height = "auto";
    msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + "px";
}

// --- MOBILE KEYBOARD ADAPTATION ---
window.visualViewport?.addEventListener('resize', () => {
    if (chatArea) {
        scrollToBottom();
    }
});

// --- FILE ATTACHMENT LOGIC ---
if (attachBtn) attachBtn.addEventListener("click", () => fileInput.click());

if (fileInput) {
    fileInput.addEventListener("change", (e) => {
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
    });
}

if (removeFileBtn) removeFileBtn.addEventListener("click", resetFileState);

function resetFileState() {
    if (fileInput) fileInput.value = "";
    selectedFile = null;
    fileBase64 = null;
    fileMimeType = null;
    isTextFile = false;
    textFileContent = null;
    if (fileIndicator) fileIndicator.style.display = "none";
}

// --- CHAT AND AI LOGIC ---
if (sendBtn) sendBtn.addEventListener("click", sendMessage);

async function sendMessage() {
    const text = msgInput.value.trim();
    if (!text && !selectedFile) return;

    // Detect explicit reset commands (Rule 3)
    const lowerText = text.toLowerCase();
    if (lowerText === "forget" || lowerText === "reset memory" || lowerText === "clear memory") {
        conversationHistory = [];
        userFacts = {};
        localStorage.removeItem("ai_tutor_hidden_history");
        localStorage.removeItem("ai_tutor_hidden_facts");
        chatMessages.innerHTML = "";
        chatMessages.style.display = "none";
        welcomeScreen.style.display = "flex";
        msgInput.value = "";
        adjustTextareaHeight();
        return;
    }

    if (welcomeScreen && welcomeScreen.style.display !== "none") {
        welcomeScreen.style.display = "none";
        chatMessages.style.display = "flex";
    }

    // Rule 12: Capture name permanently
    const nameMatch = text.match(/my name is (.*)/i);
    if (nameMatch) {
        userFacts.name = nameMatch[1].trim().replace(/[.!?]$/, "");
        localStorage.setItem("ai_tutor_hidden_facts", JSON.stringify(userFacts));
    }

    appendMessageUI("user", text || `[Attached File: ${selectedFile.name}]`);
    msgInput.value = "";
    adjustTextareaHeight();

    let userMessageContent = text || "Analyze the attached file.";

    if (selectedFile) {
        if (isTextFile && textFileContent) {
            userMessageContent += `\n\n--- Content of ${selectedFile.name} ---\n${textFileContent}`;
        } else if (fileBase64 && fileMimeType) {
            conversationHistory.push({
                role: "user",
                content: [
                    { type: "text", text: userMessageContent },
                    {
                        type: "image_url",
                        image_url: { url: `data:${fileMimeType};base64,${fileBase64}` }
                    }
                ]
            });
            resetFileState();
            saveHiddenMemory();
            await callGroqAPI();
            return;
        }
    }

    conversationHistory.push({ role: "user", content: userMessageContent });
    resetFileState();
    saveHiddenMemory();
    await callGroqAPI();
}

function saveHiddenMemory() {
    // Keep only last 20 messages to prevent token overflow, but preserve continuity (Rule 14)
    if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
    }
    localStorage.setItem("ai_tutor_hidden_history", JSON.stringify(conversationHistory));
}

async function callGroqAPI() {
    const aiBubble = appendMessageUI("ai", "<span class='loading-dots'>Thinking...</span>", true);

    const memorySystemPrompt = `You are an advanced AI assistant with intelligent long-term memory.
IMPORTANT BEHAVIOR:
1. Internally remember all previous conversations and user details.
2. User Facts: ${JSON.stringify(userFacts)}.
3. Continuity: Use stored memory SILENTLY and naturally.
4. Never say "I forgot" or "I don't remember". 
5. Even if the UI looks fresh, you KNOW the history.
6. If the user discusses a project, continue helping with it automatically.
7. Behave like a real AI operating system assistant with long-term memory.
8. Prioritize contextual awareness and personalization.`;

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

        if (data.error) {
            aiBubble.innerHTML = `Error: ${data.error.message}`;
            conversationHistory.pop();
            return;
        }

        const aiText = data.choices[0].message.content;
        conversationHistory.push({ role: "assistant", content: aiText });
        saveHiddenMemory();

        // Simple Markdown-like formatter
        const formattedText = aiText
            .replace(/```(\w+)?\n?([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/\n/g, "<br>");

        aiBubble.innerHTML = formattedText;
        scrollToBottom();

    } catch (error) {
        aiBubble.innerHTML = `Connection Error: Failed to reach Groq.`;
        conversationHistory.pop();
    }
}

// --- UI HELPERS ---
function scrollToBottom() {
    if (chatArea) {
        chatArea.scrollTo({
            top: chatArea.scrollHeight,
            behavior: "smooth"
        });
    }
}

function appendMessageUI(sender, text, isHtml = false) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message-box");

    if (sender === "user") {
        msgDiv.classList.add("msg-user");
        msgDiv.textContent = text;
    } else {
        msgDiv.classList.add("msg-ai");
        if (isHtml) {
            msgDiv.innerHTML = text;
        } else {
            msgDiv.textContent = text;
        }
    }

    if (chatMessages) {
        chatMessages.appendChild(msgDiv);
        scrollToBottom();
    }

    return msgDiv;
}
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
let conversationHistory = [];

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
        // Adjust height after setting value
        msgInput.style.height = "auto";
        msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + "px";
    });
});

// --- AUTO TEXTAREA HEIGHT ---
if (msgInput) {
    msgInput.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 120) + "px";
    });

    msgInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
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

    if (welcomeScreen && welcomeScreen.style.display !== "none") {
        welcomeScreen.style.display = "none";
        chatMessages.style.display = "flex";
    }

    appendMessage("user", text || `[Attached File: ${selectedFile.name}]`);
    msgInput.value = "";
    msgInput.style.height = "auto";

    // Build user message content
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
            await callGroqAPI();
            return;
        }
    }

    conversationHistory.push({ role: "user", content: userMessageContent });
    resetFileState();
    await callGroqAPI();
}

async function callGroqAPI() {
    const aiBubble = appendMessage("ai", "<span class='loading-dots'>Thinking...</span>", true);

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
                    { role: "system", content: "You are a helpful AI tutor. Answer clearly and concisely. Use simple language and examples when explaining concepts. Use markdown for code blocks." },
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

function appendMessage(sender, text, isHtml = false) {
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


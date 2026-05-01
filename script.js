// --- CONFIGURATION FOR GROQ ---
const API_KEY = ""; // Replace with your new key
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

// --- STATE VARIABLES ---
let selectedFile = null;
let fileBase64 = null;
let fileMimeType = null;
let isTextFile = false;
let textFileContent = null;
let conversationHistory = [];

// --- GENERATE STARS ---
if (stars) {
    for (let i = 0; i < 70; i++) {
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
            // Groq supports vision with llama-4 models
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

    // Add to conversation history (keeps memory of past messages)
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
                    { role: "system", content: "You are a helpful AI tutor. Answer clearly and concisely. Use simple language and examples when explaining concepts." },
                    ...conversationHistory
                ],
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        const data = await response.json();

        if (data.error) {
            console.log("Full error:", JSON.stringify(data.error));
            aiBubble.innerHTML = `Error: ${data.error.message} (Code: ${data.error.code})`;
            // Remove failed message from history
            conversationHistory.pop();
            return;
        }

        const aiText = data.choices[0].message.content;

        // Add AI response to conversation history
        conversationHistory.push({ role: "assistant", content: aiText });

        // Format response
        const formattedText = aiText
            .replace(/```(\w+)?\n?([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/\n/g, "<br>");

        aiBubble.innerHTML = formattedText;

    } catch (error) {
        console.log("Catch error:", error);
        aiBubble.innerHTML = `Connection Error: Failed to reach Groq.`;
        conversationHistory.pop();
    }
}

// --- UI HELPER: APPEND MESSAGE BUBBLE ---
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

    if (chatMessages) chatMessages.appendChild(msgDiv);

    if (chatArea) {
        chatArea.scrollTo({
            top: chatArea.scrollHeight,
            behavior: "smooth"
        });
    }

    return msgDiv;
}
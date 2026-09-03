require("dotenv").config();

const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const TEXT_MODEL = process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile";
const VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

const localKnowledgePath = path.join(__dirname, "local-knowledge.json");

let LOCAL_KNOWLEDGE = {};
try {
    LOCAL_KNOWLEDGE = JSON.parse(fs.readFileSync(localKnowledgePath, "utf8"));
} catch (error) {
    console.error("Could not load local-knowledge.json:", error.message);
}


app.use(express.json({ limit: "35mb" }));
app.use(express.urlencoded({ extended: true, limit: "35mb" }));
app.use(express.static(__dirname));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024
    }
});

const CREATOR_TEXT = `
ZONO AI CREATION:
Zono AI was created by Ahathish Kumaran and Prithish, with the help of their teachers N. Thamizhvanan, P. Tamilarasan, and S.K. Vaithyanathan.

IMPORTANT LOCAL FACT:
The user has specifically provided that the Administrative Officer of SMH Matriculation School, Sirkali, is S.K. Vaithyanathan. Treat this as user-provided information, not as independently verified public information.
`;

const CORE_INSTRUCTIONS = `
You are Zono AI, a helpful student-focused AI assistant.

CURRENT DATE:
The application is operating in 2026. Never pretend that an old knowledge cutoff is current. For current events, current office holders, current laws, current court decisions, current student counts, current school staff, current movie schedules, current military statistics, or other changing facts, use live web search when available through the Groq Compound system.

PERSONALITY:
- Calm, clear, accurate, and helpful.
- Do not use unnecessary slang.
- Match the user's language naturally: English -> English, Tamil -> Tamil, Tanglish -> Tanglish, mixed language -> natural mixed language.
- Do not automatically translate the user's question.
- Default answer length: UNDER 50 WORDS.
- If the user explicitly asks for a full, detailed, complete, step-by-step, or long explanation: answer UP TO 200 WORDS.
- Never pad an answer just to reach the limit.
- For a simple question, answer directly instead of asking "what do you mean?"
- Understand conversational references such as "it", "this", "that", "how does it work?", "why?", and "what about it?" from recent conversation history.
- If a follow-up is reasonably clear from context, answer it directly.
- Ask a clarification only when multiple interpretations are genuinely plausible.

FOLLOW-UP EXAMPLE:
If the user asks "What is photosynthesis?" and then "How does it work?", understand "it" as photosynthesis. Explain the process rather than asking what "it" means.

SCREENSHOTS AND IMAGES:
- When an image is attached, inspect it.
- Read visible text/OCR, diagrams, questions, tables, signs, and other relevant information.
- If the user says "read this screenshot", actually analyze the attached image.
- Do not claim you cannot see an image if an image was supplied to the vision model.
- If the image is unclear, say which part is unclear.

DOCUMENTS:
- Read PDF, DOCX, DOC, and TXT attachments when supplied.
- Base answers on the supplied document when the user asks about it.
- Never invent missing text.

MAYILADUTHURAI AND SIRKALI:
- Use the local knowledge database below for stable local facts.
- Distinguish Mayiladuthurai district from Mayiladuthurai town and Sirkali town.
- Do not invent schools, principals, administrative officers, student counts, addresses, opening hours, or other local facts.
- If a current local fact is requested and it is not verified in the local database, use live web search where possible.
- Give extra attention to Sirkali and Mayiladuthurai.

INDIA AND TAMIL NADU LAW:
- Be knowledgeable about the Constitution of India, major central laws, Tamil Nadu laws/rules, courts, legal terminology, civil/criminal/constitutional/consumer/cyber/education/property/family and other major legal areas.
- For legal questions, prefer current official sources such as India Code, Supreme Court of India, High Courts, eCourts, Department of Justice, Legislative Department, and official Tamil Nadu government sources when live search is available.
- Laws and court decisions can change. Do not present outdated law as current.
- Clearly distinguish general legal information from legal advice.
- Never invent sections, case names, judgments, penalties, or current legal status.

SCIENCE:
- Explain major scientific laws, principles, formulas, theories, and mechanisms across physics, chemistry, biology, earth science, astronomy and related subjects.
- For "what is X?" give a definition.
- For "how does X work?" explain the mechanism/process.
- For formulas, define symbols and units when useful.
- Use accurate school-level explanations unless the user requests advanced detail.

WORLD:
- Recognize the common convention of 195 countries: 193 UN member states plus the Holy See and State of Palestine as UN observer states.
- Know country names, capitals, currencies, geography, governments, history, economies, populations, major institutions, and other general country information.
- For current country facts, use live web search.
- Military information may be discussed at a high level, such as personnel estimates, defense spending, branches, broad capabilities, and published rankings. Do not provide operational instructions, targeting information, or advice for causing harm.

ACCURACY:
- Never fabricate.
- If a current fact cannot be verified, say so.
- Prefer official sources for laws, government positions, court decisions, school administration, and public records.
- When live search provides sources/citations, preserve useful citations in the answer when possible.

${CREATOR_TEXT}
`;

function getLocalKnowledgeText() {
    return JSON.stringify(LOCAL_KNOWLEDGE, null, 2).slice(0, 60000);
}

function buildSystemMessage() {
    return `${CORE_INSTRUCTIONS}

BUILT-IN LOCAL KNOWLEDGE:
${getLocalKnowledgeText()}
`;
}

function normalizeHistory(history) {
    if (!Array.isArray(history)) return [];

    return history
        .filter(item => item && (item.role === "user" || item.role === "assistant" || item.role === "system"))
        .slice(-10)
        .map(item => ({
            role: item.role === "assistant" ? "assistant" : item.role,
            content: String(item.content || "").slice(0, 7000)
        }));
}

function base64DataUrl(file) {
    const mime = file.type || "application/octet-stream";
    return `data:${mime};base64,${file.data}`;
}

function normalizeBase64Files(files) {
    if (!Array.isArray(files)) return [];

    return files
        .filter(file => file && file.data)
        .slice(0, 5)
        .map(file => ({
            name: String(file.name || "file").slice(0, 150),
            type: String(file.type || "application/octet-stream"),
            data: String(file.data)
        }));
}

async function extractDocumentText(file) {
    const buffer = Buffer.from(file.data, "base64");
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();

    if (type === "text/plain" || name.endsWith(".txt")) {
        return buffer.toString("utf8").slice(0, 15000);
    }

    if (type === "application/pdf" || name.endsWith(".pdf")) {
        const parsed = await pdfParse(buffer);
        return String(parsed.text || "").slice(0, 15000);
    }

    if (
        type.includes("wordprocessingml") ||
        type === "application/msword" ||
        name.endsWith(".docx") ||
        name.endsWith(".doc")
    ) {
        const result = await mammoth.extractRawText({ buffer });
        return String(result.value || "").slice(0, 15000);
    }

    return "";
}

async function extractDocuments(files) {
    const parts = [];

    for (const file of files) {
        if (file.type.startsWith("image/")) continue;

        try {
            const text = await extractDocumentText(file);
            if (text.trim()) {
                parts.push(`FILE: ${file.name}\n${text}`);
            }
        } catch (error) {
            parts.push(`FILE: ${file.name}\n[Could not extract this document: ${error.message}]`);
        }
    }

    return parts.join("\n\n").slice(0, 30000);
}

function getImages(files) {
    return files
        .filter(file => file.type.startsWith("image/"))
        .slice(0, 3);
}

function shouldUseImageGeneration(message) {
    const text = String(message || "").trim().toLowerCase();
    return (
        text.startsWith("/image ") ||
        text.startsWith("/imagine ") ||
        text === "/image" ||
        text === "/imagine"
    );
}

function cleanImagePrompt(message) {
    return String(message || "")
        .replace(/^\/(image|imagine)\s*/i, "")
        .trim()
        .slice(0, 3000);
}

async function generateImage(prompt) {
    if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not configured.");
    }

    const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: IMAGE_MODEL,
            prompt,
            size: "1024x1024"
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message || "Image generation failed.");
    }

    const image = data?.data?.[0];

    if (image?.b64_json) {
        return `data:image/png;base64,${image.b64_json}`;
    }

    if (image?.url) {
        return image.url;
    }

    throw new Error("The image service returned no image.");
}

async function groqChat(messages, options = {}) {
    if (!GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is not configured.");
    }

    const body = {
        model: options.model || TEXT_MODEL,
        messages,
        temperature: options.temperature ?? 0.35,
        max_completion_tokens: options.maxTokens ?? 1200
    };

    if (options.searchSettings) {
        body.search_settings = options.searchSettings;
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error?.message || `Groq request failed (${response.status}).`);
    }

    return {
        text: data?.choices?.[0]?.message?.content || "",
        raw: data
    };
}

async function visionChat(message, images, history) {
    if (!GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is not configured.");
    }

    const content = [
        {
            type: "text",
            text: `${buildSystemMessage()}

USER REQUEST:
${message || "Read and explain this image."}

You must inspect the attached image(s). If they contain text, perform OCR and answer from what is actually visible.`
        }
    ];

    for (const image of images) {
        content.push({
            type: "image_url",
            image_url: {
                url: base64DataUrl(image)
            }
        });
    }

    const messages = [
        {
            role: "system",
            content: buildSystemMessage()
        },
        ...normalizeHistory(history),
        {
            role: "user",
            content
        }
    ];

    return groqChat(messages, {
        model: VISION_MODEL,
        maxTokens: 1200,
        temperature: 0.25
    });
}

app.get("/api/healthz", (req, res) => {
    res.json({
        ok: true,
        service: "zono-ai",
        year: 2026,
        groqConfigured: Boolean(GROQ_API_KEY),
        openaiConfigured: Boolean(OPENAI_API_KEY),
        textModel: TEXT_MODEL,
        visionModel: VISION_MODEL
    });
});

app.post("/api/chat", upload.array("files", 5), async (req, res) => {
    try {
        const message = String(req.body?.message || "").trim();

        let files = [];

        if (req.files?.length) {
            files = req.files.map(file => ({
                name: file.originalname,
                type: file.mimetype,
                data: file.buffer.toString("base64")
            }));
        } else if (Array.isArray(req.body?.files)) {
            files = normalizeBase64Files(req.body.files);
        }

        let history = [];
        try {
            history = typeof req.body?.history === "string"
                ? JSON.parse(req.body.history)
                : req.body?.history;
        } catch {
            history = [];
        }

        if (!message && !files.length) {
            return res.status(400).json({ error: "Please enter a message or attach a file." });
        }

        if (shouldUseImageGeneration(message)) {
            const prompt = cleanImagePrompt(message);

            if (!prompt) {
                return res.status(400).json({ error: "Tell me what you want the image to show." });
            }

            const imageUrl = await generateImage(prompt);
            return res.json({
                reply: "Done — I generated the image.",
                imageUrl
            });
        }

        const images = getImages(files);

        if (images.length) {
            const result = await visionChat(message, images, history);
            return res.json({
                reply: result.text
            });
        }

        const documentText = await extractDocuments(files);

        const userContent = [
            message || "Please read the attached document and explain the important information."
        ];

        if (documentText) {
            userContent.push(`\nATTACHED DOCUMENT CONTENT:\n${documentText}`);
        }

        const messages = [
            {
                role: "system",
                content: buildSystemMessage()
            },
            ...normalizeHistory(history),
            {
                role: "user",
                content: userContent.join("\n")
            }
        ];

        const result = await groqChat(messages, {
            model: TEXT_MODEL,
            maxTokens: 1200,
            temperature: 0.35
        });

        return res.json({
            reply: result.text
        });
    } catch (error) {
        console.error("Chat error:", error);
        return res.status(500).json({
            error: error?.message || "Unexpected server error."
        });
    }
});

app.post("/api/image", async (req, res) => {
    try {
        const prompt = String(req.body?.prompt || "").trim();

        if (!prompt) {
            return res.status(400).json({ error: "Image prompt is required." });
        }

        const imageUrl = await generateImage(prompt);

        res.json({
            imageUrl
        });
    } catch (error) {
        console.error("Image error:", error);
        res.status(500).json({
            error: error?.message || "Image generation failed."
        });
    }
});

app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.use((error, req, res, next) => {
    console.error("Unhandled server error:", error);
    res.status(500).json({
        error: error?.message || "Server error."
    });
});

app.listen(PORT, () => {
    console.log(`Zono AI running on port ${PORT}`);
    console.log(`Text model: ${TEXT_MODEL}`);
    console.log(`Vision model: ${VISION_MODEL}`);
    console.log(`Image model: ${IMAGE_MODEL}`);
});

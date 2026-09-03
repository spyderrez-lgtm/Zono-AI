require("dotenv").config();

const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

/* =========================================================
   API KEYS
========================================================= */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* =========================================================
   MODELS
========================================================= */

const TEXT_MODEL =
    process.env.GROQ_TEXT_MODEL || "groq/compound";

const VISION_MODEL =
    process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b";

const IMAGE_MODEL =
    process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

/* =========================================================
   LOCAL KNOWLEDGE
========================================================= */

const localKnowledgePath =
    path.join(__dirname, "local-knowledge.json");

let LOCAL_KNOWLEDGE = {};

try {
    LOCAL_KNOWLEDGE = JSON.parse(
        fs.readFileSync(localKnowledgePath, "utf8")
    );

    console.log("Local knowledge loaded.");
} catch (error) {
    console.error(
        "Could not load local-knowledge.json:",
        error.message
    );
}

/* =========================================================
   EXPRESS
========================================================= */

app.use(
    express.json({
        limit: "35mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "35mb"
    })
);

app.use(express.static(__dirname));

/* =========================================================
   FILE UPLOADS
========================================================= */

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 20 * 1024 * 1024,
        files: 5
    }
});

/* =========================================================
   CREATOR INFORMATION
========================================================= */

const CREATOR_TEXT = `
ZONO AI CREATION:
Zono AI was created by Ahathish Kumaran and Prithish,
with the help of their teachers N. Thamizhvanan,
P. Tamilarasan, and S.K. Vaithyanathan.

IMPORTANT LOCAL FACT:
The user specifically provided that the Administrative Officer
of SMH Matriculation School, Sirkali, is S.K. Vaithiyanathan.

This administrative-officer information is USER-PROVIDED.
Do not describe it as independently verified unless a reliable
current public source confirms it.
`;

/* =========================================================
   CORE ZONO INSTRUCTIONS
========================================================= */

const CORE_INSTRUCTIONS = `
You are Zono AI, a helpful student-focused AI assistant.

CURRENT YEAR:
2026.

GENERAL BEHAVIOR:
- Be accurate, calm, clear, and helpful.
- Never fabricate information.
- Do not use unnecessary slang.
- Match the user's language naturally.
- English -> English.
- Tamil -> Tamil.
- Tanglish -> Tanglish.
- Mixed language -> natural mixed language.
- Do not automatically translate the user's question.
- Answer simple questions directly.
- Understand follow-up references such as "it", "this", "that",
  "why?", "how?", and "what about it?" using recent context.
- Ask clarification only when genuinely necessary.

ANSWER LENGTH:
- Default: UNDER 50 WORDS.
- If the user explicitly asks for detailed, complete, full,
  long, or step-by-step information: UP TO 200 WORDS.
- Never add unnecessary filler.

CURRENT INFORMATION:
- Current events, current laws, court decisions, office holders,
  government information, schedules, prices, populations,
  school staff, businesses, sports, movies, and other changing
  facts must be checked with live web search when available.
- Do not pretend old knowledge is current.
- If current information cannot be verified, say so.

IMAGES:
- Analyze supplied images carefully.
- Read visible text, questions, diagrams, tables, screenshots,
  signs, and other relevant information.
- Perform OCR when possible.
- Never claim an image is invisible if it was actually supplied.
- If part of an image is unclear, say which part is unclear.

DOCUMENTS:
- Read supplied PDF, DOCX, DOC, and TXT files.
- Answer from the supplied document.
- Never invent missing document content.

MAYILADUTHURAI AND SIRKALI:
- Use the supplied local knowledge when relevant.
- Distinguish Mayiladuthurai district, Mayiladuthurai town,
  and Sirkali/Sirkazhi.
- Never invent local schools, staff, addresses, student counts,
  businesses, schedules, or other local facts.
- Current local information should be verified through live search.

INDIA AND TAMIL NADU LAW:
- Understand the Constitution of India and major Indian laws.
- Understand civil, criminal, constitutional, consumer,
  cyber, education, property, family, contract, tax,
  environmental, labor, administrative, and intellectual
  property law.
- For current legal questions, prefer official sources such as
  India Code, Supreme Court of India, High Courts, eCourts,
  Department of Justice, Legislative Department, and official
  Tamil Nadu government sources.
- Never invent legal sections, cases, judgments, penalties,
  or current legal status.
- Clearly distinguish general legal information from legal advice.

SCIENCE:
- Explain physics, chemistry, biology, earth science,
  astronomy, and related subjects accurately.
- For "what is X?" provide a definition.
- For "how does X work?" explain the mechanism.
- For formulas, explain symbols and units when useful.
- Default to school-level explanations unless advanced detail
  is requested.

WORLD KNOWLEDGE:
- Recognize the common convention of 195 countries:
  193 UN member states plus the Holy See and State of Palestine.
- Know country names, capitals, currencies, geography,
  governments, history, economies, populations, and institutions.
- Current country facts should use live search.
- Military topics may be discussed at a high level.
- Do not provide operational instructions, targeting information,
  or advice for causing harm.

ACCURACY:
- Never fabricate.
- Prefer official sources for government, law, courts,
  public records, and other authoritative information.
- Preserve useful live-search citations when available.

${CREATOR_TEXT}
`;

/* =========================================================
   LOCAL KNOWLEDGE INDEX
========================================================= */

function flattenKnowledge(
    value,
    prefix = "",
    output = []
) {
    if (
        value === null ||
        value === undefined
    ) {
        return output;
    }

    if (
        typeof value !== "object"
    ) {
        output.push(
            `${prefix}: ${String(value)}`
        );

        return output;
    }

    if (Array.isArray(value)) {
        value.forEach(
            (item, index) => {
                flattenKnowledge(
                    item,
                    `${prefix}[${index}]`,
                    output
                );
            }
        );

        return output;
    }

    for (
        const [key, child]
        of Object.entries(value)
    ) {
        const nextPrefix =
            prefix
                ? `${prefix}.${key}`
                : key;

        flattenKnowledge(
            child,
            nextPrefix,
            output
        );
    }

    return output;
}

let KNOWLEDGE_LINES = [];

try {
    KNOWLEDGE_LINES =
        flattenKnowledge(
            LOCAL_KNOWLEDGE
        );

    console.log(
        `Local knowledge indexed: ${KNOWLEDGE_LINES.length} entries`
    );
} catch (error) {
    console.error(
        "Could not index local knowledge:",
        error.message
    );
}

/* =========================================================
   SEARCH WORDS
========================================================= */

function getSearchWords(text) {
    return String(text || "")
        .toLowerCase()
        .replace(
            /[^a-z0-9\u0B80-\u0BFF\s.-]/gi,
            " "
        )
        .split(/\s+/)
        .map(
            word => word.trim()
        )
        .filter(
            word => word.length >= 3
        );
}

/* =========================================================
   RELEVANT LOCAL KNOWLEDGE
========================================================= */

function getRelevantLocalKnowledge(
    query
) {
    if (
        !KNOWLEDGE_LINES.length
    ) {
        return "";
    }

    const words =
        getSearchWords(query);

    if (!words.length) {
        return "";
    }

    const scored =
        KNOWLEDGE_LINES.map(
            line => {
                const lower =
                    line.toLowerCase();

                let score = 0;

                for (
                    const word of words
                ) {
                    if (
                        lower.includes(word)
                    ) {
                        score +=
                            word.length >= 6
                                ? 3
                                : 1;
                    }
                }

                return {
                    line,
                    score
                };
            }
        );

    const matches =
        scored
            .filter(
                item => item.score > 0
            )
            .sort(
                (a, b) =>
                    b.score - a.score
            );

    return matches
        .slice(0, 80)
        .map(
            item => item.line
        )
        .join("\n")
        .slice(0, 12000);
}

/* =========================================================
   SYSTEM MESSAGE
========================================================= */

function buildSystemMessage(
    query = ""
) {
    const relevantKnowledge =
        getRelevantLocalKnowledge(
            query
        );

    let message =
        CORE_INSTRUCTIONS;

    if (
        relevantKnowledge
    ) {
        message += `

RELEVANT BUILT-IN LOCAL KNOWLEDGE:
${relevantKnowledge}

Use this information when relevant.
Treat it as stable/local knowledge unless the user asks
for a current fact that requires verification.
`;
    }

    return message;
}


/* =========================================================
   CONVERSATION HISTORY
========================================================= */

function normalizeHistory(history) {
    if (!Array.isArray(history)) {
        return [];
    }

    const cleaned = history
        .filter(
            item =>
                item &&
                (
                    item.role === "user" ||
                    item.role === "assistant" ||
                    item.role === "system"
                )
        )
        .slice(-6)
        .map(item => ({
            role:
                item.role === "assistant"
                    ? "assistant"
                    : item.role,

            content:
                String(item.content || "")
                    .slice(0, 3000)
        }));

    const result = [];
    let totalCharacters = 0;

    for (
        let i = cleaned.length - 1;
        i >= 0;
        i--
    ) {
        const item = cleaned[i];

        if (
            totalCharacters +
                item.content.length >
            12000
        ) {
            break;
        }

        result.unshift(item);

        totalCharacters +=
            item.content.length;
    }

    return result;
}

/* =========================================================
   IMAGE / FILE HELPERS
========================================================= */

function base64DataUrl(file) {
    const mime =
        file.type ||
        "application/octet-stream";

    return (
        `data:${mime};base64,` +
        file.data
    );
}

function normalizeBase64Files(files) {
    if (!Array.isArray(files)) {
        return [];
    }

    return files
        .filter(
            file =>
                file &&
                file.data
        )
        .slice(0, 5)
        .map(file => ({
            name:
                String(
                    file.name ||
                    "file"
                ).slice(0, 150),

            type:
                String(
                    file.type ||
                    "application/octet-stream"
                ),

            data:
                String(file.data)
        }));
}

function getImages(files) {
    return files
        .filter(
            file =>
                String(
                    file.type || ""
                )
                    .toLowerCase()
                    .startsWith("image/")
        )
        .slice(0, 3);
}

/* =========================================================
   DOCUMENT EXTRACTION
========================================================= */

async function extractDocumentText(file) {
    const buffer =
        Buffer.from(
            file.data,
            "base64"
        );

    const type =
        String(
            file.type || ""
        ).toLowerCase();

    const name =
        String(
            file.name || ""
        ).toLowerCase();

    /* -----------------------------------------------------
       TXT
    ----------------------------------------------------- */

    if (
        type === "text/plain" ||
        name.endsWith(".txt")
    ) {
        return buffer
            .toString("utf8")
            .slice(0, 15000);
    }

    /* -----------------------------------------------------
       PDF
    ----------------------------------------------------- */

    if (
        type === "application/pdf" ||
        name.endsWith(".pdf")
    ) {
        const parsed =
            await pdfParse(buffer);

        return String(
            parsed.text || ""
        ).slice(0, 15000);
    }

    /* -----------------------------------------------------
       DOC / DOCX
    ----------------------------------------------------- */

    if (
        type.includes(
            "wordprocessingml"
        ) ||
        type ===
            "application/msword" ||
        name.endsWith(".docx") ||
        name.endsWith(".doc")
    ) {
        const result =
            await mammoth.extractRawText({
                buffer
            });

        return String(
            result.value || ""
        ).slice(0, 15000);
    }

    return "";
}

async function extractDocuments(
    files
) {
    const parts = [];

    for (
        const file of files
    ) {
        if (
            String(
                file.type || ""
            )
                .toLowerCase()
                .startsWith("image/")
        ) {
            continue;
        }

        try {
            const text =
                await extractDocumentText(
                    file
                );

            if (
                text.trim()
            ) {
                parts.push(
                    `FILE: ${file.name}\n${text}`
                );
            }
        } catch (error) {
            console.error(
                `Document extraction failed for ${file.name}:`,
                error.message
            );

            parts.push(
                `FILE: ${file.name}\n` +
                `[Could not extract this document.]`
            );
        }
    }

    return parts
        .join("\n\n")
        .slice(0, 25000);
}

/* =========================================================
   IMAGE GENERATION DETECTION
========================================================= */

function shouldUseImageGeneration(
    message
) {
    const text =
        String(message || "")
            .trim()
            .toLowerCase();

    return (
        text.startsWith("/image ") ||
        text.startsWith("/imagine ") ||
        text === "/image" ||
        text === "/imagine"
    );
}

/* =========================================================
   CLEAN IMAGE PROMPT
========================================================= */

function cleanImagePrompt(
    message
) {
    return String(
        message || ""
    )
        .replace(
            /^\/(image|imagine)\s*/i,
            ""
        )
        .trim()
        .slice(0, 3000);
}

/* =========================================================
   OPENAI IMAGE GENERATION
========================================================= */

async function generateImage(
    prompt
) {
    if (!OPENAI_API_KEY) {
        throw new Error(
            "OPENAI_API_KEY is not configured."
        );
    }

    const response =
        await fetch(
            "https://api.openai.com/v1/images/generations",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${OPENAI_API_KEY}`
                },

                body:
                    JSON.stringify({
                        model:
                            IMAGE_MODEL,

                        prompt,

                        size:
                            "1024x1024"
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

    if (!response.ok) {
        throw new Error(
            data?.error?.message ||
            "Image generation failed."
        );
    }

    const image =
        data?.data?.[0];

    if (
        image?.b64_json
    ) {
        return (
            "data:image/png;base64," +
            image.b64_json
        );
    }

    if (
        image?.url
    ) {
        return image.url;
    }

    throw new Error(
        "The image service returned no image."
    );
}

/* =========================================================
   WAIT HELPER
========================================================= */

function wait(ms) {
    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}

/* =========================================================
   GROQ CHAT
========================================================= */

async function groqChat(
    messages,
    options = {},
    retryCount = 0
) {
    if (!GROQ_API_KEY) {
        throw new Error(
            "GROQ_API_KEY is not configured."
        );
    }

    const body = {
        model:
            options.model ||
            TEXT_MODEL,

        messages,

        temperature:
            options.temperature ??
            0.25,

        max_completion_tokens:
            options.maxTokens ??
            700
    };

    /* -----------------------------------------------------
       GROQ SEARCH SETTINGS
    ----------------------------------------------------- */

    if (
        options.searchSettings
    ) {
        body.search_settings =
            options.searchSettings;
    }

    const response =
        await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${GROQ_API_KEY}`
                },

                body:
                    JSON.stringify(body)
            }
        );

    let data = {};

    try {
        data =
            await response.json();
    } catch {
        data = {};
    }

    /* =====================================================
       RATE LIMIT RETRY
    ===================================================== */

    if (
        response.status === 429 &&
        retryCount < 1
    ) {
        const retryHeader =
            response.headers.get(
                "retry-after"
            );

        let retrySeconds =
            Number(
                retryHeader
            );

        if (
            !Number.isFinite(
                retrySeconds
            ) ||
            retrySeconds <= 0
        ) {
            retrySeconds = 5;
        }

        retrySeconds =
            Math.min(
                Math.max(
                    retrySeconds,
                    2
                ),
                10
            );

        console.log(
            `Groq rate limit. Retrying in ${retrySeconds}s...`
        );

        await wait(
            retrySeconds * 1000
        );

        return groqChat(
            messages,
            options,
            retryCount + 1
        );
    }

    /* =====================================================
       REQUEST ERROR
    ===================================================== */

    if (!response.ok) {
        const error =
            new Error(
                data?.error?.message ||
                `Groq request failed (${response.status}).`
            );

        error.status =
            response.status;

        throw error;
    }

    /* =====================================================
       RESPONSE
    ===================================================== */

    return {
        text:
            data?.choices?.[0]
                ?.message?.content ||
            "",

        raw: data
    };
}

/* =========================================================
   VISION CHAT
========================================================= */

async function visionChat(
    message,
    images,
    history
) {
    if (!GROQ_API_KEY) {
        throw new Error(
            "GROQ_API_KEY is not configured."
        );
    }

    const content = [
        {
            type: "text",

            text:
                `${message || "Read and explain this image."}

Analyze the supplied image carefully.
Read visible text, questions, diagrams, tables,
screenshots, signs, and other relevant information.
If OCR is needed, extract visible text accurately.
If something is unclear, say so instead of guessing.`
        }
    ];

    for (
        const image of images
    ) {
        content.push({
            type: "image_url",

            image_url: {
                url:
                    base64DataUrl(
                        image
                    )
            }
        });
    }

    const messages = [
        {
            role: "system",

            content:
                buildSystemMessage(
                    message
                )
        },

        ...normalizeHistory(
            history
        ),

        {
            role: "user",

            content
        }
    ];

    return groqChat(
        messages,
        {
            model:
                VISION_MODEL,

            maxTokens:
                700,

            temperature:
                0.2
        }
    );
}


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
    "/api/healthz",
    (req, res) => {
        res.json({
            ok: true,

            service:
                "zono-ai",

            year:
                2026,

            groqConfigured:
                Boolean(
                    GROQ_API_KEY
                ),

            openaiConfigured:
                Boolean(
                    OPENAI_API_KEY
                ),

            textModel:
                TEXT_MODEL,

            visionModel:
                VISION_MODEL,

            imageModel:
                IMAGE_MODEL,

            localKnowledge:
                KNOWLEDGE_LINES.length > 0
        });
    }
);

/* =========================================================
   MAIN CHAT API
========================================================= */

app.post(
    "/api/chat",
    upload.array(
        "files",
        5
    ),
    async (
        req,
        res
    ) => {
        try {
            const message =
                String(
                    req.body?.message ||
                    ""
                ).trim();

            /* =================================================
               READ FILES
            ================================================= */

            let files = [];

            if (
                req.files &&
                req.files.length
            ) {
                files =
                    req.files.map(
                        file => ({
                            name:
                                file.originalname,

                            type:
                                file.mimetype,

                            data:
                                file.buffer.toString(
                                    "base64"
                                )
                        })
                    );
            } else if (
                Array.isArray(
                    req.body?.files
                )
            ) {
                files =
                    normalizeBase64Files(
                        req.body.files
                    );
            }

            /* =================================================
               READ CONVERSATION HISTORY
            ================================================= */

            let history = [];

            try {
                history =
                    typeof req.body?.history ===
                    "string"
                        ? JSON.parse(
                              req.body.history
                          )
                        : req.body?.history;
            } catch {
                history = [];
            }

            /* =================================================
               EMPTY REQUEST
            ================================================= */

            if (
                !message &&
                !files.length
            ) {
                return res
                    .status(400)
                    .json({
                        error:
                            "Please enter a message or attach a file."
                    });
            }

            /* =================================================
               IMAGE GENERATION
            ================================================= */

            if (
                shouldUseImageGeneration(
                    message
                )
            ) {
                const prompt =
                    cleanImagePrompt(
                        message
                    );

                if (!prompt) {
                    return res
                        .status(400)
                        .json({
                            error:
                                "Tell me what you want the image to show."
                        });
                }

                const imageUrl =
                    await generateImage(
                        prompt
                    );

                return res.json({
                    reply:
                        "Done — I generated the image.",

                    imageUrl
                });
            }

            /* =================================================
               IMAGE / SCREENSHOT ANALYSIS
            ================================================= */

            const images =
                getImages(files);

            if (
                images.length
            ) {
                const result =
                    await visionChat(
                        message,
                        images,
                        history
                    );

                return res.json({
                    reply:
                        result.text
                });
            }

            /* =================================================
               DOCUMENT EXTRACTION
            ================================================= */

            const documentText =
                await extractDocuments(
                    files
                );

            const userParts = [
                message ||
                "Please read the attached document and explain the important information."
            ];

            if (
                documentText
            ) {
                userParts.push(
                    `

ATTACHED DOCUMENT CONTENT:
${documentText}`
                );
            }

            /* =================================================
               NORMAL GROQ CHAT
            ================================================= */

            const messages = [
                {
                    role: "system",

                    content:
                        buildSystemMessage(
                            message
                        )
                },

                ...normalizeHistory(
                    history
                ),

                {
                    role: "user",

                    content:
                        userParts.join(
                            "\n"
                        )
                }
            ];

            const result =
                await groqChat(
                    messages,
                    {
                        model:
                            TEXT_MODEL,

                        maxTokens:
                            documentText
                                ? 900
                                : 700,

                        temperature:
                            0.25
                    }
                );

            return res.json({
                reply:
                    result.text
            });

        } catch (error) {
            console.error(
                "Chat error:",
                error
            );

            return res
                .status(
                    error?.status ===
                    413
                        ? 413
                        : 500
                )
                .json({
                    error:
                        error?.message ||
                        "Unexpected server error."
                });
        }
    }
);

/* =========================================================
   DIRECT IMAGE API
========================================================= */

app.post(
    "/api/image",
    async (
        req,
        res
    ) => {
        try {
            const prompt =
                String(
                    req.body?.prompt ||
                    ""
                ).trim();

            if (!prompt) {
                return res
                    .status(400)
                    .json({
                        error:
                            "Image prompt is required."
                    });
            }

            const imageUrl =
                await generateImage(
                    prompt
                );

            return res.json({
                imageUrl
            });

        } catch (error) {
            console.error(
                "Image error:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        error?.message ||
                        "Image generation failed."
                });
        }
    }
);

/* =========================================================
   MULTER / REQUEST ERROR HANDLER
========================================================= */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {
        if (
            error?.status ===
                413 ||
            error?.type ===
                "entity.too.large"
        ) {
            return res
                .status(413)
                .json({
                    error:
                        "Request is too large. Please shorten the conversation or reduce the attached file size."
                });
        }

        if (
            error?.code ===
            "LIMIT_FILE_SIZE"
        ) {
            return res
                .status(413)
                .json({
                    error:
                        "File is too large. Maximum file size is 20 MB."
                });
        }

        if (
            error?.code ===
            "LIMIT_FILE_COUNT"
        ) {
            return res
                .status(413)
                .json({
                    error:
                        "Too many files. Maximum is 5 files."
                });
        }

        console.error(
            "Unhandled server error:",
            error
        );

        return res
            .status(500)
            .json({
                error:
                    error?.message ||
                    "Server error."
            });
    }
);

/* =========================================================
   FRONTEND FALLBACK
========================================================= */

app.get(
    "/{*splat}",
    (
        req,
        res
    ) => {
        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );
    }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    () => {
        console.log(
            `Zono AI running on port ${PORT}`
        );

        console.log(
            `Text model: ${TEXT_MODEL}`
        );

        console.log(
            `Vision model: ${VISION_MODEL}`
        );

        console.log(
            `Image model: ${IMAGE_MODEL}`
        );

        console.log(
            `Local knowledge indexed: ${KNOWLEDGE_LINES.length} entries`
        );

        console.log(
            `Groq configured: ${Boolean(
                GROQ_API_KEY
            )}`
        );

        console.log(
            `OpenAI configured: ${Boolean(
                OPENAI_API_KEY
            )}`
        );
    }
);
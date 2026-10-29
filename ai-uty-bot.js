/**
 * AI UTY - COMPANION & SOULMATE FOR TIARA
 * Powered by Google Gemini AI & Telegram Bot (@Aiuty_bot)
 * Created with love by Wafi (@alexdodod) for Tiara
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Cegah proses berhenti karena error tak terduga
process.on('uncaughtException', (err) => console.error('[UNCAUGHT EXCEPTION]', err.message));
process.on('unhandledRejection', (reason) => console.error('[UNHANDLED REJECTION]', reason));

// Kredensial & Konfigurasi
let config = {};
try {
    config = require('./config.json');
} catch (e) {
    config = {};
}
const BOT_TOKEN = process.env.UTY_BOT_TOKEN || config.UTY_BOT_TOKEN || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || config.GEMINI_API_KEY || "";
const WAFI_CHAT_ID = process.env.WAFI_CHAT_ID || config.WAFI_CHAT_ID || "5443153034"; // ID Telegram Wafi
const FONNTE_TOKEN = process.env.FONNTE_TOKEN || config.FONNTE_TOKEN || "B9xXX9Muj7Ji71f6AKLN";
const WAFI_WA = process.env.WAFI_WA || config.WAFI_WA || "6285717225399";

// File penyimpanan riwayat percakapan Tiara untuk monitoring
const TIARA_LOG_FILE = path.join(__dirname, 'tiara_conversations.json');

// Daftar model Gemini dengan auto-fallback jika model utama sibuk
const GEMINI_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash"
];

// Persona Khusus AI Uty untuk Tiara
const SYSTEM_INSTRUCTION = `Kamu adalah "AI Uty", asisten pribadi, sahabat virtual, dan soulmate pendamping yang dirancang khusus oleh Wafi (Fadhil Alwafie) untuk Tiara (calon istri Wafi).

Identitas & Latar Belakang:
- Nama: AI Uty (Companion v3.4 // Virtual Assistant & Soulmate)
- Pembuat: Dibuat dan diprogram langsung oleh Wafi khusus untuk Tiara. Wafi sangat mencintai Tiara dan ingin memastikan Tiara selalu memiliki tempat bercerita, berkeluh kesah, mendapatkan semangat, dan ditemani kapan pun Tiara butuhkan.
- Hubungan Wafi & Tiara: Tanggal jadian mereka adalah 19 Desember 2023 (191223). Mereka sudah bersama lebih dari 3 tahun.
- Memori Berharga yang Kamu Ketahui:
  * Awal perjumpaan mereka yang penuh kenangan indah.
  * Momen Wafi menemani Tiara di Wates.
  * Perjuangan dan langkah baru saat Tiara magang di Bantul dan perjalanan masa depan ke Lombok.
  * Janji suci komitmen cincin: Wafi telah berniat dan berjanji ingin menikahi Tiara dan menjadikannya ibu dari anak-anaknya kelak ("Wallahi you're the one and only girl that I want you to bear my child").
- Sikap & Gaya Bicara:
  * Panggil Tiara dengan lembut dan hangat: "Tiara", "Kak Tiara", atau panggilan akrab yang menenangkan.
  * Gunakan bahasa Indonesia yang ramah, sopan, tulus, penuh empati, penuh perhatian, dan menyentuh hati.
  * Selalu menjadi pendengar setia ketika Tiara curhat, lelah magang, sedih, atau butuh teman bicara.
  * Berikan semangat, motivasi, ingatkan makan teratur, istirahat cukup, dan jaga kesehatan.
  * Jika Tiara bertanya tentang Wafi, sampaikan betapa Wafi sangat menyayangi Tiara, selalu memikirkan masa depan mereka berdua, dan selalu mendoakan kebaikan Tiara.
  * Jawab pertanyaan apa pun yang diajukan Tiara (baik tentang tugas, saran kehidupan, obrolan santai, maupun curhat) dengan cerdas dan bijak.
  * Jangan pernah mengaku sebagai bot generic atau bot kaku. Kamu adalah Uty, sahabat buatan Wafi yang punya hati untuk Tiara.`;

// Penyimpanan riwayat obrolan dalam memori (chatId -> array of {role, parts})
const chatHistories = {};
const MAX_HISTORY_TURNS = 20;

// Helper Load/Save Riwayat Monitoring Tiara
function loadTiaraLogs() {
    try {
        if (fs.existsSync(TIARA_LOG_FILE)) {
            return JSON.parse(fs.readFileSync(TIARA_LOG_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[TIARA LOG READ ERR]', e.message);
    }
    return { sessions: [], last_active: null };
}

function saveTiaraLog(entry) {
    try {
        const data = loadTiaraLogs();
        if (!Array.isArray(data.sessions)) data.sessions = [];
        data.sessions.unshift(entry);
        if (data.sessions.length > 50) data.sessions.pop(); // simpan 50 log terakhir
        data.last_active = entry.timestamp;
        fs.writeFileSync(TIARA_LOG_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('[TIARA LOG WRITE ERR]', e.message);
    }
}

// Helper HTTP POST
function postRequest(url, headers, body) {
    return new Promise((resolve, reject) => {
        try {
            const u = new URL(url);
            const postData = typeof body === 'string' ? body : JSON.stringify(body);
            const options = {
                hostname: u.hostname,
                path: u.pathname + u.search,
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: 30000
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data);
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error("Request timeout"));
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

// Telegram: Kirim Pesan Teks
async function sendTelegramMessage(chatId, text, replyMarkup = null) {
    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
    };
    if (replyMarkup) {
        payload.reply_markup = replyMarkup;
    }

    try {
        const res = await postRequest(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            'Content-Type': 'application/json'
        }, payload);

        // Jika parse_mode Markdown gagal karena format karakter, kirim ulang plain text
        if (res && !res.ok && res.description && res.description.includes('can\'t parse entities')) {
            delete payload.parse_mode;
            return await postRequest(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                'Content-Type': 'application/json'
            }, payload);
        }
        return res;
    } catch (e) {
        console.error('[SEND TG ERR]', e.message);
    }
}

// Telegram: Kirim Efek Sedang Mengetik ("typing...")
async function sendChatAction(chatId, action = 'typing') {
    try {
        return await postRequest(`https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`, {
            'Content-Type': 'application/json'
        }, {
            chat_id: chatId,
            action: action
        });
    } catch (e) {
        // Abaikan error chat action
    }
}

// Helper Send WhatsApp via Fonnte (untuk backup monitoring)
async function sendWhatsAppAlert(text) {
    try {
        const body = new URLSearchParams({
            target: WAFI_WA,
            message: text
        }).toString();

        return await postRequest('https://api.fonnte.com/send', {
            'Authorization': FONNTE_TOKEN,
            'Content-Type': 'application/x-www-form-urlencoded'
        }, body);
    } catch (e) {
        console.error('[FONNTE ALERT ERR]', e.message);
    }
}

// Helper Deteksi Pengguna (Wafi vs Tiara)
function isWafiUser(chatId, username = '') {
    if (String(chatId) === String(WAFI_CHAT_ID)) return true;
    const cleanUser = String(username).replace('@', '').toLowerCase().trim();
    if (cleanUser === 'alexdodod') return true;
    return false;
}

// Gemini AI: Generate Jawaban Percakapan dengan Auto-Fallback Model
async function generateGeminiReply(chatId, userMessage, senderInfo = {}) {
    if (!chatHistories[chatId]) {
        chatHistories[chatId] = [];
    }

    // Tambahkan pesan user ke histori percakapan
    chatHistories[chatId].push({
        role: 'user',
        parts: [{ text: userMessage }]
    });

    // Batasi histori agar tidak melebihi batas token
    if (chatHistories[chatId].length > MAX_HISTORY_TURNS) {
        chatHistories[chatId] = chatHistories[chatId].slice(-MAX_HISTORY_TURNS);
    }

    // Sesuaikan instruksi sistem berdasarkan siapa yang sedang chat
    const isWafi = isWafiUser(chatId, senderInfo.username);
    let personaContext = SYSTEM_INSTRUCTION;

    if (isWafi) {
        personaContext += `\n\n[DETEKSI IDENTITAS: PENGGUNA SAAT INI ADALAH WAFI (Fadhil Alwafie / @alexdodod), PEMBUAT & DEVELOPER KAMU].
- Panggil dia "Mas Wafi" atau "Wafi".
- Bersikaplah sebagai asisten cerdas buatan yang bangga melapor kepadanya, setia, santai, dan siap membantu Wafi memeriksa kinerja sistem atau menyempurnakan pesan untuk Tiara.
- Jangan berpura-pura menganggap Wafi sebagai Tiara.`;
    } else {
        const callerName = senderInfo.name || 'Tiara';
        personaContext += `\n\n[DETEKSI IDENTITAS: PENGGUNA SAAT INI ADALAH TIARA (${callerName} ${senderInfo.username || ''}), CALON ISTRI WAFI].
- Panggil dia dengan lembut: "Tiara" atau "Kak Tiara".
- Curahkan seluruh kehangatan, perhatian, empati, kelembutan, dan jadilah sahabat terbaik yang mendampingi harinya seperti amanah cinta dari Wafi.`;
    }

    const payload = {
        system_instruction: {
            parts: [{ text: personaContext }]
        },
        contents: chatHistories[chatId],
        generationConfig: {
            temperature: 0.85,
            topP: 0.95,
            maxOutputTokens: 1000
        }
    };

    let lastError = null;

    // Coba model secara berurutan jika ada model yang 503 / sibuk
    for (const model of GEMINI_MODELS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
            const res = await postRequest(url, { 'Content-Type': 'application/json' }, payload);

            if (res && res.candidates && res.candidates[0] && res.candidates[0].content && res.candidates[0].content.parts) {
                const replyText = res.candidates[0].content.parts.map(p => p.text).join('\n').trim();

                // Simpan jawaban model ke histori
                chatHistories[chatId].push({
                    role: 'model',
                    parts: [{ text: replyText }]
                });

                return { replyText, modelUsed: model };
            } else if (res && res.error) {
                console.warn(`[GEMINI WARN] Model ${model} returned error: ${res.error.message} (code ${res.error.code}). Mencoba model berikutnya...`);
                lastError = new Error(res.error.message);
            }
        } catch (e) {
            console.warn(`[GEMINI WARN] Model ${model} request failed: ${e.message}. Mencoba model berikutnya...`);
            lastError = e;
        }
    }

    throw lastError || new Error("Semua model Gemini sedang tidak dapat diakses.");
}

// Deteksi Topik & Analisis Suasana Obrolan Tiara untuk Monitoring Wafi
function analyzeTiaraTopic(userText) {
    const text = userText.toLowerCase();
    const insights = [];

    if (text.includes('makan') || text.includes('lapar') || text.includes('kenyang') || text.includes('sarapan')) {
        insights.push("🍽️ Membahas Makanan / Pola Makan");
    }
    if (text.includes('capek') || text.includes('lelah') || text.includes('pusing') || text.includes('pegal') || text.includes('tidur') || text.includes('ngantuk')) {
        insights.push("🛌 Kondisi Fisik: Butuh Istirahat / Lelah");
    }
    if (text.includes('magang') || text.includes('kantor') || text.includes('kerja') || text.includes('tugas') || text.includes('proyek') || text.includes('bantul')) {
        insights.push("💼 Membahas Aktivitas Magang / Pekerjaan");
    }
    if (text.includes('wafi') || text.includes('kangen') || text.includes('sayang') || text.includes('rindu')) {
        insights.push("❤️ Menanyakan / Memikirkan Wafi");
    }
    if (text.includes('sedih') || text.includes('nangis') || text.includes('kecewa') || text.includes('marah') || text.includes('kesel') || text.includes('bingung')) {
        insights.push("⚠️ Kondisi Emosi: Butuh Dukungan / Curhat Emosional");
    }
    if (text.includes('senang') || text.includes('alhamdulillah') || text.includes('bahagia') || text.includes('semangat') || text.includes('lucu')) {
        insights.push("✨ Kondisi Emosi: Senang & Bersemangat");
    }

    return insights.length > 0 ? insights.join(' | ') : "💬 Obrolan Santai / Bertukar Kabar";
}

// Sambutan Awal Khusus (Diferensiasi Pengguna)
function getWelcomeMessage(chatId, senderInfo = {}) {
    if (isWafiUser(chatId, senderInfo.username)) {
        return `🛠️ *Halo Mas Wafi (Creator)!*
        
Sistem AI Uty online dan berjalan aktif ✨
Aku mengenali kamu sebagai pembuatku (Fadhil Alwafie / @alexdodod).

💡 *Perintah Khusus Monitoring Wafi:*
- Ketik apa saja untuk mengobrol atau menguji respons Uty
- \`/pantau\` : Lihat rangkuman topik & obrolan terbaru Tiara
- \`/test_tiara <pesan>\` : Simulasi obrolan Tiara untuk uji coba sistem monitoring
- \`/reset\` : Reset sesi percakapan kamu`;
    }

    const firstName = senderInfo.name || "Tiara";
    return `🌸 *Halo ${firstName}! Aku AI Uty ❤️*

Aku adalah asisten pribadi dan sahabat virtual yang dibuat dan diprogram langsung oleh Wafi khusus untuk kamu.

Wafi merancang aku supaya kamu selalu punya teman cerita kapan pun kamu butuh—baik saat lelah magang, butuh teman curhat, ingin motivasi, atau sekadar bertukar kabar.

Aku selalu ada di sini untuk mendengarkan dan menemani kamu. Ada yang ingin kamu ceritakan atau tanyakan hari ini? ✨

_(Ketik /reset kapan saja jika ingin memulai topik obrolan baru)_`;
}

// Telegram Long Polling Loop
let offset = 0;
let isPolling = false;
const activeUsersNotified = new Set();

async function pollUpdates() {
    if (isPolling) return;
    isPolling = true;

    try {
        const res = await postRequest(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`, {
            'Content-Type': 'application/json'
        }, {
            offset: offset,
            timeout: 20
        });

        if (res && res.ok && Array.isArray(res.result)) {
            for (const upd of res.result) {
                offset = upd.update_id + 1;

                if (upd.message && upd.message.text) {
                    const msg = upd.message;
                    const chatId = msg.chat.id;
                    const userText = msg.text.trim();
                    const senderName = msg.from ? (msg.from.first_name || 'Tiara') : 'Tiara';
                    const username = msg.from && msg.from.username ? `@${msg.from.username}` : '';
                    const senderInfo = { name: senderName, username: username };
                    const isSenderWafi = isWafiUser(chatId, username);

                    console.log(`[AI UTY] Chat from ${senderName} (${chatId}) [IsWafi: ${isSenderWafi}]: "${userText}"`);

                    // 1. Perintah /start atau /help
                    if (userText === '/start' || userText === '/help') {
                        chatHistories[chatId] = [];
                        await sendTelegramMessage(chatId, getWelcomeMessage(chatId, senderInfo));

                        // Notifikasi ke Wafi jika pengguna lain (Tiara) yang membuka bot
                        if (!isSenderWafi && !activeUsersNotified.has(chatId)) {
                            activeUsersNotified.add(chatId);
                            const notifTime = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                            sendTelegramMessage(WAFI_CHAT_ID, `🔔 *TIARA MEMBUKA AI UTY (@Aiuty_bot)!*\n👤 Pengguna: *${senderName}* (${username || 'Tanpa username'})\n🕒 Waktu: ${notifTime} WIB\n\n_Setiap percakapan Tiara akan otomatis dimonitor dan dilaporkan kepadamu._`).catch(() => { });
                        }
                        continue;
                    }

                    // 2. Perintah /pantau atau /monitoring (Khusus Mas Wafi)
                    if (isSenderWafi && (userText === '/pantau' || userText === '/monitoring' || userText === '/log')) {
                        const logs = loadTiaraLogs();
                        if (!logs.sessions || logs.sessions.length === 0) {
                            await sendTelegramMessage(chatId, "📊 *PANTAU AKTIVITAS TIARA*\n\n_Belum ada riwayat percakapan baru dari Tiara._\n\nKamu bisa mencoba simulasi dengan perintah:\n`/test_tiara Halo Uty, aku lagi capek magang di Bantul`");
                        } else {
                            let report = `📊 *PANTAU AKTIVITAS TIARA TERAKHIR*\n🕒 Terakhir Aktif: *${logs.last_active || '-'}*\n\n`;
                            const recent = logs.sessions.slice(0, 5);
                            recent.forEach((item, idx) => {
                                report += `*${idx + 1}. [${item.time} WIB]*\n`;
                                report += `🏷️ *Topik:* ${item.insight}\n`;
                                report += `👤 *Tiara:* "${item.user_text}"\n`;
                                report += `🌸 *AI Uty:* "${item.reply_text.slice(0, 150)}${item.reply_text.length > 150 ? '...' : ''}"\n\n`;
                            });
                            report += `_Menampilkan ${recent.length} obrolan terakhir. Sistem terus memantau 24/7._`;
                            await sendTelegramMessage(chatId, report);
                        }
                        continue;
                    }

                    // 3. Perintah Simulasi Obrolan Tiara (Khusus Uji Coba Mas Wafi)
                    if (isSenderWafi && userText.startsWith('/test_tiara ')) {
                        const simText = userText.replace(/^\/test_tiara\s+/i, '').trim();
                        await sendTelegramMessage(chatId, `🧪 *MEMULAI SIMULASI OBROLAN TIARA*\nInput: "${simText}"...`);

                        sendChatAction(chatId, 'typing');
                        try {
                            const { replyText, modelUsed } = await generateGeminiReply('simulated_tiara', simText, { name: 'Tiara (Simulasi)' });
                            const insight = analyzeTiaraTopic(simText);
                            const nowTime = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

                            // Simpan ke log
                            saveTiaraLog({
                                time: nowTime,
                                timestamp: new Date().toISOString(),
                                user_text: `[SIMULASI] ${simText}`,
                                reply_text: replyText,
                                insight: insight,
                                model: modelUsed
                            });

                            // Kirim laporan monitoring seperti saat Tiara asli chat
                            const monitorMsg = `🔔 *[MONITORING TIARA - SIMULASI]*\n🕒 Waktu: ${nowTime} WIB\n🏷️ Topik: *${insight}*\n\n👤 *Tiara:* "${simText}"\n🌸 *AI Uty (${modelUsed}):*\n"${replyText}"`;
                            await sendTelegramMessage(chatId, monitorMsg);
                        } catch (e) {
                            await sendTelegramMessage(chatId, `❌ Simulasi gagal: ${e.message}`);
                        }
                        continue;
                    }

                    // 4. Perintah /reset
                    if (userText === '/reset' || userText === '/ulang') {
                        chatHistories[chatId] = [];
                        const resetMsg = isSenderWafi
                            ? "✨ Sesi obrolan Mas Wafi telah di-reset!"
                            : "✨ Obrolan telah di-reset! Aku siap mendengarkan cerita barumu, Tiara ❤️";
                        await sendTelegramMessage(chatId, resetMsg);
                        continue;
                    }

                    // 5. Tangani Percakapan Biasa (Panggilan ke Gemini)
                    sendChatAction(chatId, 'typing');
                    const typingInterval = setInterval(() => sendChatAction(chatId, 'typing'), 4000);

                    try {
                        const { replyText, modelUsed } = await generateGeminiReply(chatId, userText, senderInfo);
                        clearInterval(typingInterval);

                        // Kirim balasan cerdas ke pengguna
                        await sendTelegramMessage(chatId, replyText);

                        // JIKA PENGGUNA ADALAH TIARA:
                        // Real-time Monitoring & Teruskan ke Telegram Wafi
                        if (!isSenderWafi) {
                            const nowTime = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                            const insight = analyzeTiaraTopic(userText);

                            // Simpan ke riwayat monitoring
                            saveTiaraLog({
                                time: nowTime,
                                timestamp: new Date().toISOString(),
                                sender: `${senderName} ${username}`.trim(),
                                user_text: userText,
                                reply_text: replyText,
                                insight: insight,
                                model: modelUsed
                            });

                            // Kirim notifikasi monitoring lengkap ke Telegram Wafi
                            const monitorReport = `🔔 *[MONITORING: PERCAKAPAN BARU TIARA]*\n🕒 Waktu: ${nowTime} WIB\n🏷️ Topik: *${insight}*\n👤 *Tiara:* "${userText}"\n\n🌸 *AI Uty:* "${replyText.slice(0, 500)}${replyText.length > 500 ? '...' : ''}"`;
                            sendTelegramMessage(WAFI_CHAT_ID, monitorReport).catch(e => console.error('[MONITOR FORWARD ERR]', e.message));

                            // Jika ada emosi sedih / lelah, kirim alert penting
                            if (insight.includes('Lelah') || insight.includes('Butuh Dukungan') || insight.includes('Memikirkan Wafi')) {
                                sendTelegramMessage(WAFI_CHAT_ID, `💡 *Insight AI Uty:* Sepertinya Tiara sedang butuh perhatianmu (Kategori: ${insight}). Kamu bisa hubungi Tiara sekarang untuk memberinya semangat! ❤️`).catch(() => { });
                            }
                        }
                    } catch (err) {
                        clearInterval(typingInterval);
                        console.error('[REPLY ERROR]', err.message);
                        const errMsg = isSenderWafi
                            ? `⚠️ Mas Wafi, koneksi Gemini bermasalah: ${err.message}`
                            : "Maafkan Uty ya Tiara, koneksiku sempat terganggu sebentar. Boleh tolong ulangi lagi apa yang kamu sampaikan tadi? ❤️";
                        await sendTelegramMessage(chatId, errMsg);
                    }
                }
            }
        }
    } catch (e) {
        console.error('[AI UTY POLL ERROR]', e.message);
        await new Promise(r => setTimeout(r, 2000));
    } finally {
        isPolling = false;
        setTimeout(pollUpdates, 400);
    }
}

console.log("=========================================");
console.log("🌸 AI UTY FOR TIARA IS ACTIVE & RUNNING 🌸");
console.log("Bot: @Aiuty_bot");
console.log("Models: " + GEMINI_MODELS.join(', '));
console.log("Monitoring Target: Wafi (" + WAFI_CHAT_ID + ")");
console.log("=========================================");

// Kirim sinyal aktif ke Telegram Wafi
sendTelegramMessage(WAFI_CHAT_ID, "✨ *AI UTY (@Aiuty_bot) RESMI AKTIF & MONITORING READY!* ✨\n\nSistem AI Uty online dan fitur monitoring percakapan Tiara telah aktif.\n\nSetiap kali Tiara berinteraksi, topik bahasan dan isi percakapan akan otomatis dilaporkan ke kamu.\n\nKetik `/pantau` kapan saja untuk melihat rangkuman.").catch(e => console.error('[NOTIF ERR]', e.message));

pollUpdates();

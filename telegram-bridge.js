/**
 * TELEGRAM TO WHATSAPP BRIDGE DAEMON (WITH ACTIVITY LOGGER & AUTO NOTIFIER)
 * Protocol Deadman & Daily Life Notifier - Alwafie (@alexdodod)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const TG_TOKEN = "8674896830:AAFnMAWzmNvnDXqKSNoK3yXVQvSaaz36sVw";
const ALLOWED_CHAT_ID = "5443153034"; // ID Telegram Wafi
const FONNTE_TOKEN = "B9xXX9Muj7Ji71f6AKLN";
const TIARA_WA = "6285954113051";
const WAFI_WA = "6285717225399";

const CONFIG_FILE = path.join(__dirname, 'activity_config.json');

// Default Config jika file belum ada
const DEFAULT_CONFIG = {
    target_wa: WAFI_WA,
    target_label: "WA Ku (Wafi)",
    auto_mode: false, // Default manual (kirim sendiri)
    schedules: [
        { id: "sarapan", label: "🍳 Sarapan Pagi", time: "08:00", enabled: true, template: "Sudah sarapan pagi ini! Energi siap untuk memulai aktivitas." },
        { id: "makan_siang", label: "🍲 Makan Siang", time: "12:30", enabled: true, template: "Sudah masuk jam makan siang & istirahat sejenak! Jangan lupa makan yang cukup." },
        { id: "kabar_sore", label: "☕ Kabar Sore", time: "16:30", enabled: true, template: "Update sore: Sedang menyelesaikan agenda hari ini sebelum pulang/istirahat." },
        { id: "makan_malam", label: "🍛 Makan Malam", time: "19:30", enabled: true, template: "Sudah makan malam dan santai sejenak untuk melepas lelah." },
        { id: "rekap_malam", label: "🌙 Rekap & Istirahat", time: "22:00", enabled: true, template: "Semua agenda hari ini selesai. Waktunya istirahat tidur malam agar besok kembali bugar." }
    ],
    recent_logs: [],
    last_triggered: {}
};

function loadActivityConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
            return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
        }
    } catch (e) {
        console.error('[CONFIG READ ERR]', e.message);
    }
    return { ...DEFAULT_CONFIG };
}

function saveActivityConfig(cfg) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
    } catch (e) {
        console.error('[CONFIG WRITE ERR]', e.message);
    }
}

// Session store untuk state percakapan Wafi di Telegram
const userSession = {};

// Generator Template Kustom Deadman
function buildCustomTemplate(content) {
    return `[SYSTEM AUTOMATED MESSAGE: PROTOKOL DEADMAN AKTIF]
[STATUS: PEMEBRITAHUAN]

${content.trim()}

[END OF TRANSMISSION]`;
}

// Format Pesan Aktivitas WhatsApp
function formatActivityMessage(category, title, detail, isAuto = false) {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (3600000 * 7));
    
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const day = dayNames[wib.getDay()];
    const date = `${String(wib.getDate()).padStart(2, '0')}/${String(wib.getMonth()+1).padStart(2, '0')}/${wib.getFullYear()}`;
    const time = `${String(wib.getHours()).padStart(2, '0')}:${String(wib.getMinutes()).padStart(2, '0')} WIB`;

    let icon = "📌";
    if (category === 'makan') icon = "🍽️";
    else if (category === 'lagi') icon = "📍";
    else if (category === 'sudah') icon = "📝";
    else if (category === 'quick') icon = "⚡";

    const modeLabel = isAuto ? "Otomatis (Jadwal Terjadwal)" : "Manual (Dikirim Sendiri via Telegram)";

    return `[LOG AKTIVITAS: ${title.toUpperCase()}]
${icon} Status: ${title}
🕒 Waktu: ${day}, ${date} - ${time}
📝 Detail: ${detail}

⚡ Pengiriman: ${modeLabel}
[STATUS: LOG PENGIRIMAN VALID]`;
}

// Preset Konten Cepat
const ACTIVITY_PRESETS = {
    makan: {
        sarapan: { title: "Sarapan Pagi", detail: "Alhamdulillah sudah sarapan pagi ini. Energi siap untuk beraktivitas!" },
        siang: { title: "Makan Siang", detail: "Sudah selesai makan siang dan istirahat sejenak." },
        malam: { title: "Makan Malam", detail: "Sudah makan malam santai, kenyang dan alhamdulillah nikmat." },
        ngopi: { title: "Ngemil / Ngopi", detail: "Lagi santai ngopi/ngemil sejenak sambil rileks." }
    },
    lagi: {
        kerja: { title: "Sedang Kerja / Coding", detail: "Lagi fokus kerja/coding di depan laptop, menyelesaikan tugas penting." },
        belajar: { title: "Sedang Belajar", detail: "Lagi belajar materi dan membaca referensi." },
        otw: { title: "Sedang di Perjalanan (OTW)", detail: "Lagi di jalan mengendarai kendaraan, aman dan hati-hati." },
        santai: { title: "Sedang Santai / Istirahat", detail: "Lagi rebahan santai sejenak melepas penat." }
    },
    sudah: {
        tugas: { title: "Tugas / Target Selesai", detail: "Target utama dan tugas penting hari ini sudah beres terselesaikan." },
        olahraga: { title: "Selesai Olahraga", detail: "Selesai berolahraga/workout, badan segar dan berkeringat." },
        urusan: { title: "Selesai Urusan Luar", detail: "Semua keperluan dan urusan di luar rumah sudah selesai dengan baik." },
        beberes: { title: "Selesai Bersih-bersih", detail: "Selesai merapikan dan membersihkan ruangan." }
    },
    quick: {
        aman: { title: "Kondisi Aman & Sehat", detail: "Kondisi saat ini alhamdulillah aman, sehat, bugar, dan baik-baik saja." },
        semangat: { title: "Penuh Energi & Semangat", detail: "Lagi bertenaga penuh dan bersemangat menjalani hari!" },
        tidur: { title: "Mau Istirahat Tidur", detail: "Mata sudah ngantuk, mau istirahat tidur malam. Selamat istirahat!" },
        kangen: { title: "Lagi Kangen", detail: "Lagi kepikiran dan kangen banget sama kamu. Semoga harimu berkah & bahagia!" }
    }
};

// 1. PESAN DEFAULT: PEMBERITAHUAN LOG 3 JAM (REVISI TERBARU)
const NEW_DEADMAN_NOTIFICATION = `[SYSTEM AUTOMATED MESSAGE: PROTOKOL DEADMAN AKTIF]
[STATUS: PEMEBRITAHUAN]

Halo Tiara, pesan ini dikirimkan secara otomatis oleh sistem yang Wafi rancang dan jalankan sendiri. Skrip ini terpicu aktif karena server tidak mendeteksi adanya log website selama 3 jam dari pesan terkirim.

Sistem memeberikan otorisasi untuk masuk ke tautan berikut:

1. https://alejandro69021.github.io/Protocol-Deadman/
2. https://drive.google.com/drive/folders/1EMQcqXExHHpffTJdIkiZ9g8FFpTtYE4s?usp=sharing
3. https://t.me/Aiuty_bot (AI Uty - Pendamping Virtual Tiara)

Adanya pemberitahuan ini dipicu oleh TAUTAN 1 & TAUTAN 2 tidak terbuka, Ai sedang memperbaiki sistem sendiri. Pesan ini akan dikirim setiap 3 jam apabila aktivitas log in laman masih belum terpindai. Mohon maaf tiara.

[END OF TRANSMISSION]
"LOGIN 191223"`;

// 1.1 PESAN TAUTAN BOT AI UTY UNTUK TIARA
const UTY_BOT_INVITE_TEXT = `[SYSTEM AUTOMATED MESSAGE: PROTOKOL DEADMAN AKTIF]
[STATUS: PEMEBRITAHUAN]

Halo Tiara, ini tautan asisten AI khusus yang Wafi rancang dan program untuk menemani kamu sehari-hari:

👉 https://t.me/Aiuty_bot

Kamu bisa buka tautan di atas lewat aplikasi Telegram untuk mulai mengobrol dengan AI Uty kapan saja kamu butuh teman cerita, motivasi magang, atau bertukar kabar.

[END OF TRANSMISSION]`;

// 2. PESAN TRANSMISI LAMA: TRANSMISI DARURAT 7 HARI (168 JAM)
const DEADMAN_TRANSMISSION_TEXT = `[SYSTEM AUTOMATED MESSAGE: PROTOKOL DEADMAN AKTIF]
[STATUS: TIDAK ADA AKTIVITAS WA SELAMA 168 JAM (7 HARI)]

Halo Tiara, pesan ini dikirimkan secara otomatis oleh sistem yang Wafi rancang dan jalankan sendiri. Skrip ini terpicu aktif karena server tidak mendeteksi adanya log pengiriman pesan dari wafi ke WhatsApp kamu selama 7 hari berturut-turut.

Sistem mengkategorikan anomali komunikasi ini ke dalam 3 kemungkinan:

1. [KODE 01: SIBUK EKSTREM] Aku sedang berada pada tingkat kesibukan tinggi dan benar-benar tidak ada waktu atau akses untuk menghubungi kamu.
2. [KODE 02: KONDISI DARURAT/KRITIS] Terjadi keadaan darurat fisik (sakit kritis, kecelakaan, atau aku telah meninggal dunia), sehingga pesan ini dieksekusi sebagai komunikasi terakhirku di hari ke-7.
3. [KODE 03: GANGGUAN RELASI] Kita sedang berada dalam masalah hubungan yang menyebabkan komunikasi terhenti.

Jika pop-up pesan ini muncul di perangkatmu, kamu memiliki opsi untuk mengabaikannya (pada kasus 1 & 3) atau segera mengambil tindakan. Mengakses memori... Berikut adalah log catatan terakhir yang aku tulis dan simpan ke dalam database sistem ini pada tanggal 10/09/2026:

"Sayang, aku kangen kamu, aku sayang kamu banget, apalagi kamu jauh ke bantul trs besok ke rumah sedih aku, jangan kaget kalau ada chat gini, aku nyiapin ini apabila aku & kamu memang ada dalam masalah atau aku meninggal, u know what semangat ya magang di bantul & lombok, aku berusaha akhir tahun bisa ke lombok sayang, aku mau bareng sama kamu, ilove you."

Berikut adalah direktori tautan penting yang telah aku enkripsi dan berikan otorisasi khusus untuk kamu buka apabila terjadi situasi di atas:

1. https://alejandro69021.github.io/Protocol-Deadman/
2. https://drive.google.com/drive/folders/1EMQcqXExHHpffTJdIkiZ9g8FFpTtYE4s?usp=sharing

Apabila trigger sistem ini disebabkan oleh KODE 01 atau KODE 03, aku memohon maaf yang sebesar-besarnya. Namun, jika KODE 02 yang tereksekusi, tolong maafkan semua kesalahan Wafi dan doakan agar husnul khatimah.

[END OF TRANSMISSION]
"LOGIN 191223"`;

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
                }
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

            req.on('error', reject);
            req.write(postData);
            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

// Helper Send Telegram Message
async function sendTg(chatId, text, replyMarkup = null) {
    const payload = {
        chat_id: chatId,
        text: text
    };
    if (replyMarkup) {
        payload.reply_markup = replyMarkup;
    }
    return postRequest(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        'Content-Type': 'application/json'
    }, payload);
}

// Helper Send Telegram Answer Callback Query
async function answerCallback(callbackQueryId, text = "") {
    return postRequest(`https://api.telegram.org/bot${TG_TOKEN}/answerCallbackQuery`, {
        'Content-Type': 'application/json'
    }, {
        callback_query_id: callbackQueryId,
        text: text
    });
}

// Helper Send WhatsApp via Fonnte Generic
async function sendWhatsApp(targetPhone, msg) {
    const body = new URLSearchParams({
        target: targetPhone,
        message: msg
    }).toString();

    return postRequest('https://api.fonnte.com/send', {
        'Authorization': FONNTE_TOKEN,
        'Content-Type': 'application/x-www-form-urlencoded'
    }, body);
}

// Helper Send WhatsApp to Tiara
async function sendWhatsAppToTiara(msg = NEW_DEADMAN_NOTIFICATION) {
    return sendWhatsApp(TIARA_WA, msg);
}

// Helper Check Fonnte Status
async function checkFonnteStatus() {
    return postRequest('https://api.fonnte.com/device', {
        'Authorization': FONNTE_TOKEN,
        'Content-Type': 'application/json'
    }, {});
}

// KEYBOARD GENERATORS
function getMainKeyboard() {
    const cfg = loadActivityConfig();
    const modeBadge = cfg.auto_mode ? "🟢 OTOMATIS" : "🟠 MANUAL (KIRIM SENDIRI)";
    return {
        inline_keyboard: [
            [
                { text: `🍱 Log Aktivitas & Notif WA [${modeBadge}]`, callback_data: "menu_activity" }
            ],
            [
                { text: "✍️ Tulis Pesan Kustom Sendiri", callback_data: "ask_custom_input" }
            ],
            [
                { text: "🌸 Kirim Tautan Bot AI Uty ke WA", callback_data: "ask_confirm_uty" }
            ],
            [
                { text: "📢 Kirim Pemberitahuan 3 Jam (Tautan)", callback_data: "ask_confirm_new" }
            ],
            [
                { text: "🚨 Kirim Transmisi 7 Hari (Darurat)", callback_data: "ask_confirm_7d" }
            ],
            [
                { text: "📊 Cek Status Server Fonnte", callback_data: "check_status" }
            ]
        ]
    };
}

function getActivityKeyboard() {
    const cfg = loadActivityConfig();
    const modeText = cfg.auto_mode ? "🟢 Otomatis Aktif" : "🟠 Manual (Kirim Sendiri)";
    return {
        inline_keyboard: [
            [
                { text: "🍽️ Lapor Makan", callback_data: "act_menu_makan" },
                { text: "📍 Lagi Ngapain", callback_data: "act_menu_current" }
            ],
            [
                { text: "📝 Sudah Ngapain", callback_data: "act_menu_done" },
                { text: "⚡ Quick Check-in", callback_data: "act_menu_quick" }
            ],
            [
                { text: `⚙️ Pengaturan [${modeText}]`, callback_data: "act_menu_settings" }
            ],
            [
                { text: "📋 Riwayat Log Terkirim", callback_data: "act_view_history" },
                { text: "🔙 Kembali ke Menu Utama", callback_data: "back_to_main" }
            ]
        ]
    };
}

function getMakanKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: "🍳 Sudah Sarapan", callback_data: "act_preset:makan:sarapan" },
                { text: "🍲 Sudah Makan Siang", callback_data: "act_preset:makan:siang" }
            ],
            [
                { text: "🍛 Sudah Makan Malam", callback_data: "act_preset:makan:malam" },
                { text: "☕ Lagi Ngopi / Ngemil", callback_data: "act_preset:makan:ngopi" }
            ],
            [
                { text: "✍️ Ketik Menu Makanan Sendiri", callback_data: "act_custom:makan" }
            ],
            [
                { text: "🔙 Kembali ke Menu Aktivitas", callback_data: "menu_activity" }
            ]
        ]
    };
}

function getCurrentActivityKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: "💻 Sedang Kerja / Coding", callback_data: "act_preset:lagi:kerja" },
                { text: "📚 Sedang Belajar", callback_data: "act_preset:lagi:belajar" }
            ],
            [
                { text: "🚗 Sedang OTW / Di Jalan", callback_data: "act_preset:lagi:otw" },
                { text: "🛋️ Sedang Istirahat / Santai", callback_data: "act_preset:lagi:santai" }
            ],
            [
                { text: "✍️ Ketik Aktivitas Sekarang", callback_data: "act_custom:lagi" }
            ],
            [
                { text: "🔙 Kembali ke Menu Aktivitas", callback_data: "menu_activity" }
            ]
        ]
    };
}

function getDoneActivityKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: "🎯 Tugas / Target Selesai", callback_data: "act_preset:sudah:tugas" },
                { text: "🏋️ Selesai Olahraga", callback_data: "act_preset:sudah:olahraga" }
            ],
            [
                { text: "🛒 Selesai Urusan Luar", callback_data: "act_preset:sudah:urusan" },
                { text: "🧹 Selesai Bersih-bersih", callback_data: "act_preset:sudah:beberes" }
            ],
            [
                { text: "✍️ Ketik Rekap Aktivitas Sendiri", callback_data: "act_custom:sudah" }
            ],
            [
                { text: "🔙 Kembali ke Menu Aktivitas", callback_data: "menu_activity" }
            ]
        ]
    };
}

function getQuickKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: "✅ Kondisi Aman & Sehat", callback_data: "act_preset:quick:aman" },
                { text: "🔋 Baterai Diri Full / Semangat", callback_data: "act_preset:quick:semangat" }
            ],
            [
                { text: "😴 Mata Ngantuk / Mau Tidur", callback_data: "act_preset:quick:tidur" },
                { text: "❤️ Kangen / Ingat Kamu", callback_data: "act_preset:quick:kangen" }
            ],
            [
                { text: "🔙 Kembali ke Menu Aktivitas", callback_data: "menu_activity" }
            ]
        ]
    };
}

function getSettingsKeyboard() {
    const cfg = loadActivityConfig();
    const toggleText = cfg.auto_mode ? "🔴 Matikan Mode Otomatis (Ubah ke Manual)" : "🟢 Aktifkan Mode Otomatis (Scheduler)";
    return {
        inline_keyboard: [
            [
                { text: toggleText, callback_data: "act_toggle_mode" }
            ],
            [
                { text: `🎯 Target WA: ${cfg.target_label || cfg.target_wa}`, callback_data: "act_choose_target" }
            ],
            [
                { text: "⏰ Kelola Jam Jadwal Otomatis", callback_data: "act_view_schedules" }
            ],
            [
                { text: "🔙 Kembali ke Menu Aktivitas", callback_data: "menu_activity" }
            ]
        ]
    };
}

function getTargetSelectorKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: "📱 WA Ku (6285717225399)", callback_data: "act_set_target:wafi" },
                { text: "🌸 WA Tiara (6285954113051)", callback_data: "act_set_target:tiara" }
            ],
            [
                { text: "✏️ Ketik Nomor WA Lain", callback_data: "act_set_target:custom" }
            ],
            [
                { text: "🔙 Batal / Kembali", callback_data: "act_menu_settings" }
            ]
        ]
    };
}

// Background Scheduler untuk Pengiriman Otomatis
function startAutoScheduler() {
    console.log("[SCHEDULER] Auto Scheduler started. Checking every 30s...");
    setInterval(async () => {
        try {
            const cfg = loadActivityConfig();
            if (!cfg.auto_mode) return;

            // Waktu Indonesia Barat (WIB, UTC+7)
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const wib = new Date(utc + (3600000 * 7));
            const hours = String(wib.getHours()).padStart(2, '0');
            const minutes = String(wib.getMinutes()).padStart(2, '0');
            const currentTimeStr = `${hours}:${minutes}`;
            const todayStr = `${wib.getFullYear()}-${String(wib.getMonth()+1).padStart(2, '0')}-${String(wib.getDate()).padStart(2, '0')}`;

            for (const schedule of cfg.schedules) {
                if (schedule.enabled && schedule.time === currentTimeStr) {
                    const runKey = `${todayStr}_${schedule.id}_${schedule.time}`;
                    if (!cfg.last_triggered) cfg.last_triggered = {};
                    if (cfg.last_triggered[runKey]) {
                        continue; // Sudah terkirim hari ini untuk jam ini
                    }

                    const messageText = formatActivityMessage('auto', schedule.label, schedule.template, true);
                    console.log(`[AUTO SCHEDULER] Sending ${schedule.label} to ${cfg.target_wa} at ${currentTimeStr}`);

                    const resWA = await sendWhatsApp(cfg.target_wa, messageText);
                    cfg.last_triggered[runKey] = new Date().toISOString();

                    if (!Array.isArray(cfg.recent_logs)) cfg.recent_logs = [];
                    cfg.recent_logs.unshift({
                        time: currentTimeStr,
                        date: todayStr,
                        type: 'AUTO',
                        title: schedule.label,
                        target: cfg.target_wa,
                        status: resWA && resWA.status ? 'BERHASIL' : 'GAGAL'
                    });
                    if (cfg.recent_logs.length > 20) cfg.recent_logs.pop();
                    saveActivityConfig(cfg);

                    // Notifikasi status ke Telegram Wafi
                    await sendTg(ALLOWED_CHAT_ID, `🔔 *NOTIFIKASI OTOMATIS TERKIRIM KE WHATSAPP*\n\n📋 *Jadwal:* ${schedule.label} (${schedule.time} WIB)\n🎯 *Target:* ${cfg.target_label || cfg.target_wa}\n📊 *Status Fonnte:* ${resWA && resWA.status ? 'Berhasil (ID: ' + resWA.id + ')' : 'Gagal'}\n\n_Pesan otomatis dikirim sesuai mode scheduler._`);
                }
            }
        } catch (err) {
            console.error('[AUTO SCHEDULER ERROR]', err.message);
        }
    }, 30000);
}

// Telegram Long Polling
let offset = 0;
let isPolling = false;

async function pollUpdates() {
    if (isPolling) return;
    isPolling = true;

    try {
        const res = await postRequest(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates`, {
            'Content-Type': 'application/json'
        }, {
            offset: offset,
            timeout: 20
        });

        if (res && res.ok && Array.isArray(res.result)) {
            for (const upd of res.result) {
                offset = upd.update_id + 1;

                // 1. TANGANI KLIK TOMBOL (CALLBACK QUERY)
                if (upd.callback_query) {
                    const cb = upd.callback_query;
                    const fromId = String(cb.from ? cb.from.id : '');
                    if (fromId !== ALLOWED_CHAT_ID) {
                        await answerCallback(cb.id, "Akses ditolak.");
                        continue;
                    }

                    console.log(`[CALLBACK] Action: ${cb.data} from ${fromId}`);

                    // Navigasi Menu Aktivitas
                    if (cb.data === 'menu_activity') {
                        await answerCallback(cb.id);
                        const cfg = loadActivityConfig();
                        const statusTxt = cfg.auto_mode 
                            ? "🟢 *OTOMATIS (Scheduler Aktif)*\nSistem akan otomatis mengirim notifikasi ke WA sesuai jadwal jam yang ditentukan." 
                            : "🟠 *MANUAL (Kirim Sendiri)*\nNotifikasi hanya dikirim saat kamu mengklik tombol atau perintah.";
                        const text = `🍱 *PUSAT LOG AKTIVITAS & NOTIFIKASI WA*\n\n🎯 *Target WA:* \`${cfg.target_label || cfg.target_wa}\` (\`${cfg.target_wa}\`)\n⚡ *Mode Saat Ini:* ${statusTxt}\n\nPilih kategori di bawah untuk mencatat atau mengatur pengiriman:`;
                        await sendTg(fromId, text, getActivityKeyboard());
                    }
                    else if (cb.data === 'back_to_main') {
                        await answerCallback(cb.id);
                        await sendTg(fromId, "🤖 *KONTROL PUSAT PROTOKOL DEADMAN*\n\nPilih menu di bawah:", getMainKeyboard());
                    }
                    else if (cb.data === 'act_menu_makan') {
                        await answerCallback(cb.id);
                        await sendTg(fromId, "🍽️ *LAPOR STATUS MAKAN*\n\nPilih preset di bawah untuk langsung kirim ke WhatsApp, atau tulis menu makananmu sendiri:", getMakanKeyboard());
                    }
                    else if (cb.data === 'act_menu_current') {
                        await answerCallback(cb.id);
                        await sendTg(fromId, "📍 *UPDATE: LAGI NGAPAIN AJA?*\n\nBeri kabar aktivitasmu saat ini ke WhatsApp:", getCurrentActivityKeyboard());
                    }
                    else if (cb.data === 'act_menu_done') {
                        await answerCallback(cb.id);
                        await sendTg(fromId, "📝 *REKAP: SUDAH NGAPAIN AJA?*\n\nCatat agenda/tugas yang sudah berhasil diselesaikan:", getDoneActivityKeyboard());
                    }
                    else if (cb.data === 'act_menu_quick') {
                        await answerCallback(cb.id);
                        await sendTg(fromId, "⚡ *QUICK CHECK-IN*\n\nKirim kabar cepat dalam 1 klik:", getQuickKeyboard());
                    }
                    else if (cb.data === 'act_menu_settings') {
                        await answerCallback(cb.id);
                        const cfg = loadActivityConfig();
                        const modeDesk = cfg.auto_mode 
                            ? "🟢 *Mode Otomatis:* Jadwal pengingat otomatis dikirim ke WhatsApp tanpa perlu klik manual."
                            : "🟠 *Mode Manual (Kirim Sendiri):* Pesan hanya dikirim saat kamu pilih tombol atau ketik perintah.";
                        const txt = `⚙️ *PENGATURAN PENGIRIMAN NOTIFIKASI WA*\n\n${modeDesk}\n\n🎯 *Target Penerima WA:* \`${cfg.target_label}\` (\`${cfg.target_wa}\`)\n\nAtur preferensi di bawah:`;
                        await sendTg(fromId, txt, getSettingsKeyboard());
                    }
                    else if (cb.data === 'act_toggle_mode') {
                        const cfg = loadActivityConfig();
                        cfg.auto_mode = !cfg.auto_mode;
                        saveActivityConfig(cfg);
                        const newStatus = cfg.auto_mode ? "🟢 Mode Otomatis DIAKTIFKAN" : "🟠 Mode Manual (Kirim Sendiri) DIAKTIFKAN";
                        await answerCallback(cb.id, newStatus);
                        await sendTg(fromId, `✅ *PENGATURAN DIPERBARUI!*\n\nStatus sekarang: *${newStatus}*\n\n${cfg.auto_mode ? 'Sistem akan otomatis mengirim notifikasi pada jam-jam jadwal aktif.' : 'Sistem hanya akan mengirim notifikasi jika kamu memintanya secara manual.'}`, getSettingsKeyboard());
                    }
                    else if (cb.data === 'act_choose_target') {
                        await answerCallback(cb.id);
                        await sendTg(fromId, "🎯 *PILIH TARGET NOMOR WHATSAPP:*\n\nKe mana notifikasi aktivitas ingin dikirimkan?", getTargetSelectorKeyboard());
                    }
                    else if (cb.data === 'act_set_target:wafi') {
                        const cfg = loadActivityConfig();
                        cfg.target_wa = WAFI_WA;
                        cfg.target_label = "WA Ku (Wafi)";
                        saveActivityConfig(cfg);
                        await answerCallback(cb.id, "Target: WA Wafi");
                        await sendTg(fromId, `✅ *TARGET BERHASIL DIUBAH!*\nTarget sekarang: *WA Ku (Wafi)* (\`${WAFI_WA}\`)`, getSettingsKeyboard());
                    }
                    else if (cb.data === 'act_set_target:tiara') {
                        const cfg = loadActivityConfig();
                        cfg.target_wa = TIARA_WA;
                        cfg.target_label = "WA Tiara";
                        saveActivityConfig(cfg);
                        await answerCallback(cb.id, "Target: WA Tiara");
                        await sendTg(fromId, `✅ *TARGET BERHASIL DIUBAH!*\nTarget sekarang: *WA Tiara* (\`${TIARA_WA}\`)`, getSettingsKeyboard());
                    }
                    else if (cb.data === 'act_set_target:custom') {
                        userSession[fromId] = { state: 'WAITING_TARGET_PHONE' };
                        await answerCallback(cb.id);
                        await sendTg(fromId, "✏️ *MASUKKAN NOMOR WHATSAPP TARGET:*\n\nKetik nomor WA tujuan (contoh: `6281234567890` atau `081234567890`).\n\n_Ketik /batal untuk membatalkan._");
                    }
                    else if (cb.data === 'act_view_schedules') {
                        await answerCallback(cb.id);
                        const cfg = loadActivityConfig();
                        let schedList = "⏰ *DAFTAR JADWAL NOTIFIKASI OTOMATIS:*\n\n";
                        cfg.schedules.forEach((s, idx) => {
                            schedList += `${idx + 1}. *${s.time} WIB* - ${s.label} (${s.enabled ? 'Aktif' : 'Nonaktif'})\n`;
                        });
                        schedList += `\nStatus Mode Otomatis: *${cfg.auto_mode ? '🟢 Aktif' : '🔴 Nonaktif'}*\n_Mode otomatis bisa diaktifkan/dimatikan kapan saja di menu Pengaturan._`;
                        await sendTg(fromId, schedList, getSettingsKeyboard());
                    }
                    else if (cb.data === 'act_view_history') {
                        await answerCallback(cb.id);
                        const cfg = loadActivityConfig();
                        let hist = "📋 *RIWAYAT PENGIRIMAN NOTIFIKASI TERAKHIR:*\n\n";
                        if (!cfg.recent_logs || cfg.recent_logs.length === 0) {
                            hist += "_Belum ada riwayat pengiriman notifikasi._";
                        } else {
                            cfg.recent_logs.slice(0, 7).forEach((l, idx) => {
                                hist += `${idx + 1}. [${l.time || '-'}] *${l.title || l.label}*\n   Target: ${l.target} | Status: ${l.status}\n`;
                            });
                        }
                        await sendTg(fromId, hist, getActivityKeyboard());
                    }
                    // Trigger Preset Aktivitas
                    else if (cb.data.startsWith('act_preset:')) {
                        const parts = cb.data.split(':');
                        const cat = parts[1];
                        const key = parts[2];

                        const preset = ACTIVITY_PRESETS[cat] && ACTIVITY_PRESETS[cat][key];
                        if (!preset) {
                            await answerCallback(cb.id, "Preset tidak ditemukan.");
                            continue;
                        }

                        const cfg = loadActivityConfig();
                        const formatted = formatActivityMessage(cat, preset.title, preset.detail, false);
                        userSession[fromId] = {
                            state: 'CONFIRM_ACTIVITY_SEND',
                            pendingMsg: formatted,
                            category: cat,
                            title: preset.title,
                            detail: preset.detail,
                            targetWa: cfg.target_wa
                        };

                        await answerCallback(cb.id);
                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: "🚀 YA, KIRIM KE WHATSAPP SEKARANG", callback_data: "confirm_send_activity" }
                                ],
                                [
                                    { text: "🔙 Pilih Ulang", callback_data: `act_menu_${cat === 'quick' ? 'quick' : cat === 'makan' ? 'makan' : cat === 'lagi' ? 'current' : 'done'}` },
                                    { text: "❌ Batalkan", callback_data: "cancel_send" }
                                ]
                            ]
                        };

                        const previewText = `📋 *PRATINJAU NOTIFIKASI WA:*\nTarget: *${cfg.target_label || cfg.target_wa}* (\`${cfg.target_wa}\`)\n\n\`\`\`\n${formatted}\n\`\`\`\n\nKirim notifikasi ini sekarang ke WhatsApp?`;
                        await sendTg(fromId, previewText, keyboard);
                    }
                    // Trigger Custom Teks Input untuk Kategori
                    else if (cb.data.startsWith('act_custom:')) {
                        const cat = cb.data.split(':')[1];
                        userSession[fromId] = {
                            state: 'WAITING_CUSTOM_ACTIVITY_TEXT',
                            category: cat
                        };

                        let catName = "Makanan";
                        if (cat === 'lagi') catName = "Aktivitas Sekarang";
                        else if (cat === 'sudah') catName = "Rekap Aktivitas";

                        await answerCallback(cb.id);
                        await sendTg(fromId, `✍️ *TULIS ${catName.toUpperCase()} KAMU*\n\nSilakan ketik dan kirim pesanmu sekarang di chat Telegram ini.\n\nContoh:\n- Makan: _"Makan siang soto ayam lamongan + es teh manis"_\n- Lagi: _"Lagi perbaiki modul coding di kantor"_\n- Sudah: _"Selesai meeting jam 2 siang dan kirim laporan"_\n\n_Ketik pesanmu di bawah atau ketik /batal untuk membatalkan._`);
                    }
                    // Eksekusi Kirim Notifikasi Aktivitas ke WA
                    else if (cb.data === 'confirm_send_activity') {
                        const session = userSession[fromId];
                        if (!session || !session.pendingMsg) {
                            await answerCallback(cb.id, "Tidak ada pesan tersimpan.");
                            await sendTg(fromId, "⚠️ Tidak ada pesan aktivitas tersimpan.", getActivityKeyboard());
                            continue;
                        }

                        const cfg = loadActivityConfig();
                        const target = session.targetWa || cfg.target_wa;

                        await answerCallback(cb.id, "Mengirim ke WhatsApp...");
                        await sendTg(fromId, `⏳ Memproses pengiriman notifikasi ke WhatsApp (${target})...`);

                        try {
                            const resWA = await sendWhatsApp(target, session.pendingMsg);
                            console.log('[FONNTE RES ACTIVITY]', resWA);
                            if (resWA && resWA.status) {
                                // Catat ke recent logs
                                const now = new Date();
                                const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                                const wib = new Date(utc + (3600000 * 7));
                                const timeStr = `${String(wib.getHours()).padStart(2, '0')}:${String(wib.getMinutes()).padStart(2, '0')} WIB`;

                                if (!Array.isArray(cfg.recent_logs)) cfg.recent_logs = [];
                                cfg.recent_logs.unshift({
                                    time: timeStr,
                                    type: 'MANUAL',
                                    title: session.title || 'Aktivitas',
                                    target: target,
                                    status: 'BERHASIL'
                                });
                                if (cfg.recent_logs.length > 20) cfg.recent_logs.pop();
                                saveActivityConfig(cfg);

                                delete userSession[fromId];
                                await sendTg(fromId, `✅ *NOTIFIKASI BERHASIL DIKIRIM KE WHATSAPP!*\n\nTarget: *${target}*\nStatus Fonnte: Masuk antrean kirim.\nID: ${resWA.id || '-'}\n\nPesan terkirim rapi ke WhatsApp.`, getActivityKeyboard());
                            } else {
                                await sendTg(fromId, `❌ Gagal mengirim via Fonnte:\n${JSON.stringify(resWA)}`, getActivityKeyboard());
                            }
                        } catch (err) {
                            await sendTg(fromId, `❌ Error Fonnte: ${err.message}`, getActivityKeyboard());
                        }
                    }
                    // DEADMAN EXISTING: Pesan Kustom
                    else if (cb.data === 'ask_custom_input') {
                        userSession[fromId] = { state: 'WAITING_CUSTOM_TEXT' };
                        await answerCallback(cb.id);
                        await sendTg(fromId, "✍️ *TULIS PESAN KUSTOM UNTUK TIARA*\n\nSilakan ketik dan kirim pesan kamu sekarang di chat ini.\n\nPesan tersebut akan otomatis dibungkus ke dalam format Deadman:\n```\n[SYSTEM AUTOMATED MESSAGE: PROTOKOL DEADMAN AKTIF]\n[STATUS: PEMEBRITAHUAN]\n\n<pesan kamu>\n\n[END OF TRANSMISSION]\n```\n\n_Ketik pesanmu langsung di bawah atau ketik /batal untuk membatalkan._");
                    }
                    else if (cb.data === 'confirm_send_custom') {
                        const pending = userSession[fromId] && userSession[fromId].pendingMsg;
                        if (!pending) {
                            await answerCallback(cb.id, "Tidak ada pesan tersimpan.");
                            await sendTg(fromId, "⚠️ Tidak ada pesan kustom yang tersimpan untuk dikirim.", getMainKeyboard());
                            continue;
                        }
                        await answerCallback(cb.id, "Sedang mengirim ke WA Tiara...");
                        await sendTg(fromId, `⏳ Memproses pengiriman pesan kustom ke WhatsApp Tiara (${TIARA_WA})...`);

                        try {
                            const resWA = await sendWhatsAppToTiara(pending);
                            console.log('[FONNTE RES CUSTOM]', resWA);
                            if (resWA && resWA.status) {
                                delete userSession[fromId];
                                await sendTg(fromId, `✅ *PESAN KUSTOM BERHASIL TERKIRIM!*\n\nPesan kustom kamu telah resmi dikirim ke WhatsApp Tiara (${TIARA_WA}).\n\nID: ${resWA.id || '-'}`, getMainKeyboard());
                            } else {
                                await sendTg(fromId, `❌ Gagal mengirim via Fonnte:\n${JSON.stringify(resWA)}`, getMainKeyboard());
                            }
                        } catch (err) {
                            await sendTg(fromId, `❌ Error Fonnte: ${err.message}`, getMainKeyboard());
                        }
                    }
                    // DEADMAN EXISTING: AI Uty invite
                    else if (cb.data === 'ask_confirm_uty') {
                        await answerCallback(cb.id);
                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: "🌸 YA, KIRIM TAUTAN BOT AI UTY", callback_data: "confirm_send_uty" }
                                ],
                                [
                                    { text: "❌ BATALKAN", callback_data: "cancel_send" }
                                ]
                            ]
                        };
                        const preview = `🌸 *KONFIRMASI PENGIRIMAN TAUTAN AI UTY*\nTarget WA Tiara: *${TIARA_WA}*\n\n*Isi Pesan:*\n${UTY_BOT_INVITE_TEXT}`;
                        await sendTg(fromId, preview, keyboard);
                    }
                    // DEADMAN EXISTING: Pesan 3 Jam
                    else if (cb.data === 'ask_confirm_new' || cb.data === 'ask_confirm') {
                        await answerCallback(cb.id);
                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: "🚨 YA, KIRIM PESAN 3 JAM SEKARANG", callback_data: "confirm_send_new" }
                                ],
                                [
                                    { text: "❌ BATALKAN", callback_data: "cancel_send" }
                                ]
                            ]
                        };
                        const preview = `⚠️ *KONFIRMASI PENGIRIMAN PESAN 3 JAM*\nTarget WA Tiara: *${TIARA_WA}*\n\n*Isi Pesan:*\n${NEW_DEADMAN_NOTIFICATION}`;
                        await sendTg(fromId, preview, keyboard);
                    }
                    // DEADMAN EXISTING: Pesan 7 Hari
                    else if (cb.data === 'ask_confirm_7d') {
                        await answerCallback(cb.id);
                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: "🚨 YA, KIRIM TRANSMISI 7 HARI", callback_data: "confirm_send_7d" }
                                ],
                                [
                                    { text: "❌ BATALKAN", callback_data: "cancel_send" }
                                ]
                            ]
                        };
                        const preview = `⚠️ *KONFIRMASI TRANSMISI 7 HARI*\nTarget WA Tiara: *${TIARA_WA}*\n\n*Isi Pesan:*\n${DEADMAN_TRANSMISSION_TEXT}`;
                        await sendTg(fromId, preview, keyboard);
                    }
                    // Eksekusi Deadman: Uty
                    else if (cb.data === 'confirm_send_uty') {
                        await answerCallback(cb.id, "Sedang mengirim ke WA Tiara...");
                        await sendTg(fromId, `⏳ Memproses pengiriman tautan Bot AI Uty ke WhatsApp Tiara (${TIARA_WA})...`);

                        try {
                            const resWA = await sendWhatsAppToTiara(UTY_BOT_INVITE_TEXT);
                            if (resWA && resWA.status) {
                                await sendTg(fromId, `🌸 *TAUTAN BOT AI UTY BERHASIL DIKIRIM!*\n\nPesan berisi tautan https://t.me/Aiuty_bot telah dikirim ke WhatsApp Tiara (${TIARA_WA}).\nID Fonnte: ${resWA.id || '-'}`, getMainKeyboard());
                            } else {
                                await sendTg(fromId, `❌ Gagal mengirim via Fonnte:\n${JSON.stringify(resWA)}`, getMainKeyboard());
                            }
                        } catch (err) {
                            await sendTg(fromId, `❌ Error Fonnte: ${err.message}`, getMainKeyboard());
                        }
                    }
                    // Eksekusi Deadman: 3 Jam
                    else if (cb.data === 'confirm_send_new' || cb.data === 'confirm_send_tiara') {
                        await answerCallback(cb.id, "Sedang mengirim ke WA Tiara...");
                        await sendTg(fromId, `⏳ Memproses pengiriman pesan 3 jam ke WhatsApp Tiara (${TIARA_WA})...`);

                        try {
                            const resWA = await sendWhatsAppToTiara(NEW_DEADMAN_NOTIFICATION);
                            if (resWA && resWA.status) {
                                await sendTg(fromId, `✅ *PESAN 3 JAM BERHASIL TERKIRIM!*\n\nPesan Pemberitahuan 3 Jam telah resmi masuk antrean Fonnte ke WhatsApp Tiara (${TIARA_WA}).\nID: ${resWA.id || '-'}`, getMainKeyboard());
                            } else {
                                await sendTg(fromId, `❌ Gagal mengirim via Fonnte:\n${JSON.stringify(resWA)}`, getMainKeyboard());
                            }
                        } catch (err) {
                            await sendTg(fromId, `❌ Error Fonnte: ${err.message}`, getMainKeyboard());
                        }
                    }
                    // Eksekusi Deadman: 7 Hari
                    else if (cb.data === 'confirm_send_7d') {
                        await answerCallback(cb.id, "Sedang mengirim ke WA Tiara...");
                        await sendTg(fromId, `⏳ Memproses pengiriman Transmisi 7 Hari ke WhatsApp Tiara (${TIARA_WA})...`);

                        try {
                            const resWA = await sendWhatsAppToTiara(DEADMAN_TRANSMISSION_TEXT);
                            if (resWA && resWA.status) {
                                await sendTg(fromId, `✅ *TRANSMISI 7 HARI BERHASIL TERKIRIM!*\n\nPesan Transmisi 7 Hari telah resmi terkirim ke WhatsApp Tiara (${TIARA_WA}).`, getMainKeyboard());
                            } else {
                                await sendTg(fromId, `❌ Gagal mengirim via Fonnte:\n${JSON.stringify(resWA)}`, getMainKeyboard());
                            }
                        } catch (err) {
                            await sendTg(fromId, `❌ Error Fonnte: ${err.message}`, getMainKeyboard());
                        }
                    }
                    else if (cb.data === 'cancel_send') {
                        delete userSession[fromId];
                        await answerCallback(cb.id, "Dibatalkan.");
                        await sendTg(fromId, "🛑 Pengiriman dibatalkan. Pesan TIDAK dikirim.", getMainKeyboard());
                    }
                    else if (cb.data === 'check_status') {
                        await answerCallback(cb.id, "Mengecek status...");
                        try {
                            const st = await checkFonnteStatus();
                            await sendTg(fromId, `📊 *STATUS WHATSAPP GATEWAY:*\n- Status: ${st.device_status || 'Unknown'}\n- Nomor Pengirim: ${st.device || '-'}\n- Sisa Kuota: ${st.quota || '-'}\n- Expired: ${st.expired || '-'}`, getMainKeyboard());
                        } catch (e) {
                            await sendTg(fromId, `❌ Gagal cek status: ${e.message}`, getMainKeyboard());
                        }
                    }
                    continue;
                }

                // 2. TANGANI PESAN TEKS DARI PENGGUNA
                if (upd.message && upd.message.text) {
                    const msg = upd.message;
                    const fromId = String(msg.from ? msg.from.id : '');
                    if (fromId !== ALLOWED_CHAT_ID) continue;

                    const rawText = msg.text.trim();
                    const lowerText = rawText.toLowerCase();
                    console.log(`[TEXT] Message: ${rawText} from ${fromId}`);

                    // Cek pembatalan input
                    if (lowerText === '/batal' || lowerText === 'batal') {
                        delete userSession[fromId];
                        await sendTg(fromId, "🛑 Aksi dibatalkan. Kembali ke menu utama.", getMainKeyboard());
                        continue;
                    }

                    // A: State Menunggu Nomor Telepon Target Baru
                    if (userSession[fromId] && userSession[fromId].state === 'WAITING_TARGET_PHONE') {
                        let phone = rawText.replace(/[^0-9]/g, '');
                        if (phone.startsWith('08')) {
                            phone = '628' + phone.substring(2);
                        } else if (phone.startsWith('8')) {
                            phone = '628' + phone.substring(1);
                        }

                        if (phone.length < 9) {
                            await sendTg(fromId, "⚠️ Format nomor telepon tidak valid. Masukkan minimal 10 digit nomor HP (misal `081234567890` atau `6281234567890`).\n\nKetik ulang atau ketik /batal.");
                            continue;
                        }

                        const cfg = loadActivityConfig();
                        cfg.target_wa = phone;
                        cfg.target_label = `Custom (${phone})`;
                        saveActivityConfig(cfg);
                        delete userSession[fromId];

                        await sendTg(fromId, `✅ *NOMOR TARGET BERHASIL DISIMPAN!*\n\nNomor WA tujuan sekarang: *${phone}*`, getSettingsKeyboard());
                        continue;
                    }

                    // B: State Menunggu Teks Aktivitas Kustom (Makan / Lagi / Sudah)
                    if (userSession[fromId] && userSession[fromId].state === 'WAITING_CUSTOM_ACTIVITY_TEXT') {
                        const cat = userSession[fromId].category || 'makan';
                        let title = "Status Makanan";
                        if (cat === 'lagi') title = "Aktivitas Sekarang";
                        else if (cat === 'sudah') title = "Rekap Aktivitas";

                        const cfg = loadActivityConfig();
                        const formatted = formatActivityMessage(cat, title, rawText, false);

                        userSession[fromId] = {
                            state: 'CONFIRM_ACTIVITY_SEND',
                            pendingMsg: formatted,
                            category: cat,
                            title: title,
                            detail: rawText,
                            targetWa: cfg.target_wa
                        };

                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: "🚀 YA, KIRIM KE WHATSAPP SEKARANG", callback_data: "confirm_send_activity" }
                                ],
                                [
                                    { text: "✏️ Tulis Ulang", callback_data: `act_custom:${cat}` },
                                    { text: "❌ Batalkan", callback_data: "cancel_send" }
                                ]
                            ]
                        };

                        const previewText = `📋 *PRATINJAU NOTIFIKASI WA:*\nTarget: *${cfg.target_label || cfg.target_wa}* (\`${cfg.target_wa}\`)\n\n\`\`\`\n${formatted}\n\`\`\`\n\nKirim notifikasi ini sekarang ke WhatsApp?`;
                        await sendTg(fromId, previewText, keyboard);
                        continue;
                    }

                    // C: State Menunggu Penulisan Pesan Kustom Deadman
                    if (userSession[fromId] && userSession[fromId].state === 'WAITING_CUSTOM_TEXT') {
                        const formatted = buildCustomTemplate(rawText);
                        userSession[fromId] = {
                            state: 'CONFIRM_CUSTOM_SEND',
                            pendingMsg: formatted
                        };

                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: "🚨 YA, KIRIM KE WA TIARA SEKARANG", callback_data: "confirm_send_custom" }
                                ],
                                [
                                    { text: "✏️ Tulis Ulang", callback_data: "ask_custom_input" },
                                    { text: "❌ Batalkan", callback_data: "cancel_send" }
                                ]
                            ]
                        };

                        const previewText = `📋 *PRATINJAU PESAN KUSTOM DEADMAN:*\nTarget: WhatsApp Tiara (*${TIARA_WA}*)\n\n\`\`\`\n${formatted}\n\`\`\`\n\nKirim pesan di atas sekarang?`;
                        await sendTg(fromId, previewText, keyboard);
                        continue;
                    }

                    // D: PERINTAH CEPAT TEKS LANGSUNG
                    // D.1: /makan <detail>
                    if (lowerText.startsWith('/makan')) {
                        const detail = rawText.replace(/^\/makan\s*/i, '').trim();
                        if (!detail) {
                            await sendTg(fromId, "🍽️ *MENU LAPOR STATUS MAKAN*\nSilakan pilih salah satu tombol berikut atau ketik `/makan <apa>` (contoh: `/makan nasi goreng sosis`):", getMakanKeyboard());
                            continue;
                        }

                        const cfg = loadActivityConfig();
                        const formatted = formatActivityMessage('makan', 'Status Makan', detail, false);
                        userSession[fromId] = {
                            state: 'CONFIRM_ACTIVITY_SEND',
                            pendingMsg: formatted,
                            category: 'makan',
                            title: 'Status Makan',
                            detail: detail,
                            targetWa: cfg.target_wa
                        };

                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: "🚀 YA, KIRIM KE WHATSAPP SEKARANG", callback_data: "confirm_send_activity" }
                                ],
                                [
                                    { text: "❌ Batalkan", callback_data: "cancel_send" }
                                ]
                            ]
                        };

                        const previewText = `📋 *PRATINJAU NOTIFIKASI MAKAN:*\nTarget: *${cfg.target_label || cfg.target_wa}* (\`${cfg.target_wa}\`)\n\n\`\`\`\n${formatted}\n\`\`\`\n\nKirim ke WhatsApp sekarang?`;
                        await sendTg(fromId, previewText, keyboard);
                        continue;
                    }

                    // D.2: /lagi <detail>
                    if (lowerText.startsWith('/lagi')) {
                        const detail = rawText.replace(/^\/lagi\s*/i, '').trim();
                        if (!detail) {
                            await sendTg(fromId, "📍 *UPDATE: LAGI NGAPAIN AJA?*\nSilakan pilih tombol atau ketik `/lagi <aktivitas>` (contoh: `/lagi ngerjain project deadman`):", getCurrentActivityKeyboard());
                            continue;
                        }

                        const cfg = loadActivityConfig();
                        const formatted = formatActivityMessage('lagi', 'Aktivitas Sekarang', detail, false);
                        userSession[fromId] = {
                            state: 'CONFIRM_ACTIVITY_SEND',
                            pendingMsg: formatted,
                            category: 'lagi',
                            title: 'Aktivitas Sekarang',
                            detail: detail,
                            targetWa: cfg.target_wa
                        };

                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: "🚀 YA, KIRIM KE WHATSAPP SEKARANG", callback_data: "confirm_send_activity" }
                                ],
                                [
                                    { text: "❌ Batalkan", callback_data: "cancel_send" }
                                ]
                            ]
                        };

                        const previewText = `📋 *PRATINJAU NOTIFIKASI AKTIVITAS:*\nTarget: *${cfg.target_label || cfg.target_wa}* (\`${cfg.target_wa}\`)\n\n\`\`\`\n${formatted}\n\`\`\`\n\nKirim ke WhatsApp sekarang?`;
                        await sendTg(fromId, previewText, keyboard);
                        continue;
                    }

                    // D.3: /sudah <detail>
                    if (lowerText.startsWith('/sudah')) {
                        const detail = rawText.replace(/^\/sudah\s*/i, '').trim();
                        if (!detail) {
                            await sendTg(fromId, "📝 *REKAP: SUDAH NGAPAIN AJA?*\nPilih tombol atau ketik `/sudah <rekap>` (contoh: `/sudah selesai gym dan mandi`):", getDoneActivityKeyboard());
                            continue;
                        }

                        const cfg = loadActivityConfig();
                        const formatted = formatActivityMessage('sudah', 'Rekap Aktivitas', detail, false);
                        userSession[fromId] = {
                            state: 'CONFIRM_ACTIVITY_SEND',
                            pendingMsg: formatted,
                            category: 'sudah',
                            title: 'Rekap Aktivitas',
                            detail: detail,
                            targetWa: cfg.target_wa
                        };

                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: "🚀 YA, KIRIM KE WHATSAPP SEKARANG", callback_data: "confirm_send_activity" }
                                ],
                                [
                                    { text: "❌ Batalkan", callback_data: "cancel_send" }
                                ]
                            ]
                        };

                        const previewText = `📋 *PRATINJAU REKAP AKTIVITAS:*\nTarget: *${cfg.target_label || cfg.target_wa}* (\`${cfg.target_wa}\`)\n\n\`\`\`\n${formatted}\n\`\`\`\n\nKirim ke WhatsApp sekarang?`;
                        await sendTg(fromId, previewText, keyboard);
                        continue;
                    }

                    // D.4: /auto on / /auto off
                    if (lowerText === '/auto on' || lowerText === '/auto_on') {
                        const cfg = loadActivityConfig();
                        cfg.auto_mode = true;
                        saveActivityConfig(cfg);
                        await sendTg(fromId, "🟢 *MODE PENGIRIMAN OTOMATIS DIAKTIFKAN!*\n\nSistem akan otomatis mengecek dan mengirim notifikasi WhatsApp sesuai jadwal pengingat (sarapan, siang, sore, malam, rekap).", getSettingsKeyboard());
                        continue;
                    }
                    if (lowerText === '/auto off' || lowerText === '/auto_off') {
                        const cfg = loadActivityConfig();
                        cfg.auto_mode = false;
                        saveActivityConfig(cfg);
                        await sendTg(fromId, "🟠 *MODE OTOMATIS DIMATIKAN!*\n\nSekarang pengiriman berstatus *MANUAL (Kirim Sendiri)*. Notifikasi hanya terkirim saat kamu memilih menu atau mengetik status.", getSettingsKeyboard());
                        continue;
                    }

                    // D.5: /target <nomor>
                    if (lowerText.startsWith('/target ')) {
                        const rawPhone = rawText.replace(/^\/target\s+/i, '').trim();
                        let phone = rawPhone.replace(/[^0-9]/g, '');
                        if (phone.startsWith('08')) phone = '628' + phone.substring(2);
                        else if (phone.startsWith('8')) phone = '628' + phone.substring(1);

                        if (phone.length < 9) {
                            await sendTg(fromId, "⚠️ Nomor tidak valid. Contoh penggunaan: `/target 6285717225399`");
                            continue;
                        }

                        const cfg = loadActivityConfig();
                        cfg.target_wa = phone;
                        cfg.target_label = phone === WAFI_WA ? "WA Ku (Wafi)" : phone === TIARA_WA ? "WA Tiara" : `Custom (${phone})`;
                        saveActivityConfig(cfg);

                        await sendTg(fromId, `✅ *TARGET NOTIFIKASI BERHASIL DIUBAH!*\nTarget WA sekarang: *${cfg.target_label}* (\`${phone}\`)`, getSettingsKeyboard());
                        continue;
                    }

                    // D.6: /status_notif
                    if (lowerText === '/status_notif' || lowerText === '/notif') {
                        const cfg = loadActivityConfig();
                        const st = await checkFonnteStatus().catch(() => ({}));
                        const modeStr = cfg.auto_mode ? "🟢 OTOMATIS (Scheduler Aktif)" : "🟠 MANUAL (Kirim Sendiri)";
                        const txt = `📊 *STATUS SISTEM NOTIFIKASI WA:*\n\n⚡ Mode: *${modeStr}*\n🎯 Target WA: *${cfg.target_label}* (\`${cfg.target_wa}\`)\n📱 Fonnte Gateway: *${st.device_status || '-'}* (Pengirim: ${st.device || '-'})\n📦 Sisa Kuota Fonnte: *${st.quota || '-'} pesan*\n\nKetik /start atau klik menu untuk mengubah pengaturan.`;
                        await sendTg(fromId, txt, getActivityKeyboard());
                        continue;
                    }

                    // E: Perintah Cepat Deadman: /pesan <isi>
                    if (lowerText.startsWith('/pesan ') || lowerText.startsWith('/tulis ') || lowerText.startsWith('/custom ')) {
                        const content = rawText.replace(/^\/(pesan|tulis|custom)\s+/i, '').trim();
                        if (!content) {
                            await sendTg(fromId, "⚠️ Isi pesan tidak boleh kosong.\nContoh: `/pesan Halo sayang...`", getMainKeyboard());
                            continue;
                        }

                        const formatted = buildCustomTemplate(content);
                        userSession[fromId] = {
                            state: 'CONFIRM_CUSTOM_SEND',
                            pendingMsg: formatted
                        };

                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: "🚨 YA, KIRIM KE WA TIARA SEKARANG", callback_data: "confirm_send_custom" }
                                ],
                                [
                                    { text: "✏️ Tulis Ulang", callback_data: "ask_custom_input" },
                                    { text: "❌ Batalkan", callback_data: "cancel_send" }
                                ]
                            ]
                        };

                        const previewText = `📋 *PRATINJAU PESAN KUSTOM DEADMAN:*\nTarget: WhatsApp Tiara (*${TIARA_WA}*)\n\n\`\`\`\n${formatted}\n\`\`\`\n\nKirim pesan di atas sekarang?`;
                        await sendTg(fromId, previewText, keyboard);
                        continue;
                    }

                    // F: Menu Utama
                    if (lowerText === '/start' || lowerText === '/menu' || lowerText === '/help') {
                        await sendTg(fromId, "🤖 *KONTROL PUSAT PROTOKOL DEADMAN & NOTIFIKASI AKTIVITAS*\n\nSelamat datang, Wafi! Kamu bisa mencatat dan mengirim kabar harian (sudah makan, lagi ngapain, rekap) ke WhatsApp, mengatur mode otomatis/manual, atau mengirim transmisi Protokol Deadman.\n\nPilih tindakan di bawah:", getMainKeyboard());
                    } else if (lowerText === '/kirim' || lowerText === '/kirim_wa') {
                        await sendTg(fromId, "⚠️ *PILIH TINDAKAN PENGIRIMAN:*", getMainKeyboard());
                    } else if (lowerText === '/status') {
                        try {
                            const st = await checkFonnteStatus();
                            await sendTg(fromId, `📊 *STATUS WHATSAPP GATEWAY:*\n- Status: ${st.device_status || 'Unknown'}\n- Nomor Pengirim: ${st.device || '-'}\n- Kuota: ${st.quota || '-'}\n- Masa Aktif: ${st.expired || '-'}`, getMainKeyboard());
                        } catch (e) {
                            await sendTg(fromId, `❌ Gagal: ${e.message}`, getMainKeyboard());
                        }
                    } else {
                        await sendTg(fromId, "🤖 *PILIH TINDAKAN:*\n\n- Untuk kirim status harian, klik tombol **'🍱 Log Aktivitas & Notif WA'** di bawah atau ketik:\n  `/makan <menu>` | `/lagi <aktivitas>` | `/sudah <rekap>`\n- Untuk pesan Deadman, klik tombol **'✍️ Tulis Pesan Kustom'**.", getMainKeyboard());
                    }
                }
            }
        }
    } catch (e) {
        console.error('[POLL ERROR]', e.message);
        await new Promise(r => setTimeout(r, 2000));
    } finally {
        isPolling = false;
        setTimeout(pollUpdates, 300);
    }
}

console.log("Deadman & Activity Notifier Telegram Bridge is ACTIVE and listening...");

// Jalankan Scheduler Otomatis di Background
startAutoScheduler();

// Kirim sinyal siap & menu interaktif ke Telegram Wafi saat daemon aktif
sendTg(ALLOWED_CHAT_ID, "🤖 *SISTEM NOTIFIKASI AKTIVITAS & DEADMAN AKTIF*\n\nFitur Baru Siap Digunakan:\n✅ **Log Aktivitas:** Sudah makan, lagi ngapain, sudah ngapain aja\n✅ **Pilihan Mode:** Kirim Sendiri (Manual) atau Otomatis (Scheduler)\n✅ **Target WA:** Bisa dikirim ke WA Ku atau WA Tiara\n\nSilakan pilih menu di bawah:", getMainKeyboard()).catch(e => console.error('[NOTIF ERR]', e.message));

pollUpdates();

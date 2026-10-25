/**
 * TELEGRAM TO WHATSAPP BRIDGE DAEMON
 * Protocol Deadman - Alwafie (@alexdodod)
 */

const https = require('https');

const TG_TOKEN = "8674896830:AAFnMAWzmNvnDXqKSNoK3yXVQvSaaz36sVw";
const ALLOWED_CHAT_ID = "5443153034"; // ID Telegram Wafi
const FONNTE_TOKEN = "B9xXX9Muj7Ji71f6AKLN";
const TIARA_WA = "6285954113051";

// 1. PESAN BARU: PEMBERITAHUAN LOG 3 JAM (REVISI TERBARU)
const NEW_DEADMAN_NOTIFICATION = `[SYSTEM AUTOMATED MESSAGE: PROTOKOL DEADMAN AKTIF]
[STATUS: PEMEBRITAHUAN]

Halo Tiara, pesan ini dikirimkan secara otomatis oleh sistem yang Wafi rancang dan jalankan sendiri. Skrip ini terpicu aktif karena server tidak mendeteksi adanya log website selama 3 jam dari pesan terkirim.

Sistem memeberikan otorisasi untuk masuk ke tautan berikut:

1. https://alejandro69021.github.io/Protocol-Deadman/
2.https://drive.google.com/drive/folders/1EMQcqXExHHpffTJdIkiZ9g8FFpTtYE4s?usp=sharing

Adanya pemberitahuan ini dipicu oleh TAUTAN 1 & TAUTAN 2 tidak terbuka, Ai sedang memperbaiki sistem sendiri. Pesan ini akan dikirim setiap 3 jam apabila aktivitas log in laman masih belum terpindai. Mohon maaf tiara.

[END OF TRANSMISSION]
"LOGIN 191223"`;

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
2.https://drive.google.com/drive/folders/1EMQcqXExHHpffTJdIkiZ9g8FFpTtYE4s?usp=sharing

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

// Helper Send Telegram Answer Callback Query (menghilangkan loading spinner tombol)
async function answerCallback(callbackQueryId, text = "") {
    return postRequest(`https://api.telegram.org/bot${TG_TOKEN}/answerCallbackQuery`, {
        'Content-Type': 'application/json'
    }, {
        callback_query_id: callbackQueryId,
        text: text
    });
}

// Helper Send WhatsApp via Fonnte
async function sendWhatsAppToTiara(msg = NEW_DEADMAN_NOTIFICATION) {
    const body = new URLSearchParams({
        target: TIARA_WA,
        message: msg
    }).toString();

    return postRequest('https://api.fonnte.com/send', {
        'Authorization': FONNTE_TOKEN,
        'Content-Type': 'application/x-www-form-urlencoded'
    }, body);
}

// Helper Check Fonnte Status
async function checkFonnteStatus() {
    return postRequest('https://api.fonnte.com/device', {
        'Authorization': FONNTE_TOKEN,
        'Content-Type': 'application/json'
    }, {});
}

function getMainKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: "📢 Kirim Pesan Baru (Pemberitahuan 3 Jam)", callback_data: "ask_confirm_new" }
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

                // 1. Tangani Klik Tombol (Callback Query)
                if (upd.callback_query) {
                    const cb = upd.callback_query;
                    const fromId = String(cb.from ? cb.from.id : '');
                    if (fromId !== ALLOWED_CHAT_ID) {
                        await answerCallback(cb.id, "Akses ditolak.");
                        continue;
                    }

                    console.log(`[CALLBACK] Action clicked: ${cb.data} from ${fromId}`);

                    // Konfirmasi Kirim Pesan Baru (3 Jam)
                    if (cb.data === 'ask_confirm_new' || cb.data === 'ask_confirm') {
                        await answerCallback(cb.id);
                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: "🚨 YA, KIRIM PESAN BARU SEKARANG", callback_data: "confirm_send_new" }
                                ],
                                [
                                    { text: "❌ BATALKAN", callback_data: "cancel_send" }
                                ]
                            ]
                        };
                        const preview = `⚠️ *KONFIRMASI PENGIRIMAN PESAN BARU*\nTarget WA Tiara: *${TIARA_WA}*\n\n*Isi Pesan:*\n${NEW_DEADMAN_NOTIFICATION}`;
                        await sendTg(fromId, preview, keyboard);
                    }
                    // Konfirmasi Kirim Transmisi 7 Hari
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
                    // Eksekusi Kirim Pesan Baru
                    else if (cb.data === 'confirm_send_new' || cb.data === 'confirm_send_tiara') {
                        await answerCallback(cb.id, "Sedang mengirim ke WA Tiara...");
                        await sendTg(fromId, `⏳ Memproses pengiriman pesan baru ke WhatsApp Tiara (${TIARA_WA})...`);

                        try {
                            const resWA = await sendWhatsAppToTiara(NEW_DEADMAN_NOTIFICATION);
                            console.log('[FONNTE RES]', resWA);
                            if (resWA && resWA.status) {
                                await sendTg(fromId, `✅ *PESAN BARU BERHASIL TERKIRIM!*\n\nPesan Pemberitahuan 3 Jam telah resmi masuk antrean pengiriman Fonnte ke WhatsApp Tiara (${TIARA_WA}).\n\nID: ${resWA.id || '-'}\nProses selesai.`);
                            } else {
                                await sendTg(fromId, `❌ Gagal mengirim via Fonnte:\n${JSON.stringify(resWA)}`);
                            }
                        } catch (err) {
                            await sendTg(fromId, `❌ Error Fonnte: ${err.message}`);
                        }
                    }
                    // Eksekusi Kirim Transmisi 7 Hari
                    else if (cb.data === 'confirm_send_7d') {
                        await answerCallback(cb.id, "Sedang mengirim ke WA Tiara...");
                        await sendTg(fromId, `⏳ Memproses pengiriman Transmisi 7 Hari ke WhatsApp Tiara (${TIARA_WA})...`);

                        try {
                            const resWA = await sendWhatsAppToTiara(DEADMAN_TRANSMISSION_TEXT);
                            console.log('[FONNTE RES]', resWA);
                            if (resWA && resWA.status) {
                                await sendTg(fromId, `✅ *TRANSMISI 7 HARI BERHASIL TERKIRIM!*\n\nPesan Transmisi 7 Hari telah resmi terkirim ke WhatsApp Tiara (${TIARA_WA}).`);
                            } else {
                                await sendTg(fromId, `❌ Gagal mengirim via Fonnte:\n${JSON.stringify(resWA)}`);
                            }
                        } catch (err) {
                            await sendTg(fromId, `❌ Error Fonnte: ${err.message}`);
                        }
                    }
                    else if (cb.data === 'cancel_send') {
                        await answerCallback(cb.id, "Dibatalkan.");
                        await sendTg(fromId, "🛑 Pengiriman dibatalkan. Pesan TIDAK dikirim ke WhatsApp Tiara.");
                    }
                    else if (cb.data === 'check_status') {
                        await answerCallback(cb.id, "Mengecek status...");
                        try {
                            const st = await checkFonnteStatus();
                            await sendTg(fromId, `📊 *STATUS WHATSAPP GATEWAY:*\n- Status: ${st.device_status || 'Unknown'}\n- Nomor Pengirim: ${st.device || '-'}\n- Sisa Kuota: ${st.quota || '-'}\n- Expired: ${st.expired || '-'}`);
                        } catch (e) {
                            await sendTg(fromId, `❌ Gagal cek status: ${e.message}`);
                        }
                    }
                    continue;
                }

                // 2. Tangani Perintah Teks
                if (upd.message && upd.message.text) {
                    const msg = upd.message;
                    const fromId = String(msg.from ? msg.from.id : '');
                    if (fromId !== ALLOWED_CHAT_ID) continue;

                    const text = msg.text.trim().toLowerCase();
                    console.log(`[TEXT] Message: ${text} from ${fromId}`);

                    if (text === '/start' || text === '/menu' || text === '/help') {
                        await sendTg(fromId, "🤖 *KONTROL PUSAT PROTOKOL DEADMAN*\n\nSelamat datang, Wafi. Sistem siap mengeksekusi pesan darurat ke WhatsApp Tiara.\n\nPilih tindakan di bawah:", getMainKeyboard());
                    } else if (text === '/kirim' || text === '/kirim_wa') {
                        const keyboard = {
                            inline_keyboard: [
                                [
                                    { text: "📢 Kirim Pesan Baru (Pemberitahuan 3 Jam)", callback_data: "ask_confirm_new" }
                                ],
                                [
                                    { text: "🚨 Kirim Transmisi 7 Hari (Darurat)", callback_data: "ask_confirm_7d" }
                                ],
                                [
                                    { text: "❌ BATALKAN", callback_data: "cancel_send" }
                                ]
                            ]
                        };
                        await sendTg(fromId, `⚠️ *PILIH PESAN YANG AKAN DIKIRIM KE TIARA*\n📱 *${TIARA_WA}*`, keyboard);
                    } else if (text === '/status') {
                        try {
                            const st = await checkFonnteStatus();
                            await sendTg(fromId, `📊 *STATUS WHATSAPP GATEWAY:*\n- Status: ${st.device_status}\n- Nomor Pengirim: ${st.device}\n- Kuota: ${st.quota}\n- Masa Aktif: ${st.expired}`);
                        } catch (e) {
                            await sendTg(fromId, `❌ Gagal: ${e.message}`);
                        }
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

console.log("Deadman Telegram Bridge is ACTIVE and listening...");

// Kirim sinyal siap & tombol langsung ke Telegram Wafi saat daemon aktif
sendTg(ALLOWED_CHAT_ID, "🤖 *UPDATE SISTEM PROTOKOL DEADMAN BERHASIL*\n\nPesan baru (Pemberitahuan 3 Jam) sudah siap dikirim ke WhatsApp Tiara.\n\nKlik tombol di bawah untuk langsung eksekusi:", getMainKeyboard()).catch(e => console.error('[NOTIF ERR]', e.message));

pollUpdates();

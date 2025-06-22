export interface TelegramMessage {
    message?: {
        chat: { id: number };
        text: string;
    };
    callback_query?: {
        id: string;
        from: { id: number };
        data: string;
    };
}

interface UserState {
    step?: number;
    kegiatan?: string;
    status?: string;
    tanggal?: string;
    pengeluaran?: number;
}

declare const TELEGRAM_STATE: KVNamespace;

const TELEGRAM_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN";
const WEB_APP_URL = "YOUR_GOOGLE_WEB_APP_URL";

export default {
    async fetch(request: Request): Promise<Response> {
        const body: TelegramMessage = await request.json();

        // Callback tombol status
        if (body.callback_query) {
            const chatId = body.callback_query.from.id.toString();
            const data = body.callback_query.data;
            const state = await getState(chatId);

            if (data.startsWith("status:")) {
                state.status = data.split(":"[1]);
                state.step = 4;
                state.tanggal = new Date().toISOString().split("T")[0];

                await setState(chatId, state);
                await answerCallback(body.callback_query.id, `Status: ${state.status}`);
                return reply(chatId, "💰 Berapa jumlah pengeluaran?");
            }

            return new Response("OK");
        }

        // Pesan teks biasa
        if (body.message?.text) {
            const chatId = body.message.chat.id.toString();
            const text = body.message.text.trim();
            let state = await getState(chatId);

            if (text === "/input") {
                state = { step: 1 };
                await setState(chatId, state);
                return reply(chatId, "📝 Apa kegiatan hari ini?");
            }

            if (state.step === 1) {
                state.kegiatan = text;
                state.step = 2;
                await setState(chatId, state);
                return sendInlineKeyboard(chatId, "📍 Pilih status kegiatan:", [
                    [
                        { text: "✅ Kewajiban", callback_data: "status:kewajiban" },
                        { text: "💚 Sedekah", callback_data: "status:sedekah" },
                        { text: "🌍 Duniawi", callback_data: "status:duniawi" },
                    ]
                ]);
            }

            if (state.step === 4) {
                const amount = parseInt(text.replace(/[^\d]/g, ""), 10);
                if (isNaN(amount)) return reply(chatId, "⚠️ Masukkan jumlah angka yang valid, contoh: 15000");

                state.pengeluaran = amount;

                const payload = {
                    kegiatan: state.kegiatan,
                    status: state.status,
                    tanggal: state.tanggal,
                    pengeluaran: state.pengeluaran,
                };

                const res = await fetch(WEB_APP_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                await TELEGRAM_STATE.delete(chatId);

                return reply(chatId, res.ok ? "✅ Data berhasil disimpan. Terima kasih!" : "❌ Gagal menyimpan data ke Sheet.");
            }
        }

        return new Response("OK");
    },
};

async function reply(chatId: string, text: string): Promise<Response> {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text })
    });
    return new Response("OK");
}

async function sendInlineKeyboard(chatId: string, text: string, keyboard: any): Promise<Response> {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            reply_markup: { inline_keyboard: keyboard },
        })
    });
    return new Response("OK");
}

async function answerCallback(callbackId: string, text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackId, text })
    });
}

async function getState(chatId: string): Promise<UserState> {
    const data = await TELEGRAM_STATE.get(chatId);
    return data ? JSON.parse(data) : {};
}

async function setState(chatId: string, state: UserState): Promise<void> {
    await TELEGRAM_STATE.put(chatId, JSON.stringify(state));
}

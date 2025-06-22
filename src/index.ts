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

interface Env {
    TELEGRAM_TOKEN: string;
    WEB_APP_URL: string;
    TELEGRAM_STATE: KVNamespace;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const body: TelegramMessage = await request.json();
        console.log("hitted");

        // Callback tombol status
        if (body.callback_query) {
            const chatId = body.callback_query.from.id.toString();
            const data = body.callback_query.data;
            const state = await getState(chatId, env);

            if (data.startsWith("status:")) {
                state.status = data.split(":")[1];
                state.step = 4;
                state.tanggal = new Date().toISOString().split("T")[0];

                await setState(chatId, state, env);
                await answerCallback(body.callback_query.id, `Status: ${state.status}`, env);
                return reply(chatId, "💰 Berapa jumlah pengeluaran?", env);
            }

            return new Response("OK");
        }

        // Pesan teks biasa
        if (body.message?.text) {
            const chatId = body.message.chat.id.toString();
            const text = body.message.text.trim();
            let state = await getState(chatId, env);

            if (text === "/start") {
                return reply(chatId, "👋 Halo! Gunakan perintah /input untuk mulai mencatat pengeluaran.", env);
            }

            if (text === "/input") {
                state = { step: 1 };
                await setState(chatId, state, env);
                return reply(chatId, "📝 Apa kegiatan hari ini?", env);
            }

            if (state.step === 1) {
                state.kegiatan = text;
                state.step = 2;
                await setState(chatId, state, env);
                return sendInlineKeyboard(chatId, "📍 Pilih status kegiatan:", [
                    [
                        { text: "✅ Kewajiban", callback_data: "status:kewajiban" },
                        { text: "💚 Sedekah", callback_data: "status:sedekah" },
                        { text: "🌍 Duniawi", callback_data: "status:duniawi" },
                    ]
                ], env);
            }

            if (state.step === 4) {
                const amount = parseInt(text.replace(/[^\d]/g, ""), 10);
                if (isNaN(amount)) return reply(chatId, "⚠️ Masukkan jumlah angka yang valid, contoh: 15000", env);

                state.pengeluaran = amount;

                const payload = {
                    kegiatan: state.kegiatan,
                    status: state.status,
                    tanggal: state.tanggal,
                    pengeluaran: state.pengeluaran,
                };

                const res = await fetch(env.WEB_APP_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                await env.TELEGRAM_STATE.delete(chatId);

                return reply(chatId, res.ok ? "✅ Data berhasil disimpan. Terima kasih!" : "❌ Gagal menyimpan data ke Sheet.", env);
            }
        }

        return new Response("OK");
    },
};

async function reply(chatId: string, text: string, env: Env): Promise<Response> {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text })
    });
    return new Response("OK");
}

async function sendInlineKeyboard(chatId: string, text: string, keyboard: any, env: Env): Promise<Response> {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`;
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

async function answerCallback(callbackId: string, text: string, env: Env): Promise<void> {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/answerCallbackQuery`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackId, text })
    });
}

async function getState(chatId: string, env: Env): Promise<UserState> {
    const data = await env.TELEGRAM_STATE.get(chatId);
    return data ? JSON.parse(data) : {};
}

async function setState(chatId: string, state: UserState, env: Env): Promise<void> {
    await env.TELEGRAM_STATE.put(chatId, JSON.stringify(state));
}

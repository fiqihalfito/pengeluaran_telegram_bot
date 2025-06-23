import { Env, reply } from "..";

export async function totalPengeluaranBulanIni(chatId: string, env: Env) {
    const now = new Date();
    const namaBulanTahun = now.toLocaleDateString("id-ID", {
        year: "numeric",
        month: "long",
    });

    const totalbulanini = await hitungTotalPengeluaran(env);
    return reply(chatId, `💰 Total pengeluaran bulan ini *${namaBulanTahun}*: Rp${totalbulanini?.toLocaleString("id-ID")}`, env)
}

// function pack =============================================
async function hitungTotalPengeluaran(env: Env): Promise<number> {
    const now = new Date();
    const sheetName = now.toISOString().slice(0, 7); // yyyy-MM

    const res = await fetch(env.WEB_APP_URL, {
        method: "POST",
        body: JSON.stringify({ sheet: sheetName }),
        headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) throw new Error("Gagal mengambil data dari Sheet.");
    const data: { total: number } = await res.json();
    return data.total || 0;
}
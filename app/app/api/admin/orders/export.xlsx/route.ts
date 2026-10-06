import ExcelJS from "exceljs";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { audit } from "@/lib/orders";
import { Order } from "@/models/Commerce";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = await requireRole(["admin"]);
    await connectDB();
    const status = new URL(req.url).searchParams.get("status");
    const orders = await Order.find((status ? { status } : {}) as Record<string, unknown>).select("-snapToken -lastNotification").sort({ createdAt: -1 }).limit(20000).lean();
    const users = new Map((await User.find({ _id: { $in: orders.map((o) => o.userId) } }).select("name email").lean()).map((u) => [String(u._id), u]));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Transaksi");
    ws.columns = [
      { header: "Invoice", key: "inv", width: 18 }, { header: "Order ID", key: "oid", width: 26 }, { header: "Peserta", key: "u", width: 26 }, { header: "Email", key: "e", width: 28 },
      { header: "Produk", key: "p", width: 40 }, { header: "Voucher", key: "v", width: 12 }, { header: "Total", key: "t", width: 14 }, { header: "Status", key: "s", width: 10 }, { header: "Metode", key: "m", width: 14 }, { header: "Dibuat", key: "c", width: 20 }, { header: "Dibayar", key: "d", width: 20 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const o of orders) {
      const u = users.get(String(o.userId));
      ws.addRow({ inv: o.invoiceNo ?? "", oid: o.midtransOrderId, u: u?.name ?? "", e: u?.email ?? "", p: o.items.map((i) => i.name).join(", "), v: o.voucherCode ?? "", t: o.total, s: o.status, m: o.paymentType ?? "", c: o.createdAt, d: o.paidAt ?? "" });
    }
    ws.getColumn("t").numFmt = "#,##0";
    await audit(admin._id, "orders.export", undefined, { rows: orders.length });
    return new Response(new Uint8Array(Buffer.from(await wb.xlsx.writeBuffer())), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="transaksi.xlsx"', "Cache-Control": "private, no-store" } });
  } catch (e) {
    return handleError(e);
  }
}

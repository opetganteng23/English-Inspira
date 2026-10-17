import { describe, it, expect, vi, afterAll } from "vitest";

// Rute unggah/unduh sertifikat resmi pihak ketiga, dijalankan sungguhan terhadap MongoDB in-memory. Tidak pernah menyentuh database sungguhan.
const safe = !process.env.MONGODB_URI;

type U = { _id: unknown; role: string };
let current: U = { _id: "x", role: "participant" };

vi.mock("@/lib/rbac", async (orig) => {
  const real = await orig<typeof import("@/lib/rbac")>();
  return {
    ...real,
    // Meniru requireRole: peran harus termasuk daftar, selain itu 403.
    requireRole: async (roles: string[]) => { if (!roles.includes(current.role)) throw new real.HttpError(403, "Forbidden"); return current; },
  };
});

let mem: { stop: () => Promise<boolean> } | null = null;
afterAll(async () => { await mem?.stop(); });

const pdfBytes = () => Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");
const form = (bytes: Buffer, name: string, type: string) => { const fd = new FormData(); fd.append("file", new File([new Uint8Array(bytes)], name, { type })); return fd; };

describe("sniffCertFile", () => {
  it("menentukan jenis dari isi berkas, bukan ekstensi atau MIME", async () => {
    const { sniffCertFile } = await import("@/lib/cert-files");
    expect(sniffCertFile(pdfBytes())?.mime).toBe("application/pdf");
    expect(sniffCertFile(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0]))?.ext).toBe("jpg");
    expect(sniffCertFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))?.ext).toBe("png");
    expect(sniffCertFile(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull(); // HTML bukan PDF
    expect(sniffCertFile(Buffer.from("GIF89a....."))).toBeNull();
  });
});

describe.skipIf(!safe)("sertifikat TOEFL resmi dari pihak ketiga (database in-memory)", () => {
  it("admin melampirkan, pemilik melihat dan mengunduh, orang lain ditolak, berkas palsu ditolak", async () => {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create({ instance: { launchTimeout: 120_000 } });
    mem = server;
    process.env.MONGODB_URI = server.getUri("cert_test");
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { User } = await import("@/models/User");
    const { Certificate } = await import("@/models/Itp");
    const post = (await import("@/app/api/admin/itp-registrations/[id]/certificate/route")).POST;
    const del = (await import("@/app/api/admin/itp-registrations/[id]/certificate/route")).DELETE;
    const get = (await import("@/app/api/certificates/[id]/official/route")).GET;

    const owner = await User.create({ email: "peserta@test.id", name: "Peserta", role: "participant", status: "active" });
    const other = await User.create({ email: "lain@test.id", name: "Lain", role: "participant", status: "active" });
    const admin = await User.create({ email: "admin@test.id", name: "Admin", role: "admin", status: "active" });
    const regId = "665f1f77bcf86cd799439011";
    const as = (u: { _id: unknown; role: string }) => { current = { _id: u._id, role: u.role }; };
    const up = (bytes: Buffer, name: string, type: string, id = regId) => post(new Request("http://x/api", { method: "POST", body: form(bytes, name, type) }), { params: { id } });

    // sebelum skor/sertifikat dibuat: ditolak jelas
    as(admin);
    expect((await up(pdfBytes(), "c.pdf", "application/pdf")).status).toBe(409);

    const cert = await Certificate.create({ userId: owner._id, type: "itp", number: "EPTA-ITP-2026-0001", registrationId: regId, data: { name: "Peserta", scores: { total: 520 } } });

    // peserta tidak boleh mengunggah
    as(owner);
    expect((await up(pdfBytes(), "c.pdf", "application/pdf")).status).toBe(403);

    // berkas palsu (HTML bernama .pdf dengan MIME pdf) ditolak
    as(admin);
    expect((await up(Buffer.from("<html><script>x</script></html>"), "evil.pdf", "application/pdf")).status).toBe(415);

    // admin melampirkan PDF asli
    const ok = await up(pdfBytes(), "ETS Certificate.pdf", "application/pdf");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, mime: "application/pdf" });

    // pemilik: tampil inline dan unduh sebagai lampiran, isi sama persis
    const view = (id: string, q = "") => get(new Request(`http://x/api/certificates/${id}/official${q}`), { params: { id } });
    as(owner);
    const inline = await view(String(cert._id));
    expect(inline.status).toBe(200);
    expect(inline.headers.get("content-type")).toBe("application/pdf");
    expect(inline.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(inline.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await inline.arrayBuffer()).equals(pdfBytes())).toBe(true);
    const dl = await view(String(cert._id), "?download=1");
    expect(dl.headers.get("content-disposition")).toMatch(/^attachment;/);

    // peserta lain: tidak ditemukan (tidak membocorkan keberadaan)
    as(other);
    expect((await view(String(cert._id))).status).toBe(404);

    // admin boleh melihat
    as(admin);
    expect((await view(String(cert._id))).status).toBe(200);

    // mengganti berkas: yang lama dihapus dari penyimpanan
    const first = (await Certificate.findById(cert._id).lean())!.officialFile!.fileId;
    expect((await up(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(50)]), "scan.png", "image/png")).status).toBe(200);
    const second = (await Certificate.findById(cert._id).lean())!.officialFile!;
    expect(String(second.fileId)).not.toBe(String(first));
    expect(second.mime).toBe("image/png");
    const { readCertFile } = await import("@/lib/cert-files");
    await expect(readCertFile(first!)).rejects.toThrow();

    // hapus: peserta tidak lagi melihat berkasnya
    expect((await del(new Request("http://x/api", { method: "DELETE" }), { params: { id: regId } })).status).toBe(200);
    as(owner);
    expect((await view(String(cert._id))).status).toBe(404);
    expect((await Certificate.findById(cert._id).lean())!.data).toBeTruthy(); // catatan sertifikat dan skor tetap
  }, 240_000);
});

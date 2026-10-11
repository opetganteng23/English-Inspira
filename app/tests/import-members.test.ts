import { describe, it, expect } from "vitest";
import { parseMembersFile } from "@/lib/import-parse";
import { composeName, splitName } from "@/lib/person-name";

const csv = (text: string) => new File([text], "peserta.csv", { type: "text/csv" });

describe("impor peserta dengan given name dan surname", () => {
  it("membaca kolom given name + surname", async () => {
    const rows = await parseMembersFile(csv("email,given name,surname,phone\na@x.id,Siti Aisyah,Rahman,0812345678\n"));
    expect(rows[0]).toMatchObject({ email: "a@x.id", givenName: "Siti Aisyah", surname: "Rahman", phone: "0812345678" });
  });
  it("alias umum: first name / last name / nama depan / nama belakang", async () => {
    const a = await parseMembersFile(csv("email,first name,last name\nb@x.id,Budi,Santoso\n"));
    const b = await parseMembersFile(csv("Email,Nama Depan,Nama Belakang\nc@x.id,Citra,Dewi\n"));
    expect(a[0]).toMatchObject({ givenName: "Budi", surname: "Santoso" });
    expect(b[0]).toMatchObject({ givenName: "Citra", surname: "Dewi" });
  });
  it("kolom name tunggal tetap diterima", async () => {
    const rows = await parseMembersFile(csv("email,name\nd@x.id,Dedi Kurniawan\n"));
    expect(rows[0]).toMatchObject({ name: "Dedi Kurniawan" });
    expect(rows[0].givenName).toBeUndefined();
  });
});

describe("person-name", () => {
  it("composeName merapikan spasi", () => expect(composeName(" Siti  Aisyah ", " Rahman ")).toBe("Siti Aisyah Rahman"));
  it("splitName: token terakhir menjadi surname", () => expect(splitName("Siti Aisyah Rahman")).toEqual({ givenName: "Siti Aisyah", surname: "Rahman" }));
  it("splitName: satu kata", () => expect(splitName("Madonna")).toEqual({ givenName: "Madonna", surname: "" }));
  it("splitName: kosong", () => expect(splitName(null)).toEqual({ givenName: "", surname: "" }));
});

"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { tgl } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { ImportPanel } from "@/components/ImportPanel";
import { Editor, PersonnelImport, type I } from "@/components/InstitutionAdmin";
import { Loading, ErrorNote } from "@/components/Charts";


export default function Institusi() {
  const { data, loading, error, reload } = useApi<{ institutions: I[] }>("/api/admin/institutions");
  const [edit, setEdit] = useState<Partial<I> | null>(null);
  const [manage, setManage] = useState<I | null>(null);
  const [personnel, setPersonnel] = useState<I | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-title">Institution</h1><p className="text-sm text-ink-soft">Contract, seats, and participants of each partner institution. Participant access ends on the contract end date.</p></div><button className="btn-solid" onClick={() => setEdit({ status: "active", seats: 50 })}>+ New institution</button></div>
      <ErrorNote text={error} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Institution</th><th>Seats</th><th>Contract</th><th>Coaches / Admins</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data?.institutions.map((i) => <tr key={i.id}><td className="font-semibold text-navy"><Link href={`/admin/institutions/${i.id}`} className="text-navy hover:text-brand hover:underline">{i.name}</Link><br /><span className="text-xs font-normal text-ink-soft">{i.code}{i.batch ? ` · ${i.batch}` : ""}</span></td><td>{i.seatsUsed}/{i.seats}</td><td>{i.contractStart ? tgl(i.contractStart) : "-"} to {i.contractEnd ? tgl(i.contractEnd) : "no limit"}</td><td>{i.coaches} / {i.admins}</td><td><span className={i.status === "active" ? "badge-ok" : "badge-muted"}>{i.status === "active" ? "Active" : "Inactive"}</span>{i.holdPlacementResults && <span className="badge-warn ml-1" title="Placement results are held">Results held ({i.heldResults ?? 0})</span>}</td>
              <td className="whitespace-nowrap text-right"><Link className="mr-3 font-semibold text-brand" href={`/admin/institutions/${i.id}`}>Open</Link><Link className="mr-3 font-semibold text-brand" href={`/institution?institution=${i.id}`}>Portal</Link><button className="mr-3 font-semibold text-brand" onClick={() => setManage(i)}>Add participants</button><button className="mr-3 font-semibold text-brand" onClick={() => setPersonnel(i)}>Personnel data</button><button className="font-semibold text-brand" onClick={() => setEdit(i)}>Edit</button></td></tr>)}
            {data?.institutions.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-ink-soft">No institutions yet. Click “+ New institution” to add the first partner.</td></tr>}
          </tbody>
        </table></div>
      )}
      {edit && <Editor init={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      {personnel && <Modal title={`${personnel.name}: personnel data`} onClose={() => setPersonnel(null)} wide><PersonnelImport id={personnel.id} /></Modal>}
      {manage && <Modal title={`${manage.name}: add participants`} onClose={() => { setManage(null); reload(); }} wide><ImportPanel base={`/api/admin/institutions/${manage.id}`} /></Modal>}
    </div>
  );
}

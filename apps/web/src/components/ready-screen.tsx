"use client";

import { useEffect, useState } from "react";
import { btnWhite, card } from "./ui";

export interface ReadyInfo {
  endsAt: number;
  duration: number;
}

interface ReadyScreenProps {
  myRole: "ARTIST" | "IMPOSTOR" | null;
  secretWord: string | null;
  readyInfo: ReadyInfo | null;
}

export default function ReadyScreen({
  myRole,
  secretWord,
  readyInfo,
}: ReadyScreenProps) {
  const [now, setNow] = useState(Date.now());
  const [revealed, setRevealed] = useState(false);

  // นาฬิกานับถอยหลัง
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  const isImpostor = myRole === "IMPOSTOR";

  const remaining = readyInfo
    ? Math.max(0, Math.ceil((readyInfo.endsAt - now) / 1000))
    : null;

  const percent = readyInfo
    ? Math.max(
        0,
        Math.min(100, ((readyInfo.endsAt - now) / readyInfo.duration) * 100),
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* ตัวนับถอยหลัง */}
      <section className={`${card} bg-[#FFF3B0] p-6 text-center sm:p-8`}>
        <h2 className="text-3xl font-black">เตรียมตัวให้พร้อม! 🎒</h2>
        <p className="mt-2 text-sm font-semibold text-[#2B2A4C]/75">
          เกมกำลังจะเริ่ม ดูบทบาทของคุณก่อนนะ
        </p>

        <div
          className="mx-auto mt-6 flex h-32 w-32 items-center justify-center rounded-full border-[3px] border-[#2B2A4C] bg-white shadow-[6px_6px_0_#2B2A4C]"
          aria-live="polite"
          aria-label={
            remaining === null
              ? "กำลังเตรียมเกม"
              : `เริ่มใน ${remaining} วินาที`
          }
        >
          <span
            key={remaining ?? "wait"}
            className="inline-block animate-pulse text-6xl font-black tabular-nums motion-reduce:animate-none"
          >
            {remaining === null ? "…" : remaining}
          </span>
        </div>

        <div className="mx-auto mt-6 h-4 max-w-sm overflow-hidden rounded-full border-[3px] border-[#2B2A4C] bg-white">
          <div
            className="h-full bg-[#9775FA] transition-[width] duration-100"
            style={{ width: `${percent}%` }}
          />
        </div>
      </section>

      {/* บทบาทลับ: ซ่อนไว้ก่อน แตะเพื่อดู กันคนข้างๆ แอบเห็น */}
      <section
        className={`${card} p-6 text-center ${
          !revealed
            ? "bg-white"
            : isImpostor
              ? "bg-[#FFC2D6]"
              : "bg-[#B8F0D8]"
        }`}
      >
        <p className="text-sm font-bold text-[#2B2A4C]/70">
          บทบาทลับของคุณ
        </p>

        {!revealed ? (
          <>
            <p className="mt-4 text-5xl" aria-hidden>
              🎁
            </p>
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className={`${btnWhite} mt-5 h-12 px-8`}
            >
              แตะเพื่อดูบทบาท
            </button>
            <p className="mt-3 text-xs font-semibold text-[#2B2A4C]/60">
              ระวังเพื่อนข้างๆ แอบมองนะ!
            </p>
          </>
        ) : isImpostor ? (
          <>
            <h3 className="mt-3 text-4xl font-black">Impostor 😈</h3>
            <p className="mt-3 text-4xl font-black tracking-widest">???</p>
            <p className="mt-4 text-sm font-semibold text-[#2B2A4C]/80">
              คุณไม่รู้คำลับ! คอยดูเพื่อนวาด แล้ววาดให้เนียนเหมือนรู้
            </p>
            <button
              type="button"
              onClick={() => setRevealed(false)}
              className={`${btnWhite} mt-5 h-10 px-5 text-sm`}
            >
              ซ่อนอีกครั้ง
            </button>
          </>
        ) : (
          <>
            <h3 className="mt-3 text-4xl font-black">Artist 🎨</h3>
            <p className="mt-3 text-sm font-bold">คำลับของคุณคือ</p>
            <p className="mx-auto mt-2 inline-block rotate-[-2deg] rounded-2xl border-[3px] border-[#2B2A4C] bg-white px-6 py-2 text-4xl font-black shadow-[4px_4px_0_#2B2A4C]">
              {secretWord}
            </p>
            <p className="mt-4 text-sm font-semibold text-[#2B2A4C]/80">
              วาดคำนี้ แต่อย่าให้ Impostor จับได้ว่าคุณรู้คำลับ
            </p>
            <button
              type="button"
              onClick={() => setRevealed(false)}
              className={`${btnWhite} mt-5 h-10 px-5 text-sm`}
            >
              ซ่อนอีกครั้ง
            </button>
          </>
        )}
      </section>

      {/* วิธีเล่นสั้นๆ */}
      <section className={`${card} p-5`}>
        <h3 className="text-lg font-black">กติกาสั้นๆ ✏️</h3>
        <ul className="mt-3 space-y-2 text-sm font-semibold text-[#2B2A4C]/85">
          <li>• ผลัดกันวาดคนละ 1 เส้น ตาละ 15 วินาที ทั้งหมด 3 รอบ</li>
          <li>• Artist วาดตามคำลับ Impostor ต้องเดาจากภาพที่เพื่อนวาด</li>
          <li>• วาดครบแล้วทุกคนโหวตว่าใครคือ Impostor</li>
        </ul>
      </section>
    </div>
  );
}
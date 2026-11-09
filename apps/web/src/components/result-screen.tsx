"use client";

import type { VotingResult } from "./voting-panel";
import { Avatar, btnYellow, card, sticker } from "./ui";

interface ResultScreenProps {
  result: VotingResult;
  players: { id: string; name: string }[];
  myRole: "ARTIST" | "IMPOSTOR" | null;
  myId?: string;
  isHost: boolean;
  onPlayAgain: () => void;
}

export default function ResultScreen({
  result,
  players,
  myRole,
  myId,
  isHost,
  onPlayAgain,
}: ResultScreenProps) {
  const artistsWon = result.winner === "ARTISTS";
  const iWon =
    (myRole === "IMPOSTOR" && !artistsWon) ||
    (myRole === "ARTIST" && artistsWon);

  const maxVotes = Math.max(1, ...result.tally.map((item) => item.votes));

  const indexOf = (id: string | null) =>
    players.findIndex((player) => player.id === id);

  const confetti = iWon ? ["🎉", "🎊", "🥳", "🎊", "🎉"] : ["🫠", "💧", "🫠"];

  return (
    <div className="space-y-6">
      {/* ป้ายประกาศผู้ชนะ */}
      <section
        className={`${card} rotate-[-1deg] p-6 text-center sm:p-8 ${
          artistsWon ? "bg-[#B8F0D8]" : "bg-[#FFC2D6]"
        }`}
      >
        <div
          className="flex justify-center gap-2 text-4xl"
          aria-hidden
        >
          {confetti.map((emoji, i) => (
            <span
              key={i}
              className="inline-block animate-bounce motion-reduce:animate-none"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              {emoji}
            </span>
          ))}
        </div>

        <h2 className="mt-3 text-4xl font-black sm:text-5xl">
          {artistsWon ? "ทีม Artist ชนะ!" : "Impostor ชนะ!"}
        </h2>

        <p className="mt-3 text-lg font-bold">
          {iWon
            ? "ทีมของคุณชนะ เก่งมากเลย 🌟"
            : "รอบนี้พลาดนิดเดียว รอบหน้าสู้ใหม่นะ 💪"}
        </p>
      </section>

      {/* เฉลย */}
      <section className={`${card} p-5 sm:p-7`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border-[3px] border-[#2B2A4C] bg-[#FFE3EC] p-4 text-center">
            <p className="text-sm font-bold">Impostor ตัวจริงคือ</p>
            <div className="mt-3 flex flex-col items-center gap-2">
              <Avatar index={indexOf(result.impostorId)} size="lg" />
              <p className="text-2xl font-black">
                {result.impostorName ?? "-"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border-[3px] border-[#2B2A4C] bg-[#E6DBFF] p-4 text-center">
            <p className="text-sm font-bold">คำลับคือ</p>
            <p className="mt-5 text-4xl font-black">
              {result.secretWord ?? "-"}
            </p>
          </div>
        </div>

        <p className="mt-5 text-center font-semibold text-[#2B2A4C]/85">
          {result.impostorLeft ? (
            <>Impostor ออกจากเกมไปก่อนเฉลย Artist เลยชนะไปเลย</>
          ) : result.isTie ? (
            <>โหวตเสมอกัน เลยไม่มีใครถูกจับ Impostor รอดตัวไปได้!</>
          ) : artistsWon ? (
            <>จับถูกคนแล้ว! เพื่อนๆ สายตาแหลมสุดๆ</>
          ) : (
            <>
              <strong>{result.accusedName}</strong>{" "}
              ถูกโหวตมากที่สุด แต่ไม่ใช่ Impostor นะ
            </>
          )}
        </p>
      </section>

      {/* คะแนนโหวต */}
      <section className={`${card} p-5 sm:p-7`}>
        <h3 className="text-lg font-black">คะแนนโหวต 🗳️</h3>

        <ul className="mt-4 space-y-3">
          {result.tally.map((item) => {
            const isImpostor = item.playerId === result.impostorId;

            return (
              <li key={item.playerId}>
                <div className="flex items-center gap-3">
                  <Avatar index={indexOf(item.playerId)} size="sm" />

                  <span className="min-w-0 flex-1 truncate font-bold">
                    {item.name}
                    {item.playerId === myId && (
                      <span className="ml-1 text-xs font-semibold text-[#2B2A4C]/60">
                        (คุณ)
                      </span>
                    )}
                  </span>

                  {isImpostor && (
                    <span className={`${sticker} bg-[#FF8FB8] px-2 py-0 text-xs`}>
                      Impostor
                    </span>
                  )}

                  <span className="w-16 text-right font-bold tabular-nums">
                    {item.votes} โหวต
                  </span>
                </div>

                <div className="ml-11 mt-1.5 h-3 overflow-hidden rounded-full border-[3px] border-[#2B2A4C] bg-white">
                  <div
                    className={`h-full ${
                      isImpostor ? "bg-[#FF8FB8]" : "bg-[#9775FA]"
                    }`}
                    style={{ width: `${(item.votes / maxVotes) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        {result.votes.length > 0 && (
          <>
            <h3 className="mt-7 text-lg font-black">ใครโหวตใคร 👀</h3>

            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {result.votes.map((vote) => (
                <li
                  key={vote.voterId}
                  className="rounded-xl border-[3px] border-[#2B2A4C] bg-[#F4FAFF] px-3 py-2 font-semibold"
                >
                  {vote.voterName} <span aria-label="โหวตให้">→</span>{" "}
                  <span
                    className={
                      vote.targetId === result.impostorId
                        ? "font-black text-[#E0356B]"
                        : ""
                    }
                  >
                    {vote.targetName}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* เล่นอีกครั้ง */}
      {isHost ? (
        <button
          type="button"
          onClick={onPlayAgain}
          className={`${btnYellow} h-14 w-full text-lg`}
        >
          เล่นอีกครั้ง 🔁
        </button>
      ) : (
        <p className="text-center font-bold text-[#2B2A4C]/70">
          รอ HOST เริ่มเกมใหม่นะ... ⏳
        </p>
      )}
    </div>
  );
}
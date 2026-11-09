"use client";

import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { Avatar, card, sticker } from "./ui";

export interface VotingInfo {
  endsAt: number;
  duration: number;
  candidates: { id: string; name: string }[];
}

export interface VoteProgress {
  votedIds: string[];
  total: number;
}

export interface VotingResult {
  tally: { playerId: string; name: string; votes: number }[];
  votes: {
    voterId: string;
    voterName: string;
    targetId: string;
    targetName: string;
  }[];
  isTie: boolean;
  accusedId: string | null;
  accusedName: string | null;
  impostorId: string | null;
  impostorName: string | null;
  impostorLeft: boolean;
  secretWord: string | null;
  winner: "ARTISTS" | "IMPOSTOR";
}

interface VotingPanelProps {
  socket: Socket;
  votingInfo: VotingInfo | null;
  voteProgress: VoteProgress | null;
  myVote: string | null;
}

export default function VotingPanel({
  socket,
  votingInfo,
  voteProgress,
  myVote,
}: VotingPanelProps) {
  const [now, setNow] = useState(Date.now());

  // นาฬิกานับถอยหลัง
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  if (!votingInfo) return null;

  const remainingSeconds = Math.max(
    0,
    Math.ceil((votingInfo.endsAt - now) / 1000),
  );

  const percent = Math.max(
    0,
    Math.min(100, ((votingInfo.endsAt - now) / votingInfo.duration) * 100),
  );

  const votedIds = voteProgress?.votedIds ?? [];
  const iVoted = !!socket.id && votedIds.includes(socket.id);
  const urgent = remainingSeconds <= 10;

  const castVote = (targetId: string) => {
    if (!socket.connected || remainingSeconds <= 0) return;
    socket.emit("cast-vote", { targetId });
  };

  return (
    <section className={`${card} bg-[#FFE3EC] p-5 sm:p-7`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-3xl font-black">ใครคือ Impostor? 🕵️</h2>
          <p className="mt-2 max-w-md text-sm font-semibold text-[#2B2A4C]/75">
            แตะชื่อคนที่คุณสงสัย เปลี่ยนใจได้จนกว่าทุกคนจะโหวตครบหรือหมดเวลา
          </p>
        </div>

        <div
          className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-[#2B2A4C] shadow-[4px_4px_0_#2B2A4C] ${
            urgent ? "bg-[#FFB3C1]" : "bg-[#FFE98A]"
          }`}
          aria-label={`เหลือเวลา ${remainingSeconds} วินาที`}
        >
          <span className="text-3xl font-black leading-none tabular-nums">
            {remainingSeconds}
          </span>
          <span className="text-xs font-bold">วินาที</span>
        </div>
      </div>

      <div className="mt-4 h-4 overflow-hidden rounded-full border-[3px] border-[#2B2A4C] bg-white">
        <div
          className={`h-full transition-[width] duration-200 ${
            urgent ? "bg-[#FF4D6D]" : "bg-[#9775FA]"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {votingInfo.candidates.map((candidate, index) => {
          const isMe = candidate.id === socket.id;
          const selected = myVote === candidate.id;
          const hasVoted = votedIds.includes(candidate.id);

          return (
            <li key={candidate.id}>
              <button
                type="button"
                onClick={() => castVote(candidate.id)}
                disabled={isMe || remainingSeconds <= 0}
                aria-pressed={selected}
                className={`flex w-full items-center gap-3 rounded-2xl border-[3px] border-[#2B2A4C] px-3 py-3 text-left font-bold transition focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#B79CFF] disabled:cursor-not-allowed ${
                  selected
                    ? "translate-x-[3px] translate-y-[3px] bg-[#FFD93D]"
                    : isMe
                      ? "bg-white/60 opacity-60"
                      : "bg-white shadow-[4px_4px_0_#2B2A4C] hover:bg-[#FFF9D6]"
                }`}
              >
                <Avatar index={index} />

                <span className="min-w-0 flex-1 truncate">
                  {candidate.name}
                  {isMe && (
                    <span className="ml-1 text-xs font-semibold text-[#2B2A4C]/60">
                      (คุณ)
                    </span>
                  )}
                </span>

                <span className="flex shrink-0 flex-col items-end gap-1">
                  {selected && (
                    <span className={`${sticker} bg-[#FF8FB8] px-2 py-0 text-xs`}>
                      ✓ เลือกอยู่
                    </span>
                  )}
                  {hasVoted && (
                    <span className="text-xs font-semibold text-[#1E9E6A]">
                      โหวตแล้ว
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-center text-sm font-bold">
        {iVoted
          ? "โหวตแล้ว! รอเพื่อนๆ อีกนิดนะ..."
          : "ยังไม่ได้โหวต แตะชื่อด้านบนได้เลย"}
        {voteProgress && (
          <span className="ml-2 font-semibold text-[#2B2A4C]/60">
            ({votedIds.length}/{voteProgress.total} คน)
          </span>
        )}
      </p>
    </section>
  );
}
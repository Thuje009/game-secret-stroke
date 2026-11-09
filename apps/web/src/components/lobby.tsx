"use client";

import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import DrawingBoard from "./drawing-board";
import ReadyScreen, { type ReadyInfo } from "./ready-screen";
import ResultScreen from "./result-screen";
import VotingPanel, {
  type VoteProgress,
  type VotingInfo,
  type VotingResult,
} from "./voting-panel";
import {
  Avatar,
  btnMint,
  btnPink,
  btnWhite,
  card,
  input,
  sticker,
} from "./ui";

interface Player {
  id: string;
  name: string;
  isHost: boolean;
}

interface Room {
  code: string;
  phase: "LOBBY" | "STARTING" | "DRAWING" | "VOTING" | "RESULT" | "FINISHED";
  players: Player[];
  playerCount: number;
  maxPlayers: number;
}

type Role = "ARTIST" | "IMPOSTOR" | null;

interface TurnInfo {
  playerId: string;
  playerName: string;
  turnNumber: number;
  totalTurns: number;
  currentRound: number;
  totalRounds: number;
  endsAt: number;
  duration: number;
}

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";

export default function Lobby() {
  // --- Socket Connection ---
  const socket: Socket = useMemo(
    () => io(SERVER_URL, { autoConnect: false }),
    []
  );

  // --- States ---
  const [connected, setConnected] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // --- Game States ---
  const [myRole, setMyRole] = useState<Role>(null);
  const [secretWord, setSecretWord] = useState<string | null>(null);
  const [turnInfo, setTurnInfo] = useState<TurnInfo | null>(null);
  const [drawingFinished, setDrawingFinished] = useState(false);

  // --- Voting States ---
  const [votingInfo, setVotingInfo] = useState<VotingInfo | null>(null);
  const [voteProgress, setVoteProgress] = useState<VoteProgress | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [votingResult, setVotingResult] = useState<VotingResult | null>(null);
  const [showGallery, setShowGallery] = useState(false);

  // --- Ready States ---
  const [readyInfo, setReadyInfo] = useState<ReadyInfo | null>(null);

  // --- Socket Effects ---
  useEffect(() => {
    socket.connect();

    const resetGameState = () => {
      setMyRole(null);
      setSecretWord(null);
      setTurnInfo(null);
      setDrawingFinished(false);
      setVotingInfo(null);
      setVoteProgress(null);
      setMyVote(null);
      setVotingResult(null);
      setShowGallery(false);
      setReadyInfo(null);
    };

    const onConnect = () => {
      setConnected(true);
      setError("");
    };

    const onDisconnect = () => {
      setConnected(false);
      setRoom(null);
      resetGameState();
      setError("การเชื่อมต่อขาดหาย กรุณาเชื่อมต่อใหม่");
    };

    const onRoomCreated = (data: Room) => {
      setRoom(data);
      setError("");
    };

    const onRoomJoined = (data: Room) => {
      setRoom(data);
      setError("");
    };

    const onRoomUpdated = (data: Room) => {
      setRoom(data);
    };

    const onRoomError = (data: { message: string }) => {
      setError(data.message);
    };

    const onGameStarted = (data: {
      role: "ARTIST" | "IMPOSTOR";
      secretWord: string | null;
    }) => {
      resetGameState();
      setMyRole(data.role);
      setSecretWord(data.secretWord);
      setError("");
    };

    const onGameStarting = (data: ReadyInfo) => {
      setReadyInfo(data);
    };

    const onTurnStarted = (data: TurnInfo) => {
      setTurnInfo(data);
    };

    const onDrawingFinished = () => {
      setDrawingFinished(true);
    };

    const onVotingStarted = (data: VotingInfo) => {
      setVotingInfo(data);
      setVoteProgress(null);
      setMyVote(null);
      setVotingResult(null);
      setShowGallery(false);
      setError("");
    };

    const onVoteProgress = (data: VoteProgress) => {
      setVoteProgress(data);
    };

    const onVoteAccepted = (data: { targetId: string }) => {
      setMyVote(data.targetId);
      setError("");
    };

    const onVotingResult = (data: VotingResult) => {
      setVotingResult(data);
    };

    // HOST กดเล่นอีกครั้ง: กลับไปหน้า Lobby ของห้องเดิม
    const onGameReset = () => {
      resetGameState();
      setError("");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room-created", onRoomCreated);
    socket.on("room-joined", onRoomJoined);
    socket.on("room-updated", onRoomUpdated);
    socket.on("room-error", onRoomError);
    socket.on("game-started", onGameStarted);
    socket.on("game-starting", onGameStarting);
    socket.on("turn-started", onTurnStarted);
    socket.on("drawing-finished", onDrawingFinished);
    socket.on("voting-started", onVotingStarted);
    socket.on("vote-progress", onVoteProgress);
    socket.on("vote-accepted", onVoteAccepted);
    socket.on("voting-result", onVotingResult);
    socket.on("game-reset", onGameReset);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room-created", onRoomCreated);
      socket.off("room-joined", onRoomJoined);
      socket.off("room-updated", onRoomUpdated);
      socket.off("room-error", onRoomError);
      socket.off("game-started", onGameStarted);
      socket.off("game-starting", onGameStarting);
      socket.off("turn-started", onTurnStarted);
      socket.off("drawing-finished", onDrawingFinished);
      socket.off("voting-started", onVotingStarted);
      socket.off("vote-progress", onVoteProgress);
      socket.off("vote-accepted", onVoteAccepted);
      socket.off("voting-result", onVotingResult);
      socket.off("game-reset", onGameReset);
      socket.disconnect();
    };
  }, [socket]);

  // --- Actions ---
  const createRoom = () => {
    setError("");
    if (!playerName.trim()) {
      setError("กรุณากรอกชื่อผู้เล่นก่อน");
      return;
    }
    if (!connected) {
      setError("ยังเชื่อมต่อกับ Server ไม่ได้");
      return;
    }
    socket.emit("create-room", { playerName: playerName.trim() });
  };

  const joinRoom = () => {
    setError("");
    if (!playerName.trim()) {
      setError("กรุณากรอกชื่อผู้เล่นก่อน");
      return;
    }
    if (roomCode.trim().length !== 6) {
      setError("รหัสห้องต้องมี 6 ตัว");
      return;
    }
    if (!connected) {
      setError("ยังเชื่อมต่อกับ Server ไม่ได้");
      return;
    }
    socket.emit("join-room", {
      playerName: playerName.trim(),
      roomCode: roomCode.trim().toUpperCase(),
    });
  };

  const startGame = () => {
    setError("");
    if (!room) return;

    if (room.playerCount < 3) {
      setError("ต้องมีผู้เล่นอย่างน้อย 3 คน");
      return;
    }

    socket.emit("start-game");
  };

  const playAgain = () => {
    setError("");
    socket.emit("play-again");
  };

  const copyRoomCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("ไม่สามารถคัดลอกรหัสห้องได้");
    }
  };

  const isHost = room?.players.find((player) => player.isHost)?.id === socket.id;

  // แยกหน้าจอตามสถานะเกม
  // LOBBY ที่มี myRole แล้ว = ช่วงสั้นๆ ที่ได้รับบทบาทแต่ห้องยังไม่อัปเดตเป็น STARTING
  const screen:
    | "join"
    | "lobby"
    | "ready"
    | "drawing"
    | "voting"
    | "result" = !room
    ? "join"
    : !myRole
      ? "lobby"
      : votingResult
        ? "result"
        : room.phase === "VOTING"
          ? "voting"
          : room.phase === "STARTING" || room.phase === "LOBBY"
            ? "ready"
            : "drawing";

  const inGame = screen !== "join" && screen !== "lobby";

  return (
    <main
      className="min-h-screen px-4 py-8 text-[#2B2A4C] sm:px-6"
      style={{
        backgroundColor: "#DFF3FF",
        backgroundImage: "radial-gradient(#ffffff 2.5px, transparent 3px)",
        backgroundSize: "26px 26px",
      }}
    >
      <div
        className={`mx-auto flex w-full max-w-3xl flex-col ${
          inGame ? "" : "min-h-[85vh] justify-center"
        }`}
      >
        {/* Header */}
        <header className={`text-center ${inGame ? "mb-6" : "mb-10"}`}>
          <h1
            className={`font-black tracking-tight [text-shadow:3px_3px_0_#FF8FB8] ${
              inGame ? "text-3xl" : "text-5xl sm:text-6xl"
            }`}
          >
            Secret Stroke ✏️
          </h1>

          {!inGame && (
            <p className="mt-3 text-base font-semibold text-[#2B2A4C]/75">
              วาดภาพให้เนียน แล้วช่วยกันจับว่าใครคือคนโกหก
            </p>
          )}

          <div className="mt-4 flex justify-center">
            <span className={`${sticker} bg-white text-xs`}>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  connected ? "bg-[#34C98E]" : "bg-[#FF4D6D]"
                }`}
              />
              {connected ? "เชื่อมต่อ Server แล้ว" : "กำลังเชื่อมต่อ Server..."}
            </span>
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border-[3px] border-[#2B2A4C] bg-[#FFC2D6] px-4 py-3 text-center text-sm font-bold shadow-[4px_4px_0_#2B2A4C]"
          >
            {error}
          </div>
        )}

        {/* หน้าจอ */}
        {screen === "join" && (
          <JoinCreateForm
            playerName={playerName}
            setPlayerName={setPlayerName}
            roomCode={roomCode}
            setRoomCode={setRoomCode}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            connected={connected}
          />
        )}

        {screen === "lobby" && room && (
          <RoomLobbyView
            room={room}
            isHost={isHost}
            copied={copied}
            onCopyCode={copyRoomCode}
            onStartGame={startGame}
          />
        )}

        {/* หน้าผลชนะ: แยกออกมาเป็นหน้าเต็มของตัวเอง ไม่มีกระดานวาด */}
        {screen === "result" && room && votingResult && (
          <ResultScreen
            result={votingResult}
            players={room.players}
            myRole={myRole}
            myId={socket.id}
            isHost={isHost}
            onPlayAgain={playAgain}
          />
        )}

        {/* หน้าเตรียมตัว: นับถอยหลังก่อนเริ่มวาด */}
        {screen === "ready" && (
          <ReadyScreen
            myRole={myRole}
            secretWord={secretWord}
            readyInfo={readyInfo}
          />
        )}

        {/* หน้าวาด และหน้าโหวต แยกเป็นคนละหน้า
            แต่ DrawingBoard ต้องคงอยู่ (แค่ซ่อน) ไม่งั้นภาพที่วาดไว้จะหาย */}
        {(screen === "drawing" || screen === "voting") && (
          <div className="space-y-6">
            {screen === "drawing" && (
              <RoleCard myRole={myRole} secretWord={secretWord} />
            )}

            {screen === "voting" && (
              <VotingPanel
                socket={socket}
                votingInfo={votingInfo}
                voteProgress={voteProgress}
                myVote={myVote}
              />
            )}

            {screen === "voting" && (
              <button
                type="button"
                onClick={() => setShowGallery((value) => !value)}
                aria-expanded={showGallery}
                className={`${btnWhite} h-12 w-full`}
              >
                {showGallery ? "ซ่อนภาพที่วาด 🙈" : "ดูภาพที่ทุกคนวาด 🖼️"}
              </button>
            )}

            <div className={screen === "voting" && !showGallery ? "hidden" : ""}>
              <DrawingBoard
                socket={socket}
                turnInfo={turnInfo}
                drawingFinished={drawingFinished}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 text-center text-xs font-semibold text-[#2B2A4C]/50">
          Secret Stroke • วาดไปด้วยกัน
        </footer>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------

function RoleCard({
  myRole,
  secretWord,
}: {
  myRole: Role;
  secretWord: string | null;
}) {
  const isImpostor = myRole === "IMPOSTOR";

  return (
    <section
      className={`${card} p-6 text-center ${
        isImpostor ? "bg-[#FFC2D6]" : "bg-[#B8F0D8]"
      }`}
    >
      <p className="text-sm font-bold text-[#2B2A4C]/70">บทบาทลับของคุณ (อย่าให้ใครเห็นนะ!)</p>

      {isImpostor ? (
        <>
          <h2 className="mt-3 text-4xl font-black">Impostor 😈</h2>
          <p className="mt-3 text-4xl font-black tracking-widest">???</p>
          <p className="mt-3 text-sm font-semibold text-[#2B2A4C]/80">
            คุณไม่รู้คำลับ! พยายามวาดให้เนียนเหมือนรู้
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-3 text-4xl font-black">Artist 🎨</h2>
          <p className="mt-3 text-sm font-bold">คำลับของคุณคือ</p>
          <p className="mx-auto mt-2 inline-block rotate-[-2deg] rounded-2xl border-[3px] border-[#2B2A4C] bg-white px-6 py-2 text-4xl font-black shadow-[4px_4px_0_#2B2A4C]">
            {secretWord}
          </p>
          <p className="mt-4 text-sm font-semibold text-[#2B2A4C]/80">
            วาดคำนี้ แต่อย่าให้ Impostor รู้ตัว
          </p>
        </>
      )}
    </section>
  );
}

function RoomLobbyView({
  room,
  isHost,
  copied,
  onCopyCode,
  onStartGame,
}: {
  room: Room;
  isHost: boolean;
  copied: boolean;
  onCopyCode: () => void;
  onStartGame: () => void;
}) {
  return (
    <section className={`${card} p-5 sm:p-8`}>
      <div className="text-center">
        <p className="text-sm font-bold text-[#2B2A4C]/70">รหัสห้องของคุณ</p>
        <button
          onClick={onCopyCode}
          className="mt-3 rotate-[-1deg] rounded-2xl border-[3px] border-[#2B2A4C] bg-[#FFD93D] px-6 py-2 text-4xl font-black tracking-[0.2em] shadow-[4px_4px_0_#2B2A4C] transition hover:bg-[#ffcf1f] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#B79CFF] sm:text-5xl"
          title="กดเพื่อคัดลอกรหัสห้อง"
        >
          {room.code}
        </button>
        <p className="mt-3 text-xs font-semibold text-[#2B2A4C]/60">
          {copied ? "คัดลอกรหัสแล้ว! 🎉" : "กดที่รหัสเพื่อคัดลอก แล้วส่งให้เพื่อนได้เลย"}
        </p>
      </div>

      <div className="my-7 flex items-center justify-between border-b-[3px] border-dashed border-[#2B2A4C]/25 pb-4">
        <h2 className="text-lg font-black">เพื่อนๆ ในห้อง</h2>
        <span className={`${sticker} bg-[#E6DBFF]`}>
          {room.playerCount}/{room.maxPlayers} คน
        </span>
      </div>

      <ul className="space-y-3">
        {room.players.map((player, index) => (
          <li
            key={player.id}
            className="flex items-center gap-3 rounded-2xl border-[3px] border-[#2B2A4C] bg-[#F4FAFF] px-3 py-2"
          >
            <Avatar index={index} />
            <span className="min-w-0 flex-1 truncate font-bold">
              {player.name}
            </span>
            {player.isHost && (
              <span className={`${sticker} bg-[#FFD93D] px-2 py-0 text-xs`}>
                👑 HOST
              </span>
            )}
          </li>
        ))}
      </ul>

      {isHost ? (
        <button
          onClick={onStartGame}
          disabled={room.playerCount < 3 || room.phase !== "LOBBY"}
          className={`${btnMint} mt-7 h-14 w-full text-lg`}
        >
          {room.playerCount < 3
            ? `รอเพื่อนอีก ${3 - room.playerCount} คน`
            : "เริ่มเกมเลย! 🚀"}
        </button>
      ) : (
        <p className="mt-7 text-center font-bold text-[#2B2A4C]/70">
          รอ HOST เริ่มเกมนะ... ⏳
        </p>
      )}
    </section>
  );
}

function JoinCreateForm({
  playerName,
  setPlayerName,
  roomCode,
  setRoomCode,
  onCreateRoom,
  onJoinRoom,
  connected,
}: {
  playerName: string;
  setPlayerName: (v: string) => void;
  roomCode: string;
  setRoomCode: (v: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  connected: boolean;
}) {
  return (
    <section className={`${card} p-5 sm:p-8`}>
      <div className="space-y-5">
        <div>
          <label
            htmlFor="player-name"
            className="mb-2 block text-sm font-bold"
          >
            ชื่อของคุณ
          </label>
          <input
            id="player-name"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="เช่น น้องมะนาว"
            maxLength={16}
            className={input}
          />
        </div>

        <button
          onClick={onCreateRoom}
          disabled={!connected}
          className={`${btnPink} h-14 w-full text-lg`}
        >
          สร้างห้องใหม่ ✨
        </button>

        <div className="flex items-center gap-3 text-sm font-bold text-[#2B2A4C]/50">
          <span className="h-0 flex-1 border-t-[3px] border-dashed border-[#2B2A4C]/25" />
          หรือเข้าห้องเพื่อน
          <span className="h-0 flex-1 border-t-[3px] border-dashed border-[#2B2A4C]/25" />
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="รหัสห้อง 6 หลัก"
            maxLength={6}
            aria-label="รหัสห้อง"
            className={`${input} text-center font-mono tracking-widest`}
          />
          <button
            onClick={onJoinRoom}
            disabled={!connected}
            className={`${btnWhite} h-[52px] whitespace-nowrap px-6`}
          >
            เข้าร่วม
          </button>
        </div>
      </div>
    </section>
  );
}
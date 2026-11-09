"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Socket } from "socket.io-client";
import { btnWhite, card, sticker } from "./ui";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  color: string;
  width: number;
  points: Point[];
}

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

interface DrawingBoardProps {
  socket: Socket;
  turnInfo: TurnInfo | null;
  drawingFinished: boolean;
}

// พื้นกระดานเป็นสีขาว จึงใช้สีหมึกเข้มเป็นสีเริ่มต้นแทนสีขาว
const COLORS = [
  "#2b2a4c",
  "#ff4d6d",
  "#ff9f43",
  "#ffd93d",
  "#34c98e",
  "#4dabf7",
  "#9775fa",
  "#a0674b",
];

export default function DrawingBoard({
  socket,
  turnInfo,
  drawingFinished,
}: DrawingBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);
  const hasSubmittedRef = useRef(false);

  const [color, setColor] = useState("#2b2a4c");
  const [brushSize, setBrushSize] = useState(5);
  const [now, setNow] = useState(Date.now());
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const isMyTurn =
    !drawingFinished &&
    !!turnInfo &&
    turnInfo.playerId === socket.id &&
    now < turnInfo.endsAt;

  const canDraw = isMyTurn && !hasSubmitted;

  const remainingSeconds = turnInfo
    ? Math.max(0, Math.ceil((turnInfo.endsAt - now) / 1000))
    : 0;

  // รีเซ็ตจำนวนเส้นเมื่อเริ่มเทิร์นใหม่
  useEffect(() => {
    hasSubmittedRef.current = false;
    setHasSubmitted(false);

    isDrawingRef.current = false;
    currentStrokeRef.current = null;
  }, [turnInfo?.playerId, turnInfo?.currentRound]);

  // นาฬิกานับถอยหลัง
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 100);

    return () => window.clearInterval(timer);
  }, []);

  // วาดเส้นบน Canvas
  const drawStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      const canvas = ctx.canvas;

      if (!stroke.points.length) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const first = stroke.points[0];

      ctx.moveTo(
        first.x * canvas.width,
        first.y * canvas.height,
      );

      for (const point of stroke.points.slice(1)) {
        ctx.lineTo(
          point.x * canvas.width,
          point.y * canvas.height,
        );
      }

      if (stroke.points.length === 1) {
        ctx.lineTo(
          first.x * canvas.width + 0.1,
          first.y * canvas.height + 0.1,
        );
      }

      ctx.stroke();
    },
    [],
  );

  // วาดกระดานใหม่
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokesRef.current) {
      drawStroke(ctx, stroke);
    }

    if (currentStrokeRef.current) {
      drawStroke(ctx, currentStrokeRef.current);
    }
  }, [drawStroke]);

  // ปรับขนาด Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);

      redraw();
    };

    const observer = new ResizeObserver(resizeCanvas);

    observer.observe(canvas);
    resizeCanvas();

    return () => observer.disconnect();
  }, [redraw]);

  // รับเส้นและคำสั่งล้างจาก Server
  useEffect(() => {
    const onStrokeDrawn = (stroke: Stroke) => {
      if (!stroke.id) return;

      strokesRef.current.push(stroke);
      redraw();
    };

    const onPlayerBoardCleared = ({
      playerId,
    }: {
      playerId: string;
    }) => {
      strokesRef.current = strokesRef.current.filter(
        (stroke) => stroke.id !== playerId,
      );

      redraw();
    };

    socket.on("stroke-drawn", onStrokeDrawn);
    socket.on("player-board-cleared", onPlayerBoardCleared);

    return () => {
      socket.off("stroke-drawn", onStrokeDrawn);
      socket.off("player-board-cleared", onPlayerBoardCleared);
    };
  }, [socket, redraw]);

  // แปลงตำแหน่งเมาส์เป็นพิกัด 0-1
  const getPoint = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): Point => {
    const rect = event.currentTarget.getBoundingClientRect();

    return {
      x: Math.max(
        0,
        Math.min(1, (event.clientX - rect.left) / rect.width),
      ),
      y: Math.max(
        0,
        Math.min(1, (event.clientY - rect.top) / rect.height),
      ),
    };
  };

  // เริ่มวาด
  const handlePointerDown = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) => {
    if (!isMyTurn || hasSubmittedRef.current) return;
    if (!socket.connected || !socket.id) return;

    event.preventDefault();

    isDrawingRef.current = true;

    event.currentTarget.setPointerCapture(event.pointerId);

    currentStrokeRef.current = {
      id: socket.id,
      color,
      width: brushSize,
      points: [getPoint(event)],
    };

    redraw();
  };

  // ระหว่างวาด
  const handlePointerMove = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;

    event.preventDefault();

    currentStrokeRef.current.points.push(getPoint(event));

    redraw();
  };

  // ปล่อยเมาส์ = จบเทิร์น
  const handlePointerUp = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;

    isDrawingRef.current = false;

    const stroke = currentStrokeRef.current;

    currentStrokeRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    // ล็อกไม่ให้วาดเส้นที่สองในเทิร์นเดียวกัน
    hasSubmittedRef.current = true;
    setHasSubmitted(true);

    // ส่งเส้นให้ Server ตรวจสอบ
    socket.emit("draw-stroke", {
      color: stroke.color,
      width: stroke.width,
      points: stroke.points,
    });

    // ไม่เพิ่มเส้นลง Local เอง
    // รอรับ stroke-drawn จาก Server
    redraw();
  };

  // ยกเลิกการวาดกรณี Pointer ถูกยกเลิก
  const handlePointerCancel = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) => {
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    currentStrokeRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    redraw();
  };

  // ล้างเฉพาะเส้นของตัวเอง
  const clearBoard = () => {
    if (!socket.connected || !socket.id) return;

    isDrawingRef.current = false;
    currentStrokeRef.current = null;

    socket.emit("clear-board");

    redraw();
  };

  const urgent = remainingSeconds <= 5;
  const percent = turnInfo
    ? Math.max(
        0,
        Math.min(
          100,
          ((turnInfo.endsAt - now) / turnInfo.duration) * 100,
        ),
      )
    : 0;

  const statusText = isMyTurn
    ? hasSubmitted
      ? "วาดเสร็จแล้ว รอเพื่อนคนถัดไปนะ"
      : "มีเวลา 15 วินาที วาดได้ 1 เส้น ปล่อยนิ้วเพื่อส่งต่อ"
    : turnInfo
      ? `กำลังรอ ${turnInfo.playerName} วาดภาพอยู่...`
      : "กำลังเตรียมผู้เล่นคนถัดไป";

  return (
    <section className="space-y-5">
      {/* แผงบอกเทิร์น: ซ่อนเมื่อวาดครบแล้ว (ตอนโหวตจะเหลือแค่แกลเลอรี) */}
      {!drawingFinished && (
        <div
          className={`${card} p-4 sm:p-5 ${
            isMyTurn ? "bg-[#FFF3B0]" : "bg-white"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              {turnInfo && (
                <span className={`${sticker} bg-[#E6DBFF]`}>
                  รอบ {turnInfo.currentRound}/{turnInfo.totalRounds}
                </span>
              )}

              <h2 className="mt-2 text-2xl font-black">
                {turnInfo ? turnInfo.playerName : "กำลังเตรียมเทิร์น..."}
                {isMyTurn && (
                  <span className="ml-2 inline-block rotate-2 rounded-full border-[3px] border-[#2B2A4C] bg-[#6BE3B0] px-3 py-0.5 align-middle text-sm font-black">
                    ตาคุณ!
                  </span>
                )}
              </h2>
            </div>

            {turnInfo && (
              <div
                className={`flex h-20 w-20 flex-col items-center justify-center rounded-full border-[3px] border-[#2B2A4C] shadow-[4px_4px_0_#2B2A4C] ${
                  urgent ? "bg-[#FFB3C1]" : "bg-[#FFE98A]"
                }`}
                aria-label={`เหลือเวลา ${remainingSeconds} วินาที`}
              >
                <span className="text-3xl font-black leading-none tabular-nums">
                  {remainingSeconds}
                </span>
                <span className="text-xs font-bold">วินาที</span>
              </div>
            )}
          </div>

          {turnInfo && (
            <div className="mt-4">
              <div className="h-4 overflow-hidden rounded-full border-[3px] border-[#2B2A4C] bg-white">
                <div
                  className={`h-full transition-[width] duration-100 ${
                    urgent ? "bg-[#FF4D6D]" : "bg-[#9775FA]"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="mt-2 flex justify-between text-xs font-semibold text-[#2B2A4C]/70">
                <span>
                  คิวที่ {turnInfo.turnNumber}/{turnInfo.totalTurns}
                </span>
                <span>เส้นที่วาด {hasSubmitted && isMyTurn ? 1 : 0}/1</span>
              </div>
            </div>
          )}

          <p className="mt-3 text-sm font-semibold text-[#2B2A4C]/80">
            {statusText}
          </p>
        </div>
      )}

      <div className={`${card} p-4 sm:p-6`}>
        {drawingFinished ? (
          <div className="mb-4">
            <h2 className="text-xl font-black">ผลงานของทุกคน 🖼️</h2>
            <p className="mt-1 text-sm font-semibold text-[#2B2A4C]/70">
              ลองดูภาพดีๆ แล้วเดาซิว่าใครวาดแบบไม่รู้คำลับ
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black">กระดานวาดภาพ 🎨</h2>

              <button
                onClick={clearBoard}
                disabled={!socket.connected}
                className={`${btnWhite} px-3 py-2 text-sm`}
              >
                ล้างเส้นของฉัน
              </button>
            </div>

            {/* เครื่องมือวาด */}
            <div
              className={`mb-4 flex flex-wrap items-center gap-4 transition-opacity ${
                canDraw ? "" : "opacity-40"
              }`}
            >
              <div className="flex flex-wrap gap-2">
                {COLORS.map((item) => (
                  <button
                    key={item}
                    disabled={!canDraw}
                    onClick={() => setColor(item)}
                    aria-label={`เลือกสี ${item}`}
                    aria-pressed={color === item}
                    className={`h-9 w-9 rounded-full border-[3px] border-[#2B2A4C] transition focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#B79CFF] ${
                      color === item
                        ? "-translate-y-1 shadow-[0_4px_0_#2B2A4C]"
                        : ""
                    }`}
                    style={{ backgroundColor: item }}
                  />
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm font-bold">
                ขนาดเส้น
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={brushSize}
                  disabled={!canDraw}
                  onChange={(event) =>
                    setBrushSize(Number(event.target.value))
                  }
                  className="accent-[#9775FA]"
                />
                <span className="w-6 tabular-nums">{brushSize}</span>
              </label>
            </div>
          </>
        )}

        {/* Canvas */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            className={`block h-[420px] w-full touch-none rounded-2xl border-[3px] border-[#2B2A4C] bg-white ${
              canDraw ? "cursor-crosshair" : "cursor-default"
            }`}
            style={{
              backgroundImage:
                "radial-gradient(#D6E6F5 1.5px, transparent 1.5px)",
              backgroundSize: "20px 20px",
            }}
          />

          {/* ป้ายสถานะลอยด้านบน ไม่บังภาพที่กำลังวาด */}
          {!drawingFinished && !canDraw && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
              <div className="rounded-full border-[3px] border-[#2B2A4C] bg-white px-4 py-1.5 text-sm font-bold shadow-[3px_3px_0_#2B2A4C]">
                {hasSubmitted ? "วาดเสร็จแล้ว ✨" : "รอคิววาดภาพ ⏳"}
              </div>
            </div>
          )}
        </div>

        {!drawingFinished && (
          <p className="mt-3 text-center text-xs font-semibold text-[#2B2A4C]/60">
            {canDraw
              ? "ลากเมาส์หรือใช้นิ้ววาดได้ 1 เส้น เมื่อปล่อยมือจะจบเทิร์นทันที"
              : "ทุกคนมองเห็นภาพเดียวกัน รอถึงคิวของคุณนะ"}
          </p>
        )}
      </div>
    </section>
  );
}
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { randomInt } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { NestFactory } from '@nestjs/core';

type PlayerRole = 'ARTIST' | 'IMPOSTOR';
// เพิ่ม VOTING (กำลังโหวต) และ RESULT (แสดงผลโหวต)
// เพิ่ม STARTING (หน้าเตรียมตัวนับถอยหลังก่อนเริ่มวาด)
type RoomPhase =
  | 'LOBBY'
  | 'STARTING'
  | 'DRAWING'
  | 'VOTING'
  | 'RESULT'
  | 'FINISHED';

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  role?: PlayerRole;
}

interface GameRoom {
  code: string;
  players: Player[];
  phase: RoomPhase;
  secretWord?: string;

  // ผู้เล่นที่เป็น Impostor (เก็บชื่อไว้ด้วย เผื่อออกจากห้องก่อนเฉลย)
  impostorId?: string;
  impostorName?: string;

  // ระบบผลัดกันวาดหลายรอบ
  turnOrder: string[];
  currentTurnIndex: number;
  currentRound: number;
  totalRounds: number;
  turnTimer?: ReturnType<typeof setTimeout>;

  // ระบบโหวต: voterId -> targetId
  votes: Map<string, string>;
  voteTimer?: ReturnType<typeof setTimeout>;
}

const VOTE_DURATION_MS = 45_000;
const READY_DURATION_MS = 6_000;

const allowedOrigins = (
  process.env.CLIENT_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map((origin) => origin.trim());

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})
export class RoomsGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly rooms = new Map<string, GameRoom>();

  private readonly words = [
    'แมว',
    'สุนัข',
    'จักรยาน',
    'โทรศัพท์',
    'เครื่องบิน',
    'ไอศกรีม',
    'พระจันทร์',
    'ต้นไม้',
    'กีตาร์',
    'หุ่นยนต์',
    'ปลาหมึก',
    'แว่นตา',
    'ร่ม',
    'พิซซ่า',
    'รถไฟ',
  ];

  @SubscribeMessage('create-room')
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { playerName?: string },
  ) {
    const playerName = this.cleanName(payload?.playerName);

    if (!playerName) {
      return this.sendError(client, 'กรุณากรอกชื่อผู้เล่น');
    }

    this.removePlayerFromCurrentRoom(client);

    const code = this.generateRoomCode();

    const room: GameRoom = {
      code,
      phase: 'LOBBY',
      players: [
        {
          id: client.id,
          name: playerName,
          isHost: true,
        },
      ],
      turnOrder: [],
      currentTurnIndex: 0,
      currentRound: 1,
      totalRounds: 3,
      votes: new Map(),
    };

    this.rooms.set(code, room);
    client.data.roomCode = code;
    client.join(code);

    client.emit('room-created', this.toPublicRoom(room));
    this.broadcastRoom(room);
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { roomCode?: string; playerName?: string },
  ) {
    const roomCode = String(payload?.roomCode ?? '')
      .trim()
      .toUpperCase();

    const playerName = this.cleanName(payload?.playerName);

    if (!playerName) {
      return this.sendError(client, 'กรุณากรอกชื่อผู้เล่น');
    }

    const room = this.rooms.get(roomCode);

    if (!room) {
      return this.sendError(client, 'ไม่พบห้องนี้');
    }

    if (room.phase !== 'LOBBY') {
      return this.sendError(client, 'เกมเริ่มไปแล้ว ไม่สามารถเข้าร่วมได้');
    }

    if (room.players.length >= 8) {
      return this.sendError(client, 'ห้องเต็มแล้ว');
    }

    this.removePlayerFromCurrentRoom(client);

    room.players.push({
      id: client.id,
      name: playerName,
      isHost: false,
    });

    client.data.roomCode = roomCode;
    client.join(roomCode);

    client.emit('room-joined', this.toPublicRoom(room));
    this.broadcastRoom(room);
  }

  @SubscribeMessage('start-game')
  handleStartGame(@ConnectedSocket() client: Socket) {
    const roomCode = client.data.roomCode as string | undefined;
    const room = roomCode ? this.rooms.get(roomCode) : undefined;

    if (!room) {
      return this.sendError(client, 'ไม่พบห้องของคุณ');
    }

    const host = room.players.find(
      (player) => player.id === client.id,
    );

    if (!host?.isHost) {
      return this.sendError(client, 'เฉพาะ HOST เท่านั้นที่เริ่มเกมได้');
    }

    if (room.phase !== 'LOBBY') {
      return this.sendError(client, 'เกมเริ่มไปแล้ว');
    }

    if (room.players.length < 3) {
      return this.sendError(client, 'ต้องมีผู้เล่นอย่างน้อย 3 คน');
    }

    const impostorIndex = randomInt(room.players.length);
    const secretWord = this.words[randomInt(this.words.length)];

    // เก็บข้อมูลไว้ใช้ตอนเฉลยผลโหวต
    room.secretWord = secretWord;
    room.impostorId = room.players[impostorIndex].id;
    room.impostorName = room.players[impostorIndex].name;
    room.votes.clear();

    room.players.forEach((player, index) => {
      const role: PlayerRole =
        index === impostorIndex ? 'IMPOSTOR' : 'ARTIST';

      player.role = role;

      this.server.to(player.id).emit('game-started', {
        role,
        secretWord: role === 'ARTIST' ? secretWord : null,
      });
    });

    // เข้าสู่หน้าเตรียมตัวก่อน แล้วค่อยเริ่มวาด 3 รอบ
    room.phase = 'STARTING';
    room.currentRound = 1;
    room.totalRounds = 3;
    room.currentTurnIndex = 0;

    // สร้างลำดับผู้เล่น (สุ่มครั้งเดียว)
    room.turnOrder = room.players.map((player) => player.id);

    for (let i = room.turnOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [room.turnOrder[i], room.turnOrder[j]] = [
        room.turnOrder[j],
        room.turnOrder[i],
      ];
    }

    this.broadcastRoom(room);

    // บอกทุกคนให้นับถอยหลังบนหน้าเตรียมตัว
    this.server.to(room.code).emit('game-starting', {
      endsAt: Date.now() + READY_DURATION_MS,
      duration: READY_DURATION_MS,
    });

    // นับถอยหลังเสร็จ ค่อยเริ่มเทิร์นแรก
    room.turnTimer = setTimeout(() => {
      room.turnTimer = undefined;

      if (room.phase !== 'STARTING') return;

      room.phase = 'DRAWING';
      this.broadcastRoom(room);
      this.startNextTurn(room);
    }, READY_DURATION_MS);
  }

  private startNextTurn(room: GameRoom) {
    // ยกเลิก Timer เก่า
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = undefined;
    }

    if (room.phase !== 'DRAWING') return;

    // ไม่มีผู้เล่นเหลือแล้ว จบเกม
    if (room.players.length === 0) {
      room.phase = 'FINISHED';

      this.server.to(room.code).emit('drawing-finished', {
        message: 'ไม่มีผู้เล่นเหลืออยู่ในห้อง',
      });

      this.broadcastRoom(room);
      return;
    }

    // ข้ามผู้เล่นที่ออกจากห้องไปแล้ว
    while (room.currentTurnIndex < room.turnOrder.length) {
      const playerId = room.turnOrder[room.currentTurnIndex];

      const player = room.players.find(
        (item) => item.id === playerId,
      );

      if (player) break;

      room.currentTurnIndex++;
    }

    // ผู้เล่นในรอบนี้วาดครบแล้ว
    if (room.currentTurnIndex >= room.turnOrder.length) {
      // ครบจำนวนรอบแล้ว เข้าสู่ช่วงโหวต
      if (room.currentRound >= room.totalRounds) {
        this.server.to(room.code).emit('drawing-finished', {
          message: `ผู้เล่นทุกคนวาดครบ ${room.totalRounds} รอบแล้ว`,
          totalRounds: room.totalRounds,
        });

        this.startVoting(room);
        return;
      }

      // เริ่มรอบถัดไป
      room.currentRound++;
      room.currentTurnIndex = 0;

      this.server.to(room.code).emit('round-started', {
        currentRound: room.currentRound,
        totalRounds: room.totalRounds,
      });

      this.broadcastRoom(room);

      // เริ่มเทิร์นแรกของรอบใหม่
      this.startNextTurn(room);
      return;
    }

    const playerId = room.turnOrder[room.currentTurnIndex];

    const player = room.players.find(
      (item) => item.id === playerId,
    );

    if (!player) return;

    const duration = 15_000;
    const endsAt = Date.now() + duration;

    // แจ้งทุกคนว่าใครกำลังวาด พร้อมส่งข้อมูลรอบปัจจุบัน
    this.server.to(room.code).emit('turn-started', {
      playerId,
      playerName: player.name,
      turnNumber: room.currentTurnIndex + 1,
      totalTurns: room.turnOrder.length,
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      endsAt,
      duration,
    });

    const currentIndex = room.currentTurnIndex;
    const currentRound = room.currentRound;

    // หมดเวลาแล้วข้ามไปคนถัดไป
    room.turnTimer = setTimeout(() => {
      if (room.phase !== 'DRAWING') return;

      if (room.currentTurnIndex !== currentIndex) return;
      if (room.currentRound !== currentRound) return;

      room.currentTurnIndex++;
      this.startNextTurn(room);
    }, duration);
  }

  @SubscribeMessage('draw-stroke')
  handleDrawStroke(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      color?: string;
      width?: number;
      points?: { x: number; y: number }[];
    },
  ) {
    const roomCode = client.data.roomCode as string | undefined;
    const room = roomCode ? this.rooms.get(roomCode) : undefined;

    if (!roomCode || !room || room.phase !== 'DRAWING') return;

    // ตรวจสอบว่าเป็นเทิร์นของผู้เล่นคนนี้
    const currentPlayerId = room.turnOrder[room.currentTurnIndex];

    if (currentPlayerId !== client.id) return;

    const color = String(payload?.color ?? '#ffffff');
    const width = Number(payload?.width);
    const points = payload?.points;

    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
    if (!Number.isFinite(width) || width < 1 || width > 30) return;

    if (
      !Array.isArray(points) ||
      points.length < 1 ||
      points.length > 1000
    ) {
      return;
    }

    const validPoints = points.every(
      (point) =>
        point &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        point.x >= 0 &&
        point.x <= 1 &&
        point.y >= 0 &&
        point.y <= 1,
    );

    if (!validPoints) return;

    // ส่งเส้นให้ผู้เล่นทุกคน รวมถึงคนวาด พร้อมระบุหมายเลขรอบ
    this.server.to(roomCode).emit('stroke-drawn', {
      id: client.id,
      color,
      width,
      points,
      round: room.currentRound,
    });

    // วาดครบ 1 เส้น ส่งต่อเทิร์นทันที
    room.currentTurnIndex++;

    this.startNextTurn(room);
  }

  @SubscribeMessage('clear-board')
  handleClearBoard(@ConnectedSocket() client: Socket) {
    const roomCode = client.data.roomCode as string | undefined;
    const room = roomCode ? this.rooms.get(roomCode) : undefined;

    if (!roomCode || !room || room.phase !== 'DRAWING') return;

    const player = room.players.find(
      (player) => player.id === client.id,
    );

    if (!player) return;

    this.server.to(roomCode).emit('player-board-cleared', {
      playerId: client.id,
    });
  }

  // ======================================================================
  // ระบบโหวตหา Impostor
  // ======================================================================

  /** เริ่มช่วงโหวต (เรียกเมื่อวาดครบทุกรอบ) */
  private startVoting(room: GameRoom) {
    this.clearTimers(room);

    room.phase = 'VOTING';
    room.votes.clear();

    const duration = VOTE_DURATION_MS;
    const endsAt = Date.now() + duration;

    this.server.to(room.code).emit('voting-started', {
      endsAt,
      duration,
      candidates: room.players.map((player) => ({
        id: player.id,
        name: player.name,
      })),
    });

    this.broadcastRoom(room);
    this.emitVoteProgress(room);

    // หมดเวลาโหวต สรุปผลจากโหวตที่มีอยู่
    room.voteTimer = setTimeout(() => {
      this.finishVoting(room);
    }, duration);
  }

  @SubscribeMessage('cast-vote')
  handleCastVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { targetId?: string },
  ) {
    const roomCode = client.data.roomCode as string | undefined;
    const room = roomCode ? this.rooms.get(roomCode) : undefined;

    if (!room) {
      return this.sendError(client, 'ไม่พบห้องของคุณ');
    }

    if (room.phase !== 'VOTING') {
      return this.sendError(client, 'ยังไม่อยู่ในช่วงโหวต');
    }

    const voter = room.players.find(
      (player) => player.id === client.id,
    );

    if (!voter) return;

    const targetId = String(payload?.targetId ?? '');

    if (targetId === client.id) {
      return this.sendError(client, 'ไม่สามารถโหวตตัวเองได้');
    }

    if (!room.players.some((player) => player.id === targetId)) {
      return this.sendError(client, 'ไม่พบผู้เล่นที่คุณเลือก');
    }

    // เปลี่ยนใจได้จนกว่าทุกคนจะโหวตครบหรือหมดเวลา
    room.votes.set(client.id, targetId);

    client.emit('vote-accepted', { targetId });
    this.emitVoteProgress(room);

    // ทุกคนโหวตครบแล้ว สรุปผลทันที
    if (room.votes.size >= room.players.length) {
      this.finishVoting(room);
    }
  }

  /** บอกทุกคนว่าใครโหวตแล้วบ้าง (ไม่บอกว่าโหวตใคร) */
  private emitVoteProgress(room: GameRoom) {
    this.server.to(room.code).emit('vote-progress', {
      votedIds: Array.from(room.votes.keys()),
      total: room.players.length,
    });
  }

  /** นับคะแนน ตัดสินผู้ชนะ และเฉลยบทบาททั้งหมด */
  private finishVoting(room: GameRoom) {
    if (room.phase !== 'VOTING') return;

    if (room.voteTimer) {
      clearTimeout(room.voteTimer);
      room.voteTimer = undefined;
    }

    const nameOf = (id: string) =>
      room.players.find((player) => player.id === id)?.name ??
      'ผู้เล่นที่ออกไปแล้ว';

    // นับคะแนน
    const counts = new Map<string, number>();

    for (const targetId of room.votes.values()) {
      counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
    }

    const tally = room.players
      .map((player) => ({
        playerId: player.id,
        name: player.name,
        votes: counts.get(player.id) ?? 0,
      }))
      .sort((a, b) => b.votes - a.votes);

    const topVotes = tally[0]?.votes ?? 0;
    const leaders = tally.filter((item) => item.votes === topVotes);

    // มีคนคะแนนสูงสุดคนเดียวเท่านั้นถึงจะถูกจับ
    // ถ้าเสมอหรือไม่มีใครโหวตเลย ถือว่าจับไม่ได้
    const isTie = topVotes === 0 || leaders.length > 1;
    const accused = isTie ? null : leaders[0];

    const impostorStillInRoom = room.players.some(
      (player) => player.id === room.impostorId,
    );

    // Artist ชนะเมื่อจับ Impostor ได้ (หรือ Impostor หนีออกจากห้อง)
    const winner: 'ARTISTS' | 'IMPOSTOR' =
      !impostorStillInRoom || accused?.playerId === room.impostorId
        ? 'ARTISTS'
        : 'IMPOSTOR';

    room.phase = 'RESULT';

    this.server.to(room.code).emit('voting-result', {
      tally,
      votes: Array.from(room.votes.entries()).map(
        ([voterId, targetId]) => ({
          voterId,
          voterName: nameOf(voterId),
          targetId,
          targetName: nameOf(targetId),
        }),
      ),
      isTie,
      accusedId: accused?.playerId ?? null,
      accusedName: accused?.name ?? null,
      impostorId: room.impostorId ?? null,
      impostorName: room.impostorName ?? null,
      impostorLeft: !impostorStillInRoom,
      secretWord: room.secretWord ?? null,
      winner,
    });

    this.broadcastRoom(room);
  }

  /** HOST กดเล่นอีกครั้ง: รีเซ็ตห้องกลับไปที่ Lobby */
  @SubscribeMessage('play-again')
  handlePlayAgain(@ConnectedSocket() client: Socket) {
    const roomCode = client.data.roomCode as string | undefined;
    const room = roomCode ? this.rooms.get(roomCode) : undefined;

    if (!room) {
      return this.sendError(client, 'ไม่พบห้องของคุณ');
    }

    const host = room.players.find(
      (player) => player.id === client.id,
    );

    if (!host?.isHost) {
      return this.sendError(client, 'เฉพาะ HOST เท่านั้นที่เริ่มเกมใหม่ได้');
    }

    if (room.phase !== 'RESULT' && room.phase !== 'FINISHED') {
      return this.sendError(client, 'เกมยังไม่จบ');
    }

    this.clearTimers(room);

    room.phase = 'LOBBY';
    room.secretWord = undefined;
    room.impostorId = undefined;
    room.impostorName = undefined;
    room.turnOrder = [];
    room.currentTurnIndex = 0;
    room.currentRound = 1;
    room.votes.clear();

    room.players.forEach((player) => {
      delete player.role;
    });

    this.server.to(room.code).emit('game-reset');
    this.broadcastRoom(room);
  }

  handleDisconnect(client: Socket) {
    this.removePlayerFromCurrentRoom(client);
  }

  private clearTimers(room: GameRoom) {
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = undefined;
    }

    if (room.voteTimer) {
      clearTimeout(room.voteTimer);
      room.voteTimer = undefined;
    }
  }

  private cleanName(value?: string): string {
    return String(value ?? '').trim().slice(0, 20);
  }

  private generateRoomCode(): string {
    let code = '';

    do {
      code = randomInt(0, 36 ** 6)
        .toString(36)
        .toUpperCase()
        .padStart(6, '0');
    } while (this.rooms.has(code));

    return code;
  }

  private toPublicRoom(room: GameRoom) {
    return {
      code: room.code,
      phase: room.phase,
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
        isHost: player.isHost,
      })),
      playerCount: room.players.length,
      maxPlayers: 8,
    };
  }

  private broadcastRoom(room: GameRoom) {
    this.server.to(room.code).emit(
      'room-updated',
      this.toPublicRoom(room),
    );
  }

  private sendError(client: Socket, message: string) {
    client.emit('room-error', { message });
  }

  private removePlayerFromCurrentRoom(client: Socket) {
    const roomCode = client.data.roomCode as string | undefined;

    if (!roomCode) return;

    const room = this.rooms.get(roomCode);

    client.leave(roomCode);
    delete client.data.roomCode;

    if (!room) return;

    const oldTurnIndex = room.turnOrder.indexOf(client.id);
    const wasCurrentTurn =
      oldTurnIndex === room.currentTurnIndex;

    if (oldTurnIndex !== -1) {
      room.turnOrder.splice(oldTurnIndex, 1);

      if (oldTurnIndex < room.currentTurnIndex) {
        room.currentTurnIndex--;
      }

      if (wasCurrentTurn && room.turnTimer) {
        clearTimeout(room.turnTimer);
        room.turnTimer = undefined;
      }
    }

    room.players = room.players.filter(
      (player) => player.id !== client.id,
    );

    if (room.players.length === 0) {
      this.clearTimers(room);
      this.rooms.delete(roomCode);
      return;
    }

    if (!room.players.some((player) => player.isHost)) {
      room.players[0].isHost = true;
    }

    if (wasCurrentTurn && room.phase === 'DRAWING') {
      this.startNextTurn(room);
    }

    // ผู้เล่นออกระหว่างโหวต: ลบโหวตที่เกี่ยวข้อง แล้วตรวจว่าควรจบการโหวตหรือยัง
    if (room.phase === 'VOTING') {
      room.votes.delete(client.id);

      for (const [voterId, targetId] of room.votes) {
        if (targetId === client.id) {
          room.votes.delete(voterId);
        }
      }

      const impostorLeft = client.id === room.impostorId;
      const everyoneVoted =
        room.votes.size >= room.players.length;

      if (impostorLeft || room.players.length < 2 || everyoneVoted) {
        this.finishVoting(room);
        return;
      }

      this.emitVoteProgress(room);
    }

    this.broadcastRoom(room);
  }
}
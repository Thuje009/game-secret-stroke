# Secret Stroke ✏️

เกมวาดภาพออนไลน์แบบหลายคน ผลัดกันวาดคนละเส้น แล้วช่วยกันจับว่าใครคือ **Impostor** (คนที่ไม่รู้คำลับ)

## วิธีเล่น

1. คนหนึ่งสร้างห้อง แล้วส่งรหัสห้อง 6 ตัวให้เพื่อน (เล่นได้ 3-8 คน)
2. HOST กดเริ่มเกม ระบบสุ่มให้ 1 คนเป็น **Impostor** ส่วนที่เหลือเป็น **Artist**
   - Artist เห็นคำลับ เช่น "แมว" "จักรยาน"
   - Impostor ไม่เห็นคำลับ ต้องวาดให้เนียนเหมือนรู้
3. ผลัดกันวาดคนละ **1 เส้น** ตาละ **15 วินาที** ทั้งหมด **3 รอบ**
4. วาดครบแล้วทุกคนโหวตว่าใครคือ Impostor (เวลา 45 วินาที)
5. เฉลยผล แสดงคะแนนโหวต คำลับ และทีมที่ชนะ จากนั้น HOST กด "เล่นอีกครั้ง" ได้

### กติกาตัดสิน

| สถานการณ์ | ผู้ชนะ |
| --- | --- |
| Impostor ได้คะแนนโหวตสูงสุดเพียงคนเดียว | Artist |
| โหวตผิดคน | Impostor |
| โหวตเสมอ หรือไม่มีใครโหวต | Impostor |
| Impostor ออกจากเกมระหว่างเล่น | Artist |

## ลำดับหน้าจอ

เข้าห้อง → Lobby → เตรียมตัว (นับถอยหลัง 6 วินาที) → วาด → โหวต → ผลชนะ → (เล่นอีกครั้ง) กลับ Lobby

## เทคโนโลยีที่ใช้

- **Frontend:** Next.js, React, Tailwind CSS, socket.io-client
- **Backend:** NestJS, WebSocket Gateway (socket.io)
- **Package manager:** pnpm (monorepo)

## โครงสร้างโปรเจกต์

```
secret-stroke/
├── apps/
│   ├── web/                      # Frontend (Next.js)
│   │   └── src/components/
│   │       ├── lobby.tsx         # ตัวควบคุมหลัก เชื่อม socket และสลับหน้าจอ
│   │       ├── ready-screen.tsx  # หน้าเตรียมตัวก่อนเริ่มเกม
│   │       ├── drawing-board.tsx # กระดานวาดภาพ
│   │       ├── voting-panel.tsx  # หน้าโหวต
│   │       ├── result-screen.tsx # หน้าแสดงผลชนะ
│   │       └── ui.tsx            # สไตล์กลางและไอคอนผู้เล่น
│   └── server/                   # Backend (NestJS)
│       └── src/.../rooms.gateway.ts
└── README.md
```

> ชื่อโฟลเดอร์ฝั่ง Backend อาจต่างจากนี้ ให้ปรับตามที่ใช้จริง

## เริ่มใช้งาน

### สิ่งที่ต้องมี

- Node.js
- pnpm

### ติดตั้ง

```bash
pnpm install
```

### ตั้งค่า Environment

สร้างไฟล์ `apps/web/.env.local`

```env
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
```

ถ้าไม่ตั้งค่า ระบบจะใช้ `http://localhost:3001` เป็นค่าเริ่มต้น

### รัน

เปิด 2 เทอร์มินัล

```bash
# เทอร์มินัล 1: Backend (พอร์ต 3001)
pnpm --filter <ชื่อแพ็กเกจ server> start:dev

# เทอร์มินัล 2: Frontend (พอร์ต 3000)
pnpm --filter web dev
```

จากนั้นเปิด <http://localhost:3000> เปิดหลายแท็บเพื่อลองเล่นคนเดียวได้ (ต้องมีอย่างน้อย 3 แท็บ)

### Build

```bash
pnpm --filter web build
```

## Socket Events

### Client → Server

| Event | ข้อมูล | หน้าที่ |
| --- | --- | --- |
| `create-room` | `{ playerName }` | สร้างห้องใหม่ |
| `join-room` | `{ roomCode, playerName }` | เข้าห้อง |
| `start-game` | - | HOST เริ่มเกม |
| `draw-stroke` | `{ color, width, points }` | ส่งเส้นที่วาด (เฉพาะตาตัวเอง) |
| `clear-board` | - | ล้างเส้นของตัวเอง |
| `cast-vote` | `{ targetId }` | โหวตผู้เล่น |
| `play-again` | - | HOST เริ่มเกมใหม่ |

### Server → Client

| Event | หน้าที่ |
| --- | --- |
| `room-created`, `room-joined`, `room-updated` | สถานะห้อง |
| `room-error` | ข้อความผิดพลาด |
| `game-started` | แจ้งบทบาทและคำลับ (ส่งเฉพาะคนนั้น) |
| `game-starting` | เริ่มนับถอยหลังหน้าเตรียมตัว |
| `turn-started`, `round-started` | แจ้งเทิร์นและรอบการวาด |
| `stroke-drawn`, `player-board-cleared` | อัปเดตกระดาน |
| `drawing-finished` | วาดครบทุกรอบ |
| `voting-started`, `vote-progress`, `vote-accepted` | ช่วงโหวต |
| `voting-result` | ผลโหวตและการเฉลย |
| `game-reset` | กลับไป Lobby |

## ปรับแต่งเกม

ค่าที่แก้ได้ใน `rooms.gateway.ts`

| ค่า | ความหมาย | ค่าปัจจุบัน |
| --- | --- | --- |
| `READY_DURATION_MS` | เวลาหน้าเตรียมตัว | 6 วินาที |
| `VOTE_DURATION_MS` | เวลาโหวต | 45 วินาที |
| `totalRounds` | จำนวนรอบการวาด | 3 รอบ |
| `duration` ใน `startNextTurn` | เวลาต่อเทิร์น | 15 วินาที |
| `words` | รายการคำลับ | 15 คำ |

หมายเหตุ: ห้องเก็บอยู่ในหน่วยความจำของ Server ถ้ารีสตาร์ท Server ห้องที่เล่นอยู่จะหายทั้งหมด


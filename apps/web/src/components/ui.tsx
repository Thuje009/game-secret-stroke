// สไตล์กลางของธีมสติกเกอร์สีพาสเทล: ขอบหมึกหนา + เงาทึบเยื้อง
// ใช้ร่วมกันทุกหน้า เพื่อให้หน้าตาเหมือนกันทั้งเกม

export const card =
  "rounded-[28px] border-[3px] border-[#2B2A4C] bg-white shadow-[6px_6px_0_#2B2A4C]";

export const input =
  "w-full rounded-2xl border-[3px] border-[#2B2A4C] bg-white px-4 py-3 text-base font-semibold text-[#2B2A4C] outline-none transition placeholder:text-[#2B2A4C]/40 focus:bg-[#FFF9D6] focus-visible:ring-4 focus-visible:ring-[#B79CFF]/60";

const btn =
  "rounded-2xl border-[3px] border-[#2B2A4C] font-bold text-[#2B2A4C] shadow-[4px_4px_0_#2B2A4C] transition active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-[4px_4px_0_#2B2A4C] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#B79CFF]";

export const btnPink = `${btn} bg-[#FF8FB8] hover:bg-[#ff7aab]`;
export const btnYellow = `${btn} bg-[#FFD93D] hover:bg-[#ffcf1f]`;
export const btnMint = `${btn} bg-[#6BE3B0] hover:bg-[#53d89f]`;
export const btnWhite = `${btn} bg-white hover:bg-[#FFF9D6]`;

export const sticker =
  "inline-flex items-center gap-1 rounded-full border-[3px] border-[#2B2A4C] px-3 py-1 text-sm font-bold text-[#2B2A4C]";

const AVATAR_EMOJI = ["🐱", "🐶", "🐰", "🐻", "🐼", "🦊", "🐸", "🐥"];
const AVATAR_BG = [
  "#FF8FB8",
  "#FFD93D",
  "#6BE3B0",
  "#7CC6FF",
  "#B79CFF",
  "#FFB38A",
  "#C5E86C",
  "#F9B8DA",
];

const AVATAR_SIZE = {
  sm: "h-8 w-8 text-lg",
  md: "h-11 w-11 text-2xl",
  lg: "h-16 w-16 text-4xl",
};

/** ไอคอนสัตว์น่ารักประจำผู้เล่น ตามลำดับในห้อง */
export function Avatar({
  index,
  size = "md",
}: {
  index: number;
  size?: keyof typeof AVATAR_SIZE;
}) {
  const i = index < 0 ? 0 : index % AVATAR_EMOJI.length;

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-[3px] border-[#2B2A4C] ${AVATAR_SIZE[size]}`}
      style={{ backgroundColor: AVATAR_BG[i] }}
    >
      {AVATAR_EMOJI[i]}
    </span>
  );
}
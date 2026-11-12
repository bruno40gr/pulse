/** Shared quarter-hour placement for enrollment availability and booked schedules. */
export function placeCalendarBlocks<T extends { time: string; duration: number; booked: boolean }>(blocks: readonly T[], startMinutes = 14 * 60) {
  const ends: number[] = []
  const placed = [...blocks].sort((a, b) => a.time.localeCompare(b.time) || Number(b.booked) - Number(a.booked)).map(block => {
    const row = (Number(block.time.slice(0, 2)) * 60 + Number(block.time.slice(3)) - startMinutes) / 15
    let lane = ends.findIndex(end => end <= row)
    if (lane === -1) lane = ends.length
    ends[lane] = row + block.duration / 15
    return { ...block, row, lane }
  })
  return { blocks: placed, lanes: Math.max(1, ends.length) }
}
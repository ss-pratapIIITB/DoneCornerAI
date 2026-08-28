export function stickToTranscriptBottom(
  el: { scrollHeight: number; scrollTop: number; clientHeight: number },
  slop = 72,
): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= slop;
}

export function transcriptScrollBehavior(
  status: string,
  reduceMotion: boolean,
): ScrollBehavior {
  if (reduceMotion || status === "running") return "auto";
  return "smooth";
}

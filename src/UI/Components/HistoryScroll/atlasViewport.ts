/** Presentation pixels only: keep the frozen world's aspect ratio at every zoom. */
export function fitAtlasViewport(widthCells: number, heightCells: number, availableWidth: number, availableHeight: number, zoom = 1) {
  const scale = Math.min(Math.max(0, availableWidth) / widthCells, Math.max(0, availableHeight) / heightCells);
  const width = widthCells * scale * zoom, height = heightCells * scale * zoom;
  return { width, height, scrollable: zoom > 1 && (width > availableWidth || height > availableHeight) };
}

/** Scroll only the axis itself; never scroll a dialog ancestor into view. */
export function revealAtlasAxisItem(axis: { scrollLeft: number; clientWidth: number }, item: { offsetLeft: number; offsetWidth: number }) {
  if (item.offsetLeft < axis.scrollLeft) axis.scrollLeft = item.offsetLeft;
  else if (item.offsetLeft + item.offsetWidth > axis.scrollLeft + axis.clientWidth)
    axis.scrollLeft = item.offsetLeft + item.offsetWidth - axis.clientWidth;
}

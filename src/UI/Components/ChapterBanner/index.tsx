import { Box, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import {
  ChapterBannerItem,
  createChapterBannerForEvent,
  enqueueChapterBanner,
} from "../../../History/ChapterBannerRules";
import WorldHistory from "../../../History/WorldHistory";
import { RootState } from "../../../store";

const BANNER_VISIBLE_MS = 3200;
const BANNER_FADE_MS = 500;

export default function ChapterBanner() {
  const catchUpActive = useSelector(
    (state: RootState) => state.root.backgroundCatchUpActive
  );
  const seenIds = useRef(new Set<string>());
  const currentRef = useRef<ChapterBannerItem | undefined>();
  const catchUpActiveRef = useRef(false);
  const catchUpBufferRef = useRef<ChapterBannerItem[]>([]);
  const initializedRef = useRef(false);
  const [current, setCurrent] = useState<ChapterBannerItem>();
  const [pending, setPending] = useState<ChapterBannerItem[]>([]);
  const teams = useSelector((state: RootState) => state.root.teams);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    const wasActive = catchUpActiveRef.current;
    catchUpActiveRef.current = catchUpActive;
    if (wasActive && !catchUpActive && catchUpBufferRef.current.length > 0) {
      const compacted = catchUpBufferRef.current
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 3);
      catchUpBufferRef.current = [];
      setPending((items) =>
        compacted.reduce(
          (nextItems, banner) =>
            enqueueChapterBanner(currentRef.current, nextItems, banner, 3),
          items
        )
      );
    }
  }, [catchUpActive]);

  useEffect(
    () =>
      WorldHistory.subscribe((events) => {
        if (!initializedRef.current) {
          events.forEach((event) => seenIds.current.add(event.id));
          initializedRef.current = true;
          return;
        }
        const unseen = events
          .filter((event) => !seenIds.current.has(event.id))
          .sort((a, b) => (a.monthIndex ?? a.year) - (b.monthIndex ?? b.year));
        unseen.forEach((event) => {
          seenIds.current.add(event.id);
          const factionById = new Map(teams.map((team) => [team.name, team]));
          const banner = createChapterBannerForEvent(event, factionById);
          if (!banner) {
            return;
          }
          if (catchUpActiveRef.current) {
            catchUpBufferRef.current = enqueueChapterBanner(
              undefined,
              catchUpBufferRef.current,
              banner,
              3
            );
            return;
          }
          setPending((items) =>
            enqueueChapterBanner(currentRef.current, items, banner)
          );
        });
      }),
    []
  );

  useEffect(() => {
    if (current || pending.length === 0) {
      return;
    }
    const [next, ...rest] = pending;
    setPending(rest);
    setFading(false);
    setCurrent(next);
  }, [current, pending]);

  useEffect(() => {
    if (!current) {
      return;
    }
    const fadeTimer = window.setTimeout(() => setFading(true), BANNER_VISIBLE_MS);
    const clearTimer = window.setTimeout(
      () => setCurrent(undefined),
      BANNER_VISIBLE_MS + BANNER_FADE_MS
    );
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [current]);

  if (!current) {
    return null;
  }

  return (
    <Box
      sx={{
        position: "absolute",
        top: 18,
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "none",
        zIndex: 20,
        opacity: fading ? 0 : 1,
        transition: `opacity ${BANNER_FADE_MS}ms ease`,
        px: 2,
        py: 0.75,
        border: "1px solid rgba(138,90,0,0.35)",
        background: "rgba(255, 250, 230, 0.92)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
        borderRadius: "var(--gg-radius)",
      }}
    >
      <Typography fontWeight="bold" fontSize="1rem">
        {current.text}
      </Typography>
    </Box>
  );
}

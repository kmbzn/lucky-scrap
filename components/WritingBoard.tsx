"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Stroke } from "@/lib/handwriting";
import {
  BOARD_PIXELS,
  LOGICAL_SIZE,
  boardPoint,
  paintPixelStroke,
  type PixelPoint,
} from "@/lib/pixel-brush";
export type WritingBoardHandle = {
  clear: () => void;
  getStrokes: () => Stroke[];
};
const WritingBoard = forwardRef<WritingBoardHandle, { letter: string }>(
  function WritingBoard({ letter }, ref) {
    const canvas = useRef<HTMLCanvasElement>(null),
      strokes = useRef<Stroke[]>([]);
    useImperativeHandle(
      ref,
      () => ({
        clear() {
          canvas.current
            ?.getContext("2d")
            ?.clearRect(0, 0, BOARD_PIXELS, BOARD_PIXELS);
          strokes.current = [];
        },
        getStrokes: () => strokes.current,
      }),
      [],
    );
    useEffect(() => {
      const node = canvas.current!;
      const ctx = node.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      let mode: "touch" | "pointer" | null = null,
        activeId: number | null = null,
        previous: PixelPoint | null = null,
        started = 0;
      let pointCount = 0;
      const touchEventsSupported = "ontouchstart" in window;
      function block(event: Event) {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
      }
      function record(point: PixelPoint, time: number) {
        const stroke = strokes.current[strokes.current.length - 1];
        if (pointCount >= 6000 || stroke.length >= 2000) return;
        stroke.push({
          x: (point.x / BOARD_PIXELS) * LOGICAL_SIZE,
          y: (point.y / BOARD_PIXELS) * LOGICAL_SIZE,
          t: Math.max(0, time - started),
        });
        pointCount++;
      }
      function begin(x: number, y: number, time: number) {
        if (!strokes.current.length) {
          started = time;
          pointCount = 0;
        }
        if (strokes.current.length >= 40) return false;
        const point = boardPoint(x, y, node.getBoundingClientRect());
        strokes.current.push([]);
        record(point, time);
        paintPixelStroke(ctx, point, point);
        previous = point;
        return true;
      }
      function move(x: number, y: number, time: number) {
        if (!previous) return;
        const point = boardPoint(x, y, node.getBoundingClientRect());
        paintPixelStroke(ctx, previous, point);
        record(point, time);
        previous = point;
      }
      function end() {
        mode = null;
        activeId = null;
        previous = null;
      }
      function touchStart(event: TouchEvent) {
        block(event);
        if (mode !== null) return;
        const touch = event.changedTouches[0];
        if (touch && begin(touch.clientX, touch.clientY, event.timeStamp)) {
          mode = "touch";
          activeId = touch.identifier;
        }
      }
      function touchMove(event: TouchEvent) {
        block(event);
        if (mode !== "touch") return;
        const touch = Array.from(event.touches).find(
          (t) => t.identifier === activeId,
        );
        if (touch) move(touch.clientX, touch.clientY, event.timeStamp);
      }
      function touchEnd(event: TouchEvent) {
        block(event);
        if (
          mode === "touch" &&
          Array.from(event.changedTouches).some(
            (t) => t.identifier === activeId,
          )
        )
          end();
      }
      function pointerDown(event: PointerEvent) {
        if (event.pointerType === "touch" && touchEventsSupported) return;
        if (mode !== null || event.button !== 0) return;
        block(event);
        if (begin(event.clientX, event.clientY, event.timeStamp)) {
          mode = "pointer";
          activeId = event.pointerId;
          try {
            node.setPointerCapture(event.pointerId);
          } catch {
            /* Legacy embedded browsers may not support pointer capture. */
          }
        }
      }
      function pointerMove(event: PointerEvent) {
        if (mode !== "pointer" || event.pointerId !== activeId) return;
        block(event);
        const samples = event.getCoalescedEvents?.() || [];
        for (const sample of samples.length ? samples : [event])
          move(sample.clientX, sample.clientY, sample.timeStamp);
      }
      function pointerEnd(event: PointerEvent) {
        if (mode === "pointer" && event.pointerId === activeId) {
          block(event);
          end();
        }
      }
      const options = { passive: false, capture: true };
      node.addEventListener("touchstart", touchStart, options);
      node.addEventListener("touchmove", touchMove, options);
      node.addEventListener("touchend", touchEnd, options);
      node.addEventListener("touchcancel", touchEnd, options);
      node.addEventListener("pointerdown", pointerDown, options);
      node.addEventListener("pointermove", pointerMove, options);
      node.addEventListener("pointerup", pointerEnd, options);
      node.addEventListener("pointercancel", pointerEnd, options);
      node.addEventListener("lostpointercapture", pointerEnd, options);
      node.addEventListener("contextmenu", block, options);
      return () => {
        node.removeEventListener("touchstart", touchStart, true);
        node.removeEventListener("touchmove", touchMove, true);
        node.removeEventListener("touchend", touchEnd, true);
        node.removeEventListener("touchcancel", touchEnd, true);
        node.removeEventListener("pointerdown", pointerDown, true);
        node.removeEventListener("pointermove", pointerMove, true);
        node.removeEventListener("pointerup", pointerEnd, true);
        node.removeEventListener("pointercancel", pointerEnd, true);
        node.removeEventListener("lostpointercapture", pointerEnd, true);
        node.removeEventListener("contextmenu", block, true);
      };
    }, []);
    return (
      <canvas
        ref={canvas}
        width={BOARD_PIXELS}
        height={BOARD_PIXELS}
        aria-label={`${letter} 쓰기 입력 영역`}
        style={{ touchAction: "none", imageRendering: "pixelated" }}
      />
    );
  },
);
export default WritingBoard;

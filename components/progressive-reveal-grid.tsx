"use client";

import { Fragment, useCallback, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  gridClassName: string;
  /** Items shown before first “See more”. Default 3. */
  initialVisible?: number;
  /** How many extra items each “See more” reveals. Default 3. */
  step?: number;
  controlsClassName?: string;
};

export function ProgressiveRevealGrid<T>({
  items,
  getKey,
  renderItem,
  gridClassName,
  initialVisible = 3,
  step = 3,
  controlsClassName
}: Props<T>) {
  const [visibleCount, setVisibleCount] = useState(initialVisible);
  const total = items.length;
  const effective = Math.min(visibleCount, total);
  const canShowMore = effective < total;
  const canShowLess = total > initialVisible && effective === total;

  const onShowMore = useCallback(() => {
    setVisibleCount((v) => Math.min(v + step, total));
  }, [step, total]);

  const onShowLess = useCallback(() => {
    setVisibleCount(initialVisible);
  }, [initialVisible]);

  if (total === 0) return null;

  const displayed = items.slice(0, effective);

  return (
    <>
      <div className={gridClassName}>
        {displayed.map((item) => (
          <Fragment key={getKey(item)}>{renderItem(item)}</Fragment>
        ))}
      </div>
      {canShowMore || canShowLess ? (
        <div className={cn("mt-4 flex justify-center sm:justify-start", controlsClassName)}>
          {canShowMore ? (
            <button
              type="button"
              onClick={onShowMore}
              className="inline-flex min-h-[40px] items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-teal underline-offset-4 transition hover:text-teal-hover hover:underline"
            >
              See more
            </button>
          ) : (
            <button
              type="button"
              onClick={onShowLess}
              className="inline-flex min-h-[40px] items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50 underline-offset-4 transition hover:text-white/75 hover:underline"
            >
              Show less
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}

import type { ReactNode } from 'react';
import { toDay } from './dates';
import type { BidBoardData } from './bidBoardTypes';

// BidBoard — T19. Sealed-state banner until close; after close the board
// (children: PIVOT matrix, score cards, award dialog) renders.
// While sealed the ONLY number on the page is the count of bids received,
// taken from rfq_invitations.status — no prices, no names, no scores.
// All dates render as wall-clock Y-m-d only.

export interface BidBoardProps {
  data: BidBoardData;
  children: ReactNode;
}

export default function BidBoard({ data, children }: BidBoardProps) {
  const { rfq, sealed, receivedCount } = data;
  return (
    <div data-testid="bid-board">
      <header>
        <h1 className="text-2xl font-bold">
          {rfq.rfq_number} — {rfq.title}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Status {rfq.status} · {rfq.currency}
          {rfq.bid_deadline ? ` · bids due ${toDay(rfq.bid_deadline)}` : ''}
          {rfq.target_delivery_date ? ` · target delivery ${toDay(rfq.target_delivery_date)}` : ''}
        </p>
      </header>

      {sealed ? (
        <p data-testid="bid-board-sealed" className="mt-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium">
          Sealed — {receivedCount} bid{receivedCount === 1 ? '' : 's'} received. Prices and supplier names stay
          hidden until the RFQ closes.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          <p data-testid="bid-board-unsealed" className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm">
            Bidding closed — {data.bids.length} bid{data.bids.length === 1 ? '' : 's'} to compare.
          </p>
          {children}
        </div>
      )}
    </div>
  );
}

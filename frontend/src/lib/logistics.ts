import { Booking } from './types';

export type LogisticsType =
  | 'YOU_DELIVER'        // Lender delivers to borrower
  | 'DOORSTEP_DELIVERY'   // Borrower receives delivery from lender
  | 'YOU_PICKUP'         // Borrower travels to pick up from lender
  | 'RENTER_PICKUP';     // Lender hosts borrower at their location

export interface LogisticsInfo {
  type: LogisticsType;
  badgeText: string;
  actionSummary: string;
  badgeClass: string;
  dotClass: string;
  borderClass: string;
  bgClass: string;
  textColor: string;
  pickupLabel: string;
  pickupDotClass: string;
  returnLabel: string;
  returnDotClass: string;
}

export interface DayLogisticsStatus {
  kind: 'PICKUP' | 'RETURN' | 'SAME_DAY' | 'IN_USE';
  tag: string;
  dotColor: string;
  badgeClass: string;
  cellClass: string;
  title: string;
}

export function checkIsLender(booking: Booking, user: any): boolean {
  if (!booking || !user) return false;
  return Boolean(
    (booking.lender_id && (booking.lender_id === user.id || booking.lender_id === user.firebase_uid)) ||
    (booking.lender_name && user.name && booking.lender_name.trim().toLowerCase() === user.name.trim().toLowerCase())
  );
}

export function getBookingLogisticsInfo(booking: Booking, isLender: boolean): LogisticsInfo {
  const requiresDelivery = Boolean(
    booking.requires_delivery ||
    booking.pickup_type === 'MY_LOCATION' ||
    (booking as any).delivery_option === 'LENDER_DELIVERY'
  );

  const requiresOwnerPickup = Boolean(
    booking.requires_pickup ||
    booking.return_type === 'MY_LOCATION'
  );

  if (isLender) {
    if (requiresDelivery) {
      return {
        type: 'YOU_DELIVER',
        badgeText: '🚚 You Deliver',
        actionSummary: 'Deliver to renter',
        badgeClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
        dotClass: 'bg-sky-500',
        borderClass: 'border-sky-500/40',
        bgClass: 'bg-sky-500/10 hover:bg-sky-500/20',
        textColor: 'text-sky-600 dark:text-sky-300',
        pickupLabel: 'You Deliver',
        pickupDotClass: 'bg-sky-500',
        returnLabel: requiresOwnerPickup ? 'You Collect' : 'Renter Returns',
        returnDotClass: requiresOwnerPickup ? 'bg-violet-500' : 'bg-rose-500',
      };
    } else {
      return {
        type: 'RENTER_PICKUP',
        badgeText: '📍 Renter Picks Up',
        actionSummary: 'Meet at your location',
        badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30',
        dotClass: 'bg-purple-500',
        borderClass: 'border-purple-500/40',
        bgClass: 'bg-purple-500/10 hover:bg-purple-500/20',
        textColor: 'text-purple-600 dark:text-purple-300',
        pickupLabel: 'Renter Picks Up',
        pickupDotClass: 'bg-purple-500',
        returnLabel: requiresOwnerPickup ? 'You Collect' : 'Renter Returns',
        returnDotClass: requiresOwnerPickup ? 'bg-violet-500' : 'bg-rose-500',
      };
    }
  } else {
    // Current user is borrower / renter
    if (requiresDelivery) {
      return {
        type: 'DOORSTEP_DELIVERY',
        badgeText: '🚚 Doorstep Delivery',
        actionSummary: 'Owner delivers to you',
        badgeClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
        dotClass: 'bg-sky-500',
        borderClass: 'border-sky-500/40',
        bgClass: 'bg-sky-500/10 hover:bg-sky-500/20',
        textColor: 'text-sky-600 dark:text-sky-300',
        pickupLabel: 'Delivered to You',
        pickupDotClass: 'bg-sky-500',
        returnLabel: requiresOwnerPickup ? 'Owner Collects' : 'You Drop Off',
        returnDotClass: requiresOwnerPickup ? 'bg-violet-500' : 'bg-rose-500',
      };
    } else {
      return {
        type: 'YOU_PICKUP',
        badgeText: '🚶 You Pick Up',
        actionSummary: 'Pick up from owner',
        badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
        dotClass: 'bg-amber-500',
        borderClass: 'border-amber-500/40',
        bgClass: 'bg-amber-500/10 hover:bg-amber-500/20',
        textColor: 'text-amber-600 dark:text-amber-300',
        pickupLabel: 'You Pick Up',
        pickupDotClass: 'bg-amber-500',
        returnLabel: requiresOwnerPickup ? 'Owner Collects' : 'You Drop Off',
        returnDotClass: requiresOwnerPickup ? 'bg-violet-500' : 'bg-rose-500',
      };
    }
  }
}

export function getDayLogisticsStatus(
  dateStr: string,
  booking: Booking,
  isLender: boolean
): DayLogisticsStatus {
  const start = (booking.start_date || '').slice(0, 10);
  const end = (booking.end_date || booking.start_date || '').slice(0, 10);
  const logistics = getBookingLogisticsInfo(booking, isLender);

  const isStart = dateStr === start;
  const isEnd = dateStr === end;

  if (isStart && isEnd) {
    // Same day pickup & return
    const tag = isLender
      ? (logistics.type === 'YOU_DELIVER' ? '🚚 Deliver' : '📍 Hub')
      : (logistics.type === 'DOORSTEP_DELIVERY' ? '🚚 Delivery' : '🚶 Pick Up');
    return {
      kind: 'SAME_DAY',
      tag: `${tag} & 🔄 Return`,
      dotColor: logistics.dotClass,
      badgeClass: logistics.badgeClass,
      cellClass: `${logistics.borderClass} ${logistics.bgClass}`,
      title: `${booking.item_title} (Same-Day: ${logistics.badgeText} + Return)`,
    };
  }

  if (isStart) {
    const tag = isLender
      ? (logistics.type === 'YOU_DELIVER' ? '🚚 Deliver' : '📍 Hub Pickup')
      : (logistics.type === 'DOORSTEP_DELIVERY' ? '🚚 Delivery' : '🚶 Pick Up');
    return {
      kind: 'PICKUP',
      tag,
      dotColor: logistics.dotClass,
      badgeClass: logistics.badgeClass,
      cellClass: `${logistics.borderClass} ${logistics.bgClass}`,
      title: `${booking.item_title} (${logistics.badgeText})`,
    };
  }

  if (isEnd) {
    const isOwnerCollect = Boolean(booking.requires_pickup || booking.return_type === 'MY_LOCATION');
    const tag = isOwnerCollect
      ? (isLender ? '🚗 Collect' : '🚗 Collect')
      : (isLender ? '🔄 Return' : '🔄 Drop Off');

    return {
      kind: 'RETURN',
      tag,
      dotColor: isOwnerCollect ? 'bg-violet-500' : 'bg-rose-500',
      badgeClass: isOwnerCollect
        ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30'
        : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
      cellClass: isOwnerCollect
        ? 'border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20'
        : 'border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20',
      title: `${booking.item_title} (Return Handover)`,
    };
  }

  // Multi-day rental in-use
  return {
    kind: 'IN_USE',
    tag: '🎒 In-Use',
    dotColor: 'bg-blue-500',
    badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30',
    cellClass: 'border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20',
    title: `${booking.item_title} (Active in-use)`,
  };
}

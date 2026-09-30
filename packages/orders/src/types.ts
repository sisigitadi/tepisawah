/**
 * Orders domain types: order, line item, service requests.
 * Contract types only — no business logic (§34).
 */
import type { ID, ISODateString, Money } from "@tepisawah/types";

export type OrderChannel = "dine_in" | "online" | "staff";

export interface OrderLineItem {
  id: ID;
  itemId: ID;
  name: string;
  quantity: number;
  unitPrice: Money;
}

export interface Order {
  id: ID;
  code: string;
  channel: OrderChannel;
  tableNumber?: string;
  items: OrderLineItem[];
  total: Money;
  createdAt: ISODateString;
}

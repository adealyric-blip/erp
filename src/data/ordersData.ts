// Orders module demo data — ported from the 8 HTML reference files.
// All data is mock; nothing here is persisted.

export interface OrderRow {
  id: string;
  customer: string;
  items: string;
  supplier: string;
  total: string;
  sla: string;
  slaPast: boolean;
  status: 'Unfulfilled' | 'Ready to Ship' | 'Local Pickup' | 'Shipped' | 'Delivered';
}

export const ORDERS: OrderRow[] = [
  { id: '#1047', customer: 'Acme Corp', items: 'Hoodie ×2', supplier: 'Printful', total: '$184.00', sla: 'Past SLA', slaPast: true, status: 'Unfulfilled' },
  { id: '#1046', customer: 'Blue Ridge Co.', items: 'Classic Tee ×1', supplier: 'Printful', total: '$92.00', sla: '1d left', slaPast: false, status: 'Ready to Ship' },
  { id: '#1045', customer: 'Northwind Labs', items: 'Mug 11oz ×4', supplier: 'Printify', total: '$246.00', sla: '2d left', slaPast: false, status: 'Local Pickup' },
  { id: '#1044', customer: 'Orion Apparel', items: 'Canvas Tote ×3', supplier: 'Gelato', total: '$128.00', sla: 'Ships 11/01', slaPast: false, status: 'Shipped' },
  { id: '#1043', customer: 'Maple Supply', items: 'Hoodie ×1', supplier: 'Printful', total: '$210.00', sla: 'Delivered 10/30', slaPast: false, status: 'Delivered' },
  { id: '#1042', customer: 'Lakeside Design', items: 'Classic Tee ×2', supplier: 'Gelato', total: '$156.00', sla: 'Past SLA', slaPast: true, status: 'Unfulfilled' },
  { id: '#1041', customer: 'Acme Corp', items: 'Mug 11oz ×1', supplier: 'Printify', total: '$54.00', sla: '1d left', slaPast: false, status: 'Ready to Ship' },
];

export const ORDER_TABS = ['All', 'Unfulfilled', 'Ready to Ship', 'Local Pickup', 'Shipped', 'Delivered'] as const;

export interface PurchaseOrderRow {
  id: string;
  supplier: string;
  supplierInitial: string;
  items: string;
  ordered: string;
  expected: string;
  expectedOverdue: boolean;
  total: string;
  status: 'Draft' | 'Confirmed' | 'Receiving' | 'Received' | 'Overdue';
}

export const PURCHASE_ORDERS: PurchaseOrderRow[] = [
  { id: 'PO-2201', supplier: 'Printful', supplierInitial: 'P', items: '2 lines · 50 units', ordered: '10/28', expected: '11/03', expectedOverdue: false, total: '$1,836.00', status: 'Confirmed' },
  { id: 'PO-2198', supplier: 'Gelato', supplierInitial: 'G', items: '3 lines · 80 units', ordered: '10/25', expected: '11/01', expectedOverdue: false, total: '$1,240.00', status: 'Receiving' },
  { id: 'PO-2195', supplier: 'Printify', supplierInitial: 'P', items: '1 line · 20 units', ordered: '10/20', expected: '10/28', expectedOverdue: true, total: '$640.00', status: 'Overdue' },
  { id: 'PO-2202', supplier: 'Printful', supplierInitial: 'P', items: '2 lines · 40 units', ordered: '10/30', expected: '11/05', expectedOverdue: false, total: '$836.00', status: 'Draft' },
  { id: 'PO-2189', supplier: 'Gelato', supplierInitial: 'G', items: '4 lines · 120 units', ordered: '10/15', expected: '10/22', expectedOverdue: false, total: '$920.00', status: 'Received' },
  { id: 'PO-2187', supplier: 'Printful', supplierInitial: 'P', items: '3 lines · 75 units', ordered: '10/10', expected: '10/17', expectedOverdue: false, total: '$1,440.00', status: 'Received' },
];

export const PO_TABS = ['All', 'Draft', 'Confirmed', 'Receiving', 'Received'] as const;

export interface ReturnRow {
  id: string;
  customer: string;
  order: string;
  reason: string;
  refund: string;
  status: 'Requested' | 'Approved' | 'In transit' | 'Received' | 'Refunded' | 'Declined';
  type: 'Customer return' | 'Supplier claim';
}

export const RETURNS: ReturnRow[] = [
  { id: 'RMA-101', customer: 'Acme Corp', order: '#1047', reason: 'Wrong size', refund: '$92.00', status: 'Requested', type: 'Customer return' },
  { id: 'RMA-100', customer: 'Lakeside Design', order: '#1042', reason: 'Damaged', refund: '$156.00', status: 'Approved', type: 'Customer return' },
  { id: 'RMA-099', customer: 'Northwind Labs', order: '#1031', reason: 'Wrong item', refund: '$76.00', status: 'In transit', type: 'Customer return' },
  { id: 'RMA-098', customer: 'Blue Ridge Co.', order: '#1028', reason: 'Damaged', refund: '$184.00', status: 'Received', type: 'Customer return' },
  { id: 'RMA-096', customer: 'Maple Supply', order: '#1019', reason: 'Not as described', refund: '$320.00', status: 'Refunded', type: 'Customer return' },
  { id: 'CLM-022', customer: 'Printful', order: 'PO-2195', reason: 'Late delivery', refund: '$320.00', status: 'Declined', type: 'Supplier claim' },
];

export const RETURN_TABS = ['All', 'Requested', 'Approved', 'In transit', 'Received', 'Refunded', 'Declined'] as const;

export interface FulfillmentRow {
  id: string;
  customer: string;
  items: string;
  type: 'Ship' | 'Pickup';
  shipBy: string;
  pastSla: boolean;
  status: 'Ready' | 'Unfulfilled' | 'Shipped' | 'Picked up';
}

export const WAREHOUSE_QUEUE: FulfillmentRow[] = [
  { id: '#1046', customer: 'Blue Ridge Co.', items: 'Hoodie — Heavyweight — L / Black · HD-211 · ×1', type: 'Ship', shipBy: 'Today · 4 PM', pastSla: false, status: 'Ready' },
  { id: '#1041', customer: 'Acme Corp', items: 'Canvas Tote · TOTE-014 · ×3', type: 'Ship', shipBy: 'Today · 4 PM', pastSla: false, status: 'Ready' },
  { id: '#1045', customer: 'Northwind Labs', items: 'Mug 11oz · MUG-003 · ×4', type: 'Pickup', shipBy: 'Today · 5 PM', pastSla: false, status: 'Ready' },
  { id: '#1047', customer: 'Acme Corp', items: 'Hoodie · HD-211 · ×2', type: 'Ship', shipBy: 'Past SLA', pastSla: true, status: 'Unfulfilled' },
  { id: '#1042', customer: 'Lakeside Design', items: 'Classic Tee · TEE-001 · ×2', type: 'Ship', shipBy: 'Past SLA', pastSla: true, status: 'Unfulfilled' },
];

export const WAREHOUSE_TABS = ['All', 'Ready to Ship', 'Local Pickup', 'Unfulfilled'] as const;

export interface DropShipRow {
  id: string;
  customer: string;
  supplier: string;
  supplierInitial: string;
  tracking: string;
  eta: string;
  status: 'In transit' | 'Delivered' | 'Received';
}

export const DROP_SHIP_QUEUE: DropShipRow[] = [
  { id: '#1044', customer: 'Orion Apparel', supplier: 'Printful', supplierInitial: 'P', tracking: '9400 1082 0549…', eta: 'ETA 11/05', status: 'In transit' },
  { id: '#1039', customer: 'Blue Ridge Co.', supplier: 'Gelato', supplierInitial: 'G', tracking: '1Z W1A 8E2…', eta: 'ETA 11/04', status: 'In transit' },
  { id: '#1031', customer: 'Northwind Labs', supplier: 'Printify', supplierInitial: 'P', tracking: '9405 5036 9922…', eta: 'Delivered 10/30', status: 'Delivered' },
  { id: '#1024', customer: 'Acme Corp', supplier: 'Printful', supplierInitial: 'P', tracking: 'Confirmed received', eta: '', status: 'Received' },
];

export const DROPSHIP_TABS = ['All', 'In transit', 'Delivered', 'Received'] as const;

export interface InventoryRow {
  sku: string;
  product: string;
  warehouse: string;
  bin: string;
  onHand: number;
  committed: number;
  available: number;
  reorderPoint: number;
  status: 'In stock' | 'Low stock' | 'Out of stock';
}

export const INVENTORY: InventoryRow[] = [
  { sku: 'TEE-001-M-WHT', product: 'Classic Tee', warehouse: 'Charlotte', bin: 'A3', onHand: 124, committed: 12, available: 112, reorderPoint: 50, status: 'In stock' },
  { sku: 'HD-211-L-BLK', product: 'Hoodie V2', warehouse: 'Charlotte', bin: 'B1', onHand: 38, committed: 6, available: 32, reorderPoint: 30, status: 'Low stock' },
  { sku: 'TOTE-014-O', product: 'Canvas Tote', warehouse: 'Nashville', bin: 'C2', onHand: 64, committed: 4, available: 60, reorderPoint: 25, status: 'In stock' },
  { sku: 'MUG-003-11', product: 'Mug 11oz', warehouse: 'Nashville', bin: 'D1', onHand: 0, committed: 4, available: -4, reorderPoint: 50, status: 'Out of stock' },
  { sku: 'PST-009-A2', product: 'Poster A2', warehouse: 'Charlotte', bin: 'E4', onHand: 18, committed: 2, available: 16, reorderPoint: 15, status: 'Low stock' },
];

export const INVENTORY_TABS = ['All', 'In stock', 'Low stock', 'Out of stock'] as const;

export interface CarrierRow {
  id: string;
  carrier: string;
  badge: string;
  account: string;
  services: string;
  avgRate: string;
  status: 'Connected' | 'Needs auth' | 'Disconnected';
}

export const CARRIERS: CarrierRow[] = [
  { id: 'usps', carrier: 'USPS', badge: 'USPS', account: 'USPS-8842', services: 'Ground Advantage, Priority Mail', avgRate: '$6.20', status: 'Connected' },
  { id: 'ups', carrier: 'UPS', badge: 'UPS', account: 'UPS-44120', services: 'Ground, 2nd Day Air', avgRate: '$9.40', status: 'Connected' },
  { id: 'fedex', carrier: 'FedEx', badge: 'FedEx', account: 'FDX-93841', services: 'Ground, Express Saver', avgRate: '—', status: 'Needs auth' },
  { id: 'dhl', carrier: 'DHL Express', badge: 'DHL', account: 'Not connected', services: 'Express Worldwide', avgRate: '—', status: 'Disconnected' },
];

export const SHIPPING_TABS = ['Carriers', 'Packaging', 'Rules'] as const;

export interface BatchOrder {
  id: string;
  customer: string;
  items: string;
  method: string;
  checked: boolean;
  pastSla: boolean;
}

export const BATCH_ORDERS: BatchOrder[] = [
  { id: '#1046', customer: 'Blue Ridge Co.', items: 'Hoodie ×1', method: 'USPS Priority', checked: true, pastSla: false },
  { id: '#1041', customer: 'Acme Corp', items: 'Canvas Tote ×3', method: 'USPS Ground', checked: true, pastSla: false },
  { id: '#1045', customer: 'Northwind Labs', items: 'Mug 11oz ×4 · Local pickup', method: 'Pickup', checked: true, pastSla: false },
  { id: '#1042', customer: 'Lakeside Design', items: 'Hoodie ×1 · past SLA', method: 'USPS Ground', checked: false, pastSla: true },
];

// Avatar color helper
export function avatarColor(name: string): string {
  const colors = ['bg-qb-blue', 'bg-qb-green', 'bg-qb-teal', 'bg-qb-maroon', 'bg-qb-navy'];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

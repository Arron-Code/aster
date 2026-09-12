type ReceiptOrder = {
  id: string;
  createdAt: Date;
  table: { number: number };
  items: Array<{
    quantity: number;
    unitPriceCents: number;
    active: boolean;
    menuItem: { name: string };
  }>;
};

const encoder = new TextEncoder();

function line(text = "") {
  return Array.from(encoder.encode(`${text}\n`));
}

export function buildReceiptJob(order: ReceiptOrder) {
  const activeItems = order.items.filter((item) => item.active);
  const totalCents = activeItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0,
  );
  const commands = [
    0x1b, 0x40,
    0x1b, 0x61, 0x01,
    0x1b, 0x45, 0x01,
    ...line("ZEMA"),
    0x1b, 0x45, 0x00,
    ...line(`Tisch ${order.table.number}`),
    ...line(new Date(order.createdAt).toLocaleString("de-DE")),
    ...line("--------------------------------"),
    0x1b, 0x61, 0x00,
    ...activeItems.flatMap((item) =>
      line(`${item.quantity} x ${item.menuItem.name}  ${(item.quantity * item.unitPriceCents / 100).toFixed(2)} EUR`),
    ),
    ...line("--------------------------------"),
    0x1b, 0x45, 0x01,
    ...line(`SUMME: ${(totalCents / 100).toFixed(2)} EUR`),
    0x1b, 0x45, 0x00,
    ...line("Vielen Dank!"),
    0x1b, 0x64, 0x03,
    0x1d, 0x56, 0x00,
  ];

  return {
    protocol: "esc-pos",
    contentType: "application/octet-stream",
    orderId: order.id,
    commands,
    payloadBase64: Buffer.from(commands).toString("base64"),
  };
}

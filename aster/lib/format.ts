const euroFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export function formatPrice(cents: number) {
  return euroFormatter.format(cents / 100);
}

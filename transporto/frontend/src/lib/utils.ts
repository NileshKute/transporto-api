export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount == null) return '₹0';
  return '₹' + amount.toLocaleString('en-IN');
};

export const formatNumber = (num: number | null | undefined): string => {
  if (num == null) return '0';
  return num.toLocaleString('en-IN');
};

export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const formatKm = (km: number | null | undefined): string => {
  if (km == null) return '—';
  return km.toLocaleString('en-IN') + ' km';
};

export const formatTime = (date: string | Date | null | undefined): string => {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

export const cn = (...classes: (string | undefined | false | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

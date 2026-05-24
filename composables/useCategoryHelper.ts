export const CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Shopping',
  'Transport & Travel',
  'Bills & Utilities',
  'Entertainment',
  'Medical & Healthcare',
  'Others'
] as const

export type CategoryType = typeof CATEGORIES[number]

export function categorizeMerchant(merchantName: string, rawText: string): CategoryType {
  const m = (merchantName || '').toLowerCase()
  const t = (rawText || '').toLowerCase()

  // Food & Dining
  if (
    /restaurant|cafe|food|swiggy|zomato|mcdonald|starbucks|bakery|hotel|canteen|eats|burger|pizza|diner|kitchen|coffee|chai|tea|dhaba|sweets|juice|biryani/i.test(m) ||
    /restaurant|cafe|food|swiggy|zomato|mcdonald|starbucks|bakery|canteen|burger|pizza|coffee|tea|chai|juice|sweets/i.test(t)
  ) {
    return 'Food & Dining'
  }

  // Groceries
  if (
    /grocery|supermarket|mart|store|blinkit|zepto|instamart|bigbasket|provision|milk|vegetable|fruit|dairy|general store|kirana/i.test(m) ||
    /grocery|supermarket|mart|store|blinkit|zepto|instamart|bigbasket|provision|dairy|kirana/i.test(t)
  ) {
    return 'Groceries'
  }

  // Transport & Travel
  if (
    /uber|ola|rapido|make my trip|irctc|metro|railway|flight|cab|travel|travels|petrol|fuel|hpcl|bpcl|iocl|shell|garage|auto|taxi|toll|fastag|parking/i.test(m) ||
    /uber|ola|rapido|irctc|metro|rail|flight|cab|petrol|fuel|hpcl|bpcl|fastag/i.test(t)
  ) {
    return 'Transport & Travel'
  }

  // Bills & Utilities
  if (
    /electricity|bill|utility|recharge|jio|airtel|vi|power|water|gas|broadband|wifi|insurance|rent|dth|postpaid|bsnl/i.test(m) ||
    /electricity|bill|utility|recharge|jio|airtel|broadband|wifi|rent|dth/i.test(t)
  ) {
    return 'Bills & Utilities'
  }

  // Shopping
  if (
    /amazon|flipkart|myntra|reliance|trends|zara|hm|mall|clothing|lifestyle|jewel|watch|shoes|wear|fashion|book|books|gift|retail/i.test(m) ||
    /amazon|flipkart|myntra|mall|clothing|apparel|fashion/i.test(t)
  ) {
    return 'Shopping'
  }

  // Entertainment
  if (
    /netflix|prime|hotstar|spotify|youtube|cinema|pvr|inox|movie|theatre|theater|gaming|game|fun|club|pub|bar|ticket|tickets|concert|music/i.test(m) ||
    /netflix|spotify|cinema|pvr|inox|movie|gaming|game/i.test(t)
  ) {
    return 'Entertainment'
  }

  // Medical & Healthcare
  if (
    /pharmacy|medical|hospital|clinic|doctor|chemist|apollo|medicine|medicines|health|care|diagnostic|lab|dentist/i.test(m) ||
    /pharmacy|medical|hospital|clinic|doctor|chemist|medicine|health/i.test(t)
  ) {
    return 'Medical & Healthcare'
  }

  return 'Others'
}

export function getCategoryIcon(cat: string): string {
  switch (cat) {
    case 'Food & Dining': return '🍔'
    case 'Groceries': return '🛒'
    case 'Shopping': return '🛍️'
    case 'Transport & Travel': return '🚗'
    case 'Bills & Utilities': return '⚡'
    case 'Entertainment': return '🎬'
    case 'Medical & Healthcare': return '🏥'
    default: return '📦'
  }
}

export function getCategoryColor(cat: string): string {
  switch (cat) {
    case 'Food & Dining': return 'text-orange-400'
    case 'Groceries': return 'text-emerald-400'
    case 'Shopping': return 'text-pink-400'
    case 'Transport & Travel': return 'text-sky-400'
    case 'Bills & Utilities': return 'text-indigo-400'
    case 'Entertainment': return 'text-violet-400'
    case 'Medical & Healthcare': return 'text-rose-400'
    default: return 'text-slate-400'
  }
}

export function getCategoryBarColor(cat: string): string {
  switch (cat) {
    case 'Food & Dining': return 'bg-gradient-to-r from-orange-500 to-amber-400'
    case 'Groceries': return 'bg-gradient-to-r from-emerald-500 to-teal-400'
    case 'Shopping': return 'bg-gradient-to-r from-pink-500 to-rose-400'
    case 'Transport & Travel': return 'bg-gradient-to-r from-sky-500 to-cyan-400'
    case 'Bills & Utilities': return 'bg-gradient-to-r from-indigo-500 to-blue-400'
    case 'Entertainment': return 'bg-gradient-to-r from-violet-500 to-fuchsia-400'
    case 'Medical & Healthcare': return 'bg-gradient-to-r from-rose-500 to-red-400'
    default: return 'bg-gradient-to-r from-slate-500 to-slate-400'
  }
}

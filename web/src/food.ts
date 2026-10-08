import { mealArt, type ArtName } from './illustrations'

// Fotke jela (public/food/*.jpg, TheMealDB). Ključ = ista kategorija kao ilustracija.
// Ako fotke za kategoriju nema, ekran pada natrag na ilustraciju.
const PHOTOS = new Set<ArtName>([
  'kajgana', 'zobena-kasa', 'tost', 'pileci-batak', 'varivo', 'odrezak',
  'spageti', 'salata', 'peceni-krumpir', 'riza-zdjela', 'wok',
])

export function mealPhoto(title: string): string | null {
  const art = mealArt(title)
  return PHOTOS.has(art) ? `/food/${art}.jpg` : null
}

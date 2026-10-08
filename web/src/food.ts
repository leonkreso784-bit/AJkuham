import { mealArt, type ArtName } from './illustrations'

// Fotke jela (public/food/*.jpg, TheMealDB, 720 px). Leon (15:45): "slike trebaju pratiti koja je hrana".
// Matching ide po NASLOVU jela i `imageHint` (backend, 2–4 riječi), od najspecifičnijeg pravila prema općem:
// prvo OBLIK jela (lazanje, rižoto, wrap, juha…), pa glavni PROTEIN, pa prilozi/kategorija.
// Ako ništa ne pogodi, pada na kategoriju ilustracije (stari način); ako ni te fotke nema, ekran crta ilustraciju.

const norm = (s: string) =>
  s.toLowerCase().replace(/č|ć/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'd')

// [ključ fotke, regex nad normaliziranim tekstom]. Redoslijed = prioritet. Svaki ključ ima fotku u public/food.
const RULES: [string, RegExp][] = [
  // --- oblik jela ---
  ['lazanje', /lazanj|lasagn/],
  ['musaka', /musak|moussak/],
  ['pizza', /pizz/],
  ['burger', /burger|pljeskavic/],
  ['taco', /\btaco|\btakos?\b/],
  ['wrap', /wrap|tortilj|burrito|fajit|quesadill/],
  ['palacinke', /palacink|pancake|crepe/],
  ['punjene-paprike', /punjen.*paprik/],
  ['cevapi', /cevap|kofta|kebab|raznjic/],
  ['gulas', /gulas|goulash/],
  ['rizoto', /rizot|risott/],
  ['curry', /curry|\bkari\b|masala|tikka/],
  ['kuskus', /kuskus|couscous|bulgur|kvinoj|quinoa/],
  ['penne', /njok|gnocc/],
  ['smoothie', /smoothie|\bshake\b/],
  ['zobena-kasa', /zoben|\bkas[aeu]\b|kasic|oatme|porridge|granol|musli|chia/],
  ['frittata', /frittat|fritat/],
  ['omlet', /omlet|omelet/],
  ['kajgana', /kajgan|scrambled|kuhana jaja/],
  ['dorucak', /jaje na oko|jaja na oko|na oko|benedict|engleski dorucak|pecena jaja/],
  ['sendvic', /sendvic|sandwich|panini|bagel/],
  ['tost', /\btost|toast|na kruhu|bruschett/],
  ['spageti', /spaget|spagh|linguin|tagliat|fettuc/],
  ['penne', /penne|rigaton|fusil|farfal|makaron|tjestenin|\bpasta\b/],
  ['pita', /\bpit[aeu]\b|burek|strudl|savijac|quiche/],
  ['leca', /\blec[aeiu]\b|\blece\b|\bdal\b|dahl/],
  ['juha', /juh[aeu]\b|juhic|\bsoup|corb|potaz|minestron/],
  ['grah', /\bgrah|\bgraha|slanut|mahun|humus|hummus|chili con|cili con/],
  // --- glavni protein ---
  ['tuna', /\btun[aeu]\b|tunjev/],
  ['losos', /losos|salmon/],
  ['skampi', /skamp|kozic|racic|shrimp|prawn/],
  ['riba', /\brib[aeiu]\b|oslic|bakalar|orad[aeu]|brancin|skus[ae]|pastrv|sardin|lignj/],
  ['polpete', /polpet|okruglic|meatball|cufte/],
  ['mljeveno', /mljeven|bolonj|bolognese/],
  ['pecena-piletina', /pecen[aeo]? pil|pilet.*pec|cijel[aeo] pil/],
  ['pileci-batak', /batak|batac|zabatak|krilc/],
  ['pileca-prsa', /pil[ei][ct]|\bpile\b|chicken/],
  ['puretina', /puret|purec|turkey/],
  ['svinjetina', /svinj|kotlet|carski|vratin|rebarc|slanin/],
  ['junetina', /junet|junec|goved|biftek|ramstek|steak|odrez/],
  ['varivo', /variv|cusp|\bragu\b|\bstew/],
  // --- prilozi, povrće, ostalo ---
  ['krumpir-pire', /\bpire\b|pyre|\bmash/],
  ['peceni-krumpir', /krumpir|pomfrit|batat/],
  ['brokula', /brokul|broccol|cvjetac/],
  ['povrce', /povrc|ratatouille|grilan|tikvic|courgett|zucchin|patlidz|paprik/],
  ['salata', /salat|\bbowl\b|zdjel/],
  ['wok', /\bwok|azij|soja|teriyak|pad thai|noodle|rezanc|nudl|kinesk|tajland/],
  ['riza-zdjela', /\briz[aeiu]\b|pilav|rizi/],
]

// Fotke koje postoje po kategoriji ilustracije (stari fallback).
const CATEGORY_PHOTOS = new Set<ArtName>([
  'kajgana', 'zobena-kasa', 'tost', 'pileci-batak', 'varivo', 'odrezak',
  'spageti', 'salata', 'peceni-krumpir', 'riza-zdjela', 'wok',
])

/** Ključ fotke za jelo (naslov + hint), ili null ako ni kategorija nema fotku. */
export function photoKey(title: string, hint?: string | null): string | null {
  // naslov je važniji od hinta: prvo probaj samo naslov, pa naslov + hint
  const t = norm(title)
  for (const [key, re] of RULES) if (re.test(t)) return key
  const th = norm(`${title} ${hint ?? ''}`)
  for (const [key, re] of RULES) if (re.test(th)) return key
  const art = mealArt(title)
  return CATEGORY_PHOTOS.has(art) ? art : null
}

export function mealPhoto(title: string, hint?: string | null): string | null {
  const key = photoKey(title, hint)
  return key ? `/food/${key}.jpg` : null
}

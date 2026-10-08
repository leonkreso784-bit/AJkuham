import type { ArtName } from './art'

/** mala slova, bez dijakritika (č→c, ć→c, š→s, ž→z, đ→d) */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

type Rule = readonly [RegExp, ArtName]

/** Vraća pravilo čije se poklapanje pojavi NAJRANIJE u tekstu
 *  ("Piletina s rižom" → piletina, "Tjestenina s piletinom" → tjestenina).
 *  Kod istog položaja pobjeđuje ranije pravilo. */
function earliest(text: string, rules: readonly Rule[]): ArtName | undefined {
  let best: ArtName | undefined
  let bestAt = Infinity
  for (const [re, name] of rules) {
    const m = re.exec(text)
    if (m && m.index < bestAt) {
      best = name
      bestAt = m.index
    }
  }
  return best
}

/* Jela: prvo "oblik jela" (wok, salata, juha, tjestenina…), tek onda glavni sastojak. */
const DISH_RULES: readonly Rule[] = [
  [/\bwok|stir.?fry|teriyaki|pad thai|rezanc|noodle|azijsk/, 'wok'],
  [/\bzob|\bkas[aeiu]\b|porridge|musli|granol|overnight/, 'zobena-kasa'],
  [/\btost|sendvic|sandwich|toast|\bwrap|tortilj|quesadil|burrit|panini|bruschet|\bpit[aeu]\b|lepinj/, 'tost'],
  [/salat/, 'salata'],
  [/\bjuh|varivo|gulas|cobanac|curry|\bkari\b|chili|\bcili|paprikas|\bragu|stew|krem.?juh|minestr|grah s|\bmanestr/, 'varivo'],
  [/tjestenin|\bpasta|spaget|spaghet|penne|njok|lazanj|lasagn|makaron|carbonar|bolonj|bologn|fusil|tortelin|ravioli|pesto/, 'spageti'],
  [/rizot|risott|rizi.?bizi|pilav|\bpaell/, 'riza-zdjela'],
  [/kajgan|omlet|fritat|saksuk|shakshuk|jaja na oko|\bjaja\b/, 'kajgana'],
  [/odrez|steak|biftek|\bfile\b|kotlet|snicl|burger|pljeskavic|cevap|\bcufte|mesne okruglic|rolad/, 'odrezak'],
]

const MAIN_RULES: readonly Rule[] = [
  [/piletin|\bpilec|\bpile\b|\bpileti|\bpilet|puret|puretin|batak|krilc/, 'pileci-batak'],
  [/svinj|junet|govedin|teletin|janjet|\bmeso|\bmesom|kobasic|slanin/, 'odrezak'],
  [/krumpir|krompir|batat|pomfri|pom fri|\bpire\b/, 'peceni-krumpir'],
  [/\briz[aeiu]?\b|\brizom\b/, 'riza-zdjela'],
  [/\bjaj|\bjaje/, 'kajgana'],
  [/\bgrah|\blec[aeiu]|\blecom|slanut|mahunark/, 'varivo'],
  [/povrc|tikvic|brokul|spinat/, 'salata'],
]

/** jelo (naslov obroka) → ilustracija; fallback 'tanjur' */
export function mealArt(title: string): ArtName {
  const t = norm(title)
  return earliest(t, DISH_RULES) ?? earliest(t, MAIN_RULES) ?? 'tanjur'
}

const INGREDIENT_RULES: readonly Rule[] = [
  [/cesnjak|cesnjac|bijeli luk|bijelog luka/, 'cesnjak'],
  [/jogurt|skyr|kiselo mlijeko|kefir/, 'jogurt'],
  [/\bjaj|\bjaje/, 'jaja'],
  [/mlijek|mlijec|\bmlek|vrhnj|\bmilk|mlacenic/, 'mlijeko'],
  [/maslac|margarin|butter/, 'maslac'],
  [/\bsir\b|\bsir[aeiu]\b|\bsirom\b|\bsirn|parmez|mozzarel|\bfeta|gaud|\bedam|ricott|mascarpon|cheddar|cheese/, 'sir'],
  [/rajcic|pelat|paradajz|cherry|passat|tomat|koncentrat|salsa/, 'rajcica'],
  [/\bluk|kapul|ljutik|poriluk/, 'luk'],
  [/paprik|feferon|chili|\bcili|ljuta/, 'paprika'],
  [/spinat|blitv|rukol|salat|matovil|persin|bosilj|\bkelj|zelen/, 'spinat'],
  [/mrkv|carrot/, 'mrkva'],
  [/kupus|brokul|cvjetac|prokulic|kelj pupc/, 'kupus'],
  [/tikvic|krastav|patlid|zucchin|bundev/, 'tikvica'],
  [/krumpir|krompir|batat/, 'krumpir'],
  [/limun|limet|naranc|grejp|lemon/, 'limun'],
  [/\briz[aeiu]?\b|\brizom\b|rizot|kus.?kus|bulgur|kvinoj|quinoa|zob|pahuljic/, 'riza'],
  [/tjestenin|\bpasta|spaget|penne|njok|lazanj|makaron|fusil|tortelin|rezanc|noodle/, 'tjestenina'],
  [/\bgrah|\blec[aeiu]|\blecom|slanut|\bbob\b|mahun|kukuruz|konzerv|\btun[aeiu]/, 'grah'],
  [/piletin|\bpilec|\bpile\b|\bpileti|puret|puretin|batak|krilc|chicken/, 'piletina'],
  [/\bmeso|\bmesa\b|mljeven|govedin|junet|teletin|svinj|janjet|odrez|slanin|kobasic|sunk|pancet|prsut|kotlet|steak|\bfile\b/, 'meso'],
  [/kruh|pecivo|baget|\btost|tortilj|lepinj|\bpit[aeu]\b|zemick|kifl|toast/, 'kruh'],
]

/** namirnica → ilustracija; fallback 'vrecica' */
export function ingredientArt(name: string): ArtName {
  return earliest(norm(name), INGREDIENT_RULES) ?? 'vrecica'
}

const CATEGORY_RULES: readonly Rule[] = [
  [/perad|piletin|pilec/, 'piletina'],
  [/meso|mesn|riba|delikates/, 'meso'],
  [/povrc|zelen/, 'mrkva'],
  [/voc/, 'limun'],
  [/tjestenin/, 'tjestenina'],
  [/zitar|riz|brasn|pahulj/, 'riza'],
  [/mahunark|konzerv/, 'grah'],
  [/jaj/, 'jaja'],
  [/sir/, 'sir'],
  [/mlijec|mlijek|dairy/, 'mlijeko'],
  [/pekar|kruh|pecivo/, 'kruh'],
]

/** kategorija košarice → ilustracija; nepoznato → pokuša kao namirnicu, pa 'vrecica' */
export function categoryArt(category: string): ArtName {
  const c = norm(category)
  return earliest(c, CATEGORY_RULES) ?? ingredientArt(category)
}

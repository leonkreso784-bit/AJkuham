import { useState } from 'react'
import { mealPhoto } from '../food'
import { Art, mealArt } from '../illustrations'
import { cx, foodTint } from './ui'

// Fotka jela; bez fotke (ili ako se ne učita) pada na ilustraciju u pastelnoj pločici.
export function MealImage({ title, hint, className, artClassName = 'size-3/4' }: { title: string; hint?: string | null; className?: string; artClassName?: string }) {
  const [failed, setFailed] = useState(false)
  const src = failed ? null : mealPhoto(title, hint)
  if (src) {
    return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={cx('object-cover', className)} />
  }
  return (
    <span className={cx('grid place-items-center', foodTint(title), className)}>
      <Art name={mealArt(title)} className={artClassName} />
    </span>
  )
}

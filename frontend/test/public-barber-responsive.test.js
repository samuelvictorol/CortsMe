import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const source = relativePath => readFile(new URL(relativePath, root), 'utf8')

test('site público usa os seletores responsivos presentes no DOM', async () => {
  const [page, css] = await Promise.all([
    source('src/pages/public/PublicBarberPage.vue'),
    source('src/css/app.scss')
  ])

  for (const className of ['testimonial-grid', 'rating-seal', 'premium-gallery__grid', 'premium-map']) {
    assert.match(page, new RegExp(`class="${className}"`))
  }

  assert.match(css, /\.testimonial-grid\s*\{\s*grid-template-columns:\s*1fr;/)
  assert.match(css, /\.rating-seal\s*\{\s*grid-column:\s*1;/)
  assert.match(css, /\.premium-gallery__grid article:first-child\s*\{\s*grid-row:\s*auto;/)
  assert.match(css, /\.premium-gallery__grid article\s*\{\s*min-height:\s*300px;/)
  assert.match(css, /\.premium-map,\.premium-map iframe\s*\{\s*min-height:\s*390px;/)

  for (const obsoleteSelector of [
    '.premium-testimonials__grid',
    '.premium-rating-seal',
    '.premium-gallery__item',
    '.premium-location__map'
  ]) {
    assert.equal(css.includes(obsoleteSelector), false, `seletor sem correspondente no DOM: ${obsoleteSelector}`)
  }
})

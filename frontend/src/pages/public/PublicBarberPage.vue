<template>
  <q-page v-if="profile" class="barber-public" :style="theme">
    <div v-if="profile.site.announcement" class="barber-announcement">
      <span>{{ profile.site.announcement }}</span>
      <router-link :to="`/${profile.slug}/agendar`">Ver horários <q-icon name="arrow_forward" /></router-link>
    </div>

    <header class="barber-public__header container-wide">
      <router-link to="/" class="barber-sign"><span class="barber-sign__mark">{{ profile.businessName?.[0] }}</span><span>{{ profile.businessName }}</span></router-link>
      <nav class="gt-sm"><a href="#sobre">Sobre</a><a href="#servicos">Serviços</a><a v-if="gallerySections.length" href="#galeria">Galeria</a><a v-if="mapUrl" href="#localizacao">Localização</a></nav>
      <q-btn :to="`/${profile.slug}/agendar`" rounded unelevated class="barber-cta" no-caps :label="profile.site.ctaLabel" icon-right="arrow_outward" />
    </header>

    <section class="barber-hero">
      <div class="barber-hero__texture" />
      <div v-if="profile.site.heroImage" class="barber-hero__image" :style="{ backgroundImage: `linear-gradient(90deg, rgba(12,16,14,.96) 0%, rgba(12,16,14,.68) 48%, rgba(12,16,14,.16) 100%), url(${profile.site.heroImage})` }" />
      <div class="container-wide barber-hero__content">
        <span class="barber-eyebrow">{{ profile.site.heroEyebrow }}</span>
        <h1>{{ profile.site.heroTitle }}</h1>
        <p>{{ profile.site.heroSubtitle }}</p>
        <div class="barber-hero__actions"><q-btn :to="`/${profile.slug}/agendar`" rounded unelevated class="barber-cta barber-cta--large" no-caps label="Escolher meu horário" icon-right="arrow_forward" /><q-btn v-if="profile.whatsapp" :href="`https://wa.me/${profile.whatsapp}`" target="_blank" rounded outline color="white" no-caps label="Falar com a equipe" icon="chat" /></div>
        <div class="open-status"><span class="online-dot" /><b>Agenda online</b><span>Escolha entre horários disponíveis agora</span></div>
        <div class="hero-proof">
          <div><strong>4,9</strong><span>★★★★★</span><small>avaliação dos clientes</small></div>
          <div><strong>+6 mil</strong><span>atendimentos</span><small>com hora marcada</small></div>
          <div><strong>7 anos</strong><span>de história</span><small>na Avenida Paulista</small></div>
        </div>
      </div>
      <div class="scroll-note gt-sm">DESCUBRA <q-icon name="south" /></div>
    </section>

    <section v-if="profile.site.banners?.length" class="premium-highlights">
      <div class="container-wide">
        <div class="premium-section-head"><span>EM DESTAQUE</span><small>{{ profile.site.banners.length }} experiências para descobrir</small></div>
        <q-carousel v-model="bannerSlide" animated swipeable navigation infinite :autoplay="6500" control-color="white" class="premium-carousel">
          <q-carousel-slide v-for="(banner, index) in profile.site.banners" :key="banner._id || index" :name="index" :img-src="banner.image">
            <div class="premium-carousel__overlay">
              <span>0{{ index + 1 }} — EXPERIÊNCIA PREMIUM</span>
              <h2>{{ banner.title }}</h2>
              <p>{{ banner.subtitle }}</p>
              <q-btn :to="banner.link || `/${profile.slug}/agendar`" rounded unelevated class="barber-cta" no-caps label="Quero conhecer" icon-right="arrow_forward" />
            </div>
          </q-carousel-slide>
        </q-carousel>
      </div>
    </section>

    <section id="sobre" class="barber-about container-wide">
      <div class="barber-about__image" :style="aboutSection?.image ? { backgroundImage: `url(${aboutSection.image})` } : {}"><span>DESDE 2018</span></div>
      <div class="barber-about__copy"><span class="barber-section-index">01 — NOSSA ESSÊNCIA</span><h2>{{ aboutSection?.title || 'Mais que um corte.' }}</h2><p>{{ aboutSection?.text || profile.description }}</p><div class="experience-stats"><span><b>{{ profile.services.length }}</b> experiências</span><span><b>100%</b> hora marcada</span><span><b>4,9</b> avaliação</span></div></div>
    </section>

    <section v-if="featureSections.length" class="premium-features container-wide">
      <article v-for="(section, index) in featureSections" :key="section._id || index" :class="{ reverse: index % 2 }">
        <div class="premium-feature__image" :style="section.image ? { backgroundImage: `url(${section.image})` } : {}"><span>0{{ index + 2 }}</span></div>
        <div><span class="barber-section-index">A EXPERIÊNCIA</span><h2>{{ section.title }}</h2><p>{{ section.text }}</p><q-btn v-if="section.buttonLabel" :href="section.buttonLink" flat no-caps :label="section.buttonLabel" icon-right="arrow_forward" /></div>
      </article>
    </section>

    <section id="servicos" class="barber-services">
      <div class="container-wide"><div class="barber-section-title"><div><span class="barber-section-index">02 — SERVIÇOS</span><h2>Escolha sua experiência.</h2></div><p>Cada serviço tem seu tempo respeitado. Sem pressa, sem espera e com atenção em cada detalhe.</p></div>
        <div class="service-grid"><article v-for="(service, index) in profile.services.filter(s => s.active)" :key="service._id"><span>0{{ index + 1 }}</span><h3>{{ service.name }}</h3><p>{{ service.description }}</p><div><b>R$ {{ money(service.price) }}</b><small>{{ service.duration }} min</small></div><q-btn :to="`/${profile.slug}/agendar?service=${service._id}`" round flat icon="north_east" /></article></div>
      </div>
    </section>

    <section v-if="gallerySections.length" id="galeria" class="premium-gallery container-wide">
      <div class="barber-section-title"><div><span class="barber-section-index">03 — POR DENTRO</span><h2>Uma pausa no ritmo da cidade.</h2></div><p>Espaço, técnica e detalhes que fazem cada visita valer a pena.</p></div>
      <div class="premium-gallery__grid"><article v-for="(section, index) in gallerySections" :key="section._id || index" :style="{ backgroundImage: `linear-gradient(0deg, rgba(7,10,8,.82), transparent 65%), url(${section.image})` }"><span>0{{ index + 1 }}</span><div><h3>{{ section.title }}</h3><p>{{ section.text }}</p></div></article></div>
    </section>

    <section v-if="testimonialSections.length" class="premium-testimonials">
      <div class="container-wide"><div class="premium-testimonials__head"><span class="barber-section-index">04 — QUEM JÁ VIVEU</span><h2>Histórias que voltam<br>todo mês.</h2><div class="rating-seal"><b>4,9</b><span>★★★★★</span><small>mais de 800 avaliações</small></div></div>
        <div class="testimonial-grid"><blockquote v-for="section in testimonialSections" :key="section._id"><q-icon name="format_quote" /><p>{{ section.text }}</p><footer><span>{{ initials(section.title) }}</span><div><b>{{ section.title }}</b><small>{{ section.buttonLabel }}</small></div></footer></blockquote></div>
      </div>
    </section>

    <section v-if="mapUrl" id="localizacao" class="premium-location container-wide">
      <div class="premium-location__copy"><span class="barber-section-index">05 — COMO CHEGAR</span><h2>{{ profile.site.locationMap.title }}</h2><p>{{ profile.site.locationMap.subtitle }}</p><div class="location-address"><q-icon name="location_on" /><div><b>{{ profile.address }}</b><small>Abra o mapa para traçar a melhor rota.</small></div></div><div class="location-perks"><span><q-icon name="directions_subway" /> Próximo ao metrô</span><span><q-icon name="local_parking" /> Estacionamento</span><span><q-icon name="accessible" /> Acessível</span></div><q-btn :to="`/${profile.slug}/agendar`" rounded unelevated class="barber-cta" no-caps label="Agendar antes de ir" icon-right="arrow_forward" /></div>
      <div class="premium-map"><iframe :src="mapUrl" :title="profile.site.locationMap.title" loading="lazy" referrerpolicy="no-referrer-when-downgrade" /></div>
    </section>

    <section class="premium-final-cta">
      <div class="premium-final-cta__image" />
      <div class="container-wide"><span>SEU HORÁRIO, SEU RITMO</span><h2>{{ ctaSection?.title || 'Seu novo visual começa aqui.' }}</h2><p>{{ ctaSection?.text || 'Veja a agenda em tempo real e reserve em poucos toques.' }}</p><q-btn :to="ctaSection?.buttonLink || `/${profile.slug}/agendar`" size="lg" rounded unelevated class="barber-cta" no-caps :label="ctaSection?.buttonLabel || 'Ver horários disponíveis'" icon-right="arrow_forward" /></div>
    </section>

    <footer class="premium-footer">
      <div class="container-wide premium-footer__top"><div><div class="barber-sign"><span class="barber-sign__mark">{{ profile.businessName?.[0] }}</span><span>{{ profile.businessName }}</span></div><p>{{ profile.description }}</p></div><div><b>Explore</b><a href="#sobre">Nossa essência</a><a href="#servicos">Serviços</a><a href="#localizacao">Localização</a></div><div><b>Contato</b><a v-if="profile.whatsapp" :href="`https://wa.me/${profile.whatsapp}`">WhatsApp</a><a v-if="profile.site.socialLinks?.instagram" :href="`https://instagram.com/${profile.site.socialLinks.instagram}`">Instagram</a><span>{{ profile.address }}</span></div></div>
      <div class="container-wide premium-footer__bottom"><span>{{ profile.site.footerText }}</span><router-link to="/">Site e agenda por <b>Corts.Me</b></router-link></div>
    </footer>
    <BotWidget :profile="profile" />
  </q-page>
  <q-page v-else class="flex flex-center"><q-spinner-dots color="dark" size="48px" /></q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'boot/axios'
import BotWidget from 'components/BotWidget.vue'

const route = useRoute(); const $q = useQuasar(); const profile = ref(null); const bannerSlide = ref(0)
const theme = computed(() => ({ '--barber-primary': profile.value?.site?.primaryColor || '#171b19', '--barber-accent': profile.value?.site?.accentColor || '#c8f45d' }))
const visibleSections = computed(() => profile.value?.site?.sections?.filter(item => item.visible) || [])
const aboutSection = computed(() => visibleSections.value.find(item => item.type === 'about'))
const featureSections = computed(() => visibleSections.value.filter(item => item.type === 'feature'))
const gallerySections = computed(() => visibleSections.value.filter(item => item.type === 'gallery'))
const testimonialSections = computed(() => visibleSections.value.filter(item => item.type === 'testimonial'))
const ctaSection = computed(() => visibleSections.value.find(item => item.type === 'cta'))
const mapUrl = computed(() => safeMapUrl(profile.value?.site?.locationMap?.enabled ? profile.value.site.locationMap.embedUrl : ''))
const money = value => Number(value).toFixed(2).replace('.', ',')
const initials = value => String(value || 'CM').split(' ').slice(0, 2).map(item => item[0]).join('').toUpperCase()

function safeMapUrl (value) {
  try {
    const url = new URL(value)
    const allowed = ['www.google.com', 'google.com', 'maps.google.com', 'www.openstreetmap.org', 'openstreetmap.org']
    return url.protocol === 'https:' && allowed.includes(url.hostname) ? url.toString() : ''
  } catch { return '' }
}

onMounted(async () => {
  try {
    const { data } = await api.get(`/public/barbers/${route.params.slug}`)
    profile.value = { ...data.profile, billing: data.billing, entitlements: data.entitlements, plan: data.plan }
  } catch (error) { $q.notify({ type: 'negative', message: error.response?.data?.message || 'Página não encontrada.' }) }
})
</script>

<template>
  <q-page class="landing-page">
    <section class="hero-section container">
      <div class="hero-copy">
        <div class="eyebrow"><span class="pulse-dot" /> A agenda que trabalha por você</div>
        <h1>Menos mensagens.<br><span>Mais cadeiras ocupadas.</span></h1>
        <p>Seu site, agenda e atendimento inteligente em um só lugar. Feito para barbearias que querem crescer sem complicação.</p>
        <div class="hero-actions">
          <q-btn to="/barbearia-premium" unelevated rounded color="dark" size="lg" no-caps label="Ver experiência ao vivo" icon-right="arrow_outward" />
          <a href="#como-funciona" class="text-link">Descobrir como funciona <q-icon name="south" /></a>
        </div>
        <div class="trust-row">
          <div class="avatar-stack"><q-avatar v-for="n in 4" :key="n" size="36px" :color="['blue-grey-8','brown-5','grey-9','green-8'][n - 1]" text-color="white">{{ ['RM','LC','AV','JP'][n - 1] }}</q-avatar></div>
          <div><div class="stars">★★★★★</div><small>Profissionais no controle da própria agenda</small></div>
        </div>
      </div>

      <div class="hero-visual" aria-label="Prévia da agenda CortsMe">
        <div class="visual-orbit visual-orbit--one" />
        <div class="visual-orbit visual-orbit--two" />
        <div class="phone-card">
          <div class="phone-top"><span>9:41</span><div class="phone-island" /><q-icon name="signal_cellular_alt" size="16px" /></div>
          <div class="phone-content">
            <div class="row items-center justify-between"><div><small>Bom dia, Rafael</small><h5>Sua agenda</h5></div><q-avatar color="lime-5" text-color="dark">RM</q-avatar></div>
            <div class="mini-date-row"><div v-for="date in miniDates" :key="date.day" :class="['mini-date', { active: date.active }]"><small>{{ date.week }}</small><b>{{ date.day }}</b></div></div>
            <div class="schedule-label"><b>Hoje</b><span>4 horários</span></div>
            <div v-for="slot in previewSlots" :key="slot.time" class="preview-slot">
              <div class="slot-time">{{ slot.time }}</div>
              <div class="slot-line" :class="slot.color" />
              <div><b>{{ slot.name }}</b><small>{{ slot.service }}</small></div>
              <q-icon name="more_horiz" color="grey-6" />
            </div>
          </div>
          <div class="phone-nav"><q-icon name="home" /><q-icon name="calendar_month" color="dark" /><span class="phone-fab"><q-icon name="add" /></span><q-icon name="chat_bubble_outline" /><q-icon name="person_outline" /></div>
        </div>
        <div class="floating-card floating-card--top"><span class="success-icon"><q-icon name="check" /></span><div><b>Novo agendamento</b><small>Lucas · Corte premium</small></div></div>
        <div class="floating-card floating-card--bottom"><q-icon name="smart_toy" color="dark" size="27px" /><div><b>Bot atendendo</b><small>Respostas em segundos</small></div><span class="online-dot" /></div>
      </div>
    </section>

    <section class="brand-strip"><div class="container"><span>FEITO PARA QUEM FAZ ACONTECER</span><div class="brand-types"><b>BARBEARIAS</b><i>•</i><b>SALÕES</b><i>•</i><b>ESTÚDIOS</b><i>•</i><b>PROFISSIONAIS</b></div></div></section>

    <section id="como-funciona" class="section-block container">
      <div class="section-heading"><span class="section-number">01</span><div><small>SIMPLES DE VERDADE</small><h2>Do primeiro clique<br>ao corte confirmado.</h2></div><p>Você configura uma vez. O CortsMe cuida do caminho entre descoberta, dúvida e agendamento.</p></div>
      <div class="steps-grid">
        <article v-for="(step, index) in steps" :key="step.title" class="step-card">
          <span>0{{ index + 1 }}</span><q-icon :name="step.icon" /><h3>{{ step.title }}</h3><p>{{ step.text }}</p><div class="step-line" />
        </article>
      </div>
    </section>

    <section id="recursos" class="dark-section">
      <div class="container feature-layout">
        <div class="feature-copy"><small>UM NEGÓCIO MAIS LEVE</small><h2>Tudo conversa.<br>Você só acompanha.</h2><p>Agenda, site e bot compartilham a mesma disponibilidade. Sem horário duplicado, sem cliente perdido, sem informação desencontrada.</p><q-btn to="/login" rounded outline color="lime-5" no-caps label="Conhecer o painel" icon-right="arrow_forward" /></div>
        <div class="feature-list">
          <div v-for="feature in features" :key="feature.title" class="feature-item"><span><q-icon :name="feature.icon" /></span><div><h4>{{ feature.title }}</h4><p>{{ feature.text }}</p></div><q-icon name="north_east" /></div>
        </div>
      </div>
    </section>

    <section id="para-quem" class="cta-section container">
      <div class="cta-card"><span class="cta-blur" /><small>PRONTO PARA VIRAR A CHAVE?</small><h2>Seu próximo cliente<br>já pode estar procurando.</h2><p>Dê a ele um caminho simples até a sua cadeira.</p><q-btn to="/login" size="lg" rounded unelevated color="lime-5" text-color="dark" no-caps label="Começar com CortsMe" icon-right="arrow_outward" /></div>
    </section>

    <footer class="landing-footer"><div class="container row items-center justify-between"><BrandLogo light /><span>© 2026 CortsMe. Tecnologia que aproxima.</span><div><a href="#">Privacidade</a><a href="#">Termos</a></div></div></footer>
  </q-page>
</template>

<script setup>
import BrandLogo from 'components/BrandLogo.vue'
const miniDates = [{ week: 'SEG', day: 12 }, { week: 'TER', day: 13 }, { week: 'QUA', day: 14, active: true }, { week: 'QUI', day: 15 }, { week: 'SEX', day: 16 }]
const previewSlots = [
  { time: '09:00', name: 'Lucas Ferreira', service: 'Corte premium · 45 min', color: 'green' },
  { time: '10:00', name: 'André Lima', service: 'Barba completa · 30 min', color: 'blue' },
  { time: '11:30', name: 'João Pedro', service: 'Combo corte + barba · 70 min', color: 'orange' }
]
const steps = [
  { icon: 'web', title: 'Monte seu site', text: 'Escolha cores, imagens e blocos. Publique seu endereço exclusivo sem depender de ninguém.' },
  { icon: 'smart_toy', title: 'Atenda no automático', text: 'Seu bot responde dúvidas com o contexto do seu negócio e direciona cada cliente.' },
  { icon: 'event_available', title: 'Receba agendamentos', text: 'O cliente escolhe entre horários realmente livres. A agenda atualiza na mesma hora.' }
]
const features = [
  { icon: 'calendar_month', title: 'Agenda sem conflitos', text: 'Horários, pausas, serviços e ajustes em uma visão clara.' },
  { icon: 'web_asset', title: 'Site com a sua cara', text: 'Um ponto de venda bonito, rápido e pronto para o mobile.' },
  { icon: 'forum', title: 'Assistente que converte', text: 'Respostas contextualizadas que levam naturalmente ao agendamento.' },
  { icon: 'notifications_active', title: 'Tudo em tempo real', text: 'Novos agendamentos e mudanças chegam ao painel imediatamente.' }
]
</script>

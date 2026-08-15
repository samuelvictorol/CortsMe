const router = require('express').Router();
const { BarberProfile, BotLog } = require('../collections/CortsmeModels');
const { getRedis } = require('../config/redis.connection');
const { optionalAuth } = require('../middlewares/corts-auth.middleware');
const { availableSlots } = require('../services/appointment.service');
const { asyncRoute } = require('./route.helpers');

router.get('/barbers/:slug', asyncRoute(async (req, res) => {
    const cacheKey = `cortsme:public:${req.params.slug}`;
    const cached = await getRedis()?.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));
    const profile = await BarberProfile.findOne({ slug: req.params.slug, active: true, published: true }).lean();
    if (!profile) return res.status(404).json({ message: 'Este site não está publicado.' });
    const result = { profile };
    await getRedis()?.set(cacheKey, JSON.stringify(result), 'EX', 120);
    res.json(result);
}));

router.get('/barbers/:slug/availability', asyncRoute(async (req, res) => {
    const profile = await BarberProfile.findOne({ slug: req.params.slug, active: true, published: true });
    if (!profile) return res.status(404).json({ message: 'Barbearia não encontrada.' });
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const slots = await availableSlots(profile, date, Math.max(10, Number(req.query.duration) || 30));
    res.json({ date, slots });
}));

router.post('/barbers/:slug/bot', optionalAuth, asyncRoute(async (req, res) => {
    const profile = await BarberProfile.findOne({ slug: req.params.slug, active: true, published: true });
    if (!profile || !profile.bot.enabled) return res.status(404).json({ message: 'Assistente indisponível.' });
    const message = String(req.body.message || '').trim().slice(0, 600);
    if (!message) return res.status(400).json({ message: 'Escreva uma mensagem.' });
    const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    let intent = 'question';
    let answer = `Eu sou o assistente exclusivo da ${profile.businessName}. ${profile.bot.relevantInfo || 'Posso ajudar com serviços, horários, localização e agendamento.'}`;
    let action = null;
    if (/agend|marcar|horario|dispon/.test(normalized)) {
        intent = 'booking';
        answer = req.auth
            ? 'Perfeito. Vou levar você à agenda com os horários livres em tempo real. Escolha o serviço e o melhor horário.'
            : 'Para reservar um horário com segurança, entre na sua conta. Depois você volta direto para a agenda.';
        action = { type: req.auth ? 'OPEN_BOOKING' : 'LOGIN', url: req.auth ? `/${profile.slug}/agendar` : `/login?redirect=/${profile.slug}/agendar` };
    } else if (/servic|corte|barba|preco|valor/.test(normalized)) {
        intent = 'services';
        answer = profile.services.filter((service) => service.active).map((service) => `${service.name} — R$ ${service.price.toFixed(2).replace('.', ',')} · ${service.duration} min`).join('\n') || 'Os serviços estão sendo atualizados.';
    } else if (/onde|endereco|local|chegar/.test(normalized)) {
        intent = 'location';
        answer = profile.address ? `Estamos em ${profile.address}. Quer agendar antes de vir?` : 'Nosso endereço será atualizado em breve.';
        const map = profile.site?.locationMap;
        if (map?.botEnabled && map.embedUrl) action = { type: 'SHOW_MAP', url: map.embedUrl, title: map.title || 'Como chegar' };
    } else {
        const faq = profile.bot.faqs.find((item) => normalized.includes(String(item.question).toLowerCase()));
        if (faq) { intent = 'faq'; answer = faq.answer; }
    }
    await BotLog.create({ profile: profile._id, user: req.auth?.userId || null, sessionId: req.body.sessionId, message, response: answer, intent });
    res.json({ answer, intent, action, suggestions: profile.bot.menuOptions.slice(0, 4) });
}));

module.exports = router;

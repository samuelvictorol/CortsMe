const { User, BarberProfile } = require('../collections/CortsmeModels');
const { createUser } = require('./user.service');
const { createDefaultProfile } = require('./profile.service');
const { lookupHash, normalizeEmail } = require('./security.service');
const { ensureBillingSeed } = require('./billing.service');

const SHOWCASE_VERSION = 3;

async function demoSlugFor(profile, profileModel = BarberProfile) {
    const preferredSlug = 'barbearia-premium';
    const preferredSlugInUse = await profileModel.exists({
        _id: { $ne: profile._id },
        slug: preferredSlug
    });
    return preferredSlugInUse ? profile.slug : preferredSlug;
}

async function enhanceDemoProfile(profile) {
    if ((profile.showcaseVersion || 0) >= SHOWCASE_VERSION) return profile;

    const demoSlug = await demoSlugFor(profile);

    profile.businessName = 'Barbearia Premium';
    profile.slug = demoSlug;
    profile.active = true;
    profile.published = true;
    profile.showcaseVersion = SHOWCASE_VERSION;
    profile.description = 'Barbearia contemporânea na Avenida Paulista. Técnica, hospitalidade e estilo em uma experiência com hora marcada.';
    profile.address = 'Avenida Paulista, 1000 — Bela Vista, São Paulo — SP';
    profile.whatsapp = '5511999990000';
    profile.services = [
        { name: 'Corte signature', description: 'Consultoria de estilo, lavagem, corte personalizado e finalização.', duration: 50, price: 75, active: true },
        { name: 'Barba premium', description: 'Toalha quente, desenho preciso, navalha e hidratação.', duration: 40, price: 58, active: true },
        { name: 'Experiência completa', description: 'Corte signature + ritual de barba + acabamento.', duration: 85, price: 119, active: true },
        { name: 'Corte executivo', description: 'Manutenção precisa para quem valoriza tempo e consistência.', duration: 35, price: 62, active: true },
        { name: 'Camuflagem de fios', description: 'Tonalização natural de cabelo ou barba com acabamento discreto.', duration: 35, price: 70, active: true },
        { name: 'Dia do noivo', description: 'Experiência privativa, produção completa e brinde para o grande dia.', duration: 120, price: 249, active: true }
    ];
    profile.businessHours = [
        { weekday: 0, enabled: false, start: '09:00', end: '18:00', breakStart: '', breakEnd: '' },
        { weekday: 1, enabled: true, start: '09:00', end: '20:00', breakStart: '13:00', breakEnd: '14:00' },
        { weekday: 2, enabled: true, start: '09:00', end: '20:00', breakStart: '13:00', breakEnd: '14:00' },
        { weekday: 3, enabled: true, start: '09:00', end: '20:00', breakStart: '13:00', breakEnd: '14:00' },
        { weekday: 4, enabled: true, start: '09:00', end: '20:00', breakStart: '13:00', breakEnd: '14:00' },
        { weekday: 5, enabled: true, start: '09:00', end: '21:00', breakStart: '13:00', breakEnd: '14:00' },
        { weekday: 6, enabled: true, start: '08:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' }
    ];
    profile.site = {
        primaryColor: '#111613',
        accentColor: '#c8f45d',
        announcement: 'Agenda de agosto aberta · atendimento com hora marcada',
        logo: '',
        heroImage: '/demo/premium-hero.jpg',
        heroEyebrow: 'Barbearia contemporânea · São Paulo',
        heroTitle: 'Seu estilo merece assinatura.',
        heroSubtitle: 'Técnica, hospitalidade e tempo de qualidade. Uma experiência masculina completa no coração da Avenida Paulista.',
        ctaLabel: 'Reservar minha cadeira',
        banners: [
            { title: 'Primeira experiência?', subtitle: 'Ganhe uma hidratação premium ao reservar o combo completo.', image: '/demo/premium-barber.jpg', link: `/${demoSlug}/agendar` },
            { title: 'Dia do noivo', subtitle: 'Um ritual privativo para viver o grande dia com seu time.', image: '/demo/premium-interior.jpg', link: `/${demoSlug}/agendar` },
            { title: 'Seu horário. Sem espera.', subtitle: 'A agenda online mostra somente horários realmente disponíveis.', image: '/demo/premium-detail.jpg', link: `/${demoSlug}/agendar` }
        ],
        sections: [
            { type: 'about', title: 'Clássico na técnica. Atual na atitude.', text: 'Desde 2018, transformamos o cuidado masculino em um ritual leve e preciso. Cada atendimento começa com escuta, passa por técnica e termina com um estilo que funciona na sua rotina.', image: '/demo/premium-interior.jpg', visible: true },
            { type: 'feature', title: 'Consultoria antes da tesoura', text: 'Formato do rosto, rotina, textura e personalidade entram na conversa antes do primeiro corte.', image: '/demo/premium-barber.jpg', buttonLabel: 'Conhecer os serviços', buttonLink: '#servicos', visible: true },
            { type: 'feature', title: 'Tempo de qualidade', text: 'Café especial, ambiente confortável, produtos selecionados e atendimento sem correria.', image: '/demo/premium-chair.jpg', buttonLabel: 'Ver localização', buttonLink: '#localizacao', visible: true },
            { type: 'gallery', title: 'Precisão em cada detalhe', text: 'Acabamento desenhado para durar.', image: '/demo/premium-detail.jpg', visible: true },
            { type: 'gallery', title: 'Ambiente feito para desacelerar', text: 'Sua pausa no ritmo da cidade.', image: '/demo/premium-interior.jpg', visible: true },
            { type: 'gallery', title: 'Técnica e repertório', text: 'Profissionais que entendem o seu estilo.', image: '/demo/premium-barber.jpg', visible: true },
            { type: 'testimonial', title: 'Lucas Almeida', text: 'A agenda online é certeira e o atendimento começa no horário. O corte ficou exatamente como conversamos.', buttonLabel: 'Cliente há 2 anos', visible: true },
            { type: 'testimonial', title: 'André Siqueira', text: 'Do site até a cadeira, tudo é impecável. O combo completo virou meu ritual mensal.', buttonLabel: 'Cliente verificado', visible: true },
            { type: 'testimonial', title: 'Bruno Carvalho', text: 'O bot tirou minhas dúvidas e encontrei um horário em menos de dois minutos.', buttonLabel: 'Primeira visita', visible: true },
            { type: 'cta', title: 'Sua próxima versão começa aqui.', text: 'Escolha a experiência, encontre seu horário e deixe o resto com a gente.', buttonLabel: 'Ver agenda disponível', buttonLink: `/${demoSlug}/agendar`, visible: true }
        ],
        socialLinks: { instagram: 'barbeariapremium', tiktok: 'barbeariapremium', youtube: 'barbeariapremium' },
        locationMap: {
            enabled: true,
            botEnabled: true,
            embedUrl: 'https://www.google.com/maps?q=Avenida+Paulista+1000+Sao+Paulo&output=embed',
            title: 'No coração de São Paulo',
            subtitle: 'A dois minutos do metrô Trianon-Masp, com estacionamento conveniado.'
        },
        footerText: 'Barbearia Premium · Técnica, tempo e atitude.'
    };
    profile.bot = {
        enabled: true,
        name: 'Romeu',
        greeting: 'Bem-vindo à Barbearia Premium. Eu sou o Romeu — posso indicar a melhor experiência, mostrar horários livres ou ajudar você a chegar até nós. Por onde começamos?',
        relevantInfo: 'Atendimento exclusivamente com hora marcada. Aceitamos Pix e cartões. Estamos na Avenida Paulista, a dois minutos do metrô Trianon-Masp. Estacionamento conveniado por 2 horas. Café especial incluso. Tolerância de atraso: 10 minutos.',
        menuOptions: ['Encontrar meu serviço', 'Ver horários livres', 'Como chegar', 'Valores e duração'],
        faqs: [
            { question: 'estacionamento', answer: 'Temos estacionamento conveniado por até 2 horas a poucos metros da barbearia. Apresente seu agendamento na recepção.' },
            { question: 'pagamento', answer: 'Aceitamos Pix, débito e crédito. O pagamento é feito somente após o atendimento.' },
            { question: 'atraso', answer: 'Temos tolerância de 10 minutos. Depois disso, confirmamos se ainda é possível manter toda a experiência contratada.' },
            { question: 'primeira vez', answer: 'Na primeira visita fazemos uma conversa rápida sobre estilo, rotina e manutenção antes de começar. Chegue 5 minutos antes e fique à vontade.' }
        ]
    };
    return profile.save();
}

async function ensureSystemData() {
    const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || 'admin@corts.me');
    let admin = await User.findOne({ emailHash: lookupHash(adminEmail) });
    if (!admin) admin = await createUser({ name: process.env.ADMIN_NAME || 'Administrador CortsMe', email: adminEmail, password: process.env.ADMIN_PASSWORD || 'CortsMe@2026' }, 'ADMIN');

    const demoEmail = 'barber@corts.me';
    let barber = await User.findOne({ emailHash: lookupHash(demoEmail) });
    if (!barber && process.env.SEED_DEMO !== 'false') barber = await createUser({ name: 'Rafael Martins', email: demoEmail, phone: '11999990000', password: 'Barber@123' }, 'BARBER');
    if (!barber) {
        await ensureBillingSeed();
        return;
    }

    let profile = await BarberProfile.findOne({ owner: barber._id });
    if (!profile) profile = await createDefaultProfile(barber._id, 'Barbearia Premium', 'barbearia-premium');
    await enhanceDemoProfile(profile);
    await ensureBillingSeed(profile);
}

module.exports = { ensureSystemData, enhanceDemoProfile, demoSlugFor };

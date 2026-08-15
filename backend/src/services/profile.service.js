const { BarberProfile } = require('../collections/CortsmeModels');

const defaultHours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday, enabled: weekday > 0 && weekday < 6,
    start: '09:00', end: '19:00', breakStart: '12:00', breakEnd: '13:00'
}));

function slugify(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function uniqueSlug(value, ignoreId) {
    const base = slugify(value) || 'meu-espaco';
    let candidate = base;
    let suffix = 2;
    while (await BarberProfile.exists({ slug: candidate, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) })) candidate = `${base}-${suffix++}`;
    return candidate;
}

async function createDefaultProfile(owner, name, requestedSlug) {
    return BarberProfile.create({
        owner, businessName: name, slug: await uniqueSlug(requestedSlug || name), businessHours: defaultHours,
        services: [
            { name: 'Corte premium', description: 'Corte personalizado com acabamento.', duration: 45, price: 55 },
            { name: 'Barba completa', description: 'Toalha quente, desenho e finalização.', duration: 30, price: 40 },
            { name: 'Combo corte + barba', description: 'Experiência completa.', duration: 70, price: 85 }
        ],
        site: { sections: [
            { type: 'about', title: 'Mais que um corte', text: 'Um espaço pensado para você desacelerar, cuidar do visual e sair renovado.', visible: true },
            { type: 'services', title: 'Escolha sua experiência', text: 'Serviços assinados por quem entende de estilo.', visible: true }
        ] }
    });
}

module.exports = { defaultHours, slugify, uniqueSlug, createDefaultProfile };

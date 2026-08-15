const mongoose = require('mongoose');

const { Schema } = mongoose;

const userSchema = new Schema({
    name: { type: String, required: true, trim: true },
    emailEncrypted: { type: String, default: '' },
    emailHash: { type: String, sparse: true, unique: true, index: true },
    phoneEncrypted: { type: String, default: '' },
    phoneHash: { type: String, sparse: true, unique: true, index: true },
    password: { type: String, select: false },
    avatar: { type: String, default: '' },
    role: { type: String, enum: ['ADMIN', 'BARBER', 'USER'], default: 'USER', index: true },
    provider: { type: String, enum: ['local', 'google'], default: 'local' },
    active: { type: Boolean, default: true }
}, { timestamps: true });

const serviceSchema = new Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    duration: { type: Number, min: 10, max: 480, default: 30 },
    price: { type: Number, min: 0, default: 0 },
    active: { type: Boolean, default: true }
}, { _id: true });

const businessHourSchema = new Schema({
    weekday: { type: Number, min: 0, max: 6, required: true },
    enabled: { type: Boolean, default: true },
    start: { type: String, default: '09:00' },
    end: { type: String, default: '19:00' },
    breakStart: { type: String, default: '12:00' },
    breakEnd: { type: String, default: '13:00' }
}, { _id: false });

const contentSectionSchema = new Schema({
    type: { type: String, default: 'text' }, title: String, text: String, image: String,
    buttonLabel: String, buttonLink: String, visible: { type: Boolean, default: true }
}, { _id: true });

const appointmentChangeSchema = new Schema({
    field: { type: String, required: true },
    from: { type: String, default: '' },
    to: { type: String, default: '' }
}, { _id: false });

const appointmentHistorySchema = new Schema({
    action: { type: String, enum: ['CREATED', 'EDITED', 'STATUS_CHANGED', 'CANCELLED', 'ADJUSTMENT_REQUESTED'], required: true },
    at: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'CortsmeUser', default: null },
    changes: { type: [appointmentChangeSchema], default: [] }
}, { _id: true });

const barberProfileSchema = new Schema({
    owner: { type: Schema.Types.ObjectId, ref: 'CortsmeUser', required: true, unique: true },
    businessName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    active: { type: Boolean, default: true },
    published: { type: Boolean, default: false },
    description: { type: String, default: '' },
    address: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    webhookUrl: { type: String, default: '' },
    showcaseVersion: { type: Number, default: 0 },
    services: { type: [serviceSchema], default: [] },
    businessHours: { type: [businessHourSchema], default: [] },
    site: {
        primaryColor: { type: String, default: '#171B19' },
        accentColor: { type: String, default: '#C8F45D' },
        logo: { type: String, default: '' },
        heroImage: { type: String, default: '' },
        heroEyebrow: { type: String, default: 'Seu estilo, no seu tempo' },
        heroTitle: { type: String, default: 'Precisão em cada detalhe.' },
        heroSubtitle: { type: String, default: 'Agende seu horário em poucos toques e venha viver uma experiência feita para você.' },
        ctaLabel: { type: String, default: 'Agendar agora' },
        announcement: { type: String, default: '' },
        banners: { type: [new Schema({ title: String, subtitle: String, image: String, link: String }, { _id: true })], default: [] },
        sections: { type: [contentSectionSchema], default: [] },
        socialLinks: { type: Map, of: String, default: {} },
        locationMap: {
            enabled: { type: Boolean, default: false },
            botEnabled: { type: Boolean, default: false },
            embedUrl: { type: String, default: '' },
            title: { type: String, default: 'Onde estamos' },
            subtitle: { type: String, default: 'Trace sua rota e venha viver essa experiência.' }
        },
        footerText: { type: String, default: 'Feito com CortsMe' }
    },
    bot: {
        enabled: { type: Boolean, default: true },
        name: { type: String, default: 'Cort' },
        greeting: { type: String, default: 'Olá! Eu ajudo você a conhecer nossos serviços e encontrar o melhor horário. Como posso ajudar?' },
        relevantInfo: { type: String, default: '' },
        menuOptions: { type: [String], default: ['Ver serviços', 'Consultar horários', 'Agendar agora', 'Localização'] },
        faqs: { type: [new Schema({ question: String, answer: String }, { _id: true })], default: [] }
    }
}, { timestamps: true });

const appointmentSchema = new Schema({
    profile: { type: Schema.Types.ObjectId, ref: 'BarberProfile', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'CortsmeUser', default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'CortsmeUser', required: true },
    serviceId: { type: Schema.Types.ObjectId },
    serviceName: { type: String, required: true },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    duration: { type: Number, required: true },
    price: { type: Number, default: 0 },
    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true },
    status: { type: String, enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'], default: 'CONFIRMED', index: true },
    note: { type: String, default: '' },
    adjustmentRequested: { type: Boolean, default: false },
    adjustmentNote: { type: String, default: '' },
    proposedStart: { type: Date, default: null },
    source: { type: String, enum: ['web', 'bot', 'manual'], default: 'web' },
    history: { type: [appointmentHistorySchema], default: [] }
}, { timestamps: true });
appointmentSchema.index({ profile: 1, start: 1, end: 1 });

const botLogSchema = new Schema({
    profile: { type: Schema.Types.ObjectId, ref: 'BarberProfile', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'CortsmeUser', default: null },
    sessionId: { type: String, default: '' },
    message: { type: String, required: true },
    response: { type: String, required: true },
    intent: { type: String, default: 'question' }
}, { timestamps: true });

const mediaSchema = new Schema({
    owner: { type: Schema.Types.ObjectId, ref: 'CortsmeUser', required: true },
    profile: { type: Schema.Types.ObjectId, ref: 'BarberProfile', default: null },
    filename: String, mimeType: String, size: Number,
    data: { type: Buffer, required: true }
}, { timestamps: true });

const User = mongoose.models.CortsmeUser || mongoose.model('CortsmeUser', userSchema);
const BarberProfile = mongoose.models.BarberProfile || mongoose.model('BarberProfile', barberProfileSchema);
const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema);
const BotLog = mongoose.models.BotLog || mongoose.model('BotLog', botLogSchema);
const Media = mongoose.models.Media || mongoose.model('Media', mediaSchema);

module.exports = { User, BarberProfile, Appointment, BotLog, Media };

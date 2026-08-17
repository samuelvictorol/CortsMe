const mongoose = require('mongoose');

const { Schema } = mongoose;

const userSchema = new Schema({
    name: { type: String, required: true, trim: true },
    emailEncrypted: { type: String, default: '' },
    emailHash: { type: String, sparse: true, unique: true, index: true },
    phoneEncrypted: { type: String, default: '' },
    phoneHash: { type: String, sparse: true, unique: true, index: true },
    whatsappMetaPhoneEncrypted: { type: String, default: '' },
    password: { type: String, select: false },
    avatar: { type: String, default: '', maxlength: 2048 },
    avatarMedia: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
    avatarUpdatedAt: { type: Date, default: null },
    role: { type: String, enum: ['ADMIN', 'BARBER', 'USER'], default: 'USER', index: true },
    provider: { type: String, enum: ['local', 'google'], default: 'local' },
    active: { type: Boolean, default: true },
    authVersion: { type: Number, default: 0, min: 0 },
    passwordChangedAt: { type: Date, default: null }
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
    },
    reminderSettings: {
        enabled: { type: Boolean, default: true },
        channels: {
            type: [String],
            enum: ['email', 'whatsapp_cloud'],
            default: ['email', 'whatsapp_cloud']
        },
        morningEnabled: { type: Boolean, default: true },
        morningTime: { type: String, default: '07:00' },
        timezone: { type: String, default: 'America/Sao_Paulo' },
        customerRemindersEnabled: { type: Boolean, default: true },
        billingRemindersEnabled: { type: Boolean, default: true }
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
    kind: { type: String, enum: ['general', 'site', 'avatar'], default: 'general', index: true },
    filename: { type: String, default: '', maxlength: 160 },
    mimeType: { type: String, required: true, maxlength: 80 },
    size: { type: Number, required: true, min: 1, max: 6 * 1024 * 1024 },
    sha256: { type: String, default: '', maxlength: 64 },
    data: {
        type: Buffer,
        required: true,
        validate: {
            validator(value) {
                const limit = this.kind === 'avatar' ? 4 * 1024 * 1024 : 6 * 1024 * 1024;
                return Buffer.isBuffer(value) && value.length > 0 && value.length <= limit;
            },
            message: 'A imagem excede o limite permitido.'
        }
    }
}, { timestamps: true });
mediaSchema.index(
    { owner: 1, kind: 1 },
    { unique: true, partialFilterExpression: { kind: 'avatar' }, name: 'uniq_avatar_per_user' }
);

const billingSettingsSchema = new Schema({
    key: { type: String, default: 'default', immutable: true, unique: true },
    provider: { type: String, enum: ['INFINITEPAY'], default: 'INFINITEPAY', immutable: true },
    handle: { type: String, default: '', trim: true, lowercase: true },
    webhookUrl: { type: String, default: '', trim: true },
    redirectBaseUrl: { type: String, default: '', trim: true },
    enabled: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'CortsmeUser', default: null }
}, { timestamps: true });

const billingPlanSchema = new Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '', trim: true },
    priceCents: { type: Number, required: true, min: 0 },
    durationDays: { type: Number, default: 30, min: 1, max: 366 },
    isFree: { type: Boolean, default: false },
    active: { type: Boolean, default: true, index: true },
    highlighted: { type: Boolean, default: false },
    badge: { type: String, default: '', trim: true },
    displayOrder: { type: Number, default: 0 },
    features: { type: [String], default: [] },
    entitlements: {
        onlineBooking: { type: Boolean, default: true },
        chatbot: { type: Boolean, default: true },
        publishedSite: { type: Boolean, default: true }
    }
}, { timestamps: true });
billingPlanSchema.index({ isFree: 1 }, { unique: true, partialFilterExpression: { isFree: true } });

const subscriptionSchema = new Schema({
    profile: { type: Schema.Types.ObjectId, ref: 'BarberProfile', required: true, unique: true },
    plan: { type: Schema.Types.ObjectId, ref: 'BillingPlan', required: true, index: true },
    status: {
        type: String,
        enum: ['FREE', 'PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'],
        default: 'FREE',
        index: true
    },
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null, index: true },
    lastPayment: { type: Schema.Types.ObjectId, ref: 'BillingPayment', default: null },
    manuallyAdjustedBy: { type: Schema.Types.ObjectId, ref: 'CortsmeUser', default: null },
    note: { type: String, default: '', trim: true }
}, { timestamps: true });
subscriptionSchema.index({ status: 1, periodEnd: 1 });

const billingPaymentSchema = new Schema({
    provider: { type: String, enum: ['INFINITEPAY'], default: 'INFINITEPAY' },
    profile: { type: Schema.Types.ObjectId, ref: 'BarberProfile', required: true, index: true },
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: 'BillingPlan', required: true, index: true },
    orderNsu: { type: String, required: true, unique: true, trim: true },
    amountCents: { type: Number, required: true, min: 1 },
    durationDays: { type: Number, required: true, min: 1, max: 366, default: 30 },
    planSnapshot: { type: Schema.Types.Mixed, default: null },
    status: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'],
        default: 'PENDING',
        index: true
    },
    checkoutUrl: { type: String, default: '' },
    invoiceSlug: { type: String, default: '' },
    transactionNsu: { type: String, trim: true },
    receiptUrl: { type: String, default: '' },
    captureMethod: { type: String, default: '' },
    paidAmountCents: { type: Number, default: 0 },
    paidAt: { type: Date, default: null },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
    failureReason: { type: String, default: '' },
    providerPayload: { type: Schema.Types.Mixed, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'CortsmeUser', required: true }
}, { timestamps: true });
billingPaymentSchema.index(
    { transactionNsu: 1 },
    { unique: true, partialFilterExpression: { transactionNsu: { $type: 'string' } } }
);
billingPaymentSchema.index({ profile: 1, createdAt: -1 });

const billingEventSchema = new Schema({
    provider: { type: String, enum: ['INFINITEPAY', 'SYSTEM'], default: 'INFINITEPAY' },
    eventKey: { type: String, required: true, unique: true },
    type: { type: String, required: true, index: true },
    payment: { type: Schema.Types.ObjectId, ref: 'BillingPayment', default: null, index: true },
    status: { type: String, enum: ['PROCESSING', 'PROCESSED', 'REJECTED', 'FAILED'], default: 'PROCESSING' },
    payload: { type: Schema.Types.Mixed, default: null },
    result: { type: Schema.Types.Mixed, default: null },
    processedAt: { type: Date, default: null }
}, { timestamps: true });

const secureLinkSchema = new Schema({
    tokenHash: { type: String, required: true, unique: true },
    purpose: {
        type: String,
        enum: ['RESET_PASSWORD', 'APPOINTMENT_ACTION', 'FINANCE_ACCESS'],
        required: true,
        index: true
    },
    user: { type: Schema.Types.ObjectId, ref: 'CortsmeUser', default: null, index: true },
    profile: { type: Schema.Types.ObjectId, ref: 'BarberProfile', default: null, index: true },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null, index: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: null }
}, { timestamps: true });
secureLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
secureLinkSchema.index({ purpose: 1, user: 1, consumedAt: 1 });
secureLinkSchema.index(
    { purpose: 1, user: 1 },
    {
        unique: true,
        name: 'uniq_active_password_reset_per_user',
        partialFilterExpression: { purpose: 'RESET_PASSWORD', consumedAt: null, revokedAt: null }
    }
);

const notificationDispatchSchema = new Schema({
    profile: { type: Schema.Types.ObjectId, ref: 'BarberProfile', default: null, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'CortsmeUser', default: null, index: true },
    kind: {
        type: String,
        enum: [
            'PASSWORD_RESET', 'BARBER_DAILY', 'BARBER_BILLING', 'CUSTOMER_APPOINTMENT',
            'BARBER_APPOINTMENT_CREATED', 'BARBER_APPOINTMENT_CANCELLED'
        ],
        required: true,
        index: true
    },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    templateName: { type: String, required: true },
    channels: { type: [String], default: [] },
    idempotencyKey: { type: String, required: true, unique: true },
    jobId: { type: String, default: '', index: true },
    status: {
        type: String,
        enum: ['QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED'],
        default: 'QUEUED',
        index: true
    },
    scheduledFor: { type: Date, default: null, index: true },
    attempts: { type: Number, default: 0 },
    notifyFlowId: { type: String, default: '', index: true },
    recipientSummary: { type: String, default: '' },
    responseStatus: { type: String, default: '' },
    lastError: { type: String, default: '' },
    sentAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: null }
}, { timestamps: true });
notificationDispatchSchema.index({ profile: 1, createdAt: -1 });
notificationDispatchSchema.index({ status: 1, scheduledFor: 1 });

const User = mongoose.models.CortsmeUser || mongoose.model('CortsmeUser', userSchema);
const BarberProfile = mongoose.models.BarberProfile || mongoose.model('BarberProfile', barberProfileSchema);
const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema);
const BotLog = mongoose.models.BotLog || mongoose.model('BotLog', botLogSchema);
const Media = mongoose.models.Media || mongoose.model('Media', mediaSchema);
const BillingSettings = mongoose.models.BillingSettings || mongoose.model('BillingSettings', billingSettingsSchema);
const BillingPlan = mongoose.models.BillingPlan || mongoose.model('BillingPlan', billingPlanSchema);
const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
const BillingPayment = mongoose.models.BillingPayment || mongoose.model('BillingPayment', billingPaymentSchema);
const BillingEvent = mongoose.models.BillingEvent || mongoose.model('BillingEvent', billingEventSchema);
const SecureLink = mongoose.models.SecureLink || mongoose.model('SecureLink', secureLinkSchema);
const NotificationDispatch = mongoose.models.NotificationDispatch || mongoose.model('NotificationDispatch', notificationDispatchSchema);

module.exports = {
    User, BarberProfile, Appointment, BotLog, Media,
    BillingSettings, BillingPlan, Subscription, BillingPayment, BillingEvent,
    SecureLink, NotificationDispatch
};

const mongoose = require('mongoose');
const { User, BarberProfile, Subscription } = require('../collections/CortsmeModels');
const { createUser } = require('./user.service');
const { createDefaultProfile, slugify } = require('./profile.service');
const { ensureFreePlan, calculateSubscriptionState } = require('./billing.service');

function httpError(message, statusCode = 400, code = 'PROFESSIONAL_REGISTRATION_ERROR') {
    return Object.assign(new Error(message), { statusCode, code });
}

function normalizeProfessionalPayload(payload = {}) {
    const businessName = String(payload.businessName || '').trim();
    if (!businessName) {
        throw httpError('Informe o nome do salão ou da barbearia.', 400, 'BUSINESS_NAME_REQUIRED');
    }
    if (businessName.length > 120) {
        throw httpError('O nome do salão ou da barbearia deve ter até 120 caracteres.', 400, 'BUSINESS_NAME_TOO_LONG');
    }

    const rawSlug = payload.slug === undefined || payload.slug === null ? '' : String(payload.slug).trim();
    const requestedSlug = rawSlug ? slugify(rawSlug) : '';
    if (rawSlug && !requestedSlug) {
        throw httpError('Informe uma URL personalizada válida.', 400, 'INVALID_PROFESSIONAL_SLUG');
    }

    return {
        user: {
            name: payload.name,
            email: payload.email,
            phone: payload.phone,
            password: payload.password
        },
        businessName,
        requestedSlug
    };
}

function supportsTransactions(connection) {
    const topologyType = connection?.client?.topology?.description?.type;
    return topologyType === 'ReplicaSetWithPrimary' || topologyType === 'Sharded';
}

function profileView(profile) {
    const raw = typeof profile?.toObject === 'function' ? profile.toObject() : profile;
    return {
        id: String(raw._id || raw.id),
        businessName: raw.businessName,
        slug: raw.slug,
        active: raw.active !== false,
        published: Boolean(raw.published)
    };
}

function createProfessionalRegistrationService(dependencies = {}) {
    const deps = {
        User,
        BarberProfile,
        Subscription,
        createUser,
        createDefaultProfile,
        ensureFreePlan,
        calculateSubscriptionState,
        connection: mongoose.connection,
        logger: console,
        ...dependencies
    };

    async function createRecords(normalized, freePlan, session = null) {
        const options = session ? { session } : {};
        const user = await deps.createUser(normalized.user, 'BARBER', options);
        const profile = await deps.createDefaultProfile(
            user._id,
            normalized.businessName,
            normalized.requestedSlug,
            options
        );
        const subscriptionData = { profile: profile._id, plan: freePlan._id, status: 'FREE' };
        const subscription = session
            ? (await deps.Subscription.create([subscriptionData], { session }))[0]
            : await deps.Subscription.create(subscriptionData);
        return { user, profile, subscription };
    }

    async function createWithCompensation(normalized, freePlan) {
        let user;
        let profile;
        try {
            user = await deps.createUser(normalized.user, 'BARBER');
            profile = await deps.createDefaultProfile(
                user._id,
                normalized.businessName,
                normalized.requestedSlug
            );
            const subscription = await deps.Subscription.create({
                profile: profile._id,
                plan: freePlan._id,
                status: 'FREE'
            });
            return { user, profile, subscription };
        } catch (error) {
            const cleanup = [];
            if (profile?._id) cleanup.push(deps.Subscription.deleteMany({ profile: profile._id }));
            if (profile?._id) cleanup.push(deps.BarberProfile.deleteOne({ _id: profile._id }));
            else if (user?._id) cleanup.push(deps.BarberProfile.deleteMany({ owner: user._id }));
            if (user?._id) cleanup.push(deps.User.deleteOne({ _id: user._id }));
            const cleanupResults = await Promise.allSettled(cleanup);
            if (cleanupResults.some((item) => item.status === 'rejected')) {
                deps.logger.error('Falha ao compensar autocadastro profissional.', { cleanupResults });
            }
            throw error;
        }
    }

    return async function registerProfessional(payload) {
        const normalized = normalizeProfessionalPayload(payload);
        const freePlan = await deps.ensureFreePlan();
        let records;

        if (supportsTransactions(deps.connection)) {
            const dbSession = await deps.connection.startSession();
            try {
                await dbSession.withTransaction(async () => {
                    records = await createRecords(normalized, freePlan, dbSession);
                });
            } finally {
                await dbSession.endSession();
            }
        } else {
            records = await createWithCompensation(normalized, freePlan);
        }

        return {
            user: records.user,
            profile: profileView(records.profile),
            billing: deps.calculateSubscriptionState(records.subscription, freePlan)
        };
    };
}

const registerProfessional = createProfessionalRegistrationService();

module.exports = {
    normalizeProfessionalPayload,
    supportsTransactions,
    profileView,
    createProfessionalRegistrationService,
    registerProfessional
};

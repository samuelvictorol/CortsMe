const { User, BarberProfile, Media } = require('../collections/CortsmeModels');
const { createUser } = require('./user.service');
const { createDefaultProfile } = require('./profile.service');
const { validateAvatarFile, saveAvatarUpload } = require('./avatar.service');

function invalidPayload() {
    return Object.assign(new Error('Dados do usuário inválidos.'), {
        statusCode: 400,
        code: 'ADMIN_USER_PAYLOAD_INVALID'
    });
}

function parseAdminUserPayload(body = {}) {
    if (body?.data === undefined) return body || {};
    if (typeof body.data !== 'string') throw invalidPayload();
    let parsed;
    try {
        parsed = JSON.parse(body.data);
    } catch {
        throw invalidPayload();
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw invalidPayload();
    return parsed;
}

function createAdminUserService(dependencies = {}) {
    const deps = {
        User,
        BarberProfile,
        Media,
        createUser,
        createDefaultProfile,
        validateAvatarFile,
        saveAvatarUpload,
        logger: console,
        ...dependencies
    };

    return async function createAdminUser(payload, file) {
        if (file) deps.validateAvatarFile(file);
        const role = payload.role === 'BARBER' ? 'BARBER' : 'USER';
        let user;
        let profile = null;
        try {
            user = await deps.createUser(payload, role);
            if (role === 'BARBER') {
                profile = await deps.createDefaultProfile(
                    user._id,
                    payload.businessName || user.name,
                    payload.slug
                );
            }
        } catch (error) {
            if (user?._id) {
                const cleanup = await Promise.allSettled([
                    deps.BarberProfile.deleteMany({ owner: user._id }),
                    deps.Media.deleteMany({ owner: user._id }),
                    deps.User.deleteOne({ _id: user._id })
                ]);
                if (cleanup.some((result) => result.status === 'rejected')) {
                    deps.logger.error('Falha ao compensar criação administrativa de usuário.', {
                        userId: String(user._id)
                    });
                }
            }
            throw error;
        }

        let avatarWarning = '';
        if (file) {
            try {
                user = await deps.saveAvatarUpload(user._id, file);
            } catch (error) {
                // O cadastro principal é válido e deve ser reconhecido pela UI. O serviço
                // de avatar remove o blob staged antes de lançar erros pré-associação.
                avatarWarning = 'Usuário criado, mas a foto não pôde ser salva. Tente enviá-la novamente ao editar o cadastro.';
                deps.logger.warn('Cadastro administrativo concluído sem avatar.', {
                    userId: String(user._id),
                    code: error.code || 'AVATAR_SAVE_FAILED'
                });
            }
        }
        return { user, profile, avatarWarning };
    };
}

module.exports = {
    parseAdminUserPayload,
    createAdminUserService,
    createAdminUser: createAdminUserService()
};

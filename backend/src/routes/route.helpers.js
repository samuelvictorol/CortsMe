function asyncRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function pageOptions(query) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    return { page, limit, skip: (page - 1) * limit };
}

function paged(data, total, page, limit) {
    return { data, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
}

module.exports = { asyncRoute, pageOptions, paged };

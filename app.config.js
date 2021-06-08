export default {
    local: {
        basePath: '/dist/',
        entryPointURL: 'http://127.0.0.1:8000',
        keyCloakBaseURL: 'https://auth-dev.tugraz.at/auth',
        keyCloakClientId: 'auth-dev-mw-frontend-local',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        siteName: 'TU Graz',
        siteSubName: 'Graz University of Technology'
    },
    development: {
        basePath: '/apps/checkin/',
        entryPointURL: 'https://mw-dev.tugraz.at',
        keyCloakBaseURL: 'https://auth-dev.tugraz.at/auth',
        keyCloakClientId: 'checkin-dev_tugraz_at-CHECKIN',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        siteName: 'TU Graz',
        siteSubName: 'Graz University of Technology'
    },
    demo: {
        basePath: '/apps/checkin/',
        entryPointURL: 'https://api-demo.tugraz.at',
        keyCloakBaseURL: 'https://auth-test.tugraz.at/auth',
        keyCloakClientId: 'checkin-demo_tugraz_at-CHECKIN',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        siteName: 'TU Graz',
        siteSubName: 'Graz University of Technology'
    },
    production: {
        basePath: '/',
        entryPointURL: 'https://api.tugraz.at',
        keyCloakBaseURL: 'https://auth.tugraz.at/auth',
        keyCloakClientId: 'checkin_tugraz_at-CHECKIN',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 150,
        siteName: 'TU Graz',
        siteSubName: 'Graz University of Technology'
    },
};
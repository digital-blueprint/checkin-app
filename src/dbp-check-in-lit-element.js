import DBPLitElement from 'dbp-common/dbp-lit-element';

export default class DBPCheckInLitElement extends DBPLitElement {
    constructor() {
        super();
        this.isSessionRefreshed = false;
    }

    /**
     * Send a fetch to given url with given options
     *
     * @param url
     * @param options
     *
     * @returns {object} response (error or result)
     *
     */
    async httpGetAsync(url, options) {
        let response = await fetch(url, options).then(result => {
            if (!result.ok) throw result;
            return result;
        }).catch(error => {
            return error;
        });

        return response;
    }

    /**
     * Gets the active checkins of the current logged in user
     *
     * @returns {object} response
     *
     */
    async getActiveCheckIns() {
        let response;

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + window.DBPAuthToken
            },
        };
        response = await this.httpGetAsync(this.entryPointUrl + '/location_check_in_actions', options);
        return response;
    }

    /**
     * Checkout at a specific location
     *
     * @param  locationHash
     * @param seatNumber (optional)
     *
     * @returns {object} response
     *
     */
    async sendCheckOutRequest(locationHash, seatNumber) {
        let response;

        let body = {
            "location": "/check_in_places/" + locationHash,
            "seatNumber": parseInt(seatNumber),
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + window.DBPAuthToken
            },
            body: JSON.stringify(body)
        };

        response = await this.httpGetAsync(this.entryPointUrl + '/location_check_out_actions', options);
        return response;
    }

    /**
     * Checkin at a specific location
     *
     * @param  locationHash
     * @param seatNumber (optional)
     *
     * @returns {object} response
     *
     */
    async sendCheckInRequest(locationHash, seatNumber) {
        let response;

        let body = {
            "location": '/check_in_places/' + locationHash,
            "seatNumber": parseInt(seatNumber),
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + window.DBPAuthToken
            },
            body: JSON.stringify(body)
        };

        response = await this.httpGetAsync(this.entryPointUrl + '/location_check_in_actions', options);

        return response;
    }
}